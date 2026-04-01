"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@onehash/ui/button";
import { Label } from "@onehash/ui/label";
import { Calendar } from "@onehash/ui/calendar";
import { MultiSelect } from "@onehash/ui/select";
import { MainPagesLayout } from "@/components/common/MainPagesLayout";
import { format, isAfter, isBefore, subDays, startOfDay } from "date-fns";
import {
  JobCategories,
  EmploymentType,
  JobStatusType,
  employmentTypes,
  jobStatuses,
} from "./[jobId]/constants";
import { getJobs, createJob, type JobListItemResponse } from "@/api";
import { toast } from "@onehash/ui/sonner";
import { useAuthSession } from "@/app/providers";
import { getJobsBaseUrl } from "@/lib/host";
import { JobsList } from "@/components/jobs/JobsList";
import { CreateJobModal } from "@/components/jobs/CreateJobModal";
import { JobsListSkeleton } from "@/components/jobs/Skeleton";
import { EmptyCard, ErrorCard } from "@onehash/ui/card";
import { useSetPageMetadata } from "@/hooks/useSetPageMetadata";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRouter } from "next/navigation";
const statusKey: Record<JobStatusType, string> = {
  open: "open",
  draft: "draft",
  archived: "archived",
};
const typeKey: Record<EmploymentType, string> = {
  full_time: "full_time",
  part_time: "part_time",
  contract: "contract",
  internship: "internship",
};

type DatePreset = "today" | "7d" | "30d" | "custom" | null;

export default function JobsPage() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const router = useRouter();
  const { user } = useAuthSession();

  useSetPageMetadata({
    title: t("jobs_title"),
    subtitle: t("jobs_subtitle"),
  });

  const [jobs, setJobs] = useState<JobListItemResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [datePreset, setDatePreset] = useState<DatePreset>(null);
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [createOpen, setCreateOpen] = useState(false);

  const generateOrgSlug = () => {
    if (!user?.org_id || !user?.org_name) return null;
    const slug = user.org_name.toLowerCase().replace(/\s+/g, "-");
    return `${slug}-${user.org_id}`;
  };

  const openJobPortal = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    const orgSlug = generateOrgSlug();
    if (!orgSlug) {
      toast.error("Unable to open job portal");
      return;
    }
    const url = `${getJobsBaseUrl()}/${orgSlug}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const fetchJobs = useCallback(async (signal?: AbortSignal) => {
    try {
      setError(null);
      const data = await getJobs();
      if (!signal?.aborted) setJobs(data);
    } catch (err) {
      if (!signal?.aborted) setError(err instanceof Error ? err.message : "Failed to load jobs");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchJobs(controller.signal);
    return () => controller.abort();
  }, [fetchJobs]);

  const applyDatePreset = (preset: DatePreset) => {
    setDatePreset(preset);
    if (preset === "today") {
      setDateRange({ from: startOfDay(new Date()), to: new Date() });
    } else if (preset === "7d") {
      setDateRange({ from: subDays(new Date(), 7), to: new Date() });
    } else if (preset === "30d") {
      setDateRange({ from: subDays(new Date(), 30), to: new Date() });
    } else if (preset === null) {
      setDateRange({});
    }
  };

  const hasFilters =
    statusFilter.length > 0 ||
    categoryFilter.length > 0 ||
    typeFilter.length > 0 ||
    datePreset !== null;

  const clearAll = () => {
    setStatusFilter([]);
    setCategoryFilter([]);
    setTypeFilter([]);
    setDatePreset(null);
    setDateRange({});
  };

  const filtered = useMemo(() => {
    return jobs.filter((job) => {
      if (
        search &&
        !job.title.toLowerCase().includes(search.toLowerCase()) &&
        !(job.category ?? "").toLowerCase().includes(search.toLowerCase())
      )
        return false;
      if (statusFilter.length && !statusFilter.includes(job.status as JobStatusType)) return false;
      if (categoryFilter.length && !categoryFilter.includes(job.category ?? "")) return false;
      if (typeFilter.length && !typeFilter.includes((job.employment_type ?? "") as EmploymentType))
        return false;
      if (dateRange.from) {
        const jobDate = new Date(job.updated_at);
        if (isBefore(jobDate, startOfDay(dateRange.from))) return false;
      }
      if (dateRange.to) {
        const jobDate = new Date(job.updated_at);
        if (isAfter(startOfDay(jobDate), dateRange.to)) return false;
      }
      return true;
    });
  }, [jobs, search, statusFilter, categoryFilter, typeFilter, dateRange]);

  const statusOptions = jobStatuses.map((s) => ({ value: s, label: t(statusKey[s]) }));
  const categoryOptions = JobCategories.map((d) => ({ value: d, label: t(d) }));
  const typeOptions = employmentTypes.map((tp) => ({ value: tp, label: t(typeKey[tp]) }));

  const activeChips: { label: string; clear: () => void }[] = [];
  statusFilter.forEach((s) =>
    activeChips.push({
      label: t(statusKey[s as JobStatusType]),
      clear: () => setStatusFilter((p) => p.filter((v) => v !== s)),
    }),
  );
  categoryFilter.forEach((d) =>
    activeChips.push({
      label: t(d, { defaultValue: d }),
      clear: () => setCategoryFilter((p) => p.filter((v) => v !== d)),
    }),
  );
  typeFilter.forEach((tp) =>
    activeChips.push({
      label: t(typeKey[tp as EmploymentType]),
      clear: () => setTypeFilter((p) => p.filter((v) => v !== tp)),
    }),
  );
  if (datePreset) {
    let dateLabel: string;
    if (datePreset === "custom" && dateRange.from) {
      dateLabel = dateRange.to
        ? `${format(dateRange.from, "d MMM, yyyy")} – ${format(dateRange.to, "d MMM, yyyy")}`
        : format(dateRange.from, "d MMM, yyyy");
    } else if (datePreset === "custom") {
      dateLabel = t("custom");
    } else if (datePreset === "today") {
      dateLabel = t("today");
    } else {
      dateLabel = t("last_n_days", { count: datePreset === "7d" ? 7 : 30 });
    }
    activeChips.push({ label: dateLabel, clear: () => applyDatePreset(null) });
  }

  const filterContent = (
    <div className="space-y-5 p-1">
      <MultiSelect
        label={t("status")}
        value={statusFilter}
        onValueChange={setStatusFilter}
        options={statusOptions}
        placeholder="All status"
        triggerClassName="h-8 text-xs"
        showSelectAllClear
      />
      <MultiSelect
        label={t("category")}
        value={categoryFilter}
        onValueChange={setCategoryFilter}
        options={categoryOptions}
        placeholder="All categories"
        triggerClassName="h-8 text-xs"
        showSelectAllClear
      />
      <MultiSelect
        label={t("type")}
        value={typeFilter}
        onValueChange={setTypeFilter}
        options={typeOptions}
        placeholder="All types"
        triggerClassName="h-8 text-xs"
        showSelectAllClear
      />
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground">{t("last_activity")}</Label>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { key: "today", label: t("today") },
              { key: "7d", label: t("last_n_days", { count: 7 }) },
              { key: "30d", label: t("last_n_days", { count: 30 }) },
              { key: "custom", label: t("custom") },
            ] as const
          ).map((p) => (
            <Button
              key={p.key}
              variant={datePreset === p.key ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => applyDatePreset(datePreset === p.key ? null : p.key)}
            >
              {p.label}
            </Button>
          ))}
        </div>
        {datePreset === "custom" && (
          <div className="mt-2">
            <Calendar
              mode="range"
              selected={dateRange.from ? { from: dateRange.from, to: dateRange.to } : undefined}
              onSelect={(range) => setDateRange(range ? { from: range.from, to: range.to } : {})}
              numberOfMonths={1}
              className="rounded-md border p-2 pointer-events-auto"
            />
          </div>
        )}
      </div>
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs h-8 text-muted-foreground"
          onClick={clearAll}
        >
          {t("clear_all")}
        </Button>
      )}
    </div>
  );

  if (error) {
    return (
      <ErrorCard
        icon="CircleAlert"
        title={t("error")}
        description={error}
        actionLabel={t("retry")}
        onAction={() => {
          setLoading(true);
          fetchJobs();
        }}
      />
    );
  }

  if (loading) {
    return <JobsListSkeleton count={6} />;
  }

  if (jobs.length === 0) {
    return (
      <>
        <EmptyCard
          icon="Briefcase"
          title={t("jobs_title")}
          description={t("jobs_subtitle")}
          actionLabel={t("create")}
          onAction={() => setCreateOpen(true)}
        />
        <CreateJobModal open={createOpen} onOpenChange={setCreateOpen} />
      </>
    );
  }

  return (
    <MainPagesLayout
      searchValue={search}
      onSearchChange={setSearch}
      actionLabel={t("create")}
      actionIcon="Plus"
      onAction={() => setCreateOpen(true)}
      secondaryActionLabel="Job Portal"
      secondaryActionIcon="Link"
      onSecondaryAction={openJobPortal}
      filterContent={filterContent}
      hasActiveFilters={hasFilters}
      activeChips={activeChips}
      onClearAllFilters={clearAll}
    >
      <JobsList jobs={filtered} onJobArchived={() => void fetchJobs()} />
      <CreateJobModal open={createOpen} onOpenChange={setCreateOpen} />
    </MainPagesLayout>
  );
}

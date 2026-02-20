"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent } from "@onehash/ui/card";
import { Button } from "@onehash/ui/button";
import { Badge } from "@onehash/ui/badge";
import { Label } from "@onehash/ui/label";
import { Icon } from "@onehash/ui/icon";
import { InputField } from "@onehash/ui/input";
import { Calendar } from "@onehash/ui/calendar";
import { MultiSelect } from "@onehash/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@onehash/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@onehash/ui/dialog";
import { Form, FormField, FormItem, FormControl } from "@onehash/ui/form";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRouter } from "next/navigation";
import { MainPagesLayout } from "@/components/common/MainPagesLayout";
import { format, isAfter, isBefore, subDays, startOfDay } from "date-fns";
import { jobNameSchema, type JobNameFormValues } from "@/lib/schemas/zodResolver";
import { DepartmentType, EmploymentType, JobStatusType } from "./[jobId]/constants";
import { getJobs, createJob, type JobListItemResponse } from "@/api";
import { toast } from "sonner";

const allDepts: DepartmentType[] = ["engineering", "design", "data", "marketing", "sales", "operations", "hr"];
const allTypes: EmploymentType[] = ["full_time", "part_time", "contract", "internship"];
const allStatuses = ["open", "draft", "closed"] as const;

const statusKey: Record<JobStatusType, string> = { open: "open", draft: "draft", closed: "closed" };
const deptKey: Record<DepartmentType, string> = {
  engineering: "engineering",
  design: "design",
  data: "data",
  marketing: "marketing",
  sales: "sales",
  operations: "operations",
  hr: "hr",
};
const typeKey: Record<EmploymentType, string> = {
  full_time: "full_time",
  part_time: "part_time",
  contract: "contract",
  internship: "internship",
};

const statusVariant = (s: JobStatusType) => s === "open" ? "default" : s === "draft" ? "secondary" : "outline";

type DatePreset = "today" | "7d" | "30d" | "custom" | null;

export default function JobsPage() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const router = useRouter();

  const [jobs, setJobs] = useState<JobListItemResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [deptFilter, setDeptFilter] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [datePreset, setDatePreset] = useState<DatePreset>(null);
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [createOpen, setCreateOpen] = useState(false);

  const createJobForm = useForm<JobNameFormValues>({
    defaultValues: { jobName: "" },
    resolver: zodResolver(jobNameSchema),
  });

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

  useEffect(() => {
    if (createOpen) createJobForm.reset({ jobName: "" });
  }, [createOpen]);

  const onCreateJobValid = async (data: JobNameFormValues) => {
    if (creating) return;
    setCreating(true);
    try {
      const job = await createJob(data.jobName.trim());
      setCreateOpen(false);
      router.push(`/jobs/${job.id}/info`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create job");
      setCreating(false);
    }
  };

  const applyDatePreset = (preset: DatePreset) => {
    setDatePreset(preset);
    if (preset === "today") { setDateRange({ from: startOfDay(new Date()), to: new Date() }); }
    else if (preset === "7d") { setDateRange({ from: subDays(new Date(), 7), to: new Date() }); }
    else if (preset === "30d") { setDateRange({ from: subDays(new Date(), 30), to: new Date() }); }
    else if (preset === null) { setDateRange({}); }
  };

  const hasFilters = statusFilter.length > 0 || deptFilter.length > 0 || typeFilter.length > 0 || datePreset !== null;

  const clearAll = () => {
    setStatusFilter([]); setDeptFilter([]); setTypeFilter([]);
    setDatePreset(null); setDateRange({});
  };

  const filtered = useMemo(() => {
    return jobs.filter((job) => {
      if (search && !job.title.toLowerCase().includes(search.toLowerCase()) && !(job.department ?? "").toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter.length && !statusFilter.includes(job.status as JobStatusType)) return false;
      if (deptFilter.length && !deptFilter.includes((job.department ?? "") as DepartmentType)) return false;
      if (typeFilter.length && !typeFilter.includes((job.employment_type ?? "") as EmploymentType)) return false;
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
  }, [jobs, search, statusFilter, deptFilter, typeFilter, dateRange]);

  const statusOptions = allStatuses.map((s) => ({ value: s, label: t(statusKey[s]) }));
  const deptOptions = allDepts.map((d) => ({ value: d, label: t(deptKey[d]) }));
  const typeOptions = allTypes.map((tp) => ({ value: tp, label: t(typeKey[tp]) }));

  const activeChips: { label: string; clear: () => void }[] = [];
  statusFilter.forEach((s) => activeChips.push({ label: t(statusKey[s as JobStatusType]), clear: () => setStatusFilter((p) => p.filter((v) => v !== s)) }));
  deptFilter.forEach((d) => activeChips.push({ label: t(deptKey[d as DepartmentType]), clear: () => setDeptFilter((p) => p.filter((v) => v !== d)) }));
  typeFilter.forEach((tp) => activeChips.push({ label: t(typeKey[tp as EmploymentType]), clear: () => setTypeFilter((p) => p.filter((v) => v !== tp)) }));
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
        label={t("department")}
        value={deptFilter}
        onValueChange={setDeptFilter}
        options={deptOptions}
        placeholder="All departments"
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
          {([
            { key: "today", label: t("today") },
            { key: "7d", label: t("last_n_days", { count: 7 }) },
            { key: "30d", label: t("last_n_days", { count: 30 }) },
            { key: "custom", label: t("custom") },
          ] as const).map((p) => (
            <Button key={p.key} variant={datePreset === p.key ? "default" : "outline"} size="sm" className="h-7 text-xs" onClick={() => applyDatePreset(datePreset === p.key ? null : p.key)}>
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
        <Button variant="ghost" size="sm" className="w-full text-xs h-8 text-muted-foreground" onClick={clearAll}>
          {t("clear_all")}
        </Button>
      )}
    </div>
  );

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    return `${diffDays}d ago`;
  };

  if (loading) {
    return (
      <MainPagesLayout
        searchValue=""
        onSearchChange={() => {}}
        actionLabel={t("create")}
        actionIcon="Plus"
        onAction={() => {}}
        filterContent={<div />}
        hasActiveFilters={false}
        activeChips={[]}
        onClearAllFilters={() => {}}
      >
        <div className="flex items-center justify-center py-16">
          <p className="text-sm text-muted-foreground">{t("loading") || "Loading..."}</p>
        </div>
      </MainPagesLayout>
    );
  }

  if (error) {
    return (
      <MainPagesLayout
        searchValue=""
        onSearchChange={() => {}}
        actionLabel={t("create")}
        actionIcon="Plus"
        onAction={() => {}}
        filterContent={<div />}
        hasActiveFilters={false}
        activeChips={[]}
        onClearAllFilters={() => {}}
      >
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={() => { setLoading(true); fetchJobs(); }}>
            {t("retry") || "Retry"}
          </Button>
        </div>
      </MainPagesLayout>
    );
  }

  return (
    <MainPagesLayout
      searchValue={search}
      onSearchChange={setSearch}
      actionLabel={t("create")}
      actionIcon="Plus"
      onAction={() => setCreateOpen(true)}
      filterContent={filterContent}
      hasActiveFilters={hasFilters}
      activeChips={activeChips}
      onClearAllFilters={clearAll}
    >
      {isMobile ? (
        <div className="space-y-2">
          {filtered.map((job) => (
            <Card key={job.id} className="active:bg-muted/50 transition-colors cursor-pointer" onClick={() => router.push(`/jobs/${job.id}/info`)}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-1.5">
                  <h3 className="text-sm font-medium leading-tight pr-2">{job.title}</h3>
                  <Badge variant={statusVariant(job.status as JobStatusType)} className="text-[10px] shrink-0">{t(statusKey[job.status as JobStatusType] ?? job.status)}</Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {job.department && <span>{t(deptKey[job.department as DepartmentType] ?? job.department)}</span>}
                  <span>·</span>
                  <span>{job.candidate_count} {job.candidate_count === 1 ? t("candidate") : t("candidates")}</span>
                  <span>·</span>
                  <span>{formatTimeAgo(job.updated_at)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">{t("no_results")}</p>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">{t("role")}</TableHead>
                  <TableHead className="text-xs">{t("department")}</TableHead>
                  <TableHead className="text-xs">{t("status")}</TableHead>
                  <TableHead className="text-xs text-right">{t("candidates")}</TableHead>
                  <TableHead className="text-xs text-right">{t("last_activity")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((job) => (
                  <TableRow key={job.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/jobs/${job.id}/info`)}>
                    <TableCell className="text-sm font-medium">{job.title}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{job.department ? t(deptKey[job.department as DepartmentType] ?? job.department) : "—"}</TableCell>
                    <TableCell><Badge variant={statusVariant(job.status as JobStatusType)} className="text-[10px]">{t(statusKey[job.status as JobStatusType] ?? job.status)}</Badge></TableCell>
                    <TableCell className="text-xs text-right">{job.candidate_count}</TableCell>
                    <TableCell className="text-xs text-muted-foreground text-right">{formatTimeAgo(job.updated_at)}</TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-sm text-muted-foreground text-center py-8">{t("no_results")}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("create_job")}</DialogTitle>
            <DialogDescription>{t("create_job_description")}</DialogDescription>
          </DialogHeader>
          <Form form={createJobForm} onSubmit={onCreateJobValid}>
            <FormField
              control={createJobForm.control}
              name="jobName"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormControl>
                    <InputField
                      {...field}
                      label={t("job_name")}
                      autoFocus
                      placeholder="e.g. Senior Frontend Engineer"
                      className="mt-1.5"
                      error={
                        fieldState.error?.message
                          ? fieldState.error.message === "min"
                            ? t("min_char_length", { count: 1 })
                            : fieldState.error.message === "max"
                              ? t("max_char_length", { count: 100 })
                              : t("job_name_invalid")
                          : undefined
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          createJobForm.handleSubmit(onCreateJobValid)();
                        }
                      }}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button variant="outline" size="sm" type="button" onClick={() => setCreateOpen(false)}>
                {t("cancel")}
              </Button>
              <Button size="sm" type="submit" disabled={creating}>
                {creating ? (t("creating") || "Creating...") : t("continue")}
              </Button>
            </DialogFooter>
          </Form>
        </DialogContent>
      </Dialog>
    </MainPagesLayout>
  );
}

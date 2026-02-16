"use client";

import { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card, CardContent, Button, Badge, Label, Checkbox, Icon, InputField,
  Calendar,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
  Form, FormField, FormItem, FormLabel, FormControl,
} from "@onehash/ui";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRouter } from "next/navigation";
import { MainPagesLayout } from "@/components/MainPagesLayout";
import { format, isAfter, isBefore, subDays, startOfDay } from "date-fns";
import { jobNameSchema, type JobNameFormValues } from "@/lib/schemas/zodResolver";
import { DepartmentType, EmploymentType, JobStatusType } from "./[id]/setup/constants";

const jobs = [
  { role: "Senior Frontend Engineer", dept: "Engineering", type: "Full-time", status: "open", candidates: 34, lastActivity: "2h ago", lastActivityDate: new Date() },
  { role: "Product Designer", dept: "Design", type: "Full-time", status: "open", candidates: 22, lastActivity: "5h ago", lastActivityDate: new Date() },
  { role: "Data Scientist", dept: "Data", type: "Contract", status: "draft", candidates: 0, lastActivity: "1d ago", lastActivityDate: subDays(new Date(), 1) },
  { role: "Engineering Manager", dept: "Engineering", type: "Full-time", status: "open", candidates: 18, lastActivity: "3h ago", lastActivityDate: new Date() },
  { role: "Marketing Lead", dept: "Marketing", type: "Part-time", status: "closed", candidates: 45, lastActivity: "5d ago", lastActivityDate: subDays(new Date(), 5) },
];

const allDepts = ["Engineering", "Design", "Data", "Marketing", "Sales", "Operations", "HR"] as const;
const allTypes = ["Full-time", "Part-time", "Contract", "Internship"] as const;
const allStatuses = ["open", "draft", "closed"] as const;

const statusKey: Record<JobStatusType, string> = { open: "open", draft: "draft", closed: "closed" };
const deptKey: Record<string, string> = { Engineering: "engineering", Design: "design", Data: "data", Marketing: "marketing", Sales: "sales", Operations: "operations", HR: "hr" };
const typeKey: Record<string, string> = { "Full-time": "full_time", "Part-time": "part_time", Contract: "contract", Internship: "internship" };

const statusVariant = (s: JobStatusType) => s === "open" ? "default" : s === "draft" ? "secondary" : "outline";

type DatePreset = "today" | "7d" | "30d" | "custom" | null;

export default function JobsPage() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<JobStatusType[]>([]);
  const [deptFilter, setDeptFilter] = useState<DepartmentType[]>([]);
  const [typeFilter, setTypeFilter] = useState<EmploymentType[]>([]);
  const [datePreset, setDatePreset] = useState<DatePreset>(null);
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [createOpen, setCreateOpen] = useState(false);

  const createJobForm = useForm<JobNameFormValues>({
    defaultValues: { jobName: "" },
    resolver: zodResolver(jobNameSchema),
  });

  useEffect(() => {
    if (createOpen) createJobForm.reset({ jobName: "" });
  }, [createOpen]);

  const onCreateJobValid = (data: JobNameFormValues) => {
    setCreateOpen(false);
    router.push(`/jobs/${encodeURIComponent(data.jobName.trim())}/setup`);
  };

  const toggleArrayFilter = <T extends string | JobStatusType | DepartmentType | EmploymentType>(arr: T[], val: T, setter: (v: T[]) => void) => {
    setter(arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]);
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
      if (search && !job.role.toLowerCase().includes(search.toLowerCase()) && !job.dept.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter.length && !statusFilter.includes(job.status)) return false;
      if (deptFilter.length && !deptFilter.includes(job.dept)) return false;
      if (typeFilter.length && !typeFilter.includes(job.type)) return false;
      if (dateRange.from && isBefore(job.lastActivityDate, startOfDay(dateRange.from))) return false;
      if (dateRange.to && isAfter(startOfDay(job.lastActivityDate), dateRange.to)) return false;
      return true;
    });
  }, [search, statusFilter, deptFilter, typeFilter, dateRange]);

  const activeChips: { label: string; clear: () => void }[] = [];
  statusFilter.forEach((s) => activeChips.push({ label: t(statusKey[s]), clear: () => setStatusFilter((p) => p.filter((v) => v !== s)) }));
  deptFilter.forEach((d) => activeChips.push({ label: t(deptKey[d]), clear: () => setDeptFilter((p) => p.filter((v) => v !== d)) }));
  typeFilter.forEach((tp) => activeChips.push({ label: t(typeKey[tp]), clear: () => setTypeFilter((p) => p.filter((v) => v !== tp)) }));
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
    <div className="space-y-5">
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground">{t("status")}</Label>
        <div className="space-y-1.5">
          {allStatuses.map((s) => (
            <label key={s} className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={statusFilter.includes(s)} onCheckedChange={() => toggleArrayFilter(statusFilter, s, setStatusFilter)} />
              <span className="text-sm">{t(statusKey[s])}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground">{t("department")}</Label>
        <div className="space-y-1.5">
          {allDepts.map((d) => (
            <label key={d} className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={deptFilter.includes(d)} onCheckedChange={() => toggleArrayFilter(deptFilter, d, setDeptFilter)} />
              <span className="text-sm">{t(deptKey[d])}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground">{t("type")}</Label>
        <div className="space-y-1.5">
          {allTypes.map((tp) => (
            <label key={tp} className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={typeFilter.includes(tp)} onCheckedChange={() => toggleArrayFilter(typeFilter, tp, setTypeFilter)} />
              <span className="text-sm">{t(typeKey[tp])}</span>
            </label>
          ))}
        </div>
      </div>
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
          {t("clear_all_filters")}
        </Button>
      )}
    </div>
  );

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
            <Card key={job.role} className="active:bg-muted/50 transition-colors cursor-pointer" onClick={() => router.push(`/jobs/${encodeURIComponent(job.role)}/setup`)}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-1.5">
                  <h3 className="text-sm font-medium leading-tight pr-2">{job.role}</h3>
                  <Badge variant={statusVariant(job.status)} className="text-[10px] shrink-0">{t(statusKey[job.status])}</Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{t(deptKey[job.dept])}</span>
                  <span>·</span>
                  <span>{job.candidates} {job.candidates === 1 ? t("candidate") : t("candidates")}</span>
                  <span>·</span>
                  <span>{job.lastActivity}</span>
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
                  <TableRow key={job.role} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/jobs/${encodeURIComponent(job.role)}/setup`)}>
                    <TableCell className="text-sm font-medium">{job.role}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{t(deptKey[job.dept])}</TableCell>
                    <TableCell><Badge variant={statusVariant(job.status)} className="text-[10px]">{t(statusKey[job.status])}</Badge></TableCell>
                    <TableCell className="text-xs text-right">{job.candidates}</TableCell>
                    <TableCell className="text-xs text-muted-foreground text-right">{job.lastActivity}</TableCell>
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
          <Form {...createJobForm}>
            <FormField
              control={createJobForm.control}
              name="jobName"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel>{t("job_name")}</FormLabel>
                  <FormControl>
                    <InputField
                      {...field}
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
              <Button size="sm" type="button" onClick={createJobForm.handleSubmit(onCreateJobValid)}>
                {t("continue")}
              </Button>
            </DialogFooter>
          </Form>
        </DialogContent>
      </Dialog>
    </MainPagesLayout>
  );
}

"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Badge } from "@onehash/ui/badge";
import { Avatar } from "@onehash/ui/avatar";
import { Button } from "@onehash/ui/button";
import { Calendar } from "@onehash/ui/calendar";
import { Checkbox } from "@onehash/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@onehash/ui/popover";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@onehash/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@onehash/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@onehash/ui/tooltip";
import { ArrowDownAZ, ArrowDownUp, ArrowUpAZ, FileMinus2 as FileMinusCorner, SquareStack } from "lucide-react";
import { formatTimestamp } from "@/lib/format-date";
import { formatPhoneForDisplay } from "@/lib/phone";
import { getInitialsFromName } from "@/lib/name-initials";
import { formatCandidateSource, formatEmailDomain } from "@/lib/candidate-source";
import { type CandidateListItemResponse, type CandidateSortBy, type JobListItemResponse } from "@/api";
import { TruncatedText } from "@/components/common/TruncatedText";
import { setCandidateNavigationContext } from "@/lib/candidate-navigation";

const CANDIDATE_DATE_CALENDAR_CLASS_NAMES = {
  months: "relative flex w-full flex-col",
  month: "w-full space-y-3",
  month_caption: "relative flex h-10 items-center justify-center px-12",
  caption_label: "text-center text-sm font-semibold leading-none text-foreground",
  nav: "pointer-events-none absolute inset-x-0 top-0 z-10 flex h-10 w-full items-center justify-between px-1",
  button_previous:
    "pointer-events-auto !size-8 shrink-0 rounded-md border border-input bg-background p-0 opacity-75 shadow-sm transition-colors hover:bg-accent hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  button_next:
    "pointer-events-auto !size-8 shrink-0 rounded-md border border-input bg-background p-0 opacity-75 shadow-sm transition-colors hover:bg-accent hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  month_grid: "w-full table-fixed border-collapse border-spacing-0",
};

export const CANDIDATE_COLUMN_DEFS = {
  name: { label: "Candidate", fixed: true, defaultVisible: true },
  email: { label: "Email", fixed: true, defaultVisible: true },
  score: { label: "Resume score", fixed: false, defaultVisible: true },
  phone: { label: "Phone", fixed: false, defaultVisible: true },
  assigned_jobs: { label: "Assigned Jobs", fixed: false, defaultVisible: true },
  created_at: { label: "Created", fixed: false, defaultVisible: true },
  source: { label: "Source", fixed: false, defaultVisible: true },
  status: { label: "Status", fixed: false, defaultVisible: false },
  location: { label: "Location", fixed: false, defaultVisible: false },
  updated_at: { label: "Updated", fixed: false, defaultVisible: false },
  stage_name: { label: "Stage", fixed: false, defaultVisible: false },
} as const;

export type CandidateColumnKey = keyof typeof CANDIDATE_COLUMN_DEFS;
export type CandidateDatePeriod = "all" | "today" | "yesterday" | "7d" | "30d" | "custom";

type CandidateDateRange = {
  from?: Date;
  to?: Date;
};

export type CandidateTableHeaderControls = {
  sortBy: CandidateSortBy;
  sortOrder: "asc" | "desc";
  onSortChange: (sortBy: CandidateSortBy, sortOrder: "asc" | "desc") => void;
  emailDomain: string;
  emailDomains: string[];
  onEmailDomainChange: (emailDomain: string) => void;
  assignedJobId: string;
  assignedJobOptions: Array<{ value: string; label: string }>;
  onAssignedJobChange: (jobId: string) => void;
  source: string;
  sourceOptions: Array<{ value: string; label: string }>;
  onSourceChange: (source: string) => void;
  status: string;
  onStatusChange: (status: string) => void;
  createdPeriod: CandidateDatePeriod;
  createdRange: CandidateDateRange;
  onCreatedPeriodChange: (period: CandidateDatePeriod) => void;
  onCreatedRangeChange: (range: CandidateDateRange) => void;
  updatedPeriod: CandidateDatePeriod;
  updatedRange: CandidateDateRange;
  onUpdatedPeriodChange: (period: CandidateDatePeriod) => void;
  onUpdatedRangeChange: (range: CandidateDateRange) => void;
};

export const CANDIDATE_ALL_COLUMNS = Object.keys(CANDIDATE_COLUMN_DEFS) as CandidateColumnKey[];
export const CANDIDATE_FIXED_COLUMNS = CANDIDATE_ALL_COLUMNS.filter(
  (key) => CANDIDATE_COLUMN_DEFS[key].fixed,
);
export const DEFAULT_VISIBLE_CANDIDATE_COLUMNS = CANDIDATE_ALL_COLUMNS.filter(
  (key) => CANDIDATE_COLUMN_DEFS[key].defaultVisible,
);

export function normalizeCandidateColumnOrder(
  columnOrder: string[] | CandidateColumnKey[] | null | undefined,
): CandidateColumnKey[] {
  const incoming = (columnOrder ?? []).filter(
    (key): key is CandidateColumnKey => key in CANDIDATE_COLUMN_DEFS,
  );
  const uniqueOrdered: CandidateColumnKey[] = [];
  const seen = new Set<CandidateColumnKey>();
  for (const key of incoming) {
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueOrdered.push(key);
  }
  for (const key of CANDIDATE_ALL_COLUMNS) {
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueOrdered.push(key);
  }
  return uniqueOrdered;
}

export function normalizeVisibleCandidateColumns(
  visibleColumns: string[] | CandidateColumnKey[] | null | undefined,
): CandidateColumnKey[] {
  // If no saved preference exists yet, use the product default column set.
  if (!Array.isArray(visibleColumns) || visibleColumns.length === 0) {
    return DEFAULT_VISIBLE_CANDIDATE_COLUMNS;
  }
  const incoming = new Set(
    (visibleColumns ?? []).filter((v): v is CandidateColumnKey => v in CANDIDATE_COLUMN_DEFS),
  );
  for (const fixed of CANDIDATE_FIXED_COLUMNS) incoming.add(fixed);
  const normalized = normalizeCandidateColumnOrder(CANDIDATE_ALL_COLUMNS).filter((key) =>
    incoming.has(key),
  );
  return normalized.length > 0 ? normalized : DEFAULT_VISIBLE_CANDIDATE_COLUMNS;
}

type Props = {
  items: CandidateListItemResponse[];
  total?: number;
  emptyState?: {
    title: string;
    description: string;
  };
  jobs?: JobListItemResponse[];
  selectedIds?: Set<string>;
  visibleColumns?: CandidateColumnKey[];
  columnOrder?: CandidateColumnKey[];
  onToggleSelected?: (candidateId: string, nextSelected: boolean) => void;
  onToggleAllVisible?: (nextSelected: boolean) => void;
  onListChange?: () => void | Promise<void>;
  onResolveDuplicate?: (candidate: CandidateListItemResponse) => void;
  headerControls?: CandidateTableHeaderControls;
};

export function CandidatesTable({
  items,
  total,
  emptyState,
  selectedIds,
  visibleColumns,
  columnOrder,
  onToggleSelected,
  onToggleAllVisible,
  onResolveDuplicate,
  headerControls,
}: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const visibleColumnSet = useMemo(
    () => new Set(normalizeVisibleCandidateColumns(visibleColumns)),
    [visibleColumns],
  );
  const normalizedColumnOrder = useMemo(
    () => normalizeCandidateColumnOrder(columnOrder),
    [columnOrder],
  );
  const orderedVisibleColumns = useMemo(
    () => normalizedColumnOrder.filter((column) => visibleColumnSet.has(column)),
    [normalizedColumnOrder, visibleColumnSet],
  );

  const allVisibleSelected = useMemo(() => {
    if (!selectedIds || items.length === 0) return false;
    return items.every((c) => selectedIds.has(c.id));
  }, [items, selectedIds]);

  const someVisibleSelected = useMemo(() => {
    if (!selectedIds || items.length === 0) return false;
    return items.some((c) => selectedIds.has(c.id)) && !allVisibleSelected;
  }, [items, selectedIds, allVisibleSelected]);

  const renderHeader = (column: CandidateColumnKey) => {
    const metadata: Record<
      CandidateColumnKey,
      { label: string; className: string; sortBy?: CandidateSortBy }
    > = {
      name: {
        label: t("col_candidate"),
        className: "min-w-[140px] max-w-[220px]",
        sortBy: "name",
      },
      email: { label: t("email"), className: "min-w-[160px] max-w-[240px]" },
      score: { label: "Resume score", className: "min-w-[110px]", sortBy: "score" },
      phone: { label: t("col_phone"), className: "min-w-[120px] max-w-[160px]" },
      assigned_jobs: {
        label: t("candidates_assigned_jobs"),
        className: "min-w-[160px] max-w-[280px]",
      },
      created_at: {
        label: t("candidates_table_created"),
        className: "min-w-[150px] whitespace-nowrap",
        sortBy: "created_at",
      },
      source: { label: t("col_source"), className: "min-w-[100px]" },
      status: { label: t("status"), className: "min-w-[100px]" },
      location: {
        label: t("col_location"),
        className: "min-w-[160px] max-w-[220px]",
      },
      updated_at: {
        label: t("col_updated"),
        className: "min-w-[150px] whitespace-nowrap",
      },
      stage_name: { label: t("stage"), className: "min-w-[140px] max-w-[200px]" },
    };
    const meta = metadata[column];
    const menuColumns: CandidateColumnKey[] = [
      "name",
      "email",
      "score",
      "assigned_jobs",
      "created_at",
      "source",
      "status",
      "updated_at",
    ];
    const showMenu = Boolean(headerControls && menuColumns.includes(column));
    const isSorted = Boolean(meta.sortBy && headerControls?.sortBy === meta.sortBy);
    const showSort = column === "name" || column === "score" || column === "created_at";
    const sortLabels =
      column === "name"
        ? { ascending: "A to Z", descending: "Z to A" }
        : column === "score"
          ? { ascending: "Lowest first", descending: "Highest first" }
          : { ascending: "Oldest first", descending: "Newest first" };
    const dateOptions = [
      { value: "all" as const, label: "Any time" },
      { value: "today" as const, label: "Today" },
      { value: "yesterday" as const, label: "Yesterday" },
      { value: "7d" as const, label: "Last 7 days" },
      { value: "30d" as const, label: "Last 30 days" },
      { value: "custom" as const, label: "Custom date" },
    ];
    const isDateColumn = column === "created_at" || column === "updated_at";
    const datePeriod = column === "created_at" ? headerControls?.createdPeriod : headerControls?.updatedPeriod;
    const dateRange = column === "created_at" ? headerControls?.createdRange : headerControls?.updatedRange;
    const onDatePeriodChange =
      column === "created_at"
        ? headerControls?.onCreatedPeriodChange
        : headerControls?.onUpdatedPeriodChange;
    const onDateRangeChange =
      column === "created_at"
        ? headerControls?.onCreatedRangeChange
        : headerControls?.onUpdatedRangeChange;

    const isDateFilterActive = Boolean(datePeriod && datePeriod !== "all");
    const isAscSorted = Boolean(isSorted && headerControls?.sortOrder === "asc" && !isDateFilterActive);
    const isDescSorted = Boolean(isSorted && headerControls?.sortOrder === "desc" && !isDateFilterActive);
    const isAnyTimeActive = Boolean(datePeriod === "all" && !isSorted);

    return (
      <TableHead key={column} className={`h-9 text-center text-xs font-medium ${meta.className}`}>
        <div className="flex items-center justify-center gap-0.5">
          <span className="truncate">{meta.label}</span>
          {showMenu && headerControls && isDateColumn ? (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  tooltip={`${meta.label} options`}
                  aria-label={`${meta.label} options`}
                >
                  <ArrowDownUp className="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                className={`w-72 max-w-[calc(100vw-1.5rem)] p-2 ${datePeriod === "custom" ? "max-h-[min(80vh,42rem)] overflow-y-auto" : ""}`}
              >
                {showSort && meta.sortBy ? (
                  <div className="pb-2">
                    <p className="px-2 py-1.5 text-sm font-semibold">Sort</p>
                    <button
                      type="button"
                      className={`flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent ${isAscSorted ? "bg-accent/60 font-medium" : ""}`}
                      onClick={() => {
                        onDatePeriodChange?.("all");
                        headerControls.onSortChange(meta.sortBy as CandidateSortBy, "asc");
                      }}
                    >
                      <span className="w-5 text-xs">{isAscSorted ? "✓" : ""}</span>
                      {sortLabels.ascending}
                    </button>
                    <button
                      type="button"
                      className={`flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent ${isDescSorted ? "bg-accent/60 font-medium" : ""}`}
                      onClick={() => {
                        onDatePeriodChange?.("all");
                        headerControls.onSortChange(meta.sortBy as CandidateSortBy, "desc");
                      }}
                    >
                      <span className="w-5 text-xs">{isDescSorted ? "✓" : ""}</span>
                      {sortLabels.descending}
                    </button>
                    <div className="mx-1 my-1 border-t border-border" />
                  </div>
                ) : null}
                <p className="px-2 py-1.5 text-sm font-semibold">
                  {column === "created_at" ? "Created date" : "Activity time"}
                </p>
                <div className="space-y-0.5">
                  {dateOptions.map((option) => {
                    const isOptionSelected =
                      option.value === "all" ? isAnyTimeActive : datePeriod === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={`flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent ${isOptionSelected ? "bg-accent/60 font-medium" : ""}`}
                        onClick={() => {
                          if (option.value === "all") {
                            headerControls.onSortChange("updated_at", "desc");
                          }
                          onDatePeriodChange?.(option.value);
                        }}
                      >
                        <span className="w-5 text-xs">{isOptionSelected ? "✓" : ""}</span>
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                {datePeriod === "custom" ? (
                  <Calendar
                    mode="range"
                    selected={dateRange?.from ? { from: dateRange.from, to: dateRange.to } : undefined}
                    onSelect={(range) => onDateRangeChange?.(range ? { from: range.from, to: range.to } : {})}
                    numberOfMonths={1}
                    className="mt-2 w-full rounded-md border bg-card p-3 text-foreground shadow-none"
                    classNames={CANDIDATE_DATE_CALENDAR_CLASS_NAMES}
                  />
                ) : null}
              </PopoverContent>
            </Popover>
          ) : showMenu && headerControls ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  tooltip={`${meta.label} options`}
                  aria-label={`${meta.label} options`}
                >
                  {column === "name" && isSorted && headerControls.sortOrder === "asc" ? (
                    <ArrowUpAZ className="h-3.5 w-3.5" />
                  ) : column === "name" && isSorted && headerControls.sortOrder === "desc" ? (
                    <ArrowDownAZ className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowDownUp className="h-3.5 w-3.5" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className={
                  (column === "created_at" && headerControls.createdPeriod === "custom") ||
                  (column === "updated_at" && headerControls.updatedPeriod === "custom")
                    ? "w-[22rem] max-w-[calc(100vw-2rem)]"
                    : "w-52"
                }
              >
                {showSort && meta.sortBy ? (
                  <>
                    <DropdownMenuLabel>Sort</DropdownMenuLabel>
                    <DropdownMenuCheckboxItem
                      checked={isSorted && headerControls.sortOrder === "asc"}
                      onSelect={() => headerControls.onSortChange(meta.sortBy as CandidateSortBy, "asc")}
                    >
                      {sortLabels.ascending}
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={isSorted && headerControls.sortOrder === "desc"}
                      onSelect={() => headerControls.onSortChange(meta.sortBy as CandidateSortBy, "desc")}
                    >
                      {sortLabels.descending}
                    </DropdownMenuCheckboxItem>
                  </>
                ) : null}
                {column === "email" ? (
                  <>
                    <DropdownMenuLabel>Email domain</DropdownMenuLabel>
                    <DropdownMenuCheckboxItem
                      checked={!headerControls.emailDomain}
                      onSelect={() => headerControls.onEmailDomainChange("")}
                    >
                      All domains
                    </DropdownMenuCheckboxItem>
                    {headerControls.emailDomains.map((domain) => (
                      <DropdownMenuCheckboxItem
                        key={domain}
                        checked={headerControls.emailDomain === domain}
                        onSelect={() => headerControls.onEmailDomainChange(domain)}
                      >
                        {formatEmailDomain(domain)} ({`@${domain}`})
                      </DropdownMenuCheckboxItem>
                    ))}
                  </>
                ) : null}
                {column === "assigned_jobs" ? (
                  <>
                    <DropdownMenuLabel>Assigned job</DropdownMenuLabel>
                    {headerControls.assignedJobOptions.map((option) => (
                      <DropdownMenuCheckboxItem
                        key={option.value}
                        checked={headerControls.assignedJobId === option.value}
                        onSelect={() => headerControls.onAssignedJobChange(option.value)}
                      >
                        {option.label}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </>
                ) : null}
                {column === "source" ? (
                  <>
                    <DropdownMenuLabel>Source</DropdownMenuLabel>
                    {headerControls.sourceOptions.map((option) => (
                      <DropdownMenuCheckboxItem
                        key={option.value}
                        checked={headerControls.source === option.value}
                        onSelect={() => headerControls.onSourceChange(option.value)}
                      >
                        {option.label}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </>
                ) : null}
                {column === "status" ? (
                  <>
                    <DropdownMenuLabel>Status</DropdownMenuLabel>
                    {[
                      { value: "", label: "All statuses" },
                      { value: "active", label: "Active" },
                      { value: "rejected", label: "Rejected" },
                      { value: "hired", label: "Hired" },
                    ].map((option) => (
                      <DropdownMenuCheckboxItem
                        key={option.value || "all"}
                        checked={headerControls.status === option.value}
                        onSelect={() => headerControls.onStatusChange(option.value)}
                      >
                        {option.label}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </TableHead>
    );
  };

  const renderCell = (column: CandidateColumnKey, c: CandidateListItemResponse) => {
    const activeAssignmentRows = (c.assignments ?? [])
      .filter((assignment) => assignment.assignment_status === "active")
      .map((assignment) => ({
        key: assignment.assigned_id,
        jobTitle: (assignment.job_title ?? "").trim() || "Untitled job",
        stageName: (assignment.stage_name ?? "").trim() || "No stage",
      }));
    const activeJobsCount = activeAssignmentRows.length;
    const activeStagesCount = activeAssignmentRows.length;

    if (column === "name") {
      const displayName = (c.name ?? "")
        .trim()
        .toLowerCase()
        .replace(/\b\w/g, (ch) => ch.toUpperCase());
      const hasResume = Boolean(c.has_resume);
      return (
        <TableCell key={column} className="py-2 align-middle min-w-0 max-w-[320px] text-center">
          <div className="flex items-center justify-center gap-2 min-w-0">
            <Avatar
              src={c.avatar_url}
              alt={displayName}
              className="h-7 w-7 shrink-0"
              fallbackClassName="bg-muted text-[10px] font-medium"
            >
              {getInitialsFromName(displayName)}
            </Avatar>
            <span className="text-sm font-medium truncate">{displayName || "—"}</span>
            {!hasResume && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    tabIndex={0}
                    role="img"
                    aria-label="No resume attached with candidate"
                    className="inline-flex items-center justify-center text-slate-400 hover:text-slate-600 dark:text-slate-300 dark:hover:text-white shrink-0 cursor-help transition-colors rounded-sm focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <FileMinusCorner className="h-[18px] w-[18px]" aria-hidden="true" />
                    <span className="sr-only">No resume attached with candidate</span>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  No resume attached with candidate
                </TooltipContent>
              </Tooltip>
            )}
            {c.is_pending_duplicate_review && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    tabIndex={0}
                    role="img"
                    aria-label="This candidate may already be in your records."
                    className="inline-flex items-center justify-center text-amber-500 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-300 shrink-0 cursor-help transition-colors rounded-sm focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-500"
                  >
                    <SquareStack className="h-[18px] w-[18px]" aria-hidden="true" />
                    <span className="sr-only">This candidate may already be in your records.</span>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  This candidate may already be in your records.
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </TableCell>
      );
    }
    if (column === "email") {
      return (
        <TableCell key={column} className="py-2 align-middle min-w-0 max-w-[240px] text-center">
          <TruncatedText className="mx-auto text-center text-xs text-muted-foreground">
            {c.email}
          </TruncatedText>
        </TableCell>
      );
    }
    if (column === "score") {
      const activeScores = (c.assignments ?? [])
        .filter((a) => a.assignment_status === "active")
        .map((a) => ({
          jobTitle: a.job_title ?? "Untitled job",
          score: a.resume_score,
          status: a.resume_score_status,
        }));

      if (activeScores.length === 0) {
        return (
          <TableCell key={column} className="py-2 align-middle text-center">
            <span className="text-xs text-muted-foreground">—</span>
          </TableCell>
        );
      }

      const getBadgeClass = (score: number | null | undefined, status: string | null | undefined) => {
        if (status === "pending") {
          return "bg-neutral-500/10 text-neutral-500 border-neutral-500/20";
        }
        if (score === null || score === undefined) return "bg-neutral-500/10 text-neutral-500 border-neutral-500/20";
        if (score >= 80) return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
        if (score >= 50) return "bg-amber-500/10 text-amber-600 border-amber-500/20";
        return "bg-red-500/10 text-red-600 border-red-500/20";
      };

      const renderScoreValue = (score: number | null | undefined, status: string | null | undefined) => {
        if (status === "pending") return "Pending";
        if (score === null || score === undefined) return "—";
        return score.toString();
      };

      if (activeScores.length === 1) {
        const item = activeScores[0];
        return (
          <TableCell key={column} className="py-2 align-middle text-center">
            <Badge variant="outline" className={`text-xs font-semibold whitespace-nowrap mx-auto ${getBadgeClass(item.score, item.status)}`}>
              {renderScoreValue(item.score, item.status)}
            </Badge>
          </TableCell>
        );
      }

      // Multiple scores
      const primaryItem = activeScores[0];
      return (
        <TableCell key={column} className="py-2 align-middle text-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className={`text-xs font-semibold cursor-pointer whitespace-nowrap mx-auto ${getBadgeClass(primaryItem.score, primaryItem.status)}`}>
                {renderScoreValue(primaryItem.score, primaryItem.status)}*
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[320px] text-xs">
              <div className="space-y-1">
                {activeScores.map((s, idx) => (
                  <p key={idx} className="text-xs leading-4">
                    {s.jobTitle}: <span className="font-semibold">{renderScoreValue(s.score, s.status)}</span>
                  </p>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        </TableCell>
      );
    }
    if (column === "phone") {
      return (
        <TableCell key={column} className="py-2 align-middle min-w-0 max-w-[160px] text-center">
          <span className="text-xs text-muted-foreground truncate block">
            {c.phone ? formatPhoneForDisplay(c.phone) : "—"}
          </span>
        </TableCell>
      );
    }
    if (column === "assigned_jobs") {
      return (
        <TableCell key={column} className="py-2 align-middle min-w-0 max-w-[280px] text-center">
          {activeJobsCount > 0 ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-xs text-muted-foreground inline-block mx-auto">
                  {activeJobsCount}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[320px] text-xs">
                <div className="space-y-1">
                  {activeAssignmentRows.map((row) => (
                    <p key={row.key} className="text-xs leading-4">
                      {row.jobTitle}
                    </p>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </TableCell>
      );
    }
    if (column === "created_at") {
      return (
        <TableCell key={column} className="py-2 align-middle min-w-0 max-w-[200px] text-center">
          <span className="text-xs text-muted-foreground">
            {formatTimestamp(c.created_at, "en-GB", { showRelative: true })}
          </span>
        </TableCell>
      );
    }
    if (column === "source") {
      return (
        <TableCell key={column} className="py-2 align-middle text-center">
          <Badge variant="outline" className="text-[10px] font-normal whitespace-nowrap mx-auto">
            {formatCandidateSource(c.source)}
          </Badge>
        </TableCell>
      );
    }
    if (column === "status") {
      return (
        <TableCell key={column} className="py-2 align-middle text-center">
          <Badge variant="secondary" className="text-[10px] font-normal capitalize mx-auto">
            {c.status}
          </Badge>
        </TableCell>
      );
    }
    if (column === "location") {
      return (
        <TableCell key={column} className="py-2 align-middle min-w-0 max-w-[220px] text-center">
          <span className="text-xs text-muted-foreground truncate block">{c.address ?? "—"}</span>
        </TableCell>
      );
    }
    if (column === "updated_at") {
      return (
        <TableCell key={column} className="py-2 align-middle min-w-0 max-w-[200px] text-center">
          <span className="text-xs text-muted-foreground">
            {formatTimestamp(c.updated_at, "en-GB", { showRelative: true })}
          </span>
        </TableCell>
      );
    }
    return (
      <TableCell key={column} className="py-2 align-middle min-w-0 max-w-[200px] text-center">
        {activeStagesCount > 0 ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xs text-muted-foreground inline-block mx-auto">
                {activeStagesCount}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[360px] text-xs">
              <div className="space-y-1">
                {activeAssignmentRows.map((row) => (
                  <p key={`stage-${row.key}`} className="text-xs leading-4">
                    {row.jobTitle} - {row.stageName}
                  </p>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
    );
  };

  return (
    <>
      <div className="rounded-lg border border-border bg-card">
        <Table className="w-max min-w-full">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {selectedIds && onToggleAllVisible ? (
                <TableHead className="w-10 h-9 align-middle text-center">
                  <div className="flex items-center justify-center">
                    <Checkbox
                      className="rounded-[4px]"
                      checked={
                        allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false
                      }
                      onCheckedChange={(v) => onToggleAllVisible(!!v)}
                      aria-label="Select all"
                    />
                  </div>
                </TableHead>
              ) : null}
              {orderedVisibleColumns.map((column) => renderHeader(column))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && emptyState ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={
                    orderedVisibleColumns.length + (selectedIds && onToggleAllVisible ? 1 : 0)
                  }
                  className="h-48 text-center"
                >
                  <div className="flex flex-col items-center justify-center gap-2 text-sm">
                    <p className="font-medium text-foreground">{emptyState.title}</p>
                    <p className="text-muted-foreground">{emptyState.description}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : null}
            {items.map((c) => {
              const href = `/candidates/${encodeURIComponent(c.id)}`;
              const isSelected = selectedIds ? selectedIds.has(c.id) : false;
              return (
                <TableRow
                  key={c.id}
                  className="cursor-pointer"
                  onClick={() => {
                    if (c.is_pending_duplicate_review && onResolveDuplicate) {
                      onResolveDuplicate(c);
                    } else {
                      setCandidateNavigationContext({
                        ids: items.map((item) => item.id),
                        total: total ?? items.length,
                        sourceUrl: typeof window !== "undefined" ? window.location.pathname + window.location.search : "/candidates",
                        sourceName: "Candidates",
                      });
                      router.push(href);
                    }
                  }}
                >
                  {selectedIds && onToggleSelected ? (
                    <TableCell
                      className="py-2 align-middle text-center"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-center">
                        <Checkbox
                          className="rounded-[4px]"
                          checked={isSelected}
                          onCheckedChange={(v) => onToggleSelected(c.id, !!v)}
                          aria-label="Select"
                        />
                      </div>
                    </TableCell>
                  ) : null}
                  {orderedVisibleColumns.map((column) => renderCell(column, c))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

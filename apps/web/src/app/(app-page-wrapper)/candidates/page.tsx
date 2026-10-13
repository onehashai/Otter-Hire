"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { MainPagesLayout } from "@/components/common/MainPagesLayout";
import { useSetPageMetadata } from "@/hooks/useSetPageMetadata";
import {
  bulkAssignCandidatesToJob,
  deleteCandidate,
  getCandidateFilterOptions,
  getCandidatesPaginated,
  getJobs,
  type CandidateListItemResponse,
  type CandidateSortBy,
  type JobListItemResponse,
} from "@/api";
import { importCandidatesCsv } from "@/api/candidates";
import {
  CANDIDATE_ALL_COLUMNS,
  CANDIDATE_COLUMN_DEFS,
  CANDIDATE_FIXED_COLUMNS,
  type CandidateDatePeriod,
  type CandidateColumnKey,
  CandidatesTable,
  DEFAULT_VISIBLE_CANDIDATE_COLUMNS,
  normalizeCandidateColumnOrder,
  normalizeVisibleCandidateColumns,
} from "@/components/candidates/CandidatesTable";
import { Button } from "@onehash/ui/button";
import { Calendar } from "@onehash/ui/calendar";
import { EmptyCard, ErrorCard } from "@onehash/ui/card";
import { InputField } from "@onehash/ui/input";
import { Label } from "@onehash/ui/label";
import { SelectField } from "@onehash/ui/select";
import { subDays, startOfDay, endOfDay } from "date-fns";
import { AddCandidateDialog } from "@/components/candidates/shared/dialogs/AddCandidateDialog";
import { ResolveDuplicateDialog } from "@/components/candidates/shared/dialogs/ResolveDuplicateDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@onehash/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@onehash/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@onehash/ui/dropdown-menu";
import { Checkbox } from "@onehash/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@onehash/ui/sheet";
import { Icon } from "@onehash/ui/icon";
import { toast } from "@onehash/ui/sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { getMyPreferences, updateMyPreferences } from "@/api/users";
import { classifyError } from "@/api/client/client";
import { formatCandidateSource } from "@/lib/candidate-source";
import {
  DEFAULT_TABLE_PAGE_SIZE,
  isValidTablePageSize,
  TablePagination,
} from "@/components/common/TablePagination";

const DEFAULT_PAGE_SIZE = DEFAULT_TABLE_PAGE_SIZE;
const ASSIGNED_JOB_ALL = "all_assigned_jobs";
const STATUS_ALL = "all_statuses";
const SOURCE_ALL = "all_sources";
const SHOW_CANDIDATE_FILTER_POPOVER = false;

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

type LastActivityPreset = "today" | "yesterday" | "7d" | "30d" | "custom" | null;
type CandidatePageSize = number;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asStringArray(value: unknown): string[] | undefined {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : undefined;
}

function normalizeCandidatePageSize(value: unknown): CandidatePageSize {
  const pageSize = typeof value === "number" ? value : Number(value);
  return isValidTablePageSize(pageSize) ? pageSize : DEFAULT_PAGE_SIZE;
}

function withCandidateTablePreferences(
  preferences: Record<string, unknown>,
  candidatePreferences: Record<string, unknown>,
): Record<string, unknown> {
  const tables = asRecord(preferences.tables);
  return {
    ...preferences,
    tables: {
      ...tables,
      candidates: {
        ...asRecord(tables.candidates),
        ...candidatePreferences,
      },
    },
  };
}

export default function CandidatesPage() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [assignedJobId, setAssignedJobId] = useState(ASSIGNED_JOB_ALL);
  const [statusFilter, setStatusFilter] = useState(STATUS_ALL);
  const [sourceFilter, setSourceFilter] = useState(SOURCE_ALL);
  const [emailDomainFilter, setEmailDomainFilter] = useState("");
  const [scoreMin, setScoreMin] = useState("");
  const [scoreMax, setScoreMax] = useState("");
  const [lastActivityPreset, setLastActivityPreset] = useState<LastActivityPreset>(null);
  const [lastActivityRange, setLastActivityRange] = useState<{ from?: Date; to?: Date }>({});
  const [createdAtPreset, setCreatedAtPreset] = useState<LastActivityPreset>(null);
  const [createdAtRange, setCreatedAtRange] = useState<{ from?: Date; to?: Date }>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<CandidatePageSize>(DEFAULT_PAGE_SIZE);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveCandidate, setResolveCandidate] = useState<CandidateListItemResponse | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignJobId, setAssignJobId] = useState<string>("");
  const [assignLoading, setAssignLoading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [items, setItems] = useState<CandidateListItemResponse[]>([]);
  const [jobs, setJobs] = useState<JobListItemResponse[]>([]);
  const [candidateSources, setCandidateSources] = useState<string[]>([]);
  const [candidateEmailDomains, setCandidateEmailDomains] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<CandidateSortBy>("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [visibleColumns, setVisibleColumns] = useState<CandidateColumnKey[]>(
    DEFAULT_VISIBLE_CANDIDATE_COLUMNS,
  );
  const [columnOrder, setColumnOrder] = useState<CandidateColumnKey[]>(CANDIDATE_ALL_COLUMNS);
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const [columnSubmenuOpen, setColumnSubmenuOpen] = useState(false);
  const [columnPickerOpen, setColumnPickerOpen] = useState(false);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [preferenceSnapshot, setPreferenceSnapshot] = useState<Record<string, unknown>>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; forbidden: boolean } | null>(null);
  const lastSavedColumnsRef = useRef<string>(
    JSON.stringify(normalizeVisibleCandidateColumns(DEFAULT_VISIBLE_CANDIDATE_COLUMNS)),
  );
  const lastSavedOrderRef = useRef<string>(
    JSON.stringify(normalizeCandidateColumnOrder(CANDIDATE_ALL_COLUMNS)),
  );
  const lastSavedPageSizeRef = useRef<CandidatePageSize>(DEFAULT_PAGE_SIZE);
  const pageSizeChangedByUserRef = useRef(false);
  const draggedColumnRef = useRef<CandidateColumnKey | null>(null);
  const candidateRequestIdRef = useRef(0);

  useSetPageMetadata({
    title: t("candidates_title"),
    subtitle: t("candidates_subtitle"),
  });

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(id);
  }, [search]);

  const lastActivityFilterKey = useMemo(
    () =>
      JSON.stringify({
        activityPreset: lastActivityPreset,
        activityFrom: lastActivityRange.from?.toISOString(),
        activityTo: lastActivityRange.to?.toISOString(),
        createdPreset: createdAtPreset,
        createdFrom: createdAtRange.from?.toISOString(),
        createdTo: createdAtRange.to?.toISOString(),
      }),
    [
      lastActivityPreset,
      lastActivityRange.from,
      lastActivityRange.to,
      createdAtPreset,
      createdAtRange.from,
      createdAtRange.to,
    ],
  );

  const candidateFiltersKey = useMemo(
    () =>
      JSON.stringify({
        assignedJobId,
        statusFilter,
        sourceFilter,
        emailDomainFilter,
        scoreMin,
        scoreMax,
        sortBy,
        sortOrder,
      }),
    [
      assignedJobId,
      statusFilter,
      sourceFilter,
      emailDomainFilter,
      scoreMin,
      scoreMax,
      sortBy,
      sortOrder,
    ],
  );

  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [debouncedSearch, candidateFiltersKey, lastActivityFilterKey]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [page]);

  const applyLastActivityPreset = useCallback((preset: LastActivityPreset) => {
    setLastActivityPreset(preset);
    if (preset === "today") {
      setLastActivityRange({ from: startOfDay(new Date()), to: new Date() });
    } else if (preset === "yesterday") {
      const yesterday = subDays(new Date(), 1);
      setLastActivityRange({ from: startOfDay(yesterday), to: endOfDay(yesterday) });
    } else if (preset === "7d") {
      setLastActivityRange({ from: subDays(new Date(), 7), to: new Date() });
    } else if (preset === "30d") {
      setLastActivityRange({ from: subDays(new Date(), 30), to: new Date() });
    } else if (preset === "custom") {
      setLastActivityRange({});
    } else if (preset === null) {
      setLastActivityRange({});
    }
  }, []);

  const applyCreatedAtPreset = useCallback((preset: LastActivityPreset) => {
    setCreatedAtPreset(preset);
    if (preset === "today") {
      setCreatedAtRange({ from: startOfDay(new Date()), to: new Date() });
    } else if (preset === "yesterday") {
      const yesterday = subDays(new Date(), 1);
      setCreatedAtRange({ from: startOfDay(yesterday), to: endOfDay(yesterday) });
    } else if (preset === "7d") {
      setCreatedAtRange({ from: subDays(new Date(), 7), to: new Date() });
    } else if (preset === "30d") {
      setCreatedAtRange({ from: subDays(new Date(), 30), to: new Date() });
    } else if (preset === "custom") {
      setCreatedAtRange({});
    } else if (preset === null) {
      setCreatedAtRange({});
    }
  }, []);

  const lastActivityApiParams = useMemo(() => {
    if (!lastActivityPreset) return {};
    if (lastActivityPreset === "custom") {
      if (!lastActivityRange.from || !lastActivityRange.to) return {};
      return {
        updated_from: startOfDay(lastActivityRange.from).toISOString(),
        ...(lastActivityRange.to
          ? { updated_to: endOfDay(lastActivityRange.to).toISOString() }
          : {}),
      };
    }
    const now = new Date();
    if (lastActivityPreset === "today") {
      return {
        updated_from: startOfDay(now).toISOString(),
        updated_to: now.toISOString(),
      };
    }
    if (lastActivityPreset === "yesterday") {
      const yesterday = subDays(now, 1);
      return {
        updated_from: startOfDay(yesterday).toISOString(),
        updated_to: endOfDay(yesterday).toISOString(),
      };
    }
    if (lastActivityPreset === "7d") {
      return {
        updated_from: subDays(now, 7).toISOString(),
        updated_to: now.toISOString(),
      };
    }
    if (lastActivityPreset === "30d") {
      return {
        updated_from: subDays(now, 30).toISOString(),
        updated_to: now.toISOString(),
      };
    }
    return {};
  }, [lastActivityPreset, lastActivityRange.from, lastActivityRange.to]);

  const createdAtApiParams = useMemo(() => {
    if (!createdAtPreset) return {};
    if (createdAtPreset === "custom") {
      if (!createdAtRange.from || !createdAtRange.to) return {};
      return {
        created_from: startOfDay(createdAtRange.from).toISOString(),
        ...(createdAtRange.to ? { created_to: endOfDay(createdAtRange.to).toISOString() } : {}),
      };
    }
    const now = new Date();
    if (createdAtPreset === "today") {
      return { created_from: startOfDay(now).toISOString(), created_to: now.toISOString() };
    }
    if (createdAtPreset === "yesterday") {
      const yesterday = subDays(now, 1);
      return {
        created_from: startOfDay(yesterday).toISOString(),
        created_to: endOfDay(yesterday).toISOString(),
      };
    }
    if (createdAtPreset === "7d") {
      return { created_from: subDays(now, 7).toISOString(), created_to: now.toISOString() };
    }
    if (createdAtPreset === "30d") {
      return { created_from: subDays(now, 30).toISOString(), created_to: now.toISOString() };
    }
    return {};
  }, [createdAtPreset, createdAtRange.from, createdAtRange.to]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await getMyPreferences();
        const preferences = asRecord(response.preferences);
        const tables = asRecord(preferences.tables);
        const candidatePreferences = asRecord(tables.candidates);
        const stored = asStringArray(candidatePreferences.visible_columns);
        const storedOrder = asStringArray(candidatePreferences.column_order);
        const storedPageSize = normalizeCandidatePageSize(candidatePreferences.page_size);
        const normalized = normalizeVisibleCandidateColumns(stored);
        const normalizedOrder = normalizeCandidateColumnOrder(storedOrder);
        if (!cancelled) {
          setVisibleColumns(normalized);
          setColumnOrder(normalizedOrder);
          if (!pageSizeChangedByUserRef.current) {
            setPageSize(storedPageSize);
            lastSavedPageSizeRef.current = storedPageSize;
          }
          setPreferenceSnapshot(preferences);
          lastSavedColumnsRef.current = JSON.stringify(normalized);
          lastSavedOrderRef.current = JSON.stringify(normalizedOrder);
        }
      } catch {
        // Keep defaults when preferences are unavailable.
      } finally {
        if (!cancelled) setPreferencesLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!preferencesLoaded) return;
    const normalized = normalizeVisibleCandidateColumns(visibleColumns);
    const normalizedOrder = normalizeCandidateColumnOrder(columnOrder);
    const serialized = JSON.stringify(normalized);
    const serializedOrder = JSON.stringify(normalizedOrder);
    if (
      serialized === lastSavedColumnsRef.current &&
      serializedOrder === lastSavedOrderRef.current &&
      pageSize === lastSavedPageSizeRef.current
    ) {
      return;
    }
    const id = setTimeout(() => {
      void (async () => {
        try {
          const response = await updateMyPreferences(
            withCandidateTablePreferences(preferenceSnapshot, {
              visible_columns: normalized,
              column_order: normalizedOrder,
              page_size: pageSize,
              version: 1,
            }),
          );
          setPreferenceSnapshot(asRecord(response.preferences));
          lastSavedColumnsRef.current = serialized;
          lastSavedOrderRef.current = serializedOrder;
          lastSavedPageSizeRef.current = pageSize;
        } catch {
          toast.error("Unable to save candidate table preferences.");
        }
      })();
    }, 300);
    return () => clearTimeout(id);
  }, [preferencesLoaded, visibleColumns, columnOrder, pageSize, preferenceSnapshot]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);
  const offset = (page - 1) * pageSize;
  const selectedCount = selectedIds.size;

  useEffect(() => {
    if (total > 0 && page > totalPages) setPage(totalPages);
  }, [page, total, totalPages]);

  const scoreMinValue = scoreMin === "" ? undefined : Number(scoreMin);
  const scoreMaxValue = scoreMax === "" ? undefined : Number(scoreMax);
  const hasActiveScoreFilter = scoreMinValue !== undefined || scoreMaxValue !== undefined;
  const hasActiveFilters =
    hasActiveScoreFilter || lastActivityPreset !== null || createdAtPreset !== null;
  const clearFilters = () => {
    setScoreMin("");
    setScoreMax("");
    applyLastActivityPreset(null);
    applyCreatedAtPreset(null);
  };

  const assignedJobOptions = useMemo(
    () => [
      { value: ASSIGNED_JOB_ALL, label: "All jobs" },
      ...jobs
        .filter((job) => job.status !== "archived")
        .map((job) => ({ value: job.id, label: job.title })),
    ],
    [jobs],
  );

  const sourceOptions = useMemo(() => {
    const sources = new Set(candidateSources);
    return [
      { value: SOURCE_ALL, label: t("candidates_assignment_all") },
      ...Array.from(sources)
        .sort((a, b) => formatCandidateSource(a).localeCompare(formatCandidateSource(b)))
        .map((source) => ({ value: source, label: formatCandidateSource(source) })),
    ];
  }, [candidateSources, t]);

  const headerSourceOptions = useMemo(
    () =>
      sourceOptions.map((option) =>
        option.value === SOURCE_ALL ? { ...option, value: "" } : option,
      ),
    [sourceOptions],
  );

  const headerUpdatedPeriod: CandidateDatePeriod = lastActivityPreset ?? "all";
  const headerCreatedPeriod: CandidateDatePeriod = createdAtPreset ?? "all";

  const filterContent = (
    <div className="space-y-3 p-1">
      <p className="text-sm font-medium">Resume score</p>
      <div className="grid grid-cols-2 gap-3">
        <InputField
          label="Minimum score"
          type="number"
          min="0"
          max="100"
          value={scoreMin}
          onChange={(event) => setScoreMin(event.target.value)}
          placeholder="0"
          className="h-9 text-sm"
        />
        <InputField
          label="Maximum score"
          type="number"
          min="0"
          max="100"
          value={scoreMax}
          onChange={(event) => setScoreMax(event.target.value)}
          placeholder="100"
          className="h-9 text-sm"
        />
      </div>
      <div className="space-y-2 border-t border-border pt-3">
        <Label className="text-sm font-medium">Last activity</Label>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { key: "today" as const, label: t("today") },
              { key: "yesterday" as const, label: t("yesterday") },
              { key: "7d" as const, label: t("last_n_days", { count: 7 }) },
              { key: "30d" as const, label: t("last_n_days", { count: 30 }) },
              { key: "custom" as const, label: t("custom") },
            ] as const
          ).map((preset) => (
            <Button
              key={preset.key}
              variant={lastActivityPreset === preset.key ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              type="button"
              onClick={() =>
                applyLastActivityPreset(lastActivityPreset === preset.key ? null : preset.key)
              }
            >
              {preset.label}
            </Button>
          ))}
        </div>
        {lastActivityPreset === "custom" ? (
          <Calendar
            mode="range"
            selected={
              lastActivityRange.from
                ? { from: lastActivityRange.from, to: lastActivityRange.to }
                : undefined
            }
            onSelect={(range) =>
              setLastActivityRange(range ? { from: range.from, to: range.to } : {})
            }
            numberOfMonths={1}
            className="w-full rounded-md border bg-card p-3 shadow-none"
            classNames={CANDIDATE_DATE_CALENDAR_CLASS_NAMES}
          />
        ) : null}
      </div>
      {hasActiveFilters ? (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs h-8 text-muted-foreground"
          type="button"
          onClick={clearFilters}
        >
          {t("clear_all")}
        </Button>
      ) : null}
    </div>
  );

  const refresh = useCallback(async () => {
    const requestId = ++candidateRequestIdRef.current;
    setError(null);
    setLoading(true);
    try {
      const res = await getCandidatesPaginated({
        ...(assignedJobId !== ASSIGNED_JOB_ALL ? { assignment_job_id: assignedJobId } : {}),
        ...(statusFilter !== STATUS_ALL ? { status: statusFilter } : {}),
        ...(sourceFilter !== SOURCE_ALL ? { source: sourceFilter } : {}),
        ...(emailDomainFilter ? { email_domain: emailDomainFilter } : {}),
        ...(scoreMinValue !== undefined ? { score_min: scoreMinValue } : {}),
        ...(scoreMaxValue !== undefined ? { score_max: scoreMaxValue } : {}),
        sort_by: sortBy,
        sort_order: sortOrder,
        ...lastActivityApiParams,
        ...createdAtApiParams,
        search: debouncedSearch || undefined,
        limit: pageSize,
        offset,
      });
      if (requestId === candidateRequestIdRef.current) {
        setItems(res.items);
        setTotal(res.total);
      }
    } catch (err) {
      if (requestId === candidateRequestIdRef.current) {
        const classified = classifyError(err);
        setError({ message: classified.message, forbidden: classified.forbidden });
        if (!classified.forbidden) toast.error(classified.message);
      }
    } finally {
      if (requestId === candidateRequestIdRef.current) setLoading(false);
    }
  }, [
    debouncedSearch,
    assignedJobId,
    statusFilter,
    sourceFilter,
    emailDomainFilter,
    scoreMinValue,
    scoreMaxValue,
    sortBy,
    sortOrder,
    offset,
    lastActivityApiParams,
    createdAtApiParams,
    pageSize,
  ]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [jobsResult, optionsResult] = await Promise.allSettled([
        getJobs(),
        getCandidateFilterOptions(),
      ]);
      if (cancelled) return;
      setJobs(jobsResult.status === "fulfilled" ? jobsResult.value : []);
      setCandidateSources(optionsResult.status === "fulfilled" ? optionsResult.value.sources : []);
      setCandidateEmailDomains(
        optionsResult.status === "fulfilled" ? optionsResult.value.email_domains : [],
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const exportCsv = (rows: CandidateListItemResponse[], filename: string) => {
    if (rows.length === 0) {
      toast.error("Nothing to export");
      return;
    }

    const header = [
      "name",
      "email",
      "phone",
      "source",
      "status",
      "job_title",
      "stage_name",
      "created_at",
    ];

    const escape = (value: unknown) => {
      const s = value === null || value === undefined ? "" : String(value);
      const needsQuotes = /[",\n]/.test(s);
      const escaped = s.replace(/"/g, '""');
      return needsQuotes ? `"${escaped}"` : escaped;
    };

    const lines = [
      header.join(","),
      ...rows.map((c) =>
        [
          c.name,
          c.email,
          c.phone ?? "",
          c.source ?? "",
          c.status ?? "",
          c.job_title ?? "",
          c.stage_name ?? "",
          c.created_at,
        ]
          .map(escape)
          .join(","),
      ),
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Exported CSV");
  };

  const handleExport = () => {
    exportCsv(items, `candidates_page_${page}.csv`);
  };

  const handlePageSizeChange = (value: number) => {
    const nextPageSize = normalizeCandidatePageSize(value);
    if (nextPageSize === pageSize) return;
    pageSizeChangedByUserRef.current = true;
    setPageSize(nextPageSize);
    setPage(1);
    setSelectedIds(new Set());
  };

  const visibleIds = useMemo(() => items.map((c) => c.id), [items]);
  const visibleColumnSet = useMemo(
    () => new Set(normalizeVisibleCandidateColumns(visibleColumns)),
    [visibleColumns],
  );
  const orderedColumns = useMemo(() => normalizeCandidateColumnOrder(columnOrder), [columnOrder]);
  const toggleColumn = (columnKey: CandidateColumnKey, nextChecked: boolean) => {
    if (CANDIDATE_FIXED_COLUMNS.includes(columnKey)) return;
    setVisibleColumns((prev) => {
      const next = new Set(normalizeVisibleCandidateColumns(prev));
      if (nextChecked) next.add(columnKey);
      else next.delete(columnKey);
      for (const fixedKey of CANDIDATE_FIXED_COLUMNS) next.add(fixedKey);
      return normalizeVisibleCandidateColumns(Array.from(next));
    });
  };
  const resetColumns = () => {
    setVisibleColumns(DEFAULT_VISIBLE_CANDIDATE_COLUMNS);
    setColumnOrder(CANDIDATE_ALL_COLUMNS);
  };
  const moveColumn = (from: CandidateColumnKey, to: CandidateColumnKey) => {
    if (from === to) return;
    setColumnOrder((prev) => {
      const normalized = normalizeCandidateColumnOrder(prev);
      const fromIndex = normalized.indexOf(from);
      const toIndex = normalized.indexOf(to);
      if (fromIndex < 0 || toIndex < 0) return normalized;
      const next = [...normalized];
      const [removed] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, removed);
      return next;
    });
  };
  const handleDragStart = (columnKey: CandidateColumnKey) => {
    draggedColumnRef.current = columnKey;
  };
  const handleDrop = (targetColumn: CandidateColumnKey) => {
    const dragged = draggedColumnRef.current;
    draggedColumnRef.current = null;
    if (!dragged) return;
    moveColumn(dragged, targetColumn);
  };
  const columnLabel = (columnKey: CandidateColumnKey) => {
    if (columnKey === "assigned_jobs") return t("candidates_assigned_jobs");
    if (columnKey === "created_at") return t("candidates_table_created");
    if (columnKey === "name") return t("col_candidate");
    if (columnKey === "email") return t("email");
    if (columnKey === "score") return "Resume score";
    if (columnKey === "phone") return t("col_phone");
    if (columnKey === "source") return t("col_source");
    if (columnKey === "status") return t("status");
    if (columnKey === "location") return t("col_location");
    if (columnKey === "updated_at") return t("col_updated");
    if (columnKey === "stage_name") return t("stage");
    return t("stage");
  };
  const columnPickerContent = (
    <div className="space-y-3">
      <div className="space-y-2">
        {orderedColumns.map((columnKey) => {
          const fixed = CANDIDATE_COLUMN_DEFS[columnKey].fixed;
          const checked = visibleColumnSet.has(columnKey);
          return (
            <label
              key={columnKey}
              draggable
              onDragStart={() => handleDragStart(columnKey)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => handleDrop(columnKey)}
              onDragEnd={() => {
                draggedColumnRef.current = null;
              }}
              className="flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-2 cursor-move"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Checkbox
                  checked={checked}
                  disabled={fixed}
                  onCheckedChange={(v) => toggleColumn(columnKey, !!v)}
                  aria-label={columnLabel(columnKey)}
                />
                <span className="text-xs truncate">{columnLabel(columnKey)}</span>
              </div>
              {fixed ? (
                <span className="text-[10px] text-muted-foreground shrink-0">Required</span>
              ) : null}
            </label>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={resetColumns}>
          {t("reset_to_default")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs px-2"
          onClick={() => {
            if (isMobile) {
              setColumnPickerOpen(false);
              return;
            }
            setColumnSubmenuOpen(false);
            setActionsMenuOpen(false);
          }}
        >
          Close
        </Button>
      </div>
    </div>
  );

  const toggleSelected = (candidateId: string, nextSelected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (nextSelected) next.add(candidateId);
      else next.delete(candidateId);
      return next;
    });
  };
  const toggleAllVisible = (nextSelected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (nextSelected) visibleIds.forEach((id) => next.add(id));
      else visibleIds.forEach((id) => next.delete(id));
      return next;
    });
  };

  const openJobs = jobs.filter((j) => j.status === "open");

  // For a single selected candidate: only show jobs they aren't already assigned to.
  // For 2+ candidates: show all open jobs (each candidate has a different assignment state).
  const assignableJobs = useMemo(() => {
    if (selectedIds.size !== 1) return openJobs;
    const selectedCandidate = items.find((c) => selectedIds.has(c.id));
    if (!selectedCandidate) return openJobs;
    const assignedJobIds = new Set(
      selectedCandidate.assignments
        .filter((a) => a.assignment_status === "active")
        .map((a) => a.job_id),
    );
    return openJobs.filter((j) => !assignedJobIds.has(j.id));
  }, [openJobs, selectedIds, items]);

  const allAssigned = selectedIds.size === 0 || assignableJobs.length === 0;

  const openAssignDialog = () => {
    setAssignJobId(assignableJobs[0]?.id ?? "");
    setAssignOpen(true);
  };

  const handleBulkAssign = async () => {
    if (!assignJobId || selectedCount === 0) return;
    try {
      setAssignLoading(true);
      const res = await bulkAssignCandidatesToJob(Array.from(selectedIds), assignJobId);
      toast.success(
        `Assigned ${res.updated_count} ${res.updated_count === 1 ? "candidate" : "candidates"}`,
      );
      setAssignOpen(false);
      setSelectedIds(new Set());
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to assign candidates");
    } finally {
      setAssignLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedCount === 0) return;
    const ids = Array.from(selectedIds);
    setDeleteLoading(true);
    try {
      const results = await Promise.allSettled(ids.map((id) => deleteCandidate(id)));
      const success = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.length - success;
      if (failed === 0)
        toast.success(`Deleted ${success} ${success === 1 ? "candidate" : "candidates"}`);
      else
        toast.message(
          `Deleted ${success} ${success === 1 ? "candidate" : "candidates"}, failed ${failed}`,
        );
      setDeleteOpen(false);
      setSelectedIds(new Set());
      await refresh();
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleImport = async () => {
    if (!importFile) {
      toast.error("Select a CSV file to import");
      return;
    }
    try {
      setImportLoading(true);
      const result = await importCandidatesCsv(importFile);
      toast.success(`Imported ${result.created_count}/${result.total_rows} rows`);
      if (result.failed_count > 0) {
        toast.message(`${result.failed_count} rows failed. Review CSV and duplicates.`);
      }
      setImportOpen(false);
      setImportFile(null);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to import candidates");
    } finally {
      setImportLoading(false);
    }
  };

  if (error && items.length === 0 && !loading) {
    return (
      <ErrorCard
        icon={error.forbidden ? "ShieldOff" : "CircleAlert"}
        title={error.forbidden ? t("access_denied", "Access Denied") : t("error")}
        description={
          error.forbidden
            ? t(
                "no_permission",
                "You don't have permission to view this page. Contact your administrator if you think this is a mistake.",
              )
            : error.message
        }
        {...(!error.forbidden && {
          actionLabel: t("retry"),
          onAction: () => void refresh(),
        })}
      />
    );
  }

  return (
    <MainPagesLayout
      searchValue={search}
      onSearchChange={setSearch}
      filterContent={SHOW_CANDIDATE_FILTER_POPOVER ? filterContent : undefined}
      hasActiveFilters={hasActiveFilters}
      onClearAllFilters={hasActiveFilters ? clearFilters : undefined}
      filterTitle={t("filters")}
      rightActions={
        <div className="flex items-center gap-2">
          <Button size="sm" className="h-9 md:h-8 text-xs gap-1.5" onClick={() => setAddOpen(true)}>
            <Icon name="Plus" className="h-3.5 w-3.5" /> Create
          </Button>
          <DropdownMenu
            open={actionsMenuOpen}
            onOpenChange={(open) => {
              setActionsMenuOpen(open);
              if (!open) setColumnSubmenuOpen(false);
            }}
          >
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-9 md:h-8 w-9 p-0"
                tooltip={t("tooltip_more_actions")}
                tooltipContentProps={{ side: "top" }}
                aria-label={t("tooltip_more_actions")}
              >
                <Icon name="MoreHorizontal" className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {isMobile ? (
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setActionsMenuOpen(false);
                    setColumnPickerOpen(true);
                  }}
                >
                  {t("column_picker")}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuSub open={columnSubmenuOpen} onOpenChange={setColumnSubmenuOpen}>
                  <DropdownMenuSubTrigger>{t("column_picker")}</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-80">
                    {columnPickerContent}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  handleExport();
                }}
              >
                {t("export_candidates")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setImportOpen(true);
                }}
              >
                {t("import_candidates")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      }
    >
      {loading &&
      items.length === 0 &&
      !(
        hasActiveFilters ||
        assignedJobId !== ASSIGNED_JOB_ALL ||
        statusFilter !== STATUS_ALL ||
        sourceFilter !== SOURCE_ALL ||
        emailDomainFilter ||
        debouncedSearch
      ) ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-[72px] rounded-lg border border-border bg-muted/40 animate-pulse"
            />
          ))}
        </div>
      ) : items.length === 0 &&
        !(
          hasActiveFilters ||
          assignedJobId !== ASSIGNED_JOB_ALL ||
          statusFilter !== STATUS_ALL ||
          sourceFilter !== SOURCE_ALL ||
          emailDomainFilter ||
          debouncedSearch
        ) ? (
        <EmptyCard icon="Users" title={t("candidates_title")} description={t("candidates_empty")} />
      ) : (
        <>
          <CandidatesTable
            items={items}
            total={total}
            emptyState={
              items.length === 0
                ? loading
                  ? {
                      title: "Loading candidates",
                      description: "Updating the candidate list for the selected filters.",
                    }
                  : {
                      title: "No candidates match these filters",
                      description: "Change or clear the selected filters to see candidates.",
                    }
                : undefined
            }
            jobs={jobs}
            visibleColumns={visibleColumns}
            columnOrder={columnOrder}
            selectedIds={selectedIds}
            onToggleSelected={toggleSelected}
            onToggleAllVisible={toggleAllVisible}
            onListChange={() => void refresh()}
            onResolveDuplicate={(c) => {
              setResolveCandidate(c);
              setResolveOpen(true);
            }}
            headerControls={{
              sortBy,
              sortOrder,
              onSortChange: (nextSortBy, nextSortOrder) => {
                setSortBy(nextSortBy);
                setSortOrder(nextSortOrder);
              },
              emailDomain: emailDomainFilter,
              emailDomains: candidateEmailDomains,
              onEmailDomainChange: setEmailDomainFilter,
              assignedJobId,
              assignedJobOptions,
              onAssignedJobChange: setAssignedJobId,
              source: sourceFilter === SOURCE_ALL ? "" : sourceFilter,
              sourceOptions: headerSourceOptions,
              onSourceChange: (source) => setSourceFilter(source || SOURCE_ALL),
              status: statusFilter === STATUS_ALL ? "" : statusFilter,
              onStatusChange: (status) => setStatusFilter(status || STATUS_ALL),
              createdPeriod: headerCreatedPeriod,
              createdRange: createdAtRange,
              onCreatedPeriodChange: (period) =>
                applyCreatedAtPreset(period === "all" ? null : period),
              onCreatedRangeChange: setCreatedAtRange,
              updatedPeriod: headerUpdatedPeriod,
              onUpdatedPeriodChange: (period) =>
                applyLastActivityPreset(period === "all" ? null : period),
              updatedRange: lastActivityRange,
              onUpdatedRangeChange: setLastActivityRange,
            }}
          />
          <TablePagination
            page={page}
            pageSize={pageSize}
            total={total}
            itemsOnPage={items.length}
            recordLabel="candidates"
            disabled={loading}
            onPageChange={setPage}
            onPageSizeChange={handlePageSizeChange}
          />

          {selectedCount > 0 ? (
            <div className="fixed bottom-[calc(3.5rem+1.5rem)] md:bottom-6 left-1/2 -translate-x-1/2 z-[60]">
              <div className="rounded-xl border border-border bg-card/95 backdrop-blur-md shadow-lg pl-4 pr-2 py-1.5 flex items-center gap-3 animate-in fade-in-0 slide-in-from-bottom-4 duration-300">
                <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                  {selectedCount} {selectedCount === 1 ? "candidate" : "candidates"} selected
                </span>

                {/* Primary Action: Assign Job */}
                <Button
                  size="sm"
                  className="h-8 text-xs font-semibold bg-zinc-950 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-sm flex items-center gap-1.5"
                  onClick={openAssignDialog}
                  disabled={allAssigned}
                >
                  <Icon name="Briefcase" className="h-3.5 w-3.5 shrink-0" />
                  {t("assign_job_title")}
                </Button>

                {/* Destructive Action: Red Trash Icon Button */}
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-8 w-8 p-0 shrink-0"
                  onClick={() => setDeleteOpen(true)}
                  title={
                    selectedCount === 1
                      ? t("delete_selected_candidate")
                      : t("delete_selected_candidates")
                  }
                >
                  <Icon name="Trash2" className="h-4 w-4 shrink-0" />
                </Button>
              </div>
            </div>
          ) : null}

          <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{t("assign_job_title")}</DialogTitle>
                <DialogDescription>{t("assign_job_dialog_description")}</DialogDescription>
              </DialogHeader>
              <SelectField
                label={t("jobs_title")}
                value={assignJobId}
                onValueChange={setAssignJobId}
                options={assignableJobs.map((j) => ({ value: j.id, label: j.title }))}
              />
              <DialogFooter>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAssignOpen(false)}
                  disabled={assignLoading}
                >
                  {t("cancel")}
                </Button>
                <Button
                  size="sm"
                  onClick={() => void handleBulkAssign()}
                  disabled={!assignJobId || assignLoading}
                  pending={assignLoading}
                >
                  {t("assign")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {selectedCount === 1
                    ? "Delete selected candidate?"
                    : "Delete selected candidates?"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This action will permanently remove {selectedCount}{" "}
                  {selectedCount === 1 ? "candidate" : "candidates"}.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleteLoading}>{t("cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground"
                  disabled={deleteLoading}
                  onClick={(e) => {
                    e.preventDefault();
                    void handleBulkDelete();
                  }}
                >
                  {deleteLoading ? t("loading") : t("delete")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("import_candidates_title")}</DialogTitle>
            <DialogDescription>{t("import_csv_description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Optional columns: phone</p>
              <button
                type="button"
                className="text-xs text-primary underline underline-offset-2 hover:opacity-80"
                onClick={() => {
                  const csv =
                    "name,email,phone\nJohn Doe,john@example.com,+1234567890\nJane Smith,jane@example.com,";
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
                  a.download = "candidates_sample.csv";
                  a.click();
                }}
              >
                {t("download_sample_csv")}
              </button>
            </div>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setImportOpen(false)}
              disabled={importLoading}
            >
              {t("cancel")}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void handleImport()}
              disabled={importLoading || !importFile}
              pending={importLoading}
            >
              {t("importing")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Sheet open={columnPickerOpen} onOpenChange={setColumnPickerOpen}>
        <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{t("column_picker")}</SheetTitle>
          </SheetHeader>
          <div className="mt-4">{columnPickerContent}</div>
        </SheetContent>
      </Sheet>
      <AddCandidateDialog open={addOpen} onOpenChange={setAddOpen} onAdded={() => void refresh()} />
      <ResolveDuplicateDialog
        open={resolveOpen}
        onOpenChange={setResolveOpen}
        candidate={resolveCandidate}
        onResolved={() => void refresh()}
      />
    </MainPagesLayout>
  );
}

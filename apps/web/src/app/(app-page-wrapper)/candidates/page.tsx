"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { MainPagesLayout } from "@/components/common/MainPagesLayout";
import { useSetPageMetadata } from "@/hooks/useSetPageMetadata";
import {
  bulkAssignCandidatesToJob,
  deleteCandidate,
  getCandidatesPaginated,
  getJobs,
  type CandidateListItemResponse,
  type JobListItemResponse,
} from "@/api";
import { importCandidatesCsv } from "@/api/candidates";
import {
  CANDIDATE_ALL_COLUMNS,
  CANDIDATE_COLUMN_DEFS,
  CANDIDATE_FIXED_COLUMNS,
  type CandidateColumnKey,
  CandidatesTable,
  DEFAULT_VISIBLE_CANDIDATE_COLUMNS,
  normalizeCandidateColumnOrder,
  normalizeVisibleCandidateColumns,
} from "@/components/candidates/CandidatesTable";
import { Button } from "@onehash/ui/button";
import { EmptyCard, ErrorCard } from "@onehash/ui/card";
import { Label } from "@onehash/ui/label";
import { Calendar } from "@onehash/ui/calendar";
import { SelectField } from "@onehash/ui/select";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { AddCandidateDialog } from "@/components/candidates/shared/dialogs/AddCandidateDialog";
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

const PAGE_SIZE = 25;
const ASSIGNMENT_ALL = "all";
const ASSIGNMENT_ASSIGNED = "assigned";
const ASSIGNMENT_UNASSIGNED = "unassigned";

type LastActivityPreset = "today" | "7d" | "30d" | "custom" | null;

export default function CandidatesPage() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [assignment, setAssignment] = useState<string>(ASSIGNMENT_ALL);
  const [lastActivityPreset, setLastActivityPreset] = useState<LastActivityPreset>(null);
  const [lastActivityRange, setLastActivityRange] = useState<{ from?: Date; to?: Date }>({});
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
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
  const [visibleColumns, setVisibleColumns] = useState<CandidateColumnKey[]>(
    DEFAULT_VISIBLE_CANDIDATE_COLUMNS,
  );
  const [columnOrder, setColumnOrder] = useState<CandidateColumnKey[]>(CANDIDATE_ALL_COLUMNS);
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const [columnSubmenuOpen, setColumnSubmenuOpen] = useState(false);
  const [columnPickerOpen, setColumnPickerOpen] = useState(false);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastSavedColumnsRef = useRef<string>(
    JSON.stringify(normalizeVisibleCandidateColumns(DEFAULT_VISIBLE_CANDIDATE_COLUMNS)),
  );
  const lastSavedOrderRef = useRef<string>(
    JSON.stringify(normalizeCandidateColumnOrder(CANDIDATE_ALL_COLUMNS)),
  );
  const draggedColumnRef = useRef<CandidateColumnKey | null>(null);

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
        p: lastActivityPreset,
        f: lastActivityRange.from?.toISOString(),
        t: lastActivityRange.to?.toISOString(),
      }),
    [lastActivityPreset, lastActivityRange.from, lastActivityRange.to],
  );

  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [debouncedSearch, assignment, lastActivityFilterKey]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [page]);

  const applyLastActivityPreset = useCallback((preset: LastActivityPreset) => {
    setLastActivityPreset(preset);
    if (preset === "today") {
      setLastActivityRange({ from: startOfDay(new Date()), to: new Date() });
    } else if (preset === "7d") {
      setLastActivityRange({ from: subDays(new Date(), 7), to: new Date() });
    } else if (preset === "30d") {
      setLastActivityRange({ from: subDays(new Date(), 30), to: new Date() });
    } else if (preset === null) {
      setLastActivityRange({});
    }
  }, []);

  const lastActivityApiParams = useMemo(() => {
    if (!lastActivityPreset) return {};
    if (lastActivityPreset === "custom") {
      if (!lastActivityRange.from) return {};
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await getMyPreferences();
        const prefs = response.preferences as {
          tables?: { candidates?: { visible_columns?: string[]; column_order?: string[] } };
        };
        const stored = prefs?.tables?.candidates?.visible_columns;
        const storedOrder = prefs?.tables?.candidates?.column_order;
        const normalized = normalizeVisibleCandidateColumns(stored);
        const normalizedOrder = normalizeCandidateColumnOrder(storedOrder);
        if (!cancelled) {
          setVisibleColumns(normalized);
          setColumnOrder(normalizedOrder);
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
      serializedOrder === lastSavedOrderRef.current
    ) {
      return;
    }
    const id = setTimeout(() => {
      void (async () => {
        try {
          await updateMyPreferences({
            tables: {
              candidates: {
                visible_columns: normalized,
                column_order: normalizedOrder,
                version: 1,
              },
            },
          });
          lastSavedColumnsRef.current = serialized;
          lastSavedOrderRef.current = serializedOrder;
        } catch {
          toast.error("Unable to save column preferences.");
        }
      })();
    }, 300);
    return () => clearTimeout(id);
  }, [preferencesLoaded, visibleColumns, columnOrder]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);
  const offset = (page - 1) * PAGE_SIZE;
  const selectedCount = selectedIds.size;

  const hasActiveFilters = assignment !== ASSIGNMENT_ALL || lastActivityPreset !== null;
  const clearAllFilters = () => {
    setAssignment(ASSIGNMENT_ALL);
    applyLastActivityPreset(null);
  };

  const activeChips = useMemo(() => {
    const chips: { label: string; clear: () => void }[] = [];
    if (assignment !== ASSIGNMENT_ALL) {
      const assignmentLabel =
        assignment === ASSIGNMENT_ASSIGNED
          ? t("candidates_assignment_assigned")
          : assignment === ASSIGNMENT_UNASSIGNED
            ? t("candidates_assignment_unassigned")
            : "";
      chips.push({
        label: assignmentLabel,
        clear: () => setAssignment(ASSIGNMENT_ALL),
      });
    }
    if (lastActivityPreset) {
      let dateLabel: string;
      if (lastActivityPreset === "custom" && lastActivityRange.from) {
        dateLabel = lastActivityRange.to
          ? `${format(lastActivityRange.from, "d MMM, yyyy")} – ${format(lastActivityRange.to, "d MMM, yyyy")}`
          : format(lastActivityRange.from, "d MMM, yyyy");
      } else if (lastActivityPreset === "custom") {
        dateLabel = t("custom");
      } else if (lastActivityPreset === "today") {
        dateLabel = t("today");
      } else {
        dateLabel = t("last_n_days", { count: lastActivityPreset === "7d" ? 7 : 30 });
      }
      chips.push({
        label: dateLabel,
        clear: () => applyLastActivityPreset(null),
      });
    }
    return chips;
  }, [
    assignment,
    lastActivityPreset,
    lastActivityRange.from,
    lastActivityRange.to,
    t,
    applyLastActivityPreset,
  ]);

  const filterContent = (
    <div className="space-y-5 p-1">
      <SelectField
        label={t("candidates_assignment")}
        value={assignment}
        onValueChange={setAssignment}
        options={[
          { value: ASSIGNMENT_ALL, label: t("candidates_assignment_all") },
          { value: ASSIGNMENT_ASSIGNED, label: t("candidates_assignment_assigned") },
          { value: ASSIGNMENT_UNASSIGNED, label: t("candidates_assignment_unassigned") },
        ]}
      />
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground">{t("last_activity")}</Label>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { key: "today" as const, label: t("today") },
              { key: "7d" as const, label: t("last_n_days", { count: 7 }) },
              { key: "30d" as const, label: t("last_n_days", { count: 30 }) },
              { key: "custom" as const, label: t("custom") },
            ] as const
          ).map((p) => (
            <Button
              key={p.key}
              variant={lastActivityPreset === p.key ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              type="button"
              onClick={() => applyLastActivityPreset(lastActivityPreset === p.key ? null : p.key)}
            >
              {p.label}
            </Button>
          ))}
        </div>
        {lastActivityPreset === "custom" ? (
          <div className="mt-3 border-t border-border pt-3">
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
              className="w-full max-w-full rounded-md border bg-card p-3 shadow-none pointer-events-auto"
            />
          </div>
        ) : null}
      </div>
      {hasActiveFilters ? (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs h-8 text-muted-foreground"
          type="button"
          onClick={clearAllFilters}
        >
          {t("clear_all")}
        </Button>
      ) : null}
    </div>
  );

  const refresh = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await getCandidatesPaginated({
        ...(assignment === ASSIGNMENT_UNASSIGNED ? { unassignedOnly: true } : {}),
        ...(assignment === ASSIGNMENT_ASSIGNED ? { assigned_only: true } : {}),
        ...lastActivityApiParams,
        search: debouncedSearch || undefined,
        limit: PAGE_SIZE,
        offset,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load candidates";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, assignment, offset, lastActivityApiParams]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await getJobs();
        if (!cancelled) setJobs(list);
      } catch {
        if (!cancelled) setJobs([]);
      }
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
    return CANDIDATE_COLUMN_DEFS[columnKey].label;
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
          Reset to default
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

  const openAssignDialog = () => {
    setAssignJobId(jobs[0]?.id ?? "");
    setAssignOpen(true);
  };

  const handleBulkAssign = async () => {
    if (!assignJobId || selectedCount === 0) return;
    try {
      setAssignLoading(true);
      const res = await bulkAssignCandidatesToJob(Array.from(selectedIds), assignJobId);
      toast.success(`Assigned ${res.updated_count} candidates`);
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
      if (failed === 0) toast.success(`Deleted ${success} candidates`);
      else toast.message(`Deleted ${success}, failed ${failed}`);
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
        icon="CircleAlert"
        title={t("error")}
        description={error}
        actionLabel={t("retry")}
        onAction={() => void refresh()}
      />
    );
  }

  return (
    <MainPagesLayout
      searchValue={search}
      onSearchChange={setSearch}
      filterContent={filterContent}
      hasActiveFilters={hasActiveFilters}
      activeChips={activeChips}
      onClearAllFilters={hasActiveFilters ? clearAllFilters : undefined}
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
              <Button variant="outline" size="sm" className="h-9 md:h-8 w-9 p-0">
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
                  Column picker
                </DropdownMenuItem>
              ) : (
                <DropdownMenuSub open={columnSubmenuOpen} onOpenChange={setColumnSubmenuOpen}>
                  <DropdownMenuSubTrigger>Column picker</DropdownMenuSubTrigger>
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
                Export Candidates
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setImportOpen(true);
                }}
              >
                Import Candidates
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      }
    >
      {loading && items.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-[72px] rounded-lg border border-border bg-muted/40 animate-pulse"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyCard icon="Users" title={t("candidates_title")} description={t("candidates_empty")} />
      ) : (
        <>
          <CandidatesTable
            items={items}
            jobs={jobs}
            visibleColumns={visibleColumns}
            columnOrder={columnOrder}
            selectedIds={selectedIds}
            onToggleSelected={toggleSelected}
            onToggleAllVisible={toggleAllVisible}
            onListChange={() => void refresh()}
          />
          <div className="flex items-center justify-between pt-4">
            <p className="text-xs text-muted-foreground">
              Page {page} of {totalPages} · {total} candidates
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                disabled={loading || page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                disabled={loading || page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>

          {selectedCount > 0 ? (
            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
              <div className="rounded-lg border border-border bg-card shadow-md px-3 py-2 flex items-center gap-2">
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {selectedCount} selected
                </span>
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setDeleteOpen(true)}
                >
                  Delete Candidates
                </Button>
                <Button size="sm" className="h-8 text-xs" onClick={openAssignDialog}>
                  Assign Job
                </Button>
              </div>
            </div>
          ) : null}

          <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Assign Job</DialogTitle>
                <DialogDescription>Assign selected candidates to a job.</DialogDescription>
              </DialogHeader>
              <SelectField
                label={t("jobs_title")}
                value={assignJobId}
                onValueChange={setAssignJobId}
                options={jobs.map((j) => ({ value: j.id, label: j.title }))}
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
                <AlertDialogTitle>Delete selected candidates?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action will permanently remove {selectedCount} candidate(s).
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
            <DialogTitle>Import Candidates</DialogTitle>
            <DialogDescription>Upload CSV with required columns: name,email</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Optional columns: phone,source</p>
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
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Sheet open={columnPickerOpen} onOpenChange={setColumnPickerOpen}>
        <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Column picker</SheetTitle>
          </SheetHeader>
          <div className="mt-4">{columnPickerContent}</div>
        </SheetContent>
      </Sheet>
      <AddCandidateDialog open={addOpen} onOpenChange={setAddOpen} onAdded={() => void refresh()} />
    </MainPagesLayout>
  );
}

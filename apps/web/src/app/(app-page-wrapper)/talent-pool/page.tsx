"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { TalentPoolCandidatesTable } from "@/components/candidates/talent_pool/TalentPoolCandidatesTable";
import { Button } from "@onehash/ui/button";
import { EmptyCard, ErrorCard } from "@onehash/ui/card";
import { SelectField } from "@onehash/ui/select";
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
  DropdownMenuTrigger,
} from "@onehash/ui/dropdown-menu";
import { Icon } from "@onehash/ui/icon";
import { toast } from "@onehash/ui/sonner";

const PAGE_SIZE = 25;
const STATUS_ALL = "__all__";

export default function TalentPoolPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<string>(STATUS_ALL);
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
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useSetPageMetadata({
    title: t("talent_pool_title"),
    subtitle: t("talent_pool_subtitle"),
  });

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [debouncedSearch, status]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [page]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);
  const offset = (page - 1) * PAGE_SIZE;
  const selectedCount = selectedIds.size;

  const hasActiveFilters = status !== STATUS_ALL;
  const clearAllFilters = () => setStatus(STATUS_ALL);

  const activeChips = hasActiveFilters
    ? [
        {
          label: t(status),
          clear: () => setStatus(STATUS_ALL),
        },
      ]
    : [];

  const filterContent = (
    <div className="space-y-4 p-1">
      <SelectField
        label={t("status")}
        value={status}
        onValueChange={setStatus}
        options={[
          { value: STATUS_ALL, label: t("all") },
          { value: "active", label: t("active") },
          { value: "rejected", label: t("rejected") },
          { value: "hired", label: t("hired") },
        ]}
      />
    </div>
  );

  const refresh = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await getCandidatesPaginated({
        talent_pool_only: true,
        search: debouncedSearch || undefined,
        status: status === STATUS_ALL ? undefined : status,
        limit: PAGE_SIZE,
        offset,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load candidates");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, status, offset]);

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

    const header = ["name", "email", "phone", "source", "status", "created_at"];

    const escape = (value: unknown) => {
      const s = value === null || value === undefined ? "" : String(value);
      const needsQuotes = /[",\n]/.test(s);
      const escaped = s.replace(/"/g, '""');
      return needsQuotes ? `"${escaped}"` : escaped;
    };

    const lines = [
      header.join(","),
      ...rows.map((c) =>
        [c.name, c.email, c.phone ?? "", c.source ?? "", c.status ?? "", c.created_at]
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
    exportCsv(items, `talent_pool_page_${page}.csv`);
  };

  const visibleIds = useMemo(() => items.map((c) => c.id), [items]);
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
            <Icon name="Plus" className="h-3.5 w-3.5" /> Create Candidate
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 md:h-8 w-9 p-0">
                <Icon name="MoreHorizontal" className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
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
        <EmptyCard
          icon="Mail"
          title={t("talent_pool_title")}
          description={t("talent_pool_empty")}
        />
      ) : (
        <>
          <TalentPoolCandidatesTable
            items={items}
            jobs={jobs}
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
          <AddCandidateDialog
            open={addOpen}
            onOpenChange={setAddOpen}
            onAdded={() => void refresh()}
          />

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
    </MainPagesLayout>
  );
}

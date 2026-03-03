"use client";

import { useState, useMemo, useEffect } from "react";
import { Button } from "@onehash/ui/button";
import { MultiSelect, SelectField } from "@onehash/ui/select";
import { InputField } from "@onehash/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@onehash/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { MainPagesLayout } from "@/components/common/MainPagesLayout";
import { CandidatesList, type Candidate } from "@/components/candidates/CandidatesList";
import { useTranslation } from "react-i18next";
import { useSetPageMetadata } from "@/hooks/useSetPageMetadata";
import {
  bulkUpdateCandidateStage,
  bulkUpdateCandidateStatus,
  createCandidate,
  getCandidatesPaginated,
  getJobs,
  getJobById,
  type JobListItemResponse,
  type CandidateListItemResponse,
} from "@/api";
import { API_BASE_URL } from "@/api/client/client";

const stages = ["Applied", "Screening", "Interview", "Offer", "Hired", "Rejected"];
const stageOptions = stages.map((s) => ({ value: s, label: s }));
const NO_JOB_VALUE = "__no_job__";

const stageOrder: Record<string, number> = {
  Applied: 0,
  Screening: 1,
  Interview: 2,
  Offer: 3,
  Hired: 4,
  Rejected: 5,
};

const mapStage = (item: CandidateListItemResponse): string => {
  if (item.status === "rejected") return "Rejected";
  if (item.status === "hired") return "Hired";
  return item.stage_name ?? "Applied";
};

const formatActivityDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const toUiCandidate = (item: CandidateListItemResponse): Candidate => ({
  id: item.id,
  name: item.name,
  email: item.email,
  role: item.job_title ?? "—",
  stage: mapStage(item),
  lastActivity: formatActivityDate(item.updated_at),
  appliedDate: item.created_at,
  tags: item.tags ?? [],
  source: item.source ?? "job_board",
  phone: item.phone ?? "—",
  location: "—",
});

export default function CandidatesPage() {
  const { t } = useTranslation();

  useSetPageMetadata({
    title: t("candidates_title"),
    subtitle: t("candidates_subtitle"),
  });

  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [items, setItems] = useState<CandidateListItemResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const [page, setPage] = useState(1);
  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const [moveStageOpen, setMoveStageOpen] = useState(false);
  const [moveStageOptions, setMoveStageOptions] = useState<Array<{ value: string; label: string }>>(
    [],
  );
  const [selectedMoveStageId, setSelectedMoveStageId] = useState("");
  const [moveLoading, setMoveLoading] = useState(false);
  const [jobs, setJobs] = useState<JobListItemResponse[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addJobId, setAddJobId] = useState<string>(NO_JOB_VALUE);

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    const refreshCandidates = async () => {
      try {
        setLoading(true);
        const data = await getCandidatesPaginated({
          limit: pageSize,
          offset: (page - 1) * pageSize,
          search: search.trim() || undefined,
        });
        if (!cancelled) {
          setItems(data.items);
          setTotal(data.total);
        }
      } catch (err) {
        if (!cancelled)
          toast({
            title: err instanceof Error ? err.message : "Failed to load candidates",
            variant: "destructive",
          });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void refreshCandidates();
    return () => {
      cancelled = true;
    };
  }, [toast, page, search]);

  useEffect(() => {
    let stopped = false;
    let socket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let syncTimer: ReturnType<typeof setInterval> | null = null;

    const refreshCandidates = async () => {
      try {
        const data = await getCandidatesPaginated({
          limit: pageSize,
          offset: (page - 1) * pageSize,
          search: search.trim() || undefined,
        });
        if (!stopped) {
          setItems(data.items);
          setTotal(data.total);
        }
      } catch {
        // Websocket refresh is best-effort; polling and manual actions still work.
      }
    };

    const connect = () => {
      if (stopped) return;
      const wsBase = API_BASE_URL.replace(/^http/i, "ws");
      socket = new WebSocket(`${wsBase}/public/inbound/events/ws`);

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as Record<string, unknown>;
          if (payload.event === "inbound_processed") {
            void refreshCandidates();
          }
        } catch {
          // Ignore malformed events to keep the stream alive.
        }
      };

      socket.onclose = () => {
        if (stopped) return;
        retryTimer = setTimeout(connect, 3000);
      };
    };

    connect();
    syncTimer = setInterval(() => {
      if (!stopped) {
        void refreshCandidates();
      }
    }, 30000);

    return () => {
      stopped = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (syncTimer) clearInterval(syncTimer);
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, [page, search, pageSize]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await getJobs();
        if (!cancelled) {
          setJobs(list);
        }
      } catch {
        // keep page usable even if jobs fetch fails
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [addJobId]);

  const candidateById = useMemo(() => {
    const map = new Map<string, CandidateListItemResponse>();
    for (const item of items) map.set(item.id, item);
    return map;
  }, [items]);

  const filtered = useMemo(() => {
    const list = items.map(toUiCandidate).filter((c) => {
      const matchStage = stageFilter.length === 0 || stageFilter.includes(c.stage);
      return matchStage;
    });

    list.sort((a, b) => {
      const da = new Date(a.appliedDate).getTime();
      const db = new Date(b.appliedDate).getTime();
      if (Number.isFinite(da) && Number.isFinite(db) && db !== da) return db - da;
      return (stageOrder[a.stage] ?? 99) - (stageOrder[b.stage] ?? 99);
    });

    return list;
  }, [items, stageFilter]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((c) => c.id)));
    }
  };

  const openMoveStageDialog = async (ids: string[]) => {
    const selectedCandidates = ids
      .map((id) => candidateById.get(id))
      .filter((x): x is CandidateListItemResponse => Boolean(x));

    if (selectedCandidates.length === 0) return;

    const uniqueJobs = new Set(
      selectedCandidates.map((c) => c.job_id).filter((id): id is string => Boolean(id)),
    );
    if (selectedCandidates.some((c) => !c.job_id)) {
      toast({
        title: "Some selected candidates are not linked to a job",
        variant: "destructive",
      });
      return;
    }
    if (uniqueJobs.size !== 1) {
      toast({
        title: "Select candidates from a single job to move stage",
        variant: "destructive",
      });
      return;
    }

    const jobId = selectedCandidates[0].job_id;
    try {
      const job = await getJobById(jobId);
      const options = job.hiring_stages
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((s) => ({ value: s.id, label: s.name }));
      setMoveStageOptions(options);
      setSelectedMoveStageId(options[0]?.value ?? "");
      setMoveStageOpen(true);
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Failed to load stages",
        variant: "destructive",
      });
    }
  };

  const bulkAction = async (action: string) => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;

    if (action === "Reject") {
      try {
        const result = await bulkUpdateCandidateStatus(ids, "rejected");
        setItems((prev) =>
          prev.map((item) =>
            ids.includes(item.id) ? { ...item, status: "rejected", stage_name: "Rejected" } : item,
          ),
        );
        toast({ title: `Rejected ${result.updated_count} candidate(s)` });
      } catch (err) {
        toast({
          title: err instanceof Error ? err.message : "Failed to reject candidates",
          variant: "destructive",
        });
      } finally {
        setSelected(new Set());
      }
      return;
    }

    if (action === "Move stage") {
      await openMoveStageDialog(ids);
      return;
    }

    toast({ title: `${action} action is not configured yet.` });
    setSelected(new Set());
  };

  const submitMoveStage = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0 || !selectedMoveStageId) {
      setMoveStageOpen(false);
      return;
    }

    const nextStageName = moveStageOptions.find((s) => s.value === selectedMoveStageId)?.label;

    try {
      setMoveLoading(true);
      const result = await bulkUpdateCandidateStage(ids, selectedMoveStageId);
      setItems((prev) =>
        prev.map((item) =>
          ids.includes(item.id)
            ? {
                ...item,
                stage_id: selectedMoveStageId,
                stage_name: nextStageName ?? item.stage_name,
                status:
                  item.status === "rejected" || item.status === "hired" ? "active" : item.status,
              }
            : item,
        ),
      );
      toast({ title: `Moved ${result.updated_count} candidate(s)` });
      setSelected(new Set());
      setMoveStageOpen(false);
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Failed to move candidates",
        variant: "destructive",
      });
    } finally {
      setMoveLoading(false);
    }
  };

  const submitAddCandidate = async () => {
    if (!addName.trim() || !addEmail.trim()) return;
    try {
      setAddLoading(true);
      const created = await createCandidate({
        job_id: addJobId === NO_JOB_VALUE ? null : addJobId,
        name: addName.trim(),
        email: addEmail.trim(),
        phone: addPhone.trim() || null,
        source: "manual",
        status: "active",
      });
      setItems((prev) => [created, ...prev].slice(0, pageSize));
      setTotal((prev) => prev + 1);
      setAddOpen(false);
      setAddName("");
      setAddEmail("");
      setAddPhone("");
      toast({ title: "Candidate added successfully" });
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Failed to add candidate",
        variant: "destructive",
      });
    } finally {
      setAddLoading(false);
    }
  };

  const activeFiltersCount = stageFilter.length;
  const clearAllFilters = () => setStageFilter([]);

  const activeChips: { label: string; clear: () => void }[] = [];
  stageFilter.forEach((s) =>
    activeChips.push({
      label: `Stage: ${s}`,
      clear: () => setStageFilter((prev) => prev.filter((v) => v !== s)),
    }),
  );

  const filterContent = (
    <div className="space-y-4 p-1">
      <MultiSelect
        label="Stage"
        value={stageFilter}
        onValueChange={setStageFilter}
        options={stageOptions}
        placeholder="All stages"
        triggerClassName="h-8 text-xs"
        showSelectAllClear
      />
      {activeFiltersCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs h-8 text-muted-foreground"
          onClick={clearAllFilters}
        >
          {t("clear_all")}
        </Button>
      )}
    </div>
  );

  return (
    <>
      <MainPagesLayout
        searchValue={search}
        onSearchChange={setSearch}
        actionLabel="Add"
        actionIcon="UserPlus"
        onAction={() => setAddOpen(true)}
        filterContent={filterContent}
        filterTitle="Filters"
        hasActiveFilters={activeFiltersCount > 0}
        activeChips={activeChips}
        onClearAllFilters={clearAllFilters}
      >
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading candidates...</p>
        ) : (
          <div className="space-y-3">
            <CandidatesList
              candidates={filtered}
              selected={selected}
              onToggleSelect={toggleSelect}
              onToggleAll={toggleAll}
              onBulkAction={bulkAction}
              onClearSelection={() => setSelected(new Set())}
              total={total}
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}
      </MainPagesLayout>

      <Dialog open={moveStageOpen} onOpenChange={setMoveStageOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Move candidates to stage</DialogTitle>
            <DialogDescription>
              Select the target stage for {selected.size} selected candidate(s).
            </DialogDescription>
          </DialogHeader>

          <SelectField
            label="Target Stage"
            value={selectedMoveStageId}
            onValueChange={setSelectedMoveStageId}
            options={moveStageOptions}
            placeholder="Select stage"
          />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setMoveStageOpen(false)}
              disabled={moveLoading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={submitMoveStage}
              disabled={moveLoading || !selectedMoveStageId}
            >
              {moveLoading ? "Moving..." : "Move"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add candidate</DialogTitle>
            <DialogDescription>
              Add a candidate manually to your organization. Job is optional.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <SelectField
              label="Job"
              value={addJobId}
              onValueChange={setAddJobId}
              options={[
                { value: NO_JOB_VALUE, label: "No job (Talent Pool)" },
                ...jobs.map((j) => ({ value: j.id, label: j.title })),
              ]}
              placeholder="No job (Talent Pool)"
            />
            <InputField
              label="Full Name"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              placeholder="Candidate name"
              showAsterisk
            />
            <InputField
              label="Email"
              value={addEmail}
              onChange={(e) => setAddEmail(e.target.value)}
              placeholder="candidate@example.com"
              type="email"
              showAsterisk
            />
            <InputField
              label="Phone (Optional)"
              value={addPhone}
              onChange={(e) => setAddPhone(e.target.value)}
              placeholder="+1 555 000 0000"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAddOpen(false)}
              disabled={addLoading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={submitAddCandidate}
              disabled={addLoading || !addName.trim() || !addEmail.trim()}
            >
              {addLoading ? "Adding..." : "Add Candidate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

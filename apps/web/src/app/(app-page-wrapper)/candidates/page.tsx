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
  createCandidate,
  getCandidatesPaginated,
  getJobs,
  type JobListItemResponse,
  type CandidateListItemResponse,
} from "@/api";
import { getWebSocketBaseUrl } from "@/api/client/client";

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
  const [items, setItems] = useState<CandidateListItemResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const [page, setPage] = useState(1);
  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

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
      socket = new WebSocket(getWebSocketBaseUrl());

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
            <CandidatesList candidates={filtered} />
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

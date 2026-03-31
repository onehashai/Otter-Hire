"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@onehash/ui/button";
import { Badge } from "@onehash/ui/badge";
import { InputField } from "@onehash/ui/input";
import { Icon } from "@onehash/ui/icon";
import { Separator } from "@onehash/ui/separator";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { getDefaultStageId } from "@/lib/job-workspace";
import { AddCandidateDialog } from "@/components/candidates/shared/dialogs/AddCandidateDialog";
import { useJobWorkspaceStage } from "../context";
import { ChevronLeft } from "lucide-react";
import { formatTimestamp } from "@/lib/format-date";
import { JobCandidateProfile } from "@/components/candidates/job_candidates/JobCandidateProfile";

const MOBILE_BREAKPOINT_PX = 768;

export default function StageWorkspaceContent() {
  const params = useParams();
  const router = useRouter();
  const jobId = params?.jobId as string;
  const stageIdParam = params?.stageId as string;
  const candidateIdParam = params?.candidateId as string | undefined;
  const isMobile = useIsMobile();
  const { workspace, loading, error, reload } = useJobWorkspaceStage();

  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [mobileStageIndex, setMobileStageIndex] = useState(0);
  const [movingToStageId, setMovingToStageId] = useState<string | null>(null);

  const mobileStripRef = useRef<HTMLDivElement>(null);
  const mobileStagesPanelRef = useRef<HTMLDivElement>(null);
  const mobileListPanelRef = useRef<HTMLDivElement>(null);
  const mobileDetailPanelRef = useRef<HTMLDivElement>(null);

  const sortedStages = useMemo(() => {
    if (!workspace?.stages.length) return [];
    return [...workspace.stages].sort((a, b) => a.position - b.position);
  }, [workspace?.stages]);

  const defaultStageId = useMemo(
    () => (workspace ? getDefaultStageId(workspace.stages) : null),
    [workspace],
  );

  const activeStageId = stageIdParam ?? defaultStageId ?? null;

  useEffect(() => {
    if (!workspace || !defaultStageId || !stageIdParam) return;
    const exists = sortedStages.some((s) => s.id === stageIdParam);
    if (!exists) {
      router.replace(
        `/jobs/${encodeURIComponent(jobId)}/stage/${encodeURIComponent(defaultStageId)}`,
        { scroll: false },
      );
    }
  }, [workspace, defaultStageId, stageIdParam, sortedStages, jobId, router]);

  useEffect(() => {
    if (!sortedStages.length || !activeStageId) return;
    const idx = sortedStages.findIndex((s) => s.id === activeStageId);
    if (idx >= 0) setMobileStageIndex(idx);
  }, [sortedStages, activeStageId]);

  const activeStage =
    sortedStages.find((s) => s.id === activeStageId) ?? sortedStages[mobileStageIndex] ?? null;
  const stageForList = isMobile ? (sortedStages[mobileStageIndex] ?? null) : activeStage;

  const candidatesInStage = useMemo(() => {
    if (!workspace?.candidates || !stageForList) return [];
    return workspace.candidates.filter((c) => c.stage_id === stageForList.id);
  }, [workspace?.candidates, stageForList]);

  useEffect(() => {
    if (!candidateIdParam || !stageForList || movingToStageId) return;
    const stillInCurrentStage = candidatesInStage.some((c) => c.id === candidateIdParam);
    if (!stillInCurrentStage) {
      router.replace(
        `/jobs/${encodeURIComponent(jobId)}/stage/${encodeURIComponent(stageForList.id)}`,
        { scroll: false },
      );
    }
  }, [candidateIdParam, stageForList, candidatesInStage, jobId, router, movingToStageId]);

  useEffect(() => {
    if (!movingToStageId) return;
    if (stageIdParam === movingToStageId) {
      setMovingToStageId(null);
    }
  }, [movingToStageId, stageIdParam]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT_PX) return;
    if (!stageForList || candidateIdParam) return;
    if (candidatesInStage.length === 0) return;
    const firstCandidate = candidatesInStage[0];
    if (!firstCandidate) return;
    router.replace(
      `/jobs/${encodeURIComponent(jobId)}/stage/${encodeURIComponent(stageForList.id)}/candidates/${encodeURIComponent(firstCandidate.id)}`,
      { scroll: false },
    );
  }, [stageForList, candidateIdParam, candidatesInStage, jobId, router]);

  const filteredCandidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return candidatesInStage;
    return candidatesInStage.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.email ?? "").toLowerCase().includes(q),
    );
  }, [candidatesInStage, search]);

  const mobileSelectStage = (index: number) => {
    const s = sortedStages[index];
    if (!s) return;
    setMobileStageIndex(index);
    router.replace(`/jobs/${encodeURIComponent(jobId)}/stage/${encodeURIComponent(s.id)}`, {
      scroll: false,
    });
  };

  const candidateCountByStage = (stageId: string) =>
    (workspace?.candidates ?? []).filter((c) => c.stage_id === stageId).length;

  useLayoutEffect(() => {
    if (!isMobile || !mobileStripRef.current) return;
    const strip = mobileStripRef.current;
    const el = candidateIdParam ? mobileDetailPanelRef.current : mobileStagesPanelRef.current;
    if (!el) return;
    strip.scrollTo({ left: el.offsetLeft, behavior: "instant" });
    if (candidateIdParam) {
      mobileDetailPanelRef.current?.focus({ preventScroll: true });
    }
  }, [isMobile, candidateIdParam, stageIdParam]);

  if (!jobId) {
    return <p className="text-sm text-muted-foreground p-4">Invalid job.</p>;
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground p-4">Loading...</p>;
  }

  if (error || !workspace) {
    return (
      <div className="space-y-4 p-4">
        <p className="text-sm text-muted-foreground">{error ?? "Job not found."}</p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/jobs">Back to Jobs</Link>
        </Button>
      </div>
    );
  }

  const listColumnInner = (
    <>
      <div className="p-3 border-b border-border flex items-start justify-between gap-2 shrink-0">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{stageForList?.name ?? "Stage"}</h2>
          <p className="text-xs text-muted-foreground">
            {candidatesInStage.length} {candidatesInStage.length === 1 ? "candidate" : "candidates"}
          </p>
        </div>
        <Button size="sm" className="h-7 px-2.5 text-[11px]" onClick={() => setAddOpen(true)}>
          + Candidate
        </Button>
      </div>
      <div className="p-3 border-b border-border shrink-0">
        <InputField
          placeholder="Search candidates"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-sm"
        />
      </div>
      <div className="flex-1 overflow-auto p-2 space-y-1.5 min-h-0">
        {filteredCandidates.length === 0 ? (
          <div className="h-full min-h-[120px] grid place-items-center text-xs text-muted-foreground px-4 text-center">
            No candidates in this stage
          </div>
        ) : (
          filteredCandidates.map((c) => {
            const selected = candidateIdParam === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() =>
                  stageForList &&
                  router.push(
                    `/jobs/${encodeURIComponent(jobId)}/stage/${encodeURIComponent(stageForList.id)}/candidates/${encodeURIComponent(c.id)}`,
                    { scroll: false },
                  )
                }
                className={cn(
                  "w-full text-left rounded-md border border-transparent px-2.5 py-2 hover:bg-muted/60 min-h-[44px]",
                  selected && "bg-muted border-border",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium truncate">{c.name}</p>
                  <p className="text-[10px] text-muted-foreground shrink-0">
                    {formatTimestamp(c.created_at)}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </>
  );

  if (isMobile) {
    return (
      <>
        <div
          ref={mobileStripRef}
          className={cn(
            "flex w-full overflow-x-auto overflow-y-hidden overscroll-x-contain",
            "snap-x snap-mandatory scroll-smooth",
            "h-[calc(100dvh-3rem-3.5rem)] min-h-[280px] max-h-[calc(100dvh-3rem-3.5rem)] border-t border-border",
          )}
        >
          <section
            ref={mobileStagesPanelRef}
            role="region"
            aria-label="Hiring stages"
            className={cn(
              "w-[83.333dvw] shrink-0 snap-start snap-always h-full min-h-0",
              "border-r border-border bg-sidebar flex flex-col overflow-y-auto",
            )}
          >
            <div className="p-3 border-b border-border shrink-0 space-y-2">
              <Link
                href="/jobs"
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-sidebar-foreground hover:bg-sidebar-accent"
              >
                <ChevronLeft className="h-4 w-4 shrink-0" />
                Back to Jobs
              </Link>
              <h2 className="text-sm font-semibold truncate px-0.5">{workspace.title}</h2>
            </div>

            <p className="text-[10px] font-semibold text-muted-foreground tracking-wide px-3 pt-3 pb-1">
              Stages
            </p>
            <nav className="px-2 pb-2 space-y-0.5 min-h-0">
              {sortedStages.map((s, i) => {
                const count = candidateCountByStage(s.id);
                const isActive = i === mobileStageIndex;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => mobileSelectStage(i)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2.5 py-2.5 text-left text-sm transition-colors min-h-[44px]",
                      "text-sidebar-foreground hover:bg-sidebar-accent",
                      isActive && "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
                    )}
                  >
                    <span className="truncate flex-1">{s.name}</span>
                    <span className="text-[10px] tabular-nums text-muted-foreground shrink-0">
                      ({count})
                    </span>
                  </button>
                );
              })}
              <Separator className="my-2" />
              <Link
                href={`/jobs/${encodeURIComponent(jobId)}/info`}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors",
                  "text-sidebar-foreground hover:bg-sidebar-accent",
                )}
              >
                <Icon name="PenLine" className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Edit job</span>
              </Link>
            </nav>
          </section>

          <section
            ref={mobileListPanelRef}
            role="region"
            aria-label="Candidates in stage"
            className={cn(
              "w-[83.333dvw] shrink-0 snap-start snap-always h-full min-h-0",
              "border-r border-border flex flex-col bg-background",
            )}
          >
            {listColumnInner}
          </section>

          <section
            ref={mobileDetailPanelRef}
            role="region"
            aria-label="Candidate details"
            tabIndex={-1}
            className={cn(
              "w-[100dvw] min-w-[100dvw] shrink-0 snap-start snap-always h-full min-h-0",
              "flex flex-col bg-background",
            )}
          >
            {candidateIdParam ? (
              <div className="flex-1 overflow-auto min-h-0 py-2 px-0">
                <JobCandidateProfile
                  candidateId={candidateIdParam}
                  jobRouteJobId={jobId}
                  isStageThreePane={true}
                  onCandidateUpdated={async () => {
                    await reload();
                  }}
                  onStageMoved={async (destinationStageId) => {
                    setMovingToStageId(destinationStageId);
                    router.replace(
                      `/jobs/${encodeURIComponent(jobId)}/stage/${encodeURIComponent(destinationStageId)}/candidates/${encodeURIComponent(candidateIdParam)}`,
                      { scroll: false },
                    );
                    await reload();
                  }}
                />
              </div>
            ) : (
              <div className="flex-1 grid place-items-center text-sm text-muted-foreground px-4 text-center">
                Select a candidate from the list
              </div>
            )}
          </section>
        </div>

        <AddCandidateDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          jobId={jobId}
          jobTitle={workspace.title}
          stageId={stageForList?.id ?? null}
          onAdded={async () => {
            await reload();
          }}
        />
      </>
    );
  }

  return (
    <div className="h-[calc(100vh-3rem)] min-h-[640px] flex border-t border-border">
      <section className="w-[300px] border-r border-border flex flex-col">
        {listColumnInner}
      </section>

      {candidateIdParam ? (
        <section className="flex-1 overflow-auto p-4">
          <JobCandidateProfile
            candidateId={candidateIdParam}
            jobRouteJobId={jobId}
            isStageThreePane={true}
            onCandidateUpdated={async () => {
              await reload();
            }}
            onStageMoved={async (destinationStageId) => {
              setMovingToStageId(destinationStageId);
              router.replace(
                `/jobs/${encodeURIComponent(jobId)}/stage/${encodeURIComponent(destinationStageId)}/candidates/${encodeURIComponent(candidateIdParam)}`,
                { scroll: false },
              );
              await reload();
            }}
          />
        </section>
      ) : (
        <section className="flex-1 grid place-items-center text-sm text-muted-foreground">
          Select a candidate from the list
        </section>
      )}

      <AddCandidateDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        jobId={jobId}
        jobTitle={workspace.title}
        stageId={stageForList?.id ?? null}
        onAdded={async () => {
          await reload();
        }}
      />
    </div>
  );
}

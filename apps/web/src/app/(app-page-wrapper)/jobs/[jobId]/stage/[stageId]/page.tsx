"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@onehash/ui/button";
import { Card, CardContent } from "@onehash/ui/card";
import { Avatar } from "@onehash/ui/avatar";
import { Badge } from "@onehash/ui/badge";
import { InputField } from "@onehash/ui/input";
import { Icon } from "@onehash/ui/icon";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { getDefaultStageId } from "@/lib/job-workspace";
import { AddCandidateDialog } from "@/components/candidates/shared/dialogs/AddCandidateDialog";
import { useJobWorkspaceStage } from "../context";
import { ChevronLeft } from "lucide-react";
import { formatTimestamp } from "@/lib/format-date";
import { getInitialsFromName } from "@/lib/name-initials";

export default function JobStageWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params?.jobId as string;
  const stageIdParam = params?.stageId as string;
  const isMobile = useIsMobile();
  const { workspace, loading, error, reload } = useJobWorkspaceStage();

  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [mobileStageIndex, setMobileStageIndex] = useState(0);

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
    sortedStages.find((s) => s.id === activeStageId) ??
    sortedStages[mobileStageIndex] ??
    null;

  const stageForList = isMobile ? sortedStages[mobileStageIndex] ?? null : activeStage;

  const candidatesInStage = useMemo(() => {
    if (!workspace?.candidates || !stageForList) return [];
    return workspace.candidates.filter((c) => c.stage_id === stageForList.id);
  }, [workspace?.candidates, stageForList]);

  const filteredCandidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return candidatesInStage;
    return candidatesInStage.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q),
    );
  }, [candidatesInStage, search]);

  if (!jobId) {
    return <p className="text-sm text-muted-foreground">Invalid job.</p>;
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (error || !workspace) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{error ?? "Job not found."}</p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/jobs">Back to Jobs</Link>
        </Button>
      </div>
    );
  }

  const mobileSelectStage = (index: number) => {
    const s = sortedStages[index];
    if (!s) return;
    setMobileStageIndex(index);
    router.replace(
      `/jobs/${encodeURIComponent(jobId)}/stage/${encodeURIComponent(s.id)}`,
      { scroll: false },
    );
  };

  return (
    <div className="space-y-4">
      {isMobile && (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" asChild>
            <Link href="/jobs">
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold truncate">{workspace.title}</h2>
            <p className="text-[10px] text-muted-foreground">Select a stage to view candidates</p>
          </div>
        </div>
      )}

      {isMobile && sortedStages.length > 0 && (
        <div className="flex gap-1 overflow-x-auto pb-1 -mx-4 px-4 no-scrollbar">
          {sortedStages.map((s, i) => {
            const count = workspace.candidates.filter((c) => c.stage_id === s.id).length;
            const isSel = i === mobileStageIndex;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => mobileSelectStage(i)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors min-h-[44px]",
                  isSel ? "bg-foreground text-background" : "bg-muted text-muted-foreground",
                )}
              >
                {s.name}
                <Badge
                  variant={isSel ? "outline" : "secondary"}
                  className={cn(
                    "text-[10px] h-4",
                    isSel && "border-background/30 text-background",
                  )}
                >
                  {count}
                </Badge>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">{stageForList?.name ?? "Stage"}</h2>
          <p className="text-xs text-muted-foreground">
            {candidatesInStage.length}{" "}
            {candidatesInStage.length === 1 ? "candidate" : "candidates"} in this stage
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            size="sm"
            className="h-9 text-xs gap-1.5 w-full sm:w-auto"
            onClick={() => setAddOpen(true)}
          >
            <Icon name="UserPlus" className="h-3.5 w-3.5" />
            Add Candidate
          </Button>
        </div>
      </div>

      <div className="relative">
        <Icon
          name="Search"
          className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none"
        />
        <InputField
          placeholder="Search candidates…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 pl-8 text-sm"
        />
      </div>

      <div className="space-y-2">
        {filteredCandidates.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No candidates in this stage
            </CardContent>
          </Card>
        ) : (
          filteredCandidates.map((c) => (
            <Card
              key={c.id}
              role="link"
              tabIndex={0}
              className="cursor-pointer hover:shadow-sm active:bg-muted/50 transition-all"
              onClick={() =>
                router.push(`/jobs/${encodeURIComponent(jobId)}/candidates/${encodeURIComponent(c.id)}`)
              }
              onKeyDown={(e) => {
                if (e.key === "Enter")
                  router.push(
                    `/jobs/${encodeURIComponent(jobId)}/candidates/${encodeURIComponent(c.id)}`,
                  );
              }}
            >
              <CardContent className="p-4 py-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9 shrink-0" fallbackClassName="text-xs bg-muted">
                    {getInitialsFromName(c.name)}
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {c.email ?? "No email"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
                    <span>{formatTimestamp(c.created_at)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
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
    </div>
  );
}

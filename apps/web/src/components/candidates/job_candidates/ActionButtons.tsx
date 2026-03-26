"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@onehash/ui/button";
import { Icon } from "@onehash/ui/icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@onehash/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@onehash/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { updateCandidateStage, updateCandidateStatus, type JobHiringStageResponse } from "@/api";

export interface ActionButtonsProps {
  candidateName: string;
  jobId?: string;
  candidateId?: string;
  currentStageId?: string | null;
  stages?: JobHiringStageResponse[];
  onCandidateUpdated?: () => void | Promise<void>;
  onStageMoved?: (stageId: string) => void | Promise<void>;
  onSchedule?: () => void;
}

export function ActionButtons({
  candidateName,
  jobId,
  candidateId,
  currentStageId,
  stages,
  onCandidateUpdated,
  onStageMoved,
  onSchedule,
}: ActionButtonsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [movingToStageId, setMovingToStageId] = useState<string | null>(null);

  const sortedStages = useMemo(
    () => [...(stages ?? [])].sort((a, b) => a.position - b.position),
    [stages],
  );
  const rejectedStage = useMemo(
    () => sortedStages.find((s) => s.name.trim().toLowerCase() === "rejected") ?? null,
    [sortedStages],
  );
  const hiredStage = useMemo(
    () => sortedStages.find((s) => s.name.trim().toLowerCase() === "hired") ?? null,
    [sortedStages],
  );
  const appliedStage = useMemo(
    () => sortedStages.find((s) => s.name.trim().toLowerCase() === "applied") ?? null,
    [sortedStages],
  );
  const progressionStages = useMemo(
    () => sortedStages.filter((s) => !rejectedStage || s.id !== rejectedStage.id),
    [sortedStages, rejectedStage],
  );
  const currentStageIndex = useMemo(
    () => progressionStages.findIndex((s) => s.id === currentStageId),
    [progressionStages, currentStageId],
  );
  const nextStage =
    currentStageIndex >= 0 && currentStageIndex < progressionStages.length - 1
      ? progressionStages[currentStageIndex + 1]
      : null;
  const moveTargets = progressionStages.filter((s) => s.id !== currentStageId);
  const isInRejectedStage = Boolean(rejectedStage && currentStageId === rejectedStage.id);
  const isInHiredStage = Boolean(hiredStage && currentStageId === hiredStage.id);
  const reconsiderTargets = progressionStages.filter((s) => s.id !== currentStageId);
  const defaultReconsiderStage = appliedStage ?? reconsiderTargets[0] ?? null;

  const handleMove = async (stageId: string, stageName: string) => {
    if (!candidateId) {
      toast({ title: "Candidate not found", variant: "destructive" });
      return;
    }
    try {
      setMovingToStageId(stageId);
      await updateCandidateStage(candidateId, stageId);
      toast({ title: `Moved to ${stageName}` });
      if (onCandidateUpdated) {
        await onCandidateUpdated();
      }
      if (onStageMoved) {
        await onStageMoved(stageId);
      }
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Failed to move candidate",
        variant: "destructive",
      });
    } finally {
      setMovingToStageId(null);
    }
  };

  const handleReject = async () => {
    if (!candidateId) {
      toast({ title: "Candidate not found", variant: "destructive" });
      return;
    }
    if (!rejectedStage) {
      toast({ title: "Rejected stage not found", variant: "destructive" });
      return;
    }
    try {
      setMovingToStageId(rejectedStage.id);
      await updateCandidateStage(candidateId, rejectedStage.id);
      await updateCandidateStatus(candidateId, "rejected");
      toast({ title: "Moved to Rejected" });
      if (onCandidateUpdated) {
        await onCandidateUpdated();
      }
      if (onStageMoved) {
        await onStageMoved(rejectedStage.id);
      }
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Failed to reject candidate",
        variant: "destructive",
      });
    } finally {
      setMovingToStageId(null);
    }
  };

  const handleReconsider = async (stageId: string, stageName: string) => {
    if (!candidateId) {
      toast({ title: "Candidate not found", variant: "destructive" });
      return;
    }
    try {
      setMovingToStageId(stageId);
      await updateCandidateStage(candidateId, stageId);
      await updateCandidateStatus(candidateId, "active");
      toast({ title: `Reconsidered to ${stageName}` });
      if (onCandidateUpdated) {
        await onCandidateUpdated();
      }
      if (onStageMoved) {
        await onStageMoved(stageId);
      }
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Failed to reconsider candidate",
        variant: "destructive",
      });
    } finally {
      setMovingToStageId(null);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <Button
        size="sm"
        className="h-8 text-xs gap-1.5"
        onClick={() => {
          if (isInRejectedStage) return;
          if (nextStage) {
            void handleMove(nextStage.id, nextStage.name);
          }
        }}
        disabled={isInRejectedStage || !nextStage || !candidateId || Boolean(movingToStageId)}
        pending={!isInRejectedStage && movingToStageId === nextStage?.id}
      >
        <Icon name="UserCheck" className="h-3.5 w-3.5" />{" "}
        {isInRejectedStage
          ? "Rejected"
          : nextStage
            ? `Move to ${nextStage.name}`
            : "At final stage"}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 w-8 p-0">
            <Icon name="MoreHorizontal" className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {isInRejectedStage ? (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="text-xs cursor-pointer">
                <Icon name="ArrowLeftRight" className="h-3.5 w-3.5 mr-2" /> Reconsider to stage
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-48">
                {reconsiderTargets.length === 0 ? (
                  <DropdownMenuItem disabled className="text-xs">
                    No available stages
                  </DropdownMenuItem>
                ) : (
                  reconsiderTargets.map((stage) => (
                    <DropdownMenuItem
                      key={stage.id}
                      className="text-xs"
                      disabled={Boolean(movingToStageId)}
                      onClick={() => void handleReconsider(stage.id, stage.name)}
                    >
                      {movingToStageId === stage.id ? (
                        <Icon name="Loader" className="h-3.5 w-3.5 mr-2 animate-spin" />
                      ) : null}
                      {stage.name}
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ) : (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="text-xs cursor-pointer">
                <Icon name="ArrowLeftRight" className="h-3.5 w-3.5 mr-2" /> Move to stage
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-48">
                {moveTargets.length === 0 ? (
                  <DropdownMenuItem disabled className="text-xs">
                    No other stages
                  </DropdownMenuItem>
                ) : (
                  moveTargets.map((stage) => (
                    <DropdownMenuItem
                      key={stage.id}
                      className="text-xs"
                      disabled={Boolean(movingToStageId)}
                      onClick={() => void handleMove(stage.id, stage.name)}
                    >
                      {movingToStageId === stage.id ? (
                        <Icon name="Loader" className="h-3.5 w-3.5 mr-2 animate-spin" />
                      ) : null}
                      {stage.name}
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
          <DropdownMenuItem className="text-xs" onClick={() => toast({ title: "Email composed" })}>
            <Icon name="Send" className="h-3.5 w-3.5 mr-2" /> Send Email
          </DropdownMenuItem>
          <DropdownMenuItem className="text-xs" onClick={() => toast({ title: "Offer created" })}>
            <Icon name="ScrollText" className="h-3.5 w-3.5 mr-2" /> Create Offer
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-xs text-destructive focus:text-destructive"
            disabled={
              !rejectedStage ||
              currentStageId === rejectedStage.id ||
              isInHiredStage ||
              Boolean(movingToStageId)
            }
            onClick={() => void handleReject()}
          >
            {movingToStageId === rejectedStage?.id ? (
              <Icon name="Loader" className="h-3.5 w-3.5 mr-2 animate-spin" />
            ) : (
              <Icon name="X" className="h-3.5 w-3.5 mr-2" />
            )}
            Reject
          </DropdownMenuItem>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <DropdownMenuItem
                className="text-xs text-destructive focus:text-destructive"
                disabled={isInHiredStage}
                onSelect={(e) => e.preventDefault()}
              >
                <Icon name="Trash2" className="h-3.5 w-3.5 mr-2" /> Delete
              </DropdownMenuItem>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete candidate?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently remove {candidateName} and all associated data.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="text-xs">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="text-xs bg-destructive text-destructive-foreground"
                  onClick={() => {
                    toast({ title: "Candidate deleted" });
                    router.push(jobId ? `/jobs/${encodeURIComponent(jobId)}` : "/talent-pool");
                  }}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

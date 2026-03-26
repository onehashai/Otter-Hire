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
import { updateCandidateStage, type JobHiringStageResponse } from "@/api";

export interface ActionButtonsProps {
  candidateName: string;
  jobId?: string;
  candidateId?: string;
  currentStageId?: string | null;
  stages?: JobHiringStageResponse[];
  onCandidateUpdated?: () => void | Promise<void>;
  onSchedule?: () => void;
}

export function ActionButtons({
  candidateName,
  jobId,
  candidateId,
  currentStageId,
  stages,
  onCandidateUpdated,
  onSchedule,
}: ActionButtonsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [movingToStageId, setMovingToStageId] = useState<string | null>(null);

  const sortedStages = useMemo(
    () => [...(stages ?? [])].sort((a, b) => a.position - b.position),
    [stages],
  );
  const currentStageIndex = useMemo(
    () => sortedStages.findIndex((s) => s.id === currentStageId),
    [sortedStages, currentStageId],
  );
  const nextStage =
    currentStageIndex >= 0 && currentStageIndex < sortedStages.length - 1
      ? sortedStages[currentStageIndex + 1]
      : null;
  const moveTargets = sortedStages.filter((s) => s.id !== currentStageId);

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
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Failed to move candidate",
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
        onClick={() => nextStage && void handleMove(nextStage.id, nextStage.name)}
        disabled={!nextStage || !candidateId || Boolean(movingToStageId)}
        pending={movingToStageId === nextStage?.id}
      >
        <Icon name="UserCheck" className="h-3.5 w-3.5" />{" "}
        {nextStage ? `Move to ${nextStage.name}` : "At final stage"}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 w-8 p-0">
            <Icon name="MoreHorizontal" className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
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
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-xs text-destructive focus:text-destructive"
            onClick={() => toast({ title: "Candidate rejected", variant: "destructive" })}
          >
            <Icon name="X" className="h-3.5 w-3.5 mr-2" /> Reject
          </DropdownMenuItem>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <DropdownMenuItem
                className="text-xs text-destructive focus:text-destructive"
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

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@onehash/ui/button";
import { Icon } from "@onehash/ui/icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { MoveStageDialog } from "./MoveStageDialog";
import { RejectCandidateDialog } from "./RejectCandidateDialog";

interface ActionButtonsProps {
  candidateName: string;
  candidateId: string;
  candidateStatus: string;
  jobId: string | null;
  currentStageId: string | null;
  onStageUpdated: () => void;
}

export function ActionButtons({
  candidateName,
  candidateId,
  candidateStatus,
  jobId,
  currentStageId,
  onStageUpdated,
}: ActionButtonsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [moveStageOpen, setMoveStageOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);

  const isRejected = candidateStatus === "rejected";
  const isHired = candidateStatus === "hired";

  const handleMoveStageClick = () => {
    if (!jobId) {
      toast({
        title: "Cannot move stage",
        description: "This candidate is not assigned to a job. Please assign a job first.",
        variant: "destructive",
      });
      return;
    }
    setMoveStageOpen(true);
  };

  const handleRejectClick = () => {
    if (!jobId) {
      toast({
        title: "Cannot reject candidate",
        description: "Candidate must be assigned to a job before rejection. Rejection is per-job basis.",
        variant: "destructive",
      });
      return;
    }
    if (isRejected) {
      toast({
        title: "Already rejected",
        description: "This candidate has already been rejected.",
        variant: "destructive",
      });
      return;
    }
    setRejectDialogOpen(true);
  };

  return (
    <>
      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          className="h-8 text-xs gap-1.5"
          onClick={handleMoveStageClick}
          disabled={!jobId}
        >
          <Icon name="UserCheck" className="h-3.5 w-3.5" /> Move Stage
        </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-8 text-xs gap-1.5 hidden sm:flex"
        onClick={() => toast({ title: "Interview scheduled" })}
      >
        <Icon name="Clock" className="h-3.5 w-3.5" /> Schedule
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 w-8 p-0">
            <Icon name="MoreHorizontal" className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            className="text-xs"
            onClick={() => toast({ title: "Interview scheduled" })}
          >
            <Icon name="Clock" className="h-3.5 w-3.5 mr-2" /> Schedule Interview
          </DropdownMenuItem>
          <DropdownMenuItem className="text-xs" onClick={() => toast({ title: "Email composed" })}>
            <Icon name="Send" className="h-3.5 w-3.5 mr-2" /> Send Email
          </DropdownMenuItem>
          <DropdownMenuItem className="text-xs" onClick={() => toast({ title: "Offer created" })}>
            <Icon name="ScrollText" className="h-3.5 w-3.5 mr-2" /> Create Offer
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-xs text-destructive focus:text-destructive"
            onClick={handleRejectClick}
            disabled={!jobId || isRejected}
          >
            <Icon name="X" className="h-3.5 w-3.5 mr-2" />
            {isRejected ? "Already Rejected" : "Reject"}
          </DropdownMenuItem>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <DropdownMenuItem
                className="text-xs text-destructive focus:text-destructive"
                onSelect={(e) => e.preventDefault()}
              >
                <Icon name="X" className="h-3.5 w-3.5 mr-2" /> Delete
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
                    router.push("/candidates");
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

    <MoveStageDialog
      open={moveStageOpen}
      onOpenChange={setMoveStageOpen}
      candidateId={candidateId}
      candidateName={candidateName}
      jobId={jobId}
      currentStageId={currentStageId}
      onSuccess={onStageUpdated}
    />

    <RejectCandidateDialog
      open={rejectDialogOpen}
      onOpenChange={setRejectDialogOpen}
      candidateId={candidateId}
      candidateName={candidateName}
      onSuccess={onStageUpdated}
    />
  </>
  );
}

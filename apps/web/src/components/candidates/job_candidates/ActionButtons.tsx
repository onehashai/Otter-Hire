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
} from "@onehash/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { deleteCandidate } from "@/api";
import { RejectCandidateDialog } from "./RejectCandidateDialog";

export interface ActionButtonsProps {
  candidateName: string;
  candidateId: string;
  candidateStatus: string;
  jobId: string | null | undefined;
  onStageUpdated: () => void;
}

export function ActionButtons({
  candidateName,
  candidateId,
  candidateStatus,
  jobId,
  onStageUpdated,
}: ActionButtonsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const isRejected = candidateStatus === "rejected";
  const isHired = candidateStatus === "hired";

  const handleRejectClick = () => {
    if (!jobId) {
      toast({
        title: "Cannot reject candidate",
        description:
          "Candidate must be assigned to a job before rejection. Rejection is per-job basis.",
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
    if (isHired) {
      toast({
        title: "Cannot reject",
        description: "This candidate is already marked as hired.",
        variant: "destructive",
      });
      return;
    }
    setRejectDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      setDeleteLoading(true);
      await deleteCandidate(candidateId);
      setDeleteOpen(false);
      toast({ title: "Candidate deleted" });
      router.push(jobId ? `/jobs/${encodeURIComponent(jobId)}` : "/talent-pool");
    } catch (err) {
      toast({
        title: "Failed to delete",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 w-8 p-0">
              <Icon name="MoreHorizontal" className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
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
            >
              <Icon name="X" className="h-3.5 w-3.5 mr-2" /> Reject
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-xs text-destructive focus:text-destructive"
              onSelect={(e) => {
                e.preventDefault();
                setDeleteOpen(true);
              }}
            >
              <Icon name="Trash2" className="h-3.5 w-3.5 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <RejectCandidateDialog
        open={rejectDialogOpen}
        onOpenChange={setRejectDialogOpen}
        candidateId={candidateId}
        candidateName={candidateName}
        onSuccess={onStageUpdated}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete candidate?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove {candidateName} and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs" disabled={deleteLoading}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="text-xs bg-destructive text-destructive-foreground"
              disabled={deleteLoading}
              onClick={(e) => {
                e.preventDefault();
                void handleDeleteConfirm();
              }}
            >
              {deleteLoading ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

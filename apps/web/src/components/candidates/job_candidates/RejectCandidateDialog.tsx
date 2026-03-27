"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@onehash/ui/alert-dialog";
import { Button } from "@onehash/ui/button";
import { updateCandidate, updateCandidateStatus } from "@/api";
import { toast } from "@onehash/ui/sonner";

interface RejectCandidateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateId: string;
  candidateName: string;
  onSuccess: () => void;
}

export function RejectCandidateDialog({
  open,
  onOpenChange,
  candidateId,
  candidateName,
  onSuccess,
}: RejectCandidateDialogProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async (e: React.MouseEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateCandidate(candidateId, { job_id: null, clear_job: true });
      toast.success("Candidate rejected successfully");
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reject candidate");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reject Candidate</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to reject {candidateName}? This will send a rejection email to the
            candidate.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <Button
            onClick={handleConfirm}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? "Rejecting..." : "Reject Candidate"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

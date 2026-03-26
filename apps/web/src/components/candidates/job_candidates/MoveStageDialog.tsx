"use client";

import { useEffect, useState } from "react";
import { Button } from "@onehash/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@onehash/ui/dialog";
import { SelectField } from "@onehash/ui/select";
import { getJobById, updateCandidateStage, type JobHiringStageResponse } from "@/api";
import { toast } from "@onehash/ui/sonner";

interface MoveStageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateId: string;
  candidateName: string;
  jobId: string | null;
  currentStageId: string | null;
  onSuccess: () => void;
}

export function MoveStageDialog({
  open,
  onOpenChange,
  candidateId,
  candidateName,
  jobId,
  currentStageId,
  onSuccess,
}: MoveStageDialogProps) {
  const [stages, setStages] = useState<JobHiringStageResponse[]>([]);
  const [selectedStageId, setSelectedStageId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [fetchingStages, setFetchingStages] = useState(false);

  useEffect(() => {
    if (open && jobId) {
      setFetchingStages(true);
      getJobById(jobId)
        .then((job) => {
          setStages(job.hiring_stages);
          if (currentStageId) {
            setSelectedStageId(currentStageId);
          } else if (job.hiring_stages.length > 0) {
            setSelectedStageId(job.hiring_stages[0].id);
          }
        })
        .catch((err) => {
          toast.error(err instanceof Error ? err.message : "Failed to load stages");
        })
        .finally(() => {
          setFetchingStages(false);
        });
    }
  }, [open, jobId, currentStageId]);

  const handleConfirm = async () => {
    if (!selectedStageId) {
      toast.error("Please select a stage");
      return;
    }

    setLoading(true);
    try {
      await updateCandidateStage(candidateId, selectedStageId);
      toast.success("Stage updated successfully");
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update stage");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Move Stage</DialogTitle>
          <DialogDescription className="text-xs">
            Update the hiring stage for {candidateName}.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          {fetchingStages ? (
            <p className="text-sm text-muted-foreground">Loading stages...</p>
          ) : stages.length === 0 ? (
            <p className="text-sm text-muted-foreground">No stages available for this job.</p>
          ) : (
            <SelectField
              label="Stage"
              value={selectedStageId}
              onValueChange={setSelectedStageId}
              options={stages.map((stage) => ({
                value: stage.id,
                label: stage.name,
              }))}
            />
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-8"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="text-xs h-8"
            onClick={handleConfirm}
            disabled={loading || fetchingStages || !selectedStageId || stages.length === 0}
          >
            {loading ? "Updating..." : "Move Stage"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

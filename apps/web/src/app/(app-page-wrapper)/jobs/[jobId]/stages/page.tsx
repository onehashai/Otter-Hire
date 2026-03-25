"use client";

import { useState } from "react";
import { Button } from "@onehash/ui/button";
import { InputField } from "@onehash/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@onehash/ui/dialog";
import { GripVertical, Plus, Trash2, Settings } from "lucide-react";
import { toast } from "@onehash/ui/sonner";
import { cn } from "@/lib/utils";
import { useJobSetup } from "../context";

export default function HiringStagesPage() {
  const {
    hiringStages,
    addHiringStageAndSave,
    removeHiringStageAndSave,
    updateHiringStageName,
    reorderHiringStages,
  } = useJobSetup();
  const [stageDragIdx, setStageDragIdx] = useState<number | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleStageDragStart = (i: number) => setStageDragIdx(i);
  const handleStageDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    if (stageDragIdx === null || stageDragIdx === i) return;
    reorderHiringStages(stageDragIdx, i);
    setStageDragIdx(i);
  };
  const handleStageDragEnd = () => setStageDragIdx(null);

  const handleRemoveStage = async (id: string, isRequired?: boolean) => {
    if (isRequired) {
      toast.error("Applied and Hired stages cannot be deleted");
      return;
    }
    if (hiringStages.length <= 2) {
      toast.error("Pipeline must have at least 2 stages");
      return;
    }
    try {
      setIsSubmitting(true);
      await removeHiringStageAndSave(id);
      toast.success("Stage deleted");
    } catch {
      // Error toast is handled in context executeSave
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddStage = async () => {
    if (!newStageName.trim()) {
      toast.error("Stage name is required");
      return;
    }
    try {
      setIsSubmitting(true);
      await addHiringStageAndSave(newStageName);
      setAddDialogOpen(false);
      setNewStageName("");
      toast.success("Stage added");
    } catch {
      // Error toast is handled in context executeSave
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-muted-foreground mb-1">
          Define hiring stages for this job. Stages can be reordered by dragging.
        </p>
      </div>

      <div className="space-y-1.5">
        {hiringStages.map((stage, i) => (
          <div
            key={stage.id}
            draggable
            onDragStart={() => handleStageDragStart(i)}
            onDragOver={(e) => handleStageDragOver(e, i)}
            onDragEnd={handleStageDragEnd}
            className={cn(
              "group flex items-center gap-2 rounded-lg border border-border bg-card p-3 transition-all",
              stageDragIdx === i && "opacity-50 border-dashed",
            )}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0 cursor-grab active:cursor-grabbing" />
            <span className="text-xs font-medium text-muted-foreground w-5 shrink-0 text-center">
              {i + 1}
            </span>
            <InputField
              value={stage.name}
              onChange={(e) => updateHiringStageName(stage.id, e.target.value)}
              placeholder="Stage name"
              className="h-8 text-sm flex-1 border-transparent bg-transparent hover:border-border focus-visible:border-muted-foreground transition-colors"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 transition-opacity text-muted-foreground"
              onClick={() => handleRemoveStage(stage.id, stage.isRequired)}
              tooltip={stage.isRequired ? "Required stage cannot be deleted" : "Delete"}
              disabled={isSubmitting || stage.isRequired}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>

      <Button
        variant="outline"
        size="sm"
        className="h-9 text-xs gap-1.5 w-full sm:w-auto"
        onClick={() => setAddDialogOpen(true)}
        disabled={isSubmitting}
      >
        <Plus className="h-3.5 w-3.5" /> Add Stage
      </Button>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Stage</DialogTitle>
          </DialogHeader>
          <InputField
            label="Stage Name"
            value={newStageName}
            onChange={(e) => setNewStageName(e.target.value)}
            placeholder="e.g. Assignment"
            autoFocus
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAddDialogOpen(false);
                setNewStageName("");
              }}
              disabled={isSubmitting}
            >
              Discard
            </Button>
            <Button onClick={handleAddStage} disabled={isSubmitting}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

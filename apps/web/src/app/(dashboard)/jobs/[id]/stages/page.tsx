"use client";

import { useState } from "react";
import { Button, InputField, Separator } from "@onehash/ui";
import { GripVertical, Plus, Trash2, Settings, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useJobSetup } from "../context";

export default function HiringStagesPage() {
  const {
    hiringStages,
    addHiringStage,
    removeHiringStage,
    updateHiringStageName,
    reorderHiringStages,
  } = useJobSetup();
  const [stageDragIdx, setStageDragIdx] = useState<number | null>(null);

  const handleStageDragStart = (i: number) => setStageDragIdx(i);
  const handleStageDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    if (stageDragIdx === null || stageDragIdx === i) return;
    reorderHiringStages(stageDragIdx, i);
    setStageDragIdx(i);
  };
  const handleStageDragEnd = () => setStageDragIdx(null);

  const handleRemoveStage = (id: string) => {
    if (hiringStages.length <= 2) {
      toast.error("Pipeline must have at least 2 stages");
      return;
    }
    removeHiringStage(id);
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-muted-foreground mb-1">
          Define the interview pipeline for this job. Stages can be reordered by dragging.
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
              stageDragIdx === i && "opacity-50 border-dashed"
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
              className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
              onClick={() => handleRemoveStage(stage.id)}
              title="Delete stage"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            <Settings className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />
          </div>
        ))}
      </div>

      <Button
        variant="outline"
        size="sm"
        className="h-9 text-xs gap-1.5 w-full sm:w-auto"
        onClick={addHiringStage}
      >
        <Plus className="h-3.5 w-3.5" /> Add Stage
      </Button>
    </div>
  );
}

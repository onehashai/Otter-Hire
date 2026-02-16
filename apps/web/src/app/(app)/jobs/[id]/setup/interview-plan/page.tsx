"use client";

import { Button, InputField, Label, SelectField } from "@onehash/ui";
import { GripVertical, Plus, X } from "lucide-react";
import { useJobSetup } from "../context";

export default function InterviewPlanPage() {
  const { stages, addStage, removeStage, updateStage } = useJobSetup();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-muted-foreground">Interview Stages</Label>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={addStage}>
          <Plus className="h-3 w-3" /> Add Stage
        </Button>
      </div>
      <div className="space-y-2">
        {stages.map((stage, i) => (
          <div
            key={i}
            className="flex items-center gap-2 rounded-lg border border-border bg-card p-3"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground/50 shrink-0 cursor-grab" />
            <span className="text-xs font-medium text-muted-foreground w-5 shrink-0">{i + 1}</span>
            <InputField
              value={stage.name}
              onChange={(e) => updateStage(i, "name", e.target.value)}
              placeholder="Stage name"
              className="h-8 text-sm flex-1"
            />
            <SelectField
              label="Interviewer"
              value={stage.interviewer}
              onValueChange={(v) => updateStage(i, "interviewer", v)}
              options={["Jane Doe", "John Smith", "Sarah Lee", "Mike Chen"].map((m) => ({ value: m, label: m }))}
              placeholder="Interviewer"
              className="w-36 shrink-0 [&_button]:h-8 [&_button]:text-sm"
            />
            {stages.length > 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => removeStage(i)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

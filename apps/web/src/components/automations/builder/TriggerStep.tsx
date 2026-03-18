"use client";

import { Button } from "@onehash/ui/button";
import { Label } from "@onehash/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@onehash/ui/select";
import { FieldRow } from "./FieldRow";
import { triggerOptions, stages, type TriggerOption } from "./types";

export interface TriggerStepProps {
  selectedTrigger: string;
  triggerStage: string;
  currentTrigger: TriggerOption | undefined;
  onSelectedTriggerChange: (value: string) => void;
  onTriggerStageChange: (value: string) => void;
}

export function TriggerStep({
  selectedTrigger,
  triggerStage,
  currentTrigger,
  onSelectedTriggerChange,
  onTriggerStageChange,
}: TriggerStepProps) {
  return (
    <div className="p-4 space-y-4">
      <p className="text-xs text-muted-foreground">Select what triggers this automation.</p>
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground">
          Candidate triggers
        </Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {triggerOptions.map((tr) => (
                <Button
                  key={tr.id}
                  type="button"
                  variant={selectedTrigger === tr.id ? "default" : "outline"}
                  size="sm"
                  className="h-9 text-xs justify-start"
                  onClick={() => onSelectedTriggerChange(tr.id)}
                >
                  {tr.label}
                </Button>
              ))}
            </div>
          </div>

      {currentTrigger?.hasStageSelect && (
        <FieldRow label="Select Stage">
          <Select value={triggerStage} onValueChange={onTriggerStageChange}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Choose stage" />
            </SelectTrigger>
            <SelectContent>
              {stages.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldRow>
      )}
    </div>
  );
}

"use client";

import { Button } from "@onehash/ui/button";
import { InputField } from "@onehash/ui/input";
import { Label } from "@onehash/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@onehash/ui/select";
import { FieldRow } from "./FieldRow";
import {
  triggerOptions,
  stages,
  type TriggerOption,
  type TriggerCategory,
} from "./types";

export interface TriggerStepProps {
  selectedTrigger: string;
  triggerStage: string;
  triggerDays: string;
  currentTrigger: TriggerOption | undefined;
  onSelectedTriggerChange: (value: string) => void;
  onTriggerStageChange: (value: string) => void;
  onTriggerDaysChange: (value: string) => void;
}

export function TriggerStep({
  selectedTrigger,
  triggerStage,
  triggerDays,
  currentTrigger,
  onSelectedTriggerChange,
  onTriggerStageChange,
  onTriggerDaysChange,
}: TriggerStepProps) {
  return (
    <div className="p-4 space-y-4">
      <p className="text-xs text-muted-foreground">
        Select what triggers this automation.
      </p>
      {(["candidate", "job", "time-based"] as TriggerCategory[]).map(
        (cat) => {
          const options = triggerOptions.filter((tr) => tr.category === cat);
          return (
            <div key={cat} className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground capitalize">
                {cat === "time-based" ? "Time-Based" : cat} triggers
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {options.map((tr) => (
                  <Button
                    key={tr.id}
                    type="button"
                    variant={
                      selectedTrigger === tr.id ? "default" : "outline"
                    }
                    size="sm"
                    className="h-9 text-xs justify-start"
                    onClick={() => onSelectedTriggerChange(tr.id)}
                  >
                    {tr.label}
                  </Button>
                ))}
              </div>
            </div>
          );
        }
      )}

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
      {currentTrigger?.hasDaysInput && (
        <FieldRow label="Number of days">
          <InputField
            type="number"
            value={triggerDays}
            onChange={(e) => onTriggerDaysChange(e.target.value)}
            className="h-9 text-sm w-32"
            min={1}
          />
        </FieldRow>
      )}
    </div>
  );
}

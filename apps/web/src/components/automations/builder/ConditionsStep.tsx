"use client";

import { Button } from "@onehash/ui/button";
import { InputField } from "@onehash/ui/input";
import { Label } from "@onehash/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@onehash/ui/select";
import { Plus, X } from "lucide-react";
import { conditionFields, conditionOperators } from "./types";
import type { Condition } from "./types";

export interface ConditionsStepProps {
  conditions: Condition[];
  conditionLogic: "and" | "or";
  onConditionLogicChange: (value: "and" | "or") => void;
  onAddCondition: () => void;
  onUpdateCondition: (id: string, field: string, value: string) => void;
  onRemoveCondition: (id: string) => void;
}

export function ConditionsStep({
  conditions,
  conditionLogic,
  onConditionLogicChange,
  onAddCondition,
  onUpdateCondition,
  onRemoveCondition,
}: ConditionsStepProps) {
  return (
    <div className="p-4 space-y-4">
      <p className="text-xs text-muted-foreground">
        Add conditions to narrow when this automation runs.
      </p>

      {conditions.length > 1 && (
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Match</Label>
          <div className="flex gap-1">
            {(["and", "or"] as const).map((l) => (
              <Button
                key={l}
                type="button"
                variant={conditionLogic === l ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs uppercase px-3"
                onClick={() => onConditionLogicChange(l)}
              >
                {l}
              </Button>
            ))}
          </div>
          <Label className="text-xs text-muted-foreground">of the following</Label>
        </div>
      )}

      {conditions.map((c) => (
        <div key={c.id} className="flex items-center gap-2 flex-wrap">
          <Select value={c.field} onValueChange={(v) => onUpdateCondition(c.id, "field", v)}>
            <SelectTrigger className="h-8 text-xs w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {conditionFields.map((f) => (
                <SelectItem key={f.value} value={f.value} className="text-xs">
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={c.operator} onValueChange={(v) => onUpdateCondition(c.id, "operator", v)}>
            <SelectTrigger className="h-8 text-xs w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {conditionOperators.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xs">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <InputField
            value={c.value}
            onChange={(e) => onUpdateCondition(c.id, "value", e.target.value)}
            className="h-8 text-xs w-[120px]"
            placeholder="Value"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => onRemoveCondition(c.id)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="text-xs gap-1.5"
        onClick={onAddCondition}
      >
        <Plus className="h-3 w-3" /> Add condition
      </Button>
    </div>
  );
}

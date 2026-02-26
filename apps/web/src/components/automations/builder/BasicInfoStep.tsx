"use client";

import { Button } from "@onehash/ui/button";
import { InputField } from "@onehash/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@onehash/ui/select";
import { FieldRow } from "./FieldRow";
import type { Scope } from "./types";

export interface BasicInfoStepProps {
  name: string;
  scope: Scope;
  selectedJob: string;
  onNameChange: (value: string) => void;
  onScopeChange: (value: Scope) => void;
  onSelectedJobChange: (value: string) => void;
}

export function BasicInfoStep({
  name,
  scope,
  selectedJob,
  onNameChange,
  onScopeChange,
  onSelectedJobChange,
}: BasicInfoStepProps) {
  return (
    <div className="p-4 space-y-4">
      <FieldRow label="Automation Name">
        <InputField
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="e.g. Auto-reject unqualified"
          className="h-9 text-sm"
        />
      </FieldRow>
      <FieldRow label="Scope">
        <div className="flex gap-1.5">
          {(
            [
              { value: "all", label: "All jobs" },
              { value: "specific_job", label: "Specific job" },
              { value: "specific_pipeline", label: "Specific pipeline" },
            ] as const
          ).map((s) => (
            <Button
              key={s.value}
              type="button"
              variant={scope === s.value ? "default" : "outline"}
              size="sm"
              className="flex-1 h-9 text-xs"
              onClick={() => onScopeChange(s.value)}
            >
              {s.label}
            </Button>
          ))}
        </div>
      </FieldRow>
      {scope === "specific_job" && (
        <FieldRow label="Select Job">
          <Select value={selectedJob} onValueChange={onSelectedJobChange}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Choose a job" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="frontend">Senior Frontend Engineer</SelectItem>
              <SelectItem value="designer">Product Designer</SelectItem>
              <SelectItem value="data">Data Scientist</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
      )}
    </div>
  );
}

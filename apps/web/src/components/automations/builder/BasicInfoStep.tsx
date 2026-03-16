"use client";

import { useEffect, useState } from "react";
import { Button } from "@onehash/ui/button";
import { InputField } from "@onehash/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@onehash/ui/select";
import { FieldRow } from "./FieldRow";
import { getJobs } from "@/api/job";
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
  const [jobs, setJobs] = useState<{ id: string; title: string }[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);

  useEffect(() => {
    if (scope !== "specific_job") return;
    let cancelled = false;
    setJobsLoading(true);
    getJobs()
      .then((list) => {
        if (!cancelled) {
          setJobs(list.map((j) => ({ id: j.id, title: j.title })));
        }
      })
      .catch(() => {
        if (!cancelled) setJobs([]);
      })
      .finally(() => {
        if (!cancelled) setJobsLoading(false);
      });
    return () => { cancelled = true; };
  }, [scope]);

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
              <SelectValue placeholder={jobsLoading ? "Loading jobs..." : "Choose a job"} />
            </SelectTrigger>
            <SelectContent>
              {jobs.map((j) => (
                <SelectItem key={j.id} value={j.id}>
                  {j.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldRow>
      )}
    </div>
  );
}

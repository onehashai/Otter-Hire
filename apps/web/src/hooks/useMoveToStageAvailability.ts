"use client";

import { useEffect, useState } from "react";
import { getJobs, getJobPipeline } from "@/api/job";
import type { Scope } from "@/components/automations/builder/types";

export interface MoveToStageAvailability {
  disabled: boolean;
  reason: string | null;
  loading: boolean;
}

/**
 * When scope is "all", Move to stage should be disabled if the org has multiple
 * jobs and those jobs do not all have the same pipeline stages.
 */
export function useMoveToStageAvailability(
  scope: Scope,
  selectedJob: string,
): MoveToStageAvailability {
  const [disabled, setDisabled] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (scope !== "all") {
      setDisabled(false);
      setReason(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setDisabled(false);
    setReason(null);

    (async () => {
      try {
        const jobs = await getJobs();
        if (cancelled) return;

        if (jobs.length <= 1) {
          setDisabled(false);
          setReason(null);
          return;
        }

        const pipelines = await Promise.all(
          jobs.map((j) => getJobPipeline(j.id).catch(() => null)),
        );
        if (cancelled) return;

        const validPipelines = pipelines.filter(
          (p): p is NonNullable<typeof p> => p != null && p.stages?.length > 0,
        );
        if (validPipelines.length === 0) {
          setDisabled(false);
          return;
        }

        const stageKeys = validPipelines.map((p) =>
          p.stages
            .sort((a, b) => a.position - b.position)
            .map((s) => s.name)
            .join("|"),
        );
        const firstKey = stageKeys[0];
        const allSame = stageKeys.every((k) => k === firstKey);

        if (!allSame) {
          setDisabled(true);
          setReason("Move to stage is unavailable when jobs have different pipeline stages.");
        } else {
          setDisabled(false);
          setReason(null);
        }
      } catch {
        if (!cancelled) {
          setDisabled(false);
          setReason(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [scope, selectedJob]);

  return { disabled, reason, loading };
}

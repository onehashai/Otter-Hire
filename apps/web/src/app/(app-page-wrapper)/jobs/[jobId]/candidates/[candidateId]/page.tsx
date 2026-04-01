"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { getCandidateById } from "@/api/candidates";

export default function JobCandidateProfilePage() {
  const router = useRouter();
  const params = useParams();
  const jobId = params?.jobId as string | undefined;
  const candidateId = params?.candidateId as string | undefined;

  useEffect(() => {
    if (!jobId || !candidateId) return;
    let cancelled = false;
    (async () => {
      try {
        const candidate = await getCandidateById(candidateId);
        if (cancelled) return;
        const assignmentStageId =
          candidate.assignments?.find((a) => a.job_id === jobId)?.stage_id ?? candidate.stage_id;
        if (assignmentStageId) {
          router.replace(
            `/jobs/${encodeURIComponent(jobId)}/stage/${encodeURIComponent(assignmentStageId)}/candidates/${encodeURIComponent(candidateId)}`,
          );
          return;
        }
        router.replace(`/jobs/${encodeURIComponent(jobId)}`);
      } catch {
        if (!cancelled) router.replace(`/jobs/${encodeURIComponent(jobId)}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId, candidateId, router]);

  return null;
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@onehash/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { getJobPipeline, type JobPipelineResponse, updateCandidateStage } from "@/api";
import { PipelineBoard, type PipelineJob } from "@/components/pipeline/PipelineBoard";

export default function PipelineJobPage() {
  const params = useParams();
  const router = useRouter();
  const isMobile = useIsMobile();
  const id = params?.id as string | undefined;

  const [pipeline, setPipeline] = useState<JobPipelineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError("Job not found.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getJobPipeline(id);
        if (!cancelled) {
          setPipeline(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load pipeline.");
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
  }, [id]);

  const job = useMemo<PipelineJob | null>(() => {
    if (!pipeline) return null;
    return {
      id: pipeline.id,
      title: pipeline.title,
      status: pipeline.status as PipelineJob["status"],
      stages: pipeline.stages.map((stage) => ({
        id: stage.id,
        name: stage.name,
        position: stage.position,
      })),
      candidates: pipeline.candidates.map((candidate) => ({
        id: candidate.id,
        name: candidate.name,
        email: candidate.email,
        stageId: candidate.stage_id ?? "",
      })),
    };
  }, [pipeline]);

  const handleCandidateClick = (candidateId: string) => {
    if (id) {
      router.push(`/candidates/${candidateId}?from=pipeline&jobId=${id}`);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading pipeline...</p>;
  }

  if (!id || !job || error) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{error ?? "Job not found."}</p>
        <Button variant="outline" size="sm" onClick={() => router.push("/jobs")}>
          Back to Jobs
        </Button>
      </div>
    );
  }

  return (
    <PipelineBoard
      job={job}
      onBack={() => router.push("/jobs")}
      isMobile={isMobile}
      onMoveCandidate={async (candidateId, stageId) => {
        await updateCandidateStage(candidateId, stageId);
      }}
      onCandidateClick={handleCandidateClick}
    />
  );
}

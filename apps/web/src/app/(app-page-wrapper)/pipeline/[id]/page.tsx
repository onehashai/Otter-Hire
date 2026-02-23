"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@onehash/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { pipelineJobs } from "../data";
import { PipelineBoard } from "@/components/pipeline/PipelineBoard";

export default function PipelineJobPage() {
  const params = useParams();
  const router = useRouter();
  const isMobile = useIsMobile();
  const id = params?.id as string | undefined;

  const job = id ? pipelineJobs.find((j) => j.id === id) ?? null : null;

  const handleSwitchJob = (newId: string) => {
    router.push(`/pipeline/${newId}`);
  };

  if (!id || !job) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Job not found.</p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/pipeline">Back to Pipeline</Link>
        </Button>
      </div>
    );
  }

  return (
    <PipelineBoard
      job={job}
      allJobs={pipelineJobs}
      onBack={() => router.push("/pipeline")}
      onSwitchJob={handleSwitchJob}
      isMobile={isMobile}
    />
  );
}

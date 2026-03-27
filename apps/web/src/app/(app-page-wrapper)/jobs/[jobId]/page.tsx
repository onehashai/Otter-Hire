"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@onehash/ui/button";
import { getJobWorkspace } from "@/api";
import { getDefaultStageId } from "@/lib/job-workspace";

export default function JobWorkspaceEntryPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params?.jobId as string | undefined;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;

    (async () => {
      try {
        const data = await getJobWorkspace(jobId);
        if (cancelled) return;
        const def = getDefaultStageId(data.stages);
        if (def) {
          router.replace(`/jobs/${encodeURIComponent(jobId)}/stage/${encodeURIComponent(def)}`);
        } else if (!cancelled) {
          setError("No stages configured for this job.");
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load job.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [jobId, router]);

  if (error) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/jobs">Back to Jobs</Link>
        </Button>
      </div>
    );
  }

  return <p className="text-sm text-muted-foreground">Loading…</p>;
}

"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getJobById } from "@/api";
import { useSetPageMetadata } from "@/hooks/useSetPageMetadata";

export default function JobCandidateStandaloneLayout({ children }: { children: ReactNode }) {
  const params = useParams();
  const jobId = params?.jobId as string | undefined;
  const [jobTitle, setJobTitle] = useState("");

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    (async () => {
      try {
        const job = await getJobById(jobId);
        if (!cancelled) setJobTitle(job.title ?? "");
      } catch {
        if (!cancelled) setJobTitle("");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  useSetPageMetadata({
    title: jobTitle,
    subtitle: "Edit and manage candidates and jobs seamlessly in one place",
  });
  return <>{children}</>;
}

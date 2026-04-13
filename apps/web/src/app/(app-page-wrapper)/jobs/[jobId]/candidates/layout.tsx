"use client";

import type { ReactNode } from "react";
import { useSetPageMetadata } from "@/hooks/useSetPageMetadata";
import { JOB_WORKSPACE_PAGE_SUBTITLE, JOB_WORKSPACE_PAGE_TITLE } from "@/lib/job-page-metadata";

export default function JobCandidateStandaloneLayout({ children }: { children: ReactNode }) {
  useSetPageMetadata({
    title: JOB_WORKSPACE_PAGE_TITLE,
    subtitle: JOB_WORKSPACE_PAGE_SUBTITLE,
  });
  return <>{children}</>;
}

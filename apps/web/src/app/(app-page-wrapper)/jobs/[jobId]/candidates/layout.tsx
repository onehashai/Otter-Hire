"use client";

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useSetPageMetadata } from "@/hooks/useSetPageMetadata";

export default function JobCandidateStandaloneLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  useSetPageMetadata({
    title: t("job_candidate_edit_title"),
    subtitle: t("job_candidate_edit_subtitle"),
  });
  return <>{children}</>;
}

"use client";

import type { ReactNode } from "react";
import { useSetPageMetadata } from "@/hooks/useSetPageMetadata";
import { useTranslation } from "react-i18next";

export default function JobCandidateStandaloneLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  useSetPageMetadata({
    title: t("edit_candidates_title"),
    subtitle: t("edit_candidates_subtitle"),
  });
  return <>{children}</>;
}

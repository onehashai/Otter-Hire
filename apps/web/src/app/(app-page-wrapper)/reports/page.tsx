"use client";

import { useTranslation } from "react-i18next";
import { EmptyCard } from "@onehash/ui/card";
import { useSetPageMetadata } from "@/hooks/useSetPageMetadata";

export default function ReportsPage() {
  const { t } = useTranslation();

  useSetPageMetadata({
    title: t("reports_title"),
    subtitle: t("reports_subtitle"),
  });

  return (
    <EmptyCard
      icon="ScrollText"
      title={t("coming_soon")}
      description={t("coming_soon_description")}
      className="min-h-[320px]"
    />
  );
}

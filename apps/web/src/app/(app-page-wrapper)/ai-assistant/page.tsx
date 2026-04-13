"use client";

import { useTranslation } from "react-i18next";
import { EmptyCard } from "@onehash/ui/card";
import { useSetPageMetadata } from "@/hooks/useSetPageMetadata";

export default function AIAssistantPage() {
  const { t } = useTranslation();

  useSetPageMetadata({
    title: t("ai_assistant_title"),
    subtitle: t("ai_assistant_subtitle"),
  });

  return (
    <EmptyCard
      icon="Sparkles"
      title={t("coming_soon")}
      description={t("coming_soon_description")}
      className="min-h-[320px]"
    />
  );
}

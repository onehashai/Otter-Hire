"use client";

import { useTranslation } from "react-i18next";
import { useSetPageMetadata } from "@/hooks/useSetPageMetadata";
import { ConversationsView } from "@/components/conversations/ConversationsView";

export default function ConversationsPage() {
  const { t } = useTranslation();

  useSetPageMetadata({
    title: t("conversations_title"),
    subtitle: t("conversations_subtitle"),
  });

  return <ConversationsView />;
}

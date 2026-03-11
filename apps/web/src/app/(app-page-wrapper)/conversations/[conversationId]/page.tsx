"use client";

import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useSetPageMetadata } from "@/hooks/useSetPageMetadata";
import { ConversationsView } from "@/components/conversation/ConversationsView";

export default function ConversationPage() {
  const { t } = useTranslation();
  const { conversationId } = useParams<{ conversationId: string }>();

  useSetPageMetadata({
    title: t("conversations_title"),
    subtitle: t("conversations_subtitle"),
  });

  return <ConversationsView initialId={conversationId} />;
}

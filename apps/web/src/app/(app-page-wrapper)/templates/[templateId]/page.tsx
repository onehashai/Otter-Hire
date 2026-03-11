"use client";

import TemplateEditor from "@/components/templates/TemplateEditor";
import { useSetPageMetadata } from "@/hooks/useSetPageMetadata";
import { useTranslation } from "react-i18next";

export default function TemplatePage() {
  const { t } = useTranslation();
  useSetPageMetadata({
    title: t("edit_template_title"),
    subtitle: t("edit_template_subtitle"),
  });
  return <TemplateEditor />;
}

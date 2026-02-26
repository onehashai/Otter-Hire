"use client";

import { Button } from "@onehash/ui/button";
import { Label } from "@onehash/ui/label";
import { RichTextEditor } from "@onehash/ui/editor";
import { Sparkles } from "lucide-react";
import { useJobSetup } from "../context";
import { useTranslation } from "react-i18next";

export default function JobDescriptionPage() {
  const { description, setDescription, setAiSheetOpen } = useJobSetup();
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-muted-foreground">{t("job_description")}</Label>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={() => setAiSheetOpen(true)}
        >
          <Sparkles className="h-3 w-3" />
          {t("ai_assist")}
        </Button>
      </div>
      <RichTextEditor content={description} onChange={setDescription} />
    </div>
  );
}

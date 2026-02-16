"use client";

import { Button, InputField, Label, Separator, Switch } from "@onehash/ui";
import { Plus, X } from "lucide-react";
import { useJobSetup } from "../context";
import { useTranslation } from "react-i18next";

export default function ApplicationFormPage() {
  const { t } = useTranslation();
  const {
    collectResume,
    setCollectResume,
    collectCover,
    setCollectCover,
    screeningQuestions,
    newQuestion,
    setNewQuestion,
    addQuestion,
    removeQuestion,
  } = useJobSetup();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between py-1">
        <div>
          <p className="text-sm font-medium">{t("resume")}</p>
          <p className="text-xs text-muted-foreground">{t("require_candidates_to_upload_a_resume")}</p>
        </div>
        <Switch checked={collectResume} onCheckedChange={setCollectResume} />
      </div>
      <Separator />
      <div className="flex items-center justify-between py-1">
        <div>
          <p className="text-sm font-medium">Cover Letter</p>
          <p className="text-xs text-muted-foreground">Optionally collect a cover letter</p>
        </div>
        <Switch checked={collectCover} onCheckedChange={setCollectCover} />
      </div>
      <Separator />
      <div className="space-y-3">
        <Label className="text-xs font-medium text-muted-foreground">Screening Questions</Label>
        {screeningQuestions.map((q, i) => (
          <div
            key={i}
            className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2"
          >
            <span className="text-sm flex-1">{q}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={() => removeQuestion(i)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        <div className="flex gap-2">
          <InputField
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            placeholder="Add a screening question..."
            className="h-9 text-sm flex-1"
            onKeyDown={(e) => e.key === "Enter" && addQuestion()}
          />
          <Button variant="outline" size="sm" className="h-9 text-xs shrink-0" onClick={addQuestion}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

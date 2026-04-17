"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@onehash/ui/button";
import { InputField } from "@onehash/ui/input";
import { Label } from "@onehash/ui/label";
import { Separator } from "@onehash/ui/separator";
import { Switch } from "@onehash/ui/switch";
import { Badge } from "@onehash/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@onehash/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@onehash/ui/dialog";
import { Checkbox } from "@onehash/ui/checkbox";
import {
  Plus,
  X,
  GripVertical,
  Pencil,
  Trash2,
  FileText,
  Upload,
  User,
  Mail,
  Phone,
  Palette,
  Linkedin,
  Github,
  Link2,
  ChevronDown,
} from "lucide-react";
import { SelectField } from "@onehash/ui/select";
import { toast } from "@onehash/ui/sonner";
import { generateId } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  DEFAULT_APPLICATION_FORM_DRAFT,
  type ApplicationQuestionAnswerType,
  useJobSetup,
} from "../context";
import { useTranslation } from "react-i18next";
import { useIsMobile } from "@/hooks/use-mobile";

/* ───── types ───── */
type FieldVisibility = "required" | "optional" | "hidden";

interface DefaultLinkField {
  key: string;
  platform: string;
  icon: React.ReactNode;
  visibility: FieldVisibility;
}

type AnswerType = ApplicationQuestionAnswerType;

interface CustomQuestion {
  id: string;
  title: string;
  answerType: AnswerType;
  required: boolean;
  options?: string[];
  allowOther?: boolean;
}

const answerTypeKeys: Record<AnswerType, string> = {
  short_text: "answer_type_short_text",
  long_text: "answer_type_long_text",
  single_select: "answer_type_single_select",
  multi_select: "answer_type_multi_select",
  yes_no: "answer_type_yes_no",
  file_upload: "answer_type_file_upload",
  url: "answer_type_url",
  number: "answer_type_number",
  date: "answer_type_date",
};

const defaultLinkFields: DefaultLinkField[] = [
  {
    key: "profile_link_linkedin",
    platform: "LinkedIn",
    icon: <Linkedin className="h-4 w-4" />,
    visibility: "optional",
  },
  {
    key: "profile_link_github",
    platform: "GitHub",
    icon: <Github className="h-4 w-4" />,
    visibility: "optional",
  },
  {
    key: "profile_link_portfolio",
    platform: "Portfolio / Personal Website",
    icon: <Link2 className="h-4 w-4" />,
    visibility: "optional",
  },
  {
    key: "profile_link_twitter_x",
    platform: "Twitter / X",
    icon: <FileText className="h-4 w-4" />,
    visibility: "hidden",
  },
  {
    key: "profile_link_dribbble",
    platform: "Dribbble",
    icon: <Palette className="h-4 w-4" />,
    visibility: "hidden",
  },
  {
    key: "profile_link_behance",
    platform: "Behance",
    icon: <Palette className="h-4 w-4" />,
    visibility: "hidden",
  },
];

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const entries = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`);
  return `{${entries.join(",")}}`;
}

function VisibilityDropdown({
  value,
  onChange,
  locked,
}: {
  value: FieldVisibility;
  onChange: (v: FieldVisibility) => void;
  locked?: boolean;
}) {
  const { t } = useTranslation();
  const options = [
    { value: "required", label: t("visibility_required") },
    { value: "optional", label: t("visibility_optional") },
    { value: "hidden", label: t("visibility_hidden") },
  ] as const;
  const label = options.find((o) => o.value === value)?.label ?? value;

  if (locked) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled
        className="h-9 justify-between px-3 font-normal pointer-events-none w-[7rem] shrink-0"
      >
        <span className="truncate">{label}</span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
      </Button>
    );
  }
  return (
    <SelectField
      label={undefined}
      className="w-[7rem] shrink-0"
      value={value}
      onValueChange={(v) => onChange(v as FieldVisibility)}
      options={[...options]}
    />
  );
}

export default function ApplicationFormPage() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const {
    collectResume,
    setCollectResume,
    collectCover,
    setCollectCover,
    applicationFormSchema,
    setApplicationFormSchema,
    applicationFormDraft,
    setApplicationFormDraft,
  } = useJobSetup();
  const draft = applicationFormDraft ?? DEFAULT_APPLICATION_FORM_DRAFT;

  const parsedSchema = useMemo(() => {
    const schema = (applicationFormSchema ?? {}) as Record<string, unknown>;
    const defaults = (schema.default_fields ?? {}) as Record<
      string,
      { visibility?: FieldVisibility }
    >;
    const profileLinks = Array.isArray(schema.profile_links)
      ? (schema.profile_links as Array<Record<string, unknown>>)
      : [];
    const custom = Array.isArray(schema.custom_fields)
      ? (schema.custom_fields as Array<Record<string, unknown>>)
      : [];
    return { defaults, profileLinks, custom };
  }, [applicationFormSchema]);

  /* ───── application form state ───── */
  const [phoneVisibility, setPhoneVisibility] = useState<FieldVisibility>("optional");
  const [resumeVisibility, setResumeVisibility] = useState<FieldVisibility>(
    collectResume ? "required" : "hidden",
  );
  const [coverLetterVisibility, setCoverLetterVisibility] = useState<FieldVisibility>(
    collectCover ? "optional" : "hidden",
  );
  const [linkFields, setLinkFields] = useState<DefaultLinkField[]>(() =>
    defaultLinkFields.map((l) => ({ ...l })),
  );
  const [customQuestions, setCustomQuestions] = useState<CustomQuestion[]>([]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const initializedFromSchemaRef = useRef(false);

  const editingQuestion = useMemo(
    () => customQuestions.find((q) => q.id === draft.editingQuestionId) ?? null,
    [draft.editingQuestionId, customQuestions],
  );

  const setLinkVisibility = (idx: number, val: FieldVisibility) => {
    setLinkFields((prev) => prev.map((l, i) => (i === idx ? { ...l, visibility: val } : l)));
  };

  const openAddQuestion = () => {
    setApplicationFormDraft((prev) => ({
      ...prev,
      questionDialogOpen: true,
      editingQuestionId: null,
      qTitle: "",
      qType: "short_text",
      qRequired: false,
      qOptions: ["", ""],
      qAllowOther: false,
    }));
  };

  const openEditQuestion = (q: CustomQuestion) => {
    setApplicationFormDraft((prev) => ({
      ...prev,
      questionDialogOpen: true,
      editingQuestionId: q.id,
      qTitle: q.title,
      qType: q.answerType,
      qRequired: q.required,
      qOptions: q.options?.length ? [...q.options] : ["", ""],
      qAllowOther: q.allowOther ?? false,
    }));
  };

  const saveQuestion = () => {
    if (!draft.qTitle.trim()) return;
    const hasOptions = draft.qType === "single_select" || draft.qType === "multi_select";
    const finalOptions = hasOptions ? draft.qOptions.filter((o) => o.trim()) : undefined;
    if (hasOptions && (!finalOptions || finalOptions.length < 2)) {
      toast.error(t("add_at_least_2_options"));
      return;
    }
    if (editingQuestion) {
      setCustomQuestions((prev) =>
        prev.map((q) =>
          q.id === editingQuestion.id
            ? {
                ...q,
                title: draft.qTitle.trim(),
                answerType: draft.qType,
                required: draft.qRequired,
                options: finalOptions,
                allowOther: draft.qAllowOther,
              }
            : q,
        ),
      );
    } else {
      setCustomQuestions((prev) => [
        ...prev,
        {
          id: generateId(),
          title: draft.qTitle.trim(),
          answerType: draft.qType,
          required: draft.qRequired,
          options: finalOptions,
          allowOther: draft.qAllowOther,
        },
      ]);
    }
    setApplicationFormDraft((prev) => ({
      ...prev,
      questionDialogOpen: false,
      editingQuestionId: null,
    }));
  };

  const deleteQuestion = (id: string) => {
    setCustomQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  const handleQuestionDragStart = (i: number) => setDragIdx(i);
  const handleQuestionDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === i) return;
    const reordered = [...customQuestions];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(i, 0, moved);
    setCustomQuestions(reordered);
    setDragIdx(i);
  };
  const handleQuestionDragEnd = () => setDragIdx(null);

  /* Cover letter visibility sync with context (optional/hidden drives collectCover) */
  const effectiveCoverVisibility = collectCover
    ? coverLetterVisibility === "hidden"
      ? "optional"
      : coverLetterVisibility
    : "hidden";
  const setCoverVisibilityAndContext = (v: FieldVisibility) => {
    setCoverLetterVisibility(v);
    setCollectCover(v !== "hidden");
  };

  useEffect(() => {
    if (initializedFromSchemaRef.current) return;
    const phone = parsedSchema.defaults.phone?.visibility;
    const resume = parsedSchema.defaults.resume?.visibility;
    const cover = parsedSchema.defaults.cover_letter?.visibility;
    if (phone) setPhoneVisibility(phone);
    if (resume) setResumeVisibility(resume);
    if (cover) setCoverLetterVisibility(cover);

    const linkMap = new Map<string, FieldVisibility>();
    const questionFields: Array<Record<string, unknown>> = [];

    for (const field of parsedSchema.profileLinks) {
      const key = String(field.key ?? field.id ?? "");
      const visibility = (field.visibility as FieldVisibility | undefined) ?? "hidden";
      if (key) linkMap.set(key, visibility);
    }

    // Backward compatibility: older schema versions may have profile links inside custom_fields.
    for (const field of parsedSchema.custom) {
      const key = String(field.key ?? field.id ?? "");
      const visibility = (field.visibility as FieldVisibility | undefined) ?? "hidden";
      if (key.startsWith("profile_link_")) {
        linkMap.set(key, visibility);
        continue;
      }
      questionFields.push(field);
    }

    setLinkFields(
      defaultLinkFields.map((field) => ({
        ...field,
        visibility: linkMap.get(field.key) ?? field.visibility,
      })),
    );

    if (questionFields.length > 0) {
      const nextCustom = questionFields.map((field, idx) => ({
        id: String(field.id ?? `custom_${idx + 1}`),
        title: String(field.label ?? `Question ${idx + 1}`),
        answerType: (field.type as AnswerType) ?? "short_text",
        required: field.visibility === "required",
        options: Array.isArray(field.options) ? (field.options as string[]) : undefined,
        allowOther: Boolean(field.allowOther ?? false),
      }));
      setCustomQuestions(nextCustom);
    }
    initializedFromSchemaRef.current = true;
  }, [parsedSchema]);

  useEffect(() => {
    const linkFieldsSchema = linkFields.map((link) => ({
      id: link.key,
      key: link.key,
      label: link.platform,
      type: "url",
      visibility: link.visibility,
    }));
    const questionFieldsSchema = customQuestions.map((q) => ({
      id: q.id,
      key: q.id,
      label: q.title,
      type: q.answerType,
      visibility: q.required ? "required" : "optional",
      ...(q.options && q.options.length > 0 ? { options: q.options } : {}),
      ...(q.allowOther ? { allowOther: true } : {}),
    }));
    const schema = {
      version: 1,
      default_fields: {
        full_name: { visibility: "required", label: "Full Name" },
        email: { visibility: "required", label: "Email" },
        phone: { visibility: phoneVisibility, label: "Phone Number" },
        resume: { visibility: resumeVisibility, label: "Resume" },
        cover_letter: { visibility: effectiveCoverVisibility, label: "Cover Letter" },
      },
      profile_links: linkFieldsSchema,
      custom_fields: questionFieldsSchema,
    };
    const next = stableStringify(schema);
    const current = stableStringify(applicationFormSchema ?? {});
    if (next !== current) {
      setApplicationFormSchema(schema);
    }
  }, [
    phoneVisibility,
    resumeVisibility,
    effectiveCoverVisibility,
    linkFields,
    customQuestions,
    applicationFormSchema,
    setApplicationFormSchema,
  ]);

  const renderQuestionFormFields = () => {
    const showOptions = draft.qType === "single_select" || draft.qType === "multi_select";
    return (
      <>
        <InputField
          label={t("question_title_label")}
          value={draft.qTitle}
          onChange={(e) => setApplicationFormDraft((prev) => ({ ...prev, qTitle: e.target.value }))}
          placeholder={t("question_title_placeholder")}
          className="h-9 text-sm"
        />
        <SelectField
          label={t("answer_type_label")}
          value={draft.qType}
          onValueChange={(v) =>
            setApplicationFormDraft((prev) => ({ ...prev, qType: v as AnswerType }))
          }
          options={(Object.keys(answerTypeKeys) as AnswerType[]).map((val) => ({
            value: val,
            label: t(answerTypeKeys[val]),
          }))}
        />
        {showOptions && (
          <div className="space-y-2">
            {draft.qOptions.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}</span>
                <InputField
                  value={opt}
                  onChange={(e) => {
                    const next = [...draft.qOptions];
                    next[i] = e.target.value;
                    setApplicationFormDraft((prev) => ({ ...prev, qOptions: next }));
                  }}
                  placeholder={t("option_n", { n: i + 1 })}
                  className="h-8 text-sm flex-1"
                />
                {draft.qOptions.length > 2 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() =>
                      setApplicationFormDraft((prev) => ({
                        ...prev,
                        qOptions: prev.qOptions.filter((_, idx) => idx !== i),
                      }))
                    }
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() =>
                setApplicationFormDraft((prev) => ({ ...prev, qOptions: [...prev.qOptions, ""] }))
              }
            >
              <Plus className="h-3 w-3" /> {t("add_option")}
            </Button>
            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                checked={draft.qAllowOther}
                onCheckedChange={(v) =>
                  setApplicationFormDraft((prev) => ({ ...prev, qAllowOther: !!v }))
                }
                id="allow-other"
              />
              <Label htmlFor="allow-other" className="text-xs text-muted-foreground cursor-pointer">
                {t("allow_other_answer")}
              </Label>
            </div>
          </div>
        )}
        <Separator />
        <div className="flex items-center justify-between py-1">
          <Label>{t("required_field_toggle")}</Label>
          <Switch
            checked={draft.qRequired}
            onCheckedChange={(v) =>
              setApplicationFormDraft((prev) => ({ ...prev, qRequired: !!v }))
            }
          />
        </div>
      </>
    );
  };

  return (
    <div className="space-y-6">
      {/* ── Default Fields ── */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          {t("default_fields_section")}
        </h3>
        <div className="space-y-0 rounded-lg border border-border overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-card">
            <div className="flex items-center gap-3">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{t("full_name_field")}</span>
            </div>
            <VisibilityDropdown value="required" onChange={() => {}} locked />
          </div>
          <Separator />
          <div className="flex items-center justify-between px-4 py-3 bg-card">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{t("email_field")}</span>
            </div>
            <VisibilityDropdown value="required" onChange={() => {}} locked />
          </div>
          <Separator />
          <div className="flex items-center justify-between px-4 py-3 bg-card">
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{t("phone_number_field")}</span>
            </div>
            <VisibilityDropdown value={phoneVisibility} onChange={setPhoneVisibility} />
          </div>
          <Separator />
          <div className="flex items-center justify-between px-4 py-3 bg-card">
            <div className="flex items-center gap-3">
              <Upload className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{t("resume_upload_field")}</span>
            </div>
            <VisibilityDropdown value={resumeVisibility} onChange={setResumeVisibility} />
          </div>
          <Separator />
          <div className="flex items-center justify-between px-4 py-3 bg-card">
            <div className="flex items-center gap-3">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{t("cover_letter_upload_field")}</span>
            </div>
            <VisibilityDropdown
              value={effectiveCoverVisibility}
              onChange={setCoverVisibilityAndContext}
            />
          </div>
        </div>
      </div>

      {/* ── Profile Links ── */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          {t("profile_links")}
        </h3>
        <div className="space-y-0 rounded-lg border border-border overflow-hidden">
          {linkFields.map((link, idx) => (
            <div key={link.platform}>
              {idx > 0 && <Separator />}
              <div
                className={cn(
                  "flex items-center justify-between px-4 py-3 bg-card",
                  link.visibility === "hidden" && "opacity-50",
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground">{link.icon}</span>
                  <span className="text-sm font-medium">{link.platform}</span>
                </div>
                <VisibilityDropdown
                  value={link.visibility}
                  onChange={(v) => setLinkVisibility(idx, v)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Additional Questions ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {t("additional_questions")}
          </h3>
          {customQuestions.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={openAddQuestion}
            >
              <Plus className="h-3 w-3" /> {t("add_question")}
            </Button>
          )}
        </div>

        {customQuestions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 rounded-lg border border-dashed border-border bg-muted/20">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground mb-1">{t("no_additional_questions")}</p>
            <p className="text-xs text-muted-foreground/70 mb-4">
              {t("add_screening_questions_hint")}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1.5"
              onClick={openAddQuestion}
            >
              <Plus className="h-3.5 w-3.5" /> {t("add_question")}
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {customQuestions.map((q, i) => (
              <div
                key={q.id}
                draggable
                onDragStart={() => handleQuestionDragStart(i)}
                onDragOver={(e) => handleQuestionDragOver(e, i)}
                onDragEnd={handleQuestionDragEnd}
                className={cn(
                  "group flex items-center gap-2 rounded-lg border border-border bg-card p-3 transition-colors",
                  dragIdx === i && "opacity-50 border-dashed",
                )}
              >
                <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0 cursor-grab" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{q.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="secondary" className="text-[10px] font-normal">
                      {t(answerTypeKeys[q.answerType])}
                    </Badge>
                    {q.required && (
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {t("visibility_required")}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => openEditQuestion(q)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => deleteQuestion(q.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Add/Edit Question Dialog or Sheet ── */}
      {isMobile ? (
        <Sheet
          open={draft.questionDialogOpen}
          onOpenChange={(open) =>
            setApplicationFormDraft((prev) => ({ ...prev, questionDialogOpen: open }))
          }
        >
          <SheetContent side="bottom" className="h-[90vh] rounded-t-2xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="text-base">
                {editingQuestion ? t("edit_question") : t("add_application_question")}
              </SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-4 pb-20">{renderQuestionFormFields()}</div>
            <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4">
              <Button
                className="w-full h-11 text-sm"
                onClick={saveQuestion}
                disabled={!draft.qTitle.trim()}
              >
                {editingQuestion ? t("save_changes") : t("add_question")}
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog
          open={draft.questionDialogOpen}
          onOpenChange={(open) =>
            setApplicationFormDraft((prev) => ({ ...prev, questionDialogOpen: open }))
          }
        >
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingQuestion ? t("edit_question") : t("add_application_question")}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">{renderQuestionFormFields()}</div>
            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setApplicationFormDraft((prev) => ({ ...prev, questionDialogOpen: false }))
                }
              >
                {t("cancel")}
              </Button>
              <Button size="sm" onClick={saveQuestion} disabled={!draft.qTitle.trim()}>
                {editingQuestion ? t("save_changes") : t("add_question")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

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
} from "lucide-react";
import { SelectField } from "@onehash/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useJobSetup } from "../context";
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

type AnswerType =
  | "short_text"
  | "long_text"
  | "single_select"
  | "multi_select"
  | "yes_no"
  | "file_upload"
  | "url"
  | "number"
  | "date";

interface CustomQuestion {
  id: string;
  title: string;
  answerType: AnswerType;
  required: boolean;
  options?: string[];
  allowOther?: boolean;
}

const answerTypeLabels: Record<AnswerType, string> = {
  short_text: "Short Text",
  long_text: "Long Text",
  single_select: "Single Select",
  multi_select: "Multi Select",
  yes_no: "Yes / No",
  file_upload: "File Upload",
  url: "URL",
  number: "Number",
  date: "Date",
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
  if (locked) {
    return (
      <Badge variant="secondary" className="text-[10px] capitalize">
        {value}
      </Badge>
    );
  }
  return (
    <SelectField
      label="Visibility"
      value={value}
      onValueChange={(v) => onChange(v as FieldVisibility)}
      options={[
        { value: "required", label: "Required" },
        { value: "optional", label: "Optional" },
        { value: "hidden", label: "Hidden" },
      ]}
    />
  );
}

function FieldRow({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground/70">{hint}</p>}
    </div>
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
  } = useJobSetup();

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
  const [questionDialogOpen, setQuestionDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<CustomQuestion | null>(null);
  const [qTitle, setQTitle] = useState("");
  const [qType, setQType] = useState<AnswerType>("short_text");
  const [qRequired, setQRequired] = useState(false);
  const [qOptions, setQOptions] = useState<string[]>(["", ""]);
  const [qAllowOther, setQAllowOther] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const initializedFromSchemaRef = useRef(false);

  const setLinkVisibility = (idx: number, val: FieldVisibility) => {
    setLinkFields((prev) => prev.map((l, i) => (i === idx ? { ...l, visibility: val } : l)));
  };

  const openAddQuestion = () => {
    setEditingQuestion(null);
    setQTitle("");
    setQType("short_text");
    setQRequired(false);
    setQOptions(["", ""]);
    setQAllowOther(false);
    setQuestionDialogOpen(true);
  };

  const openEditQuestion = (q: CustomQuestion) => {
    setEditingQuestion(q);
    setQTitle(q.title);
    setQType(q.answerType);
    setQRequired(q.required);
    setQOptions(q.options?.length ? [...q.options] : ["", ""]);
    setQAllowOther(q.allowOther ?? false);
    setQuestionDialogOpen(true);
  };

  const saveQuestion = () => {
    if (!qTitle.trim()) return;
    const hasOptions = qType === "single_select" || qType === "multi_select";
    const finalOptions = hasOptions ? qOptions.filter((o) => o.trim()) : undefined;
    if (hasOptions && (!finalOptions || finalOptions.length < 2)) {
      toast.error("Please add at least 2 options");
      return;
    }
    if (editingQuestion) {
      setCustomQuestions((prev) =>
        prev.map((q) =>
          q.id === editingQuestion.id
            ? {
                ...q,
                title: qTitle.trim(),
                answerType: qType,
                required: qRequired,
                options: finalOptions,
                allowOther: qAllowOther,
              }
            : q,
        ),
      );
    } else {
      setCustomQuestions((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          title: qTitle.trim(),
          answerType: qType,
          required: qRequired,
          options: finalOptions,
          allowOther: qAllowOther,
        },
      ]);
    }
    setQuestionDialogOpen(false);
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
    const showOptions = qType === "single_select" || qType === "multi_select";
    return (
      <>
        <FieldRow label="Question Title">
          <InputField
            value={qTitle}
            onChange={(e) => setQTitle(e.target.value)}
            placeholder="e.g., Why are you a good fit for this role?"
            className="h-9 text-sm"
          />
        </FieldRow>
        <FieldRow label="Answer Type">
          <SelectField
            label="Answer Type"
            value={qType}
            onValueChange={(v) => setQType(v as AnswerType)}
            options={(Object.entries(answerTypeLabels) as [AnswerType, string][]).map(
              ([val, label]) => ({ value: val, label }),
            )}
          />
        </FieldRow>
        {showOptions && (
          <FieldRow label="Options">
            <div className="space-y-2">
              {qOptions.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}</span>
                  <InputField
                    value={opt}
                    onChange={(e) => {
                      const next = [...qOptions];
                      next[i] = e.target.value;
                      setQOptions(next);
                    }}
                    placeholder={`Option ${i + 1}`}
                    className="h-8 text-sm flex-1"
                  />
                  {qOptions.length > 2 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => setQOptions(qOptions.filter((_, idx) => idx !== i))}
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
                onClick={() => setQOptions([...qOptions, ""])}
              >
                <Plus className="h-3 w-3" /> Add Option
              </Button>
              <div className="flex items-center gap-2 pt-1">
                <Checkbox
                  checked={qAllowOther}
                  onCheckedChange={(v) => setQAllowOther(!!v)}
                  id="allow-other"
                />
                <Label
                  htmlFor="allow-other"
                  className="text-xs text-muted-foreground cursor-pointer"
                >
                  Allow "Other" answer
                </Label>
              </div>
            </div>
          </FieldRow>
        )}
        <Separator />
        <div className="flex items-center justify-between py-1">
          <div>
            <p className="text-sm font-medium">Required field</p>
            <p className="text-xs text-muted-foreground">Candidates must answer this question</p>
          </div>
          <Switch checked={qRequired} onCheckedChange={setQRequired} />
        </div>
      </>
    );
  };

  return (
    <div className="space-y-6">
      {/* ── Default Fields ── */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Default Fields
        </h3>
        <div className="space-y-0 rounded-lg border border-border overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-card">
            <div className="flex items-center gap-3">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Full Name</span>
            </div>
            <VisibilityDropdown value="required" onChange={() => {}} locked />
          </div>
          <Separator />
          <div className="flex items-center justify-between px-4 py-3 bg-card">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Email</span>
            </div>
            <VisibilityDropdown value="required" onChange={() => {}} locked />
          </div>
          <Separator />
          <div className="flex items-center justify-between px-4 py-3 bg-card">
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Phone Number</span>
            </div>
            <VisibilityDropdown value={phoneVisibility} onChange={setPhoneVisibility} />
          </div>
          <Separator />
          <div className="flex items-center justify-between px-4 py-3 bg-card">
            <div className="flex items-center gap-3">
              <Upload className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Resume Upload</span>
            </div>
            <VisibilityDropdown value={resumeVisibility} onChange={setResumeVisibility} />
          </div>
          <Separator />
          <div className="flex items-center justify-between px-4 py-3 bg-card">
            <div className="flex items-center gap-3">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Cover Letter Upload</span>
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
          Profile Links
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
            Additional Questions
          </h3>
          {customQuestions.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={openAddQuestion}
            >
              <Plus className="h-3 w-3" /> Add Question
            </Button>
          )}
        </div>

        {customQuestions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 rounded-lg border border-dashed border-border bg-muted/20">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground mb-1">No additional questions added yet.</p>
            <p className="text-xs text-muted-foreground/70 mb-4">
              Add screening questions for candidates to answer.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1.5"
              onClick={openAddQuestion}
            >
              <Plus className="h-3.5 w-3.5" /> Add Question
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
                      {answerTypeLabels[q.answerType]}
                    </Badge>
                    {q.required && (
                      <Badge variant="outline" className="text-[10px] font-normal">
                        Required
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
        <Sheet open={questionDialogOpen} onOpenChange={setQuestionDialogOpen}>
          <SheetContent side="bottom" className="h-[90vh] rounded-t-2xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="text-base">
                {editingQuestion ? "Edit Question" : "Add Application Question"}
              </SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-4 pb-20">{renderQuestionFormFields()}</div>
            <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4">
              <Button
                className="w-full h-11 text-sm"
                onClick={saveQuestion}
                disabled={!qTitle.trim()}
              >
                {editingQuestion ? "Save Changes" : "Add Question"}
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={questionDialogOpen} onOpenChange={setQuestionDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingQuestion ? "Edit Question" : "Add Application Question"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">{renderQuestionFormFields()}</div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setQuestionDialogOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={saveQuestion} disabled={!qTitle.trim()}>
                {editingQuestion ? "Save Changes" : "Add Question"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

"use client";

import { useRef, useState } from "react";
import { Button } from "@onehash/ui/button";
import { InputField } from "@onehash/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@onehash/ui/dialog";
import { toast } from "@onehash/ui/sonner";
import { useTranslation } from "react-i18next";
import { createCandidate, createCandidateFromResume } from "@/api";
import {
  isValidEmail,
  isValidPhone,
  normalizeEmail,
  normalizePhone,
  sanitizePhoneInput,
} from "@/lib/validation/contact";
import { FileText, Loader2, UploadCloud, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { TruncatedText } from "@/components/common/TruncatedText";

export type AddCandidateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId?: string | null;
  jobTitle?: string | null;
  stageId?: string | null;
  stageName?: string | null;
  onAdded?: () => void | Promise<void>;
};

type Mode = "manual" | "upload";

export function AddCandidateDialog({
  open,
  onOpenChange,
  jobId,
  jobTitle,
  stageId,
  stageName,
  onAdded,
}: AddCandidateDialogProps) {
  const { t } = useTranslation();

  // Manual mode state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  // Upload mode state
  const [mode, setMode] = useState<Mode>("manual");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetAll = () => {
    setName("");
    setEmail("");
    setPhone("");
    setLoading(false);
    setMode("manual");
    setResumeFile(null);
    setIsDragging(false);
    setIsCreating(false);
  };

  const handleOpenChange = (val: boolean) => {
    if (!val) resetAll();
    onOpenChange(val);
  };

  // ── Manual submit ──────────────────────────────────────────────────────────
  const submitManual = async () => {
    if (!name.trim() || !email.trim()) return;
    if (!isValidEmail(email)) {
      toast.error(t("enter_valid_email"));
      return;
    }
    if (phone.trim() && !isValidPhone(phone)) {
      toast.error(t("enter_valid_phone"));
      return;
    }
    try {
      setLoading(true);
      await createCandidate({
        ...(jobId ? { job_id: jobId } : {}),
        name: name.trim(),
        email: normalizeEmail(email),
        phone: normalizePhone(phone) || null,
        source: "Manual",
        status: "active",
        stage_id: jobId ? (stageId ?? undefined) : undefined,
      });
      toast.success(t("candidate_added"));
      handleOpenChange(false);
      await onAdded?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add candidate");
    } finally {
      setLoading(false);
    }
  };

  // ── Upload submit ──────────────────────────────────────────────────────────
  const submitFromResume = async () => {
    if (!resumeFile) return;
    try {
      setIsCreating(true);
      await createCandidateFromResume(resumeFile, jobId, stageId);
      toast.success(t("candidate_added"));
      handleOpenChange(false);
      await onAdded?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create candidate from resume");
    } finally {
      setIsCreating(false);
    }
  };

  // ── File helpers ───────────────────────────────────────────────────────────
  const ALLOWED_RESUME_TYPES = new Set([
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]);

  const acceptFile = (file: File | undefined) => {
    if (!file) return;
    if (!ALLOWED_RESUME_TYPES.has(file.type)) {
      toast.error("Only PDF and Word documents (.doc / .docx) are accepted");
      return;
    }
    if (file.size > 1 * 1024 * 1024) {
      toast.error("File size must be ≤ 1 MB");
      return;
    }
    setResumeFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    acceptFile(e.dataTransfer.files[0]);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("add_candidate")}</DialogTitle>
          <DialogDescription>
            {jobId && jobTitle
              ? stageName
                ? t("add_candidate_dialog_job_stage_description", { jobTitle, stageName })
                : t("add_candidate_dialog_job_description", { jobTitle })
              : t("add_candidate_dialog_pool_description")}
          </DialogDescription>
        </DialogHeader>

        {/* Mode toggle */}
        <div className="flex rounded-md border border-border overflow-hidden text-xs font-medium">
          <button
            type="button"
            onClick={() => setMode("manual")}
            className={cn(
              "flex-1 py-1.5 transition-colors",
              mode === "manual"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {t("manual_entry")}
          </button>
          <button
            type="button"
            onClick={() => setMode("upload")}
            className={cn(
              "flex-1 py-1.5 transition-colors",
              mode === "upload"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {t("upload_resume")}
          </button>
        </div>

        {mode === "manual" ? (
          <div className="space-y-3">
            <InputField
              label={t("full_name")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("candidate_name_placeholder")}
              showAsterisk
            />
            <InputField
              label={t("email")}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="candidate@example.com"
              showAsterisk
            />
            <InputField
              label={t("phone_optional_label")}
              value={phone}
              onChange={(e) => setPhone(sanitizePhoneInput(e.target.value))}
              placeholder="+1 …"
            />
          </div>
        ) : (
          <div className="space-y-3">
            {/* Drop zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 cursor-pointer transition-colors select-none",
                isDragging
                  ? "border-foreground bg-muted"
                  : "border-border hover:border-foreground/40 hover:bg-muted/40",
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf,application/msword,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx"
                className="hidden"
                onChange={(e) => {
                  acceptFile(e.target.files?.[0]);
                  e.currentTarget.value = "";
                }}
              />
              <UploadCloud className="h-7 w-7 text-muted-foreground" />
              <p className="text-sm font-medium text-center">{t("drop_pdf_or_browse")}</p>
              <p className="text-xs text-muted-foreground">{t("pdf_max_size")}</p>
            </div>

            {/* Selected file indicator */}
            {resumeFile && (
              <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <TruncatedText className="flex-1 text-xs">{resumeFile.name}</TruncatedText>
                <button
                  type="button"
                  onClick={() => setResumeFile(null)}
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={loading || isCreating}
          >
            {t("cancel")}
          </Button>

          {mode === "manual" ? (
            <Button
              onClick={() => void submitManual()}
              disabled={
                loading ||
                !name.trim() ||
                !email.trim() ||
                !isValidEmail(email) ||
                Boolean(phone.trim() && !isValidPhone(phone))
              }
            >
              {loading ? t("adding") : t("add_candidate")}
            </Button>
          ) : (
            <Button onClick={() => void submitFromResume()} disabled={!resumeFile || isCreating}>
              {isCreating ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  {t("creating")}
                </>
              ) : (
                t("add_candidate")
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

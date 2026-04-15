"use client";

import { useState } from "react";
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
import { createCandidate } from "@/api";
import {
  isValidEmail,
  isValidPhone,
  normalizeEmail,
  normalizePhone,
  sanitizePhoneInput,
} from "@/lib/validation/contact";

export type AddCandidateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId?: string | null;
  jobTitle?: string | null;
  stageId?: string | null;
  onAdded?: () => void | Promise<void>;
};

export function AddCandidateDialog({
  open,
  onOpenChange,
  jobId,
  jobTitle,
  stageId,
  onAdded,
}: AddCandidateDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
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
      onOpenChange(false);
      setName("");
      setEmail("");
      setPhone("");
      await onAdded?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add candidate");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("add_candidate")}</DialogTitle>
          <DialogDescription>
            {jobId && jobTitle
              ? t("add_candidate_dialog_job_description", { jobTitle })
              : t("add_candidate_dialog_pool_description")}
          </DialogDescription>
        </DialogHeader>
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
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {t("cancel")}
          </Button>
          <Button
            onClick={() => void submit()}
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

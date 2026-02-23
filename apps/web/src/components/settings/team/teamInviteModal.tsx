"use client";

import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@onehash/ui/dialog";
import { Button } from "@onehash/ui/button";
import { SelectField } from "@onehash/ui/select";
import { Icon } from "@onehash/ui/icon";
import { type Role, ASSIGNABLE_ROLES } from "@/components/settings/team/lib/permissonMatrix";
import { BulkTextArea } from "@onehash/ui/textarea";

interface TeamInviteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (emails: string[], role: Role) => Promise<void>;
  isSubmitting: boolean;
}

export function TeamInviteModal({ open, onOpenChange, onSubmit, isSubmitting }: TeamInviteModalProps) {
  const { t } = useTranslation();
  const [emailInput, setEmailInput] = useState("");
  const [emailError, setEmailError] = useState("");
  const [selectedRole, setSelectedRole] = useState<Role>("employee");

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

  const parseEmails = (input: string): string[] => {
    return input
      .split(/[,\n]+/)
      .map((e) => e.trim())
      .filter(Boolean);
  };

  const parsedEmails = useMemo(() => parseEmails(emailInput), [emailInput]);
  const emailCount = parsedEmails.length;

  const handleSubmit = async () => {
    if (emailCount === 0) {
      setEmailError("Enter at least one email address");
      return;
    }

    const invalidEmails = parsedEmails.filter((e) => !isValidEmail(e));
    if (invalidEmails.length > 0) {
      setEmailError(`Invalid email${invalidEmails.length > 1 ? "s" : ""}: ${invalidEmails.join(", ")}`);
      return;
    }

    const uniqueEmails = [...new Set(parsedEmails)];

    try {
      await onSubmit(uniqueEmails, selectedRole);
      setEmailInput("");
      setEmailError("");
      setSelectedRole("employee");
      onOpenChange(false);
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "Failed to send invites");
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setEmailInput("");
      setEmailError("");
      setSelectedRole("employee");
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Invite Team Members</DialogTitle>
          <DialogDescription className="text-xs">Send invitations to join your organization.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <BulkTextArea
            label="Emails"
            value={emailInput}
            onChange={(value) => { setEmailInput(value); setEmailError(""); }}
            placeholder="Enter emails separated by commas or new lines"
            hint="e.g. alice@example.com, bob@example.com"
            disabled={isSubmitting}
            error={emailError}
            rows={4}
          />
          <SelectField
            label="Role"
            value={selectedRole}
            onValueChange={(v) => setSelectedRole(v as Role)}
            options={ASSIGNABLE_ROLES.map((r) => ({ value: r.role, label: r.label }))}
            disabled={isSubmitting}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
          <Button size="sm" className="text-xs h-8 gap-1.5" onClick={handleSubmit} disabled={isSubmitting || emailCount === 0}>
            {isSubmitting ? (
              <span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-current" />
            ) : (
              <Icon name="Send" className="h-3.5 w-3.5" />
            )}
            {t("invite")} {emailCount > 0 && `(${emailCount})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

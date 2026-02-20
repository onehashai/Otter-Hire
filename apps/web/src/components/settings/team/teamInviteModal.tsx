"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@onehash/ui/dialog";
import { Button } from "@onehash/ui/button";
import { Label } from "@onehash/ui/label";
import { SelectField } from "@onehash/ui/select";
import { Icon } from "@onehash/ui/icon";
import { type Role, roles } from "@/components/settings/team/lib/permissonMatrix";

const inviteRoles = roles.filter((r) => r.role !== "Owner");

interface TeamInviteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (emails: string[], role: Role) => void;
}

export function TeamInviteModal({ open, onOpenChange, onSubmit }: TeamInviteModalProps) {
  const { t } = useTranslation();
  const [emailInput, setEmailInput] = useState("");
  const [emailChips, setEmailChips] = useState<string[]>([]);
  const [inviteRole, setInviteRole] = useState<Role>("Recruiter");
  const [emailError, setEmailError] = useState("");

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

  const addEmailChip = () => {
    const trimmed = emailInput.trim();
    if (!trimmed) return;
    if (!isValidEmail(trimmed)) { setEmailError("Invalid email address"); return; }
    if (emailChips.includes(trimmed)) { setEmailError("Already added"); return; }
    setEmailChips((prev) => [...prev, trimmed]);
    setEmailInput("");
    setEmailError("");
  };

  const handleEmailKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === "," || e.key === "Tab") { e.preventDefault(); addEmailChip(); }
    if (e.key === "Backspace" && !emailInput && emailChips.length) { setEmailChips((prev) => prev.slice(0, -1)); }
  };

  const removeChip = (email: string) => setEmailChips((prev) => prev.filter((e) => e !== email));

  const handleSubmit = () => {
    const allEmails = [...emailChips];
    if (emailInput.trim()) {
      if (!isValidEmail(emailInput.trim())) { setEmailError("Invalid email address"); return; }
      allEmails.push(emailInput.trim());
    }
    if (!allEmails.length) { setEmailError("Enter at least one email"); return; }
    if (inviteRole === "Owner") {
      setEmailError("Cannot invite as Owner. Transfer ownership instead.");
      return;
    }

    onSubmit(allEmails, inviteRole);
    onOpenChange(false);
    setEmailChips([]);
    setEmailInput("");
    setEmailError("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Invite Team Members</DialogTitle>
          <DialogDescription className="text-xs">Send invitations to join your organization.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Email addresses</Label>
            <div className="flex flex-wrap gap-1.5 p-2 border rounded-md bg-background min-h-[40px] focus-within:border-muted-foreground transition-colors">
              {emailChips.map((chip) => (
                <span key={chip} className="inline-flex items-center gap-1 bg-muted text-foreground text-xs px-2 py-0.5 rounded-md">
                  {chip}
                  <button onClick={() => removeChip(chip)} className="hover:text-destructive">
                    <Icon name="X" className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                value={emailInput}
                onChange={(e) => { setEmailInput(e.target.value); setEmailError(""); }}
                onKeyDown={handleEmailKeyDown}
                onBlur={addEmailChip}
                placeholder={emailChips.length ? "" : "Enter emails, separated by commas"}
                className="flex-1 min-w-[140px] bg-transparent outline-none text-sm placeholder:text-muted-foreground"
              />
            </div>
            {emailError && <p className="text-xs text-destructive">{emailError}</p>}
          </div>
          <div className="space-y-1.5">
            <SelectField 
              label="Role"
              value={inviteRole} 
              onValueChange={(v) => setInviteRole(v as Role)} 
              options={inviteRoles.map((r) => ({ value: r.role, label: r.role }))} 
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" className="text-xs h-8 gap-1.5" onClick={handleSubmit}>
            <Icon name="Send" className="h-3.5 w-3.5" /> {t("invite")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

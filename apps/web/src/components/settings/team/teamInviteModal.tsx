"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Label,
  Icon,
} from "@onehash/ui";

interface TeamInviteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (email: string) => Promise<void>;
  isSubmitting: boolean;
}

export function TeamInviteModal({ open, onOpenChange, onSubmit, isSubmitting }: TeamInviteModalProps) {
  const [emailInput, setEmailInput] = useState("");
  const [emailError, setEmailError] = useState("");

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

  const handleSubmit = async () => {
    const trimmed = emailInput.trim();
    if (!trimmed) { setEmailError("Enter an email address"); return; }
    if (!isValidEmail(trimmed)) { setEmailError("Invalid email address"); return; }

    try {
      await onSubmit(trimmed);
      setEmailInput("");
      setEmailError("");
      onOpenChange(false);
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "Failed to send invite");
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setEmailInput("");
      setEmailError("");
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Invite Team Member</DialogTitle>
          <DialogDescription className="text-xs">Send an invitation to join your organization. They will be added with the Employee role by default.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Email address</Label>
            <input
              value={emailInput}
              onChange={(e) => { setEmailInput(e.target.value); setEmailError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSubmit(); } }}
              placeholder="colleague@company.com"
              className="w-full h-9 px-3 border rounded-md bg-background text-sm placeholder:text-muted-foreground outline-none focus:border-muted-foreground transition-colors"
              disabled={isSubmitting}
            />
            {emailError && <p className="text-xs text-destructive">{emailError}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
          <Button size="sm" className="text-xs h-8 gap-1.5" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-current" />
            ) : (
              <Icon name="Send" className="h-3.5 w-3.5" />
            )}
            Invite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

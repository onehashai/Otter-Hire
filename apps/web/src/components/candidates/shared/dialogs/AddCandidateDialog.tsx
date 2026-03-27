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
import { createCandidate } from "@/api";

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
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!name.trim() || !email.trim()) return;
    try {
      setLoading(true);
      await createCandidate({
        ...(jobId ? { job_id: jobId } : {}),
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        source: "Manual",
        status: "active",
        stage_id: jobId ? (stageId ?? undefined) : undefined,
      });
      toast.success("Candidate added");
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
          <DialogTitle>Add candidate</DialogTitle>
          <DialogDescription>
            {jobId && jobTitle
              ? `Add a candidate to ${jobTitle}. They will appear in the current stage when possible.`
              : "Add a candidate to Talent Pool. You can assign a job later."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <InputField
            label="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Candidate name"
            showAsterisk
          />
          <InputField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="candidate@example.com"
            showAsterisk
          />
          <InputField
            label="Phone (optional)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 …"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={loading || !name.trim() || !email.trim()}>
            {loading ? "Adding…" : "Add candidate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

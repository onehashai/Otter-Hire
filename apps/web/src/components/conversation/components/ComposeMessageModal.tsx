"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@onehash/ui/dialog";
import { Button } from "@onehash/ui/button";
import { InputField } from "@onehash/ui/input";
import { Textarea } from "@onehash/ui/textarea";
import { Label } from "@onehash/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@onehash/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@onehash/ui/dropdown-menu";
import { Send, FileText, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { getCandidates, type CandidateListItemResponse } from "@/api/candidates";
import { createConversation } from "@/api/conversations";
import { emailTemplates } from "./ComposeMessageBox";

interface ComposeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (conversationId: string) => void;
}

export function ComposeModal({ open, onOpenChange, onCreated }: ComposeModalProps) {
  const [candidates, setCandidates] = useState<CandidateListItemResponse[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);

  const [candidateId, setCandidateId] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCandidatesLoading(true);
    getCandidates({ limit: 100 })
      .then(setCandidates)
      .catch(() => toast.error("Failed to load candidates"))
      .finally(() => setCandidatesLoading(false));
  }, [open]);

  const insertTemplate = (t: (typeof emailTemplates)[0]) => {
    setSubject(t.subject);
    setBody(t.content);
  };

  const handleClose = () => {
    setCandidateId("");
    setCc("");
    setBcc("");
    setSubject("");
    setBody("");
    onOpenChange(false);
  };

  const handleSend = async () => {
    if (!candidateId || !subject.trim() || !body.trim()) return;
    setSending(true);
    try {
      const conv = await createConversation({ candidate_id: candidateId, subject, body });
      toast.success("Message sent");
      handleClose();
      onCreated?.(conv.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">New Message</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">To</Label>
            <Select value={candidateId} onValueChange={setCandidateId}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue
                  placeholder={candidatesLoading ? "Loading candidates…" : "Select candidate"}
                />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">
                    {c.name} ({c.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Cc</Label>
            <InputField
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              className="h-9 text-xs"
              placeholder="Cc recipients (comma-separated)"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Bcc</Label>
            <InputField
              value={bcc}
              onChange={(e) => setBcc(e.target.value)}
              className="h-9 text-xs"
              placeholder="Bcc recipients (comma-separated)"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Subject</Label>
            <InputField
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="h-9 text-xs"
              placeholder="Email subject"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Message</Label>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-6 w-6" title="Attach file">
                  <Paperclip className="h-3 w-3" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6" title="Use template">
                      <FileText className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    {emailTemplates.map((t) => (
                      <DropdownMenuItem
                        key={t.id}
                        onClick={() => insertTemplate(t)}
                        className="text-xs"
                      >
                        {t.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="min-h-[140px] text-xs resize-none"
              placeholder="Type your message..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" className="text-xs" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="text-xs gap-1.5"
            onClick={() => void handleSend()}
            disabled={!candidateId || !subject.trim() || !body.trim() || sending}
          >
            <Send className="h-3 w-3" />
            {sending ? "Sending…" : "Send Message"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

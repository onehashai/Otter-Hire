"use client";

import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@onehash/ui/dialog";
import { Button } from "@onehash/ui/button";
import { InputField } from "@onehash/ui/input";
import { Textarea } from "@onehash/ui/textarea";
import { Label } from "@onehash/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@onehash/ui/select";
import { Send, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { getCandidates, type CandidateListItemResponse } from "@/api/candidates";
import { createConversation } from "@/api/conversations";
import { getTemplates, type TemplateResponse } from "@/api/templates";
import { cn } from "@/lib/utils";
import {
  htmlToPlainText,
  substituteTemplateVariables,
} from "./ComposeMessageBox";

interface ComposeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (conversationId: string) => void;
  organizationName?: string;
}

export function ComposeModal({ open, onOpenChange, onCreated, organizationName = "" }: ComposeModalProps) {
  const [candidates, setCandidates] = useState<CandidateListItemResponse[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);

  const [candidateId, setCandidateId] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [templates, setTemplates] = useState<TemplateResponse[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templatePickerIndex, setTemplatePickerIndex] = useState(0);
  const [pickerRect, setPickerRect] = useState<DOMRect | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const showTemplatePicker = body.endsWith("/");

  useEffect(() => {
    if (!open) return;
    setCandidatesLoading(true);
    getCandidates({ limit: 100 })
      .then(setCandidates)
      .catch(() => toast.error("Failed to load candidates"))
      .finally(() => setCandidatesLoading(false));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setTemplatesLoading(true);
    getTemplates()
      .then((list) => {
        if (!cancelled) setTemplates(list);
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to load templates");
      })
      .finally(() => {
        if (!cancelled) setTemplatesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (showTemplatePicker) setTemplatePickerIndex(0);
  }, [showTemplatePicker]);

  useLayoutEffect(() => {
    if (!showTemplatePicker || !textareaRef.current) {
      setPickerRect(null);
      return;
    }
    const rect = textareaRef.current.getBoundingClientRect();
    setPickerRect(rect);
  }, [showTemplatePicker, body]);

  const selectedCandidate = candidates.find((c) => c.id === candidateId);
  const insertTemplate = (t: TemplateResponse) => {
    const opts = {
      candidateName: selectedCandidate?.name ?? "",
      jobTitle: "",
      organizationName: organizationName ?? "",
    };
    setSubject(substituteTemplateVariables(t.subject, opts));
    const withVariables = substituteTemplateVariables(t.body, opts);
    const content = htmlToPlainText(withVariables);
    if (showTemplatePicker) {
      setBody(body.slice(0, -1) + content);
    } else {
      setBody(content);
    }
  };

  const handleBodyKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showTemplatePicker) return;
    if (e.key === "Escape") {
      setBody((b) => b.slice(0, -1));
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setTemplatePickerIndex((i) => Math.min(i + 1, templates.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setTemplatePickerIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter" && templates[templatePickerIndex]) {
      e.preventDefault();
      insertTemplate(templates[templatePickerIndex]);
    }
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

          <div className="space-y-1.5 relative">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Message</Label>
              <Button variant="ghost" size="icon" className="h-6 w-6" title="Attach file">
                <Paperclip className="h-3 w-3" />
              </Button>
            </div>
            <Textarea
              ref={textareaRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="min-h-[140px] text-xs resize-none"
              placeholder="Type your message or type / to choose a template"
              onKeyDown={handleBodyKeyDown}
            />
            {showTemplatePicker &&
              pickerRect &&
              typeof document !== "undefined" &&
              createPortal(
                <div
                  className="fixed z-[9999] rounded-md border border-border bg-popover text-popover-foreground shadow-md overflow-hidden min-w-[200px]"
                  role="listbox"
                  style={{
                    left: pickerRect.left,
                    bottom: window.innerHeight - pickerRect.top + 4,
                    width: Math.max(pickerRect.width, 200),
                  }}
                >
                  <div className="py-1 max-h-[200px] overflow-y-auto">
                    {templatesLoading ? (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        Loading templates…
                      </div>
                    ) : templates.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        No templates. Create them in Settings → Templates.
                      </div>
                    ) : (
                      templates.map((t, i) => (
                        <button
                          key={t.id}
                          type="button"
                          role="option"
                          aria-selected={i === templatePickerIndex}
                          className={cn(
                            "w-full px-3 py-2 text-left text-xs hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground outline-none",
                            i === templatePickerIndex && "bg-accent text-accent-foreground"
                          )}
                          onClick={() => insertTemplate(t)}
                        >
                          {t.name}
                        </button>
                      ))
                    )}
                  </div>
                </div>,
                document.body
              )}
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

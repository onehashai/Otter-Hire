"use client";

import { useState, useEffect } from "react";
import { Button } from "@onehash/ui/button";
import { InputField } from "@onehash/ui/input";
import { Textarea } from "@onehash/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@onehash/ui/dropdown-menu";
import { Send, FileText, Paperclip } from "lucide-react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export const emailTemplates = [
  {
    id: "received",
    label: "Application Received",
    subject: "Application Received",
    content:
      "Thank you for applying. We have received your application and our team will review it shortly.",
  },
  {
    id: "interview",
    label: "Interview Invitation",
    subject: "Interview Invitation",
    content:
      "We'd like to invite you for an interview. Please let us know your availability for the coming week.",
  },
  {
    id: "feedback",
    label: "Interview Feedback Request",
    subject: "Interview Feedback",
    content:
      "Thank you for taking the time to interview with us. We'd appreciate your feedback on the interview experience.",
  },
  {
    id: "offer",
    label: "Offer Communication",
    subject: "Offer for {jobTitle}",
    content:
      "We're pleased to inform you that we'd like to extend an offer for the {jobTitle} position. Please find the details below.",
  },
  {
    id: "rejection",
    label: "Rejection Email",
    subject: "Update on Your Application",
    content:
      "Thank you for your interest. After careful consideration, we've decided to move forward with other candidates.",
  },
];

// ---------------------------------------------------------------------------
// ComposeMessageBox
// ---------------------------------------------------------------------------

interface ComposeMessageBoxProps {
  /** Pre-filled reply-to address (candidate email). Editable by the user. */
  toEmail: string;
  jobTitle?: string;
  candidateName?: string;
  onSend: (body: string) => Promise<void>;
}

export function ComposeMessageBox({
  toEmail,
  jobTitle = "",
  candidateName,
  onSend,
}: ComposeMessageBoxProps) {
  const [to, setTo] = useState(toEmail);
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  // Keep "to" in sync when the parent switches to a different conversation
  useEffect(() => {
    setTo(toEmail);
  }, [toEmail]);

  const handleSend = async () => {
    if (!body.trim() || sending) return;
    setSending(true);
    try {
      await onSend(body);
      setBody("");
      setCc("");
      setBcc("");
      toast.success(`Message sent${candidateName ? ` to ${candidateName}` : ""}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const insertTemplate = (t: (typeof emailTemplates)[0]) => {
    setBody(t.content.replace(/\{jobTitle\}/g, jobTitle));
  };

  return (
    <div className="border-t border-border">
      {/* To / Cc / Bcc rows */}
      <div className="divide-y divide-border/50 border-b border-border/50">
        <div className="flex items-center gap-2 px-3 py-1.5">
          <span className="w-7 shrink-0 text-[11px] font-medium text-muted-foreground">To</span>
          <InputField
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="recipient@email.com"
            className="h-7 flex-1 border-0 px-0 text-xs shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5">
          <span className="w-7 shrink-0 text-[11px] font-medium text-muted-foreground">Cc</span>
          <InputField
            value={cc}
            onChange={(e) => setCc(e.target.value)}
            placeholder="Cc recipients (comma-separated)"
            className="h-7 flex-1 border-0 px-0 text-xs shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5">
          <span className="w-7 shrink-0 text-[11px] font-medium text-muted-foreground">Bcc</span>
          <InputField
            value={bcc}
            onChange={(e) => setBcc(e.target.value)}
            placeholder="Bcc recipients (comma-separated)"
            className="h-7 flex-1 border-0 px-0 text-xs shadow-none focus-visible:ring-0"
          />
        </div>
      </div>

      {/* Body + toolbar */}
      <div className="p-3 space-y-2">
        <Textarea
          placeholder="Type your message..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="min-h-[80px] resize-none text-xs"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void handleSend();
          }}
        />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" title="Attach file">
              <Paperclip className="h-3.5 w-3.5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" title="Insert template">
                  <FileText className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
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
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={!body.trim()}>
              Save Draft
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={() => void handleSend()}
              disabled={!body.trim() || sending}
            >
              <Send className="h-3 w-3" />
              {sending ? "Sending..." : "Send"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

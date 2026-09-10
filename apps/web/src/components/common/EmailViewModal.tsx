"use client";

import { useState } from "react";
import { Dialog, DialogContent } from "@onehash/ui/dialog";
import { Button } from "@onehash/ui/button";
import { Paperclip, Copy, Check, ChevronDown, Calendar, User, Mail, Hash, Send, Clock, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@onehash/ui/sonner";

export type EmailViewModalData = {
  id?: string;
  from_name?: string | null;
  from_email?: string | null;
  to_email?: string | null;
  subject?: string | null;
  received_at?: string | null;
  body?: string | null;
  body_quoted?: string | null;
  html_body?: string | null;
  attachments?: Array<{ filename: string; size_bytes?: number }> | null;
};

type EmailViewModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: EmailViewModalData | null;
};

export function EmailViewModal({ open, onOpenChange, email }: EmailViewModalProps) {
  const [showQuoted, setShowQuoted] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!email) return null;

  const senderInitial = (email.from_name || email.from_email || "E").trim().charAt(0).toUpperCase();
  const fullHtml = email.html_body?.trim();
  const fullText = email.body?.trim();

  const handleCopyText = () => {
    const textToCopy = fullText || fullHtml || "";
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      toast.success("Email body copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formattedDate = email.received_at
    ? new Date(email.received_at).toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  const formattedTime = email.received_at
    ? new Date(email.received_at).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZoneName: "short",
      })
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl w-[92vw] max-h-[92vh] p-0 overflow-hidden rounded-2xl border border-border shadow-2xl bg-background">
        {/* Detailed Header Section */}
        <div className="bg-muted/30 border-b border-border p-6 space-y-5">
          {/* Top Bar: Subject & Date/Time Badge */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
            <div className="space-y-1 flex-1">
              <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                Email Subject
              </span>
              <h2 className="text-lg md:text-xl font-semibold text-foreground leading-snug break-words">
                {email.subject || "(No Subject)"}
              </h2>
            </div>
            {email.received_at ? (
              <div className="shrink-0 text-xs bg-background border border-border rounded-xl p-2.5 space-y-1 shadow-sm">
                <div className="flex items-center gap-1.5 text-foreground font-medium">
                  <Calendar className="h-3.5 w-3.5 text-primary" />
                  <span>{formattedDate}</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] font-mono">
                  <Clock className="h-3 w-3 text-muted-foreground/70" />
                  <span>{formattedTime}</span>
                </div>
              </div>
            ) : null}
          </div>

          {/* Details Grid: Sender, Recipient, ID */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            {/* Sender Box */}
            <div className="p-3 rounded-xl bg-background border border-border/80 flex items-start gap-3">
              <div className="h-9 w-9 rounded-full bg-primary/10 text-primary font-semibold text-sm flex items-center justify-center shrink-0 border border-primary/20">
                {senderInitial}
              </div>
              <div className="space-y-0.5 min-w-0 flex-1">
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  From (Sender)
                </div>
                <div className="font-semibold text-foreground truncate">
                  {email.from_name || "Unknown Sender"}
                </div>
                <div className="text-muted-foreground font-mono text-[11px] truncate">
                  {email.from_email || "—"}
                </div>
              </div>
            </div>

            {/* Recipient Box */}
            <div className="p-3 rounded-xl bg-background border border-border/80 flex items-start gap-3">
              <div className="h-9 w-9 rounded-full bg-blue-500/10 text-blue-600 font-semibold text-sm flex items-center justify-center shrink-0 border border-blue-500/20">
                <ArrowRight className="h-4 w-4" />
              </div>
              <div className="space-y-0.5 min-w-0 flex-1">
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  To (Recipient)
                </div>
                <div className="font-semibold text-foreground truncate">
                  {email.to_email || "Recipient"}
                </div>
                <div className="text-muted-foreground font-mono text-[11px]">
                  Inbound Careers Inbox
                </div>
              </div>
            </div>

            {/* Email Metadata / ID Box */}
            <div className="p-3 rounded-xl bg-background border border-border/80 flex items-start gap-3">
              <div className="h-9 w-9 rounded-full bg-muted text-muted-foreground font-semibold text-sm flex items-center justify-center shrink-0 border border-border">
                <Hash className="h-4 w-4" />
              </div>
              <div className="space-y-0.5 min-w-0 flex-1">
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Log Record ID
                </div>
                <div className="font-mono text-[11px] text-foreground truncate">
                  {email.id || "N/A"}
                </div>
                <div className="text-muted-foreground text-[10px]">
                  Verified Inbound Email
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Large Scrollable Body Container */}
        <div className="p-6 md:p-8 max-h-[58vh] overflow-y-auto space-y-6 select-text">
          {fullHtml ? (
            <div
              className="prose prose-sm md:prose-base max-w-none text-foreground leading-relaxed dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: fullHtml }}
            />
          ) : fullText ? (
            <pre className="whitespace-pre-wrap font-sans text-sm md:text-base text-foreground leading-relaxed break-words">
              {fullText}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground italic">(No content body)</p>
          )}

          {/* Quoted Thread History */}
          {email.body_quoted ? (
            <div className="mt-6 pt-4 border-t border-border">
              <button
                type="button"
                onClick={() => setShowQuoted((v) => !v)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors"
              >
                <ChevronDown
                  className={cn("h-4 w-4 transition-transform shrink-0", showQuoted && "rotate-180")}
                />
                {showQuoted ? "Hide quoted thread history" : "Show quoted thread history"}
              </button>
              {showQuoted ? (
                <div className="mt-3 p-4 rounded-xl bg-muted/40 border border-border text-xs text-muted-foreground font-mono whitespace-pre-wrap break-words leading-relaxed max-h-60 overflow-y-auto">
                  {email.body_quoted}
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Attachments Section */}
          {email.attachments && email.attachments.length > 0 ? (
            <div className="mt-6 pt-4 border-t border-border">
              <div className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
                <Paperclip className="h-4 w-4 text-primary" />
                <span>Attachments / Resumes ({email.attachments.length})</span>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {email.attachments.map((att: any, i: number) => {
                  const href = att.download_url || att.url;
                  const innerContent = (
                    <>
                      <Paperclip className="h-4 w-4 text-primary shrink-0" />
                      <span className="truncate max-w-[200px]">{att.filename}</span>
                      {att.size_bytes ? (
                        <span className="text-[11px] text-muted-foreground font-mono">
                          ({Math.round(att.size_bytes / 1024)} KB)
                        </span>
                      ) : null}
                    </>
                  );

                  if (href) {
                    return (
                      <a
                        key={i}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        download={att.filename}
                        className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary px-3.5 py-2 text-xs text-foreground font-medium shadow-sm transition-all cursor-pointer group"
                        title={`Click to view/download ${att.filename}`}
                      >
                        {innerContent}
                      </a>
                    );
                  }

                  return (
                    <span
                      key={i}
                      className="inline-flex items-center gap-2 rounded-xl border border-border bg-muted/60 px-3.5 py-2 text-xs text-foreground font-medium shadow-sm"
                    >
                      {innerContent}
                    </span>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer Actions Bar */}
        <div className="bg-muted/20 border-t border-border px-6 py-4 flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs h-9 text-muted-foreground hover:text-foreground gap-2 px-4"
            onClick={handleCopyText}
          >
            {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied to Clipboard" : "Copy Email Body"}
          </Button>

          <Button
            type="button"
            variant="default"
            size="sm"
            className="text-xs h-9 px-6 font-medium"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

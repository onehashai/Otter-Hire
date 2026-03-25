"use client";

import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@onehash/ui/button";
import { InputField } from "@onehash/ui/input";
import { Textarea } from "@onehash/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@onehash/ui/popover";
import { Send, Paperclip, Smile } from "lucide-react";
import EmojiPicker from "emoji-picker-react";
import { toast } from "@onehash/ui/sonner";
import { cn } from "@/lib/utils";
import { getTemplates, type TemplateResponse } from "@/api/templates";
import { convert as htmlToText } from "html-to-text";

// Convert HTML template body to readable plain text using html-to-text.
export function htmlToPlainText(html: string): string {
  if (!html || typeof html !== "string") return "";
  return htmlToText(html, {
    wordwrap: false,
    preserveNewlines: true,
    selectors: [{ selector: "a", options: { ignoreHref: false } }],
  }).trim();
}

// Substitute template variables. Only replaces when value is present; otherwise leaves placeholder.
export function substituteTemplateVariables(
  text: string,
  opts: { candidateName?: string; jobTitle?: string; organizationName?: string },
): string {
  const candidateName = opts.candidateName ?? "";
  const jobTitle = (opts.jobTitle ?? "").trim();
  const organizationName = (opts.organizationName ?? "").trim();

  return text
    .replace(/\{\{candidate_name\}\}/gi, candidateName)
    .replace(/\{\{job_title\}\}/gi, jobTitle || "{{job_title}}")
    .replace(/\{jobTitle\}/g, jobTitle || "{jobTitle}")
    .replace(/\{\{company_name\}\}/gi, organizationName || "{{company_name}}");
}

interface ComposeMessageBoxProps {
  /** Pre-filled reply-to address (candidate email). Editable by the user. */
  toEmail: string;
  jobTitle?: string;
  candidateName?: string;
  organizationName?: string;
  onSend: (body: string) => Promise<void>;
}

export function ComposeMessageBox({
  toEmail,
  jobTitle = "",
  candidateName,
  organizationName,
  onSend,
}: ComposeMessageBoxProps) {
  const [to, setTo] = useState(toEmail);
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [templates, setTemplates] = useState<TemplateResponse[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templatePickerIndex, setTemplatePickerIndex] = useState(0);
  const [pickerRect, setPickerRect] = useState<DOMRect | null>(null);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const showTemplatePicker = body.endsWith("/");

  const insertEmoji = (emoji: string) => {
    const ta = textareaRef.current;
    if (ta) {
      const start = ta.selectionStart ?? body.length;
      const end = ta.selectionEnd ?? body.length;
      const newBody = body.slice(0, start) + emoji + body.slice(end);
      setBody(newBody);
      setEmojiPickerOpen(false);
      requestAnimationFrame(() => {
        ta.focus();
        const pos = start + emoji.length;
        ta.setSelectionRange(pos, pos);
      });
    } else {
      setBody((prev) => prev + emoji);
      setEmojiPickerOpen(false);
    }
  };

  // Load real email templates from API
  useEffect(() => {
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
  }, []);

  // Keep "to" in sync when the parent switches to a different conversation
  useEffect(() => {
    setTo(toEmail);
  }, [toEmail]);

  // Reset template picker index when picker opens
  useEffect(() => {
    if (showTemplatePicker) setTemplatePickerIndex(0);
  }, [showTemplatePicker]);

  // Position picker below textarea (for portal) when "/" is typed
  useLayoutEffect(() => {
    if (!showTemplatePicker || !textareaRef.current) {
      setPickerRect(null);
      return;
    }
    const rect = textareaRef.current.getBoundingClientRect();
    setPickerRect(rect);
  }, [showTemplatePicker, body]);

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

  const insertTemplate = (t: TemplateResponse) => {
    const withVariables = substituteTemplateVariables(t.body, {
      candidateName: candidateName ?? "",
      jobTitle,
      organizationName,
    });
    const content = htmlToPlainText(withVariables);
    if (showTemplatePicker) {
      setBody(body.slice(0, -1) + content);
    } else {
      setBody(content);
    }
  };

  const handleBodyChange = (value: string) => {
    setBody(value);
  };

  const handleBodyKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      void handleSend();
      return;
    }
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
      <div className="p-3 space-y-2 relative">
        <Textarea
          ref={textareaRef}
          placeholder="Type your message or Start with / to choose a Template"
          value={body}
          onChange={(e) => handleBodyChange(e.target.value)}
          className="min-h-[80px] resize-none text-xs"
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
                  <div className="px-3 py-2 text-xs text-muted-foreground">Loading templates…</div>
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
                        i === templatePickerIndex && "bg-accent text-accent-foreground",
                      )}
                      onClick={() => insertTemplate(t)}
                    >
                      {t.name}
                    </button>
                  ))
                )}
              </div>
            </div>,
            document.body,
          )}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Popover open={emojiPickerOpen} onOpenChange={setEmojiPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title="Insert emoji"
                >
                  <Smile className="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="w-auto p-0 border-0 bg-transparent shadow-none"
              >
                <EmojiPicker
                  onEmojiClick={(data: { emoji: string }) => insertEmoji(data.emoji)}
                  width={320}
                  height={360}
                />
              </PopoverContent>
            </Popover>
            <Button variant="ghost" size="icon" className="h-7 w-7" title="Attach file">
              <Paperclip className="h-3.5 w-3.5" />
            </Button>
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

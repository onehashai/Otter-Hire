"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, CheckCheck, ChevronDown, Mail, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import { getWebSocketBaseUrl } from "@/api/client/client";
import {
  createConversation,
  getConversation,
  getConversationByCandidateId,
  sendMessage,
  type ConversationDetail,
  type MessageAttachment,
  type MessageRead,
} from "@/api/conversations";
import { formatTimestamp } from "@/lib/format-date";
import { toast } from "@onehash/ui/sonner";
import { ComposeMessageBox } from "@/components/common/ComposeMessageBox";

function defaultEmailSubject(jobTitle: string | null | undefined, candidateName: string): string {
  const j = jobTitle?.trim();
  if (j) return `Re: ${j}`.slice(0, 1000);
  return `Conversation with ${candidateName}`.slice(0, 1000);
}

function OutboundStatus({ status }: { status: MessageRead["status"] | undefined }) {
  if (!status || status === "received") return null;
  const label =
    status === "queued"
      ? "Sending…"
      : status === "sent"
        ? "Sent"
        : status === "delivered"
          ? "Delivered"
          : status === "read"
            ? "Read"
            : status === "failed"
              ? "Failed"
              : null;
  if (!label) return null;
  const done =
    status === "delivered" ? (
      <CheckCheck className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
    ) : status === "read" ? (
      <CheckCheck className="h-3 w-3 shrink-0 text-blue-600" aria-hidden />
    ) : status === "sent" ? (
      <Check className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
    ) : null;
  return (
    <p
      className={cn(
        "text-[10px] mt-1.5 flex items-center justify-end gap-1",
        status === "read" ? "text-blue-600" : "text-muted-foreground",
      )}
    >
      {done}
      <span>{label}</span>
    </p>
  );
}

function QuotedBodyToggle({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const trimmed = text.trim();
  if (!trimmed) return null;
  return (
    <div className="mt-2 pt-2 border-t border-border/70">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronDown
          className={cn("h-3.5 w-3.5 transition-transform shrink-0", open && "rotate-180")}
          aria-hidden
        />
        Show quoted text
      </button>
      {open ? (
        <p className="mt-2 text-[11px] text-muted-foreground whitespace-pre-wrap break-words leading-relaxed max-h-48 overflow-y-auto">
          {trimmed}
        </p>
      ) : null}
    </div>
  );
}

export type CandidateMessagesTabProps = {
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  jobId?: string | null;
  jobTitle?: string | null;
  organizationName?: string | null;
};

export function CandidateMessagesTab({
  candidateId,
  candidateName,
  candidateEmail,
  jobId,
  jobTitle,
  organizationName,
}: CandidateMessagesTabProps) {
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const pendingMessageIds = useRef<Set<string>>(new Set());
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef<number>(0);
  const threadScrollRef = useRef<HTMLDivElement>(null);
  const POLL_INTERVAL_MS = 2500;
  const POLL_MAX_MS = 30_000;

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    pendingMessageIds.current.clear();
  }, []);

  const startPolling = useCallback(
    (conversationId: string) => {
      if (pollTimerRef.current) return;
      pollStartRef.current = Date.now();
      pollTimerRef.current = setInterval(async () => {
        if (Date.now() - pollStartRef.current > POLL_MAX_MS) {
          stopPolling();
          return;
        }
        try {
          const conv = await getConversation(conversationId);
          setDetail((prev) => {
            if (!prev || prev.id !== conversationId) return prev;
            const updatedMessages = prev.messages.map((m) => {
              const fresh = conv.messages.find((fm) => fm.id === m.id);
              return fresh && fresh.status !== m.status ? fresh : m;
            });
            return { ...prev, messages: updatedMessages };
          });
          for (const mid of pendingMessageIds.current) {
            const fm = conv.messages.find((m) => m.id === mid);
            if (fm && fm.status !== "queued") pendingMessageIds.current.delete(mid);
          }
          if (pendingMessageIds.current.size === 0) stopPolling();
        } catch {
          // ignore
        }
      }, POLL_INTERVAL_MS);
    },
    [stopPolling],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const conv = await getConversationByCandidateId(candidateId);
      setDetail(conv);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load messages");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [candidateId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  useEffect(() => {
    const socket = new WebSocket(getWebSocketBaseUrl());
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as {
          event?: string;
          conversation_id?: string;
          message_id?: string;
          status?: string;
        };
        if (
          data.event !== "message_status_updated" ||
          !data.conversation_id ||
          !data.message_id ||
          !data.status
        )
          return;
        setDetail((prev) => {
          if (!prev || prev.id !== data.conversation_id) return prev;
          return {
            ...prev,
            messages: prev.messages.map((m) =>
              m.id === data.message_id ? { ...m, status: data.status as MessageRead["status"] } : m,
            ),
          };
        });
      } catch {
        // ignore
      }
    };
    return () => {
      if (socket.readyState === WebSocket.OPEN) socket.close();
    };
  }, []);

  /** Pin scroll to the latest messages on load and when the thread grows (not on status-only updates). */
  useLayoutEffect(() => {
    const el = threadScrollRef.current;
    if (!el || loading || !detail?.messages.length) return;
    const scrollToBottom = () => {
      el.scrollTop = el.scrollHeight;
    };
    scrollToBottom();
    requestAnimationFrame(scrollToBottom);
  }, [loading, detail?.id, detail?.messages.length]);

  /** `ComposeMessageBox` passes the message body and already-uploaded attachments. */
  const handleSend = async (body: string, attachments?: MessageAttachment[]) => {
    const text = body.trim();
    const atts = attachments ?? [];
    if (!text && atts.length === 0) return;

    if (!detail) {
      const created = await createConversation({
        candidate_id: candidateId,
        job_id: jobId ?? null,
        subject: defaultEmailSubject(jobTitle, candidateName),
        body: text,
        attachments: atts,
      });
      setDetail(created);
      const last = created.messages[created.messages.length - 1];
      if (last?.status === "queued") {
        pendingMessageIds.current.add(last.id);
        startPolling(created.id);
      }
      return;
    }

    const msg = await sendMessage(detail.id, { body: text, attachments: atts });
    setDetail((prev) => (prev ? { ...prev, messages: [...prev.messages, msg] } : prev));
    if (msg.status === "queued") {
      pendingMessageIds.current.add(msg.id);
      startPolling(detail.id);
    }
  };

  const hasThread = Boolean(detail && detail.messages.length > 0);
  const empty = !loading && !hasThread;

  return (
    <div className="flex flex-col gap-4 min-h-[420px]">
      <div
        className={cn(
          "rounded-xl border border-border bg-background flex-1 min-h-[200px] flex flex-col",
          empty && "items-center justify-center p-8",
        )}
      >
        {loading ? (
          <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground p-8">
            Loading…
          </div>
        ) : empty ? (
          <div className="flex flex-col items-center justify-center text-center gap-3 max-w-sm">
            <div className="h-12 w-12 rounded-full border border-border flex items-center justify-center bg-muted/30">
              <Mail className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">No messages yet</p>
              <p className="text-xs text-muted-foreground">
                Send the first message to start a conversation.
              </p>
            </div>
          </div>
        ) : (
          <div
            ref={threadScrollRef}
            className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[min(420px,50vh)]"
          >
            {(detail?.messages ?? []).map((msg) => {
              const outbound = msg.direction === "outbound";
              const preview = (msg.body_visible ?? msg.body ?? "").trim();
              const when = formatTimestamp(msg.created_at);
              const subject = detail?.subject?.trim() || "(no subject)";
              const fromLabel = outbound
                ? (msg.sender_name ?? msg.from_email)
                : candidateName || msg.from_email;
              return (
                <div
                  key={msg.id}
                  className={cn("flex w-full", outbound ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "flex flex-col w-full max-w-[min(100%,560px)]",
                      outbound ? "items-end" : "items-start",
                    )}
                  >
                    <div
                      className={cn(
                        "w-full rounded-xl border overflow-hidden shadow-sm",
                        outbound ? "border-primary/25" : "border-border",
                      )}
                    >
                      <div
                        className={cn(
                          "px-3 py-2 text-[11px] space-y-1 border-b border-border/80",
                          outbound ? "bg-primary/[0.06]" : "bg-muted/50",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="font-medium text-foreground break-all leading-snug">
                            {fromLabel}
                          </span>
                          <span className="text-[10px] text-muted-foreground shrink-0 pt-0.5">
                            {when}
                          </span>
                        </div>
                        <p className="text-muted-foreground leading-snug">
                          <span className="font-medium text-foreground/90">To:</span> {msg.to_email}
                        </p>
                        <p className="text-muted-foreground leading-snug">
                          <span className="font-medium text-foreground/90">Subject:</span> {subject}
                        </p>
                      </div>
                      <div className="bg-background px-3 py-2.5 text-xs">
                        {preview ? (
                          <div
                            className="whitespace-pre-wrap break-words text-foreground leading-relaxed prose prose-sm max-w-none"
                            dangerouslySetInnerHTML={{ __html: preview }}
                          />
                        ) : null}
                        {msg.body_quoted ? <QuotedBodyToggle text={msg.body_quoted} /> : null}
                        {msg.attachments && msg.attachments.length > 0 ? (
                          <div
                            className={cn(
                              "flex flex-wrap gap-1",
                              preview ? "mt-2 pt-2 border-t border-border/50" : "",
                            )}
                          >
                            {msg.attachments.map((att, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/60 px-2 py-1 text-[11px] text-muted-foreground"
                              >
                                <Paperclip className="h-3 w-3 shrink-0" aria-hidden />
                                <span className="max-w-[180px] truncate">{att.filename}</span>
                              </span>
                            ))}
                          </div>
                        ) : null}
                        {!preview && (!msg.attachments || msg.attachments.length === 0) ? (
                          <span className="text-muted-foreground italic">(empty message)</span>
                        ) : null}
                      </div>
                    </div>
                    {outbound ? <OutboundStatus status={msg.status} /> : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-background overflow-hidden">
        <ComposeMessageBox
          toEmail={candidateEmail}
          candidateId={candidateId}
          jobTitle={jobTitle ?? ""}
          candidateName={candidateName}
          organizationName={organizationName ?? undefined}
          onSend={handleSend}
        />
      </div>
    </div>
  );
}

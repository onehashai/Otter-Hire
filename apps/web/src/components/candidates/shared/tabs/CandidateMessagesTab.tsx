"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { getWebSocketBaseUrl } from "@/api/client/client";
import {
  createConversation,
  getConversation,
  getConversationByCandidateId,
  sendMessage,
  type ConversationDetail,
  type MessageRead,
} from "@/api/conversations";
import { formatTimestampToDateTime } from "@/lib/format-date";
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
  return (
    <p className="text-[10px] text-muted-foreground mt-1 text-right">{label}</p>
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

  /** `ComposeMessageBox` passes the message body; errors bubble so the box can toast. */
  const handleSend = async (body: string) => {
    const text = body.trim();
    if (!text) return;

    if (!detail) {
      const created = await createConversation({
        candidate_id: candidateId,
        job_id: jobId ?? null,
        subject: defaultEmailSubject(jobTitle, candidateName),
        body: text,
      });
      setDetail(created);
      const last = created.messages[created.messages.length - 1];
      if (last?.status === "queued") {
        pendingMessageIds.current.add(last.id);
        startPolling(created.id);
      }
      return;
    }

    const msg = await sendMessage(detail.id, { body: text });
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
              const when = formatTimestampToDateTime(msg.created_at);
              const label =
                outbound
                  ? msg.sender_name ?? "You"
                  : candidateName || msg.from_email;
              return (
                <div
                  key={msg.id}
                  className={cn("flex", outbound ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[90%] rounded-lg border px-3 py-2 text-xs",
                      outbound ? "border-primary/20 bg-primary/5" : "border-border bg-muted/20",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-medium text-foreground truncate">{label}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">{when}</span>
                    </div>
                    <p className="whitespace-pre-wrap break-words text-foreground leading-relaxed">
                      {preview}
                    </p>
                    {outbound && <OutboundStatus status={msg.status} />}
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
          jobTitle={jobTitle ?? ""}
          candidateName={candidateName}
          organizationName={organizationName ?? undefined}
          onSend={handleSend}
        />
      </div>
    </div>
  );
}

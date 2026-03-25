"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@onehash/ui/sonner";
import { Icon } from "@onehash/ui/icon";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { ConversationList, type Conversation } from "./ConversationList";
import { MessageThread, type Message } from "./MessageThread";
import { CandidateContext } from "./CandidateContext";
import { ComposeModal } from "./components/ComposeMessageModal";
import { getWebSocketBaseUrl } from "@/api/client/client";
import {
  listConversations,
  getConversation,
  sendMessage,
  type ConversationListItem,
  type ConversationDetail,
  type MessageRead,
} from "@/api/conversations";
import { getCandidateById, type CandidateDetailResponse } from "@/api/candidates";
import { getMyOrganization } from "@/api/organization/me";
import type { OrganizationResponse } from "@/api/organization/update";
import { formatTimestamp } from "@/lib/format-date";

function mapConversation(item: ConversationListItem): Conversation {
  return {
    id: item.id,
    candidateName: item.candidate.name,
    candidateEmail: item.candidate.email,
    jobTitle: item.subject,
    lastMessage: item.last_message_body ?? "",
    timestamp: formatTimestamp(item.last_message_at ?? item.created_at),
    unread: false,
    unreadCount: 0,
    stage: item.status,
  };
}

function mapMessage(msg: MessageRead, subject?: string): Message {
  return {
    id: msg.id,
    sender: msg.direction === "inbound" ? "candidate" : "team",
    senderName: msg.sender_name ?? msg.from_email,
    senderEmail: msg.from_email,
    toEmail: msg.to_email,
    subject: subject,
    content: msg.body,
    bodyVisible: msg.body_visible ?? undefined,
    bodyQuoted: msg.body_quoted ?? undefined,
    timestamp: formatTimestamp(msg.created_at),
    status: msg.status,
  };
}

interface ConversationsViewProps {
  initialId?: string;
}

export function ConversationsView({ initialId }: ConversationsViewProps) {
  const router = useRouter();
  const isMobile = useIsMobile();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [listLoading, setListLoading] = useState(true);

  const [selectedId, setSelectedId] = useState<string | null>(initialId ?? null);
  const [activeConversation, setActiveConversation] = useState<ConversationDetail | null>(null);
  const [candidateDetail, setCandidateDetail] = useState<CandidateDetailResponse | null>(null);
  const [org, setOrg] = useState<OrganizationResponse | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);

  // Mobile: track which panel is visible ("list" | "thread")
  const [mobileView, setMobileView] = useState<"list" | "thread">(initialId ? "thread" : "list");

  const [composeOpen, setComposeOpen] = useState(false);

  // Track whether this is the first load so we can auto-select if no initialId
  const didAutoSelect = useRef(false);

  // Short-lived polling to resolve queued message statuses after sending
  const pendingMessageIds = useRef<Set<string>>(new Set());
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef<number>(0);
  const POLL_INTERVAL_MS = 2500;
  const POLL_MAX_MS = 30_000;

  // Live push: WebSocket for message status updates (delivered, read, failed)
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
        setActiveConversation((prev) => {
          if (!prev || prev.id !== data.conversation_id) return prev;
          return {
            ...prev,
            messages: prev.messages.map((m) =>
              m.id === data.message_id ? { ...m, status: data.status as MessageRead["status"] } : m,
            ),
          };
        });
      } catch {
        // ignore malformed messages
      }
    };
    return () => {
      if (socket.readyState === WebSocket.OPEN) socket.close();
    };
  }, []);

  // Sync selectedId when initialId changes (e.g. URL param changed)
  useEffect(() => {
    if (initialId) setSelectedId(initialId);
  }, [initialId]);

  const refreshList = useCallback(async () => {
    try {
      const res = await listConversations();
      setConversations(res.items.map(mapConversation));
    } catch {
      // Non-critical refresh; suppress errors
    }
  }, []);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    pendingMessageIds.current.clear();
  }, []);

  const startPolling = useCallback(
    (conversationId: string) => {
      if (pollTimerRef.current) return; // already polling
      pollStartRef.current = Date.now();
      pollTimerRef.current = setInterval(async () => {
        if (Date.now() - pollStartRef.current > POLL_MAX_MS) {
          stopPolling();
          return;
        }
        try {
          const conv = await getConversation(conversationId);
          setActiveConversation((prev) => {
            if (!prev || prev.id !== conversationId) return prev;
            // Merge status updates into existing messages
            const updatedMessages = prev.messages.map((m) => {
              const fresh = conv.messages.find((fm) => fm.id === m.id);
              return fresh && fresh.status !== m.status ? fresh : m;
            });
            return { ...prev, messages: updatedMessages };
          });
          // Remove IDs that have resolved
          for (const id of pendingMessageIds.current) {
            const fm = conv.messages.find((m) => m.id === id);
            if (fm && fm.status !== "queued") {
              pendingMessageIds.current.delete(id);
            }
          }
          if (pendingMessageIds.current.size === 0) stopPolling();
        } catch {
          // ignore transient poll errors
        }
      }, POLL_INTERVAL_MS);
    },
    [stopPolling],
  );

  // Stop polling when the selected conversation changes
  useEffect(() => {
    return () => stopPolling();
  }, [selectedId, stopPolling]);

  // Load current org (for company name in templates)
  useEffect(() => {
    getMyOrganization()
      .then(setOrg)
      .catch(() => {});
  }, []);

  // Initial list load
  useEffect(() => {
    setListLoading(true);
    listConversations()
      .then((res) => {
        const mapped = res.items.map(mapConversation);
        setConversations(mapped);
        // Auto-navigate to latest conversation if no initialId was provided
        if (!initialId && !didAutoSelect.current && mapped.length > 0) {
          didAutoSelect.current = true;
          router.replace(`/conversations/${mapped[0].id}`);
        }
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Failed to load conversations");
      })
      .finally(() => setListLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load thread when selectedId changes
  useEffect(() => {
    if (!selectedId) return;
    setThreadLoading(true);
    setActiveConversation(null);
    setCandidateDetail(null);

    getConversation(selectedId)
      .then(async (conv) => {
        setActiveConversation(conv);
        try {
          const cand = await getCandidateById(conv.candidate.id);
          setCandidateDetail(cand);
        } catch {
          // Candidate detail is supplementary; silently skip on failure
        }
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Failed to load conversation");
      })
      .finally(() => setThreadLoading(false));
  }, [selectedId]);

  // When user clicks a conversation in the list → update URL
  const handleSelect = (id: string) => {
    router.push(`/conversations/${id}`);
    if (isMobile) setMobileView("thread");
  };

  const handleBackToList = () => {
    setMobileView("list");
  };

  const handleSend = async (content: string) => {
    if (!selectedId || !activeConversation) return;
    const msg = await sendMessage(selectedId, { body: content });
    setActiveConversation((prev) => (prev ? { ...prev, messages: [...prev.messages, msg] } : prev));
    // Track this queued message and start polling until it resolves
    pendingMessageIds.current.add(msg.id);
    startPolling(selectedId);
    void refreshList();
  };

  const handleConversationCreated = async (newId: string) => {
    await refreshList();
    router.push(`/conversations/${newId}`);
  };

  const messages = (activeConversation?.messages ?? []).map((msg) =>
    mapMessage(msg, activeConversation?.subject),
  );

  const contextActivities = [...messages]
    .reverse()
    .slice(0, 5)
    .map((m) => ({
      label: m.sender === "candidate" ? "Email received" : "Email sent",
      date: m.timestamp,
    }));

  const isEmpty = !listLoading && conversations.length === 0;

  return (
    <div className="flex h-[calc(100dvh-9rem)] md:h-[calc(100dvh-6rem)] overflow-hidden border border-border rounded-lg">
      {/* Left: conversation list */}
      <div
        className={cn(
          "shrink-0 border-r border-border",
          // Mobile: full width, toggle visibility based on mobileView
          isMobile
            ? mobileView === "list"
              ? "flex w-full flex-col"
              : "hidden"
            : "flex w-72 flex-col",
        )}
      >
        {listLoading && conversations.length === 0 ? (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
            Loading…
          </div>
        ) : (
          <ConversationList
            conversations={conversations}
            selectedId={selectedId}
            onSelect={handleSelect}
            onCompose={() => setComposeOpen(true)}
          />
        )}
      </div>

      {/* Center: message thread or empty state */}
      <div
        className={cn(
          "min-w-0",
          // Mobile: full width, toggle visibility based on mobileView
          isMobile
            ? mobileView === "thread"
              ? "flex flex-1 flex-col"
              : "hidden"
            : "flex flex-1 flex-col",
        )}
      >
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
              <Icon name="MessageSquare" size={24} className="text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold">Select a conversation</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                Select a conversation to see the messages and details.
              </p>
            </div>
          </div>
        ) : threadLoading ? (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
            Loading…
          </div>
        ) : activeConversation ? (
          <MessageThread
            candidateName={activeConversation.candidate.name}
            candidateEmail={activeConversation.candidate.email}
            jobTitle={candidateDetail?.job_title ?? ""}
            organizationName={org?.name ?? ""}
            stage={activeConversation.status}
            messages={messages}
            onSend={handleSend}
            onViewProfile={() => {}}
            onScheduleInterview={() => {}}
            onMoveStage={() => {}}
            onBack={isMobile ? handleBackToList : undefined}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            Select a conversation
          </div>
        )}
      </div>

      {/* Right: candidate context — only visible on large screens */}
      {activeConversation && (
        <div className="w-64 shrink-0 border-l border-border hidden lg:block">
          <CandidateContext
            name={activeConversation.candidate.name}
            email={activeConversation.candidate.email}
            phone={candidateDetail?.phone ?? "—"}
            location={candidateDetail?.location ?? "—"}
            activities={contextActivities}
          />
        </div>
      )}

      <ComposeModal
        open={composeOpen}
        onOpenChange={setComposeOpen}
        onCreated={handleConversationCreated}
        organizationName={org?.name ?? ""}
      />
    </div>
  );
}

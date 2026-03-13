"use client";

import { useState } from "react";
import { Avatar, AvatarFallback } from "@onehash/ui/avatar";
import { Button } from "@onehash/ui/button";
import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Clock,
  Check,
  CheckCheck,
  Eye,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ComposeMessageBox } from "./components/ComposeMessageBox";

export type MessageStatus = "queued" | "sent" | "delivered" | "read" | "failed" | "received";

export interface Message {
  id: string;
  sender: "candidate" | "team";
  senderName: string;
  senderEmail: string;
  toEmail: string;
  ccEmail?: string;
  subject?: string;
  content: string;
  bodyVisible?: string;
  bodyQuoted?: string;
  timestamp: string;
  status?: MessageStatus;
  type?: "email" | "note" | "system";
}

interface MessageThreadProps {
  candidateName: string;
  candidateEmail: string;
  jobTitle: string;
  organizationName?: string;
  stage: string;
  messages: Message[];
  onSend: (content: string) => Promise<void>;
  onViewProfile: () => void;
  onScheduleInterview: () => void;
  onMoveStage: () => void;
  onBack?: () => void;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function OutboundStatus({ status }: { status: MessageStatus | undefined }) {
  if (!status || status === "received") return null;

  const map: Record<string, { icon: React.ReactNode; label: string; className: string }> = {
    queued: {
      icon: <Clock className="h-3 w-3" />,
      label: "Sending…",
      className: "text-amber-500",
    },
    sent: {
      icon: <Check className="h-3 w-3" />,
      label: "Sent",
      className: "text-muted-foreground",
    },
    delivered: {
      icon: <CheckCheck className="h-3 w-3" />,
      label: "Delivered",
      className: "text-muted-foreground",
    },
    read: {
      icon: <Eye className="h-3 w-3" />,
      label: "Read",
      className: "text-blue-500",
    },
    failed: {
      icon: <AlertCircle className="h-3 w-3" />,
      label: "Failed to deliver",
      className: "text-destructive",
    },
  };

  const cfg = map[status];
  if (!cfg) return null;

  return (
    <div className={cn("flex items-center justify-end gap-1 mt-1 pr-0.5", cfg.className)}>
      {cfg.icon}
      <span className="text-[10px]">{cfg.label}</span>
    </div>
  );
}

function EmailCard({ msg }: { msg: Message }) {
  const [showQuoted, setShowQuoted] = useState(false);
  const main = msg.bodyVisible ?? msg.content;
  const quoted = msg.bodyQuoted ?? null;

  const isOutbound = msg.sender === "team";
  const initials = getInitials(msg.senderName);
  const fromDisplay =
    msg.senderName && msg.senderName !== msg.senderEmail
      ? `${msg.senderName} <${msg.senderEmail}>`
      : msg.senderEmail;

  return (
    // Outbound → push right; inbound → push left
    <div className={cn("flex", isOutbound ? "justify-end" : "justify-start")}>
      <div className="w-[84%]">
        <div
          className={cn(
            "border rounded-lg overflow-hidden text-xs",
            isOutbound && msg.status === "failed"
              ? "border-destructive/40"
              : isOutbound
                ? "border-primary/20"
                : "border-border",
          )}
        >
          <div
            className={cn(
              "px-4 py-3 space-y-1.5 border-b",
              isOutbound ? "bg-primary/5 border-primary/15" : "bg-muted/20 border-border/60",
            )}
          >
            <div className="flex items-start gap-2.5">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-medium text-foreground truncate">{fromDisplay}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {msg.timestamp}
                  </span>
                </div>
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground/70">To:</span> {msg.toEmail}
                </p>
                {msg.ccEmail && (
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground/70">Cc:</span> {msg.ccEmail}
                  </p>
                )}
                {msg.subject && (
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground/70">Subject:</span> {msg.subject}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="px-4 py-3">
            <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-foreground">
              {main}
            </pre>
            {quoted && (
              <div className="mt-3">
                <button
                  onClick={() => setShowQuoted(!showQuoted)}
                  className="flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showQuoted ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                  {showQuoted ? "Hide Quoted Text" : "Show Quoted Text"}
                </button>
                {showQuoted && (
                  <pre className="mt-2 whitespace-pre-wrap font-sans text-[11px] leading-relaxed text-muted-foreground border-l-2 border-border pl-3">
                    {quoted}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>

        {isOutbound && <OutboundStatus status={msg.status} />}
      </div>
    </div>
  );
}

export function MessageThread({
  candidateName,
  candidateEmail,
  jobTitle,
  organizationName,
  stage,
  messages,
  onSend,
  onViewProfile,
  onScheduleInterview,
  onMoveStage,
  onBack,
}: MessageThreadProps) {
  const initials = getInitials(candidateName);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2.5 min-w-0">
          {onBack && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 -ml-1 mr-0.5"
              onClick={onBack}
              aria-label="Back to conversations"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          )}
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-foreground truncate">{candidateName}</h3>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg) => (
          <EmailCard key={msg.id} msg={msg} />
        ))}
      </div>

      <ComposeMessageBox
        toEmail={candidateEmail}
        jobTitle={jobTitle}
        candidateName={candidateName}
        organizationName={organizationName}
        onSend={onSend}
      />
    </div>
  );
}

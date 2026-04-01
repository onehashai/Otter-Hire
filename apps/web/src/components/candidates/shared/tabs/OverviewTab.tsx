"use client";

import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@onehash/ui/card";
import { Icon } from "@onehash/ui/icon";
import { cn } from "@/lib/utils";
import { formatTimestamp } from "@/lib/format-date";
import { useAuthSession } from "@/app/providers";
import { MentionNotesEditor } from "@onehash/ui/editor";
interface TimelineItem {
  action: string;
  date: string;
  user: string;
  icon: string;
}

interface Note {
  user: string;
  date: string;
  text: string;
  mentions?: Array<{
    user_id: string;
    name: string | null;
    email: string;
  }>;
}

/** Inline @mentions styled once (no duplicate chips below). */
function renderNoteBodyWithMentions(text: string, mentions: Note["mentions"]): ReactNode[] {
  if (!text) return [];
  const sorted = [...(mentions ?? [])]
    .map((m) => ({ label: (m.name || m.email).trim() }))
    .filter((m) => m.label.length > 0)
    .sort((a, b) => b.label.length - a.label.length);

  const out: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < text.length) {
    if (text[i] !== "@") {
      const start = i;
      while (i < text.length && text[i] !== "@") i++;
      out.push(<span key={`t-${key++}`}>{text.slice(start, i)}</span>);
      continue;
    }

    let matched = false;
    for (const m of sorted) {
      const rest = text.slice(i + 1);
      if (rest.startsWith(m.label)) {
        const after = i + 1 + m.label.length;
        if (after >= text.length || /\s/.test(text[after])) {
          out.push(
            <span
              key={`m-${key++}`}
              className="font-medium text-foreground [overflow-wrap:anywhere]"
            >
              {text.slice(i, after)}
            </span>,
          );
          i = after;
          matched = true;
          break;
        }
      }
    }

    if (!matched) {
      const start = i;
      i++;
      while (i < text.length && !/\s/.test(text[i])) i++;
      out.push(
        <span key={`p-${key++}`} className="font-medium text-foreground">
          {text.slice(start, i)}
        </span>,
      );
    }
  }

  return out;
}

interface MentionableUser {
  id: string;
  name: string | null;
  email: string;
  status: string;
}

interface OverviewTabProps {
  timeline: TimelineItem[];
  notes: Note[];
  mentionableUsers?: MentionableUser[];
  onAddNote?: (content: string, mentions: string[]) => Promise<void>;
  timelineTitle?: string;
  timelineEmptyText?: string;
  showTimeline?: boolean;
}

const TimelineIcon = ({ type }: { type: string }) => {
  const cls = "h-3.5 w-3.5";
  if (type === "apply") return <Icon name="Users" className={cls} />;
  if (type === "move") return <Icon name="UserCheck" className={cls} />;
  if (type === "feedback") return <Icon name="Send" className={cls} />;
  return <Icon name="Clock" className={cls} />;
};

/** Caps height so long content scrolls inside the card instead of stretching the page. */
const scrollableTimelineClass =
  "max-h-[min(26rem,50vh)] overflow-y-auto overflow-x-hidden overscroll-contain pr-1 min-h-0";
export function OverviewTab({
  timeline,
  notes,
  mentionableUsers = [],
  onAddNote,
  timelineTitle = "Timeline",
  timelineEmptyText = "No timeline events yet.",
  showTimeline = true,
}: OverviewTabProps) {
  const { user: sessionUser } = useAuthSession();

  return (
    <div className="space-y-4">
      {showTimeline ? (
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-medium">{timelineTitle}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className={scrollableTimelineClass}>
              {timeline.length === 0 ? (
                <p className="text-xs text-muted-foreground">{timelineEmptyText}</p>
              ) : (
                <div className="space-y-3">
                  {timeline.map((item, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0">
                          <TimelineIcon type={item.icon} />
                        </div>
                        {i < timeline.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                      </div>
                      <div className="flex-1 min-w-0 pb-3">
                        <div className="min-w-0">
                          <p className="text-xs font-medium">{item.action}</p>
                          <p className="text-[10px] text-muted-foreground tabular-nums">
                            {formatTimestamp(item.date)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Notes */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-xs font-medium">Notes</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          {notes.length === 0 ? (
            <p className="text-xs text-muted-foreground">No notes yet.</p>
          ) : (
            notes.map((note, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-lg border border-border/60 bg-card px-3 py-2.5 shadow-sm",
                  "space-y-1.5",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="text-xs font-medium leading-tight text-foreground [overflow-wrap:anywhere]">
                    {note.user}
                  </span>
                  <time
                    className="shrink-0 text-[10px] text-muted-foreground tabular-nums"
                    dateTime={note.date}
                    title={note.date}
                  >
                    {formatTimestamp(note.date)}
                  </time>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap [overflow-wrap:anywhere]">
                  {renderNoteBodyWithMentions(note.text, note.mentions)}
                </p>
              </div>
            ))
          )}
          <MentionNotesEditor
            mentionableUsers={mentionableUsers}
            excludeUserId={sessionUser?.id}
            onAddNote={onAddNote}
          />
        </CardContent>
      </Card>
    </div>
  );
}

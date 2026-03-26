"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@onehash/ui/card";
import { Button } from "@onehash/ui/button";
import { Textarea } from "@onehash/ui/textarea";
import { Icon } from "@onehash/ui/icon";
import { cn } from "@/lib/utils";
import { formatDayMonth, formatTimestampToDateTime } from "@/lib/format-date";
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
  /** Shown to the right of the most recent timeline row (first item; API returns newest first). */
  timelineFirstRowAction?: ReactNode;
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
const scrollableNotesListClass =
  "max-h-[min(22rem,42vh)] overflow-y-auto overflow-x-hidden overscroll-contain pr-1 min-h-0";

export function OverviewTab({
  timeline,
  notes,
  mentionableUsers = [],
  onAddNote,
  timelineTitle = "Timeline",
  timelineEmptyText = "No timeline events yet.",
  showTimeline = true,
  timelineFirstRowAction,
}: OverviewTabProps) {
  const [noteText, setNoteText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [selectedMentions, setSelectedMentions] = useState<
    Array<{
      userId: string;
      label: string;
      email: string;
    }>
  >([]);
  const [mentionState, setMentionState] = useState<{
    query: string;
    start: number;
    end: number;
  } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const labelByUserId = useMemo(() => {
    const counts = new Map<string, number>();
    for (const user of mentionableUsers) {
      const baseLabel = (user.name || user.email).trim();
      counts.set(baseLabel.toLowerCase(), (counts.get(baseLabel.toLowerCase()) ?? 0) + 1);
    }

    return new Map(
      mentionableUsers.map((user) => {
        const baseLabel = (user.name || user.email).trim();
        const label = (counts.get(baseLabel.toLowerCase()) ?? 0) > 1 ? user.email : baseLabel;
        return [user.id, label];
      }),
    );
  }, [mentionableUsers]);

  const activeMembers = useMemo(
    () => mentionableUsers.filter((user) => user.status === "active"),
    [mentionableUsers],
  );

  const filteredSuggestions = useMemo(() => {
    if (!mentionState?.query) {
      return [];
    }
    const query = mentionState.query.trim().toLowerCase();
    if (!query) {
      return [];
    }
    return activeMembers
      .filter((user) => {
        const label = (labelByUserId.get(user.id) || user.email).toLowerCase();
        return (
          label.includes(query) ||
          user.email.toLowerCase().includes(query) ||
          (user.name || "").toLowerCase().includes(query)
        );
      })
      .slice(0, 6);
  }, [activeMembers, labelByUserId, mentionState]);

  const syncMentionsWithText = (nextText: string) => {
    setSelectedMentions((current) =>
      current.filter((mention) => nextText.includes(`@${mention.label}`)),
    );
  };

  const updateMentionQuery = (text: string, caretPosition: number) => {
    const beforeCaret = text.slice(0, caretPosition);
    const match = beforeCaret.match(/(^|\s)@([^\s@]{1,64})$/);
    if (!match || match.index === undefined) {
      setMentionState(null);
      return;
    }
    const query = match[2];
    const start = match.index + match[1].length;
    setMentionState({ query, start, end: caretPosition });
  };

  const handleAddNote = async () => {
    const content = noteText.trim();
    if (!content || !onAddNote) return;
    try {
      setSubmitting(true);
      await onAddNote(
        content,
        selectedMentions.map((mention) => mention.userId),
      );
      setNoteText("");
      setSelectedMentions([]);
      setMentionState(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleNoteTextChange = (value: string, caretPosition: number) => {
    setNoteText(value);
    syncMentionsWithText(value);
    updateMentionQuery(value, caretPosition);
  };

  const handleSelectMention = (user: MentionableUser) => {
    if (!mentionState) return;
    const label = labelByUserId.get(user.id) || user.email;
    const nextText = `${noteText.slice(0, mentionState.start)}@${label} ${noteText.slice(mentionState.end)}`;
    setNoteText(nextText);
    setSelectedMentions((current) => {
      if (current.some((mention) => mention.userId === user.id)) {
        return current;
      }
      return [...current, { userId: user.id, label, email: user.email }];
    });
    setMentionState(null);
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const nextCaret = mentionState.start + label.length + 2;
      textarea.focus();
      textarea.setSelectionRange(nextCaret, nextCaret);
    });
  };

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
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs text-muted-foreground min-w-0 flex-1">{timelineEmptyText}</p>
                  {timelineFirstRowAction ? (
                    <div className="shrink-0 pt-0.5">{timelineFirstRowAction}</div>
                  ) : null}
                </div>
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
                      <div className="flex-1 min-w-0 flex items-start justify-between gap-3 pb-3">
                        <div className="min-w-0">
                          <p className="text-xs font-medium">{item.action}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {formatTimestampToDateTime(item.date)}
                          </p>
                        </div>
                        {i === 0 && timelineFirstRowAction ? (
                          <div className="shrink-0 pt-0.5">{timelineFirstRowAction}</div>
                        ) : null}
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
        <CardContent className="p-4 pt-0 flex flex-col gap-3">
          <div className={`${scrollableNotesListClass} space-y-3`}>
            {notes.length === 0 ? (
              <p className="text-xs text-muted-foreground">No notes yet.</p>
            ) : (
              notes.map((note, i) => (
                <div key={i} className="p-3 rounded-md bg-muted/50 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{note.user}</span>
                    <span className="text-[10px] text-muted-foreground">{formatDayMonth(note.date)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{note.text}</p>
                  {note.mentions && note.mentions.length > 0 ? (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {note.mentions.map((mention) => (
                        <span
                          key={mention.user_id}
                          className="rounded-full bg-background px-2 py-0.5 text-[10px] text-muted-foreground"
                        >
                          @{mention.name || mention.email}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
          <div className="relative shrink-0">
            <Textarea
              ref={textareaRef}
              placeholder="Add a note... Use @ to tag a teammate"
              className="text-xs min-h-[60px] resize-none"
              value={noteText}
              onChange={(e) => handleNoteTextChange(e.target.value, e.target.selectionStart)}
              onClick={(e) =>
                updateMentionQuery(e.currentTarget.value, e.currentTarget.selectionStart)
              }
              onKeyUp={(e) =>
                updateMentionQuery(e.currentTarget.value, e.currentTarget.selectionStart)
              }
            />
            {filteredSuggestions.length > 0 && mentionState ? (
              <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-20 rounded-md border bg-background shadow-md">
                {filteredSuggestions.map((user) => {
                  const label = labelByUserId.get(user.id) || user.email;
                  const alreadySelected = selectedMentions.some(
                    (mention) => mention.userId === user.id,
                  );
                  return (
                    <button
                      key={user.id}
                      type="button"
                      className={cn(
                        "flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-muted",
                        alreadySelected && "opacity-60",
                      )}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelectMention(user);
                      }}
                    >
                      <span className="font-medium">{label}</span>
                      <span className="text-[10px] text-muted-foreground">{user.email}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
          {selectedMentions.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {selectedMentions.map((mention) => (
                <span
                  key={mention.userId}
                  className="rounded-full bg-muted px-2 py-1 text-[10px] text-muted-foreground"
                >
                  Will notify @{mention.label}
                </span>
              ))}
            </div>
          ) : null}
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={handleAddNote}
            disabled={!onAddNote || submitting || !noteText.trim()}
          >
            Add Note
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

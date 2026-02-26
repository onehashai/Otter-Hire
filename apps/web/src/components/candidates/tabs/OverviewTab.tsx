"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@onehash/ui/card";
import { Button } from "@onehash/ui/button";
import { Textarea } from "@onehash/ui/textarea";
import { Icon } from "@onehash/ui/icon";

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
}

interface OverviewTabProps {
  timeline: TimelineItem[];
  notes: Note[];
  onAddNote?: (content: string) => Promise<void>;
  timelineTitle?: string;
  timelineEmptyText?: string;
}

const TimelineIcon = ({ type }: { type: string }) => {
  const cls = "h-3.5 w-3.5";
  if (type === "apply") return <Icon name="Users" className={cls} />;
  if (type === "move") return <Icon name="UserCheck" className={cls} />;
  if (type === "feedback") return <Icon name="Send" className={cls} />;
  return <Icon name="Clock" className={cls} />;
};

export function OverviewTab({
  timeline,
  notes,
  onAddNote,
  timelineTitle = "Timeline",
  timelineEmptyText = "No timeline events yet.",
}: OverviewTabProps) {
  const [noteText, setNoteText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleAddNote = async () => {
    const content = noteText.trim();
    if (!content || !onAddNote) return;
    try {
      setSubmitting(true);
      await onAddNote(content);
      setNoteText("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Timeline */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-xs font-medium">{timelineTitle}</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
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
                  <div className="pb-3">
                    <p className="text-xs font-medium">{item.action}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {item.user} · {item.date}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
              <div key={i} className="p-3 rounded-md bg-muted/50 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">{note.user}</span>
                  <span className="text-[10px] text-muted-foreground">{note.date}</span>
                </div>
                <p className="text-xs text-muted-foreground">{note.text}</p>
              </div>
            ))
          )}
          <Textarea
            placeholder="Add a note..."
            className="text-xs min-h-[60px] resize-none"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
          />
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

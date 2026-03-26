"use client";

import { Card, CardContent } from "@onehash/ui/card";
import { Button } from "@onehash/ui/button";
import { Icon } from "@onehash/ui/icon";

type InterviewItem = {
  id: string;
  title: string;
  date: string;
  time: string;
  interviewer: string;
  status: string;
  rating: number | null;
  decision: string | null;
  feedback: string | null;
};

type InterviewsTabProps = {
  interviews: InterviewItem[];
  onScheduleInterview?: () => void;
  onAddFeedback?: (interviewId: string) => void;
};

export function InterviewsTab({
  interviews,
  onScheduleInterview,
  onAddFeedback,
}: InterviewsTabProps) {
  if (!interviews.length) {
    return (
      <Card>
        <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
            <Icon name="CalendarPlus" className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground">No interviews scheduled</p>
          {onScheduleInterview ? (
            <Button size="sm" className="h-7 text-xs gap-1.5" onClick={onScheduleInterview}>
              <Icon name="Plus" className="h-3 w-3" /> Schedule interview
            </Button>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {interviews.map((i) => (
        <Card key={i.id}>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{i.title}</p>
                <p className="text-xs text-muted-foreground">
                  {i.date} · {i.time} · {i.interviewer}
                </p>
              </div>
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                {i.status}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {i.rating !== null ? (
                <span className="text-[10px] rounded-md bg-muted px-2 py-1">
                  Rating: {i.rating}
                </span>
              ) : null}
              {i.decision ? (
                <span className="text-[10px] rounded-md bg-muted px-2 py-1">
                  Decision: {i.decision}
                </span>
              ) : null}
              {onAddFeedback ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => onAddFeedback(i.id)}
                >
                  Add feedback
                </Button>
              ) : null}
            </div>

            {i.feedback ? (
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">{i.feedback}</p>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

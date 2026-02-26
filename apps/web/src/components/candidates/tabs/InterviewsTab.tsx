"use client";

import { Card, CardContent } from "@onehash/ui/card";
import { Button } from "@onehash/ui/button";
import { Badge } from "@onehash/ui/badge";
import { Separator } from "@onehash/ui/separator";
import { Icon } from "@onehash/ui/icon";

interface Interview {
  id: string;
  title: string;
  date: string;
  time: string;
  interviewer: string;
  status: string;
  rating: number | null;
  decision: string | null;
  feedback: string | null;
}

interface InterviewsTabProps {
  interviews: Interview[];
  onScheduleInterview?: () => void;
  onAddFeedback?: (interviewId: string) => void;
}

export function InterviewsTab({
  interviews,
  onScheduleInterview,
  onAddFeedback,
}: InterviewsTabProps) {
  if (interviews.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
            <Icon name="Clock" className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground">No interviews scheduled</p>
          <Button size="sm" className="h-7 text-xs gap-1.5" onClick={onScheduleInterview}>
            <Icon name="Clock" className="h-3 w-3" /> Schedule Interview
          </Button>
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-3">
      {interviews.map((interview) => (
        <Card key={interview.id}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium">{interview.title}</p>
                <p className="text-xs text-muted-foreground">
                  {interview.date} at {interview.time}
                </p>
              </div>
              <Badge
                variant={interview.status === "Completed" ? "default" : "secondary"}
                className="text-[10px]"
              >
                {interview.status}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Icon name="Users" className="h-3 w-3" /> {interview.interviewer}
            </div>
            {interview.feedback && (
              <>
                <Separator />
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">Decision:</span>
                    <Badge
                      variant={
                        interview.decision === "Pass"
                          ? "default"
                          : interview.decision === "Fail"
                            ? "destructive"
                            : "secondary"
                      }
                      className="text-[10px]"
                    >
                      {interview.decision}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{interview.feedback}</p>
                </div>
              </>
            )}
            {!interview.feedback && interview.status === "Scheduled" && (
              <div className="flex gap-1.5">
                <Button variant="outline" size="sm" className="h-7 text-xs">
                  Reschedule
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => onAddFeedback?.(interview.id)}
                >
                  Add Feedback
                </Button>
              </div>
            )}
            {!interview.feedback && interview.status === "Completed" && (
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={() => onAddFeedback?.(interview.id)}
              >
                Add Feedback
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
      {interviews.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5 w-full"
          onClick={onScheduleInterview}
        >
          <Icon name="Clock" className="h-3.5 w-3.5" /> Schedule Another Interview
        </Button>
      )}
    </div>
  );
}

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@onehash/ui/card";
import { Separator } from "@onehash/ui/separator";
import { Progress } from "@onehash/ui/progress";
import { Icon } from "@onehash/ui/icon";

interface Scores {
  technical: number;
  communication: number;
  cultureFit: number;
  overall: number;
}

interface Interview {
  status: string;
}

interface EvaluationTabProps {
  scores: Scores;
  interviews: Interview[];
  decisionCounts?: Record<string, number>;
  feedbackItems?: Array<{
    reviewer_name: string | null;
    decision: string;
    rating: number | null;
    comments: string | null;
    created_at: string;
  }>;
}

const ScoreBar = ({ label, score }: { label: string; score: number }) => (
  <div className="space-y-1">
    <div className="flex justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{score.toFixed(1)}/5</span>
    </div>
    <Progress value={score * 20} className="h-1.5" />
  </div>
);

export function EvaluationTab({
  scores,
  interviews,
  decisionCounts,
  feedbackItems,
}: EvaluationTabProps) {
  const completedInterviews = interviews.filter((i) => i.status === "Completed").length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-xs font-medium">Scorecard</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <ScoreBar label="Technical Skills" score={scores.technical} />
          <ScoreBar label="Communication" score={scores.communication} />
          <ScoreBar label="Culture Fit" score={scores.cultureFit} />
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">Overall</span>
            <div className="flex items-center gap-1.5">
              <Icon name="Crown" className="h-3.5 w-3.5 text-foreground" />
              <span className="text-sm font-semibold">{scores.overall.toFixed(1)}</span>
              <span className="text-xs text-muted-foreground">/ 5.0</span>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-xs font-medium">Recommendation</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="flex items-center gap-2">
            <Icon name="Check" className="h-4 w-4 text-foreground" />
            <span className="text-xs font-medium">
              {scores.overall >= 4 ? "Strong Hire" : scores.overall >= 3 ? "Hire" : "No Hire"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Based on {completedInterviews} completed evaluations.
          </p>
          {decisionCounts && (
            <p className="text-xs text-muted-foreground mt-1">
              Yes: {decisionCounts.yes ?? 0} · Maybe: {decisionCounts.maybe ?? 0} · No:{" "}
              {decisionCounts.no ?? 0}
            </p>
          )}
        </CardContent>
      </Card>
      {feedbackItems && feedbackItems.length > 0 && (
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-medium">Feedback</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-3">
            {feedbackItems.map((f, idx) => (
              <div key={`${f.created_at}-${idx}`} className="rounded-md border border-border p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium">{f.reviewer_name ?? "Reviewer"}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(f.created_at).toLocaleDateString()}
                  </p>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Decision: {f.decision.toUpperCase()} {f.rating ? `· Rating: ${f.rating}/5` : ""}
                </p>
                {f.comments && <p className="text-xs mt-1">{f.comments}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

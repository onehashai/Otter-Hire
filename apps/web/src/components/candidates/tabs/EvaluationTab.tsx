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

export function EvaluationTab({ scores, interviews }: EvaluationTabProps) {
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
              {scores.overall >= 4
                ? "Strong Hire"
                : scores.overall >= 3
                  ? "Hire"
                  : "No Hire"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Based on {completedInterviews} completed evaluations.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

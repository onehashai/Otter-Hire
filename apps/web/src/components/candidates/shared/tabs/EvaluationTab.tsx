"use client";

import { Card, CardContent } from "@onehash/ui/card";
import { Icon } from "@onehash/ui/icon";

type EvaluationTabProps = {
  scores: { technical: number; communication: number; cultureFit: number; overall: number };
  interviews?: Array<{ id: string }>;
  decisionCounts?: Record<string, number> | null;
  feedbackItems?: Array<{
    id: string;
    rating: number | null;
    decision: string;
    comments: string | null;
  }> | null;
};

export function EvaluationTab({ scores, decisionCounts, feedbackItems }: EvaluationTabProps) {
  const hasAny =
    (feedbackItems && feedbackItems.length > 0) ||
    (decisionCounts && Object.keys(decisionCounts).length > 0) ||
    Boolean(scores);

  if (!hasAny) {
    return (
      <Card>
        <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
            <Icon name="Check" className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground">No evaluation yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground mb-2">Scores</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { label: "Technical", value: scores.technical },
              { label: "Communication", value: scores.communication },
              { label: "Culture fit", value: scores.cultureFit },
              { label: "Overall", value: scores.overall },
            ].map((s) => (
              <div key={s.label} className="rounded-md border border-border p-3">
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
                <p className="text-sm font-medium">
                  {Number.isFinite(s.value) ? s.value.toFixed(1) : "—"}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {decisionCounts ? (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">Decisions</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(decisionCounts).map(([k, v]) => (
                <span key={k} className="text-[10px] rounded-md bg-muted px-2 py-1">
                  {k}: {v}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {feedbackItems && feedbackItems.length > 0 ? (
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-xs text-muted-foreground">Feedback</p>
            {feedbackItems.map((f) => (
              <div key={f.id} className="rounded-md border border-border p-3">
                <p className="text-[10px] text-muted-foreground">
                  {f.decision.toUpperCase()}
                  {f.rating !== null ? ` · rating ${f.rating}` : ""}
                </p>
                {f.comments ? (
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap mt-1">
                    {f.comments}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">—</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

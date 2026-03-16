"use client";

import { Card, CardContent } from "@onehash/ui/card";
import { Badge } from "@onehash/ui/badge";
import type { TriggerOption } from "./types";
import type { Action } from "./types";

export interface SummaryStripProps {
  currentTrigger: TriggerOption | undefined;
  triggerStage: string;
  actions: Action[];
}

export function SummaryStrip({
  currentTrigger,
  triggerStage,
  actions,
}: SummaryStripProps) {
  const hasContent = currentTrigger || actions.length > 0;
  if (!hasContent) return null;

  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-medium text-muted-foreground mb-2">Summary</p>
        <div className="flex items-center gap-2 flex-wrap">
          {currentTrigger && (
            <Badge variant="outline" className="text-[10px]">
              When: {currentTrigger.label}
              {currentTrigger.hasStageSelect && triggerStage && ` → ${triggerStage}`}
            </Badge>
          )}
          {actions.map((a) => (
            <Badge key={a.id} variant="secondary" className="text-[10px]">
              → {a.label}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

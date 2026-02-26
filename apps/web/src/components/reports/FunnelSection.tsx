"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@onehash/ui/card";
import { funnelData } from "./data";

export function FunnelSection() {
  const stages = funnelData;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Pipeline Conversion</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {stages.map((stage, i) => {
            const pct = Math.round((stage.value / stages[0].value) * 100);
            const dropOff =
              i > 0
                ? Math.round(((stages[i - 1].value - stage.value) / stages[i - 1].value) * 100)
                : 0;
            return (
              <div key={stage.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{stage.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{stage.value.toLocaleString()}</span>
                    {i > 0 && (
                      <span className="text-[10px] text-muted-foreground">-{dropOff}%</span>
                    )}
                  </div>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-foreground/80 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, opacity: 1 - i * 0.15 }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 pt-3 border-t flex items-center justify-between text-xs text-muted-foreground">
          <span>Overall: {((34 / 1284) * 100).toFixed(1)}% conversion</span>
        </div>
      </CardContent>
    </Card>
  );
}

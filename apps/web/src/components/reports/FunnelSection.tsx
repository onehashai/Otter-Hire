"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@onehash/ui/card";
import type { FunnelStage } from "@/api/reports";

interface FunnelSectionProps {
  data: FunnelStage[];
}

export function FunnelSection({ data }: FunnelSectionProps) {
  if (!data || data.length === 0) return null;
  const total = data[0].count;
  const hired = data[data.length - 1].count;
  const overallConversion = total > 0 ? ((hired / total) * 100).toFixed(1) : "0.0";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Pipeline Conversion</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {data.map((stage, i) => {
            const pct = total > 0 ? Math.round((stage.count / total) * 100) : 0;
            const prev = i > 0 ? data[i - 1].count : stage.count;
            const dropOff = prev > 0 ? Math.round(((prev - stage.count) / prev) * 100) : 0;
            return (
              <div key={stage.stage_name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{stage.stage_name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{stage.count.toLocaleString()}</span>
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
          <span>Overall: {overallConversion}% conversion</span>
        </div>
      </CardContent>
    </Card>
  );
}

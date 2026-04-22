"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@onehash/ui/card";
import type { RecruiterItem } from "@/api/reports";

interface RecruiterPerformanceCardProps {
  data: RecruiterItem[];
  /** Limit number of recruiters shown (default: show all) */
  limit?: number;
}

export function RecruiterPerformanceCard({ data, limit }: RecruiterPerformanceCardProps) {
  const displayed = limit ? data.slice(0, limit) : data;
  const maxHires = Math.max(...displayed.map((r) => r.hires), 1);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Recruiter Performance</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {displayed.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            No recruiter data for this period
          </div>
        ) : (
          <div className="space-y-4">
            {displayed.map((recruiter) => {
              const barWidth = maxHires > 0 ? (recruiter.hires / maxHires) * 100 : 0;
              return (
                <div key={recruiter.user_id} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium truncate max-w-[55%]">
                      {recruiter.name}
                    </span>
                    <div className="flex items-center gap-2 shrink-0 text-[11px] text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {recruiter.hires} hire{recruiter.hires !== 1 ? "s" : ""}
                      </span>
                      {recruiter.avg_days > 0 && <span>{Math.round(recruiter.avg_days)}d avg</span>}
                    </div>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-foreground/70 rounded-full transition-all duration-500"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {recruiter.candidates} candidate{recruiter.candidates !== 1 ? "s" : ""} ·{" "}
                    {recruiter.interviews} interview{recruiter.interviews !== 1 ? "s" : ""}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

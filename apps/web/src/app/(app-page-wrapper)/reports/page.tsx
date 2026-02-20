"use client";

import { Card, CardContent } from "@onehash/ui/card";
import { Button } from "@onehash/ui/button";
import { Download } from "lucide-react";

const charts = [
  { title: "Time to Hire", value: "23 days", subtitle: "avg. across all roles" },
  { title: "Source Performance", value: "LinkedIn", subtitle: "highest quality source" },
  { title: "Funnel Conversion", value: "4.8%", subtitle: "applied → hired rate" },
  { title: "Diversity Metrics", value: "42%", subtitle: "underrepresented groups" },
  { title: "Team Activity", value: "156", subtitle: "actions this week" },
  { title: "Open Roles", value: "12", subtitle: "across 5 departments" },
];

export default function ReportsPage() {
  return (
    <div className="space-y-3 md:space-y-4">
      <div className="flex items-center justify-between overflow-x-auto gap-2">
        <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
          <Button variant="outline" size="sm" className="h-9 md:h-8 text-xs">30 days</Button>
          <Button variant="ghost" size="sm" className="h-9 md:h-8 text-xs text-muted-foreground">90 days</Button>
          <Button variant="ghost" size="sm" className="h-9 md:h-8 text-xs text-muted-foreground">Year</Button>
        </div>
        <Button variant="outline" size="sm" className="h-9 md:h-8 text-xs gap-1.5 shrink-0">
          <Download className="h-3.5 w-3.5" /><span className="hidden sm:inline">Export</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {charts.map((chart) => (
          <Card key={chart.title}>
            <CardContent className="p-4 md:p-5">
              <p className="text-[11px] md:text-xs text-muted-foreground mb-1">{chart.title}</p>
              <p className="text-xl md:text-2xl font-semibold">{chart.value}</p>
              <p className="text-[10px] md:text-[11px] text-muted-foreground mt-0.5 md:mt-1">{chart.subtitle}</p>
              <div className="mt-3 md:mt-4 h-16 md:h-20 bg-muted/50 rounded-lg flex items-center justify-center">
                <span className="text-[10px] text-muted-foreground">Chart</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

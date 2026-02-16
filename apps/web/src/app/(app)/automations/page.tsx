"use client";

import { Card, CardContent, Button, Badge, Switch } from "@onehash/ui";
import { Plus, Zap, ArrowRight } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

const automations = [
  { name: "Auto-reject unqualified", trigger: "New application", action: "Send rejection email", enabled: true },
  { name: "Schedule screening", trigger: "Candidate moves to Screening", action: "Send calendar link", enabled: true },
  { name: "Notify hiring manager", trigger: "Interview completed", action: "Send Slack message", enabled: false },
  { name: "Tag senior candidates", trigger: "Experience > 5 years", action: "Add 'Senior' tag", enabled: true },
];

export default function AutomationsPage() {
  const isMobile = useIsMobile();

  return (
    <div className="space-y-3 md:space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground hidden md:block">Automate repetitive tasks in your hiring workflow</p>
        <Button size="sm" className="h-9 md:h-8 text-xs gap-1.5 hidden md:flex">
          <Plus className="h-3.5 w-3.5" /> New Automation
        </Button>
      </div>

      <div className="space-y-2">
        {automations.map((a) => (
          <Card key={a.name} className="active:bg-muted/50 md:hover:shadow-sm transition-all">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Zap className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{a.name}</p>
                    <div className={isMobile ? "mt-1.5 space-y-1" : "flex items-center gap-1.5 mt-0.5"}>
                      <Badge variant="outline" className="text-[10px]">{a.trigger}</Badge>
                      {!isMobile && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
                      <Badge variant="outline" className="text-[10px]">{a.action}</Badge>
                    </div>
                  </div>
                </div>
                <Switch checked={a.enabled} className="shrink-0 mt-1" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

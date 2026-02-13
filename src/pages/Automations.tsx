import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Zap, ArrowRight } from "lucide-react";
import { Switch } from "@/components/ui/switch";

const automations = [
  { name: "Auto-reject unqualified", trigger: "New application", action: "Send rejection email", enabled: true },
  { name: "Schedule screening", trigger: "Candidate moves to Screening", action: "Send calendar link", enabled: true },
  { name: "Notify hiring manager", trigger: "Interview completed", action: "Send Slack message", enabled: false },
  { name: "Tag senior candidates", trigger: "Experience > 5 years", action: "Add 'Senior' tag", enabled: true },
];

const Automations = () => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Automate repetitive tasks in your hiring workflow</p>
        <Button size="sm" className="h-8 text-xs gap-1.5">
          <Plus className="h-3.5 w-3.5" /> New Automation
        </Button>
      </div>

      <div className="space-y-2">
        {automations.map((a) => (
          <Card key={a.name} className="hover:shadow-sm transition-shadow">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                  <Zap className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">{a.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Badge variant="outline" className="text-[10px]">{a.trigger}</Badge>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <Badge variant="outline" className="text-[10px]">{a.action}</Badge>
                  </div>
                </div>
              </div>
              <Switch checked={a.enabled} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Automations;

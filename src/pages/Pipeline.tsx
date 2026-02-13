import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Settings2, List } from "lucide-react";

const stages = [
  {
    name: "Applied",
    candidates: [
      { name: "Emma Wilson", role: "Frontend Engineer", score: 78 },
      { name: "Liam Park", role: "Frontend Engineer", score: 65 },
    ],
  },
  {
    name: "Screening",
    candidates: [
      { name: "Sam Chen", role: "Data Scientist", score: 76 },
    ],
  },
  {
    name: "Interview",
    candidates: [
      { name: "Alex Rivera", role: "Sr. Frontend Engineer", score: 92 },
      { name: "Jordan Lee", role: "Engineering Manager", score: 85 },
    ],
  },
  {
    name: "Offer",
    candidates: [
      { name: "Maria Kim", role: "Product Designer", score: 88 },
    ],
  },
  {
    name: "Hired",
    candidates: [],
  },
];

const Pipeline = () => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
            <Settings2 className="h-3.5 w-3.5" /> Edit Stages
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
            <List className="h-3.5 w-3.5" /> List View
          </Button>
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4">
        {stages.map((stage) => (
          <div key={stage.name} className="min-w-[240px] w-[240px] shrink-0">
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{stage.name}</h3>
              <Badge variant="secondary" className="text-[10px] h-5">{stage.candidates.length}</Badge>
            </div>
            <div className="space-y-2">
              {stage.candidates.map((c) => (
                <Card key={c.name} className="cursor-pointer hover:shadow-sm transition-shadow">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-[10px] bg-muted">{c.name.split(" ").map(n => n[0]).join("")}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">{c.name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">{c.role}</span>
                      <span className="text-[11px] font-medium">{c.score}%</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {stage.candidates.length === 0 && (
                <div className="border border-dashed border-border rounded-xl p-6 text-center">
                  <p className="text-xs text-muted-foreground">No candidates</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Pipeline;

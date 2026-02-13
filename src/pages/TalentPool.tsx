import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, Filter, UserPlus } from "lucide-react";

const poolCandidates = [
  { name: "Chris Evans", tags: ["React", "Node.js"], source: "Referral", lastContact: "2w ago", engagement: "High" },
  { name: "Priya Patel", tags: ["Python", "ML"], source: "LinkedIn", lastContact: "1m ago", engagement: "Medium" },
  { name: "Tom Hardy", tags: ["Design", "Figma"], source: "Event", lastContact: "3w ago", engagement: "Low" },
  { name: "Ana Silva", tags: ["Go", "K8s"], source: "Direct", lastContact: "5d ago", engagement: "High" },
];

const TalentPool = () => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Search talent pool..." className="h-8 w-56 pl-8 text-xs" />
          </div>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
            <Filter className="h-3.5 w-3.5" /> Filters
          </Button>
        </div>
        <Button size="sm" className="h-8 text-xs gap-1.5">
          <UserPlus className="h-3.5 w-3.5" /> Add to Pool
        </Button>
      </div>

      <div className="space-y-2">
        {poolCandidates.map((c) => (
          <Card key={c.name} className="hover:shadow-sm transition-shadow">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="text-[10px] bg-muted">{c.name.split(" ").map(n => n[0]).join("")}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{c.name}</p>
                  <div className="flex gap-1 mt-0.5">
                    {c.tags.map(t => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>{c.source}</span>
                <span>{c.lastContact}</span>
                <Badge variant={c.engagement === "High" ? "default" : "secondary"} className="text-[10px]">{c.engagement}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default TalentPool;

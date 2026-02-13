import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, Filter, UserPlus } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

const poolCandidates = [
  { name: "Chris Evans", tags: ["React", "Node.js"], source: "Referral", lastContact: "2w ago", engagement: "High" },
  { name: "Priya Patel", tags: ["Python", "ML"], source: "LinkedIn", lastContact: "1m ago", engagement: "Medium" },
  { name: "Tom Hardy", tags: ["Design", "Figma"], source: "Event", lastContact: "3w ago", engagement: "Low" },
  { name: "Ana Silva", tags: ["Go", "K8s"], source: "Direct", lastContact: "5d ago", engagement: "High" },
];

const TalentPool = () => {
  const isMobile = useIsMobile();

  return (
    <div className="space-y-3 md:space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 md:flex-none">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search talent pool..." className="h-9 md:h-8 pl-8 text-xs md:w-56" />
        </div>
        <Button variant="outline" size="sm" className="h-9 md:h-8 text-xs gap-1.5 shrink-0">
          <Filter className="h-3.5 w-3.5" /><span className="hidden sm:inline">Filters</span>
        </Button>
        <Button size="sm" className="h-9 md:h-8 text-xs gap-1.5 shrink-0 hidden md:flex">
          <UserPlus className="h-3.5 w-3.5" /> Add to Pool
        </Button>
      </div>

      <div className="space-y-2">
        {poolCandidates.map((c) => (
          <Card key={c.name} className="active:bg-muted/50 md:hover:shadow-sm transition-all">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8 md:h-7 md:w-7">
                  <AvatarFallback className="text-xs md:text-[10px] bg-muted">{c.name.split(" ").map(n => n[0]).join("")}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{c.name}</p>
                    <Badge variant={c.engagement === "High" ? "default" : "secondary"} className="text-[10px] shrink-0">{c.engagement}</Badge>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {c.tags.map(t => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}
                    {!isMobile && (
                      <span className="text-[11px] text-muted-foreground ml-1">{c.source} · {c.lastContact}</span>
                    )}
                  </div>
                  {isMobile && (
                    <p className="text-[11px] text-muted-foreground mt-1">{c.source} · {c.lastContact}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default TalentPool;

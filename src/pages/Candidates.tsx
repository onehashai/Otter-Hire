import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, Filter, UserPlus } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const candidates = [
  { name: "Alex Rivera", role: "Sr. Frontend Engineer", stage: "Interview", tags: ["React", "TypeScript"], score: 92, added: "2d ago" },
  { name: "Maria Kim", role: "Product Designer", stage: "Offer", tags: ["Figma", "UI/UX"], score: 88, added: "5d ago" },
  { name: "Sam Chen", role: "Data Scientist", stage: "Screening", tags: ["Python", "ML"], score: 76, added: "1d ago" },
  { name: "Jordan Lee", role: "Engineering Manager", stage: "Interview", tags: ["Leadership", "Agile"], score: 85, added: "3d ago" },
  { name: "Taylor Swift", role: "Marketing Lead", stage: "Applied", tags: ["Growth", "SEO"], score: 70, added: "4h ago" },
];

const Candidates = () => {
  const isMobile = useIsMobile();

  return (
    <div className="space-y-3 md:space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 md:flex-none">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search candidates..." className="h-9 md:h-8 pl-8 text-xs md:w-56" />
        </div>
        <Button variant="outline" size="sm" className="h-9 md:h-8 text-xs gap-1.5 shrink-0">
          <Filter className="h-3.5 w-3.5" /><span className="hidden sm:inline">Filters</span>
        </Button>
        <Button size="sm" className="h-9 md:h-8 text-xs gap-1.5 shrink-0 hidden md:flex">
          <UserPlus className="h-3.5 w-3.5" /> Add Candidate
        </Button>
      </div>

      {isMobile ? (
        <div className="space-y-2">
          {candidates.map((c) => (
            <Card key={c.name} className="active:bg-muted/50 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center gap-2.5 mb-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs bg-muted">{c.name.split(" ").map(n => n[0]).join("")}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium truncate">{c.name}</span>
                      <span className="text-xs font-medium">{c.score}%</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{c.role}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge variant="secondary" className="text-[10px]">{c.stage}</Badge>
                  {c.tags.map(t => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Name</TableHead>
                  <TableHead className="text-xs">Applied For</TableHead>
                  <TableHead className="text-xs">Stage</TableHead>
                  <TableHead className="text-xs">Tags</TableHead>
                  <TableHead className="text-xs text-right">Score</TableHead>
                  <TableHead className="text-xs text-right">Added</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidates.map((c) => (
                  <TableRow key={c.name} className="cursor-pointer hover:bg-muted/50">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-[10px] bg-muted">{c.name.split(" ").map(n => n[0]).join("")}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">{c.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.role}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-[10px]">{c.stage}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {c.tags.map(t => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-right font-medium">{c.score}%</TableCell>
                    <TableCell className="text-xs text-muted-foreground text-right">{c.added}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Candidates;

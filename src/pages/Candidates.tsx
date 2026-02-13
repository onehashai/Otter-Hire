import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, Filter, UserPlus } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const candidates = [
  { name: "Alex Rivera", role: "Sr. Frontend Engineer", stage: "Interview", tags: ["React", "TypeScript"], score: 92, added: "2d ago" },
  { name: "Maria Kim", role: "Product Designer", stage: "Offer", tags: ["Figma", "UI/UX"], score: 88, added: "5d ago" },
  { name: "Sam Chen", role: "Data Scientist", stage: "Screening", tags: ["Python", "ML"], score: 76, added: "1d ago" },
  { name: "Jordan Lee", role: "Engineering Manager", stage: "Interview", tags: ["Leadership", "Agile"], score: 85, added: "3d ago" },
  { name: "Taylor Swift", role: "Marketing Lead", stage: "Applied", tags: ["Growth", "SEO"], score: 70, added: "4h ago" },
];

const Candidates = () => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Search candidates..." className="h-8 w-56 pl-8 text-xs" />
          </div>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
            <Filter className="h-3.5 w-3.5" /> Filters
          </Button>
        </div>
        <Button size="sm" className="h-8 text-xs gap-1.5">
          <UserPlus className="h-3.5 w-3.5" /> Add Candidate
        </Button>
      </div>

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
    </div>
  );
};

export default Candidates;

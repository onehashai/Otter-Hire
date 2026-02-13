import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Filter } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const jobs = [
  { role: "Senior Frontend Engineer", dept: "Engineering", status: "Active", candidates: 34, lastActivity: "2h ago" },
  { role: "Product Designer", dept: "Design", status: "Active", candidates: 22, lastActivity: "5h ago" },
  { role: "Data Scientist", dept: "Data", status: "Draft", candidates: 0, lastActivity: "1d ago" },
  { role: "Engineering Manager", dept: "Engineering", status: "Active", candidates: 18, lastActivity: "3h ago" },
  { role: "Marketing Lead", dept: "Marketing", status: "Closed", candidates: 45, lastActivity: "5d ago" },
];

const statusVariant = (s: string) => s === "Active" ? "default" : s === "Draft" ? "secondary" : "outline";

const Jobs = () => {
  const isMobile = useIsMobile();

  return (
    <div className="space-y-3 md:space-y-4">
      {/* Actions bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 md:flex-none">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search jobs..." className="h-9 md:h-8 pl-8 text-xs md:w-56" />
        </div>
        <Button variant="outline" size="sm" className="h-9 md:h-8 text-xs gap-1.5 shrink-0">
          <Filter className="h-3.5 w-3.5" /><span className="hidden sm:inline">Filters</span>
        </Button>
        <Button size="sm" className="h-9 md:h-8 text-xs gap-1.5 shrink-0 hidden md:flex">
          <Plus className="h-3.5 w-3.5" /> Create Job
        </Button>
      </div>

      {/* Mobile: card list / Desktop: table */}
      {isMobile ? (
        <div className="space-y-2">
          {jobs.map((job) => (
            <Card key={job.role} className="active:bg-muted/50 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-1.5">
                  <h3 className="text-sm font-medium leading-tight pr-2">{job.role}</h3>
                  <Badge variant={statusVariant(job.status)} className="text-[10px] shrink-0">{job.status}</Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{job.dept}</span>
                  <span>·</span>
                  <span>{job.candidates} candidates</span>
                  <span>·</span>
                  <span>{job.lastActivity}</span>
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
                  <TableHead className="text-xs">Role</TableHead>
                  <TableHead className="text-xs">Department</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs text-right">Candidates</TableHead>
                  <TableHead className="text-xs text-right">Last Activity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.role} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="text-sm font-medium">{job.role}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{job.dept}</TableCell>
                    <TableCell><Badge variant={statusVariant(job.status)} className="text-[10px]">{job.status}</Badge></TableCell>
                    <TableCell className="text-xs text-right">{job.candidates}</TableCell>
                    <TableCell className="text-xs text-muted-foreground text-right">{job.lastActivity}</TableCell>
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

export default Jobs;

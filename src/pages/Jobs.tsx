import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Plus, Search, Filter, X, CalendarIcon } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNavigate } from "react-router-dom";
import { FloatingActionButton } from "@/components/FloatingActionButton";
import { cn } from "@/lib/utils";
import { format, isAfter, isBefore, subDays, startOfDay } from "date-fns";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const jobs = [
  { role: "Senior Frontend Engineer", dept: "Engineering", type: "Full-time", status: "Active", candidates: 34, lastActivity: "2h ago", lastActivityDate: new Date() },
  { role: "Product Designer", dept: "Design", type: "Full-time", status: "Active", candidates: 22, lastActivity: "5h ago", lastActivityDate: new Date() },
  { role: "Data Scientist", dept: "Data", type: "Contract", status: "Draft", candidates: 0, lastActivity: "1d ago", lastActivityDate: subDays(new Date(), 1) },
  { role: "Engineering Manager", dept: "Engineering", type: "Full-time", status: "Active", candidates: 18, lastActivity: "3h ago", lastActivityDate: new Date() },
  { role: "Marketing Lead", dept: "Marketing", type: "Part-time", status: "Closed", candidates: 45, lastActivity: "5d ago", lastActivityDate: subDays(new Date(), 5) },
];

const allDepts = ["Engineering", "Design", "Data", "Marketing", "Sales", "Operations", "HR"];
const allTypes = ["Full-time", "Part-time", "Contract", "Internship"];
const allStatuses = ["Active", "Draft", "Closed"];

const statusVariant = (s: string) => s === "Active" ? "default" : s === "Draft" ? "secondary" : "outline";

type DatePreset = "today" | "7d" | "30d" | "custom" | null;

const Jobs = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [deptFilter, setDeptFilter] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [datePreset, setDatePreset] = useState<DatePreset>(null);
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const toggleArrayFilter = (arr: string[], val: string, setter: (v: string[]) => void) => {
    setter(arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]);
  };

  const applyDatePreset = (preset: DatePreset) => {
    setDatePreset(preset);
    if (preset === "today") { setDateFrom(startOfDay(new Date())); setDateTo(new Date()); }
    else if (preset === "7d") { setDateFrom(subDays(new Date(), 7)); setDateTo(new Date()); }
    else if (preset === "30d") { setDateFrom(subDays(new Date(), 30)); setDateTo(new Date()); }
    else if (preset === null) { setDateFrom(undefined); setDateTo(undefined); }
  };

  const hasFilters = statusFilter.length > 0 || deptFilter.length > 0 || typeFilter.length > 0 || datePreset !== null;

  const clearAll = () => {
    setStatusFilter([]);
    setDeptFilter([]);
    setTypeFilter([]);
    setDatePreset(null);
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const filtered = useMemo(() => {
    return jobs.filter((job) => {
      if (search && !job.role.toLowerCase().includes(search.toLowerCase()) && !job.dept.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter.length && !statusFilter.includes(job.status)) return false;
      if (deptFilter.length && !deptFilter.includes(job.dept)) return false;
      if (typeFilter.length && !typeFilter.includes(job.type)) return false;
      if (dateFrom && isBefore(job.lastActivityDate, startOfDay(dateFrom))) return false;
      if (dateTo && isAfter(startOfDay(job.lastActivityDate), dateTo)) return false;
      return true;
    });
  }, [search, statusFilter, deptFilter, typeFilter, dateFrom, dateTo]);

  const activeChips: { label: string; clear: () => void }[] = [];
  statusFilter.forEach((s) => activeChips.push({ label: `Status: ${s}`, clear: () => setStatusFilter((p) => p.filter((v) => v !== s)) }));
  deptFilter.forEach((d) => activeChips.push({ label: `Dept: ${d}`, clear: () => setDeptFilter((p) => p.filter((v) => v !== d)) }));
  typeFilter.forEach((t) => activeChips.push({ label: `Type: ${t}`, clear: () => setTypeFilter((p) => p.filter((v) => v !== t)) }));
  if (datePreset) activeChips.push({ label: datePreset === "custom" ? `Date: Custom range` : `Date: Last ${datePreset === "today" ? "today" : datePreset}`, clear: () => applyDatePreset(null) });

  /* ───── Filter Content (shared between popover & sheet) ───── */
  const FilterBody = () => (
    <div className="space-y-5">
      {/* Status */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground">Status</Label>
        <div className="space-y-1.5">
          {allStatuses.map((s) => (
            <label key={s} className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={statusFilter.includes(s)} onCheckedChange={() => toggleArrayFilter(statusFilter, s, setStatusFilter)} />
              <span className="text-sm">{s}</span>
            </label>
          ))}
        </div>
      </div>
      {/* Department */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground">Department</Label>
        <div className="space-y-1.5">
          {allDepts.map((d) => (
            <label key={d} className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={deptFilter.includes(d)} onCheckedChange={() => toggleArrayFilter(deptFilter, d, setDeptFilter)} />
              <span className="text-sm">{d}</span>
            </label>
          ))}
        </div>
      </div>
      {/* Employment Type */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground">Employment Type</Label>
        <div className="space-y-1.5">
          {allTypes.map((t) => (
            <label key={t} className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={typeFilter.includes(t)} onCheckedChange={() => toggleArrayFilter(typeFilter, t, setTypeFilter)} />
              <span className="text-sm">{t}</span>
            </label>
          ))}
        </div>
      </div>
      {/* Date Range */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground">Last Activity</Label>
        <div className="flex flex-wrap gap-1.5">
          {([
            { key: "today", label: "Today" },
            { key: "7d", label: "Last 7 days" },
            { key: "30d", label: "Last 30 days" },
            { key: "custom", label: "Custom" },
          ] as const).map((p) => (
            <Button
              key={p.key}
              variant={datePreset === p.key ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => applyDatePreset(datePreset === p.key ? null : p.key)}
            >
              {p.label}
            </Button>
          ))}
        </div>
        {datePreset === "custom" && (
          <div className="grid grid-cols-2 gap-2 mt-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("h-8 text-xs justify-start", !dateFrom && "text-muted-foreground")}>
                  <CalendarIcon className="h-3 w-3 mr-1.5" />
                  {dateFrom ? format(dateFrom, "MMM d") : "From"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("h-8 text-xs justify-start", !dateTo && "text-muted-foreground")}>
                  <CalendarIcon className="h-3 w-3 mr-1.5" />
                  {dateTo ? format(dateTo, "MMM d") : "To"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateTo} onSelect={setDateTo} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>
      {hasFilters && (
        <Button variant="ghost" size="sm" className="w-full text-xs h-8 text-muted-foreground" onClick={clearAll}>
          Clear all filters
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-3 md:space-y-4">
      {/* Toolbar: Search + Filter left, Create right */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 md:flex-none">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search jobs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 md:h-8 pl-8 text-xs md:w-56"
          />
        </div>

        {/* Filter trigger — desktop: popover, mobile: sheet */}
        {isMobile ? (
          <>
            <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5 shrink-0" onClick={() => setFilterOpen(true)}>
              <Filter className="h-3.5 w-3.5" />
              {hasFilters && <span className="h-1.5 w-1.5 rounded-full bg-foreground" />}
            </Button>
            <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
              <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl overflow-y-auto">
                <SheetHeader>
                  <SheetTitle className="text-base">Filters</SheetTitle>
                  <SheetDescription className="text-xs">Narrow down your job list.</SheetDescription>
                </SheetHeader>
                <div className="mt-4">
                  <FilterBody />
                </div>
              </SheetContent>
            </Sheet>
          </>
        ) : (
          <Popover open={filterOpen} onOpenChange={setFilterOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 shrink-0">
                <Filter className="h-3.5 w-3.5" />
                <span>Filters</span>
                {hasFilters && <span className="h-1.5 w-1.5 rounded-full bg-foreground" />}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 max-h-[70vh] overflow-y-auto" align="start">
              <FilterBody />
            </PopoverContent>
          </Popover>
        )}

        <div className="flex-1 md:hidden" />

        <Button size="sm" className="h-9 md:h-8 text-xs gap-1.5 shrink-0 hidden md:flex" onClick={() => navigate("/jobs/new")}>
          <Plus className="h-3.5 w-3.5" /> Create Job
        </Button>
      </div>

      {/* Active filter chips */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {activeChips.map((chip, i) => (
            <Badge key={i} variant="secondary" className="text-[10px] gap-1 pr-1 cursor-pointer hover:bg-muted" onClick={chip.clear}>
              {chip.label}
              <X className="h-2.5 w-2.5" />
            </Badge>
          ))}
          <button className="text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1" onClick={clearAll}>
            Clear all
          </button>
        </div>
      )}

      {/* Mobile: card list / Desktop: table */}
      {isMobile ? (
        <div className="space-y-2">
          {filtered.map((job) => (
            <Card key={job.role} className="active:bg-muted/50 transition-colors cursor-pointer" onClick={() => navigate(`/jobs/${encodeURIComponent(job.role)}/edit`)}>
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
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No jobs match your filters.</p>
          )}
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
                {filtered.map((job) => (
                  <TableRow key={job.role} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/jobs/${encodeURIComponent(job.role)}/edit`)}>
                    <TableCell className="text-sm font-medium">{job.role}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{job.dept}</TableCell>
                    <TableCell><Badge variant={statusVariant(job.status)} className="text-[10px]">{job.status}</Badge></TableCell>
                    <TableCell className="text-xs text-right">{job.candidates}</TableCell>
                    <TableCell className="text-xs text-muted-foreground text-right">{job.lastActivity}</TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-sm text-muted-foreground text-center py-8">No jobs match your filters.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      {isMobile && <FloatingActionButton onClick={() => navigate("/jobs/new")} />}
    </div>
  );
};

export default Jobs;

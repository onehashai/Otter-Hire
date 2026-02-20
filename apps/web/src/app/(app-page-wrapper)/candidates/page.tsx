"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  Button,
  InputField,
  Badge,
  Avatar,
  AvatarFallback,
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Icon,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@onehash/ui";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";

interface Candidate {
  id: string;
  name: string;
  email: string;
  role: string;
  stage: string;
  rating: number;
  recruiter: string;
  lastActivity: string;
  appliedDate: string;
  tags: string[];
  source: string;
  phone: string;
  location: string;
}

const candidates: Candidate[] = [
  { id: "1", name: "Alex Rivera", email: "alex@example.com", role: "Sr. Frontend Engineer", stage: "Interview", rating: 4.5, recruiter: "Sarah Miller", lastActivity: "2h ago", appliedDate: "2025-02-15", tags: ["React", "TypeScript"], source: "LinkedIn", phone: "+1 555-0101", location: "San Francisco, CA" },
  { id: "2", name: "Maria Kim", email: "maria@example.com", role: "Product Designer", stage: "Offer", rating: 4.2, recruiter: "Sarah Miller", lastActivity: "1d ago", appliedDate: "2025-02-10", tags: ["Figma", "UI/UX"], source: "Careers Page", phone: "+1 555-0102", location: "New York, NY" },
  { id: "3", name: "Sam Chen", email: "sam@example.com", role: "Data Scientist", stage: "Screening", rating: 3.8, recruiter: "John Davis", lastActivity: "3h ago", appliedDate: "2025-02-17", tags: ["Python", "ML"], source: "Referral", phone: "+1 555-0103", location: "Austin, TX" },
  { id: "4", name: "Jordan Lee", email: "jordan@example.com", role: "Engineering Manager", stage: "Interview", rating: 4.0, recruiter: "John Davis", lastActivity: "5h ago", appliedDate: "2025-02-12", tags: ["Leadership", "Agile"], source: "LinkedIn", phone: "+1 555-0104", location: "Seattle, WA" },
  { id: "5", name: "Taylor Morgan", email: "taylor@example.com", role: "Marketing Lead", stage: "Applied", rating: 3.5, recruiter: "Sarah Miller", lastActivity: "30m ago", appliedDate: "2025-02-18", tags: ["Growth", "SEO"], source: "Careers Page", phone: "+1 555-0105", location: "Chicago, IL" },
  { id: "6", name: "Casey Brooks", email: "casey@example.com", role: "Sr. Frontend Engineer", stage: "Hired", rating: 4.8, recruiter: "John Davis", lastActivity: "1w ago", appliedDate: "2025-01-20", tags: ["React", "Node.js"], source: "Referral", phone: "+1 555-0106", location: "Denver, CO" },
  { id: "7", name: "Riley Parker", email: "riley@example.com", role: "Product Designer", stage: "Rejected", rating: 2.5, recruiter: "Sarah Miller", lastActivity: "3d ago", appliedDate: "2025-02-05", tags: ["Sketch", "Prototyping"], source: "LinkedIn", phone: "+1 555-0107", location: "Portland, OR" },
];

const stages = ["All", "Applied", "Screening", "Interview", "Offer", "Hired", "Rejected"];
const roles = ["All", "Sr. Frontend Engineer", "Product Designer", "Data Scientist", "Engineering Manager", "Marketing Lead"];
const recruiters = ["All", "Sarah Miller", "John Davis"];
const sortOptions = [
  { value: "newest", label: "Newest Applied" },
  { value: "rating", label: "Highest Rating" },
  { value: "stage", label: "Stage Progress" },
];

const stageOrder: Record<string, number> = { Applied: 0, Screening: 1, Interview: 2, Offer: 3, Hired: 4, Rejected: 5 };

const stageVariant = (stage: string) => {
  if (stage === "Hired") return "default";
  if (stage === "Rejected") return "destructive";
  return "secondary";
};

const RatingStars = ({ rating }: { rating: number }) => {
  const full = Math.floor(rating);
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={`h-2.5 w-2.5 rounded-full ${i <= full ? "bg-foreground" : "bg-muted"}`}
        />
      ))}
      <span className="ml-1 text-xs text-muted-foreground">{rating.toFixed(1)}</span>
    </div>
  );
};

export default function CandidatesPage() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("All");
  const [roleFilter, setRoleFilter] = useState("All");
  const [recruiterFilter, setRecruiterFilter] = useState("All");
  const [sort, setSort] = useState("newest");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => {
    let list = candidates.filter((c) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.role.toLowerCase().includes(q) ||
        c.stage.toLowerCase().includes(q);
      const matchStage = stageFilter === "All" || c.stage === stageFilter;
      const matchRole = roleFilter === "All" || c.role === roleFilter;
      const matchRecruiter = recruiterFilter === "All" || c.recruiter === recruiterFilter;
      return matchSearch && matchStage && matchRole && matchRecruiter;
    });

    list.sort((a, b) => {
      if (sort === "newest") return new Date(b.appliedDate).getTime() - new Date(a.appliedDate).getTime();
      if (sort === "rating") return b.rating - a.rating;
      return (stageOrder[a.stage] ?? 0) - (stageOrder[b.stage] ?? 0);
    });

    return list;
  }, [search, stageFilter, roleFilter, recruiterFilter, sort]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((c) => c.id)));
    }
  };

  const bulkAction = (action: string) => {
    toast({ title: `${action} applied to ${selected.size} candidate(s)` });
    setSelected(new Set());
  };

  const activeFilters = [stageFilter, roleFilter, recruiterFilter].filter((f) => f !== "All").length;

  return (
    <div className="space-y-3 md:space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 md:flex-none">
            <Icon name="Search" className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <InputField
              placeholder="Search by name, email, role..."
              className="h-9 md:h-8 pl-8 text-xs md:w-64"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Popover open={showFilters} onOpenChange={setShowFilters}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 md:h-8 text-xs gap-1.5 shrink-0 relative">
                <Icon name="Filter" className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Filters</span>
                {activeFilters > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-foreground text-background text-[10px] flex items-center justify-center">
                    {activeFilters}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-3 space-y-3" align="start">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Stage</label>
                <Select value={stageFilter} onValueChange={setStageFilter}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((s) => (
                      <SelectItem key={s} value={s} className="text-xs">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Job Role</label>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r} value={r} className="text-xs">
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Recruiter</label>
                <Select value={recruiterFilter} onValueChange={setRecruiterFilter}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {recruiters.map((r) => (
                      <SelectItem key={r} value={r} className="text-xs">
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-between pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    setStageFilter("All");
                    setRoleFilter("All");
                    setRecruiterFilter("All");
                  }}
                >
                  Clear all
                </Button>
                <Button size="sm" className="h-7 text-xs" onClick={() => setShowFilters(false)}>
                  Apply
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="h-9 md:h-8 w-auto text-xs gap-1.5 shrink-0 hidden sm:flex">
              <Icon name="ListOrdered" className="h-3.5 w-3.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xs">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button size="sm" className="h-9 md:h-8 text-xs gap-1.5 shrink-0 hidden md:flex">
            <Icon name="UserPlus" className="h-3.5 w-3.5" /> Add Candidate
          </Button>
        </div>

        {/* Active filter badges */}
        {activeFilters > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {stageFilter !== "All" && (
              <Badge
                variant="secondary"
                className="text-[10px] gap-1 cursor-pointer"
                onClick={() => setStageFilter("All")}
              >
                Stage: {stageFilter} <Icon name="X" className="h-3 w-3" />
              </Badge>
            )}
            {roleFilter !== "All" && (
              <Badge
                variant="secondary"
                className="text-[10px] gap-1 cursor-pointer"
                onClick={() => setRoleFilter("All")}
              >
                Role: {roleFilter} <Icon name="X" className="h-3 w-3" />
              </Badge>
            )}
            {recruiterFilter !== "All" && (
              <Badge
                variant="secondary"
                className="text-[10px] gap-1 cursor-pointer"
                onClick={() => setRecruiterFilter("All")}
              >
                Recruiter: {recruiterFilter} <Icon name="X" className="h-3 w-3" />
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Bulk Actions */}
      {selected.size > 0 && (
        <Card>
          <CardContent className="p-2.5 flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium">{selected.size} selected</span>
            <div className="flex gap-1.5 ml-auto">
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => bulkAction("Move stage")}>
                <Icon name="UserCheck" className="h-3 w-3 mr-1" /> Move Stage
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => bulkAction("Assign recruiter")}>
                Assign
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs text-destructive"
                onClick={() => bulkAction("Reject")}
              >
                <Icon name="X" className="h-3 w-3 mr-1" /> Reject
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelected(new Set())}>
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center gap-3 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <Icon name="UserPlus" className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">No candidates found</p>
              <p className="text-xs text-muted-foreground mt-1">
                Try adjusting your filters or add your first candidate.
              </p>
            </div>
            <Button size="sm" className="h-8 text-xs gap-1.5 mt-2">
              <Icon name="UserPlus" className="h-3.5 w-3.5" /> Add Candidate
            </Button>
          </CardContent>
        </Card>
      ) : isMobile ? (
        /* Mobile Cards */
        <div className="space-y-2">
          {filtered.map((c) => (
            <Card
              key={c.id}
              className="active:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => router.push(`/candidates/${c.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-2.5">
                  <div className="pt-0.5">
                    <Checkbox
                      checked={selected.has(c.id)}
                      onCheckedChange={() => toggleSelect(c.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="text-xs bg-muted">
                      {c.name.split(" ").map((n) => n[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium truncate">{c.name}</span>
                      <Icon name="ChevronLeft" className="h-4 w-4 text-muted-foreground shrink-0 rotate-180" />
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{c.role}</p>
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <Badge variant={stageVariant(c.stage)} className="text-[10px]">
                        {c.stage}
                      </Badge>
                      <RatingStars rating={c.rating} />
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] text-muted-foreground">{c.recruiter}</span>
                      <span className="text-[10px] text-muted-foreground">{c.lastActivity}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* Desktop Table */
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selected.size === filtered.length && filtered.length > 0}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead className="text-xs">Candidate</TableHead>
                  <TableHead className="text-xs">Applied For</TableHead>
                  <TableHead className="text-xs">Stage</TableHead>
                  <TableHead className="text-xs">Rating</TableHead>
                  <TableHead className="text-xs">Recruiter</TableHead>
                  <TableHead className="text-xs text-right">Activity</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/candidates/${c.id}`)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggleSelect(c.id)} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="text-[10px] bg-muted">
                            {c.name.split(" ").map((n) => n[0]).join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <span className="text-sm font-medium">{c.name}</span>
                          <p className="text-[11px] text-muted-foreground">{c.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.role}</TableCell>
                    <TableCell>
                      <Badge variant={stageVariant(c.stage)} className="text-[10px]">
                        {c.stage}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <RatingStars rating={c.rating} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.recruiter}</TableCell>
                    <TableCell className="text-xs text-muted-foreground text-right">{c.lastActivity}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                            <Icon name="MoreHorizontal" className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem className="text-xs" onClick={() => toast({ title: "Stage updated" })}>
                            <Icon name="UserCheck" className="h-3.5 w-3.5 mr-2" /> Move Stage
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-xs" onClick={() => toast({ title: "Interview scheduled" })}>
                            <Icon name="Clock" className="h-3.5 w-3.5 mr-2" /> Schedule Interview
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-xs text-destructive focus:text-destructive"
                            onClick={() => toast({ title: "Candidate rejected", variant: "destructive" })}
                          >
                            <Icon name="X" className="h-3.5 w-3.5 mr-2" /> Reject
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

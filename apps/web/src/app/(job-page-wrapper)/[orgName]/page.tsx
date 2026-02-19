"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  InputField,
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@onehash/ui";
import {
  Search,
  MapPin,
  Briefcase,
  Clock,
  DollarSign,
  ArrowRight,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

/* ───── shared mock data (published jobs only) ───── */
const publishedJobs = [
  {
    id: "senior-frontend-engineer",
    title: "Senior Frontend Engineer",
    department: "Engineering",
    location: "San Francisco, United States",
    employmentType: "Full-time",
    workplaceType: "Remote",
    salaryRange: "$140,000 – $180,000 / year",
    postedDate: "2 days ago",
    description:
      "Lead our design system efforts and build delightful user experiences.",
  },
  {
    id: "product-designer",
    title: "Product Designer",
    department: "Design",
    location: "New York, United States",
    employmentType: "Full-time",
    workplaceType: "Hybrid",
    salaryRange: "$120,000 – $160,000 / year",
    postedDate: "5 days ago",
    description:
      "Craft beautiful, intuitive product experiences for our users.",
  },
  {
    id: "engineering-manager",
    title: "Engineering Manager",
    department: "Engineering",
    location: "Austin, United States",
    employmentType: "Full-time",
    workplaceType: "On-site",
    salaryRange: "$160,000 – $200,000 / year",
    postedDate: "1 week ago",
    description: "Lead and grow a high-performing engineering team.",
  },
  {
    id: "data-scientist",
    title: "Data Scientist",
    department: "Data",
    location: "Remote",
    employmentType: "Contract",
    workplaceType: "Remote",
    salaryRange: null,
    postedDate: "3 days ago",
    description:
      "Derive insights from complex datasets to drive product decisions.",
  },
];

const allDepartments = [...new Set(publishedJobs.map((j) => j.department))];
const allLocations = [...new Set(publishedJobs.map((j) => j.location))];

export default function CareersListPage() {
  const params = useParams();
  const orgName = params?.orgName as string;
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");

  const filtered = useMemo(() => {
    return publishedJobs.filter((job) => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !job.title.toLowerCase().includes(q) &&
          !job.department.toLowerCase().includes(q) &&
          !job.description.toLowerCase().includes(q)
        )
          return false;
      }
      if (deptFilter !== "all" && job.department !== deptFilter) return false;
      if (locationFilter !== "all" && job.location !== locationFilter)
        return false;
      return true;
    });
  }, [search, deptFilter, locationFilter]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="mx-auto max-w-4xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-foreground flex items-center justify-center">
              <span className="text-background text-xs font-bold">A</span>
            </div>
            <span className="text-sm font-semibold">Acme Inc.</span>
          </div>
          <span className="text-xs text-muted-foreground hidden sm:block">
            Careers
          </span>
        </div>
      </header>

      {/* Search & Filters */}
      <div className="mx-auto max-w-4xl pt-12 md:pt-16 px-4 pb-6">
        <div
          className={cn(
            "flex gap-2",
            isMobile ? "flex-col" : "items-center"
          )}
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none z-10" />
            <InputField
              placeholder="Search roles…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
          <div className={cn("flex gap-2", isMobile && "w-full")}>
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger
                className={cn(
                  "h-9 text-xs",
                  isMobile ? "flex-1" : "w-[140px]"
                )}
              >
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {allDepartments.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger
                className={cn(
                  "h-9 text-xs",
                  isMobile ? "flex-1" : "w-[160px]"
                )}
              >
                <SelectValue placeholder="Location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {allLocations.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Results count */}
      <div className="mx-auto max-w-4xl px-4 pb-3">
        <p className="text-xs text-muted-foreground">
          {filtered.length}{" "}
          {filtered.length === 1 ? "position" : "positions"} available
        </p>
      </div>

      {/* Job list */}
      <div className="mx-auto max-w-4xl px-4 pb-16">
        {filtered.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <div className="h-12 w-12 rounded-full bg-muted mx-auto flex items-center justify-center">
              <Briefcase className="h-5 w-5 text-muted-foreground" />
            </div>
            <h2 className="text-base font-medium">No open positions</h2>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              We don&apos;t have any matching openings right now. Check back
              soon or adjust your filters.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((job) => (
              <Link
                key={job.id}
                href={orgName ? `/${encodeURIComponent(orgName)}/${encodeURIComponent(job.id)}` : `/${job.id}`}
                className="w-full text-left group rounded-lg border border-border bg-card p-4 md:p-5 hover:border-foreground/20 transition-colors block"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-medium group-hover:underline underline-offset-2">
                        {job.title}
                      </h3>
                      <Badge variant="secondary" className="text-[10px] h-5">
                        {job.department}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {job.description}
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" /> {job.location}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" /> {job.employmentType}
                      </span>
                      {job.salaryRange && (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <DollarSign className="h-3 w-3" /> {job.salaryRange}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[10px] text-muted-foreground hidden sm:block">
                      {job.postedDate}
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto max-w-4xl px-4 py-6 text-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} OneHash Inc. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

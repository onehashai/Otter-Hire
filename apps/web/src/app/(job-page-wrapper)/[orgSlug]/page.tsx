"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { InputField } from "@onehash/ui/input";
import { Badge } from "@onehash/ui/badge";
import { SelectField } from "@onehash/ui/select";
import { Search, MapPin, Briefcase, Clock, DollarSign, ArrowRight } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { getPublicJobs, type PublicJobListItem } from "@/api";

function parseOrgSlug(orgSlug: string): { orgName: string; orgId: string } | null {
  const parts = orgSlug.split("-");
  if (parts.length < 6) return null;

  const uuidParts = parts.slice(-5);
  const orgId = uuidParts.join("-");
  const orgName = parts.slice(0, -5).join("-");

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(orgId)) return null;

  return { orgName, orgId };
}

function formatSalary(job: PublicJobListItem): string | null {
  if (job.salary_fixed) {
    return `$${(job.salary_fixed / 100).toLocaleString()} / ${job.salary_timeframe.replace("per_", "")}`;
  }
  if (job.salary_min && job.salary_max) {
    return `$${(job.salary_min / 100).toLocaleString()} – $${(job.salary_max / 100).toLocaleString()} / ${job.salary_timeframe.replace("per_", "")}`;
  }
  return null;
}

function formatLocation(job: PublicJobListItem): string {
  // Backend already formats as "City|State, Country" or fallback
  return job.location || job.workplace_type || "Remote";
}

function formatEmploymentType(type: string): string {
  return type.replace("_", "-").replace(/\b\w/g, (l) => l.toUpperCase());
}

export default function CareersListPage() {
  const params = useParams();
  const orgSlug = params?.orgSlug as string;
  const isMobile = useIsMobile();

  const [jobs, setJobs] = useState<PublicJobListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [orgName, setOrgName] = useState("");

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");

  useEffect(() => {
    const parsed = parseOrgSlug(orgSlug);
    if (!parsed) {
      setError("Invalid organization");
      setLoading(false);
      return;
    }

    setOrgName(parsed.orgName);

    getPublicJobs(parsed.orgId)
      .then((data) => {
        setJobs(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load jobs");
        setLoading(false);
      });
  }, [orgSlug]);

  const allCategories = useMemo(() => {
    const depts = jobs.map((j) => j.category).filter(Boolean) as string[];
    return [...new Set(depts)];
  }, [jobs]);

  const allLocations = useMemo(() => {
    const locs = jobs.map((j) => formatLocation(j));
    return [...new Set(locs)];
  }, [jobs]);

  const filtered = useMemo(() => {
    return jobs.filter((job) => {
      if (search) {
        const q = search.toLowerCase();
        if (!job.title.toLowerCase().includes(q) && !(job.category || "").toLowerCase().includes(q))
          return false;
      }
      if (categoryFilter !== "all" && job.category !== categoryFilter) return false;
      if (locationFilter !== "all" && formatLocation(job) !== locationFilter) return false;
      return true;
    });
  }, [jobs, search, categoryFilter, locationFilter]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center space-y-3 max-w-sm">
          <h1 className="text-xl font-semibold">Not Found</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border">
        <div className="mx-auto max-w-4xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-foreground flex items-center justify-center">
              <span className="text-background text-xs font-bold">
                {orgName.charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="text-sm font-semibold capitalize">{orgName}</span>
          </div>
        </div>
      </header>

      <div className="flex-1">
        <div className="mx-auto max-w-4xl pt-12 md:pt-16 px-4 pb-6">
          <div className="flex gap-3 items-end">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none z-10" />
              <InputField
                placeholder="Search roles…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
            {allCategories.length > 0 && (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Category</label>
                <SelectField
                  label="Category"
                  value={categoryFilter}
                  onValueChange={setCategoryFilter}
                  options={[
                    { value: "all", label: "All Categories" },
                    ...allCategories.map((d) => ({ value: d, label: d })),
                  ]}
                />
              </div>
            )}
            {allLocations.length > 0 && (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Location</label>
                <SelectField
                  label="Location"
                  value={locationFilter}
                  onValueChange={setLocationFilter}
                  options={[
                    { value: "all", label: "All Locations" },
                    ...allLocations.map((l) => ({ value: l, label: l })),
                  ]}
                />
              </div>
            )}
          </div>
        </div>

        <div className="mx-auto max-w-4xl px-4 pb-3">
          <p className="text-xs text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "position" : "positions"} available
          </p>
        </div>

        <div className="mx-auto max-w-4xl px-4 pb-16">
          {filtered.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <div className="h-12 w-12 rounded-full bg-muted mx-auto flex items-center justify-center">
                <Briefcase className="h-5 w-5 text-muted-foreground" />
              </div>
              <h2 className="text-base font-medium">No open positions</h2>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                We don&apos;t have any matching openings right now. Check back soon or adjust your
                filters.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((job) => {
                const salary = formatSalary(job);
                const location = formatLocation(job);
                const daysAgo = Math.floor(
                  (Date.now() - new Date(job.published_at).getTime()) / (1000 * 60 * 60 * 24),
                );
                const timeAgo =
                  daysAgo === 0
                    ? "Today"
                    : daysAgo === 1
                      ? "1 day ago"
                      : daysAgo < 7
                        ? `${daysAgo} days ago`
                        : daysAgo < 14
                          ? "1 week ago"
                          : daysAgo < 30
                            ? `${Math.floor(daysAgo / 7)} weeks ago`
                            : daysAgo < 60
                              ? "1 month ago"
                              : `${Math.floor(daysAgo / 30)} months ago`;

                return (
                  <Link
                    key={job.id}
                    href={`/${orgSlug}/${job.id}`}
                    className="w-full text-left group rounded-lg border border-border bg-card p-4 hover:border-foreground/20 hover:shadow-sm transition-all block"
                  >
                    <div className="flex items-start justify-between gap-6">
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-semibold group-hover:underline underline-offset-2">
                            {job.title}
                          </h3>
                          {job.status === "draft" && (
                            <Badge variant="secondary" className="text-[10px] h-5 px-2">
                              Draft
                            </Badge>
                          )}
                          {job.category && (
                            <Badge variant="secondary" className="text-[10px] h-5 px-2">
                              {job.category}
                            </Badge>
                          )}
                        </div>

                        {job.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {job.description.replace(/<[^>]*>/g, "").substring(0, 100)}
                          </p>
                        )}

                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" /> {location}
                          </span>
                          {job.employment_type && (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />{" "}
                              {formatEmploymentType(job.employment_type)}
                            </span>
                          )}
                          {salary && (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <DollarSign className="h-3 w-3" /> {salary}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-muted-foreground">{timeAgo}</span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <footer className="border-t border-border mt-auto">
        <div className="mx-auto max-w-4xl px-4 py-6 text-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} {orgName}. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

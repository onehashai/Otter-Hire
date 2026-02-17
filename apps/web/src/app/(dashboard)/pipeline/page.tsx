"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  Badge,
  Button,
  InputField,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@onehash/ui";
import { Search, Plus, Briefcase, ChevronDown } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { pipelineJobs, statusVariant } from "./data";

export default function PipelinePage() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(() => {
    return pipelineJobs.filter((job) => {
      if (search && !job.title.toLowerCase().includes(search.toLowerCase()) && !job.dept.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter !== "all" && job.status !== statusFilter) return false;
      return true;
    });
  }, [search, statusFilter]);

  const handleSelectJob = (id: string) => {
    router.push(`/pipeline/${id}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Pipeline</h2>
          <p className="text-xs text-muted-foreground">Select a job to view its candidate pipeline</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 md:flex-none">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <InputField
            placeholder="Search jobs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 md:h-8 pl-8 text-xs md:w-56"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 md:h-8 w-auto min-w-[100px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Draft">Draft</SelectItem>
            <SelectItem value="Closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl p-12 text-center">
          <Briefcase className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium mb-1">No jobs found</p>
          <p className="text-xs text-muted-foreground mb-4">Create your first job to start building pipelines.</p>
          <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => router.push("/jobs/new")}>
            <Plus className="h-3.5 w-3.5" /> Create Job
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((job) => (
            <Card
              key={job.id}
              className="cursor-pointer hover:shadow-sm active:bg-muted/50 transition-all"
              onClick={() => handleSelectJob(job.id)}
            >
              <CardContent className={cn("flex items-center gap-4", isMobile ? "p-4" : "p-4 py-3")}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="text-sm font-medium truncate">{job.title}</h3>
                    <Badge variant={statusVariant(job.status)} className="text-[10px] shrink-0">
                      {job.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{job.dept}</span>
                    <span>·</span>
                    <span>{job.location}</span>
                    <span>·</span>
                    <span>{job.lastActivity}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className="text-sm font-medium">{job.candidates.length}</div>
                    <div className="text-[10px] text-muted-foreground">candidates</div>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground -rotate-90" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

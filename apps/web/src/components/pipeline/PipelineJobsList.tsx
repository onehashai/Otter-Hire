"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, EmptyCard } from "@onehash/ui/card";
import { Badge } from "@onehash/ui/badge";
import { Button } from "@onehash/ui/button";
import { Briefcase, Plus, ChevronDown } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import type { PipelineJob } from "@/app/(app-page-wrapper)/pipeline/data";
import { statusVariant } from "@/app/(app-page-wrapper)/pipeline/data";

interface PipelineJobsListProps {
  jobs: PipelineJob[];
}

export const PipelineJobsList = ({ jobs }: PipelineJobsListProps) => {
  const router = useRouter();
  const isMobile = useIsMobile();

  const handleSelectJob = (id: string) => {
    router.push(`/pipeline/${id}`);
  };

  if (jobs.length === 0) {
    return (
      <EmptyCard
        icon="Briefcase"
        title="No jobs in pipeline"
        description="Create a job to start building pipelines."
      />
    );
  }

  return (
    <div className="space-y-2">
      {jobs.map((job) => (
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
  );
};

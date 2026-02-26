"use client";

import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@onehash/ui/card";
import { Badge } from "@onehash/ui/badge";
import { Button } from "@onehash/ui/button";
import { ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import type { JobListItemResponse } from "@/api";
import { CategoryType, JobStatusType } from "@/app/(app-page-wrapper)/jobs/[jobId]/constants";
import { cn } from "@/lib/utils";

const statusKey: Record<JobStatusType, string> = {
  open: "open",
  draft: "draft",
  archived: "archived",
};
const categoryKey: Record<CategoryType, string> = {
  engineering: "engineering",
  design: "design",
  data: "data",
  marketing: "marketing",
  sales: "sales",
  operations: "operations",
  hr: "hr",
};

const statusVariant = (s: JobStatusType) =>
  s === "open" ? "default" : s === "draft" ? "secondary" : "outline";

const formatTimeAgo = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d ago`;
};

interface JobsListProps {
  jobs: JobListItemResponse[];
}

export function JobsList({ jobs }: JobsListProps) {
  const { t } = useTranslation();
  const router = useRouter();

  if (jobs.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">{t("no_results")}</p>;
  }

  return (
    <div className="space-y-2">
      {jobs.map((job) => (
        <Card
          key={job.id}
          className="cursor-pointer hover:shadow-sm active:bg-muted/50 transition-all"
          onClick={() => router.push(`/jobs/${job.id}/info`)}
        >
          <CardContent className="p-4 py-3">
            <div className="flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="text-sm font-medium truncate">{job.title}</h3>
                  <Badge
                    variant={statusVariant(job.status as JobStatusType)}
                    className="text-[10px] shrink-0"
                  >
                    {t(statusKey[job.status as JobStatusType] ?? job.status)}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>
                    {job.category
                      ? t(categoryKey[job.category as CategoryType] ?? job.category)
                      : "—"}
                  </span>
                  <span>·</span>
                  <span>{formatTimeAgo(job.updated_at)}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Button
                  variant="default"
                  size="sm"
                  className="h-8 text-xs text-primary-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/pipeline/${job.id}`);
                  }}
                >
                  View Pipeline
                </Button>
                <div className="text-right">
                  <div className="text-sm font-medium">{job.candidate_count}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {job.candidate_count === 1 ? t("candidate") : t("candidates")}
                  </div>
                </div>
                <ChevronRight className={cn("h-4 w-4 text-muted-foreground")} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@onehash/ui/card";
import { Badge } from "@onehash/ui/badge";
import { Button } from "@onehash/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@onehash/ui/dropdown-menu";
import { useRouter } from "next/navigation";
import { Icon } from "@onehash/ui/icon";
import { archiveJob, type JobListItemResponse } from "@/api";
import { JobStatusType } from "@/app/(app-page-wrapper)/jobs/[jobId]/constants";
import { toast } from "@onehash/ui/sonner";

const statusKey: Record<JobStatusType, string> = {
  open: "open",
  draft: "draft",
  archived: "archived",
};

const statusVariant = (s: JobStatusType) =>
  s === "open" ? "default" : s === "draft" ? "secondary" : "outline";

interface JobsListProps {
  jobs: JobListItemResponse[];
  onJobArchived?: () => void;
}

export function JobsList({ jobs, onJobArchived }: JobsListProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [archivingId, setArchivingId] = useState<string | null>(null);

  if (jobs.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">{t("no_results")}</p>;
  }

  return (
    <div className="space-y-2">
      {jobs.map((job) => (
        <Card
          key={job.id}
          className="cursor-pointer hover:shadow-sm active:bg-muted/50 transition-all"
          onClick={() => router.push(`/jobs/${job.id}`)}
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
                    {job.category ? t(job.category, { defaultValue: job.category }) : "—"}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="text-xs">
                  {job.candidate_count}{" "}
                  {job.candidate_count === 1 ? t("candidate") : t("candidates")}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground border-border"
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <Icon name="MoreHorizontal" className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenuItem
                      className="text-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/jobs/${job.id}/info`);
                      }}
                    >
                      <Icon name="PenLine" className="h-4 w-4 mr-2" />
                      {t("edit")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-sm text-destructive focus:text-destructive"
                      disabled={job.status === "archived" || archivingId === job.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        void (async () => {
                          try {
                            setArchivingId(job.id);
                            await archiveJob(job.id);
                            toast.success(t("job_archived"));
                            onJobArchived?.();
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : "Failed to archive job");
                          } finally {
                            setArchivingId(null);
                          }
                        })();
                      }}
                    >
                      <Icon name="Archive" className="h-4 w-4 mr-2" />
                      {t("archive")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

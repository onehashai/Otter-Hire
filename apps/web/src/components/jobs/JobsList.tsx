"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, EmptyCard } from "@onehash/ui/card";
import { Badge } from "@onehash/ui/badge";
import { Button } from "@onehash/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@onehash/ui/dropdown-menu";
import { useRouter } from "next/navigation";
import { Icon } from "@onehash/ui/icon";
import type { IconName } from "@onehash/ui/icon";
import {
  archiveJob,
  publishJob,
  unarchiveJob,
  unpublishJob,
  type JobListItemResponse,
} from "@/api";
import { JobStatusType } from "@/app/(app-page-wrapper)/jobs/[jobId]/constants";
import { toast } from "@onehash/ui/sonner";
import { CreateJobModal } from "./CreateJobModal";
import { cn } from "@/lib/utils";

const statusKey: Record<JobStatusType, string> = {
  open: "open",
  draft: "draft",
  archived: "archived",
};

const statusVariant = (s: JobStatusType) =>
  s === "open" ? "default" : s === "draft" ? "secondary" : "outline";

/** Target statuses available from the API for the jobs list (excludes current). */
function statusTransitionOptions(current: JobStatusType): JobStatusType[] {
  if (current === "draft") return ["open", "archived"];
  if (current === "open") return ["draft", "archived"];
  if (current === "archived") return ["draft"];
  return [];
}

function statusOptionIcon(target: JobStatusType): IconName {
  if (target === "open") return "Eye";
  if (target === "draft") return "ScrollText";
  return "Archive";
}

interface JobsListProps {
  jobs: JobListItemResponse[];
  onJobArchived?: () => void;
}

function JobCard({ job, onJobArchived }: { job: JobListItemResponse; onJobArchived?: () => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [statusChangingId, setStatusChangingId] = useState<string | null>(null);

  return (
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
              <span>{job.category ? t(job.category, { defaultValue: job.category }) : "—"}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="text-xs">
              {job.candidate_count} {job.candidate_count === 1 ? t("candidate") : t("candidates")}
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
              <DropdownMenuContent
                align="end"
                className="w-40"
                onClick={(e) => e.stopPropagation()}
              >
                <DropdownMenuItem
                  className="text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/jobs/${job.id}/info`);
                  }}
                >
                  <Icon name="PenLine" className="h-4 w-4 mr-2" />
                  {t("edit")}
                </DropdownMenuItem>
                {statusTransitionOptions(job.status as JobStatusType).length === 0 ? (
                  <DropdownMenuItem className="text-xs" disabled>
                    <Icon name="ArrowLeftRight" className="h-4 w-4 mr-2" />
                    {t("change_status")}
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger
                      className="text-xs"
                      disabled={statusChangingId === job.id}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Icon name="ArrowLeftRight" className="h-4 w-4 mr-2" />
                      {t("change_status")}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent
                      className="w-40"
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      {statusTransitionOptions(job.status as JobStatusType).map((target) => (
                        <DropdownMenuItem
                          key={target}
                          className="text-xs"
                          disabled={statusChangingId === job.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            void (async () => {
                              try {
                                setStatusChangingId(job.id);
                                if (target === "open") {
                                  await publishJob(job.id);
                                  toast.success(t("job_published"));
                                } else if (target === "draft") {
                                  if (job.status === "archived") {
                                    await unarchiveJob(job.id);
                                    toast.success(t("job_restored_to_draft"));
                                  } else {
                                    await unpublishJob(job.id);
                                    toast.success(t("job_unpublished"));
                                  }
                                } else {
                                  await archiveJob(job.id);
                                  toast.success(t("job_archived"));
                                }
                                onJobArchived?.();
                              } catch (err) {
                                toast.error(
                                  err instanceof Error
                                    ? err.message
                                    : "Failed to update job status",
                                );
                              } finally {
                                setStatusChangingId(null);
                              }
                            })();
                          }}
                        >
                          <Icon name={statusOptionIcon(target)} className="h-4 w-4 mr-2" />
                          {t(statusKey[target])}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function JobsList({ jobs, onJobArchived }: JobsListProps) {
  const { t } = useTranslation();
  const [createOpen, setCreateOpen] = useState(false);
  const [archivedOpen, setArchivedOpen] = useState(false);

  const activeJobs = jobs
    .filter((j) => j.status !== "archived")
    .sort((a, b) => (a.status === "open" ? -1 : b.status === "open" ? 1 : 0));
  const archivedJobs = jobs.filter((j) => j.status === "archived");

  if (jobs.length === 0) {
    return (
      <>
        <EmptyCard
          icon="Briefcase"
          title={t("jobs_title")}
          description={t("jobs_subtitle")}
          actionLabel={t("create")}
          onAction={() => setCreateOpen(true)}
        />
        <CreateJobModal open={createOpen} onOpenChange={setCreateOpen} />
      </>
    );
  }

  return (
    <div className="space-y-2">
      {activeJobs.map((job) => (
        <JobCard key={job.id} job={job} onJobArchived={onJobArchived} />
      ))}

      {archivedJobs.length > 0 && (
        <>
          <button
            type="button"
            className="w-full flex items-center gap-3 py-2 group"
            onClick={() => setArchivedOpen((prev) => !prev)}
          >
            <div className="flex-1 border-t border-border" />
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0 select-none group-hover:text-foreground transition-colors">
              {t("archived")} {t("jobs_title")} ({archivedJobs.length})
              <Icon
                name="ChevronLeft"
                className={cn(
                  "h-3.5 w-3.5 transition-transform duration-200",
                  archivedOpen ? "rotate-90" : "-rotate-90",
                )}
              />
            </span>
          </button>

          {archivedOpen && (
            <div className="space-y-2">
              {archivedJobs.map((job) => (
                <JobCard key={job.id} job={job} onJobArchived={onJobArchived} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

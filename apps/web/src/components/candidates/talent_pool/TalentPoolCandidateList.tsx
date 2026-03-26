"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@onehash/ui/card";
import { Avatar } from "@onehash/ui/avatar";
import { Button } from "@onehash/ui/button";
import { Icon } from "@onehash/ui/icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@onehash/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@onehash/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@onehash/ui/dialog";
import { SelectField } from "@onehash/ui/select";
import { formatDayMonth } from "@/lib/format-date";
import { getInitialsFromName } from "@/lib/name-initials";
import {
  deleteCandidate,
  updateCandidate,
  type CandidateListItemResponse,
  type JobListItemResponse,
} from "@/api";
import { toast } from "@onehash/ui/sonner";

type TalentPoolCandidateListProps = {
  candidate: CandidateListItemResponse;
  jobs: JobListItemResponse[];
  onListChange: () => void | Promise<void>;
};

export function TalentPoolCandidateList({
  candidate: c,
  jobs,
  onListChange,
}: TalentPoolCandidateListProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const href = `/talent-pool/${encodeURIComponent(c.id)}`;

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignJobId, setAssignJobId] = useState<string>("");
  const [assignLoading, setAssignLoading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  /** Jobs other than the candidate’s current job (cannot “re-assign” to the same job). */
  const assignableJobs = useMemo(() => jobs.filter((j) => j.id !== c.job_id), [jobs, c.job_id]);

  const openAssignDialog = () => {
    setAssignJobId(assignableJobs[0]?.id ?? "");
    setAssignOpen(true);
  };

  const handleAssign = async () => {
    if (!assignJobId) {
      toast.error(t("select_a_job"));
      return;
    }
    if (assignJobId === c.job_id) {
      return;
    }
    try {
      setAssignLoading(true);
      await updateCandidate(c.id, { job_id: assignJobId });
      setAssignOpen(false);
      toast.success(t("assigned_to_job"));
      await onListChange();
      router.push(
        `/jobs/${encodeURIComponent(assignJobId)}/candidates/${encodeURIComponent(c.id)}`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error"));
    } finally {
      setAssignLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleteLoading(true);
      await deleteCandidate(c.id);
      setDeleteOpen(false);
      toast.success(t("candidate_deleted"));
      await onListChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error"));
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <>
      <Card
        className="cursor-pointer hover:shadow-sm active:bg-muted/50 transition-all"
        onClick={() => router.push(href)}
      >
        <CardContent className="p-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Avatar
                className="h-10 w-10 shrink-0"
                alt={c.name}
                fallbackClassName="bg-muted text-xs font-medium"
              >
                {getInitialsFromName(c.name)}
              </Avatar>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-medium">{c.name}</h3>
                <p className="truncate text-xs text-muted-foreground">{c.email}</p>
              </div>
            </div>

            <div
              className="flex shrink-0 items-center gap-2"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                {formatDayMonth(c.created_at)}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    aria-label={t("more_options")}
                  >
                    <Icon name="MoreHorizontal" className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem
                    disabled={assignableJobs.length === 0}
                    onSelect={(e) => {
                      e.preventDefault();
                      openAssignDialog();
                    }}
                  >
                    <Icon name="Briefcase" className="h-3.5 w-3.5 mr-2" />
                    {t("assign_job")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={(e) => {
                      e.preventDefault();
                      setDeleteOpen(true);
                    }}
                  >
                    <Icon name="Trash2" className="h-3.5 w-3.5 mr-2" />
                    {t("delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>{t("assign_job")}</DialogTitle>
            <DialogDescription>{t("assign_job_description")}</DialogDescription>
          </DialogHeader>
          <SelectField
            label={t("jobs_title")}
            value={assignJobId}
            onValueChange={setAssignJobId}
            options={assignableJobs.map((j) => ({ value: j.id, label: j.title }))}
          />
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setAssignOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={assignLoading || !assignJobId}
              pending={assignLoading}
              onClick={() => void handleAssign()}
            >
              {t("assign")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("delete_candidate_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("delete_candidate_description", { name: c.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              disabled={deleteLoading}
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
            >
              {deleteLoading ? t("loading") : t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

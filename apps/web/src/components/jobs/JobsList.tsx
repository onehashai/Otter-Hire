"use client";

import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@onehash/ui/card";
import { Badge } from "@onehash/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@onehash/ui/table";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRouter } from "next/navigation";
import type { JobListItemResponse } from "@/api";
import { DepartmentType, JobStatusType } from "@/app/(app-page-wrapper)/jobs/[jobId]/constants";

const statusKey: Record<JobStatusType, string> = { open: "open", draft: "draft", closed: "closed" };
const deptKey: Record<DepartmentType, string> = {
  engineering: "engineering",
  design: "design",
  data: "data",
  marketing: "marketing",
  sales: "sales",
  operations: "operations",
  hr: "hr",
};

const statusVariant = (s: JobStatusType) => s === "open" ? "default" : s === "draft" ? "secondary" : "outline";

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
  const isMobile = useIsMobile();
  const router = useRouter();

  if (isMobile) {
    return (
      <div className="space-y-2">
        {jobs.map((job) => (
          <Card key={job.id} className="active:bg-muted/50 transition-colors cursor-pointer" onClick={() => router.push(`/jobs/${job.id}/info`)}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-1.5">
                <h3 className="text-sm font-medium leading-tight pr-2">{job.title}</h3>
                <Badge variant={statusVariant(job.status as JobStatusType)} className="text-[10px] shrink-0">{t(statusKey[job.status as JobStatusType] ?? job.status)}</Badge>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {job.department && <span>{t(deptKey[job.department as DepartmentType] ?? job.department)}</span>}
                <span>·</span>
                <span>{job.candidate_count} {job.candidate_count === 1 ? t("candidate") : t("candidates")}</span>
                <span>·</span>
                <span>{formatTimeAgo(job.updated_at)}</span>
              </div>
            </CardContent>
          </Card>
        ))}
        {jobs.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">{t("no_results")}</p>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">{t("role")}</TableHead>
              <TableHead className="text-xs">{t("department")}</TableHead>
              <TableHead className="text-xs">{t("status")}</TableHead>
              <TableHead className="text-xs text-right">{t("candidates")}</TableHead>
              <TableHead className="text-xs text-right">{t("last_activity")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((job) => (
              <TableRow key={job.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/jobs/${job.id}/info`)}>
                <TableCell className="text-sm font-medium">{job.title}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{job.department ? t(deptKey[job.department as DepartmentType] ?? job.department) : "—"}</TableCell>
                <TableCell><Badge variant={statusVariant(job.status as JobStatusType)} className="text-[10px]">{t(statusKey[job.status as JobStatusType] ?? job.status)}</Badge></TableCell>
                <TableCell className="text-xs text-right">{job.candidate_count}</TableCell>
                <TableCell className="text-xs text-muted-foreground text-right">{formatTimeAgo(job.updated_at)}</TableCell>
              </TableRow>
            ))}
            {jobs.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-sm text-muted-foreground text-center py-8">{t("no_results")}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

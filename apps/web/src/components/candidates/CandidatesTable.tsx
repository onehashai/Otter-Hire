"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Avatar } from "@onehash/ui/avatar";
import { Badge } from "@onehash/ui/badge";
import { Checkbox } from "@onehash/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@onehash/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@onehash/ui/tooltip";
import { formatTimestampToDateTime } from "@/lib/format-date";
import { getInitialsFromName } from "@/lib/name-initials";
import { type CandidateListItemResponse, type JobListItemResponse } from "@/api";

type Props = {
  items: CandidateListItemResponse[];
  jobs?: JobListItemResponse[];
  selectedIds?: Set<string>;
  onToggleSelected?: (candidateId: string, nextSelected: boolean) => void;
  onToggleAllVisible?: (nextSelected: boolean) => void;
  onListChange?: () => void | Promise<void>;
};

function formatSourceLabel(source: string | null | undefined, t: (key: string) => string): string {
  if (!source) return "—";
  if (source === "job_board") return t("candidates_source_job_portal");
  if (source === "email_automation") return "Email";
  if (source === "Manual" || source === "manual") return "Manual";
  return source
    .split("_")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ""))
    .join(" ");
}

export function CandidatesTable({
  items,
  selectedIds,
  onToggleSelected,
  onToggleAllVisible,
}: Props) {
  const router = useRouter();
  const { t } = useTranslation();

  const allVisibleSelected = useMemo(() => {
    if (!selectedIds || items.length === 0) return false;
    return items.every((c) => selectedIds.has(c.id));
  }, [items, selectedIds]);

  const someVisibleSelected = useMemo(() => {
    if (!selectedIds || items.length === 0) return false;
    return items.some((c) => selectedIds.has(c.id)) && !allVisibleSelected;
  }, [items, selectedIds, allVisibleSelected]);

  return (
    <>
      <div className="rounded-lg border border-border overflow-x-auto bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {selectedIds && onToggleAllVisible ? (
                <TableHead className="w-10 h-9 align-middle">
                  <div className="flex items-center justify-center">
                    <Checkbox
                      checked={
                        allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false
                      }
                      onCheckedChange={(v) => onToggleAllVisible(!!v)}
                      aria-label="Select all"
                    />
                  </div>
                </TableHead>
              ) : null}
              <TableHead className="text-xs font-medium h-9 min-w-[140px] max-w-[220px]">
                Candidate
              </TableHead>
              <TableHead className="text-xs font-medium h-9 min-w-[160px] hidden md:table-cell max-w-[240px]">
                Email
              </TableHead>
              <TableHead className="text-xs font-medium h-9 min-w-[120px] hidden lg:table-cell max-w-[160px]">
                Phone
              </TableHead>
              <TableHead className="text-xs font-medium h-9 min-w-[160px] hidden lg:table-cell max-w-[280px]">
                {t("candidates_assigned_jobs")}
              </TableHead>
              <TableHead className="text-xs font-medium h-9 min-w-[150px] whitespace-nowrap">
                {t("candidates_table_created")}
              </TableHead>
              <TableHead className="text-xs font-medium h-9 min-w-[100px] hidden sm:table-cell">
                Source
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((c) => {
              const href = `/candidates/${encodeURIComponent(c.id)}`;
              const isSelected = selectedIds ? selectedIds.has(c.id) : false;
              const activeAssignments = (c.assignments ?? []).filter(
                (assignment) => assignment.assignment_status === "active",
              );
              const activeJobTitles = Array.from(
                new Set(
                  activeAssignments
                    .map((assignment) => (assignment.job_title ?? "").trim())
                    .filter((jobTitle) => jobTitle.length > 0),
                ),
              );
              const activeJobsCount = activeAssignments.length;
              const tooltipText =
                activeJobTitles.length > 0
                  ? activeJobTitles.join(", ")
                  : t("candidates_no_assigned_jobs");
              return (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => router.push(href)}>
                  {selectedIds && onToggleSelected ? (
                    <TableCell
                      className="py-2 align-middle"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-center">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(v) => onToggleSelected(c.id, !!v)}
                          aria-label="Select"
                        />
                      </div>
                    </TableCell>
                  ) : null}
                  <TableCell className="py-2 align-middle min-w-0 max-w-[220px]">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar
                        className="h-7 w-7 shrink-0"
                        alt={c.name}
                        fallbackClassName="bg-muted text-xs font-medium"
                      >
                        {getInitialsFromName(c.name)}
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{c.name}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-2 align-middle hidden md:table-cell min-w-0 max-w-[240px]">
                    <span className="text-xs text-muted-foreground truncate block">{c.email}</span>
                  </TableCell>
                  <TableCell className="py-2 align-middle hidden lg:table-cell min-w-0 max-w-[160px]">
                    <span className="text-xs text-muted-foreground truncate block">
                      {c.phone ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell className="py-2 align-middle hidden lg:table-cell min-w-0 max-w-[280px]">
                    {activeJobsCount > 0 ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-xs text-muted-foreground inline-block">
                            {activeJobsCount}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[320px] text-xs">
                          {tooltipText}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="py-2 align-middle min-w-0 max-w-[200px]">
                    <span className="text-xs text-muted-foreground">
                      {formatTimestampToDateTime(c.created_at)}
                    </span>
                  </TableCell>
                  <TableCell className="py-2 align-middle hidden sm:table-cell">
                    <Badge variant="outline" className="text-[10px] font-normal">
                      {formatSourceLabel(c.source, t)}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

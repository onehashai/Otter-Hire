"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Badge } from "@onehash/ui/badge";
import { Checkbox } from "@onehash/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@onehash/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@onehash/ui/tooltip";
import { formatTimestampToDateTime } from "@/lib/format-date";
import { type CandidateListItemResponse, type JobListItemResponse } from "@/api";

export const CANDIDATE_COLUMN_DEFS = {
  name: { label: "Candidate", fixed: true, defaultVisible: true },
  email: { label: "Email", fixed: true, defaultVisible: true },
  phone: { label: "Phone", fixed: false, defaultVisible: true },
  assigned_jobs: { label: "Assigned Jobs", fixed: false, defaultVisible: true },
  created_at: { label: "Created", fixed: false, defaultVisible: true },
  source: { label: "Source", fixed: false, defaultVisible: true },
  status: { label: "Status", fixed: false, defaultVisible: false },
  location: { label: "Location", fixed: false, defaultVisible: false },
  updated_at: { label: "Updated", fixed: false, defaultVisible: false },
  tags: { label: "Tags", fixed: false, defaultVisible: false },
  stage_name: { label: "Stage", fixed: false, defaultVisible: false },
} as const;

export type CandidateColumnKey = keyof typeof CANDIDATE_COLUMN_DEFS;

export const CANDIDATE_ALL_COLUMNS = Object.keys(CANDIDATE_COLUMN_DEFS) as CandidateColumnKey[];
export const CANDIDATE_FIXED_COLUMNS = CANDIDATE_ALL_COLUMNS.filter(
  (key) => CANDIDATE_COLUMN_DEFS[key].fixed,
);
export const DEFAULT_VISIBLE_CANDIDATE_COLUMNS = CANDIDATE_ALL_COLUMNS.filter(
  (key) => CANDIDATE_COLUMN_DEFS[key].defaultVisible,
);

export function normalizeVisibleCandidateColumns(
  visibleColumns: string[] | CandidateColumnKey[] | null | undefined,
): CandidateColumnKey[] {
  const incoming = new Set(
    (visibleColumns ?? []).filter((v): v is CandidateColumnKey => v in CANDIDATE_COLUMN_DEFS),
  );
  for (const fixed of CANDIDATE_FIXED_COLUMNS) incoming.add(fixed);
  const normalized = CANDIDATE_ALL_COLUMNS.filter((key) => incoming.has(key));
  return normalized.length > 0 ? normalized : DEFAULT_VISIBLE_CANDIDATE_COLUMNS;
}

type Props = {
  items: CandidateListItemResponse[];
  jobs?: JobListItemResponse[];
  selectedIds?: Set<string>;
  visibleColumns?: CandidateColumnKey[];
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
  visibleColumns,
  onToggleSelected,
  onToggleAllVisible,
}: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const visibleColumnSet = useMemo(
    () => new Set(normalizeVisibleCandidateColumns(visibleColumns)),
    [visibleColumns],
  );

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
      <div className="rounded-lg border border-border bg-card">
        <Table className="w-max min-w-full">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {selectedIds && onToggleAllVisible ? (
                <TableHead className="w-10 h-9 align-middle text-center">
                  <div className="flex items-center justify-center">
                    <Checkbox
                      className="rounded-[4px]"
                      checked={
                        allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false
                      }
                      onCheckedChange={(v) => onToggleAllVisible(!!v)}
                      aria-label="Select all"
                    />
                  </div>
                </TableHead>
              ) : null}
              <TableHead className="text-xs font-medium h-9 min-w-[140px] max-w-[220px] text-center">
                Candidate
              </TableHead>
              {visibleColumnSet.has("email") ? (
                <TableHead className="text-xs font-medium h-9 min-w-[160px] max-w-[240px] text-center">
                  Email
                </TableHead>
              ) : null}
              {visibleColumnSet.has("phone") ? (
                <TableHead className="text-xs font-medium h-9 min-w-[120px] max-w-[160px] text-center">
                  Phone
                </TableHead>
              ) : null}
              {visibleColumnSet.has("assigned_jobs") ? (
                <TableHead className="text-xs font-medium h-9 min-w-[160px] max-w-[280px] text-center">
                  {t("candidates_assigned_jobs")}
                </TableHead>
              ) : null}
              {visibleColumnSet.has("created_at") ? (
                <TableHead className="text-xs font-medium h-9 min-w-[150px] whitespace-nowrap text-center">
                  {t("candidates_table_created")}
                </TableHead>
              ) : null}
              {visibleColumnSet.has("source") ? (
                <TableHead className="text-xs font-medium h-9 min-w-[100px] text-center">
                  Source
                </TableHead>
              ) : null}
              {visibleColumnSet.has("status") ? (
                <TableHead className="text-xs font-medium h-9 min-w-[100px] text-center">
                  Status
                </TableHead>
              ) : null}
              {visibleColumnSet.has("location") ? (
                <TableHead className="text-xs font-medium h-9 min-w-[160px] max-w-[220px] text-center">
                  Location
                </TableHead>
              ) : null}
              {visibleColumnSet.has("updated_at") ? (
                <TableHead className="text-xs font-medium h-9 min-w-[150px] whitespace-nowrap text-center">
                  Updated
                </TableHead>
              ) : null}
              {visibleColumnSet.has("tags") ? (
                <TableHead className="text-xs font-medium h-9 min-w-[180px] max-w-[260px] text-center">
                  Tags
                </TableHead>
              ) : null}
              {visibleColumnSet.has("stage_name") ? (
                <TableHead className="text-xs font-medium h-9 min-w-[140px] max-w-[200px] text-center">
                  Stage
                </TableHead>
              ) : null}
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
                      className="py-2 align-middle text-center"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-center">
                        <Checkbox
                          className="rounded-[4px]"
                          checked={isSelected}
                          onCheckedChange={(v) => onToggleSelected(c.id, !!v)}
                          aria-label="Select"
                        />
                      </div>
                    </TableCell>
                  ) : null}
                  <TableCell className="py-2 align-middle min-w-0 max-w-[220px] text-center">
                    <div className="min-w-0 text-center">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                    </div>
                  </TableCell>
                  {visibleColumnSet.has("email") ? (
                    <TableCell className="py-2 align-middle min-w-0 max-w-[240px] text-center">
                      <span className="text-xs text-muted-foreground truncate block">
                        {c.email}
                      </span>
                    </TableCell>
                  ) : null}
                  {visibleColumnSet.has("phone") ? (
                    <TableCell className="py-2 align-middle min-w-0 max-w-[160px] text-center">
                      <span className="text-xs text-muted-foreground truncate block">
                        {c.phone ?? "—"}
                      </span>
                    </TableCell>
                  ) : null}
                  {visibleColumnSet.has("assigned_jobs") ? (
                    <TableCell className="py-2 align-middle min-w-0 max-w-[280px] text-center">
                      {activeJobsCount > 0 ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-xs text-muted-foreground inline-block mx-auto">
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
                  ) : null}
                  {visibleColumnSet.has("created_at") ? (
                    <TableCell className="py-2 align-middle min-w-0 max-w-[200px] text-center">
                      <span className="text-xs text-muted-foreground">
                        {formatTimestampToDateTime(c.created_at)}
                      </span>
                    </TableCell>
                  ) : null}
                  {visibleColumnSet.has("source") ? (
                    <TableCell className="py-2 align-middle text-center">
                      <Badge
                        variant="outline"
                        className="text-[10px] font-normal whitespace-nowrap mx-auto"
                      >
                        {formatSourceLabel(c.source, t)}
                      </Badge>
                    </TableCell>
                  ) : null}
                  {visibleColumnSet.has("status") ? (
                    <TableCell className="py-2 align-middle text-center">
                      <Badge
                        variant="secondary"
                        className="text-[10px] font-normal capitalize mx-auto"
                      >
                        {c.status}
                      </Badge>
                    </TableCell>
                  ) : null}
                  {visibleColumnSet.has("location") ? (
                    <TableCell className="py-2 align-middle min-w-0 max-w-[220px] text-center">
                      <span className="text-xs text-muted-foreground truncate block">
                        {c.location ?? "—"}
                      </span>
                    </TableCell>
                  ) : null}
                  {visibleColumnSet.has("updated_at") ? (
                    <TableCell className="py-2 align-middle min-w-0 max-w-[200px] text-center">
                      <span className="text-xs text-muted-foreground">
                        {formatTimestampToDateTime(c.updated_at)}
                      </span>
                    </TableCell>
                  ) : null}
                  {visibleColumnSet.has("tags") ? (
                    <TableCell className="py-2 align-middle min-w-0 max-w-[260px] text-center">
                      <div className="flex flex-wrap justify-center gap-1">
                        {(c.tags ?? []).length > 0 ? (
                          (c.tags ?? []).slice(0, 3).map((tag) => (
                            <Badge key={tag} variant="outline" className="text-[10px] font-normal">
                              {tag}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                  ) : null}
                  {visibleColumnSet.has("stage_name") ? (
                    <TableCell className="py-2 align-middle min-w-0 max-w-[200px] text-center">
                      <span className="text-xs text-muted-foreground truncate block">
                        {c.stage_name ?? "—"}
                      </span>
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

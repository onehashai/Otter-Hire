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

export function normalizeCandidateColumnOrder(
  columnOrder: string[] | CandidateColumnKey[] | null | undefined,
): CandidateColumnKey[] {
  const incoming = (columnOrder ?? []).filter(
    (key): key is CandidateColumnKey => key in CANDIDATE_COLUMN_DEFS,
  );
  const uniqueOrdered: CandidateColumnKey[] = [];
  const seen = new Set<CandidateColumnKey>();
  for (const key of incoming) {
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueOrdered.push(key);
  }
  for (const key of CANDIDATE_ALL_COLUMNS) {
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueOrdered.push(key);
  }
  return uniqueOrdered;
}

export function normalizeVisibleCandidateColumns(
  visibleColumns: string[] | CandidateColumnKey[] | null | undefined,
): CandidateColumnKey[] {
  const incoming = new Set(
    (visibleColumns ?? []).filter((v): v is CandidateColumnKey => v in CANDIDATE_COLUMN_DEFS),
  );
  for (const fixed of CANDIDATE_FIXED_COLUMNS) incoming.add(fixed);
  const normalized = normalizeCandidateColumnOrder(CANDIDATE_ALL_COLUMNS).filter((key) =>
    incoming.has(key),
  );
  return normalized.length > 0 ? normalized : DEFAULT_VISIBLE_CANDIDATE_COLUMNS;
}

type Props = {
  items: CandidateListItemResponse[];
  jobs?: JobListItemResponse[];
  selectedIds?: Set<string>;
  visibleColumns?: CandidateColumnKey[];
  columnOrder?: CandidateColumnKey[];
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
  columnOrder,
  onToggleSelected,
  onToggleAllVisible,
}: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const visibleColumnSet = useMemo(
    () => new Set(normalizeVisibleCandidateColumns(visibleColumns)),
    [visibleColumns],
  );
  const normalizedColumnOrder = useMemo(
    () => normalizeCandidateColumnOrder(columnOrder),
    [columnOrder],
  );
  const orderedVisibleColumns = useMemo(
    () => normalizedColumnOrder.filter((column) => visibleColumnSet.has(column)),
    [normalizedColumnOrder, visibleColumnSet],
  );

  const allVisibleSelected = useMemo(() => {
    if (!selectedIds || items.length === 0) return false;
    return items.every((c) => selectedIds.has(c.id));
  }, [items, selectedIds]);

  const someVisibleSelected = useMemo(() => {
    if (!selectedIds || items.length === 0) return false;
    return items.some((c) => selectedIds.has(c.id)) && !allVisibleSelected;
  }, [items, selectedIds, allVisibleSelected]);

  const renderHeader = (column: CandidateColumnKey) => {
    if (column === "name") {
      return (
        <TableHead
          key={column}
          className="text-xs font-medium h-9 min-w-[140px] max-w-[220px] text-center"
        >
          Candidate
        </TableHead>
      );
    }
    if (column === "email") {
      return (
        <TableHead
          key={column}
          className="text-xs font-medium h-9 min-w-[160px] max-w-[240px] text-center"
        >
          Email
        </TableHead>
      );
    }
    if (column === "phone") {
      return (
        <TableHead
          key={column}
          className="text-xs font-medium h-9 min-w-[120px] max-w-[160px] text-center"
        >
          Phone
        </TableHead>
      );
    }
    if (column === "assigned_jobs") {
      return (
        <TableHead
          key={column}
          className="text-xs font-medium h-9 min-w-[160px] max-w-[280px] text-center"
        >
          {t("candidates_assigned_jobs")}
        </TableHead>
      );
    }
    if (column === "created_at") {
      return (
        <TableHead
          key={column}
          className="text-xs font-medium h-9 min-w-[150px] whitespace-nowrap text-center"
        >
          {t("candidates_table_created")}
        </TableHead>
      );
    }
    if (column === "source") {
      return (
        <TableHead key={column} className="text-xs font-medium h-9 min-w-[100px] text-center">
          Source
        </TableHead>
      );
    }
    if (column === "status") {
      return (
        <TableHead key={column} className="text-xs font-medium h-9 min-w-[100px] text-center">
          Status
        </TableHead>
      );
    }
    if (column === "location") {
      return (
        <TableHead
          key={column}
          className="text-xs font-medium h-9 min-w-[160px] max-w-[220px] text-center"
        >
          Location
        </TableHead>
      );
    }
    if (column === "updated_at") {
      return (
        <TableHead
          key={column}
          className="text-xs font-medium h-9 min-w-[150px] whitespace-nowrap text-center"
        >
          Updated
        </TableHead>
      );
    }
    if (column === "tags") {
      return (
        <TableHead
          key={column}
          className="text-xs font-medium h-9 min-w-[180px] max-w-[260px] text-center"
        >
          Tags
        </TableHead>
      );
    }
    return (
      <TableHead
        key={column}
        className="text-xs font-medium h-9 min-w-[140px] max-w-[200px] text-center"
      >
        Stage
      </TableHead>
    );
  };

  const renderCell = (column: CandidateColumnKey, c: CandidateListItemResponse) => {
    const activeAssignmentRows = (c.assignments ?? [])
      .filter((assignment) => assignment.assignment_status === "active")
      .map((assignment) => ({
        key: assignment.assigned_id,
        jobTitle: (assignment.job_title ?? "").trim() || "Untitled job",
        stageName: (assignment.stage_name ?? "").trim() || "No stage",
      }));
    const activeJobsCount = activeAssignmentRows.length;
    const activeStagesCount = activeAssignmentRows.length;

    if (column === "name") {
      return (
        <TableCell key={column} className="py-2 align-middle min-w-0 max-w-[220px] text-center">
          <div className="min-w-0 text-center">
            <p className="text-sm font-medium truncate">{c.name}</p>
          </div>
        </TableCell>
      );
    }
    if (column === "email") {
      return (
        <TableCell key={column} className="py-2 align-middle min-w-0 max-w-[240px] text-center">
          <span className="text-xs text-muted-foreground truncate block">{c.email}</span>
        </TableCell>
      );
    }
    if (column === "phone") {
      return (
        <TableCell key={column} className="py-2 align-middle min-w-0 max-w-[160px] text-center">
          <span className="text-xs text-muted-foreground truncate block">{c.phone ?? "—"}</span>
        </TableCell>
      );
    }
    if (column === "assigned_jobs") {
      return (
        <TableCell key={column} className="py-2 align-middle min-w-0 max-w-[280px] text-center">
          {activeJobsCount > 0 ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-xs text-muted-foreground inline-block mx-auto">
                  {activeJobsCount}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[320px] text-xs">
                <div className="space-y-1">
                  {activeAssignmentRows.map((row) => (
                    <p key={row.key} className="text-xs leading-4">
                      {row.jobTitle}
                    </p>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </TableCell>
      );
    }
    if (column === "created_at") {
      return (
        <TableCell key={column} className="py-2 align-middle min-w-0 max-w-[200px] text-center">
          <span className="text-xs text-muted-foreground">
            {formatTimestampToDateTime(c.created_at)}
          </span>
        </TableCell>
      );
    }
    if (column === "source") {
      return (
        <TableCell key={column} className="py-2 align-middle text-center">
          <Badge variant="outline" className="text-[10px] font-normal whitespace-nowrap mx-auto">
            {formatSourceLabel(c.source, t)}
          </Badge>
        </TableCell>
      );
    }
    if (column === "status") {
      return (
        <TableCell key={column} className="py-2 align-middle text-center">
          <Badge variant="secondary" className="text-[10px] font-normal capitalize mx-auto">
            {c.status}
          </Badge>
        </TableCell>
      );
    }
    if (column === "location") {
      return (
        <TableCell key={column} className="py-2 align-middle min-w-0 max-w-[220px] text-center">
          <span className="text-xs text-muted-foreground truncate block">{c.location ?? "—"}</span>
        </TableCell>
      );
    }
    if (column === "updated_at") {
      return (
        <TableCell key={column} className="py-2 align-middle min-w-0 max-w-[200px] text-center">
          <span className="text-xs text-muted-foreground">
            {formatTimestampToDateTime(c.updated_at)}
          </span>
        </TableCell>
      );
    }
    if (column === "tags") {
      return (
        <TableCell key={column} className="py-2 align-middle min-w-0 max-w-[260px] text-center">
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
      );
    }
    return (
      <TableCell key={column} className="py-2 align-middle min-w-0 max-w-[200px] text-center">
        {activeStagesCount > 0 ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xs text-muted-foreground inline-block mx-auto">
                {activeStagesCount}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[360px] text-xs">
              <div className="space-y-1">
                {activeAssignmentRows.map((row) => (
                  <p key={`stage-${row.key}`} className="text-xs leading-4">
                    {row.jobTitle} - {row.stageName}
                  </p>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
    );
  };

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
              {orderedVisibleColumns.map((column) => renderHeader(column))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((c) => {
              const href = `/candidates/${encodeURIComponent(c.id)}`;
              const isSelected = selectedIds ? selectedIds.has(c.id) : false;
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
                  {orderedVisibleColumns.map((column) => renderCell(column, c))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

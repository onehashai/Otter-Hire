"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@onehash/ui/avatar";
import { Badge } from "@onehash/ui/badge";
import { Checkbox } from "@onehash/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@onehash/ui/table";
import { formatDayMonth } from "@/lib/format-date";
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

export function TalentPoolCandidatesTable({
  items,
  selectedIds,
  onToggleSelected,
  onToggleAllVisible,
}: Props) {
  const router = useRouter();

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
      <div className="rounded-lg border border-border overflow-hidden bg-card">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {selectedIds && onToggleAllVisible ? (
                <TableHead className="w-10 h-9">
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
              <TableHead className="text-xs font-medium h-9 w-[240px]">Candidate</TableHead>
              <TableHead className="text-xs font-medium h-9 hidden md:table-cell w-[260px]">
                Email
              </TableHead>
              <TableHead className="text-xs font-medium h-9 hidden lg:table-cell w-[160px]">
                Phone
              </TableHead>
              <TableHead className="text-xs font-medium h-9 w-[120px]">Applied</TableHead>
              <TableHead className="text-xs font-medium h-9 hidden sm:table-cell w-[120px]">
                Source
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((c) => {
              const href = `/talent-pool/${encodeURIComponent(c.id)}`;
              const isSelected = selectedIds ? selectedIds.has(c.id) : false;
              return (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => router.push(href)}>
                  {selectedIds && onToggleSelected ? (
                    <TableCell
                      className="py-2"
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
                  <TableCell className="py-2">
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
                  <TableCell className="py-2 hidden md:table-cell">
                    <span className="text-xs text-muted-foreground truncate block max-w-[260px]">
                      {c.email}
                    </span>
                  </TableCell>
                  <TableCell className="py-2 hidden lg:table-cell">
                    <span className="text-xs text-muted-foreground truncate block max-w-[160px]">
                      {c.phone ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell className="py-2">
                    <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                      {formatDayMonth(c.created_at)}
                    </span>
                  </TableCell>
                  <TableCell className="py-2 hidden sm:table-cell">
                    <Badge variant="outline" className="text-[10px]">
                      {c.source ?? "—"}
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

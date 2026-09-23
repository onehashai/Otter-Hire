"use client";

import { Button } from "@onehash/ui/button";
import { Label } from "@onehash/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@onehash/ui/select";

export const TABLE_PAGE_SIZE_OPTIONS = Array.from({ length: 20 }, (_, index) => (index + 1) * 10);
export const DEFAULT_TABLE_PAGE_SIZE = 20;

type PageItem = number | "ellipsis";

function pageItems(totalPages: number, page: number): PageItem[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);

  const visiblePages = new Set([1, totalPages]);
  if (page <= 4) {
    [2, 3, 4, 5].forEach((value) => visiblePages.add(value));
  } else if (page >= totalPages - 3) {
    [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1].forEach((value) =>
      visiblePages.add(value),
    );
  } else {
    [page - 1, page, page + 1].forEach((value) => visiblePages.add(value));
  }

  const result: PageItem[] = [];
  let previous = 0;
  for (const value of [...visiblePages].sort((left, right) => left - right)) {
    if (value - previous > 1) result.push("ellipsis");
    result.push(value);
    previous = value;
  }
  return result;
}

type TablePaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  itemsOnPage: number;
  recordLabel?: string;
  disabled?: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};

export function TablePagination({
  page,
  pageSize,
  total,
  itemsOnPage,
  recordLabel = "records",
  disabled = false,
  onPageChange,
  onPageSizeChange,
}: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startRow = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRow = total === 0 ? 0 : Math.min(startRow + itemsOnPage - 1, total);

  return (
    <div className="flex flex-col gap-3 pt-4 lg:flex-row lg:items-center lg:justify-between">
      <p className="text-xs text-muted-foreground" aria-live="polite">
        Showing {startRow} - {endRow} of {total} {recordLabel}
      </p>
      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
        <div className="flex items-center gap-2">
          <Label className="whitespace-nowrap text-xs text-muted-foreground">Rows per page:</Label>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => onPageSizeChange(Number(value))}
          >
            <SelectTrigger className="h-8 w-[72px] text-xs" aria-label="Rows per page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TABLE_PAGE_SIZE_OPTIONS.map((option) => (
                <SelectItem key={option} value={String(option)} className="text-xs">
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-20 text-xs"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          Previous
        </Button>
        <div className="flex items-center gap-1" aria-label={`Page ${page} of ${totalPages}`}>
          {pageItems(totalPages, page).map((item, index) =>
            item === "ellipsis" ? (
              <span
                key={`ellipsis-${index}`}
                className="flex h-8 w-5 items-center justify-center text-xs text-muted-foreground"
                aria-hidden="true"
              >
                ...
              </span>
            ) : (
              <Button
                key={item}
                type="button"
                variant={item === page ? "default" : "outline"}
                size="sm"
                className="h-8 min-w-8 px-2 text-xs"
                disabled={disabled}
                onClick={() => onPageChange(item)}
                aria-current={item === page ? "page" : undefined}
                aria-label={`Page ${item}`}
              >
                {item}
              </Button>
            ),
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-20 text-xs"
          disabled={disabled || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          Next
        </Button>
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          Page {page} of {totalPages}
        </span>
      </div>
    </div>
  );
}

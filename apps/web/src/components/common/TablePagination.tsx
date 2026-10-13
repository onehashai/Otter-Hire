"use client";

import { useState } from "react";
import { ArrowLeft, Check, ChevronDown } from "lucide-react";
import { Button } from "@onehash/ui/button";
import { InputField } from "@onehash/ui/input";
import { Label } from "@onehash/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@onehash/ui/popover";

export const TABLE_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
export const DEFAULT_TABLE_PAGE_SIZE = 20;
export const MAX_TABLE_PAGE_SIZE = 200;

export function isValidTablePageSize(pageSize: number): boolean {
  return Number.isInteger(pageSize) && pageSize >= 1 && pageSize <= MAX_TABLE_PAGE_SIZE;
}

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
  const [customOpen, setCustomOpen] = useState(false);
  const [showCustomEditor, setShowCustomEditor] = useState(false);
  const [customPageSize, setCustomPageSize] = useState(String(pageSize));
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startRow = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRow = total === 0 ? 0 : Math.min(startRow + itemsOnPage - 1, total);
  const parsedCustomPageSize = Number(customPageSize);
  const canApplyCustomPageSize =
    isValidTablePageSize(parsedCustomPageSize) && parsedCustomPageSize !== pageSize;

  return (
    <div className="flex flex-col gap-3 pt-4 lg:flex-row lg:items-center lg:justify-between">
      <p className="text-xs text-muted-foreground" aria-live="polite">
        Showing {startRow} - {endRow} of {total} {recordLabel}
      </p>
      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
        <div className="flex items-center gap-2">
          <Label className="whitespace-nowrap text-xs text-muted-foreground">Rows per page:</Label>
          <Popover
            open={customOpen}
            onOpenChange={(nextOpen) => {
              setCustomOpen(nextOpen);
              if (nextOpen) {
                setShowCustomEditor(false);
                setCustomPageSize(String(pageSize));
              }
            }}
          >
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-[72px] justify-between px-2 text-xs"
                aria-label="Rows per page"
                disabled={disabled}
              >
                {pageSize}
                <ChevronDown className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-48 space-y-1 p-1">
              {showCustomEditor ? (
                <div className="space-y-3 p-2">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      aria-label="Back to page sizes"
                      onClick={() => setShowCustomEditor(false)}
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <Label htmlFor="custom-page-size" className="text-xs">
                      Custom page size
                    </Label>
                  </div>
                  <InputField
                    id="custom-page-size"
                    type="number"
                    min={1}
                    max={MAX_TABLE_PAGE_SIZE}
                    step={1}
                    value={customPageSize}
                    onChange={(event) => setCustomPageSize(event.target.value)}
                    className="h-8 text-sm"
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="w-full"
                    disabled={!canApplyCustomPageSize || disabled}
                    onClick={() => {
                      onPageSizeChange(parsedCustomPageSize);
                      setCustomOpen(false);
                    }}
                  >
                    Apply
                  </Button>
                </div>
              ) : (
                <>
                  {TABLE_PAGE_SIZE_OPTIONS.map((option) => (
                    <Button
                      key={option}
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-full justify-between px-2 text-xs font-normal"
                      disabled={disabled}
                      onClick={() => {
                        onPageSizeChange(option);
                        setCustomOpen(false);
                      }}
                    >
                      {option}
                      {pageSize === option && <Check className="h-4 w-4" aria-hidden="true" />}
                    </Button>
                  ))}
                  {!TABLE_PAGE_SIZE_OPTIONS.includes(pageSize) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-full justify-between px-2 text-xs font-normal"
                      disabled={disabled}
                      onClick={() => setShowCustomEditor(true)}
                    >
                      Custom ({pageSize})
                      <Check className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  )}
                  <div className="my-1 border-t border-border" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-full justify-start px-2 text-xs font-normal"
                    disabled={disabled}
                    onClick={() => {
                      setCustomPageSize(String(pageSize));
                      setShowCustomEditor(true);
                    }}
                  >
                    Custom
                  </Button>
                </>
              )}
            </PopoverContent>
          </Popover>
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

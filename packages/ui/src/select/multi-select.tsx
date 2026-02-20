"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "../lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "../popover";
import { Checkbox } from "../checkbox";
import { Button } from "../button";

export type MultiSelectOption = { value: string; label: string };

export interface MultiSelectProps {
  value: string[];
  onValueChange: (value: string[]) => void;
  options: MultiSelectOption[];
  placeholder?: string;
  label?: string;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  disabled?: boolean;
  /** Max height of the options list (default 240) */
  maxHeight?: number;
  /** Show "Select all" / "Clear" actions in the content */
  showSelectAllClear?: boolean;
}

function MultiSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select...",
  label,
  className,
  triggerClassName,
  contentClassName,
  disabled,
  maxHeight = 240,
  showSelectAllClear = false,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);

  const selectedSet = React.useMemo(() => new Set(value), [value]);
  const allSelected = options.length > 0 && selectedSet.size === options.length;

  const toggle = (optionValue: string) => {
    const next = new Set(selectedSet);
    if (next.has(optionValue)) {
      next.delete(optionValue);
    } else {
      next.add(optionValue);
    }
    onValueChange(Array.from(next));
  };

  const handleSelectAll = () => {
    if (allSelected) {
      onValueChange([]);
    } else {
      onValueChange(options.map((o) => o.value));
    }
  };

  const handleClear = () => {
    onValueChange([]);
  };

  const displayText =
    value.length === 0
      ? placeholder
      : value.length === 1
        ? options.find((o) => o.value === value[0])?.label ?? value[0]
        : `${value.length} selected`;

  const trigger = (
    <PopoverTrigger asChild>
      <button
        type="button"
        disabled={disabled}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1 transition-colors text-left",
          triggerClassName,
        )}
      >
        <span className={cn(!value.length && "text-muted-foreground")}>{displayText}</span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </button>
    </PopoverTrigger>
  );

  return (
    <div className={cn("space-y-1.5", className)}>
      {label ? (
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
      ) : null}
      <Popover open={open} onOpenChange={setOpen}>
        {trigger}
        <PopoverContent className={cn("w-[var(--radix-popover-trigger-width)] p-0", contentClassName)} align="start">
          {showSelectAllClear && options.length > 0 ? (
            <div className="flex items-center gap-1 border-b border-border/50 p-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs flex-1"
                onClick={handleSelectAll}
              >
                {allSelected ? "Clear all" : "Select all"}
              </Button>
            </div>
          ) : null}
          <div className="p-1 overflow-y-auto" style={{ maxHeight }}>
            <div className="space-y-0.5">
              {options.map((opt) => (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-center gap-2 rounded-sm py-1.5 pl-2 pr-2 text-sm hover:bg-accent hover:text-accent-foreground"
                >
                  <Checkbox
                    checked={selectedSet.has(opt.value)}
                    onCheckedChange={() => toggle(opt.value)}
                  />
                  <span className="flex-1">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export { MultiSelect };

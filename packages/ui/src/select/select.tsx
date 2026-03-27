"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";

import { cn } from "../lib/utils";
import { Label } from "../label";
import { InputField } from "../input";

const Select = SelectPrimitive.Root;
const SelectValue = SelectPrimitive.Value;

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1 transition-colors",
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

type SelectContentProps = React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content> & {
  header?: React.ReactNode;
};

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  SelectContentProps
>(({ className, children, position = "popper", header, ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        "relative z-50 flex max-h-96 min-w-[8rem] flex-col overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        position === "popper" &&
          "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
        className,
      )}
      position={position}
      {...props}
    >
      {header ? (
        <div className="shrink-0 border-b border-border/50 bg-popover px-2 pt-1 pb-1.5">
          {header}
        </div>
      ) : null}
      <SelectPrimitive.Viewport
        className={cn(
          "p-1 min-h-0 flex-1 overflow-y-auto",
          position === "popper" && "w-full min-w-[var(--radix-select-trigger-width)]",
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 focus:bg-accent focus:text-accent-foreground",
      className,
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </span>

    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

export type SelectOption = { value: string; label: string };

type SelectFieldProps = {
  label?: string;
  hint?: string;
  className?: string;
  children?: React.ReactNode;
  value?: string;
  onValueChange?: (value: string) => void;
  options?: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  showAsterisk?: boolean;
};

function SelectField({
  label,
  hint,
  children,
  className,
  value,
  onValueChange,
  options,
  placeholder = "Select",
  disabled,
  showAsterisk,
}: SelectFieldProps) {
  const useOptions = options != null && value !== undefined && onValueChange != null;

  return (
    <div className={cn("space-y-1.5", className)}>
      {label ? <Label className="text-xs font-medium text-muted-foreground">{label}
        {showAsterisk && <span className="text-destructive ml-0.5">*</span>}
      </Label> : null}
      {useOptions ? (
        <Select value={value} onValueChange={onValueChange} disabled={disabled}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        children
      )}
      {hint && <p className="text-[11px] text-muted-foreground/70">{hint}</p>}
    </div>
  );
}

export type SearchableSelectFieldProps = {
  label?: string;
  hint?: string;
  className?: string;
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  options: SelectOption[];
  getDisplayValue?: (value: string) => string;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  noResultsText?: string;
  typeToNarrowText?: string;
  maxOptions?: number;
  showAsterisk?: boolean;
};

function SearchableSelectField({
  label,
  hint,
  className,
  value,
  onValueChange,
  placeholder = "Select",
  disabled,
  options,
  getDisplayValue,
  searchPlaceholder,
  searchValue = "",
  onSearchChange,
  noResultsText = "No results.",
  typeToNarrowText,
  maxOptions = 500,
  showAsterisk,
}: SearchableSelectFieldProps) {
  const selectedOption = options.find((o) => o.value === value);
  const displayValue = value
    ? getDisplayValue
      ? getDisplayValue(value)
      : selectedOption?.label
    : undefined;
  const hasSearch = searchPlaceholder != null && onSearchChange != null;
  const visibleOptions = maxOptions ? options.slice(0, maxOptions) : options;
  const showTypeToNarrow = maxOptions != null && options.length > maxOptions && typeToNarrowText;

  return (
    <SelectField label={label} hint={hint} className={className} showAsterisk={showAsterisk}>
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger >
          <SelectValue placeholder={placeholder}>{displayValue ?? null}</SelectValue>
        </SelectTrigger>
        <SelectContent
          header={
            hasSearch ? (
              <InputField
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(e) => onSearchChange?.(e.target.value)}
                className="h-7 text-xs"
              />
            ) : undefined
          }
        >
          {visibleOptions.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">{noResultsText}</div>
          ) : (
            visibleOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))
          )}
          {showTypeToNarrow ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">{typeToNarrowText}</div>
          ) : null}
        </SelectContent>
      </Select>
    </SelectField>
  );
}

export {
  Select,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectField,
  SearchableSelectField,
};

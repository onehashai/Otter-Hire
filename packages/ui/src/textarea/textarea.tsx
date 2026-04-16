"use client";

import * as React from "react";

import { Label } from "../label";
import { cn } from "../lib/utils";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

function Textarea({ ref, className, ...props }: TextareaProps & { ref?: React.Ref<HTMLTextAreaElement> }) {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
}
Textarea.displayName = "Textarea";

interface BulkTextAreaProps extends Omit<React.ComponentProps<"textarea">, "onChange"> {
  label?: string;
  showAsterisk?: boolean;
  error?: string;
  hint?: string;
  onChange?: (value: string) => void;
  ref?: React.Ref<HTMLTextAreaElement>;
}

function BulkTextArea({ ref, className, label, showAsterisk, error, hint, onChange, ...props }: BulkTextAreaProps) {
  return (
    <div className="w-full">
      {label && (
        <Label className="text-xs font-medium text-muted-foreground">
          {label}
          {showAsterisk && <span className="text-destructive ml-0.5">*</span>}
        </Label>
      )}
      <textarea
        className={cn(
          "flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 transition-colors resize-none",
          error && "border-destructive focus-visible:border-destructive",
          className,
        )}
        ref={ref}
        aria-invalid={!!error}
        onChange={(e) => onChange?.(e.target.value)}
        {...props}
      />
      {hint && !error && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
    </div>
  );
}
BulkTextArea.displayName = "BulkTextArea";

export { Textarea, BulkTextArea, type TextareaProps, type BulkTextAreaProps };

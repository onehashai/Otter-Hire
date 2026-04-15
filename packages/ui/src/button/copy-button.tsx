"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";

import { cn } from "../lib/utils";

export interface CopyButtonProps {
  /** Function called on click to get the exact string to copy. Use a getter so the right value is always used. */
  getText: () => string;
  label: string;
  copyFn: (text: string) => Promise<boolean>;
  onSuccess?: () => void;
  onError?: () => void;
  className?: string;
  ref?: React.Ref<HTMLButtonElement>;
}

export function CopyButton({ ref, getText, label, copyFn, onSuccess, onError, className }: CopyButtonProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = React.useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const valueToCopy = getText();
      const ok = await copyFn(valueToCopy);
      if (ok) {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
        onSuccess?.();
      } else {
        onError?.();
      }
    },
    [getText, copyFn, onSuccess, onError],
  );

  return (
    <button
      ref={ref}
      type="button"
      onClick={handleCopy}
      className={cn(
        "shrink-0 p-1 rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors",
        className,
      )}
      aria-label={`Copy ${label}`}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-600" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}
CopyButton.displayName = "CopyButton";

"use client";

import * as React from "react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@onehash/ui/tooltip";
import { cn } from "@/lib/utils";

interface TruncatedTextProps {
  children: React.ReactNode;
  /** Override tooltip text when it differs from rendered children (e.g., raw vs. display filename). */
  tooltipContent?: React.ReactNode;
  className?: string;
  /** The HTML element to render as the truncated container. Defaults to "span". */
  as?: "span" | "p" | "div";
  /** Tooltip side. Defaults to "top". */
  side?: "top" | "bottom" | "left" | "right";
}

export function TruncatedText({
  children,
  tooltipContent,
  className,
  as: Tag = "span",
  side = "top",
}: TruncatedTextProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Tag className={cn("truncate block w-fit max-w-full", className)}>{children}</Tag>
      </TooltipTrigger>
      <TooltipContent side={side}>{tooltipContent ?? children}</TooltipContent>
    </Tooltip>
  );
}

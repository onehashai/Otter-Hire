"use client";

import * as React from "react";
import { cn } from "../lib/utils";
import { Icon, type IconName } from "../icon/icon";
import { Button } from "../button/button";

export interface ErrorCardProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: IconName;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  ref?: React.Ref<HTMLDivElement>;
}

function ErrorCard({ ref, className, icon = "CircleAlert", title, description, actionLabel, onAction, ...props }: ErrorCardProps) {
  return (
    <div
      ref={ref}
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-destructive/25 bg-destructive/5 p-12 text-center",
        className,
      )}
      {...props}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
        <Icon name={icon} size={24} className="text-destructive" />
      </div>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      {description && (
        <p className="mt-1.5 text-sm text-muted-foreground max-w-sm">{description}</p>
      )}
      {actionLabel && onAction && (
        <Button onClick={onAction} variant="outline" className="mt-6" size="sm">
          <Icon name="RefreshCw" size={16} className="mr-1.5" />
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
ErrorCard.displayName = "ErrorCard";

export { ErrorCard };

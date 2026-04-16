"use client";

import * as React from "react";
import { cn } from "../lib/utils";
import { Icon, type IconName } from "../icon/icon";
import { Button } from "../button/button";

export interface EmptyCardProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: IconName;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  ref?: React.Ref<HTMLDivElement>;
}

function EmptyCard({ ref, className, icon = "Briefcase", title, description, actionLabel, onAction, ...props }: EmptyCardProps) {
  return (
    <div
      ref={ref}
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-input bg-muted/10 p-12 text-center",
        className,
      )}
      {...props}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <Icon name={icon} size={24} className="text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      {description && (
        <p className="mt-1.5 text-sm text-muted-foreground max-w-sm">{description}</p>
      )}
      {actionLabel && onAction && (
        <Button onClick={onAction} className="mt-6" size="sm">
          <Icon name="Plus" size={16} />
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
EmptyCard.displayName = "EmptyCard";

export { EmptyCard };

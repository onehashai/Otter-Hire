"use client";

import { cn } from "../lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />;
}

function SkeletonCircle({ className, size = "md", ...props }: React.HTMLAttributes<HTMLDivElement> & { size?: "xs" | "sm" | "md" | "lg" | "xl" }) {
  const sizeClasses = {
    xs: "h-6 w-6",
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12",
    xl: "h-16 w-16",
  };
  return <div className={cn("animate-pulse rounded-full bg-muted", sizeClasses[size], className)} {...props} />;
}

function SkeletonText({ className, lines = 3, ...props }: React.HTMLAttributes<HTMLDivElement> & { lines?: number }) {
  return (
    <div className={cn("space-y-2", className)} {...props}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "animate-pulse rounded bg-muted h-4",
            i === lines - 1 ? "w-3/4" : "w-full"
          )}
        />
      ))}
    </div>
  );
}

function SkeletonLine({ className, width = "full", ...props }: React.HTMLAttributes<HTMLDivElement> & { width?: "full" | "3/4" | "1/2" | "1/4" | "1/3" }) {
  const widthClasses = {
    full: "w-full",
    "3/4": "w-3/4",
    "1/2": "w-1/2",
    "1/4": "w-1/4",
    "1/3": "w-1/3",
  };
  return <div className={cn("animate-pulse rounded bg-muted h-4", widthClasses[width], className)} {...props} />;
}

function SkeletonCard({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("animate-pulse rounded-lg border bg-card p-4 space-y-3", className)} {...props}>
      <div className="flex items-center justify-between">
        <div className="h-4 w-1/3 rounded bg-muted" />
        <div className="h-5 w-16 rounded-full bg-muted" />
      </div>
      <div className="flex items-center gap-3">
        <div className="h-3 w-20 rounded bg-muted" />
        <div className="h-3 w-3 rounded-full bg-muted" />
        <div className="h-3 w-16 rounded bg-muted" />
        <div className="h-3 w-3 rounded-full bg-muted" />
        <div className="h-3 w-12 rounded bg-muted" />
      </div>
    </div>
  );
}

function SkeletonTableRow({ className, columns = 5, ...props }: React.HTMLAttributes<HTMLDivElement> & { columns?: number }) {
  return (
    <div className={cn("flex items-center gap-4 py-3 px-4 border-b", className)} {...props}>
      {Array.from({ length: columns }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "animate-pulse rounded bg-muted h-4",
            i === 0 ? "flex-[2]" : "flex-1"
          )}
        />
      ))}
    </div>
  );
}

function SkeletonAvatar({ className, size = "md", ...props }: React.HTMLAttributes<HTMLDivElement> & { size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12",
  };
  return <div className={cn("animate-pulse rounded-full bg-muted", sizeClasses[size], className)} {...props} />;
}

function SkeletonBadge({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-full bg-muted h-5 w-16", className)} {...props} />;
}

function SkeletonButton({ className, size = "default", ...props }: React.HTMLAttributes<HTMLDivElement> & { size?: "sm" | "default" | "lg" }) {
  const sizeClasses = {
    sm: "h-8 w-20",
    default: "h-10 w-24",
    lg: "h-12 w-32",
  };
  return <div className={cn("animate-pulse rounded-md bg-muted", sizeClasses[size], className)} {...props} />;
}

export {
  Skeleton,
  SkeletonCircle,
  SkeletonText,
  SkeletonLine,
  SkeletonCard,
  SkeletonTableRow,
  SkeletonAvatar,
  SkeletonBadge,
  SkeletonButton,
};

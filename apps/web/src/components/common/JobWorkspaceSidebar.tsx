"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronLeft, Search, Sun, Moon } from "lucide-react";
import { Button } from "@onehash/ui/button";
import { Icon } from "@onehash/ui/icon";
import { Separator } from "@onehash/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@onehash/ui/tooltip";
import { PRODUCT_LOGO_LETTER, PLATFORM_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/components/common/ThemeProvider";
import { getJobWorkspace, type JobWorkspaceResponse } from "@/api";
import { getDefaultStageId } from "@/lib/job-workspace";

interface JobWorkspaceSidebarProps {
  jobId: string;
  collapsed: boolean;
  onToggle: () => void;
  onOpenCommandPalette?: () => void;
}

export function JobWorkspaceSidebar({
  jobId,
  collapsed,
  onToggle,
  onOpenCommandPalette,
}: JobWorkspaceSidebarProps) {
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation();
  const pathname = usePathname();
  const [workspace, setWorkspace] = useState<JobWorkspaceResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getJobWorkspace(jobId);
        if (!cancelled) setWorkspace(data);
      } catch {
        if (!cancelled) setWorkspace(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId, pathname]);

  const stages = workspace?.stages ?? [];
  const sortedStages = [...stages].sort((a, b) => a.position - b.position);
  const defaultStageId = workspace ? getDefaultStageId(workspace.stages) : null;
  const pathSegments = pathname.split("/").filter(Boolean);
  const stageIdFromPath =
    pathSegments.length >= 4 && pathSegments[0] === "jobs" && pathSegments[2] === "stage"
      ? pathSegments[3]
      : null;
  const onCandidateProfile =
    pathSegments.length >= 4 && pathSegments[0] === "jobs" && pathSegments[2] === "candidates";
  const isJobSetupRoute =
    pathSegments[0] === "jobs" &&
    pathSegments[1] === jobId &&
    !(
      pathSegments.length === 2 ||
      (pathSegments[2] === "stage" && Boolean(pathSegments[3])) ||
      (pathSegments[2] === "candidates" && Boolean(pathSegments[3]))
    );
  const activeStageId = onCandidateProfile ? null : (stageIdFromPath ?? defaultStageId);

  const candidateCountByStage = (stageId: string) =>
    (workspace?.candidates ?? []).filter((c) => c.stage_id === stageId).length;

  const backLink = (
    <Link
      href="/jobs"
      className={cn(
        "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors text-sidebar-foreground hover:bg-sidebar-accent",
        collapsed && "justify-center px-0",
      )}
    >
      <ChevronLeft className="h-4 w-4 shrink-0" />
      {!collapsed && <span>Back to Jobs</span>}
    </Link>
  );

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-border bg-sidebar h-screen sticky top-0 transition-all duration-200 ease-in-out shrink-0",
        collapsed ? "w-14" : "w-56",
      )}
    >
      <div
        className={cn(
          "flex items-center h-12 px-3",
          collapsed ? "justify-center" : "justify-between",
        )}
      >
        {!collapsed && (
          <Link href="/" className="flex items-center gap-2 min-w-0">
            <div className="h-6 w-6 rounded-md bg-foreground flex items-center justify-center shrink-0">
              <span className="text-background text-xs font-bold">{PRODUCT_LOGO_LETTER}</span>
            </div>
            <span
              className="text-sm font-semibold text-foreground truncate max-w-[10rem]"
              title={PLATFORM_NAME}
            >
              {PLATFORM_NAME}
            </span>
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0"
        >
          <ChevronsLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
        </Button>
      </div>

      <Separator />

      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>{backLink}</TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              Back to Jobs
            </TooltipContent>
          </Tooltip>
        ) : (
          backLink
        )}

        {!collapsed && (
          <p className="text-[10px] font-semibold text-muted-foreground tracking-wide px-2.5 pt-3 pb-1">
            Stages
          </p>
        )}

        {sortedStages.map((s) => {
          const isActive = activeStageId === s.id;
          const count = candidateCountByStage(s.id);
          const item = (
            <Link
              key={s.id}
              href={`/jobs/${encodeURIComponent(jobId)}/stage/${encodeURIComponent(s.id)}`}
              className={cn(
                "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
                "text-sidebar-foreground hover:bg-sidebar-accent",
                isActive && "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
                collapsed && "justify-center px-0",
              )}
              title={collapsed ? `${s.name} (${count})` : undefined}
            >
              {!collapsed ? (
                <>
                  <span className="truncate flex-1 text-left">{s.name}</span>
                  <span className="text-[10px] tabular-nums text-muted-foreground shrink-0">
                    ({count})
                  </span>
                </>
              ) : (
                <span className="text-xs font-medium tabular-nums">{count}</span>
              )}
            </Link>
          );

          if (collapsed) {
            return (
              <Tooltip key={s.id}>
                <TooltipTrigger asChild>{item}</TooltipTrigger>
                <TooltipContent side="right" className="text-xs">
                  {s.name} · {count}
                </TooltipContent>
              </Tooltip>
            );
          }

          return item;
        })}

        {!collapsed && <Separator className="my-2" />}

        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href={`/jobs/${encodeURIComponent(jobId)}/info`}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
                  "text-sidebar-foreground hover:bg-sidebar-accent",
                  isJobSetupRoute && "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
                  "justify-center px-0",
                )}
              >
                <Icon name="PenLine" className="h-3.5 w-3.5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              Edit job
            </TooltipContent>
          </Tooltip>
        ) : (
          <Link
            href={`/jobs/${encodeURIComponent(jobId)}/info`}
            className={cn(
              "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
              "text-sidebar-foreground hover:bg-sidebar-accent",
              isJobSetupRoute && "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
            )}
          >
            <Icon name="PenLine" className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Edit job</span>
          </Link>
        )}
      </nav>

      <Separator />

      <div className={cn("p-2 space-y-1", collapsed && "flex flex-col items-center")}>
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "sm"}
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className={cn(
            "text-muted-foreground hover:text-foreground w-full",
            collapsed ? "h-8 w-8" : "justify-start gap-2.5 px-2.5",
          )}
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4 shrink-0" />
          ) : (
            <Moon className="h-4 w-4 shrink-0" />
          )}
          {!collapsed && (
            <span className="text-xs">{theme === "dark" ? "Light mode" : "Dark mode"}</span>
          )}
        </Button>

        {onOpenCommandPalette && (
          <Button
            variant="outline"
            size={collapsed ? "icon" : "sm"}
            onClick={onOpenCommandPalette}
            className={cn(
              "w-full text-muted-foreground text-xs font-normal",
              collapsed ? "h-8 w-8" : "h-8 gap-2 justify-start px-2.5",
            )}
          >
            <Search className="h-3.5 w-3.5 shrink-0" />
            {!collapsed && (
              <>
                <span>{t("search")}</span>
                <kbd className="pointer-events-none inline-flex h-5 select-none items-center rounded border border-border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground ml-auto">
                  ⌘K
                </kbd>
              </>
            )}
          </Button>
        )}
      </div>
    </aside>
  );
}

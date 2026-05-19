"use client";

import { useTranslation } from "react-i18next";
import { LayoutList, Kanban } from "lucide-react";
import { cn } from "@/lib/utils";

export type WorkspaceViewMode = "list" | "kanban";

interface JobWorkspaceViewToggleProps {
  mode: WorkspaceViewMode;
  onChange: (mode: WorkspaceViewMode) => void;
}

export function JobWorkspaceViewToggle({ mode, onChange }: JobWorkspaceViewToggleProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center bg-muted/60 p-0.5 rounded-lg border border-border/80 shadow-sm shrink-0">
      <button
        type="button"
        onClick={() => onChange("list")}
        className={cn(
          "flex items-center justify-center p-1.5 rounded-md transition-all duration-200",
          mode === "list"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
        )}
        aria-label={t("list_view", "List View")}
      >
        <LayoutList className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => onChange("kanban")}
        className={cn(
          "flex items-center justify-center p-1.5 rounded-md transition-all duration-200",
          mode === "kanban"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
        )}
        aria-label={t("kanban_view", "Kanban View")}
      >
        <Kanban className="h-4 w-4" />
      </button>
    </div>
  );
}

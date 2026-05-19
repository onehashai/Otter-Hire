"use client";

import { useTranslation } from "react-i18next";
import { formatTimestamp } from "@/lib/format-date";
import { getInitialsFromName } from "@/lib/name-initials";
import { cn } from "@/lib/utils";
import { type JobWorkspaceCandidateResponse } from "@/api/job/types";
import { useState } from "react";
import { Calendar } from "lucide-react";

interface KanbanCandidateCardProps {
  candidate: JobWorkspaceCandidateResponse;
  selected: boolean;
  onClick: () => void;
  onTouchStart?: (candidateId: string) => void;
  onTouchMove?: (e: React.TouchEvent) => void;
  onTouchEnd?: () => void;
  isTouchDragging?: boolean;
}

export function KanbanCandidateCard({
  candidate,
  selected,
  onClick,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  isTouchDragging = false,
}: KanbanCandidateCardProps) {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);

  const initials = getInitialsFromName(candidate.name);

  const handleDragStart = (e: React.DragEvent) => {
    setIsDragging(true);
    e.dataTransfer.setData("text/plain", candidate.id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={onClick}
      onTouchStart={onTouchStart ? () => onTouchStart(candidate.id) : undefined}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className={cn(
        "group relative select-none rounded-xl border p-3.5 cursor-grab active:cursor-grabbing",
        "bg-card/75 border-border/80 hover:border-primary/40 shadow-sm",
        "transition-all duration-200 ease-out",
        "hover:shadow-md hover:-translate-y-0.5",
        selected && "border-primary bg-primary/[0.02] shadow-md ring-1 ring-primary/30",
        (isDragging || isTouchDragging) &&
          "opacity-45 scale-[0.98] border-dashed border-primary bg-muted/30",
      )}
    >
      {/* Decorative gradient corner */}
      <div className="absolute top-0 right-0 w-8 h-8 bg-primary/5 rounded-tr-xl rounded-bl-2xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="flex gap-3 items-start relative z-10">
        {/* Avatar badge */}
        <div className="h-8 w-8 rounded-lg bg-primary/5 border border-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0 select-none">
          {initials}
        </div>

        {/* Text Details */}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
            {candidate.name}
          </h4>
          <p className="text-[11px] text-muted-foreground truncate font-normal mt-0.5">
            {candidate.email || t("no_email", "No email provided")}
          </p>

          <div className="flex items-center gap-1.5 mt-2.5 text-[10px] text-muted-foreground/80">
            <Calendar className="h-3 w-3 text-muted-foreground/60" />
            <span>{formatTimestamp(candidate.created_at, "en-GB", { showRelative: true })}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

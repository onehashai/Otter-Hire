"use client";

import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { type JobWorkspaceResponse, type JobWorkspaceCandidateResponse } from "@/api/job/types";
import { KanbanCandidateCard } from "./KanbanCandidateCard";
import { KanbanCandidateDrawer } from "./KanbanCandidateDrawer";
import { cn } from "@/lib/utils";
import { Icon } from "@onehash/ui/icon";
import { Button } from "@onehash/ui/button";

interface JobWorkspaceKanbanBoardProps {
  workspace: JobWorkspaceResponse;
  onStageMoved: (candidateId: string, destinationStageId: string) => Promise<void>;
  onCandidateUpdated: () => Promise<void>;
  onAddCandidateClick?: (stageId: string) => void;
}

export function JobWorkspaceKanbanBoard({
  workspace,
  onStageMoved,
  onCandidateUpdated,
  onAddCandidateClick,
}: JobWorkspaceKanbanBoardProps) {
  const { t } = useTranslation();
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [activeDropStageId, setActiveDropStageId] = useState<string | null>(null);
  const [touchDraggingCandidateId, setTouchDraggingCandidateId] = useState<string | null>(null);
  const [touchActiveDropStageId, setTouchActiveDropStageId] = useState<string | null>(null);
  const touchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Touch Drag-and-Drop Event Handlers for Mobile Viewports
  const handleTouchStart = (candidateId: string) => {
    if (touchTimeoutRef.current) clearTimeout(touchTimeoutRef.current);
    touchTimeoutRef.current = setTimeout(() => {
      setTouchDraggingCandidateId(candidateId);
    }, 220); // Premium long press activation delay (220ms)
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchDraggingCandidateId) {
      if (touchTimeoutRef.current) {
        clearTimeout(touchTimeoutRef.current);
        touchTimeoutRef.current = null;
      }
      return;
    }

    // Active drag: prevent default scroll-swipe behavior of the scroll container
    e.preventDefault();

    const touch = e.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    const stageElement = element?.closest("[data-stage-id]");
    const stageId = stageElement?.getAttribute("data-stage-id");
    if (stageId) {
      setTouchActiveDropStageId(stageId);
    } else {
      setTouchActiveDropStageId(null);
    }
  };

  const handleTouchEnd = async () => {
    if (touchTimeoutRef.current) {
      clearTimeout(touchTimeoutRef.current);
      touchTimeoutRef.current = null;
    }

    if (touchDraggingCandidateId && touchActiveDropStageId) {
      const candidate = workspace.candidates.find((c) => c.id === touchDraggingCandidateId);
      if (candidate && candidate.stage_id !== touchActiveDropStageId) {
        await onStageMoved(touchDraggingCandidateId, touchActiveDropStageId);
      }
    }
    setTouchDraggingCandidateId(null);
    setTouchActiveDropStageId(null);
  };

  // Sort stages by their designated position
  const sortedStages = useMemo(() => {
    return [...workspace.stages].sort((a, b) => a.position - b.position);
  }, [workspace.stages]);

  // Group candidates by stage_id
  const candidatesByStage = useMemo(() => {
    const map: Record<string, JobWorkspaceCandidateResponse[]> = {};
    for (const c of workspace.candidates) {
      if (c.stage_id) {
        map[c.stage_id] = map[c.stage_id] || [];
        map[c.stage_id].push(c);
      }
    }
    return map;
  }, [workspace.candidates]);

  // HTML5 Drag and Drop Handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragEnter = (stageId: string) => {
    setActiveDropStageId(stageId);
  };

  const handleDragLeave = (stageId: string) => {
    if (activeDropStageId === stageId) {
      setActiveDropStageId(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, destinationStageId: string) => {
    e.preventDefault();
    setActiveDropStageId(null);

    const candidateId = e.dataTransfer.getData("text/plain");
    if (!candidateId) return;

    // Find the candidate's current stage
    const candidate = workspace.candidates.find((c) => c.id === candidateId);
    if (!candidate || candidate.stage_id === destinationStageId) return;

    // Execute the stage move mutation
    await onStageMoved(candidateId, destinationStageId);
  };

  return (
    <div className="flex flex-col h-full min-h-0 flex-1 bg-background select-none px-4 sm:px-6">
      {/* Board Scroll Container */}
      <div
        className={cn(
          "flex-1 overflow-y-hidden py-4 sm:py-6 flex gap-4 items-start no-scrollbar snap-x snap-mandatory scroll-pl-4 sm:scroll-pl-6",
          touchDraggingCandidateId ? "overflow-x-hidden touch-none" : "overflow-x-auto",
        )}
      >
        {sortedStages.map((stage) => {
          const stageCandidates = candidatesByStage[stage.id] || [];
          const isOver = activeDropStageId === stage.id || touchActiveDropStageId === stage.id;

          return (
            <section
              key={stage.id}
              data-stage-id={stage.id}
              onDragOver={handleDragOver}
              onDragEnter={() => handleDragEnter(stage.id)}
              onDragLeave={() => handleDragLeave(stage.id)}
              onDrop={(e) => void handleDrop(e, stage.id)}
              className={cn(
                "w-[80vw] sm:w-80 shrink-0 flex flex-col rounded-xl h-full max-h-full border snap-start transition-all duration-200",
                "bg-muted/10 border-border/70",
                isOver && "border-primary/50 bg-primary/[0.02] shadow-inner ring-1 ring-primary/20",
              )}
            >
              {/* Column Header */}
              <div className="p-3 border-b border-border/80 flex items-center justify-between shrink-0 select-none">
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className="text-xs font-semibold text-foreground truncate uppercase tracking-wider">
                    {stage.name}
                  </h3>
                  <span className="text-[10px] font-bold text-muted-foreground/80 bg-muted/60 border px-1.5 py-0.5 rounded-full tabular-nums">
                    {stageCandidates.length}
                  </span>
                </div>
                {/* Column Add Candidate Trigger */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground shrink-0"
                  onClick={() => onAddCandidateClick?.(stage.id)}
                  aria-label={t("add_candidate", "Add Candidate")}
                >
                  <Icon name="Plus" className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Cards container */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden p-2.5 space-y-2 min-h-0">
                {stageCandidates.length === 0 ? (
                  <div className="h-32 border-2 border-dashed border-border/40 rounded-xl grid place-items-center text-[10px] text-muted-foreground/60 px-4 text-center">
                    <div className="flex flex-col items-center gap-1.5">
                      <Icon name="Inbox" className="h-4 w-4 opacity-50" />
                      <span>{t("kanban_stage_empty", "Drag candidates here")}</span>
                    </div>
                  </div>
                ) : (
                  stageCandidates.map((c) => (
                    <KanbanCandidateCard
                      key={c.id}
                      candidate={c}
                      selected={selectedCandidateId === c.id}
                      onClick={() => setSelectedCandidateId(c.id)}
                      onTouchStart={handleTouchStart}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={handleTouchEnd}
                      isTouchDragging={touchDraggingCandidateId === c.id}
                    />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>

      {/* Slide-out Candidate details sheet */}
      <KanbanCandidateDrawer
        candidateId={selectedCandidateId}
        jobId={workspace.id}
        onClose={() => setSelectedCandidateId(null)}
        onUpdated={onCandidateUpdated}
        onStageMoved={async (destinationStageId) => {
          if (selectedCandidateId) {
            await onStageMoved(selectedCandidateId, destinationStageId);
          }
        }}
      />
    </div>
  );
}

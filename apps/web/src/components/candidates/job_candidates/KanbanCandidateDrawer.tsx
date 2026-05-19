"use client";

import { Sheet, SheetContent, SheetTitle } from "@onehash/ui/sheet";
import { JobCandidateProfile } from "@/components/candidates/job_candidates/JobCandidateProfile";
import { useTranslation } from "react-i18next";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

interface KanbanCandidateDrawerProps {
  candidateId: string | null;
  jobId: string;
  onClose: () => void;
  onUpdated: () => Promise<void>;
  onStageMoved: (destinationStageId: string) => Promise<void>;
}

export function KanbanCandidateDrawer({
  candidateId,
  jobId,
  onClose,
  onUpdated,
  onStageMoved,
}: KanbanCandidateDrawerProps) {
  const { t } = useTranslation();
  const isOpen = candidateId !== null;

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        side="right"
        className="w-full sm:max-w-4xl md:max-w-5xl lg:max-w-6xl xl:max-w-7xl h-full p-0 flex flex-col bg-background border-l border-border/80 shadow-2xl focus:outline-none sm:[&>button]:hidden"
      >
        {/* Accessibility title for screen-readers */}
        <VisuallyHidden>
          <SheetTitle>{t("candidate_details", "Candidate Details")}</SheetTitle>
        </VisuallyHidden>

        <div className="flex-1 overflow-auto h-full p-6">
          {candidateId && (
            <JobCandidateProfile
              candidateId={candidateId}
              jobRouteJobId={jobId}
              isStageThreePane={true}
              isInsideDrawer={true}
              onCandidateUpdated={onUpdated}
              onStageMoved={async (destinationStageId) => {
                await onStageMoved(destinationStageId);
              }}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

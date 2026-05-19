"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@onehash/ui/sheet";
import { Button } from "@onehash/ui/button";
import { useTranslation } from "react-i18next";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { JobSetupProvider, useJobSetup } from "@/app/(app-page-wrapper)/jobs/[jobId]/context";
import { toast } from "@onehash/ui/sonner";
import { cn } from "@/lib/utils";
import {
  getBasicInfoValidation,
  getHiringDetailsValidation,
} from "@/lib/validations/setupValidation";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@onehash/ui/alert-dialog";

// Import existing high-fidelity pages directly!
import JobInfoPage from "@/app/(app-page-wrapper)/jobs/[jobId]/info/page";
import JobDescriptionPage from "@/app/(app-page-wrapper)/jobs/[jobId]/description/page";
import ApplicationFormPage from "@/app/(app-page-wrapper)/jobs/[jobId]/application/page";
import HiringStagesPage from "@/app/(app-page-wrapper)/jobs/[jobId]/stages/page";
import HiringTeamPage from "@/app/(app-page-wrapper)/jobs/[jobId]/team/page";
import IntegrationPage from "@/app/(app-page-wrapper)/jobs/[jobId]/integration/page";

interface JobEditDrawerProps {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void | Promise<void>;
}

type SetupTab = "info" | "description" | "application" | "stages" | "team" | "integration";

function JobEditForm({
  onClose,
  onSaved,
  open,
}: {
  onClose: () => void;
  onSaved?: () => void | Promise<void>;
  open: boolean;
}) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<SetupTab>("info");
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);

  const {
    title,
    setBasicInfoAttemptedSave,
    workplaceType,
    country,
    city,
    salaryType,
    salaryFixed,
    salaryMin,
    salaryMax,
    setHiringDetailsAttemptedSave,
    handleSave,
    isSaving,
    hasUnsavedChanges,
    handleDiscardChanges,
  } = useJobSetup();

  const tabsList = [
    { id: "info", label: t("job_info", "Info") },
    { id: "description", label: t("job_description", "Description") },
    { id: "application", label: t("application_form", "Application Form") },
    { id: "stages", label: t("hiring_stages", "Hiring Stages") },
    { id: "team", label: t("hiring_team", "Hiring Team") },
    { id: "integration", label: t("integration", "Integration") },
  ] as const;

  const onSave = async () => {
    const validationState = {
      title,
      workplaceType,
      country,
      city,
      salaryType,
      salaryFixed,
      salaryMin,
      salaryMax,
    };
    const basicInfoValidation = getBasicInfoValidation(validationState);
    if (!basicInfoValidation.valid) {
      const tErr = basicInfoValidation.titleError;
      setBasicInfoAttemptedSave(true);
      setActiveTab("info"); // Switch back to info tab to show error
      if (tErr === "min") {
        toast.error(t("min_char_length", { count: 1 }));
      } else if (tErr === "max") {
        toast.error(t("max_char_length", { count: 100 }));
      } else if (tErr === "invalid") {
        toast.error(t("job_name_invalid"));
      } else if (basicInfoValidation.locationError) {
        toast.error(t("location_required_hybrid_onsite"));
      } else {
        toast.error(t("job_name_required"));
      }
      return false;
    }
    setBasicInfoAttemptedSave(false);

    if (salaryType === "fixed" || salaryType === "range") {
      const hiringVal = getHiringDetailsValidation({
        salaryType,
        salaryFixed,
        salaryMin,
        salaryMax,
      });
      if (hiringVal.amountError || hiringVal.minError || hiringVal.maxError) {
        setHiringDetailsAttemptedSave(true);
        setActiveTab("info"); // Switch back to info tab to show error
        toast.error(t("please_fill_required_fields", "Please fill all required fields"));
        return false;
      }
    }
    setHiringDetailsAttemptedSave(false);

    try {
      await handleSave();
      if (onSaved) {
        await onSaved();
      }
      toast.success(t("job_saved_successfully", "Job saved successfully"));
      return true;
    } catch {
      return false;
    }
  };

  const handleCloseAttempt = () => {
    if (hasUnsavedChanges) {
      setShowUnsavedDialog(true);
    } else {
      onClose();
    }
  };

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(v) => {
          if (!v) handleCloseAttempt();
        }}
      >
        <SheetContent
          side="right"
          className="w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl h-full p-6 flex flex-col bg-background border-l border-border/80 shadow-2xl focus:outline-none"
        >
          <VisuallyHidden>
            <SheetTitle>{t("edit_job", "Edit Job")}</SheetTitle>
          </VisuallyHidden>

          <div className="flex flex-col h-full">
            {/* Header section with actions */}
            <div className="flex items-center justify-between border-b border-border/85 pb-4 pr-12">
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  {t("edit_job", "Edit Job")}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {t("update_job_details", "Update job details seamlessly")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs px-3"
                  onClick={handleCloseAttempt}
                  disabled={isSaving}
                >
                  {t("cancel", "Cancel")}
                </Button>
                <Button
                  size="sm"
                  className="h-8 text-xs px-4"
                  onClick={async () => {
                    const ok = await onSave();
                    if (ok) onClose();
                  }}
                  disabled={isSaving}
                  pending={isSaving}
                >
                  {t("save", "Save")}
                </Button>
              </div>
            </div>

            {/* Sleek Premium Custom Tabs Row */}
            <div className="flex border-b border-border/60 overflow-x-auto scrollbar-none gap-2 mb-4 -mx-6 px-6 shrink-0">
              {tabsList.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "px-3 py-2 text-xs font-medium border-b-2 transition-all shrink-0 whitespace-nowrap -mb-[1px]",
                    activeTab === tab.id
                      ? "border-primary text-foreground font-semibold"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-border/80",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Form content scrollable area rendering the active tab */}
            <div className="flex-1 overflow-y-auto py-2 pr-2">
              {activeTab === "info" && <JobInfoPage />}
              {activeTab === "description" && <JobDescriptionPage />}
              {activeTab === "application" && <ApplicationFormPage />}
              {activeTab === "stages" && <HiringStagesPage />}
              {activeTab === "team" && <HiringTeamPage />}
              {activeTab === "integration" && <IntegrationPage />}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {showUnsavedDialog && (
        <style>{`
          [data-radix-portal] > div[class*="bg-black/80"],
          div[class*="bg-black/80"][data-state="open"] {
            background-color: rgba(0, 0, 0, 0.25) !important;
            backdrop-filter: blur(2px) !important;
          }
        `}</style>
      )}

      {/* Premium Unsaved Changes Confirmation Dialog */}
      <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold">
              {t("unsaved_changes", "Unsaved Changes")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              {t(
                "unsaved_changes_warning",
                "You have unsaved changes. Would you like to save them before leaving?",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col-reverse sm:flex-row gap-2">
            <AlertDialogAction
              className="h-9 text-xs flex-1 sm:flex-none bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={() => {
                handleDiscardChanges();
                setShowUnsavedDialog(false);
                onClose();
              }}
            >
              {t("discard", "Discard")}
            </AlertDialogAction>
            <Button
              size="sm"
              className="h-9 text-xs flex-1 sm:flex-none"
              onClick={async () => {
                const ok = await onSave();
                if (ok) {
                  setShowUnsavedDialog(false);
                  onClose();
                }
              }}
              disabled={isSaving}
              pending={isSaving}
            >
              {t("save", "Save")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function JobEditDrawer({ open, onClose, onSaved }: JobEditDrawerProps) {
  return (
    <JobSetupProvider>
      <JobEditForm onClose={onClose} onSaved={onSaved} open={open} />
    </JobSetupProvider>
  );
}

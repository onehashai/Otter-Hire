"use client";

import { usePathname, useRouter, useParams } from "next/navigation";
import { Icon } from "@onehash/ui/icon";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNavigationGuard } from "@/hooks/use-navigation-guard";
import { useAuthSession } from "@/app/providers";
import { Button } from "@onehash/ui/button";
import { Card, CardContent } from "@onehash/ui/card";
import { Badge } from "@onehash/ui/badge";
import { Separator } from "@onehash/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@onehash/ui/sheet";
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
import { toast } from "@onehash/ui/sonner";
import { cn } from "@/lib/utils";
import { getInitialsFromName } from "@/lib/name-initials";
import { JobSetupProvider, useJobSetup } from "./context";
import { aiJobDescription, type JobDescriptionAiAction } from "@/api";
import { Loader2 } from "lucide-react";
import { SETUP_SECTIONS, type SetupStepSlug } from "./constants";
import {
  isSetupValid,
  getFirstInvalidSection,
  getBasicInfoValidation,
} from "../../../../lib/validations/setupValidation";
import { useEffect, useState } from "react";
import { useSetPageMetadata } from "@/hooks/useSetPageMetadata";

function SetupLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams();
  const { user } = useAuthSession();
  const id = params?.jobId as string;
  const orgName = user?.org_name;
  const isMobile = useIsMobile();
  const { t } = useTranslation();

  useSetPageMetadata({
    title: t("edit_job"),
    subtitle: t("edit_job_subtitle"),
  });

  const sections = SETUP_SECTIONS(t);
  const {
    title,
    workplaceType,
    country,
    city,
    status,
    hiringManager,
    hiringStages,
    teamMembers,
    savedAt,
    summaryOpen,
    setSummaryOpen,
    aiSheetOpen,
    setAiSheetOpen,
    published,
    salaryType,
    salaryFixed,
    salaryMin,
    salaryMax,
    hasUnsavedChanges,
    showUnsavedDialog,
    setBasicInfoAttemptedSave,
    setHiringDetailsAttemptedSave,
    handleSave,
    handlePublish,
    handleUnpublish,
    handleDiscardChanges,
    handleSaveAndNavigate,
    handleCancelNavigation,
    showUnsavedWarning,
    isLoading,
    isSaving,
    isPublishing,
  } = useJobSetup();

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Intercept all navigation when there are unsaved changes
  useNavigationGuard(hasUnsavedChanges, showUnsavedWarning);

  // Intercept back button click
  const handleBackClick = () => {
    if (hasUnsavedChanges) {
      showUnsavedWarning("/jobs");
    } else {
      router.push("/jobs");
    }
  };

  const pathParts = pathname.split("/");
  const currentIndex = sections.findIndex((s) => s.slug === pathParts[pathParts.length - 1]);
  const currentStep = currentIndex >= 0 ? currentIndex : 0;
  const currentSlug = sections[currentStep]?.slug ?? "info";
  const basePath = `/jobs/${encodeURIComponent(id)}`;

  const goTo = (slug: SetupStepSlug) => router.push(`${basePath}/${slug}`);

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

  const onSave = () => {
    const basicInfoValidation = getBasicInfoValidation(validationState);
    if (!basicInfoValidation.valid) {
      const titleError = basicInfoValidation.titleError;
      setBasicInfoAttemptedSave(true);
      setHiringDetailsAttemptedSave(false);
      if (titleError === "min") {
        toast.error(t("min_char_length", { count: 1 }));
      } else if (titleError === "max") {
        toast.error(t("max_char_length", { count: 100 }));
      } else if (titleError === "invalid") {
        toast.error(t("job_name_invalid"));
      } else if (basicInfoValidation.locationError) {
        toast.error(t("location_required_hybrid_onsite"));
      } else {
        toast.error(t("job_name_required"));
      }
      goTo("info");
      return;
    }
    setBasicInfoAttemptedSave(false);
    setHiringDetailsAttemptedSave(false);
    handleSave();
  };

  const onPublish = () => {
    if (!isSetupValid(validationState)) {
      const first = getFirstInvalidSection(validationState);
      if (first) {
        setBasicInfoAttemptedSave(first.slug === "info");
        setHiringDetailsAttemptedSave(first.slug === "details");
        toast.error(
          first.messageParams ? t(first.messageKey, first.messageParams) : t(first.messageKey),
        );
        goTo(first.slug);
      }
      return;
    }
    setBasicInfoAttemptedSave(false);
    setHiringDetailsAttemptedSave(false);
    handlePublish();
  };

  const goNext = () => {
    if (currentSlug === "info" && !getBasicInfoValidation(validationState).valid) {
      const first = getFirstInvalidSection(validationState);
      if (first?.slug === "info") {
        setBasicInfoAttemptedSave(true);
        toast.error(
          first.messageParams ? t(first.messageKey, first.messageParams) : t(first.messageKey),
        );
        return;
      }
    }
    setBasicInfoAttemptedSave(false);
    if (currentStep < sections.length - 1) goTo(sections[currentStep + 1].slug);
  };
  const goPrev = () => {
    if (currentStep > 0) goTo(sections[currentStep - 1].slug);
  };

  const SummaryContent = () => (
    <div className="space-y-5">
      <Button
        variant="outline"
        size="sm"
        className="w-full h-8 text-xs gap-1.5"
        onClick={() => {
          if (!orgName || !id) {
            toast.error(t("preview_org_missing", "Organization not found. Cannot open preview."));
            return;
          }
          const orgSlug = `${orgName.toLowerCase().replace(/\s+/g, "-")}-${user?.org_id}`;
          const previewUrl = `${window.location.protocol}//${process.env.NEXT_PUBLIC_JOBS_SUBDOMAIN || "jobs"}.${process.env.NEXT_PUBLIC_APP_ROOT_HOST || "localhost:3000"}/${orgSlug}/${id}`;
          window.open(previewUrl, "_blank", "noopener,noreferrer");
        }}
      >
        <Icon name="Eye" className="h-3.5 w-3.5" /> {t("preview")}
      </Button>
      <Separator />
      <div>
        <p className="text-xs text-muted-foreground mb-1">Status</p>
        <Badge variant={status === "open" ? "default" : "secondary"} className="capitalize text-xs">
          {status}
        </Badge>
      </div>
      <Separator />
      <div>
        <p className="text-xs text-muted-foreground mb-1.5">Stages</p>
        <div className="flex flex-wrap gap-1">
          {hiringStages
            .filter((s) => s.name)
            .map((s) => (
              <Badge key={s.id} variant="secondary" className="text-[10px] font-normal">
                {s.name}
              </Badge>
            ))}
        </div>
      </div>
      <Separator />
      <div>
        <p className="text-xs text-muted-foreground mb-1.5">Hiring Team</p>
        <div className="space-y-1.5">
          {teamMembers.map((m) => (
            <div key={m.id} className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground shrink-0">
                {getInitialsFromName(m.name)}
              </div>
              <span className="text-xs">{m.name}</span>
            </div>
          ))}
          {teamMembers.length === 0 && !hiringManager && (
            <p className="text-xs text-muted-foreground/70">No members yet</p>
          )}
        </div>
      </div>
      <Separator />
      {isSaving ? (
        <div className="flex items-center justify-center py-0.5" aria-busy={true}>
          <Icon
            name="Loader"
            className="h-3.5 w-3.5 animate-spin text-muted-foreground"
            aria-hidden
          />
        </div>
      ) : savedAt ? (
        <p className="text-[10px] text-muted-foreground text-center">Saved at {savedAt}</p>
      ) : null}
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="flex flex-col min-h-[calc(100vh-8rem)]">
        <div className="flex items-center gap-2 mb-4">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={handleBackClick}
          >
            <Icon name="ChevronLeft" className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold truncate">{title || t("create_job")}</h1>
            <p className="text-[10px] text-muted-foreground">
              Step {currentStep + 1} of {sections.length} · {sections[currentStep].label}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-8"
            onClick={() => setSummaryOpen(true)}
          >
            {t("summary")}
          </Button>
        </div>
        <div className="flex gap-1 mb-5">
          {sections.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                i <= currentStep ? "bg-foreground" : "bg-border",
              )}
            />
          ))}
        </div>
        <div className="flex-1 pb-4 overflow-auto">{children}</div>
        <div className="sticky bottom-16 bg-background py-3 flex gap-2 -mx-4 px-4">
          {currentStep > 0 && (
            <Button variant="outline" size="sm" className="h-11 text-sm flex-1" onClick={goPrev}>
              {t("back")}
            </Button>
          )}
          {currentStep < sections.length - 1 ? (
            <Button size="sm" className="h-11 text-sm flex-1" onClick={goNext}>
              {t("next")}
            </Button>
          ) : (
            <Button
              size="sm"
              className="h-11 text-sm flex-1"
              onClick={published ? onSave : onPublish}
              disabled={isSaving || isPublishing}
              pending={published ? isSaving : isPublishing}
            >
              {published ? "Save Changes" : "Publish Job"}
            </Button>
          )}
        </div>
        <Sheet open={summaryOpen} onOpenChange={setSummaryOpen}>
          <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl">
            <SheetHeader>
              <SheetTitle className="text-base">Job Summary</SheetTitle>
              <SheetDescription className="text-xs">
                Review details before publishing.
              </SheetDescription>
            </SheetHeader>
            <div className="mt-4">
              <SummaryContent />
            </div>
          </SheetContent>
        </Sheet>
        <AiSheet open={aiSheetOpen} onOpenChange={setAiSheetOpen} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleBackClick}>
          <Icon name="ChevronLeft" className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold">{title || "Create Job"}</h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={onSave}
          disabled={isSaving || isPublishing}
          pending={isSaving}
        >
          {t("save")}
        </Button>
        {published ? (
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={handleUnpublish}
            disabled={isSaving || isPublishing}
            pending={isPublishing}
          >
            {t("unpublish")}
          </Button>
        ) : (
          <Button
            size="sm"
            className="h-8 text-xs"
            onClick={onPublish}
            disabled={isSaving || isPublishing}
            pending={isPublishing}
          >
            {t("publish")}
          </Button>
        )}
      </div>
      <div className="flex gap-1 mb-6 overflow-x-auto no-scrollbar border-b border-border pb-2">
        {sections.map((s, i) => (
          <Link
            key={s.slug}
            href={`${basePath}/${s.slug}`}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors",
              "hover:bg-muted text-muted-foreground",
              currentSlug === s.slug && "bg-muted text-foreground",
            )}
          >
            {s.label}
          </Link>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-6">
        <Card>
          <CardContent className="p-5 md:p-6">
            <h2 className="text-sm font-semibold mb-4">{sections[currentStep].label}</h2>
            {children}
          </CardContent>
        </Card>
        <div className="hidden lg:block">
          <div className="sticky top-20">
            <Card>
              <CardContent className="p-5">
                <h3 className="text-sm font-semibold mb-4">Summary</h3>
                <SummaryContent />
              </CardContent>
            </Card>
          </div>
        </div>
        <div className="lg:hidden fixed bottom-4 right-4 z-30">
          <Button
            size="sm"
            variant="outline"
            className="h-10 rounded-full shadow-md text-xs gap-1.5 bg-background"
            onClick={() => setSummaryOpen(true)}
          >
            <Icon name="Eye" className="h-3.5 w-3.5" /> Summary
          </Button>
        </div>
        <Sheet open={summaryOpen} onOpenChange={setSummaryOpen}>
          <SheetContent side="bottom" className="h-[60vh] rounded-t-2xl lg:hidden">
            <SheetHeader>
              <SheetTitle className="text-base">Job Summary</SheetTitle>
              <SheetDescription className="text-xs">
                Review details before publishing.
              </SheetDescription>
            </SheetHeader>
            <div className="mt-4">
              <SummaryContent />
            </div>
          </SheetContent>
        </Sheet>
        <AiSheet open={aiSheetOpen} onOpenChange={setAiSheetOpen} />
      </div>
      <AlertDialog open={showUnsavedDialog} onOpenChange={handleCancelNavigation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Do you want to save them before leaving?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDiscardChanges}>Discard</AlertDialogCancel>
            <AlertDialogAction onClick={handleSaveAndNavigate}>Save Changes</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const AI_ACTIONS: {
  label: string;
  desc: string;
  action: JobDescriptionAiAction;
}[] = [
  {
    label: "Generate full description",
    desc: "Create a complete JD from the job title and details",
    action: "generate_full",
  },
  {
    label: "Improve tone",
    desc: "Make the language more professional and inclusive",
    action: "improve_tone",
  },
  {
    label: "Shorten",
    desc: "Condense the description while keeping key points",
    action: "shorten",
  },
  {
    label: "Expand",
    desc: "Add more detail to responsibilities and requirements",
    action: "expand",
  },
  {
    label: "Add responsibilities section",
    desc: "Generate a structured list of responsibilities",
    action: "add_responsibilities",
  },
  {
    label: "Add requirements section",
    desc: "Generate a structured list of requirements",
    action: "add_requirements",
  },
];

function AiSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const isMobile = useIsMobile();
  const params = useParams();
  const jobId = params?.jobId as string | undefined;
  const { description, setDescription } = useJobSetup();
  const [loadingAction, setLoadingAction] = useState<JobDescriptionAiAction | null>(null);

  const runAction = async (action: JobDescriptionAiAction) => {
    if (!jobId) {
      toast.error("Save the job first, then try again.");
      return;
    }
    setLoadingAction(action);
    try {
      const { html } = await aiJobDescription(jobId, {
        action,
        current_html: description,
      });
      setDescription(html);
      toast.success("Description updated");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI request failed");
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={isMobile ? "h-[85vh] rounded-t-2xl" : ""}
      >
        <SheetHeader>
          <SheetTitle className="text-base">AI Writing Assistant</SheetTitle>
          <SheetDescription className="text-xs">
            Generate or improve your job description with AI.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-3">
          {AI_ACTIONS.map((item) => {
            const busy = loadingAction !== null;
            const isThis = loadingAction === item.action;
            return (
              <button
                key={item.action}
                type="button"
                disabled={busy}
                onClick={() => void runAction(item.action)}
                className={cn(
                  "w-full flex items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors",
                  busy && !isThis && "opacity-50 pointer-events-none",
                  !busy && "hover:bg-muted/50",
                )}
              >
                {isThis ? (
                  <Loader2 className="h-4 w-4 text-muted-foreground shrink-0 animate-spin" />
                ) : (
                  <Icon name="Sparkles" className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function JobBranchLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useParams();
  const jobId = params?.jobId as string | undefined;
  const segments = pathname.split("/").filter(Boolean);
  const isJobWorkspaceRoot =
    Boolean(jobId) &&
    segments[0] === "jobs" &&
    segments[1] === jobId &&
    (segments.length === 2 ||
      (segments.length === 4 && segments[2] === "stage" && Boolean(segments[3])) ||
      (segments.length === 6 &&
        segments[2] === "stage" &&
        Boolean(segments[3]) &&
        segments[4] === "candidates" &&
        Boolean(segments[5])) ||
      (segments.length === 4 && segments[2] === "candidates" && Boolean(segments[3])));

  if (isJobWorkspaceRoot) {
    return <>{children}</>;
  }

  return (
    <JobSetupProvider>
      <SetupLayoutInner>{children}</SetupLayoutInner>
    </JobSetupProvider>
  );
}

export default JobBranchLayout;

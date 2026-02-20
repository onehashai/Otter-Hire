"use client";

import { usePathname, useRouter, useParams } from "next/navigation";
import { Icon } from "@onehash/ui/icon";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuthSession } from "@/app/providers";
import { Button } from "@onehash/ui/button";
import { Card, CardContent } from "@onehash/ui/card";
import { Badge } from "@onehash/ui/badge";
import { Separator } from "@onehash/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@onehash/ui/sheet";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { JobSetupProvider, useJobSetup } from "./context";
import { SETUP_SECTIONS, teamRoleLabels, type SetupStepSlug } from "./constants";
import { isSetupValid, getFirstInvalidSection, getBasicInfoValidation } from "../../../../lib/validations/setupValidation";

function SetupLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams();
  const { user } = useAuthSession();
  const id = params?.jobId as string;
  const orgName = user?.org_name;
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const sections = SETUP_SECTIONS(t);
  const {
    title,
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
    setBasicInfoAttemptedSave,
    setHiringDetailsAttemptedSave,
    handleSave,
    handlePublish,
    handleUnpublish,
  } = useJobSetup();

  const pathParts = pathname.split("/");
  const currentIndex = sections.findIndex((s) => s.slug === pathParts[pathParts.length - 1]);
  const currentStep = currentIndex >= 0 ? currentIndex : 0;
  const currentSlug = sections[currentStep]?.slug ?? "info";
  const basePath = `/jobs/${encodeURIComponent(id)}`;

  const goTo = (slug: SetupStepSlug) => router.push(`${basePath}/${slug}`);

  const validationState = {
    title,
    salaryType,
    salaryFixed,
    salaryMin,
    salaryMax,
  };

  const onSave = () => {
    if (!isSetupValid(validationState)) {
      const first = getFirstInvalidSection(validationState);
      if (first) {
        setBasicInfoAttemptedSave(first.slug === "info");
        setHiringDetailsAttemptedSave(first.slug === "details");
        toast.error(first.messageParams ? t(first.messageKey, first.messageParams) : t(first.messageKey));
        goTo(first.slug);
      }
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
        toast.error(first.messageParams ? t(first.messageKey, first.messageParams) : t(first.messageKey));
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
        toast.error(first.messageParams ? t(first.messageKey, first.messageParams) : t(first.messageKey));
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
          if (!orgName) {
            toast.error(t("preview_org_missing", "Organization not found. Cannot open preview."));
            return;
          }
          router.push(`/${encodeURIComponent(orgName)}/${encodeURIComponent(id)}`);
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
        <p className="text-xs text-muted-foreground mb-1.5">Pipeline</p>
        <div className="flex flex-wrap gap-1">
          {hiringStages.filter((s) => s.name).map((s) => (
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
                {m.name.split(" ").map((n) => n[0]).join("")}
              </div>
              <span className="text-xs">{m.name}</span>
              <span className="text-[10px] text-muted-foreground">
                · {teamRoleLabels[m.role]}
              </span>
            </div>
          ))}
          {teamMembers.length === 0 && !hiringManager && (
            <p className="text-xs text-muted-foreground/70">No members yet</p>
          )}
        </div>
      </div>
      <Separator />
      {savedAt && (
        <p className="text-[10px] text-muted-foreground text-center">Saved at {savedAt}</p>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <div className="flex flex-col min-h-[calc(100vh-8rem)]">
        <div className="flex items-center gap-2 mb-4">
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => router.push("/jobs")}>
            <Icon name="ChevronLeft" className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold truncate">{title || t("create_job")}</h1>
            <p className="text-[10px] text-muted-foreground">
              Step {currentStep + 1} of {sections.length} · {sections[currentStep].label}
            </p>
          </div>
          <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => setSummaryOpen(true)}>
            {t("summary")}
          </Button>
        </div>
        <div className="flex gap-1 mb-5">
          {sections.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                i <= currentStep ? "bg-foreground" : "bg-border"
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
            >
              {published ? t("save") : t("publish")}
            </Button>
          )}
        </div>
        <Sheet open={summaryOpen} onOpenChange={setSummaryOpen}>
          <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl">
            <SheetHeader>
              <SheetTitle className="text-base">Job Summary</SheetTitle>
              <SheetDescription className="text-xs">Review details before publishing.</SheetDescription>
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
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => router.push("/jobs")}>
          <Icon name="ChevronLeft" className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold">{title || "Create Job"}</h1>
        </div>
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onSave}>
          {t("save")}
        </Button>
        {published ? (
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleUnpublish}>
            {t("unpublish")}
          </Button>
        ) : (
          <Button size="sm" className="h-8 text-xs" onClick={onPublish}>
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
              currentSlug === s.slug && "bg-muted text-foreground"
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
              <SheetDescription className="text-xs">Review details before publishing.</SheetDescription>
            </SheetHeader>
            <div className="mt-4">
              <SummaryContent />
            </div>
          </SheetContent>
        </Sheet>
        <AiSheet open={aiSheetOpen} onOpenChange={setAiSheetOpen} />
      </div>
    </div>
  );
}

function AiSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const isMobile = useIsMobile();
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
          {[
            { label: "Generate full description", desc: "Create a complete JD from the job title and details" },
            { label: "Improve tone", desc: "Make the language more professional and inclusive" },
            { label: "Shorten", desc: "Condense the description while keeping key points" },
            { label: "Expand", desc: "Add more detail to responsibilities and requirements" },
            { label: "Add responsibilities section", desc: "Generate a structured list of responsibilities" },
            { label: "Add requirements section", desc: "Generate a structured list of requirements" },
          ].map((action) => (
            <button
              key={action.label}
              onClick={() => {
                toast.success(`AI: "${action.label}" — coming soon`);
                onOpenChange(false);
              }}
              className="w-full flex items-center gap-3 rounded-lg border border-border p-3 text-left hover:bg-muted/50 transition-colors"
            >
              <Icon name="Sparkles" className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm font-medium">{action.label}</p>
                <p className="text-xs text-muted-foreground">{action.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function SetupLayout({ children }: { children: React.ReactNode }) {
  return (
    <JobSetupProvider>
      <SetupLayoutInner>{children}</SetupLayoutInner>
    </JobSetupProvider>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent } from "@onehash/ui/card";
import { Button } from "@onehash/ui/button";
import { Badge } from "@onehash/ui/badge";
import { Separator } from "@onehash/ui/separator";
import { ArrowLeft, Save, Zap, ChevronDown, ChevronUp, Play, FileText } from "lucide-react";
import { toast } from "@onehash/ui/sonner";
import { useSetPageMetadata } from "@/hooks/useSetPageMetadata";
import { useTranslation } from "react-i18next";
import {
  BasicInfoStep,
  TriggerStep,
  ActionsStep,
  SummaryStrip,
  EmailPreview,
  triggerOptions,
  actionTypes,
  type Scope,
  type Action,
} from "@/components/automations/builder";
import { createAutomation, getAutomationById, updateAutomation } from "@/api/automations";
import { useMoveToStageAvailability } from "@/hooks/useMoveToStageAvailability";
import { generateId } from "@/lib/utils";

export default function AutomationEditPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useTranslation();
  const automationId = (params?.automationId as string) ?? "";
  const isEdit = Boolean(automationId);

  useSetPageMetadata({
    title: t("edit_automation_title"),
    subtitle: t("edit_automation_subtitle"),
  });

  const [name, setName] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [selectedJob, setSelectedJob] = useState("");

  const [selectedTrigger, setSelectedTrigger] = useState<string>("");
  const [triggerStage, setTriggerStage] = useState("");

  const [actions, setActions] = useState<Action[]>([]);

  const [emailPreviewOpen, setEmailPreviewOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  const currentTrigger = triggerOptions.find((tr) => tr.id === selectedTrigger);
  const { disabled: moveToStageDisabled, reason: moveToStageDisabledReason } =
    useMoveToStageAvailability(scope, selectedJob);

  useEffect(() => {
    if (!isEdit || !automationId) return;
    let cancelled = false;
    (async () => {
      try {
        const detail = await getAutomationById(automationId);
        if (cancelled) return;

        setName(detail.name);
        setScope(detail.scope === "specific_job" ? "specific_job" : "all");
        setSelectedJob(detail.job_id ?? "");
        setSelectedTrigger(detail.trigger_key);
        setTriggerStage(
          typeof detail.trigger_config?.stage === "string" ? detail.trigger_config.stage : "",
        );
        setActions(
          detail.actions.map((a) => ({
            id: generateId(),
            type: a.type,
            label: a.config.label ?? actionTypes.find((def) => def.id === a.type)?.label ?? a.type,
            config: a.config,
          })),
        );
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          toast.error("Failed to load automation");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [automationId, isEdit]);

  const addAction = (type: string) => {
    const actionDef = actionTypes.find((a) => a.id === type);
    if (!actionDef) return;
    setActions((prev) => [
      ...prev,
      {
        id: generateId(),
        type,
        label: actionDef.label,
        config: {},
      },
    ]);
  };

  const updateActionConfig = (id: string, key: string, value: string) => {
    setActions((prev) =>
      prev.map((a) => (a.id === id ? { ...a, config: { ...a.config, [key]: value } } : a)),
    );
  };

  const removeAction = (id: string) => {
    setActions((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSave = async (asDraft = false) => {
    if (!name.trim()) {
      toast.error("Please enter an automation name");
      return;
    }
    if (!selectedTrigger) {
      toast.error("Please select a trigger");
      return;
    }
    if (actions.length === 0) {
      toast.error("Please add at least one action");
      return;
    }
    if (scope === "specific_job" && !selectedJob?.trim()) {
      toast.error("Please select a job when scope is Specific job");
      return;
    }
    if (moveToStageDisabled && actions.some((a) => a.type === "move_stage")) {
      toast.error(
        "Remove the Move to stage action or switch to a specific job. Jobs have different hiring stages.",
      );
      return;
    }

    const triggerConfig: Record<string, unknown> = {};
    if (triggerStage) triggerConfig.stage = triggerStage;
    const payload = {
      name: name.trim(),
      status: asDraft ? "draft" : "active",
      scope,
      job_id: scope === "specific_job" && selectedJob ? selectedJob : null,
      trigger_type: currentTrigger?.category ?? "candidate",
      trigger_key: selectedTrigger,
      trigger_config: { ...triggerConfig, label: currentTrigger?.label },
      condition_logic: "and",
      conditions: [],
      actions: actions.map((a) => ({
        type: a.type,
        config: a.config,
      })),
      description: null,
    };

    try {
      const result = isEdit
        ? await updateAutomation(automationId, payload)
        : await createAutomation(payload);
      toast.success(asDraft ? "Draft saved" : "Automation saved");
      router.push(`/automations/${result.id}`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to save automation");
    }
  };

  const StepHeader = ({
    step,
    title,
    subtitle,
    icon: Icon,
    isOpen,
    onToggle,
  }: {
    step: number;
    title: string;
    subtitle: string;
    icon: React.ElementType;
    isOpen: boolean;
    onToggle: () => void;
  }) => (
    <button
      type="button"
      className="flex items-center gap-3 w-full text-left p-4 hover:bg-muted/50 transition-colors"
      onClick={onToggle}
    >
      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-[10px] text-muted-foreground">Step {step}</span>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      {isOpen ? (
        <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
      ) : (
        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
      )}
    </button>
  );

  const steps = [
    { title: "Basic Info", subtitle: "Name and scope", icon: FileText },
    { title: "Trigger", subtitle: "When this happens", icon: Zap },
    { title: "Actions", subtitle: "Then do this", icon: Play },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 shrink-0"
            onClick={() => router.push("/automations")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-base font-semibold truncate">
              {isEdit ? "Edit Automation" : "Create Automation"}
            </h1>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          className="h-8 text-xs gap-1.5"
          onClick={() => handleSave(false)}
        >
          <Save className="h-3.5 w-3.5" /> {t("save")}
        </Button>
      </div>

      <Separator />

      {/* Steps */}
      <div className="space-y-2">
        {steps.map((step, idx) => (
          <Card key={idx} className="overflow-hidden">
            <StepHeader
              step={idx + 1}
              title={step.title}
              subtitle={step.subtitle}
              icon={step.icon}
              isOpen={activeStep === idx}
              onToggle={() => setActiveStep(activeStep === idx ? -1 : idx)}
            />
            {activeStep === idx && (
              <>
                <Separator />
                {idx === 0 && (
                  <BasicInfoStep
                    name={name}
                    scope={scope}
                    selectedJob={selectedJob}
                    onNameChange={setName}
                    onScopeChange={setScope}
                    onSelectedJobChange={setSelectedJob}
                  />
                )}
                {idx === 1 && (
                  <TriggerStep
                    selectedTrigger={selectedTrigger}
                    triggerStage={triggerStage}
                    currentTrigger={currentTrigger}
                    onSelectedTriggerChange={setSelectedTrigger}
                    onTriggerStageChange={setTriggerStage}
                  />
                )}
                {idx === 2 && (
                  <ActionsStep
                    actions={actions}
                    onAddAction={addAction}
                    onUpdateActionConfig={updateActionConfig}
                    onRemoveAction={removeAction}
                    onEmailPreviewOpen={() => setEmailPreviewOpen(true)}
                    moveToStageDisabled={moveToStageDisabled}
                    moveToStageDisabledReason={moveToStageDisabledReason ?? undefined}
                  />
                )}
              </>
            )}
          </Card>
        ))}
      </div>

      <SummaryStrip currentTrigger={currentTrigger} triggerStage={triggerStage} actions={actions} />

      <EmailPreview open={emailPreviewOpen} onOpenChange={setEmailPreviewOpen} />
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@onehash/ui/card";
import { Button } from "@onehash/ui/button";
import { Separator } from "@onehash/ui/separator";
import { AlertCircle, ChevronDown, ChevronUp, FileText, Play, Zap } from "lucide-react";
import { toast } from "@onehash/ui/sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@onehash/ui/dialog";
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
import { createAutomation } from "@/api/automations";
import { ApiError } from "@/api/client/client";
import { useMoveToStageAvailability } from "@/hooks/useMoveToStageAvailability";
import { generateId } from "@/lib/utils";
export interface CreateAutomationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
  initialTemplate?: {
    name: string;
    triggerKey: string;
    triggerConfig?: Record<string, unknown>;
    templateId?: string;
  };
}

export function CreateAutomationDialog({
  open,
  onOpenChange,
  onCreated,
  initialTemplate,
}: CreateAutomationDialogProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [selectedJob, setSelectedJob] = useState("");

  const [selectedTrigger, setSelectedTrigger] = useState("");
  const [triggerStage, setTriggerStage] = useState("");

  const [actions, setActions] = useState<Action[]>([]);

  const [emailPreviewOpen, setEmailPreviewOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const currentTrigger = triggerOptions.find((tr) => tr.id === selectedTrigger);
  const { disabled: moveToStageDisabled, reason: moveToStageDisabledReason } =
    useMoveToStageAvailability(scope, selectedJob);

  useEffect(() => {
    if (open) {
      setName(initialTemplate?.name ?? "");
      setSelectedTrigger(initialTemplate?.triggerKey ?? "");
      setTriggerStage((initialTemplate?.triggerConfig?.stage as string) ?? "");
      setActions(
        initialTemplate?.templateId
          ? [
              {
                id: generateId(),
                type: "send_email",
                label: "Send email",
                config: { template: initialTemplate.templateId },
              },
            ]
          : [],
      );
      setValidationError(null);
    }
  }, [open, initialTemplate]);

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

  const handleCreate = async (asDraft = false) => {
    setValidationError(null);

    if (!name.trim()) {
      const msg = "Please enter an automation name";
      setValidationError(msg);
      setActiveStep(0);
      toast.error(msg);
      return;
    }
    if (!selectedTrigger) {
      const msg = "Please select a trigger";
      setValidationError(msg);
      setActiveStep(1);
      toast.error(msg);
      return;
    }
    if (actions.length === 0) {
      const msg = "Please add at least one action";
      setValidationError(msg);
      setActiveStep(2);
      toast.error(msg);
      return;
    }
    if (scope === "specific_job" && !selectedJob?.trim()) {
      const msg = "Please select a job when scope is Specific job";
      setValidationError(msg);
      setActiveStep(0);
      toast.error(msg);
      return;
    }
    if (moveToStageDisabled && actions.some((a) => a.type === "move_stage")) {
      const msg =
        "Remove the Move to stage action or switch to a specific job. Jobs have different hiring stages.";
      setValidationError(msg);
      setActiveStep(2);
      toast.error(msg);
      return;
    }

    const triggerConfig: Record<string, unknown> = {
      ...(initialTemplate?.triggerConfig ?? {}),
    };
    if (triggerStage) triggerConfig.stage = triggerStage;
    triggerConfig.label = currentTrigger?.label;

    const payload = {
      name: name.trim(),
      status: asDraft ? "draft" : "active",
      scope,
      job_id: selectedJob?.trim() || null,
      trigger_type: currentTrigger?.category ?? "candidate",
      trigger_key: selectedTrigger,
      trigger_config: triggerConfig,
      condition_logic: "and",
      conditions: [],
      actions: actions.map((a) => ({
        type: a.type,
        config: a.config,
      })),
      description: null,
    };

    setSaving(true);
    try {
      const result = await createAutomation(payload);
      toast.success(asDraft ? "Draft saved" : "Automation created");
      onOpenChange(false);
      onCreated?.();
      if (result?.id) {
        router.push(`/automations/${result.id}`);
      }
    } catch (err) {
      console.error(err);
      let message = "Failed to create automation";
      if (err instanceof ApiError) {
        message = err.message;
        // Surface validation details when available (e.g. Pydantic errors)
        const details = err.details;
        if (Array.isArray(details) && details.length > 0) {
          const first = details[0] as { msg?: string; loc?: unknown[] };
          if (typeof first?.msg === "string" && first.msg.trim()) {
            message = first.msg;
          }
        }
      } else if (err instanceof Error) {
        message = err.message;
      }
      setValidationError(message);
      toast.error(message);
    } finally {
      setSaving(false);
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
      className="flex items-center gap-3 w-full text-left p-3 hover:bg-muted/50 transition-colors"
      onClick={onToggle}
    >
      <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle className="text-base">Create Automation</DialogTitle>
          <DialogDescription className="text-xs">
            Set up a rule to automate tasks in your hiring workflow.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 px-6 overflow-y-auto flex-1 min-h-0">
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

        <SummaryStrip
          currentTrigger={currentTrigger}
          triggerStage={triggerStage}
          actions={actions}
        />

        {validationError && (
          <div
            className="mx-6 mb-0 flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        <DialogFooter className="px-6 py-4 border-t shrink-0">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => handleCreate(false)} disabled={saving} pending={saving}>
            Create
          </Button>
        </DialogFooter>

        <EmailPreview open={emailPreviewOpen} onOpenChange={setEmailPreviewOpen} />
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent } from "@onehash/ui/card";
import { Button } from "@onehash/ui/button";
import { Badge } from "@onehash/ui/badge";
import { Separator } from "@onehash/ui/separator";
import { ArrowLeft, Save, Zap, ChevronDown, ChevronUp, Play, Tag, FileText } from "lucide-react";
import { toast } from "sonner";
import { useSetPageMetadata } from "@/hooks/useSetPageMetadata";
import { useTranslation } from "react-i18next";
import {
  BasicInfoStep,
  TriggerStep,
  ConditionsStep,
  ActionsStep,
  SummaryStrip,
  EmailPreview,
  triggerOptions,
  actionTypes,
  type Scope,
  type Condition,
  type Action,
} from "@/components/automations/builder";

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

  const [name, setName] = useState(isEdit ? "Auto-reject unqualified" : "");
  const [scope, setScope] = useState<Scope>("all");
  const [selectedJob, setSelectedJob] = useState("");

  const [selectedTrigger, setSelectedTrigger] = useState<string>(isEdit ? "candidate_applied" : "");
  const [triggerStage, setTriggerStage] = useState("");
  const [triggerDays, setTriggerDays] = useState("5");

  const [conditionLogic, setConditionLogic] = useState<"and" | "or">("and");
  const [conditions, setConditions] = useState<Condition[]>([]);

  const [actions, setActions] = useState<Action[]>(
    isEdit
      ? [
          {
            id: "1",
            type: "send_email",
            label: "Send email",
            config: { template: "rejection" },
          },
        ]
      : [],
  );

  const [emailPreviewOpen, setEmailPreviewOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  const currentTrigger = triggerOptions.find((tr) => tr.id === selectedTrigger);

  const addCondition = () => {
    setConditions((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        field: "rating",
        operator: "greater_than",
        value: "",
      },
    ]);
  };

  const updateCondition = (id: string, field: string, value: string) => {
    setConditions((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  };

  const removeCondition = (id: string) => {
    setConditions((prev) => prev.filter((c) => c.id !== id));
  };

  const addAction = (type: string) => {
    const actionDef = actionTypes.find((a) => a.id === type);
    if (!actionDef) return;
    setActions((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
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

  const handleSave = (asDraft = false) => {
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
    toast.success(asDraft ? "Draft saved" : "Automation saved");
    router.push("/automations");
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
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">Step {step}</span>
          {step === 3 && (
            <Badge variant="outline" className="text-[9px]">
              Optional
            </Badge>
          )}
        </div>
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
    { title: "Conditions", subtitle: "Only if (optional)", icon: Tag },
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
                    triggerDays={triggerDays}
                    currentTrigger={currentTrigger}
                    onSelectedTriggerChange={setSelectedTrigger}
                    onTriggerStageChange={setTriggerStage}
                    onTriggerDaysChange={setTriggerDays}
                  />
                )}
                {idx === 2 && (
                  <ConditionsStep
                    conditions={conditions}
                    conditionLogic={conditionLogic}
                    onConditionLogicChange={setConditionLogic}
                    onAddCondition={addCondition}
                    onUpdateCondition={updateCondition}
                    onRemoveCondition={removeCondition}
                  />
                )}
                {idx === 3 && (
                  <ActionsStep
                    actions={actions}
                    onAddAction={addAction}
                    onUpdateActionConfig={updateActionConfig}
                    onRemoveAction={removeAction}
                    onEmailPreviewOpen={() => setEmailPreviewOpen(true)}
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
        triggerDays={triggerDays}
        conditionsCount={conditions.length}
        actions={actions}
      />

      <EmailPreview open={emailPreviewOpen} onOpenChange={setEmailPreviewOpen} />
    </div>
  );
}

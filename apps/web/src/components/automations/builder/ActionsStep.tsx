"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@onehash/ui/card";
import { Button } from "@onehash/ui/button";
import { InputField } from "@onehash/ui/input";
import { Label } from "@onehash/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@onehash/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@onehash/ui/tooltip";
import { X, Zap, Eye } from "lucide-react";
import { FieldRow } from "./FieldRow";
import { actionTypes, stages, type Action } from "./types";
import { getTemplates, type TemplateResponse } from "@/api/templates";

export interface ActionsStepProps {
  actions: Action[];
  onAddAction: (type: string) => void;
  onUpdateActionConfig: (id: string, key: string, value: string) => void;
  onRemoveAction: (id: string) => void;
  onEmailPreviewOpen: () => void;
  /** When true, the "Move to stage" action is disabled (e.g. multiple jobs with different stages) */
  moveToStageDisabled?: boolean;
  moveToStageDisabledReason?: string;
}

export function ActionsStep({
  actions,
  onAddAction,
  onUpdateActionConfig,
  onRemoveAction,
  onEmailPreviewOpen,
  moveToStageDisabled = false,
  moveToStageDisabledReason,
}: ActionsStepProps) {
  const [templates, setTemplates] = useState<TemplateResponse[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setTemplatesLoading(true);
        const data = await getTemplates();
        if (!cancelled) {
          // Prefer email-type templates if categories are used
          const emailTemplates = data.filter(
            (t) => !t.category || t.category.toLowerCase() === "email",
          );
          setTemplates(emailTemplates.length ? emailTemplates : data);
        }
      } catch {
        // Keep builder usable even if templates API fails.
      } finally {
        if (!cancelled) {
          setTemplatesLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="p-4 space-y-4">
      <p className="text-xs text-muted-foreground">
        Define what happens when this automation fires.
      </p>

      {actions.map((a, idx) => {
        const def = actionTypes.find((at) => at.id === a.type);
        const Icon = def?.icon ?? Zap;
        return (
          <Card key={a.id}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded bg-muted flex items-center justify-center">
                    <Icon className="h-3 w-3 text-muted-foreground" />
                  </div>
                  <span className="text-xs font-medium">
                    Action {idx + 1}: {a.label}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => onRemoveAction(a.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>

              {a.type === "send_email" && (
                <div className="space-y-3">
                  <FieldRow label="Email Template">
                    <div className="flex gap-2">
                      <Select
                        value={a.config.template ?? ""}
                        onValueChange={(v) => onUpdateActionConfig(a.id, "template", v)}
                      >
                        <SelectTrigger className="h-8 text-xs flex-1">
                          <SelectValue placeholder="Select template" />
                        </SelectTrigger>
                        <SelectContent>
                          {templatesLoading && templates.length === 0 && (
                            <SelectItem value="__loading" disabled className="text-xs">
                              Loading templates...
                            </SelectItem>
                          )}
                          {templates.map((tmpl) => (
                            <SelectItem key={tmpl.id} value={tmpl.id} className="text-xs">
                              {tmpl.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1"
                        onClick={onEmailPreviewOpen}
                      >
                        <Eye className="h-3 w-3" /> Preview
                      </Button>
                    </div>
                  </FieldRow>
                </div>
              )}
              {/* TODO: Re-enable candidate actions (Move to stage, Assign recruiter, Add tag) */}
              {/* {a.type === "move_stage" && (
                <FieldRow label="Move to">
                  {moveToStageDisabled && moveToStageDisabledReason ? (
                    <p className="text-xs text-amber-600 dark:text-amber-500">
                      {moveToStageDisabledReason} Switch to a specific job or align stages across
                      jobs.
                    </p>
                  ) : (
                    <Select
                      value={a.config.stage ?? ""}
                      onValueChange={(v) => onUpdateActionConfig(a.id, "stage", v)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select stage" />
                      </SelectTrigger>
                      <SelectContent>
                        {stages.map((s) => (
                          <SelectItem key={s} value={s} className="text-xs">
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </FieldRow>
              )} */}
              {/* {a.type === "assign_recruiter" && (
                <FieldRow label="Assign to">
                  <Select
                    value={a.config.recruiter ?? ""}
                    onValueChange={(v) => onUpdateActionConfig(a.id, "recruiter", v)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select recruiter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="jane" className="text-xs">
                        Jane Doe
                      </SelectItem>
                      <SelectItem value="john" className="text-xs">
                        John Smith
                      </SelectItem>
                      <SelectItem value="sarah" className="text-xs">
                        Sarah Lee
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FieldRow>
              )} */}
              {/* {a.type === "add_tag" && (
                <FieldRow label="Tag name">
                  <InputField
                    value={a.config.tag ?? ""}
                    onChange={(e) => onUpdateActionConfig(a.id, "tag", e.target.value)}
                    className="h-8 text-xs"
                    placeholder="e.g. Senior"
                  />
                </FieldRow>
              )} */}
            </CardContent>
          </Card>
        );
      })}

      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground">Add an action</Label>
        {["Communication"].map((cat) => {
          const items = actionTypes.filter((at) => at.category === cat);
          return (
            <div key={cat} className="space-y-1">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {cat}
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {items.map((at) => {
                  const ActionIcon = at.icon;
                  const isAlreadyAdded = actions.some((a) => a.type === at.id);
                  const isMoveStageDisabled = at.id === "move_stage" && moveToStageDisabled;
                  const isDisabled = isAlreadyAdded || isMoveStageDisabled;
                  const tooltipReason = isAlreadyAdded
                    ? "Already added"
                    : isMoveStageDisabled
                      ? moveToStageDisabledReason
                      : null;
                  const button = (
                    <Button
                      key={at.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 text-xs justify-start gap-1.5"
                      disabled={isDisabled}
                      onClick={() => {
                        if (isDisabled) return;
                        onAddAction(at.id);
                      }}
                    >
                      <ActionIcon className="h-3 w-3" /> {at.label}
                    </Button>
                  );
                  if (isDisabled && tooltipReason) {
                    return (
                      <Tooltip key={at.id}>
                        <TooltipTrigger asChild>
                          <span className="inline-block cursor-not-allowed">{button}</span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          {tooltipReason}
                        </TooltipContent>
                      </Tooltip>
                    );
                  }
                  return button;
                })}
              </div>
            </div>
          );
        })}
        {/* TODO: Re-enable candidate actions section */}
        {/* {["Candidate"].map((cat) => {
          const items = actionTypes.filter((at) => at.category === cat);
          return (
            <div key={cat} className="space-y-1">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {cat}
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {items.map((at) => {
                  const ActionIcon = at.icon;
                  const isAlreadyAdded = actions.some((a) => a.type === at.id);
                  const isMoveStageDisabled =
                    at.id === "move_stage" && moveToStageDisabled;
                  const isDisabled = isAlreadyAdded || isMoveStageDisabled;
                  const tooltipReason = isAlreadyAdded
                    ? "Already added"
                    : isMoveStageDisabled
                      ? moveToStageDisabledReason
                      : null;
                  const button = (
                    <Button
                      key={at.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 text-xs justify-start gap-1.5"
                      disabled={isDisabled}
                      onClick={() => {
                        if (isDisabled) return;
                        onAddAction(at.id);
                      }}
                    >
                      <ActionIcon className="h-3 w-3" /> {at.label}
                    </Button>
                  );
                  if (isDisabled && tooltipReason) {
                    return (
                      <Tooltip key={at.id}>
                        <TooltipTrigger asChild>
                          <span className="inline-block cursor-not-allowed">
                            {button}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          {tooltipReason}
                        </TooltipContent>
                      </Tooltip>
                    );
                  }
                  return button;
                })}
              </div>
            </div>
          );
        })} */}
        {/* TODO: Re-enable interview actions section */}
        {/* {["Interview"].map((cat) => {
          const items = actionTypes.filter((at) => at.category === cat);
          return (
            <div key={cat} className="space-y-1">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {cat}
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {items.map((at) => {
                  const ActionIcon = at.icon;
                  const isAlreadyAdded = actions.some((a) => a.type === at.id);
                  const isMoveStageDisabled =
                    at.id === "move_stage" && moveToStageDisabled;
                  const isDisabled = isAlreadyAdded || isMoveStageDisabled;
                  const tooltipReason = isAlreadyAdded
                    ? "Already added"
                    : isMoveStageDisabled
                      ? moveToStageDisabledReason
                      : null;
                  const button = (
                    <Button
                      key={at.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 text-xs justify-start gap-1.5"
                      disabled={isDisabled}
                      onClick={() => {
                        if (isDisabled) return;
                        onAddAction(at.id);
                      }}
                    >
                      <ActionIcon className="h-3 w-3" /> {at.label}
                    </Button>
                  );
                  if (isDisabled && tooltipReason) {
                    return (
                      <Tooltip key={at.id}>
                        <TooltipTrigger asChild>
                          <span className="inline-block cursor-not-allowed">
                            {button}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          {tooltipReason}
                        </TooltipContent>
                      </Tooltip>
                    );
                  }
                  return button;
                })}
              </div>
            </div>
          );
        })} */}
      </div>
    </div>
  );
}

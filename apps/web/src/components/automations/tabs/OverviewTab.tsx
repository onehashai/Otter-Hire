"use client";

import { Card, CardContent } from "@onehash/ui/card";
import { Badge } from "@onehash/ui/badge";
import { Zap, Mail, Tag, Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SummaryPanel, type SummaryPanelProps } from "../summary/SummaryPanel";

export interface AutomationCondition {
  field: string;
  operator: string;
  value: string;
}

export interface AutomationAction {
  type: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  detail: string;
}

export interface OverviewTabAutomation {
  scope: string;
  trigger: { type: string; config: unknown };
  conditions: AutomationCondition[];
  conditionLogic: string;
  actions: AutomationAction[];
  executionCount: number;
  createdBy: string;
  createdAt: string;
  lastModified: string;
}

export interface OverviewTabProps {
  automation: OverviewTabAutomation;
  isActive: boolean;
  isMobile: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function OverviewTab({
  automation,
  isActive,
  isMobile,
  onEdit,
  onDelete,
}: OverviewTabProps) {
  const { t } = useTranslation();

  const summaryProps: SummaryPanelProps = {
    isActive,
    executionCount: automation.executionCount,
    createdBy: automation.createdBy,
    createdAt: automation.createdAt,
    lastModified: automation.lastModified,
    isMobile,
    onEdit,
    onDelete,
  };

  return (
    <div
      className={
        isMobile ? "space-y-4" : "grid grid-cols-[1fr_280px] gap-4"
      }
    >
      <div className="space-y-4">
        {/* Trigger */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs font-medium text-muted-foreground">
                {t("trigger", "Trigger")}
              </p>
            </div>
            <p className="text-sm font-medium">{automation.trigger.type}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("scope", "Scope")}: {automation.scope}
            </p>
          </CardContent>
        </Card>

        {/* Conditions */}
        {automation.conditions.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs font-medium text-muted-foreground">
                  {t("conditions", "Conditions")} (
                  {automation.conditionLogic})
                </p>
              </div>
              <div className="space-y-2">
                {automation.conditions.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {c.field}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {c.operator}
                    </span>
                    <Badge variant="secondary" className="text-[10px]">
                      {c.value}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Play className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs font-medium text-muted-foreground">
                {t("actions", "Actions")}
              </p>
            </div>
            <div className="space-y-2">
              {automation.actions.map((a, i) => {
                const Icon = a.icon;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-7 w-7 rounded bg-muted flex items-center justify-center shrink-0">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm">{a.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.detail}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sidebar stats */}
      <SummaryPanel {...summaryProps} />
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@onehash/ui/card";
import { Button } from "@onehash/ui/button";
import { Badge } from "@onehash/ui/badge";
import { Switch } from "@onehash/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@onehash/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@onehash/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@onehash/ui/dialog";
import {
  MoreHorizontal,
  Copy,
  Trash2,
  Pencil,
  AlertCircle,
  CheckCircle2,
  Briefcase,
} from "lucide-react";
import { AutomationTemplatesDialog } from "./AutomationTemplatesDialog";
import { toast } from "@onehash/ui/sonner";
import { EmptyCard } from "@onehash/ui/card";
import { useTranslation } from "react-i18next";
import {
  createAutomation,
  deleteAutomation,
  getAutomationById,
  updateAutomation,
} from "@/api/automations";
import { getJobs } from "@/api";
import { triggerOptions as builderTriggerOptions } from "@/components/automations/builder/types";

export type AutomationStatus = "active" | "paused";

export interface Automation {
  id: string;
  name: string;
  status: AutomationStatus;
  triggerKey: string;
  triggerLabel: string;
  actionLabel: string;
  scope?: string;
  lastTriggered: string | null;
  createdBy: string;
  createdAt: string;
  executionCount: number;
}

export const allStatuses: AutomationStatus[] = ["active", "paused"];
export const allSpecificTriggers: { value: string; label: string }[] = builderTriggerOptions.map(
  (t) => ({ value: t.id, label: t.label }),
);

const statusVariant = (s: AutomationStatus) => (s === "active" ? "default" : "secondary");

function splitLabelRows(label?: string): string[] {
  if (!label) return [];
  return label
    .split(/\s*(?:\n|→|,|;|\|)\s*/g)
    .map((part) => part.trim())
    .filter(Boolean);
}

function stopPropagation(event: React.SyntheticEvent) {
  event.stopPropagation();
}

export interface AutomationsListProps {
  filtered: Automation[];
  automations: Automation[];
  setAutomations: React.Dispatch<React.SetStateAction<Automation[]>>;
  showEmptyState: boolean;
  templatesOpen?: boolean;
  onTemplatesOpenChange?: (open: boolean) => void;
  onSelectTemplate?: (config: {
    name: string;
    triggerKey: string;
    triggerConfig?: Record<string, unknown>;
    templateId?: string;
  }) => void;
  onCreateClick?: () => void;
}

export function AutomationsList({
  filtered,
  automations,
  setAutomations,
  showEmptyState,
  templatesOpen: templatesOpenProp,
  onTemplatesOpenChange,
  onSelectTemplate,
  onCreateClick,
}: AutomationsListProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [deleteDialog, setDeleteDialog] = useState<string | null>(null);
  const [templatesOpenInternal, setTemplatesOpenInternal] = useState(false);
  const [jobTitlesById, setJobTitlesById] = useState<Record<string, string>>({});
  const [automationJobNames, setAutomationJobNames] = useState<Record<string, string[]>>({});
  const loadingAutomationDetailsRef = useRef<Set<string>>(new Set());
  const templatesOpen = templatesOpenProp ?? templatesOpenInternal;
  const setTemplatesOpen = onTemplatesOpenChange ?? setTemplatesOpenInternal;

  const navigate = (path: string) => router.push(path);

  const handleToggle = async (id: string) => {
    const target = automations.find((a) => a.id === id);
    if (!target) return;
    const nextStatus: AutomationStatus = target.status === "active" ? "paused" : "active";
    setAutomations((prev) => prev.map((a) => (a.id === id ? { ...a, status: nextStatus } : a)));
    try {
      await updateAutomation(id, { status: nextStatus });
      toast.success("Automation updated");
    } catch (err) {
      console.error(err);
      // rollback
      setAutomations((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: target.status } : a)),
      );
      toast.error("Failed to update automation");
    }
  };

  const handleDuplicate = async (id: string) => {
    const source = automations.find((a) => a.id === id);
    if (!source) return;
    try {
      const created = await createAutomation({
        name: `${source.name} (copy)`,
        status: "draft",
        scope: source.scope ?? "all",
        trigger_type: "candidate",
        trigger_key: source.triggerKey,
        trigger_config: { label: source.triggerLabel },
        condition_logic: "and",
        conditions: [],
        actions: [
          {
            type: "send_email",
            config: { label: source.actionLabel },
          },
        ],
        description: null,
      });
      setAutomations((prev) => [
        ...prev,
        {
          id: created.id,
          name: created.name,
          status: (created.status as AutomationStatus) === "paused" ? "paused" : "active",
          triggerKey: source.triggerKey,
          triggerLabel: String(created.trigger_config?.label || source.triggerLabel),
          actionLabel: source.actionLabel,
          scope: created.scope,
          lastTriggered: created.last_run_at,
          createdBy: created.created_by_name ?? "",
          createdAt: created.created_at,
          executionCount: created.execution_count ?? 0,
        },
      ]);
      toast.success("Automation duplicated");
    } catch (err) {
      console.error(err);
      toast.error("Failed to duplicate automation");
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog) return;
    const id = deleteDialog;
    setDeleteDialog(null);
    const previous = automations;
    setAutomations((prev) => prev.filter((a) => a.id !== id));
    try {
      await deleteAutomation(id);
      toast.success("Automation deleted");
    } catch (err) {
      console.error(err);
      setAutomations(previous);
      toast.error("Failed to delete automation");
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const jobs = await getJobs();
        if (cancelled) return;
        setJobTitlesById(
          jobs.reduce<Record<string, string>>((acc, job) => {
            acc[job.id] = job.title;
            return acc;
          }, {}),
        );
      } catch {
        // Keep list usable if jobs lookup fails.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const specificScopeAutomations = automations.filter(
      (automation) =>
        automation.scope === "specific_job" &&
        !automationJobNames[automation.id] &&
        !loadingAutomationDetailsRef.current.has(automation.id),
    );
    if (specificScopeAutomations.length === 0) return;

    specificScopeAutomations.forEach((automation) => {
      loadingAutomationDetailsRef.current.add(automation.id);
      void getAutomationById(automation.id)
        .then((detail) => {
          if (!detail.job_id) {
            setAutomationJobNames((prev) => ({ ...prev, [automation.id]: ["Specific job"] }));
            return;
          }
          const resolvedName = jobTitlesById[detail.job_id] || "Specific job";
          setAutomationJobNames((prev) => ({ ...prev, [automation.id]: [resolvedName] }));
        })
        .catch(() => {
          setAutomationJobNames((prev) => ({ ...prev, [automation.id]: ["Specific job"] }));
        })
        .finally(() => {
          loadingAutomationDetailsRef.current.delete(automation.id);
        });
    });
  }, [automations, automationJobNames, jobTitlesById]);

  if (showEmptyState) {
    return (
      <>
        <EmptyCard
          icon="Briefcase"
          title={t("automations_title")}
          description={t("automations_subtitle")}
          actionLabel={t("create")}
          onAction={onCreateClick}
        />
        <AutomationTemplatesDialog
          open={templatesOpen}
          onOpenChange={setTemplatesOpen}
          onSelectTemplate={onSelectTemplate}
        />
      </>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {filtered.map((a) => (
          <Card
            key={a.id}
            className="cursor-pointer hover:shadow-sm active:bg-muted/50 transition-all"
            onClick={() => navigate(`/automations/${a.id}`)}
          >
            <CardContent className="p-4 py-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold truncate">{a.name}</h3>
                    <Badge
                      variant={statusVariant(a.status)}
                      className="text-[10px] uppercase shrink-0"
                    >
                      {a.status}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 rounded-sm text-left transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          onClick={stopPropagation}
                          onPointerDown={stopPropagation}
                          onTouchStart={stopPropagation}
                          aria-label="Show trigger details"
                        >
                          <span className="inline-flex items-center gap-1.5">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                            {splitLabelRows(a.triggerLabel).length > 1
                              ? `${splitLabelRows(a.triggerLabel).length} triggers applied`
                              : "Trigger applied"}
                          </span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <div className="space-y-1">
                          {(splitLabelRows(a.triggerLabel).length
                            ? splitLabelRows(a.triggerLabel)
                            : [a.triggerLabel || "No trigger details"]
                          ).map((row) => (
                            <p key={`${a.id}-trigger-${row}`} className="text-xs leading-4">
                              {row}
                            </p>
                          ))}
                        </div>
                      </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 rounded-sm text-left transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          onClick={stopPropagation}
                          onPointerDown={stopPropagation}
                          onTouchStart={stopPropagation}
                          aria-label="Show action details"
                        >
                          <span className="inline-flex items-center gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                            {(() => {
                              const actionCount = Math.max(splitLabelRows(a.actionLabel).length, 1);
                              return `${actionCount} action${actionCount > 1 ? "s" : ""} applied`;
                            })()}
                          </span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <div className="space-y-1">
                          {(splitLabelRows(a.actionLabel).length
                            ? splitLabelRows(a.actionLabel)
                            : [a.actionLabel || "No action details"]
                          ).map((row) => (
                            <p key={`${a.id}-action-${row}`} className="text-xs leading-4">
                              {row}
                            </p>
                          ))}
                        </div>
                      </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 rounded-sm text-left transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          onClick={stopPropagation}
                          onPointerDown={stopPropagation}
                          onTouchStart={stopPropagation}
                          aria-label="Show jobs details"
                        >
                          <span className="inline-flex items-center gap-1.5">
                            <Briefcase className="h-3.5 w-3.5 shrink-0" />
                            {(() => {
                              const jobCount =
                                a.scope === "all"
                                  ? null
                                  : (automationJobNames[a.id]?.length ?? (a.scope ? 1 : 0));
                              return `Jobs: ${jobCount == null ? "All" : jobCount}`;
                            })()}
                          </span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <div className="space-y-1">
                          {(a.scope === "all"
                            ? ["Applies to all jobs"]
                            : (automationJobNames[a.id] ?? ["Specific job"])
                          ).map((jobName) => (
                            <p key={`${a.id}-job-${jobName}`} className="text-xs leading-4">
                              {jobName}
                            </p>
                          ))}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
                <div
                  className="flex items-center gap-2 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Switch
                    checked={a.status === "active"}
                    onCheckedChange={() => handleToggle(a.id)}
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 p-0"
                        tooltip={t("tooltip_automation_options")}
                        tooltipContentProps={{ side: "top" }}
                        aria-label={t("tooltip_automation_options")}
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-36">
                      <DropdownMenuItem
                        className="text-xs gap-2"
                        onClick={() => navigate(`/automations/${a.id}/edit`)}
                      >
                        <Pencil className="h-3 w-3" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-xs gap-2"
                        onClick={() => handleDuplicate(a.id)}
                      >
                        <Copy className="h-3 w-3" /> Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-xs gap-2 text-destructive"
                        onClick={() => setDeleteDialog(a.id)}
                      >
                        <Trash2 className="h-3 w-3" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            No automations match your filters.
          </p>
        )}
      </div>

      {/* Delete confirmation */}
      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-base">Delete automation?</DialogTitle>
            <DialogDescription className="text-xs">
              This action cannot be undone. The automation and its execution history will be
              permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => setDeleteDialog(null)}
            >
              Cancel
            </Button>
            <Button variant="destructive" size="sm" className="text-xs" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AutomationTemplatesDialog
        open={templatesOpen}
        onOpenChange={setTemplatesOpen}
        onSelectTemplate={onSelectTemplate}
      />
    </>
  );
}

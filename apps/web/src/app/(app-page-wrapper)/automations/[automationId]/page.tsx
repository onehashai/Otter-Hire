"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@onehash/ui/button";
import { Badge } from "@onehash/ui/badge";
import { Switch } from "@onehash/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@onehash/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@onehash/ui/dialog";
import { ArrowLeft, Pencil, Trash2, Mail, Tag } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "@onehash/ui/sonner";
import { useSetPageMetadata } from "@/hooks/useSetPageMetadata";
import { useTranslation } from "react-i18next";
import { OverviewTab } from "@/components/automations/tabs/OverviewTab";
import { ExecutionLog, type ExecutionLogEntry } from "@/components/automations/tabs/ExecutionLog";
import { ExecutionDetailsDialog } from "@/components/automations/tabs/ExecutionDetailsDialog";
import { getAutomationById, getAutomationExecutions } from "@/api/automations";

export default function AutomationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useTranslation();
  const automationId = params?.automationId as string;
  const isMobile = useIsMobile();

  useSetPageMetadata({
    title: t("automation_overview_title"),
    subtitle: t("automation_overview_subtitle"),
  });

  const [isActive, setIsActive] = useState(false);
  const [automation, setAutomation] = useState<any | null>(null);
  const [logs, setLogs] = useState<ExecutionLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedLog, setSelectedLog] = useState<ExecutionLogEntry | null>(null);

  useEffect(() => {
    if (!automationId) return;
    let cancelled = false;
    (async () => {
      try {
        const [detail, executions] = await Promise.all([
          getAutomationById(automationId),
          getAutomationExecutions(automationId),
        ]);
        if (cancelled) return;

        const overviewAutomation = {
          id: detail.id,
          name: detail.name,
          status: detail.status as "active" | "paused" | "draft",
          scope: detail.scope,
          trigger: {
            type: detail.trigger_config?.label ?? detail.trigger_key,
            config: detail.trigger_config,
          },
          actions: detail.actions.map((a) => ({
            type: a.type,
            label: a.config.label ?? a.type,
            icon: Mail,
            detail: a.config.template ? `Template: ${a.config.template}` : undefined,
          })),
          createdBy: detail.created_by_name ?? "",
          createdAt: new Date(detail.created_at).toLocaleDateString(),
          lastModified: new Date(detail.updated_at).toLocaleDateString(),
          executionCount: detail.execution_count,
        };

        const mappedLogs: ExecutionLogEntry[] = executions.map((e) => ({
          id: e.id,
          candidateName: e.candidate_id ?? "",
          event: e.trigger_event,
          action: "",
          timestamp: new Date(e.created_at).toLocaleString(),
          status: e.status as "success" | "failed",
          detail: e.message ?? undefined,
        }));

        setAutomation(overviewAutomation);
        setIsActive(detail.status === "active");
        setLogs(mappedLogs);
        setError(null);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError("Failed to load automation.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [automationId]);

  const handleToggle = () => {
    setIsActive(!isActive);
    toast.success(isActive ? "Automation paused" : "Automation activated");
  };

  const handleDelete = () => {
    toast.success("Automation deleted");
    router.push("/automations");
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 shrink-0"
            onClick={() => router.push("/automations")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold truncate">
                {automation?.name ?? t("automation_overview_title")}
              </h1>
              <Badge
                variant={isActive ? "default" : "secondary"}
                className="text-[10px] capitalize shrink-0"
              >
                {isActive ? "Active" : "Paused"}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={isActive} onCheckedChange={handleToggle} />
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5 hidden md:flex"
            onClick={() => router.push(`/automations/${automationId}/edit`)}
          >
            <Pencil className="h-3 w-3" /> {t("edit", "Edit")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5 text-destructive hidden md:flex"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-3 w-3" /> {t("delete", "Delete")}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-9 w-full justify-start bg-transparent border-b rounded-none p-0 gap-0">
          {[
            { value: "overview", label: t("overview", "Overview") },
            { value: "executions", label: t("execution_log", "Execution Log") },
          ].map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none text-xs h-9 px-3"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : automation ? (
            <OverviewTab
              automation={automation}
              isActive={isActive}
              isMobile={isMobile}
              onEdit={() => router.push(`/automations/${automationId}/edit`)}
              onDelete={() => setDeleteOpen(true)}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              {loading ? "Loading automation..." : "Automation not found."}
            </p>
          )}
        </TabsContent>

        <TabsContent value="executions" className="mt-4">
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : (
            <ExecutionLog logs={logs} onLogSelect={setSelectedLog} isMobile={isMobile} />
          )}
        </TabsContent>
      </Tabs>

      <ExecutionDetailsDialog
        log={selectedLog}
        onOpenChange={(open) => !open && setSelectedLog(null)}
      />

      {/* Delete dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">
              {t("delete_automation_title", "Delete automation?")}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {t(
                "delete_automation_description",
                "This will permanently remove this automation and all its execution history.",
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => setDeleteOpen(false)}
            >
              {t("cancel", "Cancel")}
            </Button>
            <Button variant="destructive" size="sm" className="text-xs" onClick={handleDelete}>
              {t("delete", "Delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

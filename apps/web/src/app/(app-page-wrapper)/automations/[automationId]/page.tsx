"use client";

import { useState } from "react";
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
import { toast } from "sonner";
import { useSetPageMetadata } from "@/hooks/useSetPageMetadata";
import { useTranslation } from "react-i18next";
import { OverviewTab } from "@/components/automations/tabs/OverviewTab";
import {
  ExecutionLog,
  type ExecutionLogEntry,
} from "@/components/automations/tabs/ExecutionLog";
import { ExecutionDetailsDialog } from "@/components/automations/tabs/ExecutionDetailsDialog";

const mockAutomation = {
  id: "1",
  name: "Auto-reject unqualified",
  status: "active" as "active" | "paused" | "draft",
  scope: "All jobs",
  trigger: {
    type: "Candidate applied",
    config: null,
  },
  conditions: [
    { field: "Candidate rating", operator: "is less than", value: "3" },
    { field: "Source", operator: "equals", value: "Job board" },
  ],
  conditionLogic: "AND",
  actions: [
    {
      type: "send_email",
      label: "Send rejection email",
      icon: Mail,
      detail: "Template: Rejection Email",
    },
    {
      type: "add_tag",
      label: "Add tag",
      icon: Tag,
      detail: "Tag: Auto-rejected",
    },
  ],
  createdBy: "Jane Doe",
  createdAt: "Jan 15, 2026",
  lastModified: "Feb 18, 2026",
  executionCount: 142,
};

const mockLogs: ExecutionLogEntry[] = [
  {
    id: "1",
    candidateName: "Alex Johnson",
    event: "Candidate applied",
    action: "Sent rejection email",
    timestamp: "2h ago",
    status: "success",
  },
  {
    id: "2",
    candidateName: "Maria Garcia",
    event: "Candidate applied",
    action: "Sent rejection email",
    timestamp: "5h ago",
    status: "success",
  },
  {
    id: "3",
    candidateName: "James Liu",
    event: "Candidate applied",
    action: "Sent rejection email",
    timestamp: "1d ago",
    status: "failed",
    detail: "Email delivery failed",
  },
  {
    id: "4",
    candidateName: "Priya Sharma",
    event: "Candidate applied",
    action: "Added tag: Auto-rejected",
    timestamp: "1d ago",
    status: "success",
  },
  {
    id: "5",
    candidateName: "Tom Wilson",
    event: "Candidate applied",
    action: "Sent rejection email",
    timestamp: "2d ago",
    status: "success",
  },
  {
    id: "6",
    candidateName: "Sara Kim",
    event: "Candidate applied",
    action: "Sent rejection email",
    timestamp: "3d ago",
    status: "success",
  },
  {
    id: "7",
    candidateName: "David Chen",
    event: "Candidate applied",
    action: "Added tag: Auto-rejected",
    timestamp: "3d ago",
    status: "success",
  },
  {
    id: "8",
    candidateName: "Emma Brown",
    event: "Candidate applied",
    action: "Sent rejection email",
    timestamp: "4d ago",
    status: "success",
  },
];

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

  const [isActive, setIsActive] = useState(mockAutomation.status === "active");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedLog, setSelectedLog] = useState<ExecutionLogEntry | null>(null);

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
                {mockAutomation.name}
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
          <OverviewTab
            automation={mockAutomation}
            isActive={isActive}
            isMobile={isMobile}
            onEdit={() => router.push(`/automations/${automationId}/edit`)}
            onDelete={() => setDeleteOpen(true)}
          />
        </TabsContent>

        <TabsContent value="executions" className="mt-4">
          <ExecutionLog
            logs={mockLogs}
            onLogSelect={setSelectedLog}
            isMobile={isMobile}
          />
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
                "This will permanently remove this automation and all its execution history."
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
            <Button
              variant="destructive"
              size="sm"
              className="text-xs"
              onClick={handleDelete}
            >
              {t("delete", "Delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

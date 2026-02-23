"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@onehash/ui/card";
import { Button } from "@onehash/ui/button";
import { Badge } from "@onehash/ui/badge";
import { Switch } from "@onehash/ui/switch";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@onehash/ui/table";
import { Plus, Zap, MoreHorizontal, Copy, Trash2, Pencil } from "lucide-react";
import { AutomationTemplatesDialog } from "./AutomationTemplatesDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { EmptyCard } from "@onehash/ui/card";
import { useTranslation } from "react-i18next";

export type AutomationStatus = "active" | "paused";
export type TriggerType = "candidate" | "job" | "time-based";

export interface Automation {
  id: string;
  name: string;
  status: AutomationStatus;
  triggerType: TriggerType;
  triggerLabel: string;
  actionLabel: string;
  lastTriggered: string | null;
  createdBy: string;
  createdAt: string;
  executionCount: number;
}

export const mockAutomations: Automation[] = [
  {
    id: "1",
    name: "Auto-reject unqualified",
    status: "active",
    triggerType: "candidate",
    triggerLabel: "Candidate applied",
    actionLabel: "Send rejection email",
    lastTriggered: "2h ago",
    createdBy: "Jane Doe",
    createdAt: "Jan 15, 2026",
    executionCount: 142,
  },
  {
    id: "2",
    name: "Schedule screening call",
    status: "active",
    triggerType: "candidate",
    triggerLabel: "Moved to Screening",
    actionLabel: "Send calendar link",
    lastTriggered: "5h ago",
    createdBy: "John Smith",
    createdAt: "Jan 20, 2026",
    executionCount: 87,
  },
  {
    id: "3",
    name: "Notify hiring manager",
    status: "paused",
    triggerType: "candidate",
    triggerLabel: "Interview completed",
    actionLabel: "Send notification",
    lastTriggered: "3d ago",
    createdBy: "Jane Doe",
    createdAt: "Feb 1, 2026",
    executionCount: 34,
  },
  {
    id: "4",
    name: "Stale application reminder",
    status: "active",
    triggerType: "time-based",
    triggerLabel: "5 days in Applied",
    actionLabel: "Send reminder",
    lastTriggered: "1d ago",
    createdBy: "Sarah Lee",
    createdAt: "Feb 5, 2026",
    executionCount: 21,
  },
  {
    id: "5",
    name: "Auto-publish to LinkedIn",
    status: "active",
    triggerType: "job",
    triggerLabel: "Job published",
    actionLabel: "Post to LinkedIn",
    lastTriggered: null,
    createdBy: "Jane Doe",
    createdAt: "Feb 10, 2026",
    executionCount: 0,
  },
];

export const allStatuses: AutomationStatus[] = ["active", "paused"];
export const allTriggerTypes: { value: TriggerType; label: string }[] = [
  { value: "candidate", label: "Candidate" },
  { value: "job", label: "Job" },
  { value: "time-based", label: "Time-based" },
];

export const triggerTypeLabel = (t: TriggerType): string =>
  t === "candidate" ? "Candidate" : t === "job" ? "Job" : "Time-based";

const statusVariant = (s: AutomationStatus) =>
  s === "active" ? "default" : "secondary";

export interface AutomationsListProps {
  filtered: Automation[];
  automations: Automation[];
  setAutomations: React.Dispatch<React.SetStateAction<Automation[]>>;
  showEmptyState: boolean;
  templatesOpen?: boolean;
  onTemplatesOpenChange?: (open: boolean) => void;
}

export function AutomationsList({
  filtered,
  automations,
  setAutomations,
  showEmptyState,
  templatesOpen: templatesOpenProp,
  onTemplatesOpenChange,
}: AutomationsListProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const router = useRouter();
  const [deleteDialog, setDeleteDialog] = useState<string | null>(null);
  const [templatesOpenInternal, setTemplatesOpenInternal] = useState(false);
  const templatesOpen = templatesOpenProp ?? templatesOpenInternal;
  const setTemplatesOpen =
    onTemplatesOpenChange ?? setTemplatesOpenInternal;

  const navigate = (path: string) => router.push(path);

  const handleToggle = (id: string) => {
    setAutomations((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, status: a.status === "active" ? "paused" : "active" } : a
      )
    );
    toast.success("Automation updated");
  };

  const handleDuplicate = (id: string) => {
    const source = automations.find((a) => a.id === id);
    if (!source) return;
    const dup: Automation = {
      ...source,
      id: crypto.randomUUID(),
      name: `${source.name} (copy)`,
      status: "active",
      lastTriggered: null,
      executionCount: 0,
    };
    setAutomations((prev) => [...prev, dup]);
    toast.success("Automation duplicated");
  };

  const handleDelete = () => {
    if (!deleteDialog) return;
    setAutomations((prev) => prev.filter((a) => a.id !== deleteDialog));
    setDeleteDialog(null);
    toast.success("Automation deleted");
  };

  /* ───── Empty State ───── */
  if (showEmptyState) {
    return (
      <EmptyCard
        icon="Briefcase"
        title={t("automations_title")}
        description={t("automations_subtitle")}
        actionLabel={t("create")}
        onAction={() => navigate("/automations/new")}
      />
    );
  }

  return (
    <>
      {/* List */}
      {isMobile ? (
        <div className="space-y-2">
          {filtered.map((a) => (
            <Card
              key={a.id}
              className="active:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => navigate(`/automations/${a.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium truncate">{a.name}</p>
                      <Badge
                        variant={statusVariant(a.status)}
                        className="text-[10px] capitalize shrink-0"
                      >
                        {a.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Badge variant="outline" className="text-[10px]">
                        {a.triggerLabel}
                      </Badge>
                      <span>→</span>
                      <Badge variant="outline" className="text-[10px]">
                        {a.actionLabel}
                      </Badge>
                    </div>
                  </div>
                  <Switch
                    checked={a.status === "active"}
                    onCheckedChange={() => handleToggle(a.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0 mt-1"
                  />
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
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Name</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Trigger</TableHead>
                  <TableHead className="text-xs">Last Triggered</TableHead>
                  <TableHead className="text-xs">Created By</TableHead>
                  <TableHead className="text-xs w-[80px]">Enabled</TableHead>
                  <TableHead className="text-xs w-[40px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((a) => (
                  <TableRow
                    key={a.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/automations/${a.id}`)}
                  >
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{a.name}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={statusVariant(a.status)}
                        className="text-[10px] capitalize"
                      >
                        {a.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {a.triggerLabel}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {a.lastTriggered ?? "Never"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {a.createdBy}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Switch
                        checked={a.status === "active"}
                        onCheckedChange={() => handleToggle(a.id)}
                      />
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
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
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-sm text-muted-foreground text-center py-8"
                    >
                      No automations match your filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Mobile FAB */}
      {isMobile && (
        <Button
          size="icon"
          className="fixed bottom-20 right-4 h-12 w-12 rounded-full shadow-lg md:hidden"
          onClick={() => navigate("/automations/new")}
        >
          <Plus className="h-5 w-5" />
        </Button>
      )}

      {/* Delete confirmation */}
      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent className="max-w-sm">
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
      />
    </>
  );
}

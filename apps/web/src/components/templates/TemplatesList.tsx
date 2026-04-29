"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  FileText,
  MoreHorizontal,
  Eye,
  Copy,
  Trash2,
  Pencil,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@onehash/ui/button";
import { Badge } from "@onehash/ui/badge";
import { Card, CardContent } from "@onehash/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@onehash/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@onehash/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@onehash/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  getTemplates,
  createTemplate,
  deleteTemplate as deleteTemplateApi,
  getTemplateUsages,
} from "@/api/templates";
import { ApiError, classifyError } from "@/api/client/client";
import { TemplatePreviewModal } from "./components/TemplatePreviewModal";
import { useTranslation } from "react-i18next";

export interface Template {
  id: string;
  name: string;
  category: string;
  subject: string;
  body: string;
}

function mapApiToTemplate(r: {
  id: string;
  name: string;
  category: string;
  subject: string;
  body: string;
}): Template {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    subject: r.subject,
    body: r.body,
  };
}

export interface TemplatesListProps {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
}

export default function TemplatesList({ searchValue, onSearchChange }: TemplatesListProps) {
  const router = useRouter();
  const { t: tr } = useTranslation();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; forbidden: boolean } | null>(null);
  const [internalSearch, setInternalSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);

  // Confirmation dialog state (for templates NOT in use)
  const [confirmDelete, setConfirmDelete] = useState<Template | null>(null);
  const [checking, setChecking] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // In-use dialog state (for templates that are used in automations)
  const [inUseInfo, setInUseInfo] = useState<{
    template: Template;
    automations: { id: string; name: string }[];
  } | null>(null);

  const search = typeof searchValue === "string" ? searchValue : internalSearch;
  const setSearch = typeof onSearchChange === "function" ? onSearchChange : setInternalSearch;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await getTemplates();
        if (!cancelled) setTemplates(list.map(mapApiToTemplate));
      } catch (err) {
        if (!cancelled) {
          const classified = classifyError(err);
          setError({ message: classified.message, forbidden: classified.forbidden });
          if (!classified.forbidden) toast({ title: classified.message, variant: "destructive" });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const filtered = templates.filter((t) => {
    const matchSearch = t.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === "all" || t.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const handleDuplicate = async (t: Template) => {
    try {
      const created = await createTemplate({
        name: `${t.name} (Copy)`,
        category: t.category,
        subject: t.subject,
        body: t.body,
      });
      setTemplates((prev) => [mapApiToTemplate(created), ...prev]);
      toast({ title: "Template duplicated" });
    } catch {
      toast({ title: "Failed to duplicate template", variant: "destructive" });
    }
  };

  // Step 1 — dropdown Delete click:
  //   • check if template is in use via GET /usages
  //   • in use  → open in-use dialog directly (skip confirmation)
  //   • not in use → open confirmation dialog
  //   • if GET /usages is unavailable (backend not restarted yet), fall back to calling
  //     DELETE directly: 409 → in-use dialog, 204 → deleted without confirmation
  const handleDeleteClick = async (t: Template) => {
    if (checking === t.id) return;
    setChecking(t.id);
    try {
      const { automations } = await getTemplateUsages(t.id);
      if (automations.length > 0) {
        setInUseInfo({ template: t, automations });
      } else {
        setConfirmDelete(t);
      }
    } catch {
      // GET /usages not available — call DELETE directly as the check
      try {
        await deleteTemplateApi(t.id);
        setTemplates((prev) => prev.filter((tmpl) => tmpl.id !== t.id));
        toast({ title: "Template deleted" });
      } catch (deleteErr) {
        if (
          deleteErr instanceof ApiError &&
          deleteErr.status === 409 &&
          deleteErr.code === "TEMPLATE_IN_USE"
        ) {
          const details = deleteErr.details as
            | { automations: { id: string; name: string }[] }
            | undefined;
          setInUseInfo({ template: t, automations: details?.automations ?? [] });
        } else {
          toast({ title: "Failed to delete template", variant: "destructive" });
        }
      }
    } finally {
      setChecking(null);
    }
  };

  // Step 2 — user confirmed deletion: call DELETE API
  //   • 204 → deleted successfully
  //   • 409 TEMPLATE_IN_USE → close confirmation, open in-use dialog
  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    const target = confirmDelete;
    setDeleting(true);
    try {
      await deleteTemplateApi(target.id);
      setTemplates((prev) => prev.filter((t) => t.id !== target.id));
      toast({ title: "Template deleted" });
      setConfirmDelete(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.code === "TEMPLATE_IN_USE") {
        const details = err.details as { automations: { id: string; name: string }[] } | undefined;
        setConfirmDelete(null);
        setInUseInfo({ template: target, automations: details?.automations ?? [] });
      } else {
        toast({ title: "Failed to delete template", variant: "destructive" });
      }
    } finally {
      setDeleting(false);
    }
  };

  const modals = (
    <>
      {previewTemplate && (
        <TemplatePreviewModal
          open={!!previewTemplate}
          onOpenChange={(open) => !open && setPreviewTemplate(null)}
          subject={previewTemplate.subject}
          body={previewTemplate.body}
        />
      )}

      {/* Confirmation dialog — template NOT in use */}
      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(open) => !open && !deleting && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{confirmDelete?.name}&quot;. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* In-use dialog — template is referenced by one or more automations */}
      <Dialog open={!!inUseInfo} onOpenChange={(open) => !open && setInUseInfo(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
              <DialogTitle>Template in use</DialogTitle>
            </div>
            <DialogDescription className="pt-1">
              &quot;{inUseInfo?.template.name}&quot; is used in the following automation
              {inUseInfo && inUseInfo.automations.length !== 1 ? "s" : ""}. Remove or update{" "}
              {inUseInfo && inUseInfo.automations.length !== 1 ? "them" : "it"} first before
              deleting this template.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 py-1">
            {inUseInfo?.automations.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <span className="font-medium truncate">{a.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-2 shrink-0 h-7 px-2 text-xs"
                  onClick={() => {
                    router.push(`/automations/${a.id}`);
                    setInUseInfo(null);
                  }}
                >
                  <ExternalLink className="h-3.5 w-3.5 mr-1" />
                  Open
                </Button>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInUseInfo(null)}>
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
        Loading templates…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 rounded-full bg-destructive/10 p-3">
          <FileText className="h-6 w-6 text-destructive" />
        </div>
        <h3 className="mb-1 text-lg font-semibold">
          {error.forbidden ? "Access Denied" : "Something went wrong"}
        </h3>
        <p className="max-w-md text-sm text-muted-foreground">
          {error.forbidden
            ? "You don't have permission to view templates. Contact your administrator if you think this is a mistake."
            : error.message}
        </p>
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 rounded-full bg-muted p-3">
            <FileText className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="mb-1 text-lg font-semibold text-foreground">No templates yet</h3>
          <p className="mb-6 max-w-md text-sm text-muted-foreground">
            Create your first template to streamline candidate communication.
          </p>
          <Button onClick={() => router.push("/templates/new")}>
            <Plus className="h-4 w-4 mr-1.5" />
            Create Template
          </Button>
        </div>
        {modals}
      </>
    );
  }

  if (filtered.length === 0) {
    return (
      <>
        <p className="text-sm text-muted-foreground text-center py-8">
          No templates match your filters.
        </p>
        {modals}
      </>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {filtered.map((t) => (
          <Card
            key={t.id}
            className="cursor-pointer hover:shadow-sm active:bg-muted/50 transition-all"
            onClick={() => router.push(`/templates/${t.id}`)}
          >
            <CardContent className="p-4 py-3">
              <div className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <h3 className="text-sm font-medium truncate">{t.name}</h3>
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      {t.category}
                    </Badge>
                  </div>
                </div>
                <div
                  className="flex items-center gap-2 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        tooltip={tr("tooltip_template_options")}
                        tooltipContentProps={{ side: "top" }}
                        aria-label={tr("tooltip_template_options")}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => router.push(`/templates/${t.id}`)}>
                        <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setPreviewTemplate(t)}>
                        <Eye className="h-3.5 w-3.5 mr-2" /> Preview
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDuplicate(t)}>
                        <Copy className="h-3.5 w-3.5 mr-2" /> Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDeleteClick(t)}
                        disabled={checking === t.id}
                        className="text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2" />
                        {checking === t.id ? "Checking…" : "Delete"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {modals}
    </>
  );
}

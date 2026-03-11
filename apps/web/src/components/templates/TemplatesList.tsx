"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, FileText, MoreHorizontal, Eye, Copy, Trash2, Pencil, ChevronRight } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { getTemplates, createTemplate, deleteTemplate as deleteTemplateApi } from "@/api/templates";
import { TemplatePreviewModal } from "./components/TemplatePreviewModal";
import { cn } from "@/lib/utils";

export interface Template {
  id: string;
  name: string;
  category: string;
  subject: string;
  body: string;
  updatedAt: string;
  createdBy: string;
  usageCount: number;
}

function mapApiToTemplate(r: {
  id: string;
  name: string;
  category: string;
  subject: string;
  body: string;
  updated_at: string;
}): Template {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    subject: r.subject,
    body: r.body,
    updatedAt: r.updated_at.slice(0, 10),
    createdBy: "—",
    usageCount: 0,
  };
}

const formatTimeAgo = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d ago`;
};

export interface TemplatesListProps {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
}

export default function TemplatesList({ searchValue, onSearchChange }: TemplatesListProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [internalSearch, setInternalSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [deleteTemplate, setDeleteTemplate] = useState<Template | null>(null);

  const search = typeof searchValue === "string" ? searchValue : internalSearch;
  const setSearch = typeof onSearchChange === "function" ? onSearchChange : setInternalSearch;

  useEffect(() => {
    let cancelled = false;
    getTemplates()
      .then((list) => {
        if (!cancelled) {
          setTemplates(list.map(mapApiToTemplate));
        }
      })
      .catch(() => {
        if (!cancelled) toast({ title: "Failed to load templates", variant: "destructive" });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
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

  const handleDelete = async () => {
    if (!deleteTemplate) return;
    try {
      await deleteTemplateApi(deleteTemplate.id);
      setTemplates((prev) => prev.filter((t) => t.id !== deleteTemplate.id));
      toast({ title: "Template deleted" });
      setDeleteTemplate(null);
    } catch {
      toast({ title: "Failed to delete template", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
        Loading templates…
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <FileText className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-medium text-foreground mb-1">No templates yet</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-sm">
            Create your first template to streamline candidate communication.
          </p>
          <Button size="sm" onClick={() => router.push("/templates/new")}>
            <Plus className="h-4 w-4 mr-1.5" />
            Create Template
          </Button>
        </div>
        {previewTemplate && (
          <TemplatePreviewModal
            open={!!previewTemplate}
            onOpenChange={(open) => !open && setPreviewTemplate(null)}
            subject={previewTemplate.subject}
            body={previewTemplate.body}
          />
        )}
        <AlertDialog open={!!deleteTemplate} onOpenChange={() => setDeleteTemplate(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete template?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete &quot;{deleteTemplate?.name}&quot;. This action cannot be
                undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleDelete}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="text-sm font-medium truncate">{t.name}</h3>
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      {t.category}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{t.category}</span>
                    <span>·</span>
                    <span>{formatTimeAgo(t.updatedAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Button
                    variant="default"
                    size="sm"
                    className="h-8 text-xs text-primary-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/templates/${t.id}`);
                    }}
                  >
                    Edit
                  </Button>
                  <div className="text-right">
                    <div className="text-sm font-medium">{t.usageCount}</div>
                    <div className="text-[10px] text-muted-foreground">Used</div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
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
                        onClick={() => setDeleteTemplate(t)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <ChevronRight className={cn("h-4 w-4 text-muted-foreground")} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {previewTemplate && (
        <TemplatePreviewModal
          open={!!previewTemplate}
          onOpenChange={(open) => !open && setPreviewTemplate(null)}
          subject={previewTemplate.subject}
          body={previewTemplate.body}
        />
      )}

      <AlertDialog open={!!deleteTemplate} onOpenChange={() => setDeleteTemplate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{deleteTemplate?.name}&quot;. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

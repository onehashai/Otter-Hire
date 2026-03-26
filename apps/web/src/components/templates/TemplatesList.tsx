"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, FileText, MoreHorizontal, Eye, Copy, Trash2, Pencil } from "lucide-react";
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
        Loading templates…
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
                      <Button variant="outline" size="icon" className="h-8 w-8">
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
                        onClick={() => setDeleteTemplate(t)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
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

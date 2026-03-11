"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  FileText,
  MoreHorizontal,
  Eye,
  Copy,
  Trash2,
  Pencil,
  Upload,
} from "lucide-react";
import { Button } from "@onehash/ui/button";
import { InputField } from "@onehash/ui/input";
import { Badge } from "@onehash/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@onehash/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@onehash/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@onehash/ui/select";
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
import { useIsMobile } from "@/hooks/use-mobile";
import { getTemplates, createTemplate, deleteTemplate as deleteTemplateApi } from "@/api/templates";
import { TemplatePreviewModal } from "./components/TemplatePreviewModal";

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

export default function TemplatesList() {
  const router = useRouter();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [deleteTemplate, setDeleteTemplate] = useState<Template | null>(null);

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

  return (
    <div className="space-y-6">
      {filtered.length === 0 ? (
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
      ) : isMobile ? (
        <div className="space-y-3">
          {filtered.map((t) => (
            <div key={t.id} className="border border-border rounded-lg p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{t.name}</p>
                  <Badge variant="secondary" className="mt-1 text-[10px]">
                    {t.category}
                  </Badge>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
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
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>Updated {t.updatedAt}</span>
                <span>Used {t.usageCount}×</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Template Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead>Created By</TableHead>
                <TableHead className="text-right">Usage</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => (
                <TableRow
                  key={t.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/templates/${t.id}`)}
                >
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[10px]">
                      {t.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{t.updatedAt}</TableCell>
                  <TableCell className="text-muted-foreground">{t.createdBy}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{t.usageCount}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
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
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

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
    </div>
  );
}

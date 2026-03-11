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
  const [isMobile, setIsMobile] = useState(false);
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

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 768);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

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
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates..."
            className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="Email">Email</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => router.push("/templates/import")}>
            <Upload className="mr-1.5 h-4 w-4" />
            Import
          </Button>
          <Button onClick={() => router.push("/templates/new")}>
            <Plus className="mr-1.5 h-4 w-4" />
            Create
          </Button>
        </div>
      </div>

      {isMobile ? (
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
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">No templates match your filters.</div>
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

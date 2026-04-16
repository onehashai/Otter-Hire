"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@onehash/ui/card";
import { Button } from "@onehash/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@onehash/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@onehash/ui/dialog";
import { InputField } from "@onehash/ui/input";
import { Icon } from "@onehash/ui/icon";
import { toast } from "@onehash/ui/sonner";
import {
  getJobCategories,
  createJobCategory,
  deleteJobCategory,
  updateJobCategory,
  type JobCategoryResponse,
} from "@/api";
import { useAuthSession } from "@/app/providers";

export default function CategoriesPage() {
  const { user } = useAuthSession();
  const canEditCategory = ["owner", "admin", "recruiter"].includes(user?.membership_role ?? "");

  const [categories, setCategories] = useState<JobCategoryResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<JobCategoryResponse | null>(null);
  const [categoryToEdit, setCategoryToEdit] = useState<JobCategoryResponse | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editCategoryName, setEditCategoryName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [inUseDialogOpen, setInUseDialogOpen] = useState(false);
  const [inUseCategoryName, setInUseCategoryName] = useState("");
  const [inUseCount, setInUseCount] = useState<number | null>(null);

  const fetchCategories = async () => {
    try {
      const data = await getJobCategories();
      setCategories(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load categories");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleAdd = async () => {
    if (!newCategoryName.trim()) {
      toast.error("Category name is required");
      return;
    }
    setSubmitting(true);
    try {
      await createJobCategory({ name: newCategoryName.trim() });
      toast.success("Category added");
      setAddDialogOpen(false);
      setNewCategoryName("");
      fetchCategories();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add category");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!categoryToDelete) return;
    setSubmitting(true);
    try {
      await deleteJobCategory(categoryToDelete.id);
      toast.success("Category deleted");
      setDeleteDialogOpen(false);
      setCategoryToDelete(null);
      fetchCategories();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete category";
      const inUseMatch = message.match(/used by\s+(\d+)\s+job/i);
      if (inUseMatch) {
        setInUseCategoryName(categoryToDelete.name);
        setInUseCount(Number(inUseMatch[1]));
        setDeleteDialogOpen(false);
        setInUseDialogOpen(true);
      } else {
        toast.error(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!categoryToEdit) return;
    const trimmed = editCategoryName.trim();
    if (!trimmed) {
      toast.error("Category name is required");
      return;
    }
    setSubmitting(true);
    try {
      await updateJobCategory(categoryToEdit.id, { name: trimmed });
      toast.success("Category updated");
      setEditDialogOpen(false);
      setCategoryToEdit(null);
      setEditCategoryName("");
      fetchCategories();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update category");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-base md:text-lg font-semibold mb-1">Job Categories</h2>
          <p className="text-xs text-muted-foreground">
            Manage department categories for your jobs
          </p>
        </div>
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base md:text-lg font-semibold mb-1">Job Categories</h2>
            <p className="text-xs text-muted-foreground">
              Manage department categories for your jobs
            </p>
          </div>
          <Button
            size="sm"
            className="text-xs h-9 md:h-8 gap-1.5 shrink-0"
            onClick={() => setAddDialogOpen(true)}
          >
            <Icon name="Plus" className="h-3.5 w-3.5" />
            Add Category
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs font-medium h-10">Category</TableHead>
                  <TableHead className="text-xs font-medium h-10 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((cat) => (
                  <TableRow key={cat.id} className="group">
                    <TableCell className="py-3">
                      <span className="text-sm">{cat.name}</span>
                    </TableCell>
                    <TableCell className="py-3 text-right">
                      <div className="inline-flex items-center justify-end gap-0.5">
                        {canEditCategory ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => {
                              setCategoryToEdit(cat);
                              setEditCategoryName(cat.name);
                              setEditDialogOpen(true);
                            }}
                            aria-label={`Edit ${cat.name}`}
                          >
                            <Icon
                              name="PenLine"
                              className="h-4 w-4 text-muted-foreground hover:text-foreground"
                            />
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => {
                            const usageCount = Number(cat.usage_count ?? 0);
                            if (usageCount > 0) {
                              setInUseCategoryName(cat.name);
                              setInUseCount(usageCount);
                              setInUseDialogOpen(true);
                              return;
                            }
                            setCategoryToDelete(cat);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Icon
                            name="Trash2"
                            className="h-4 w-4 text-muted-foreground hover:text-destructive"
                          />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Category</DialogTitle>
            <DialogDescription className="sr-only">
              Enter a name for the new job category. It will be available when creating or editing
              jobs.
            </DialogDescription>
          </DialogHeader>
          <InputField
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="e.g. Customer Success"
            className="mt-2"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={submitting}>
              {submitting ? "Adding..." : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) {
            setCategoryToEdit(null);
            setEditCategoryName("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
            <DialogDescription className="sr-only">
              Change the category name. Jobs using this category will show the updated name.
            </DialogDescription>
          </DialogHeader>
          <InputField
            value={editCategoryName}
            onChange={(e) => setEditCategoryName(e.target.value)}
            placeholder="Category name"
            className="mt-2"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleSaveEdit();
              }
            }}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogOpen(false);
                setCategoryToEdit(null);
                setEditCategoryName("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleSaveEdit()} disabled={submitting}>
              {submitting ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Category</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Are you sure you want to delete &quot;{categoryToDelete?.name}&quot;? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={submitting}>
              {submitting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={inUseDialogOpen} onOpenChange={setInUseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Category In Use</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              &quot;{inUseCategoryName}&quot; cannot be deleted because it is currently used by{" "}
              <span className="font-medium text-foreground">{inUseCount ?? 0}</span> job
              {(inUseCount ?? 0) === 1 ? "" : "s"}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setInUseDialogOpen(false)}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

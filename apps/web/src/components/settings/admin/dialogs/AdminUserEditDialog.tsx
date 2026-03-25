"use client";

import { useEffect, useState } from "react";
import { toast } from "@onehash/ui/sonner";
import { Button } from "@onehash/ui/button";
import { SelectField } from "@onehash/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@onehash/ui/dialog";
import { patchAdminMembership, type AdminUserMembershipRow } from "@/api/admin";

const PRODUCT_OPTIONS = [
  { value: "user", label: "User" },
  { value: "admin", label: "Admin" },
];

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "disabled", label: "Disabled" },
];

type AdminUserEditDialogProps = {
  row: AdminUserMembershipRow | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (updated: AdminUserMembershipRow) => void;
};

/** Map membership to a selectable status (invited → active as default target). */
function initialMembershipStatus(row: AdminUserMembershipRow): "active" | "disabled" {
  if (row.status === "disabled") return "disabled";
  return "active";
}

export function AdminUserEditDialog({ row, onOpenChange, onSaved }: AdminUserEditDialogProps) {
  const open = !!row;
  const isOwner = row?.organization_role === "owner";

  const [productRole, setProductRole] = useState<"user" | "admin">("user");
  const [membershipStatus, setMembershipStatus] = useState<"active" | "disabled">("active");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!row) return;
    setProductRole(row.product_role === "admin" ? "admin" : "user");
    setMembershipStatus(initialMembershipStatus(row));
  }, [row]);

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleSave = async () => {
    if (!row) return;

    const patch: Parameters<typeof patchAdminMembership>[1] = {};
    if (productRole !== row.product_role) patch.product_role = productRole;

    if (!isOwner && membershipStatus !== row.status) {
      patch.status = membershipStatus;
    }

    if (Object.keys(patch).length === 0) {
      toast.info("No changes to save");
      return;
    }

    try {
      setSaving(true);
      const updated = await patchAdminMembership(row.membership_id, patch);
      onSaved(updated);
      toast.success("User updated");
      handleClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Update failed";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const statusLabel =
    row?.status === "active"
      ? "Active"
      : row?.status === "invited"
        ? "Invited"
        : row?.status === "disabled"
          ? "Disabled"
          : row?.status ?? "—";

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Edit user</DialogTitle>
          <DialogDescription className="text-xs">
            Update platform access and membership state for this organization.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <SelectField
            label="Platform role"
            value={productRole}
            onValueChange={(v) => setProductRole(v as "user" | "admin")}
            options={PRODUCT_OPTIONS}
          />
          {isOwner ? (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Status</p>
              <p className="text-sm text-foreground rounded-md border border-input bg-muted/30 px-3 py-2">
                {statusLabel}
              </p>
              <p className="text-[11px] text-muted-foreground/70">
                Owner membership cannot be disabled here.
              </p>
            </div>
          ) : (
            <SelectField
              label="Status"
              value={membershipStatus}
              onValueChange={(v) => setMembershipStatus(v as "active" | "disabled")}
              options={STATUS_OPTIONS}
            />
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" className="text-xs h-8" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="text-xs h-8"
            onClick={() => void handleSave()}
            disabled={saving}
            pending={saving}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

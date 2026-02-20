"use client";

import { Button } from "@onehash/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@onehash/ui/dialog";
import { SelectField } from "@onehash/ui/select";
import type { TeamMember } from "@/components/settings/team/TeamMembersList";
import type { Role } from "@/components/settings/team/lib/permissonMatrix";

interface RoleOption {
  role: Role;
  description?: string;
}

interface TeamMemberRoleChangeDialogProps {
  member: TeamMember | null;
  newRole: Role;
  onNewRoleChange: (role: Role) => void;
  roles: RoleOption[];
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function TeamMemberRoleChangeDialog({
  member,
  newRole,
  onNewRoleChange,
  roles,
  onOpenChange,
  onConfirm,
}: TeamMemberRoleChangeDialogProps) {
  return (
    <Dialog open={!!member} onOpenChange={(open) => !open && onOpenChange(false)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Change role</DialogTitle>
          <DialogDescription className="text-xs">Update the role for {member?.name}.</DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <SelectField 
            label="Role"
            value={newRole} 
            onValueChange={(v) => onNewRoleChange(v as Role)} 
            options={roles.map((r) => ({ value: r.role, label: r.role }))} 
          />
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" className="text-xs h-8" onClick={onConfirm}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

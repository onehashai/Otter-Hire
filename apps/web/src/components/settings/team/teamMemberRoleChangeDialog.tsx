"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@onehash/ui";
import type { TeamMember } from "@/components/settings/team/teamMembers";
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
          <Select value={newRole} onValueChange={(v) => onNewRoleChange(v as Role)}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {roles.map((r) => (
                <SelectItem key={r.role} value={r.role} className="text-sm">
                  <span className="font-medium">{r.role}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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

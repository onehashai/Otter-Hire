"use client";

import { useState } from "react";
import {
  Button,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Icon,
} from "@onehash/ui";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { RolesAndPermissionsTable } from "@/components/settings/team/rolesAndPermissionsTable";
import { TeamMembers, type TeamMember } from "@/components/settings/team/teamMembers";
import { TeamInviteModal } from "@/components/settings/team/teamInviteModal";
import { type Role, roles } from "@/components/settings/team/lib/permissonMatrix";

const CURRENT_USER_ID = "1";

const initialMembers: TeamMember[] = [
  { id: "1", name: "Sarah Chen", email: "sarah@acme.com", role: "Owner", status: "Active", lastActive: "Just now" },
  { id: "2", name: "Marcus Johnson", email: "marcus@acme.com", role: "Admin", status: "Active", lastActive: "2 hours ago" },
  { id: "3", name: "Emily Park", email: "emily@acme.com", role: "Recruiter", status: "Active", lastActive: "1 day ago" },
  { id: "4", name: "James Lee", email: "james@acme.com", role: "Hiring Manager", status: "Active", lastActive: "3 hours ago" },
  { id: "5", name: "Nina Patel", email: "nina@acme.com", role: "Interviewer", status: "Pending Invite", lastActive: "—" },
  { id: "6", name: "Alex Rivera", email: "alex@acme.com", role: "Employee", status: "Pending Invite", lastActive: "—" },
];

function getCurrentUserRole(members: TeamMember[]): Role {
  return members.find((m) => m.id === CURRENT_USER_ID)?.role ?? "Employee";
}

export default function TeamSettingsPage() {
  const isMobile = useIsMobile();
  const { toast } = useToast();

  const [members, setMembers] = useState<TeamMember[]>(initialMembers);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<TeamMember | null>(null);
  const [roleChangeTarget, setRoleChangeTarget] = useState<TeamMember | null>(null);
  const [newRole, setNewRole] = useState<Role>("Recruiter");
  const [ownerTransferTarget, setOwnerTransferTarget] = useState<TeamMember | null>(null);

  const currentUserRole = getCurrentUserRole(members);
  const isOwner = currentUserRole === "Owner";
  const isAdmin = currentUserRole === "Admin";

  const handleInvite = (emails: string[], role: Role) => {
    const newMembers: TeamMember[] = emails.map((email) => ({
      id: crypto.randomUUID(),
      name: email.split("@")[0],
      email,
      role,
      status: "Pending Invite",
      lastActive: "—",
    }));
    setMembers((prev) => [...prev, ...newMembers]);
    toast({ title: "Invites sent", description: `${emails.length} invitation(s) sent successfully.` });
  };

  const handleRemove = () => {
    if (!removeTarget) return;
    setMembers((prev) => prev.filter((m) => m.id !== removeTarget.id));
    toast({ title: "Member removed", description: `${removeTarget.name} has been removed from the team.` });
    setRemoveTarget(null);
  };

  const handleRoleChange = () => {
    if (!roleChangeTarget) return;
    if (newRole === "Owner") {
      setOwnerTransferTarget(roleChangeTarget);
      setRoleChangeTarget(null);
      return;
    }
    setMembers((prev) => prev.map((m) => (m.id === roleChangeTarget.id ? { ...m, role: newRole } : m)));
    toast({ title: "Role updated", description: `${roleChangeTarget.name} is now ${newRole}.` });
    setRoleChangeTarget(null);
  };

  const handleOwnerTransfer = () => {
    if (!ownerTransferTarget) return;
    setMembers((prev) =>
      prev.map((m) => {
        if (m.id === ownerTransferTarget.id) return { ...m, role: "Owner" as Role };
        if (m.id === CURRENT_USER_ID && m.role === "Owner") return { ...m, role: "Admin" as Role };
        return m;
      })
    );
    toast({ title: "Ownership transferred", description: `${ownerTransferTarget.name} is now the Owner. You've been set to Admin.` });
    setOwnerTransferTarget(null);
  };

  const handleResendInvite = (member: TeamMember) => {
    toast({ title: "Invite resent", description: `Invitation resent to ${member.email}.` });
  };

  const changeRoles = isOwner ? roles : roles.filter((r) => r.role !== "Owner");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base md:text-lg font-semibold mb-1">Team</h2>
          <p className="text-xs text-muted-foreground">Manage your team members, roles, and permissions.</p>
        </div>
        <Button size="sm" className="text-xs h-9 md:h-8 gap-1.5 shrink-0" onClick={() => setInviteOpen(true)}>
          <Icon name="UserPlus" className="h-3.5 w-3.5" />
          {!isMobile && "Invite Member"}
        </Button>
      </div>

      {/* Members */}
      <TeamMembers
        members={members}
        isMobile={isMobile}
        currentUserId={CURRENT_USER_ID}
        isOwner={isOwner}
        isAdmin={isAdmin}
        onInviteClick={() => setInviteOpen(true)}
        onResendInvite={handleResendInvite}
        onRoleChangeClick={(member) => { setRoleChangeTarget(member); setNewRole(member.role); }}
        onRemoveClick={setRemoveTarget}
      />

      {/* Roles & Permissions */}
      <RolesAndPermissionsTable />

      {/* Invite Modal */}
      <TeamInviteModal
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onSubmit={handleInvite}
      />

      {/* Remove Confirmation */}
      <AlertDialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">Remove team member</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Are you sure you want to remove <span className="font-medium text-foreground">{removeTarget?.name}</span> from the team? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs h-8">Cancel</AlertDialogCancel>
            <AlertDialogAction className="text-xs h-8 bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleRemove}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Role Change Dialog */}
      <Dialog open={!!roleChangeTarget} onOpenChange={(open) => !open && setRoleChangeTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Change role</DialogTitle>
            <DialogDescription className="text-xs">Update the role for {roleChangeTarget?.name}.</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Select value={newRole} onValueChange={(v) => setNewRole(v as Role)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {changeRoles.map((r) => (
                  <SelectItem key={r.role} value={r.role} className="text-sm">
                    <span className="font-medium">{r.role}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => setRoleChangeTarget(null)}>Cancel</Button>
            <Button size="sm" className="text-xs h-8" onClick={handleRoleChange}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ownership Transfer Confirmation */}
      <AlertDialog open={!!ownerTransferTarget} onOpenChange={(open) => !open && setOwnerTransferTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">Transfer ownership</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Are you sure you want to transfer ownership to <span className="font-medium text-foreground">{ownerTransferTarget?.name}</span>? You will be downgraded to Admin. This action requires careful consideration.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs h-8">Cancel</AlertDialogCancel>
            <AlertDialogAction className="text-xs h-8" onClick={handleOwnerTransfer}>Transfer Ownership</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

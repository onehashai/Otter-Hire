"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Button,
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
  Skeleton,
} from "@onehash/ui";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuthSession } from "@/app/providers";
import { RolesAndPermissionsTable } from "@/components/settings/team/rolesAndPermissionsTable";
import { TeamMembers, type TeamMember } from "@/components/settings/team/teamMembers";
import { TeamInviteModal } from "@/components/settings/team/teamInviteModal";
import { type BackendRole, ASSIGNABLE_ROLES, formatRole } from "@/components/settings/team/lib/permissonMatrix";
import {
  getOrgUsers,
  inviteOrgUser,
  updateOrgUserRole,
  removeOrgUser,
  type OrgUserResponse,
} from "@/lib/api";

function mapApiUser(u: OrgUserResponse): TeamMember {
  return {
    id: u.id,
    name: u.name || "",
    email: u.email,
    role: u.role as BackendRole,
    status: u.status,
  };
}

export default function TeamSettingsPage() {
  const isMobile = useIsMobile();
  const { user } = useAuthSession();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [fetchError, setFetchError] = useState("");

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<TeamMember | null>(null);
  const [removing, setRemoving] = useState(false);
  const [roleChangeTarget, setRoleChangeTarget] = useState<TeamMember | null>(null);
  const [newRole, setNewRole] = useState<BackendRole>("recruiter");
  const [savingRole, setSavingRole] = useState(false);

  const currentUserId = user?.id ?? "";
  const currentRole = user?.role ?? "";
  const isOwner = currentRole === "owner";
  const isAdmin = currentRole === "admin";

  const fetchMembers = useCallback(async () => {
    try {
      setFetchError("");
      setPermissionDenied(false);
      const data = await getOrgUsers();
      setMembers(data.map(mapApiUser));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load team members";
      if (message.includes("403") || message.toLowerCase().includes("permission")) {
        setPermissionDenied(true);
      } else {
        setFetchError(message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleInvite = async (email: string) => {
    setInviteSubmitting(true);
    try {
      await inviteOrgUser(email);
      toast.success("Invite sent", { description: `Invitation sent to ${email}.` });
      await fetchMembers();
    } finally {
      setInviteSubmitting(false);
    }
  };

  const handleRemove = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      await removeOrgUser(removeTarget.id);
      toast.success("Member removed", { description: `${removeTarget.name || removeTarget.email} has been removed from the team.` });
      setRemoveTarget(null);
      await fetchMembers();
    } catch (err) {
      toast.error("Failed to remove member", { description: err instanceof Error ? err.message : "An error occurred." });
    } finally {
      setRemoving(false);
    }
  };

  const handleRoleChange = async () => {
    if (!roleChangeTarget) return;
    setSavingRole(true);
    try {
      await updateOrgUserRole(roleChangeTarget.id, newRole);
      toast.success("Role updated", { description: `${roleChangeTarget.name || roleChangeTarget.email} is now ${formatRole(newRole)}.` });
      setRoleChangeTarget(null);
      await fetchMembers();
    } catch (err) {
      toast.error("Failed to update role", { description: err instanceof Error ? err.message : "An error occurred." });
    } finally {
      setSavingRole(false);
    }
  };

  const handleResendInvite = async (member: TeamMember) => {
    try {
      await inviteOrgUser(member.email);
      toast.success("Invite resent", { description: `Invitation resent to ${member.email}.` });
    } catch (err) {
      toast.error("Failed to resend invite", { description: err instanceof Error ? err.message : "An error occurred." });
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Skeleton className="h-6 w-24 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (permissionDenied) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-base md:text-lg font-semibold mb-1">Team</h2>
          <p className="text-xs text-muted-foreground">Manage your team members, roles, and permissions.</p>
        </div>
        <div className="py-16 text-center space-y-3">
          <Icon name="Shield" className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">You don&apos;t have permission to manage team members.</p>
          <p className="text-xs text-muted-foreground">Contact your organization owner or admin for access.</p>
        </div>
        <RolesAndPermissionsTable />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-base md:text-lg font-semibold mb-1">Team</h2>
          <p className="text-xs text-muted-foreground">Manage your team members, roles, and permissions.</p>
        </div>
        <div className="py-16 text-center space-y-3">
          <Icon name="CircleAlert" className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{fetchError}</p>
          <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => { setLoading(true); fetchMembers(); }}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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

      <TeamMembers
        members={members}
        isMobile={isMobile}
        currentUserId={currentUserId}
        isOwner={isOwner}
        isAdmin={isAdmin}
        onInviteClick={() => setInviteOpen(true)}
        onResendInvite={handleResendInvite}
        onRoleChangeClick={(member) => { setRoleChangeTarget(member); setNewRole(member.role === "owner" ? "admin" : member.role); }}
        onRemoveClick={setRemoveTarget}
      />

      <RolesAndPermissionsTable />

      <TeamInviteModal
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onSubmit={handleInvite}
        isSubmitting={inviteSubmitting}
      />

      <AlertDialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">Remove team member</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Are you sure you want to remove <span className="font-medium text-foreground">{removeTarget?.name || removeTarget?.email}</span> from the team? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs h-8" disabled={removing}>Cancel</AlertDialogCancel>
            <AlertDialogAction className="text-xs h-8 bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleRemove} disabled={removing}>
              {removing ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!roleChangeTarget} onOpenChange={(open) => !open && setRoleChangeTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Change role</DialogTitle>
            <DialogDescription className="text-xs">Update the role for {roleChangeTarget?.name || roleChangeTarget?.email}.</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Select value={newRole} onValueChange={(v) => setNewRole(v as BackendRole)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSIGNABLE_ROLES.map((r) => (
                  <SelectItem key={r.role} value={r.role} className="text-sm">
                    <span className="font-medium">{r.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => setRoleChangeTarget(null)} disabled={savingRole}>Cancel</Button>
            <Button size="sm" className="text-xs h-8" onClick={handleRoleChange} disabled={savingRole}>
              {savingRole ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

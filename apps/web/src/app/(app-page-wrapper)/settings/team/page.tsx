"use client";


import { useState, useEffect, useCallback } from "react";
import { toast } from "@onehash/ui/sonner";
import { Button } from "@onehash/ui/button";
import { Icon } from "@onehash/ui/icon";
import { Skeleton } from "@onehash/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuthSession } from "@/app/providers";
import { RolesAndPermissionsTable } from "@/components/settings/team/rolesAndPermissionsTable";
import {
  TeamMember,
  TeamMembersList as TeamMembers,
} from "@/components/settings/team/TeamMembersList";
import { TeamInviteModal } from "@/components/settings/team/teamInviteModal";
import {
  type BackendRole,
  ASSIGNABLE_ROLES,
  formatRole,
} from "@/components/settings/team/lib/permissonMatrix";
import {
  getOrgUsers,
  inviteOrgUser,
  updateOrgUserRole,
  removeOrgUser,
  type OrgUserResponse,
} from "@/api";
import { TeamMemberRoleChangeDialog } from "@/components/settings/team/teamMemberRoleChangeDialog";
import { TeamMemberRemoveDialog } from "@/components/settings/team/teamMemberRemoveDialog";
import { TeamOwnershipTransferDialog } from "@/components/settings/team/teamOwnershipTransferDialog";
import { useTranslation } from "react-i18next";

function mapApiUser(u: OrgUserResponse): TeamMember {
  return {
    id: u.id,
    name: u.name || "",
    email: u.email,
    role: u.role as BackendRole,
    status: u.status,
    avatar_url: u.avatar_url ?? null,
  };
}

export default function TeamSettingsPage() {
  const { t } = useTranslation();
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
  const [ownershipTransferTarget, setOwnershipTransferTarget] = useState<TeamMember | null>(null);

  const currentUserId = user?.id ?? "";
  const currentRole = user?.membership_role ?? "";
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

  const handleInvite = async (emails: string[], role: BackendRole) => {
    setInviteSubmitting(true);
    try {
      const results = await Promise.allSettled(emails.map((email) => inviteOrgUser(email, role)));
      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;

      if (succeeded > 0) {
        toast.success(succeeded === 1 ? t("invite_sent") : t("invite_sent"), {
          description: `Invitation${succeeded > 1 ? "s" : ""} sent with role ${formatRole(role)}.`,
        });
      }
      if (failed > 0) {
        toast.error(t("invite_failed"), {
          description: "Some invitations could not be sent.",
        });
      }
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
      toast.success(t("member_removed"), {
        description: `${removeTarget.name || removeTarget.email} has been removed from the team.`,
      });
      setRemoveTarget(null);
      await fetchMembers();
    } catch (err) {
      toast.error(t("member_remove_failed"), {
        description: err instanceof Error ? err.message : "An error occurred.",
      });
    } finally {
      setRemoving(false);
    }
  };

  const handleRoleChange = async () => {
    if (!roleChangeTarget) return;
    setSavingRole(true);
    try {
      await updateOrgUserRole(roleChangeTarget.id, newRole);
      toast.success(t("role_updated"), {
        description: `${roleChangeTarget.name || roleChangeTarget.email} is now ${formatRole(newRole)}.`,
      });
      setRoleChangeTarget(null);
      await fetchMembers();
    } catch (err) {
      toast.error(t("role_update_failed"), {
        description: err instanceof Error ? err.message : "An error occurred.",
      });
    } finally {
      setSavingRole(false);
    }
  };

  const handleResendInvite = async (member: TeamMember) => {
    try {
      await inviteOrgUser(member.email);
      toast.success(t("invite_resent"), { description: `Invitation resent to ${member.email}.` });
    } catch (err) {
      toast.error(t("invite_resend_failed"), {
        description: err instanceof Error ? err.message : "An error occurred.",
      });
    }
  };

  const handleOwnershipTransfer = async () => {
    if (!ownershipTransferTarget) return;
    try {
      await updateOrgUserRole(ownershipTransferTarget.id, "owner");
      toast.success(t("ownership_transferred"), {
        description: `${ownershipTransferTarget.name || ownershipTransferTarget.email} is now the owner.`,
      });
      setOwnershipTransferTarget(null);
      await fetchMembers();
    } catch (err) {
      toast.error(t("ownership_transfer_failed"), {
        description: err instanceof Error ? err.message : "An error occurred.",
      });
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
          <h2 className="text-base md:text-lg font-semibold mb-1">{t("team")}</h2>
          <p className="text-xs text-muted-foreground">
            {t("manage_your_team_members_roles_and_permissions")}
          </p>
        </div>
        <div className="py-16 text-center space-y-3">
          <Icon name="Shield" className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            You don&apos;t have permission to manage team members.
          </p>
          <p className="text-xs text-muted-foreground">
            Contact your organization owner or admin for access.
          </p>
        </div>
        <RolesAndPermissionsTable />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-base md:text-lg font-semibold mb-1">{t("team")}</h2>
          <p className="text-xs text-muted-foreground">
            {t("manage_your_team_members_roles_and_permissions")}
          </p>
        </div>
        <div className="py-16 text-center space-y-3">
          <Icon name="CircleAlert" className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{fetchError}</p>
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-8"
            onClick={() => {
              setLoading(true);
              fetchMembers();
            }}
          >
            {t("try_again")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base md:text-lg font-semibold mb-1">{t("team")}</h2>
          <p className="text-xs text-muted-foreground">
            {t("manage_your_team_members_roles_and_permissions")}
          </p>
        </div>
        <Button
          size="sm"
          className="text-xs h-9 md:h-8 gap-1.5 shrink-0"
          onClick={() => setInviteOpen(true)}
        >
          <Icon name="UserPlus" className="h-3.5 w-3.5" />
          {!isMobile && t("invite_member")}
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
        onRoleChangeClick={(member) => {
          setRoleChangeTarget(member);
          setNewRole(member.role === "owner" ? "admin" : member.role);
        }}
        onRemoveClick={setRemoveTarget}
      />

      <RolesAndPermissionsTable />

      <TeamInviteModal
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onSubmit={handleInvite}
        isSubmitting={inviteSubmitting}
      />

      <TeamMemberRemoveDialog
        member={removeTarget}
        onOpenChange={() => setRemoveTarget(null)}
        onConfirm={handleRemove}
      />

      <TeamMemberRoleChangeDialog
        member={roleChangeTarget}
        newRole={newRole}
        onNewRoleChange={setNewRole}
        roles={ASSIGNABLE_ROLES}
        onOpenChange={() => setRoleChangeTarget(null)}
        onConfirm={handleRoleChange}
      />

      <TeamOwnershipTransferDialog
        member={ownershipTransferTarget}
        onOpenChange={() => setOwnershipTransferTarget(null)}
        onConfirm={handleOwnershipTransfer}
      />
    </div>
  );
}

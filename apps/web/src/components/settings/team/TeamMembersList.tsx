"use client";

import { Card, CardContent } from "@onehash/ui/card";
import { Button } from "@onehash/ui/button";
import { Badge } from "@onehash/ui/badge";
import { Avatar } from "@onehash/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@onehash/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@onehash/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@onehash/ui/tooltip";
import { Icon } from "@onehash/ui/icon";
import { cn } from "@/lib/utils";
import { getInitialsFromName } from "@/lib/name-initials";
import { type BackendRole, formatRole } from "@/components/settings/team/lib/permissonMatrix";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: BackendRole;
  status: string;
  avatar_url?: string | null;
}

const roleBadgeClass: Record<BackendRole, string> = {
  owner: "bg-foreground text-background",
  admin: "bg-foreground/80 text-background",
  recruiter: "bg-muted text-foreground",
  hiring_manager: "bg-muted text-foreground",
  interviewer: "bg-muted text-muted-foreground",
  employee: "bg-muted text-muted-foreground",
};

function roleBadgeClassFor(role: string): string {
  if (role in roleBadgeClass) return roleBadgeClass[role as BackendRole];
  return "bg-muted text-foreground";
}

function formatStatus(status: string): { label: string; active: boolean } {
  if (status === "active") return { label: "Active", active: true };
  if (status === "pending") return { label: "Pending", active: false };
  if (status === "declined") return { label: "Declined", active: false };
  return { label: status, active: false };
}

interface TeamMembersProps {
  members: TeamMember[];
  isMobile: boolean;
  currentUserId: string;
  isOwner: boolean;
  isAdmin: boolean;
  onInviteClick: () => void;
  onResendInvite: (member: TeamMember) => void;
  onRoleChangeClick: (member: TeamMember) => void;
  onRemoveClick: (member: TeamMember) => void;
}

function canChangeRole(
  target: TeamMember,
  currentUserId: string,
  isOwner: boolean,
  isAdmin: boolean,
): { allowed: boolean; reason?: string } {
  if (target.id === currentUserId)
    return { allowed: false, reason: "You cannot change your own role." };
  if (target.role === "owner") return { allowed: false, reason: "Owner role cannot be changed." };
  if (target.role === "admin" && !isOwner)
    return { allowed: false, reason: "Only the Owner can modify Admin roles." };
  if (!isOwner && !isAdmin)
    return { allowed: false, reason: "You don't have permission to change roles." };
  return { allowed: true };
}

function canRemove(
  target: TeamMember,
  currentUserId: string,
  isOwner: boolean,
  isAdmin: boolean,
): { allowed: boolean; reason?: string } {
  if (target.id === currentUserId) return { allowed: false, reason: "You cannot remove yourself." };
  if (target.role === "owner") return { allowed: false, reason: "The Owner cannot be removed." };
  if (target.role === "admin" && !isOwner)
    return { allowed: false, reason: "Only the Owner can remove Admins." };
  if (!isOwner && !isAdmin)
    return { allowed: false, reason: "You don't have permission to remove members." };
  return { allowed: true };
}

export function TeamMembersList({
  members,
  isMobile,
  currentUserId,
  isOwner,
  isAdmin,
  onInviteClick,
  onResendInvite,
  onRoleChangeClick,
  onRemoveClick,
}: TeamMembersProps) {
  const MemberActions = ({ member }: { member: TeamMember }) => {
    const roleCheck = canChangeRole(member, currentUserId, isOwner, isAdmin);
    const removeCheck = canRemove(member, currentUserId, isOwner, isAdmin);
    const isPending = member.status === "pending";

    return (
      <TooltipProvider delayDuration={200}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Icon name="MoreHorizontal" className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {roleCheck.allowed ? (
              <DropdownMenuItem onClick={() => onRoleChangeClick(member)}>
                Change role
              </DropdownMenuItem>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="relative flex cursor-not-allowed select-none items-center rounded-sm px-2 py-1.5 text-sm text-muted-foreground/50">
                    Change role
                  </div>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p className="text-xs">{roleCheck.reason}</p>
                </TooltipContent>
              </Tooltip>
            )}
            {isPending && (
              <DropdownMenuItem onClick={() => onResendInvite(member)}>
                Resend invite
              </DropdownMenuItem>
            )}
            {removeCheck.allowed ? (
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onRemoveClick(member)}
              >
                Remove from team
              </DropdownMenuItem>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="relative flex cursor-not-allowed select-none items-center rounded-sm px-2 py-1.5 text-sm text-muted-foreground/50">
                    Remove from team
                  </div>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p className="text-xs">{removeCheck.reason}</p>
                </TooltipContent>
              </Tooltip>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </TooltipProvider>
    );
  };

  return (
    <Card>
      <CardContent className="p-0">
        {members.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <Icon name="Users" className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No team members yet</p>
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-8 gap-1.5"
              onClick={onInviteClick}
            >
              <Icon name="Plus" className="h-3.5 w-3.5" /> Invite your first team member
            </Button>
          </div>
        ) : isMobile ? (
          <div className="divide-y">
            {members.map((m) => {
              const st = formatStatus(m.status);
              return (
                <div key={m.id} className="p-4 flex items-start gap-3">
                  <Avatar
                    className="h-9 w-9 shrink-0"
                    src={m.avatar_url}
                    alt={m.name || m.email}
                    fallbackClassName="text-xs bg-muted"
                  >
                    {getInitialsFromName(m.name)}
                  </Avatar>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium truncate">{m.name || m.email}</p>
                      <MemberActions member={m} />
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-[10px] px-2 py-0 h-5 font-medium border-0",
                          roleBadgeClassFor(m.role),
                        )}
                        title={formatRole(m.role)}
                      >
                        {formatRole(m.role)}
                      </Badge>
                      {!st.active && (
                        <span className="text-[10px] text-muted-foreground italic">{st.label}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs font-medium h-10">Member</TableHead>
                <TableHead className="text-xs font-medium h-10">Role</TableHead>
                <TableHead className="text-xs font-medium h-10">Status</TableHead>
                <TableHead className="text-xs font-medium h-10 w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => {
                const st = formatStatus(m.status);
                return (
                  <TableRow key={m.id} className="group">
                    <TableCell className="py-3">
                      <div className="flex items-center gap-3">
                        <Avatar
                          className="h-8 w-8"
                          src={m.avatar_url}
                          alt={m.name || m.email}
                          fallbackClassName="text-xs bg-muted"
                        >
                          {getInitialsFromName(m.name)}
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{m.name || m.email}</p>
                          <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-[10px] px-2 py-0 h-5 font-medium border-0 truncate max-w-full min-w-0",
                          roleBadgeClassFor(m.role),
                        )}
                        title={formatRole(m.role)}
                      >
                        {formatRole(m.role)}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            st.active ? "bg-foreground" : "bg-muted-foreground/40",
                          )}
                        />
                        <span className="text-xs text-muted-foreground">{st.label}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <MemberActions member={m} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

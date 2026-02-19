"use client";

import {
  Card,
  CardContent,
  Button,
  Badge,
  Avatar,
  AvatarFallback,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  Icon,
} from "@onehash/ui";
import { cn } from "@/lib/utils";
import { type Role } from "@/components/settings/team/lib/permissonMatrix";

export type Status = "Active" | "Pending" | "Pending Invite";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: Status;
  lastActive: string;
}

const roleBadgeClass: Record<Role, string> = {
  Owner: "bg-foreground text-background",
  Admin: "bg-foreground/80 text-background",
  Recruiter: "bg-muted text-foreground",
  "Hiring Manager": "bg-muted text-foreground",
  Interviewer: "bg-muted text-muted-foreground",
  Employee: "bg-muted text-muted-foreground",
};

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
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
  isAdmin: boolean
): { allowed: boolean; reason?: string } {
  if (target.id === currentUserId) return { allowed: false, reason: "You cannot change your own role." };
  if (target.role === "Owner" && !isOwner) return { allowed: false, reason: "Only the Owner can change the Owner role." };
  if (target.role === "Admin" && !isOwner) return { allowed: false, reason: "Only the Owner can modify Admin roles." };
  if (!isOwner && !isAdmin) return { allowed: false, reason: "You don't have permission to change roles." };
  return { allowed: true };
}

function canRemove(
  target: TeamMember,
  currentUserId: string,
  isOwner: boolean,
  isAdmin: boolean
): { allowed: boolean; reason?: string } {
  if (target.id === currentUserId) return { allowed: false, reason: "You cannot remove yourself." };
  if (target.role === "Owner") return { allowed: false, reason: "The Owner cannot be removed." };
  if (target.role === "Admin" && !isOwner) return { allowed: false, reason: "Only the Owner can remove Admins." };
  if (!isOwner && !isAdmin) return { allowed: false, reason: "You don't have permission to remove members." };
  return { allowed: true };
}

export function TeamMembers({
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
                <TooltipContent side="left"><p className="text-xs">{roleCheck.reason}</p></TooltipContent>
              </Tooltip>
            )}
            {member.status === "Pending Invite" && (
              <DropdownMenuItem onClick={() => onResendInvite(member)}>Resend invite</DropdownMenuItem>
            )}
            {removeCheck.allowed ? (
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onRemoveClick(member)}>
                Remove from team
              </DropdownMenuItem>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="relative flex cursor-not-allowed select-none items-center rounded-sm px-2 py-1.5 text-sm text-muted-foreground/50">
                    Remove from team
                  </div>
                </TooltipTrigger>
                <TooltipContent side="left"><p className="text-xs">{removeCheck.reason}</p></TooltipContent>
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
            <Button size="sm" variant="outline" className="text-xs h-8 gap-1.5" onClick={onInviteClick}>
              <Icon name="Plus" className="h-3.5 w-3.5" /> Invite your first team member
            </Button>
          </div>
        ) : isMobile ? (
          <div className="divide-y">
            {members.map((m) => (
              <div key={m.id} className="p-4 flex items-start gap-3">
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarFallback className="text-xs bg-muted">{getInitials(m.name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium truncate">{m.name}</p>
                    <MemberActions member={m} />
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <Badge variant="secondary" className={cn("text-[10px] px-2 py-0 h-5 font-medium border-0", roleBadgeClass[m.role])} title={m.role}>
                      {m.role}
                    </Badge>
                    {m.status === "Pending Invite" && (
                      <span className="text-[10px] text-muted-foreground italic">Pending</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs font-medium h-10">Member</TableHead>
                <TableHead className="text-xs font-medium h-10">Role</TableHead>
                <TableHead className="text-xs font-medium h-10">Status</TableHead>
                <TableHead className="text-xs font-medium h-10">Last active</TableHead>
                <TableHead className="text-xs font-medium h-10 w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.id} className="group">
                  <TableCell className="py-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs bg-muted">{getInitials(m.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{m.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    <Badge variant="secondary" className={cn("text-[10px] px-2 py-0 h-5 font-medium border-0 truncate max-w-full min-w-0", roleBadgeClass[m.role])} title={m.role}>
                      {m.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="flex items-center gap-1.5">
                      <span className={cn("h-1.5 w-1.5 rounded-full", m.status === "Active" ? "bg-foreground" : "bg-muted-foreground/40")} />
                      <span className="text-xs text-muted-foreground">{m.status}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    <span className="text-xs text-muted-foreground">{m.lastActive}</span>
                  </TableCell>
                  <TableCell className="py-3">
                    <MemberActions member={m} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

"use client";

import { useState } from "react";
import {
  Button,
  InputField,
  Separator,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@onehash/ui";
import { Plus, X, Search, Users } from "lucide-react";
import { useJobSetup } from "../context";
import { mockWorkspaceUsers, teamRoleLabels, type TeamRole } from "../constants";
import { useIsMobile } from "@/hooks/use-mobile";

export default function HiringTeamPage() {
  const isMobile = useIsMobile();
  const {
    teamMembers,
    addTeamMember,
    removeTeamMember,
    updateTeamMemberRole,
  } = useJobSetup();
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedNewMemberRole, setSelectedNewMemberRole] = useState<TeamRole>("interviewer");

  const filteredUsers = mockWorkspaceUsers.filter(
    (u) =>
      !teamMembers.some((m) => m.id === u.id) &&
      (u.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
        u.email.toLowerCase().includes(memberSearch.toLowerCase()))
  );

  const addTeamMemberFromUser = (user: (typeof mockWorkspaceUsers)[0]) => {
    addTeamMember({
      id: user.id,
      name: user.name,
      email: user.email,
      role: selectedNewMemberRole,
    });
    setMemberSearch("");
    setSelectedNewMemberRole("interviewer");
    setAddMemberOpen(false);
  };

  const AddMemberContent = () => (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <InputField
          value={memberSearch}
          onChange={(e) => setMemberSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="h-9 text-sm pl-9"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Assign role</label>
        <Select
          value={selectedNewMemberRole}
          onValueChange={(v) => setSelectedNewMemberRole(v as TeamRole)}
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.entries(teamRoleLabels) as [TeamRole, string][]).map(([val, label]) => (
              <SelectItem key={val} value={val}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Separator />
      <div className="space-y-1 max-h-[240px] overflow-y-auto">
        {filteredUsers.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">No matching users found.</p>
        ) : (
          filteredUsers.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => addTeamMemberFromUser(user)}
              className="w-full flex items-center gap-3 rounded-lg p-2.5 text-left hover:bg-muted/50 transition-colors"
            >
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground shrink-0">
                {user.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{user.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
              <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Define who is responsible for this job&apos;s hiring process.
        </p>
        {teamMembers.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setAddMemberOpen(true)}
          >
            <Plus className="h-3 w-3" /> Add Member
          </Button>
        )}
      </div>

      {teamMembers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 rounded-lg border border-dashed border-border bg-muted/20">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
            <Users className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground mb-1">No team members added yet.</p>
          <p className="text-xs text-muted-foreground/70 mb-4">
            Add recruiters, interviewers, and coordinators.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="text-xs gap-1.5"
            onClick={() => setAddMemberOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" /> Add Team Member
          </Button>
        </div>
      ) : (
        <div className="space-y-0 rounded-lg border border-border overflow-hidden">
          {teamMembers.map((member, i) => (
            <div key={member.id}>
              {i > 0 && <Separator />}
              <div className="flex items-center gap-3 px-4 py-3 bg-card">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground shrink-0">
                  {member.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{member.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                </div>
                <Select
                  value={member.role}
                  onValueChange={(v) => updateTeamMemberRole(member.id, v as TeamRole)}
                >
                  <SelectTrigger className="h-7 w-[130px] text-[11px] border-border bg-card shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {(Object.entries(teamRoleLabels) as [TeamRole, string][]).map(([val, label]) => (
                      <SelectItem key={val} value={val} className="text-xs">
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={() => removeTeamMember(member.id)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isMobile ? (
        <Sheet open={addMemberOpen} onOpenChange={setAddMemberOpen}>
          <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl">
            <SheetHeader>
              <SheetTitle className="text-base">Add Team Member</SheetTitle>
              <SheetDescription className="text-xs">
                Search and select a workspace member.
              </SheetDescription>
            </SheetHeader>
            <div className="mt-4 pb-4">
              <AddMemberContent />
            </div>
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Team Member</DialogTitle>
            </DialogHeader>
            <AddMemberContent />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

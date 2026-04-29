"use client";

import { useMemo, useState, useEffect } from "react";
import { Button } from "@onehash/ui/button";
import { Badge } from "@onehash/ui/badge";
import { InputField } from "@onehash/ui/input";
import { Separator } from "@onehash/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@onehash/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@onehash/ui/dialog";
import { Avatar } from "@onehash/ui/avatar";
import { Plus, X, Search, Users } from "lucide-react";
import { useJobSetup } from "../context";
import { type TeamRoleType } from "../constants";
import { getOrgUsers, type OrgUserResponse } from "@/api";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "@onehash/ui/sonner";
import { getInitialsFromName } from "@/lib/name-initials";
import { TruncatedText } from "@/components/common/TruncatedText";
import { useTranslation } from "react-i18next";

export default function HiringTeamPage() {
  const isMobile = useIsMobile();
  const { teamMembers, addTeamMember, removeTeamMember } = useJobSetup();
  const { t } = useTranslation();
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [orgUsers, setOrgUsers] = useState<OrgUserResponse[]>([]);

  useEffect(() => {
    getOrgUsers()
      .then(setOrgUsers)
      .catch(() => {
        toast.error(t("load_org_users_failed"));
      });
  }, [t]);

  const formatRoleLabel = (role?: string | null) =>
    role ? role.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase()) : "Member";

  const mapUserRoleToTeamRole = (role: string): TeamRoleType => {
    if (
      role === "recruiter" ||
      role === "hiring_manager" ||
      role === "interviewer" ||
      role === "coordinator"
    ) {
      return role;
    }
    return "recruiter";
  };

  const filteredUsers = useMemo(
    () =>
      orgUsers.filter(
        (u) =>
          !teamMembers.some((m) => m.user_id === u.id) &&
          ((u.name ?? "").toLowerCase().includes(memberSearch.toLowerCase()) ||
            u.email.toLowerCase().includes(memberSearch.toLowerCase())),
      ),
    [orgUsers, teamMembers, memberSearch],
  );

  const addTeamMemberFromUser = (user: OrgUserResponse) => {
    addTeamMember({
      id: user.id,
      user_id: user.id,
      name: user.name ?? user.email.split("@")[0] ?? "Unknown User",
      email: user.email,
      role: mapUserRoleToTeamRole(user.role),
      userRole: user.role,
      avatar_url: user.avatar_url ?? null,
    });
    setMemberSearch("");
    setAddMemberOpen(false);
  };

  const AddMemberContent = () => (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <InputField
          value={memberSearch}
          onChange={(e) => setMemberSearch(e.target.value)}
          placeholder={t("search_name_email")}
          className="h-9 text-sm pl-9"
        />
      </div>
      <Separator />
      <div className="space-y-1 max-h-[240px] overflow-y-auto">
        {filteredUsers.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">{t("no_matching_users")}</p>
        ) : (
          filteredUsers.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => addTeamMemberFromUser(user)}
              className="w-full flex items-center gap-3 rounded-lg p-2.5 text-left hover:bg-muted/50 transition-colors"
            >
              <Avatar
                className="h-8 w-8 shrink-0"
                src={user.avatar_url}
                alt={user.name ?? user.email}
                fallbackClassName="text-xs font-medium text-muted-foreground bg-muted"
              >
                {user.name ? getInitialsFromName(user.name, "U") : "U"}
              </Avatar>
              <div className="min-w-0 flex-1">
                <TruncatedText as="p" className="text-sm font-medium">
                  {user.name ?? user.email}
                </TruncatedText>
                <TruncatedText as="p" className="text-xs text-muted-foreground">
                  {user.email}
                </TruncatedText>
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
        <p className="text-xs text-muted-foreground">{t("define_hiring_process")}</p>
        {teamMembers.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setAddMemberOpen(true)}
          >
            <Plus className="h-3 w-3" /> {t("add_member")}
          </Button>
        )}
      </div>

      {teamMembers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 rounded-lg border border-dashed border-border bg-muted/20">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
            <Users className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground mb-1">{t("no_team_members_added")}</p>
          <p className="text-xs text-muted-foreground/70 mb-4">
            {t("add_hiring_team_description")}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="text-xs gap-1.5"
            onClick={() => setAddMemberOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" /> {t("add_team_member")}
          </Button>
        </div>
      ) : (
        <div className="space-y-0 rounded-lg border border-border overflow-hidden">
          {teamMembers.map((member, i) => (
            <div key={member.id}>
              {i > 0 && <Separator />}
              <div className="flex items-center gap-3 px-4 py-3 bg-card">
                <Avatar
                  className="h-8 w-8 shrink-0"
                  src={member.avatar_url}
                  alt={member.name}
                  fallbackClassName="text-xs font-medium text-muted-foreground bg-muted"
                >
                  {getInitialsFromName(member.name)}
                </Avatar>
                <TruncatedText as="p" className="flex-1 min-w-0 text-sm font-medium">
                  {member.name}
                </TruncatedText>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={() => removeTeamMember(member.id)}
                  tooltip={t("tooltip_remove_member")}
                  tooltipContentProps={{ side: "left" }}
                  aria-label={`Remove ${member.name}`}
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
              <SheetTitle className="text-base">{t("add_team_member")}</SheetTitle>
              <SheetDescription className="text-xs">{t("search_org_member")}</SheetDescription>
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
              <DialogTitle>{t("add_team_member")}</DialogTitle>
            </DialogHeader>
            <AddMemberContent />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

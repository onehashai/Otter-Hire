"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@onehash/ui/icon";
import {
  createOrganization,
  getOrganizationMemberships,
  logout,
  switchOrganization,
  type OrganizationMembership,
} from "@/api/index";
import { useAuthSession } from "@/app/providers";
import { usePageMetadata } from "@/contexts/PageMetadataContext";
import { Avatar } from "@onehash/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@onehash/ui/dropdown-menu";
import { Button } from "@onehash/ui/button";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@onehash/ui/dialog";
import { InputField } from "@onehash/ui/input";
import { getPersonNameInitials } from "@/lib/name-initials";
import { LOGO_SVG_PATH, PLATFORM_NAME } from "@/lib/constants";

const EXPLICIT_LOGOUT_KEY = "explicit_logout";

export function TopBar() {
  const router = useRouter();
  const { user, clearSession, refreshSession } = useAuthSession();
  const { metadata } = usePageMetadata();
  const { t } = useTranslation();
  const [createOpen, setCreateOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [memberships, setMemberships] = useState<OrganizationMembership[]>([]);
  const [menuLoadingMemberships, setMenuLoadingMemberships] = useState(false);
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [switchingOrgId, setSwitchingOrgId] = useState<string | null>(null);
  const [orgError, setOrgError] = useState<string | null>(null);

  const loadMemberships = async () => {
    setMenuLoadingMemberships(true);
    setOrgError(null);
    try {
      const list = await getOrganizationMemberships();
      setMemberships(list);
    } catch (err) {
      setOrgError(err instanceof Error ? err.message : "Failed to load organizations.");
    } finally {
      setMenuLoadingMemberships(false);
    }
  };

  useEffect(() => {
    void loadMemberships();
  }, []);

  const handleMenuOpenChange = (open: boolean) => {
    if (open) {
      void loadMemberships();
    }
  };

  const handleSwitchOrganization = async (orgId: string) => {
    if (orgId === user?.org_id) {
      return;
    }
    setSwitchingOrgId(orgId);
    setOrgError(null);
    try {
      await switchOrganization(orgId);
      await refreshSession(true);
      localStorage.setItem("session_updated", Date.now().toString());
      // TODO(mvp-nav): Restore SPA redirect after MVP launch.
      // router.replace("/dashboard");
      // router.refresh();
      // Force full app reload so all org-scoped pages/data refresh immediately.
      window.location.assign("/");
    } catch (err) {
      setOrgError(err instanceof Error ? err.message : "Failed to switch organization.");
    } finally {
      setSwitchingOrgId(null);
    }
  };

  const handleCreateOrganization = async () => {
    const name = newOrgName.trim();
    if (!name) return;
    setCreatingOrg(true);
    setOrgError(null);
    try {
      await createOrganization(name);
      await refreshSession(true);
      localStorage.setItem("session_updated", Date.now().toString());
      setCreateOpen(false);
      setNewOrgName("");
      await loadMemberships();
      // TODO(mvp-nav): Restore SPA redirect after MVP launch.
      // router.replace("/dashboard");
      // router.refresh();
      // Force full app reload so newly switched org context is reflected everywhere.
      window.location.assign("/");
    } catch (err) {
      setOrgError(err instanceof Error ? err.message : "Failed to create organization.");
    } finally {
      setCreatingOrg(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      sessionStorage.setItem(EXPLICIT_LOGOUT_KEY, "true");
      clearSession();
      router.replace("/login");
    }
  };

  const userLabel = (user?.name?.trim() || user?.email || "").trim() || "Account";
  const initialsSource = user?.name?.trim() || user?.email;
  const initials = getPersonNameInitials(initialsSource, "U");
  const orgDisplayName = (user?.org_name?.trim() || t("nav_organization")).trim();

  return (
    <header className="sticky top-0 z-10 flex h-12 md:h-[49px] shrink-0 items-center justify-between gap-2 border-b border-border bg-background px-4 md:px-6">
      <div className="flex min-w-0 flex-1 items-center pr-2 md:pr-3">
        <Link href="/" className="-ml-2 flex items-center md:ml-0 md:hidden">
          <Image
            src={LOGO_SVG_PATH}
            alt={PLATFORM_NAME}
            width={90}
            height={20}
            className="object-contain dark:invert dark:contrast-200"
            priority
          />
        </Link>
        <div className="hidden min-w-0 flex-1 flex-col justify-center md:flex">
          <h1 className="break-words text-sm font-semibold leading-snug text-foreground">
            {metadata.title}
          </h1>
          {metadata.subtitle && (
            <p className="mt-0.5 break-words text-xs leading-snug text-muted-foreground md:line-clamp-none">
              {metadata.subtitle}
            </p>
          )}
        </div>
      </div>

      <DropdownMenu onOpenChange={handleMenuOpenChange}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-8 w-8 shrink-0 gap-0 p-0 justify-center md:h-8 md:w-auto md:max-w-[12rem] md:gap-2 md:px-2 md:justify-start"
            aria-label={userLabel}
          >
            <Avatar
              key={`${user?.id ?? ""}-${user?.avatar_url ?? ""}`}
              className="h-6 w-6 border border-border shrink-0"
              src={user?.avatar_url ?? undefined}
              alt={userLabel}
              fallbackClassName="text-[10px] bg-muted text-muted-foreground"
            >
              {initials}
            </Avatar>
            <div className="hidden min-w-0 flex-1 flex-col items-start md:flex">
              <span className="max-w-full truncate text-xs font-medium text-foreground">
                {userLabel}
              </span>
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[14rem] w-56">
          <div className="flex items-center gap-2 px-2 py-1.5">
            {user?.org_avatar_url ? (
              <Avatar
                className="h-6 w-6 shrink-0 border border-border"
                src={user.org_avatar_url}
                alt={orgDisplayName}
                fallbackClassName="text-[10px] bg-muted text-muted-foreground"
              >
                {getPersonNameInitials(orgDisplayName, "O")}
              </Avatar>
            ) : (
              <Image
                src={LOGO_SVG_PATH}
                alt=""
                width={20}
                height={20}
                className="h-5 w-auto shrink-0 object-contain dark:invert dark:contrast-200"
              />
            )}
            <span
              className="min-w-0 flex-1 truncate text-sm text-foreground"
              title={orgDisplayName}
            >
              {orgDisplayName}
            </span>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger asChild hideChevron>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  aria-label={t("switch_organization")}
                >
                  <Icon name="ArrowRightLeft" className="h-4 w-4" />
                </Button>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-64" alignOffset={-4}>
                <DropdownMenuItem className="cursor-pointer" onClick={() => setCreateOpen(true)}>
                  <Icon name="Plus" className="mr-2 h-4 w-4" />
                  {t("new_organization")}
                </DropdownMenuItem>
                {memberships.length > 1 &&
                  (menuLoadingMemberships ? (
                    <DropdownMenuItem disabled>
                      <Icon name="Loader" className="mr-2 h-4 w-4 animate-spin" />
                      {t("loading_organizations")}
                    </DropdownMenuItem>
                  ) : (
                    memberships.map((membership) => {
                      const isCurrent = membership.org_id === user?.org_id;
                      const isSwitching = switchingOrgId === membership.org_id;
                      return (
                        <DropdownMenuItem
                          key={membership.org_id}
                          onClick={() => handleSwitchOrganization(membership.org_id)}
                          disabled={Boolean(switchingOrgId) || isCurrent}
                          className="cursor-pointer flex items-center justify-between gap-2"
                        >
                          <span className="truncate">{membership.org_name}</span>
                          {isCurrent ? (
                            <span className="text-[10px] rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                              {t("current_org_badge")}
                            </span>
                          ) : isSwitching ? (
                            <Icon
                              name="Loader"
                              className="h-3.5 w-3.5 animate-spin text-muted-foreground"
                            />
                          ) : null}
                        </DropdownMenuItem>
                      );
                    })
                  ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </div>
          <DropdownMenuItem
            onClick={() => router.push("/settings/profile")}
            className="cursor-pointer"
          >
            <Icon name="Settings" className="mr-2 h-4 w-4" />
            {t("settings_title")}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => {
              const rootHost = process.env.NEXT_PUBLIC_APP_ROOT_HOST || "localhost:3000";
              window.open(`http://${rootHost}`, "_blank");
            }}
          >
            <Icon name="Globe" className="mr-2 h-4 w-4" />
            Go to Website
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
            <Icon name="LogOut" className="mr-2 h-4 w-4" />
            {t("sign_out")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("create_organization")}</DialogTitle>
            <DialogDescription>{t("create_org_description")}</DialogDescription>
          </DialogHeader>

          {orgError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
              {orgError}
            </div>
          )}

          <InputField
            label={t("organization_name")}
            value={newOrgName}
            onChange={(e) => setNewOrgName(e.target.value)}
            placeholder={t("org_name_placeholder")}
            autoFocus
            disabled={creatingOrg}
            showAsterisk
          />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={creatingOrg}
            >
              {t("cancel")}
            </Button>
            <Button
              type="button"
              onClick={handleCreateOrganization}
              disabled={creatingOrg || !newOrgName.trim()}
            >
              {creatingOrg ? <Icon name="Loader" className="h-4 w-4 animate-spin" /> : t("create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}

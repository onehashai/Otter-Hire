"use client";

import { useRouter } from "next/navigation";
import { Icon } from "@onehash/ui/icon";
import { logout } from "@/api/index";
import { useAuthSession } from "@/app/providers";
import { usePageMetadata } from "@/contexts/PageMetadataContext";
import { Avatar, AvatarFallback } from "@onehash/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@onehash/ui/dropdown-menu";
import { Button } from "@onehash/ui/button";
import { useTranslation } from "react-i18next";

export function TopBar() {
  const router = useRouter();
  const { user, clearSession } = useAuthSession();
  const { metadata } = usePageMetadata();
  const { t } = useTranslation();
  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      clearSession();
      router.replace("/login");
    }
  };

  const initials =
    user?.org_name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase() || "U";

  return (
    <header className="h-12 border-b border-border flex items-center justify-between px-4 md:px-6 bg-background shrink-0">
      <div className="flex flex-col justify-center">
        <h1 className="text-sm font-semibold text-foreground leading-tight">{metadata.title}</h1>
        {metadata.subtitle && (
          <p className="text-[10px] text-muted-foreground leading-tight">{metadata.subtitle}</p>
        )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-8 w-32"
          >
            <Avatar className="h-6 w-6 border border-border">
              <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col items-start min-w-0 flex-1">
              <span className="text-[10px] text-muted-foreground truncate max-w-full">{user?.org_name}</span>
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => router.push("/settings/profile")} className="cursor-pointer">
            <Icon name="Settings" className="mr-2 h-4 w-4" />
            {t("settings_title")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => router.push("/organization/new")} className="cursor-pointer">
            <Icon name="Plus" className="mr-2 h-4 w-4" />
            {t("new_organization")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/organization/switch")} className="cursor-pointer">
            <Icon name="ArrowLeftRight" className="mr-2 h-4 w-4" />
            {t("switch_organization")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
            <Icon name="LogOut" className="mr-2 h-4 w-4" />
            {t("sign_out")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

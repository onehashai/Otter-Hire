"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSetPageMetadata } from "@/hooks/useSetPageMetadata";
import { useAuthSession } from "@/app/providers";
import { Icon, type IconName } from "@onehash/ui/icon";

const baseTabRoutes: { label: string; path: string; icon: IconName }[] = [
  { label: "Profile", path: "/settings/profile", icon: "User" },
  { label: "Organization", path: "/settings/organization", icon: "Building2" },
  { label: "Team", path: "/settings/team", icon: "Users" },
  { label: "Job Categories", path: "/settings/categories", icon: "Briefcase" },
  { label: "Integrations", path: "/settings/integrations", icon: "Sparkles" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const { user } = useAuthSession();

  const tabRoutes =
    user?.role === "admin"
      ? [
          ...baseTabRoutes,
          { label: "Admin", path: "/settings/admin", icon: "ShieldCheck" as const },
        ]
      : baseTabRoutes;

  useSetPageMetadata({
    title: t("settings_title"),
    subtitle: t("settings_subtitle"),
  });

  return (
    <div className={isMobile ? "space-y-4" : "flex gap-6"}>
      {/* Tab nav - horizontal scroll on mobile, vertical sidebar on desktop */}
      {isMobile ? (
        <div className="flex gap-1 overflow-x-auto -mx-4 px-4 pb-1 no-scrollbar items-center">
          {tabRoutes.map(({ label, path, icon }) => {
            const isActive = pathname === path;
            return (
              <Link
                key={path}
                href={path}
                className={cn(
                  "px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors min-h-[40px] flex items-center gap-2",
                  isActive ? "bg-foreground text-background" : "bg-muted text-muted-foreground",
                )}
              >
                <Icon name={icon} size={16} className="shrink-0 opacity-90" />
                {label}
              </Link>
            );
          })}
        </div>
      ) : (
        <nav className="w-44 shrink-0 space-y-0.5">
          {tabRoutes.map(({ label, path, icon }) => {
            const isActive = pathname === path;
            return (
              <Link
                key={path}
                href={path}
                className={cn(
                  "flex w-full items-center gap-2.5 text-left px-3 py-1.5 rounded-lg text-sm transition-colors",
                  isActive
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                )}
              >
                <Icon
                  name={icon}
                  size={16}
                  className={cn("shrink-0", isActive ? "text-foreground" : "text-muted-foreground")}
                />
                {label}
              </Link>
            );
          })}
        </nav>
      )}

      {/* Content */}
      <div className="flex-1 max-w-6xl min-w-0">{children}</div>
    </div>
  );
}

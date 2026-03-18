"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSetPageMetadata } from "@/hooks/useSetPageMetadata";
import { useAuthSession } from "@/app/providers";
import { Separator } from "@onehash/ui/separator";

const baseTabRoutes: { label: string; path: string }[] = [
  { label: "Profile", path: "/settings/profile" },
  { label: "Organization", path: "/settings/organization" },
  { label: "Team", path: "/settings/team" },
  { label: "Job Categories", path: "/settings/categories" },
  { label: "Integrations", path: "/settings/integrations" },
];

const adminTabRoute = { label: "Admin", path: "/settings/admin" };

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const { user } = useAuthSession();
  const isSuperAdmin = user?.role === "super_admin";

  useSetPageMetadata({
    title: t("settings_title"),
    subtitle: t("settings_subtitle"),
  });

  return (
    <div className={isMobile ? "space-y-4" : "flex gap-6"}>
      {/* Tab nav - horizontal scroll on mobile, vertical sidebar on desktop */}
      {isMobile ? (
        <div className="flex gap-1 overflow-x-auto -mx-4 px-4 pb-1 no-scrollbar items-center">
          {baseTabRoutes.map(({ label, path }) => {
            const isActive = pathname === path;
            return (
              <Link
                key={path}
                href={path}
                className={cn(
                  "px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors min-h-[40px] flex items-center",
                  isActive ? "bg-foreground text-background" : "bg-muted text-muted-foreground",
                )}
              >
                {label}
              </Link>
            );
          })}
          {isSuperAdmin && (
            <>
              <Separator orientation="vertical" className="h-6 mx-1 shrink-0" />
              <Link
                href={adminTabRoute.path}
                className={cn(
                  "px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors min-h-[40px] flex items-center",
                  pathname === adminTabRoute.path
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {adminTabRoute.label}
              </Link>
            </>
          )}
        </div>
      ) : (
        <nav className="w-44 shrink-0 space-y-0.5">
          {baseTabRoutes.map(({ label, path }) => {
            const isActive = pathname === path;
            return (
              <Link
                key={path}
                href={path}
                className={cn(
                  "block w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors",
                  isActive
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                )}
              >
                {label}
              </Link>
            );
          })}
          {isSuperAdmin && (
            <>
              <Separator className="my-2" />
              <Link
                href={adminTabRoute.path}
                className={cn(
                  "block w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors",
                  pathname === adminTabRoute.path
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                )}
              >
                {adminTabRoute.label}
              </Link>
            </>
          )}
        </nav>
      )}

      {/* Content */}
      <div className="flex-1 max-w-6xl min-w-0">{children}</div>
    </div>
  );
}

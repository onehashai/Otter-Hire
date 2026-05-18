"use client";

import {
  // TODO(mvp-nav): Re-enable Dashboard in sidebar after MVP launch.
  // LayoutDashboard,
  Briefcase,
  Users,
  FileText,
  BarChart3,
  Zap,
  Bot,
  ScrollText,
  Settings,
  Sun,
  Moon,
  ChevronsLeft,
  Search,
} from "lucide-react";
import { NavLink } from "@/components/common/NavLink";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useTheme } from "@/components/common/ThemeProvider";
import { Button } from "@onehash/ui/button";
import { Separator } from "@onehash/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@onehash/ui/tooltip";
import { LOGO_SVG_PATH } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { useAuthSession } from "@/app/providers";

const baseNavItems = [
  // TODO(mvp-nav): Re-enable Dashboard in sidebar after MVP launch.
  // { titleKey: "nav_dashboard", url: "/", icon: LayoutDashboard },
  { titleKey: "jobs_title", url: "/jobs", icon: Briefcase },
  { titleKey: "candidates_title", url: "/candidates", icon: Users },
  { titleKey: "templates_title", url: "/templates", icon: FileText },
  // TODO(mvp-nav): Re-enable Interviews in sidebar post-messaging launch.
  // { titleKey: "nav_interviews", url: "/interviews", icon: Calendar },
  { titleKey: "reports_title", url: "/reports", icon: BarChart3 },
  { titleKey: "automations_title", url: "/automations", icon: Zap },
  { titleKey: "ai_assistant_title", url: "/ai-assistant", icon: Bot },
];

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onOpenCommandPalette?: () => void;
}

export function AppSidebar({ collapsed, onToggle, onOpenCommandPalette }: AppSidebarProps) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuthSession();

  const canSeeLogs = user?.membership_role === "owner" || user?.membership_role === "admin";

  const navItems = [
    ...baseNavItems,
    ...(canSeeLogs ? [{ titleKey: "nav_logs", url: "/logs", icon: ScrollText }] : []),
    { titleKey: "settings_title", url: "/settings/profile", icon: Settings },
  ];

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-border bg-sidebar h-screen sticky top-0 transition-all duration-200 ease-in-out shrink-0",
        collapsed ? "w-14" : "w-56",
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center h-12 px-2.5",
          collapsed ? "justify-center" : "justify-between",
        )}
      >
        {!collapsed && (
          <Link href="/" className="flex items-center">
            <Image
              src={LOGO_SVG_PATH}
              alt="Otter Hire"
              width={2000}
              height={491}
              className="h-7 w-auto dark:invert dark:contrast-200"
            />
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
        >
          <ChevronsLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
        </Button>
      </div>

      <Separator />

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {navItems.map((item) => {
          const isActive = item.url === "/" ? pathname === "/" : pathname.startsWith(item.url);
          const label = t(item.titleKey);

          const link = (
            <NavLink
              key={item.url}
              href={item.url}
              end={item.url === "/"}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
                "text-sidebar-foreground hover:bg-sidebar-accent",
                isActive && "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
              )}
              activeClassName=""
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span suppressHydrationWarning>{label}</span>}
            </NavLink>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.url}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right" className="text-xs">
                  {label}
                </TooltipContent>
              </Tooltip>
            );
          }

          return link;
        })}
      </nav>

      <Separator />

      {/* Footer */}
      <div className={cn("p-2 space-y-1", collapsed && "flex flex-col items-center")}>
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "sm"}
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className={cn(
            "text-muted-foreground hover:text-foreground w-full",
            collapsed ? "h-8 w-8" : "justify-start gap-2.5 px-2.5",
          )}
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4 shrink-0" />
          ) : (
            <Moon className="h-4 w-4 shrink-0" />
          )}
          {!collapsed && (
            <span className="text-xs" suppressHydrationWarning>
              {theme === "dark" ? t("light_mode") : t("dark_mode")}
            </span>
          )}
        </Button>

        {onOpenCommandPalette && (
          <Button
            variant="outline"
            size={collapsed ? "icon" : "sm"}
            onClick={onOpenCommandPalette}
            className={cn(
              "w-full text-muted-foreground text-xs font-normal",
              collapsed ? "h-8 w-8" : "h-8 gap-2 justify-start px-2.5",
            )}
          >
            <Search className="h-3.5 w-3.5 shrink-0" />
            {!collapsed && (
              <>
                <span suppressHydrationWarning>{t("search")}</span>
                <kbd className="pointer-events-none inline-flex h-5 select-none items-center rounded border border-border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground ml-auto">
                  ⌘K
                </kbd>
              </>
            )}
          </Button>
        )}
      </div>
    </aside>
  );
}

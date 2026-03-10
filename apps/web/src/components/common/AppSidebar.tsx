"use client";

import {
  // TODO(mvp-nav): Re-enable Dashboard in sidebar after MVP launch.
  // LayoutDashboard,
  Briefcase,
  Users,
  MessageSquare,
  // TODO(mvp-nav): Re-enable Reports/Automations/AI Assistant icons after MVP launch.
  // BarChart3,
  // Zap,
  // Bot,
  Settings,
  Sun,
  Moon,
  ChevronsLeft,
  Search,
} from "lucide-react";
import { NavLink } from "@/components/common/NavLink";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@/components/common/ThemeProvider";
import { Button } from "@onehash/ui/button";
import { Separator } from "@onehash/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@onehash/ui/tooltip";
import { cn } from "@/lib/utils";

const navItems = [
  // TODO(mvp-nav): Re-enable Dashboard in sidebar after MVP launch.
  // { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Jobs", url: "/jobs", icon: Briefcase },
  { title: "Candidates", url: "/candidates", icon: Users },
  { title: "Messages", url: "/messages", icon: MessageSquare },
  // TODO(mvp-nav): Re-enable Interviews in sidebar post-messaging launch.
  // { title: "Interviews", url: "/interviews", icon: Calendar },
  // TODO(mvp-nav): Re-enable Reports in sidebar after MVP launch.
  // { title: "Reports", url: "/reports", icon: BarChart3 },
  // TODO(mvp-nav): Re-enable Automations in sidebar after MVP launch.
  // { title: "Automations", url: "/automations", icon: Zap },
  // TODO(mvp-nav): Re-enable AI Assistant in sidebar after MVP launch.
  // { title: "AI Assistant", url: "/ai-assistant", icon: Bot },
  { title: "Settings", url: "/settings/profile", icon: Settings },
];

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onOpenCommandPalette?: () => void;
}

export function AppSidebar({ collapsed, onToggle, onOpenCommandPalette }: AppSidebarProps) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

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
          "flex items-center h-12 px-3",
          collapsed ? "justify-center" : "justify-between",
        )}
      >
        {!collapsed && (
          <Link href="/" className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-foreground flex items-center justify-center">
              <span className="text-background text-xs font-bold">A</span>
            </div>
            <span className="text-sm font-semibold text-foreground">ATS</span>
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

          const link = (
            <NavLink
              key={item.title}
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
              {!collapsed && <span>{item.title}</span>}
            </NavLink>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.title}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right" className="text-xs">
                  {item.title}
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
            <span className="text-xs">{theme === "dark" ? "Light mode" : "Dark mode"}</span>
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
                <span>Search...</span>
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

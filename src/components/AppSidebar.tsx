import {
  LayoutDashboard,
  Briefcase,
  Users,
  Kanban,
  Calendar,
  Mail,
  UserSearch,
  BarChart3,
  Zap,
  Bot,
  Settings,
  Sun,
  Moon,
  ChevronsLeft,
  Building2,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useTheme } from "@/components/ThemeProvider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Jobs", url: "/jobs", icon: Briefcase },
  { title: "Candidates", url: "/candidates", icon: Users },
  { title: "Pipeline", url: "/pipeline", icon: Kanban },
  { title: "Interviews", url: "/interviews", icon: Calendar },
  { title: "Messages", url: "/messages", icon: Mail },
  { title: "Talent Pool", url: "/talent-pool", icon: UserSearch },
  { title: "Reports", url: "/reports", icon: BarChart3 },
  { title: "Automations", url: "/automations", icon: Zap },
  { title: "AI Assistant", url: "/ai-assistant", icon: Bot },
  { title: "Settings", url: "/settings", icon: Settings },
];

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function AppSidebar({ collapsed, onToggle }: AppSidebarProps) {
  const location = useLocation();
  const { theme, setTheme } = useTheme();

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-border bg-sidebar h-screen sticky top-0 transition-all duration-200 ease-in-out shrink-0",
        collapsed ? "w-14" : "w-56"
      )}
    >
      {/* Header */}
      <div className={cn("flex items-center h-12 px-3", collapsed ? "justify-center" : "justify-between")}>
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-foreground flex items-center justify-center">
              <span className="text-background text-xs font-bold">A</span>
            </div>
            <span className="text-sm font-semibold text-foreground">ATS</span>
          </div>
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
          const isActive = item.url === "/"
            ? location.pathname === "/"
            : location.pathname.startsWith(item.url);

          const link = (
            <NavLink
              key={item.title}
              to={item.url}
              end={item.url === "/"}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
                "text-sidebar-foreground hover:bg-sidebar-accent",
                isActive && "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
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
          className={cn("text-muted-foreground hover:text-foreground w-full", collapsed ? "h-8 w-8" : "justify-start gap-2.5 px-2.5")}
        >
          {theme === "dark" ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
          {!collapsed && <span className="text-xs">{theme === "dark" ? "Light mode" : "Dark mode"}</span>}
        </Button>

        <div className={cn("flex items-center gap-2.5 rounded-lg px-2.5 py-1.5", collapsed && "px-0 justify-center")}>
          <Avatar className="h-6 w-6">
            <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">JD</AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-xs font-medium text-foreground">Jane Doe</span>
              <span className="text-[10px] text-muted-foreground">Acme Inc</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

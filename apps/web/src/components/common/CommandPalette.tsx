"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@onehash/ui/command";
import {
  // TODO(mvp-nav): Re-enable Dashboard in command palette after MVP launch.
  // LayoutDashboard,
  Briefcase,
  Users,
  Calendar,
  BarChart3,
  // TODO(mvp-nav): Re-enable Automations in command palette after MVP launch.
  // Zap,
  Bot,
  Settings,
  Plus,
  UserPlus,
  CalendarPlus,
} from "lucide-react";
import { useTranslation } from "react-i18next";

const pages = [
  // TODO(mvp-nav): Re-enable Dashboard in command palette after MVP launch.
  // { titleKey: "nav_dashboard", url: "/", icon: LayoutDashboard },
  { titleKey: "jobs_title", url: "/jobs", icon: Briefcase },
  { titleKey: "candidates_title", url: "/candidates", icon: Users },
  { titleKey: "nav_interviews", url: "/interviews", icon: Calendar },
  { titleKey: "reports_title", url: "/reports", icon: BarChart3 },
  // TODO(mvp-nav): Re-enable Automations in command palette after MVP launch.
  // { titleKey: "automations_title", url: "/automations", icon: Zap },
  { titleKey: "ai_assistant_title", url: "/ai-assistant", icon: Bot },
  { titleKey: "settings_title", url: "/settings/profile", icon: Settings },
];

const quickActions = [
  { title: "Create Job", icon: Plus },
  { title: "Add Candidate", icon: UserPlus },
  { title: "Schedule Interview", icon: CalendarPlus },
];

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const { t } = useTranslation();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  const handleSelect = (url: string) => {
    router.push(url);
    onOpenChange(false);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Pages">
          {pages.map((page) => (
            <CommandItem key={page.url} onSelect={() => handleSelect(page.url)}>
              <page.icon className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>{t(page.titleKey)}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Quick Actions">
          {quickActions.map((action) => (
            <CommandItem key={action.title} onSelect={() => onOpenChange(false)}>
              <action.icon className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>{action.title}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

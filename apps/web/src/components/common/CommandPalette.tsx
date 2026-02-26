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
  // TODO(mvp-nav): Re-enable Reports/Automations/AI Assistant icons after MVP launch.
  // BarChart3,
  // Zap,
  // Bot,
  Settings,
  Plus,
  UserPlus,
  CalendarPlus,
} from "lucide-react";

const pages = [
  // TODO(mvp-nav): Re-enable Dashboard in command palette after MVP launch.
  // { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Jobs", url: "/jobs", icon: Briefcase },
  { title: "Candidates", url: "/candidates", icon: Users },
  { title: "Interviews", url: "/interviews", icon: Calendar },
  // TODO(mvp-nav): Re-enable Reports in command palette after MVP launch.
  // { title: "Reports", url: "/reports", icon: BarChart3 },
  // TODO(mvp-nav): Re-enable Automations in command palette after MVP launch.
  // { title: "Automations", url: "/automations", icon: Zap },
  // TODO(mvp-nav): Re-enable AI Assistant in command palette after MVP launch.
  // { title: "AI Assistant", url: "/ai-assistant", icon: Bot },
  { title: "Settings", url: "/settings/profile", icon: Settings },
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
              <span>{page.title}</span>
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

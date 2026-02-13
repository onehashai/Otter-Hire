import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
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
  Plus,
  UserPlus,
  CalendarPlus,
} from "lucide-react";

const pages = [
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
  const navigate = useNavigate();

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
    navigate(url);
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

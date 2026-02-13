import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Search, Plus } from "lucide-react";

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/jobs": "Jobs",
  "/candidates": "Candidates",
  "/pipeline": "Pipeline",
  "/interviews": "Interviews",
  "/messages": "Messages",
  "/talent-pool": "Talent Pool",
  "/reports": "Reports",
  "/automations": "Automations",
  "/ai-assistant": "AI Assistant",
  "/settings": "Settings",
};

interface TopBarProps {
  onOpenCommandPalette: () => void;
}

export function TopBar({ onOpenCommandPalette }: TopBarProps) {
  const location = useLocation();
  const title = pageTitles[location.pathname] || "Page";

  return (
    <header className="h-12 border-b border-border flex items-center justify-between px-6 bg-background shrink-0">
      <h1 className="text-sm font-semibold text-foreground">{title}</h1>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenCommandPalette}
          className="h-8 gap-2 text-muted-foreground text-xs font-normal"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Search...</span>
          <kbd className="pointer-events-none hidden sm:inline-flex h-5 select-none items-center rounded border border-border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
            ⌘K
          </kbd>
        </Button>

        <Button size="sm" className="h-8 gap-1.5 text-xs">
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Quick Action</span>
        </Button>
      </div>
    </header>
  );
}

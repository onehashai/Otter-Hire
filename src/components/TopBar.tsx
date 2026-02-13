import { useLocation, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Search, Plus } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/jobs": "Jobs",
  "/jobs/new": "Create Job",
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
  const isMobile = useIsMobile();

  // For job edit routes, derive title from URL param
  const isJobEdit = /^\/jobs\/[^/]+\/edit$/.test(location.pathname);
  const title = isJobEdit
    ? decodeURIComponent(location.pathname.split("/")[2])
    : pageTitles[location.pathname] || "Page";

  return (
    <header className="h-12 border-b border-border flex items-center justify-between px-4 md:px-6 bg-background shrink-0">
      <h1 className="text-sm font-semibold text-foreground">{title}</h1>

      <div className="flex items-center gap-1.5 md:gap-2">
        <Button
          variant="outline"
          size={isMobile ? "icon" : "sm"}
          onClick={onOpenCommandPalette}
          className={isMobile ? "h-8 w-8" : "h-8 gap-2 text-muted-foreground text-xs font-normal"}
        >
          <Search className="h-3.5 w-3.5" />
          {!isMobile && (
            <>
              <span>Search...</span>
              <kbd className="pointer-events-none inline-flex h-5 select-none items-center rounded border border-border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
                ⌘K
              </kbd>
            </>
          )}
        </Button>

        {!isMobile && (
          <Button size="sm" className="h-8 gap-1.5 text-xs">
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Quick Action</span>
          </Button>
        )}
      </div>
    </header>
  );
}

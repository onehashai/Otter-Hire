import { useState } from "react";
import { Outlet } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { CommandPalette } from "@/components/CommandPalette";
import { useIsMobile } from "@/hooks/use-mobile";

export function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const isMobile = useIsMobile();

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Sidebar: hidden on mobile, compact on tablet, full on desktop */}
      {!isMobile && (
        <AppSidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      )}
      <div className="flex flex-col flex-1 min-w-0">
        <TopBar onOpenCommandPalette={() => setCommandOpen(true)} />
        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-6xl px-4 md:px-6 py-4 md:py-6 pb-20 md:pb-6">
            <Outlet />
          </div>
        </main>
      </div>
      {isMobile && <BottomNav />}
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  );
}

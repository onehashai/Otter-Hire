"use client";

import { useState } from "react";
import { AppSidebar } from "@/components/common/AppSidebar";
import { TopBar } from "@/components/common/TopBar";
import { BottomNav } from "@/components/common/BottomNav";
import { CommandPalette } from "@/components/common/CommandPalette";
import { useIsMobile } from "@/hooks/use-mobile";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const isMobile = useIsMobile();

  return (
    <div className="flex min-h-screen w-full bg-background">
      {!isMobile && (
        <AppSidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          onOpenCommandPalette={() => setCommandOpen(true)}
        />
      )}
      <div className="flex flex-col flex-1 min-w-0">
        <TopBar />
        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-6xl px-4 md:px-6 py-4 md:py-6 pb-20 md:pb-6">
            {children}
          </div>
        </main>
      </div>
      {isMobile && <BottomNav />}
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  );
}

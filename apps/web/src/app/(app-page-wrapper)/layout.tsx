"use client";

import { Suspense, useState } from "react";
import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/common/AppSidebar";
import { JobWorkspaceSidebar } from "@/components/common/JobWorkspaceSidebar";
import { TopBar } from "@/components/common/TopBar";
import { BottomNav } from "@/components/common/BottomNav";
import { CommandPalette } from "@/components/common/CommandPalette";
import { useIsMobile } from "@/hooks/use-mobile";
import { PageMetadataProvider } from "@/contexts/PageMetadataContext";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const jobWorkspaceId = segments[0] === "jobs" && segments[1] ? segments[1] : null;
  const isJobStageWorkspaceRoute =
    segments[0] === "jobs" &&
    Boolean(segments[1]) &&
    segments[2] === "stage" &&
    Boolean(segments[3]);

  return (
    <PageMetadataProvider>
      <div className="flex h-screen w-full bg-background">
        {!isMobile && jobWorkspaceId ? (
          <Suspense fallback={null}>
            <JobWorkspaceSidebar
              jobId={jobWorkspaceId}
              collapsed={sidebarCollapsed}
              onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
              onOpenCommandPalette={() => setCommandOpen(true)}
            />
          </Suspense>
        ) : !isMobile ? (
          <AppSidebar
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
            onOpenCommandPalette={() => setCommandOpen(true)}
          />
        ) : null}
        <div className="flex flex-col flex-1 min-w-0">
          <TopBar />
          <main className="flex-1 overflow-auto min-h-0">
            <div
              className={
                isJobStageWorkspaceRoute
                  ? "py-0 pb-0 md:pb-0 min-h-0"
                  : "px-4 md:px-6 py-4 md:py-6 pb-20 md:pb-6 w-full"
              }
            >
              {children}
            </div>
          </main>
        </div>
        {isMobile && <BottomNav />}
        <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
      </div>
    </PageMetadataProvider>
  );
}

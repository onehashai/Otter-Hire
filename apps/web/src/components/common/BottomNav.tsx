"use client";

import { LayoutDashboard, Briefcase, Kanban, Users, Mail, MoreHorizontal } from "lucide-react";
import { NavLink } from "@/components/common/NavLink";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { MobileMoreDrawer } from "./MobileMoreDrawer";

const primaryTabs = [
  { title: "Home", url: "/", icon: LayoutDashboard },
  { title: "Jobs", url: "/jobs", icon: Briefcase },
  { title: "Pipeline", url: "/pipeline", icon: Kanban },
  { title: "Candidates", url: "/candidates", icon: Users },
  { title: "Inbox", url: "/messages", icon: Mail },
];

export function BottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
        <div className="flex items-center justify-around h-14 px-1">
          {primaryTabs.map((tab) => {
            const isActive = tab.url === "/"
              ? pathname === "/"
              : pathname.startsWith(tab.url);
            return (
              <NavLink
                key={tab.title}
                href={tab.url}
                end={tab.url === "/"}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 min-w-[48px] min-h-[44px] rounded-lg transition-colors",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )}
                activeClassName=""
              >
                <tab.icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{tab.title}</span>
              </NavLink>
            );
          })}
          <button
            onClick={() => setMoreOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 min-w-[48px] min-h-[44px] rounded-lg text-muted-foreground transition-colors"
          >
            <MoreHorizontal className="h-5 w-5" />
            <span className="text-[10px] font-medium">More</span>
          </button>
        </div>
      </nav>
      <MobileMoreDrawer open={moreOpen} onOpenChange={setMoreOpen} />
    </>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

const tabRoutes: { label: string; path: string }[] = [
  { label: "Workspace", path: "/settings/workspace" },
  { label: "Team", path: "/settings/team" },
  { label: "Integrations", path: "/settings/integrations" },
  { label: "Custom Fields", path: "/settings/custom-fields" },
  { label: "Billing", path: "/settings/billing" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMobile = useIsMobile();

  return (
    <div className={isMobile ? "space-y-4" : "flex gap-6"}>
      {/* Tab nav - horizontal scroll on mobile, vertical sidebar on desktop */}
      {isMobile ? (
        <div className="flex gap-1 overflow-x-auto -mx-4 px-4 pb-1 no-scrollbar">
          {tabRoutes.map(({ label, path }) => {
            const isActive = pathname === path;
            return (
              <Link
                key={path}
                href={path}
                className={cn(
                  "px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors min-h-[40px] flex items-center",
                  isActive ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
                )}
              >
                {label}
              </Link>
            );
          })}
        </div>
      ) : (
        <nav className="w-44 shrink-0 space-y-0.5">
          {tabRoutes.map(({ label, path }) => {
            const isActive = pathname === path;
            return (
              <Link
                key={path}
                href={path}
                className={cn(
                  "block w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors",
                  isActive
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      )}

      {/* Content */}
      <div className="flex-1 max-w-xl min-w-0">{children}</div>
    </div>
  );
}

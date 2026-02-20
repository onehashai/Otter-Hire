"use client";

import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { logout } from "@/api/index";
import { useAuthSession } from "@/app/providers";
import { Avatar, AvatarFallback } from "@onehash/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@onehash/ui/dropdown-menu";

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/jobs": "Jobs",
  "/jobs/new": "Create Job",
  "/candidates": "Candidates",
  "/pipeline": "Pipeline",
  "/interviews": "Interviews",
  "/messages": "Messages",
  "/reports": "Reports",
  "/automations": "Automations",
  "/ai-assistant": "AI Assistant",
  "/settings/workspace": "Settings",
};

export function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuthSession();

  const isJobEdit = /^\/jobs\/[^/]+\/edit$/.test(pathname);
  const title = isJobEdit
    ? decodeURIComponent(pathname.split("/")[2])
    : pageTitles[pathname] || "Page";

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      router.replace("/login");
      router.refresh();
    }
  };

  const initials = user?.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "U";

  return (
    <header className="h-12 border-b border-border flex items-center justify-between px-4 md:px-6 bg-background shrink-0">
      <h1 className="text-sm font-semibold text-foreground">{title}</h1>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 hover:bg-muted/80 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col items-start">
              <span className="text-xs font-medium text-foreground">{user?.name || "User"}</span>
              <span className="text-[10px] text-muted-foreground">{user?.email || ""}</span>
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
            <LogOut className="mr-2 h-4 w-4" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

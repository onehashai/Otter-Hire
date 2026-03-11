"use client";

import { useRouter } from "next/navigation";
import { MessageSquare, Settings, Sun, Moon } from "lucide-react";
// TODO(mvp-nav): Re-enable Reports/Automations/AI Assistant icons in mobile drawer after MVP launch.
// import { Calendar, BarChart3, Zap, Bot } from "lucide-react";
import { useTheme } from "@/components/common/ThemeProvider";
import { Separator } from "@onehash/ui/separator";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@onehash/ui/drawer";

const moreItems = [
  { title: "Conversations", url: "/conversations", icon: MessageSquare },
  // TODO(mvp-nav): Re-enable Interviews in mobile drawer post-messaging launch.
  // { title: "Interviews", url: "/interviews", icon: Calendar },
  // TODO(mvp-nav): Re-enable Reports in mobile drawer after MVP launch.
  // { title: "Reports", url: "/reports", icon: BarChart3 },
  // TODO(mvp-nav): Re-enable Automations in mobile drawer after MVP launch.
  // { title: "Automations", url: "/automations", icon: Zap },
  // TODO(mvp-nav): Re-enable AI Assistant in mobile drawer after MVP launch.
  // { title: "AI Assistant", url: "/ai-assistant", icon: Bot },
  { title: "Settings", url: "/settings/profile", icon: Settings },
];

interface MobileMoreDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileMoreDrawer({ open, onOpenChange }: MobileMoreDrawerProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const handleNav = (url: string) => {
    router.push(url);
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle className="text-base">More</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-6 space-y-1">
          {moreItems.map((item) => (
            <button
              key={item.title}
              onClick={() => handleNav(item.url)}
              className="flex items-center gap-3 w-full rounded-lg px-3 py-3 text-sm text-foreground hover:bg-muted transition-colors min-h-[44px]"
            >
              <item.icon className="h-5 w-5 text-muted-foreground" />
              <span>{item.title}</span>
            </button>
          ))}
          <Separator className="my-2" />
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="flex items-center gap-3 w-full rounded-lg px-3 py-3 text-sm text-foreground hover:bg-muted transition-colors min-h-[44px]"
          >
            {theme === "dark" ? (
              <Sun className="h-5 w-5 text-muted-foreground" />
            ) : (
              <Moon className="h-5 w-5 text-muted-foreground" />
            )}
            <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

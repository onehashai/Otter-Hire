"use client";

import { useRouter } from "next/navigation";
import { BarChart3, Bot, Database, Settings, Sun, Moon, ScrollText } from "lucide-react";
// TODO(mvp-nav): Re-enable Interviews/Automations in mobile drawer after MVP launch.
// import { Calendar, Zap } from "lucide-react";
import { useTheme } from "@/components/common/ThemeProvider";
import { Separator } from "@onehash/ui/separator";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@onehash/ui/drawer";
import { useTranslation } from "react-i18next";

const moreItems = [
  // TODO(mvp-nav): Re-enable Interviews in mobile drawer post-messaging launch.
  // { titleKey: "nav_interviews", url: "/interviews", icon: Calendar },
  { titleKey: "reports_title", url: "/reports", icon: BarChart3 },
  { titleKey: "ai_assistant_title", url: "/ai-assistant", icon: Bot },
  { titleKey: "nav_logs", url: "/logs", icon: ScrollText },
  { titleKey: "data_migration_title", url: "/data-migration", icon: Database },
  { titleKey: "settings_title", url: "/settings/profile", icon: Settings },
];

interface MobileMoreDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileMoreDrawer({ open, onOpenChange }: MobileMoreDrawerProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation();

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
              key={item.url}
              onClick={() => handleNav(item.url)}
              className="flex items-center gap-3 w-full rounded-lg px-3 py-3 text-sm text-foreground hover:bg-muted transition-colors min-h-[44px]"
            >
              <item.icon className="h-5 w-5 text-muted-foreground" />
              <span>{t(item.titleKey)}</span>
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

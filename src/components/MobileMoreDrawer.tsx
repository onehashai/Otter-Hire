import { useNavigate } from "react-router-dom";
import { Calendar, UserSearch, BarChart3, Zap, Bot, Settings, Sun, Moon } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { Separator } from "@/components/ui/separator";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

const moreItems = [
  { title: "Interviews", url: "/interviews", icon: Calendar },
  { title: "Talent Pool", url: "/talent-pool", icon: UserSearch },
  { title: "Reports", url: "/reports", icon: BarChart3 },
  { title: "Automations", url: "/automations", icon: Zap },
  { title: "AI Assistant", url: "/ai-assistant", icon: Bot },
  { title: "Settings", url: "/settings", icon: Settings },
];

interface MobileMoreDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileMoreDrawer({ open, onOpenChange }: MobileMoreDrawerProps) {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  const handleNav = (url: string) => {
    navigate(url);
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
            {theme === "dark" ? <Sun className="h-5 w-5 text-muted-foreground" /> : <Moon className="h-5 w-5 text-muted-foreground" />}
            <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

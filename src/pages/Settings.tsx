import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

const tabs = ["Workspace", "Team", "Integrations", "Custom Fields", "Billing"];

const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState("Workspace");
  const isMobile = useIsMobile();

  return (
    <div className={isMobile ? "space-y-4" : "flex gap-6"}>
      {/* Tab nav - horizontal scroll on mobile, vertical sidebar on desktop */}
      {isMobile ? (
        <div className="flex gap-1 overflow-x-auto -mx-4 px-4 pb-1 no-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors min-h-[40px]",
                activeTab === tab ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      ) : (
        <nav className="w-44 shrink-0 space-y-0.5">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors",
                activeTab === tab
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              {tab}
            </button>
          ))}
        </nav>
      )}

      {/* Content */}
      <div className="flex-1 max-w-xl">
        <h2 className="text-base md:text-lg font-semibold mb-1">{activeTab}</h2>
        <p className="text-xs text-muted-foreground mb-4 md:mb-6">Manage your {activeTab.toLowerCase()} settings</p>

        <Card>
          <CardContent className="p-4 md:p-5 space-y-4">
            {activeTab === "Workspace" && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Workspace Name</Label>
                  <Input defaultValue="Acme Inc" className="text-sm h-10 md:h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Website</Label>
                  <Input defaultValue="https://acme.com" className="text-sm h-10 md:h-9" />
                </div>
                <Separator />
                <Button size="sm" className="text-xs h-9 md:h-8">Save Changes</Button>
              </>
            )}
            {activeTab !== "Workspace" && (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">{activeTab} settings coming soon</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SettingsPage;

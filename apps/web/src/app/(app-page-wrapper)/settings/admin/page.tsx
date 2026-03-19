"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { useAuthSession } from "@/app/providers";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@onehash/ui/tabs";
import { Activity } from "lucide-react";


export default function AdminSettingsPage() {
  const { user, loading } = useAuthSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab = tabParam === "background-jobs" ? "background-jobs" : "background-jobs";

  useEffect(() => {
    if (loading) return;
    if (!user || user.role !== "super_admin") {
      router.replace("/settings");
      return;
    }
  }, [user, loading, router]);

  if (loading || !user || user.role !== "super_admin") {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground" />
      </div>
    );
  }

  return (
    <>
      <h2 className="text-base md:text-lg font-semibold mb-1">Admin</h2>
      <p className="text-xs text-muted-foreground mb-4 md:mb-6">
        System administration (Super Admin only)
      </p>

      <Tabs value={activeTab} className="w-full">
        <TabsList className="h-9 w-full justify-start bg-transparent border-b rounded-none p-0 gap-0 overflow-x-auto no-scrollbar">
          <TabsTrigger
            value="background-jobs"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent px-4 text-sm"
          >
            <Activity className="mr-2 h-4 w-4" />
            Background Jobs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="background-jobs" className="mt-6">
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="relative w-full min-h-[600px]">
              <iframe
                src={process.env.NEXT_PUBLIC_TEMPORAL_UI_URL || "http://temporal.localhost.com:8080"}
                title="Temporal Dashboard"
                className="absolute inset-0 w-full h-full min-h-[600px] border-0"
                sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}

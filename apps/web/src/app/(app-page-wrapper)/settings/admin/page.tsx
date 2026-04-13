"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@onehash/ui/tabs";
import { useAuthSession } from "@/app/providers";
import { UsersAdminTab } from "@/components/settings/admin/tabs/UsersTab";
import { OrganizationsAdminTab } from "@/components/settings/admin/tabs/OrganizationsTab";

export default function AdminSettingsPage() {
  const { user, loading } = useAuthSession();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user || user.role !== "admin") {
      router.replace("/settings");
      return;
    }
  }, [user, loading, router]);

  if (loading || !user || user.role !== "admin") {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-base md:text-lg font-semibold text-foreground">Administration</h1>
        <p className="text-xs text-muted-foreground">
          Platform administration tools are available to accounts with the admin role.
        </p>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="h-9 bg-transparent p-0 gap-6 rounded-none border-b border-border w-full justify-start">
          <TabsTrigger
            value="users"
            className="rounded-none border-0 border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 pb-2 text-sm font-medium"
          >
            Users
          </TabsTrigger>
          <TabsTrigger
            value="organizations"
            className="rounded-none border-0 border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 pb-2 text-sm font-medium"
          >
            Organizations
          </TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="mt-6 focus-visible:outline-none">
          <UsersAdminTab />
        </TabsContent>
        <TabsContent value="organizations" className="mt-6 focus-visible:outline-none">
          <OrganizationsAdminTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthSession } from "@/app/providers";

export default function AdminSettingsPage() {
  const { user, loading } = useAuthSession();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user || user.role !== "super_admin") {
      router.replace("/settings");
      return;
    }
    // Temporal is now on its own subdomain - redirect to settings
    router.replace("/settings");
  }, [user, loading, router]);

  return (
    <div className="flex min-h-[200px] items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground" />
    </div>
  );
}

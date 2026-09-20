"use client";

import { useAuthSession } from "@/app/providers";
import { McpSetupPanel } from "@/components/import-export/McpSetupPanel";

export default function McpServerPage() {
  const { user } = useAuthSession();
  const canManage = user?.membership_role === "owner" || user?.membership_role === "admin";

  return <McpSetupPanel canManage={canManage} />;
}

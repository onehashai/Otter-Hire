"use client";

import { useAuthSession } from "@/app/providers";
import { DeveloperApiKeys } from "@/components/settings/integrations/DeveloperApiKeys";

export default function ApiKeysPage() {
  const { user } = useAuthSession();
  const canManage = user?.membership_role === "owner" || user?.membership_role === "admin";

  return <DeveloperApiKeys canManage={canManage} />;
}

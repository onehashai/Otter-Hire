"use client";


import { useAuthSession } from "@/app/providers";
import { ProfileSettings } from "@/components/settings/profile/ProfileSettings";

export default function ProfileSettingsPage() {
  const { user } = useAuthSession();

  return <ProfileSettings user={user} />;
}

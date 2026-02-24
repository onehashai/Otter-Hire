"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function AcceptInviteCompatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      router.replace("/login");
      return;
    }
    router.replace(`/invite/${encodeURIComponent(token)}`);
  }, [router, searchParams]);

  return null;
}

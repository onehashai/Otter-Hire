"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function SetupIndexPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  useEffect(() => {
    router.replace(`/jobs/${encodeURIComponent(id)}/setup/basic-info`);
  }, [id, router]);

  return null;
}

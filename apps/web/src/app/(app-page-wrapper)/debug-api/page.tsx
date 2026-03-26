"use client";

import { useEffect, useState } from "react";
import { API_BASE_URL, getHealth, getMe } from "@/api/index";

export default function DebugApiPage() {
  const [health, setHealth] = useState<unknown>(null);
  const [me, setMe] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([getHealth(), getMe()]).then(([healthResult, meResult]) => {
      setHealth(
        healthResult.status === "fulfilled"
          ? healthResult.value
          : {
              error:
                healthResult.reason instanceof Error
                  ? healthResult.reason.message
                  : "Unknown error",
            },
      );
      setMe(
        meResult.status === "fulfilled"
          ? meResult.value
          : {
              error: meResult.reason instanceof Error ? meResult.reason.message : "Unknown error",
            },
      );
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">API Debug</h1>
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">API Debug</h1>
      <div className="rounded-lg border bg-card p-4 md:p-5">
        <p className="text-sm text-muted-foreground mb-2">API Base URL</p>
        <code className="text-sm">{API_BASE_URL}</code>
      </div>
      <div className="rounded-lg border bg-card p-4 md:p-5">
        <p className="text-sm text-muted-foreground mb-2">GET /health</p>
        <pre className="text-xs overflow-auto whitespace-pre-wrap">
          {JSON.stringify(health, null, 2)}
        </pre>
      </div>
      <div className="rounded-lg border bg-card p-4 md:p-5">
        <p className="text-sm text-muted-foreground mb-2">GET /me</p>
        <pre className="text-xs overflow-auto whitespace-pre-wrap">
          {JSON.stringify(me, null, 2)}
        </pre>
      </div>
    </div>
  );
}

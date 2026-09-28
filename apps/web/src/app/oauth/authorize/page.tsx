"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@onehash/ui/button";
import { getApiBase } from "@/api/client/client";

type AuthorizationInfo = { client_name: string; scope: string[]; redirect_uri: string };

function oauthBase() {
  return getApiBase()
    .replace(/\/v1\/?$/, "")
    .replace(/\/$/, "");
}

function ConsentContent() {
  const params = useSearchParams();
  const values = useMemo(() => Object.fromEntries(params.entries()), [params]);
  const [info, setInfo] = useState<AuthorizationInfo | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const serialized = params.toString();

  useEffect(() => {
    let cancelled = false;
    fetch(`${oauthBase()}/v1/oauth/authorize-params?${serialized}`, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok)
          throw new Error(
            body.detail?.error_description || body.detail?.error || "Invalid authorization request",
          );
        if (!cancelled) setInfo(body);
      })
      .catch((reason: unknown) => {
        if (!cancelled)
          setError(reason instanceof Error ? reason.message : "Could not validate this request");
      });
    return () => {
      cancelled = true;
    };
  }, [serialized]);

  const requestLogin = useCallback(() => {
    const returnTo = `/oauth/authorize?${serialized}`;
    window.location.assign(`/login?redirect=${encodeURIComponent(returnTo)}`);
  }, [serialized]);

  async function decide(approved: boolean) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${oauthBase()}/v1/oauth/${approved ? "approve" : "deny"}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(values),
      });
      const body = await response.json();
      if (response.status === 401) {
        requestLogin();
        return;
      }
      if (!response.ok)
        throw new Error(
          body.detail?.error_description ||
            body.detail?.error ||
            "Could not complete authorization",
        );
      window.location.assign(body.redirect_url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not complete authorization");
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <section className="w-full max-w-lg border border-border rounded-md p-6 sm:p-8 space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Otter Hire authorization</p>
          <h1 className="mt-2 text-2xl font-semibold">
            Connect {info?.client_name || "your MCP client"}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            This client is requesting access to your Otter Hire workspace.
          </p>
        </div>
        {info && (
          <div className="space-y-3">
            <p className="text-sm font-medium">Requested permissions</p>
            <ul className="space-y-2 text-sm">
              {info.scope.map((scope) => (
                <li key={scope} className="flex gap-2">
                  <span aria-hidden="true">&#8226;</span>
                  <span>
                    {scope === "mcp:read"
                      ? "Read ATS data"
                      : scope === "mcp:write"
                        ? "Create or update ATS data"
                        : "Full ATS access"}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground break-all">
              Redirect destination: {info.redirect_uri}
            </p>
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <Button variant="outline" disabled={busy || !info} onClick={() => decide(false)}>
            Cancel
          </Button>
          <Button disabled={busy || !info} onClick={() => decide(true)}>
            {busy ? "Working..." : "Authorize"}
          </Button>
        </div>
        {!info && !error && (
          <p className="text-sm text-muted-foreground">Checking authorization request...</p>
        )}
      </section>
    </main>
  );
}

export default function OAuthAuthorizePage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-background" />}>
      <ConsentContent />
    </Suspense>
  );
}

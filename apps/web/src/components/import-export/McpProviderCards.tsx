"use client";

import { useEffect, useState } from "react";
import { Check, Plug } from "lucide-react";
import { Button } from "@onehash/ui/button";
import { API_BASE_URL } from "@/api";

type Provider = {
  ats_name: string;
  mcp_status: "native_ga" | "native_beta";
  mcp_server_url: string | null;
  auth_type: string;
  last_verified_date: string | null;
  notes: string | null;
  supported_operations: string[];
};

const accessGuidance: Record<
  string,
  { location: string; credential: string; permissions: string }
> = {
  ashby: {
    location: "Open Ashby Settings and create or authorize an MCP connection for your workspace.",
    credential: "Use the access token returned by Ashby after authorization.",
    permissions: "Allow the candidate and recruiting data scopes you want to migrate.",
  },
  greenhouse: {
    location:
      "Open Greenhouse Developer or MCP settings as a Site Admin and authorize the connection.",
    credential: "Use the OAuth access token returned after consent.",
    permissions:
      "Allow access to the jobs, candidates, applications, attachments, interviews, and notes you want to import.",
  },
  ninehire: {
    location: "Open the Ninehire workspace developer settings and create an MCP key.",
    credential: "Copy the workspace MCP Bearer key.",
    permissions: "Enable the read and action permissions required for the migration.",
  },
  pinpoint: {
    location: "Open Pinpoint developer or MCP settings and authorize Otter Hire.",
    credential: "Use the OAuth access token returned after consent.",
    permissions: "Allow the recruiting data scopes required for the import.",
  },
  workable: {
    location: "Open Workable integrations or developer settings and authorize an MCP connection.",
    credential: "Use the OAuth access token returned after consent.",
    permissions: "Allow access to the recruiting data that should be imported.",
  },
  "zoho recruit": {
    location: "Open the Zoho Recruit MCP console and create or authorize an MCP connection.",
    credential: "Use the OAuth access token returned after consent.",
    permissions: "The available records follow the roles and permissions of the Zoho user.",
  },
};

export function McpProviderCards() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [message, setMessage] = useState("");
  async function load() {
    const response = await fetch(`${API_BASE_URL}/ats-migrations/mcp/providers`, {
      credentials: "include",
    });
    if (response.ok) setProviders(await response.json());
  }

  useEffect(() => {
    void load();
  }, []);

  async function connect(provider: Provider) {
    const response = await fetch(
      `${API_BASE_URL}/ats-migrations/mcp/providers/${provider.ats_name}/connect`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ access_token: token, endpoint_url: endpoint || null }),
      },
    );
    setMessage(
      response.ok
        ? `Connected to ${provider.ats_name}. Background sync is ready.`
        : "MCP connection failed.",
    );
    setToken("");
    setEndpoint("");
    setOpen(null);
    await load();
  }

  return (
    <section className="mt-6 space-y-4" aria-labelledby="mcp-provider-title">
      <div>
        <h2 id="mcp-provider-title" className="text-base font-semibold">
          Connect via MCP
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Only vendors verified in the MCP registry appear here. OAuth access is stored encrypted
          and the published tools are cached for background imports.
        </p>
      </div>
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {providers.map((provider) => (
          <div key={provider.ats_name} className="rounded-lg border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-medium">{provider.ats_name.replaceAll("_", " ")}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {provider.auth_type === "api_key" ? "Bearer API key" : "OAuth"} ·{" "}
                  {provider.mcp_status.replace("native_", "")}
                </p>
              </div>
              <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                <Check className="h-3 w-3" /> Verified
              </span>
            </div>
            {provider.notes && (
              <p className="mt-3 text-sm text-muted-foreground">{provider.notes}</p>
            )}
            <div className="mt-3 rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Where to get access</p>
              <p className="mt-1">
                {(
                  accessGuidance[provider.ats_name] ||
                  accessGuidance[provider.ats_name.replaceAll("_", " ")]
                )?.location ||
                  "Open your ATS MCP or developer settings and authorize a connection."}
              </p>
              <p className="mt-1">
                <span className="font-medium text-foreground">Credential:</span>{" "}
                {(
                  accessGuidance[provider.ats_name] ||
                  accessGuidance[provider.ats_name.replaceAll("_", " ")]
                )?.credential || "Paste the access token supplied by the ATS."}
              </p>
              <p className="mt-1">
                <span className="font-medium text-foreground">Permissions:</span>{" "}
                {(
                  accessGuidance[provider.ats_name] ||
                  accessGuidance[provider.ats_name.replaceAll("_", " ")]
                )?.permissions || "Choose read access for the records you want to import."}
              </p>
              <p className="mt-1">
                <span className="font-medium text-foreground">Endpoint:</span>{" "}
                {provider.mcp_server_url
                  ? "Otter Hire already has the provider endpoint; you do not need to paste one."
                  : "Copy the endpoint from the provider MCP console and paste it below."}
              </p>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Operations: {provider.supported_operations.join(" and ")}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-4"
              onClick={() => setOpen(open === provider.ats_name ? null : provider.ats_name)}
            >
              <Plug className="mr-2 h-3 w-3" /> Connect via MCP
            </Button>
            {open === provider.ats_name && (
              <div className="mt-3 space-y-3 border-t pt-3">
                <p className="text-xs text-muted-foreground">
                  {provider.auth_type === "api_key"
                    ? "Paste the provider MCP key."
                    : "Complete the provider OAuth consent flow, then paste the returned sandbox access token."}{" "}
                  No vendor account is contacted by the local UI until you submit.
                </p>
                <input
                  className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                  type="password"
                  placeholder={
                    provider.auth_type === "api_key" ? "MCP API key" : "OAuth access token"
                  }
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                />
                {!provider.mcp_server_url && (
                  <input
                    className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                    placeholder="MCP endpoint from provider console"
                    value={endpoint}
                    onChange={(event) => setEndpoint(event.target.value)}
                  />
                )}
                <Button
                  size="sm"
                  disabled={!token || (!provider.mcp_server_url && !endpoint)}
                  onClick={() => void connect(provider)}
                >
                  Discover tools and connect
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="space-y-3 rounded-lg border bg-card p-4">
        <h3 className="font-medium">How to proceed with an ATS MCP import</h3>
        <ol className="grid gap-2 text-sm text-muted-foreground">
          <li>1. Choose the ATS and complete its OAuth sign-in or paste its MCP key.</li>
          <li>2. Select Discover tools and connect. Otter Hire checks the provider tools.</li>
          <li>3. The worker fetches and validates candidates in the background.</li>
          <li>4. Open Pending Batches to review duplicates and errors.</li>
          <li>5. Approve the batch only after reviewing the proposed changes.</li>
        </ol>
      </div>
    </section>
  );
}

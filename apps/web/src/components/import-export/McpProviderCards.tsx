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
  connection_ready: boolean;
  connection_note: string | null;
};

type Integration = {
  id: string;
  provider: string;
  connection_type?: "api" | "native_mcp" | "smartats_bridge";
  status: string;
  last_synced_at: string | null;
  mcp_connection_type?: string | null;
  provider_details?: {
    mcp_import_contract?: {
      ready: boolean;
      missing_entities: string[];
    };
  };
};

const accessGuidance: Record<
  string,
  { location: string; credential: string; permissions: string }
> = {
  ashby: {
    location: "Open Ashby Settings and create or authorize an MCP connection for your workspace.",
    credential: "No token copy is needed; sign in to Ashby in the OAuth window.",
    permissions: "Allow the candidate and recruiting data scopes you want to migrate.",
  },
  greenhouse: {
    location:
      "Open Greenhouse Developer or MCP settings as a Site Admin and authorize the connection.",
    credential: "No token copy is needed; sign in to Greenhouse in the OAuth window.",
    permissions:
      "Allow access to the jobs, candidates, applications, attachments, interviews, and notes you want to import.",
  },
  ninehire: {
    location: "Open the Ninehire workspace developer settings and create an MCP key.",
    credential: "Copy the workspace MCP Bearer key.",
    permissions: "Enable the read and action permissions required for the migration.",
  },
  pinpoint: {
    location: "Open Pinpoint Settings, then API & Webhooks, and create a read-only API key.",
    credential: "Use the API key plus your company.pinpointhq.com host.",
    permissions: "Use a read-only key because the MCP execute-request tool can call live APIs.",
  },
  workable: {
    location: "Open Workable integrations or developer settings and authorize an MCP connection.",
    credential: "No token copy is needed; sign in to Workable in the OAuth window.",
    permissions: "Allow access to the recruiting data that should be imported.",
  },
  "zoho recruit": {
    location: "Open the Zoho Recruit MCP console and create or authorize an MCP connection.",
    credential: "No token copy is needed; sign in through the generated Zoho MCP endpoint.",
    permissions: "The available records follow the roles and permissions of the Zoho user.",
  },
};

export function McpProviderCards({
  onSyncRequested,
}: {
  onSyncRequested?: (integrationId: string) => void;
}) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [accountHost, setAccountHost] = useState("");
  const [message, setMessage] = useState("");
  const [syncingId, setSyncingId] = useState<string | null>(null);
  async function load() {
    const [providerResponse, integrationResponse] = await Promise.all([
      fetch(`${API_BASE_URL}/ats-migrations/mcp/providers`, { credentials: "include" }),
      fetch(`${API_BASE_URL}/ats-migrations/integrations`, { credentials: "include" }),
    ]);
    if (providerResponse.ok) setProviders(await providerResponse.json());
    if (integrationResponse.ok) setIntegrations(await integrationResponse.json());
  }

  useEffect(() => {
    void load();
    const params = new URLSearchParams(window.location.search);
    const result = params.get("mcp");
    if (result) {
      const provider = params.get("provider")?.replaceAll("_", " ") || "MCP provider";
      const detail = params.get("detail");
      setMessage(
        result === "connected"
          ? `${provider} connected and its import tools were verified.`
          : result === "limited"
            ? `${provider} connected, but import is disabled. ${detail || "Required tools are missing."}`
            : `${provider} could not be connected. ${detail || "Authorization failed."}`,
      );
      window.history.replaceState({}, "", window.location.pathname);
    }
    const interval = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(interval);
  }, []);

  function connectedIntegration(provider: string) {
    return integrations.find(
      (integration) =>
        integration.provider === provider &&
        (integration.connection_type === "native_mcp" ||
          (!integration.connection_type && Boolean(integration.mcp_connection_type))) &&
        ["connected", "connected_limited", "syncing"].includes(integration.status),
    );
  }

  async function sync(id: string) {
    if (onSyncRequested) {
      onSyncRequested(id);
      return;
    }
    setSyncingId(id);
    try {
      const response = await fetch(`${API_BASE_URL}/ats-migrations/integrations/${id}/sync`, {
        method: "POST",
        credentials: "include",
      });
      setMessage(
        response.ok ? "MCP sync started." : `MCP sync could not be started (${response.status}).`,
      );
      await load();
    } finally {
      setSyncingId(null);
    }
  }

  async function connectWithKey(provider: Provider) {
    const response = await fetch(
      `${API_BASE_URL}/ats-migrations/mcp/providers/${provider.ats_name}/connect`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          access_token: token,
          endpoint_url: endpoint || null,
          account_host: accountHost || null,
        }),
      },
    );
    const payload = await response.json().catch(() => null);
    setMessage(
      response.ok
        ? payload?.status === "connected_limited"
          ? `Connected to ${provider.ats_name}, but required import tools are missing.`
          : `Connected to ${provider.ats_name}. Its import tools were verified.`
        : payload?.detail || "MCP connection failed.",
    );
    setToken("");
    setEndpoint("");
    setAccountHost("");
    setOpen(null);
    await load();
  }

  async function startOauth(provider: Provider) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/ats-migrations/mcp/providers/${provider.ats_name}/oauth/start`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ endpoint_url: endpoint || null }),
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.authorization_url) {
        setMessage(payload?.detail || "The provider OAuth flow could not be started.");
        return;
      }
      window.location.assign(payload.authorization_url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The provider OAuth flow failed.");
    }
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
        {providers.length === 0 && (
          <p className="text-sm text-muted-foreground">
            MCP imports are temporarily unavailable while provider OAuth and data mappings are being
            validated. Use a verified API connector above.
          </p>
        )}
        {providers.map((provider) => {
          const integration = connectedIntegration(provider.ats_name);
          const importReady = Boolean(integration?.provider_details?.mcp_import_contract?.ready);
          return (
            <div key={provider.ats_name} className="rounded-lg border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-medium">{provider.ats_name.replaceAll("_", " ")}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {provider.auth_type === "api_key" ? "Bearer API key" : "OAuth"} ·{" "}
                    {provider.mcp_status.replace("native_", "")}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-1 text-xs ${
                    importReady ? "text-emerald-600" : "text-muted-foreground"
                  }`}
                >
                  <Check className="h-3 w-3" />{" "}
                  {importReady
                    ? "Connected"
                    : integration
                      ? "Connected, import unavailable"
                      : provider.connection_ready
                        ? "Available"
                        : "Connection only"}
                </span>
              </div>
              {provider.notes && (
                <p className="mt-3 text-sm text-muted-foreground">{provider.notes}</p>
              )}
              {provider.connection_note && (
                <p className="mt-2 text-xs text-muted-foreground">{provider.connection_note}</p>
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
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {integration && integration.status !== "syncing" && importReady && (
                  <Button
                    size="sm"
                    variant="outline"
                    pending={syncingId === integration.id}
                    onClick={() => void sync(integration.id)}
                  >
                    Sync
                  </Button>
                )}
                {integration?.status === "syncing" && (
                  <span className="text-xs text-muted-foreground">Syncing</span>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setOpen(open === provider.ats_name ? null : provider.ats_name)}
                >
                  <Plug className="mr-2 h-3 w-3" />
                  {integration ? "Reconnect" : "Connect via MCP"}
                </Button>
              </div>
              {open === provider.ats_name && (
                <div className="mt-3 space-y-3 border-t pt-3">
                  <p className="text-xs text-muted-foreground">
                    {provider.auth_type === "api_key"
                      ? provider.ats_name === "pinpoint"
                        ? "Enter a read-only Pinpoint API key and your Pinpoint company host."
                        : "Paste the provider-issued MCP bearer key."
                      : "Continue to the provider, sign in, and approve read access. SmartATS handles OAuth automatically."}
                  </p>
                  {!provider.mcp_server_url && (
                    <input
                      className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                      placeholder="MCP endpoint from provider console"
                      value={endpoint}
                      onChange={(event) => setEndpoint(event.target.value)}
                    />
                  )}
                  {provider.auth_type === "api_key" && (
                    <input
                      className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                      type="password"
                      placeholder="MCP API key"
                      value={token}
                      onChange={(event) => setToken(event.target.value)}
                    />
                  )}
                  {provider.ats_name === "pinpoint" && (
                    <input
                      className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                      placeholder="company.pinpointhq.com"
                      value={accountHost}
                      onChange={(event) => setAccountHost(event.target.value)}
                    />
                  )}
                  {provider.auth_type === "oauth" ? (
                    <Button
                      size="sm"
                      disabled={!provider.mcp_server_url && !endpoint}
                      onClick={() => void startOauth(provider)}
                    >
                      Continue to provider
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      disabled={
                        !token ||
                        (!provider.mcp_server_url && !endpoint) ||
                        (provider.ats_name === "pinpoint" && !accountHost)
                      }
                      onClick={() => void connectWithKey(provider)}
                    >
                      Discover tools and connect
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {providers.length > 0 && (
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
      )}
    </section>
  );
}

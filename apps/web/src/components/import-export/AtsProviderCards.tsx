"use client";

import { useEffect, useState } from "react";
import { Check, Plug, Unplug } from "lucide-react";
import { Button } from "@onehash/ui/button";
import { API_BASE_URL } from "@/api";
import { AtsCredentialGuide } from "./AtsCredentialGuide";

type Integration = {
  id: string;
  provider: string;
  connection_type?: "api" | "native_mcp" | "smartats_bridge";
  status: string;
  last_synced_at: string | null;
  masked_key_last4?: string | null;
  provider_details?: { last_sync_error?: string };
  mcp_connection_type?: string | null;
  bridge_tools?: string[];
};

type ConnectionType = "api" | "smartats_bridge";

const providers = [
  ["greenhouse", "Greenhouse", "OAuth client ID and client secret"],
  ["lever", "Lever", "API key with Basic Auth"],
  ["recruiterbox", "Recruiterbox", "API key with Basic Auth"],
  ["workday", "Workday", "Provider admin setup"],
  ["icims", "iCIMS", "Provider authorization"],
  ["smartrecruiters", "SmartRecruiters", "API key"],
  ["bamboohr", "BambooHR", "API key and company subdomain"],
  ["workable", "Workable", "Bearer token and company URL"],
] as const;

const providerBaseUrls: Record<string, string> = {
  greenhouse: "https://harvest.greenhouse.io",
  lever: "https://api.lever.co",
  recruiterbox: "https://api.recruiterbox.com",
  smartrecruiters: "https://api.smartrecruiters.com",
};

export function AtsProviderCards({
  connectionType = "api",
  onSyncRequested,
}: {
  connectionType?: ConnectionType;
  onSyncRequested?: (integrationId: string) => void;
}) {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [key, setKey] = useState("");
  const [clientId, setClientId] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [details, setDetails] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [generic, setGeneric] = useState({
    name: "",
    baseUrl: "",
    path: "/candidates",
    endpoints: JSON.stringify(
      {
        candidates: { path: "/candidates", method: "GET", response_root_key: "items" },
      },
      null,
      2,
    ),
    header: "Authorization",
    mapping: "{}",
    since: "updated_since",
    auth: "api_key",
    clientId: "",
    clientSecret: "",
    authorizeUrl: "",
    tokenUrl: "",
  });

  async function load() {
    const response = await fetch(`${API_BASE_URL}/ats-migrations/integrations`, {
      credentials: "include",
    });
    if (response.ok) setIntegrations(await response.json());
  }

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(interval);
  }, []);

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
      setMessage(response.ok ? "Background sync started." : await responseError(response));
      await load();
    } finally {
      setSyncingId(null);
    }
  }

  function existing(provider: string) {
    return integrations.find((item) => {
      const itemType = item.connection_type || (item.mcp_connection_type ? "native_mcp" : "api");
      return item.provider === provider && itemType === connectionType;
    });
  }

  async function responseError(response: Response): Promise<string> {
    try {
      const payload = (await response.json()) as { detail?: string; message?: string };
      return payload.detail || payload.message || `Request failed (${response.status}).`;
    } catch {
      return `Request failed (${response.status}).`;
    }
  }

  function normalizeSubdomain(value: string, suffix: string): string | null {
    const raw = value.trim();
    if (!raw) return null;
    let host = raw;
    try {
      host = new URL(raw.includes("://") ? raw : `https://${raw}`).hostname;
    } catch {
      return null;
    }
    const suffixWithDot = `.${suffix}`;
    const subdomain = host.toLowerCase().endsWith(suffixWithDot)
      ? host.slice(0, -suffixWithDot.length)
      : host;
    return /^[a-z0-9-]+$/i.test(subdomain) ? subdomain : null;
  }

  function providerBaseUrl(provider: string): string | null {
    if (provider === "workable") {
      const value = subdomain.trim().replace(/\/+$/, "");
      try {
        const url = new URL(value);
        if (
          url.protocol !== "https:" ||
          !/^[a-z0-9-]+\.workable\.com$/i.test(url.hostname) ||
          url.pathname !== "/" ||
          url.search ||
          url.hash
        ) {
          return null;
        }
        return value;
      } catch {
        return null;
      }
    }
    if (provider === "greenhouse" && (!clientId.trim() || !key.trim())) {
      setMessage("Enter the Greenhouse OAuth client ID and client secret.");
      return;
    }
    if (provider === "bamboohr") {
      const normalized = normalizeSubdomain(subdomain, "bamboohr.com");
      return normalized ? `https://${normalized}.bamboohr.com` : null;
    }
    if (provider === "workday" || provider === "icims") {
      return "https://provider-setup.invalid";
    }
    return providerBaseUrls[provider] ?? null;
  }

  async function connect(provider: string) {
    const baseUrl = providerBaseUrl(provider);
    if (!baseUrl) {
      setMessage(
        provider === "bamboohr"
          ? "Enter your BambooHR company subdomain."
          : provider === "workable"
            ? "Enter a valid Workable URL such as https://companyname.workable.com."
            : "This provider does not have an API URL configured.",
      );
      return;
    }
    if (provider === "workable") {
      const credential = key.trim();
      if (!credential) {
        setMessage("Paste your Workable API token in the second field.");
        return;
      }
      if (/^(https?:\/\/|.*\.workable\.com\/?$)/i.test(credential)) {
        setMessage("Paste the Workable API token, not the company URL or a Bearer prefix.");
        return;
      }
    }
    setBusy(true);
    setMessage("");
    try {
      let providerDetails: Record<string, string> = {};
      if (provider === "workday" || provider === "icims") {
        providerDetails = { setup_request: details };
      } else if (provider === "bamboohr" || provider === "workable") {
        providerDetails = { subdomain };
      } else if (provider === "greenhouse") {
        providerDetails = { client_id: clientId.trim() };
      }
      const endpoint =
        connectionType === "smartats_bridge"
          ? "/ats-migrations/bridge/integrations"
          : "/ats-migrations/integrations";
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          provider,
          base_url: baseUrl,
          api_key: key || null,
          auth_type:
            provider === "workable"
              ? "bearer"
              : provider === "greenhouse"
                ? "oauth2"
                : provider === "lever" || provider === "recruiterbox" || provider === "bamboohr"
                  ? "basic"
                  : "api_key",
          provider_details: providerDetails,
        }),
      });
      if (response.ok && provider !== "workday" && provider !== "icims") {
        const integration = await response.json();
        if (onSyncRequested) {
          onSyncRequested(integration.id);
        } else {
          const syncResponse = await fetch(
            `${API_BASE_URL}/ats-migrations/integrations/${integration.id}/sync`,
            { method: "POST", credentials: "include" },
          );
          setMessage(
            syncResponse.ok
              ? connectionType === "smartats_bridge"
                ? "Bridge connected. Background sync started."
                : "Connected. Background sync started."
              : `Connected, but sync did not start: ${await responseError(syncResponse)}`,
          );
        }
      } else {
        setMessage(response.ok ? "Setup request submitted." : await responseError(response));
      }
      if (response.ok) {
        setKey("");
        setClientId("");
        setDetails("");
        setOpen(null);
      }
      await load();
    } catch {
      setMessage("Unable to reach staging. Check your login and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function connectGeneric() {
    let mapping: Record<string, Record<string, string>>;
    let endpointConfig: Record<string, Record<string, unknown>>;
    try {
      const parsedMapping = JSON.parse(generic.mapping) as Record<string, unknown>;
      mapping = Object.values(parsedMapping).some(
        (value) => value !== null && typeof value === "object" && !Array.isArray(value),
      )
        ? (parsedMapping as Record<string, Record<string, string>>)
        : { candidate: parsedMapping as Record<string, string> };
      endpointConfig = JSON.parse(generic.endpoints);
    } catch {
      setMessage("Endpoint and field mappings must be valid JSON.");
      return;
    }
    const response = await fetch(`${API_BASE_URL}/ats-migrations/generic`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        display_name: generic.name,
        base_url: generic.baseUrl,
        candidates_endpoint_path: generic.path,
        endpoint_config: endpointConfig,
        auth_header_name: generic.header,
        pagination_style: "page",
        since_param_name: generic.since,
        auth_type: generic.auth,
        api_key: key || null,
        client_id: generic.clientId || null,
        client_secret: generic.clientSecret || null,
        authorize_url: generic.authorizeUrl || null,
        token_url: generic.tokenUrl || null,
        field_mapping_config: mapping,
      }),
    });
    if (response.ok) {
      const integration = await response.json();
      const syncResponse = await fetch(
        `${API_BASE_URL}/ats-migrations/integrations/${integration.id}/sync`,
        { method: "POST", credentials: "include" },
      );
      setMessage(
        syncResponse.ok
          ? "Generic ATS connected. Background sync started."
          : `Connected, but sync could not be started (${syncResponse.status}).`,
      );
    } else {
      setMessage(`Unable to save the generic connector (${response.status}).`);
    }
    setKey("");
    await load();
  }

  async function disconnect(id: string) {
    await fetch(`${API_BASE_URL}/ats-migrations/integrations/${id}/disconnect`, {
      method: "POST",
      credentials: "include",
    });
    await load();
  }

  return (
    <section className="mt-6 space-y-4" aria-labelledby={`${connectionType}-providers-title`}>
      <div>
        <h2 id={`${connectionType}-providers-title`} className="text-base font-semibold">
          {connectionType === "smartats_bridge" ? "Migration Bridge" : "Import from your ATS"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {connectionType === "smartats_bridge"
            ? "Connect a read-only provider credential, then review each import before it reaches Candidates."
            : "Connect a provider, then review each imported batch before it reaches Candidates."}
        </p>
      </div>
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {providers
          .filter(([id]) => connectionType === "api" || (id !== "workday" && id !== "icims"))
          .map(([id, name, description]) => {
            const item = existing(id);
            const pending = id === "workday" || id === "icims";
            const connected = Boolean(item && ["connected", "syncing"].includes(item.status));
            return (
              <div key={id} className="rounded-lg border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium">{name}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{description}</p>
                  </div>
                  {connected ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                      <Check className="h-3 w-3" />
                      Connected
                    </span>
                  ) : item?.status === "pending_provider_setup" ? (
                    <span className="text-xs text-amber-600">Pending setup</span>
                  ) : item?.status === "error" ? (
                    <span className="text-xs text-destructive">Connection error</span>
                  ) : null}
                </div>
                {item && connected ? (
                  <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                    <div>
                      <span>
                        {item.status === "syncing"
                          ? "Syncing"
                          : item.masked_key_last4
                            ? `Key ends in ${item.masked_key_last4}`
                            : "Credential saved"}
                        {item.last_synced_at
                          ? ` · Last synced ${new Date(item.last_synced_at).toLocaleString()}`
                          : ""}
                      </span>
                      {item.provider_details?.last_sync_error && (
                        <p className="mt-2 max-w-xl text-destructive">
                          {item.provider_details.last_sync_error}
                        </p>
                      )}
                      {connectionType === "smartats_bridge" && item.bridge_tools?.length ? (
                        <p className="mt-2 max-w-xl">Read tools: {item.bridge_tools.join(", ")}</p>
                      ) : null}
                    </div>
                    <div className="flex gap-2">
                      {item.status !== "syncing" && (
                        <Button
                          size="sm"
                          variant="outline"
                          pending={syncingId === item.id}
                          onClick={() => void sync(item.id)}
                        >
                          Sync
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => disconnect(item.id)}>
                        <Unplug className="mr-1 h-3 w-3" />
                        Disconnect
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-4"
                      onClick={() => setOpen(open === id ? null : id)}
                    >
                      <Plug className="mr-2 h-3 w-3" />
                      Connect
                    </Button>
                    {open === id && (
                      <div className="mt-3 space-y-3 border-t pt-3">
                        <AtsCredentialGuide provider={id} />
                        {pending ? (
                          <>
                            <textarea
                              className="min-h-20 w-full rounded-md border bg-background p-2 text-sm"
                              placeholder="Tenant and contact details"
                              value={details}
                              onChange={(event) => setDetails(event.target.value)}
                            />
                            <Button size="sm" pending={busy} onClick={() => void connect(id)}>
                              Submit setup request
                            </Button>
                          </>
                        ) : (id as string) === "generic" ? (
                          <>
                            <input
                              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                              placeholder="Display name"
                              value={generic.name}
                              onChange={(event) =>
                                setGeneric({ ...generic, name: event.target.value })
                              }
                            />
                            <textarea
                              className="min-h-28 w-full rounded-md border bg-background p-2 font-mono text-xs"
                              placeholder="Endpoint configuration JSON"
                              value={generic.endpoints}
                              onChange={(event) =>
                                setGeneric({ ...generic, endpoints: event.target.value })
                              }
                            />
                            <input
                              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                              placeholder="Base URL"
                              value={generic.baseUrl}
                              onChange={(event) =>
                                setGeneric({ ...generic, baseUrl: event.target.value })
                              }
                            />
                            <select
                              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                              value={generic.auth}
                              onChange={(event) =>
                                setGeneric({ ...generic, auth: event.target.value })
                              }
                            >
                              <option value="api_key">Static API key</option>
                              <option value="bearer">Bearer token</option>
                              <option value="basic">Basic credential</option>
                              <option value="oauth2">OAuth access token</option>
                              <option value="none">No authentication</option>
                            </select>
                            <input
                              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                              placeholder="Candidates endpoint path"
                              value={generic.path}
                              onChange={(event) =>
                                setGeneric({ ...generic, path: event.target.value })
                              }
                            />
                            <input
                              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                              placeholder="Auth header name"
                              value={generic.header}
                              onChange={(event) =>
                                setGeneric({ ...generic, header: event.target.value })
                              }
                            />
                            {generic.auth !== "none" && (
                              <input
                                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                                placeholder={
                                  generic.auth === "oauth2"
                                    ? "OAuth access token"
                                    : "API key or credential"
                                }
                                type="password"
                                value={key}
                                onChange={(event) => setKey(event.target.value)}
                              />
                            )}
                            <textarea
                              className="min-h-20 w-full rounded-md border bg-background p-2 text-sm"
                              placeholder="Entity field mapping JSON"
                              value={generic.mapping}
                              onChange={(event) =>
                                setGeneric({ ...generic, mapping: event.target.value })
                              }
                            />
                            <Button size="sm" onClick={() => void connectGeneric()}>
                              Save &amp; Sync
                            </Button>
                          </>
                        ) : (
                          <>
                            {id === "greenhouse" && (
                              <input
                                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                                placeholder="Greenhouse OAuth client ID"
                                value={clientId}
                                onChange={(event) => setClientId(event.target.value)}
                              />
                            )}
                            {(id === "bamboohr" || id === "workable") && (
                              <input
                                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                                placeholder={
                                  id === "workable"
                                    ? "https://companyname.workable.com"
                                    : `${name} subdomain or full URL`
                                }
                                value={subdomain}
                                onChange={(event) => setSubdomain(event.target.value)}
                              />
                            )}
                            <input
                              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                              placeholder={
                                id === "greenhouse"
                                  ? "Greenhouse OAuth client secret"
                                  : id === "recruiterbox"
                                    ? "Recruiterbox API key"
                                    : "Paste API key or token"
                              }
                              type="password"
                              value={key}
                              onChange={(event) => setKey(event.target.value)}
                            />
                            {item?.provider_details?.last_sync_error && (
                              <p className="text-sm text-destructive">
                                {item.provider_details.last_sync_error}
                              </p>
                            )}
                            <Button size="sm" pending={busy} onClick={() => void connect(id)}>
                              Save &amp; Sync
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
      </div>
    </section>
  );
}

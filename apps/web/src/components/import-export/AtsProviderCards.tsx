"use client";

import { useEffect, useState } from "react";
import { Check, Plug, Unplug } from "lucide-react";
import { Button } from "@onehash/ui/button";
import { API_BASE_URL } from "@/api";

type Integration = {
  id: string;
  provider: string;
  status: string;
  last_synced_at: string | null;
  masked_key_last4?: string | null;
};

type Capability = {
  provider: string;
  display_name: string;
  entities: Record<string, boolean>;
  mapping_template: Record<string, Record<string, string>>;
};

const providers = [
  ["greenhouse", "Greenhouse", "API key with Basic Auth"],
  ["lever", "Lever", "API key"],
  ["workday", "Workday", "Provider admin setup"],
  ["icims", "iCIMS", "Provider authorization"],
  ["smartrecruiters", "SmartRecruiters", "API key"],
  ["bamboohr", "BambooHR", "API key and company subdomain"],
  ["workable", "Workable", "Bearer token"],
] as const;

export function AtsProviderCards() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [key, setKey] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [details, setDetails] = useState("");
  const [message, setMessage] = useState("");
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [template, setTemplate] = useState<string | null>(null);
  const [generic, setGeneric] = useState({
    name: "",
    baseUrl: "",
    path: "/candidates",
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
    const capabilityResponse = await fetch(`${API_BASE_URL}/ats-migrations/capabilities`, {
      credentials: "include",
    });
    if (capabilityResponse.ok) setCapabilities(await capabilityResponse.json());
  }

  useEffect(() => {
    void load();
  }, []);

  function existing(provider: string) {
    return integrations.find((item) => item.provider === provider);
  }

  async function connect(provider: string) {
    let providerDetails: Record<string, string> = {};
    if (provider === "workday" || provider === "icims") {
      providerDetails = { setup_request: details };
    } else if (provider === "bamboohr") {
      providerDetails = { subdomain };
    }
    const response = await fetch(`${API_BASE_URL}/ats-migrations/integrations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        provider,
        base_url: "http://localhost",
        api_key: key || null,
        auth_type: provider === "workable" ? "bearer" : "api_key",
        provider_details: providerDetails,
      }),
    });
    if (response.ok && provider !== "workday" && provider !== "icims") {
      const integration = await response.json();
      const syncResponse = await fetch(
        `${API_BASE_URL}/ats-migrations/integrations/${integration.id}/sync`,
        { method: "POST", credentials: "include" },
      );
      setMessage(
        syncResponse.ok
          ? "Connected. Background sync started."
          : "Connected, but background sync could not be started.",
      );
    } else {
      setMessage(response.ok ? "Setup request submitted." : "Unable to save this connection.");
    }
    setKey("");
    setDetails("");
    await load();
  }

  async function connectGeneric() {
    let mapping: Record<string, string>;
    try {
      mapping = JSON.parse(generic.mapping);
    } catch {
      setMessage("Field mapping must be valid JSON.");
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
        auth_header_name: generic.header,
        pagination_style: "page",
        since_param_name: generic.since,
        auth_type: generic.auth,
        api_key: key || null,
        client_id: generic.clientId || null,
        client_secret: generic.clientSecret || null,
        authorize_url: generic.authorizeUrl || null,
        token_url: generic.tokenUrl || null,
        field_mapping_config: { candidate: mapping },
      }),
    });
    setMessage(response.ok ? "Generic ATS connected." : "Unable to save the generic connector.");
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
    <section className="mt-6 space-y-4" aria-labelledby="ats-providers-title">
      <div>
        <h2 id="ats-providers-title" className="text-base font-semibold">
          Import from your ATS
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect a provider, then review each imported batch before it reaches Candidates.
        </p>
      </div>
      {capabilities.length > 0 && (
        <div className="overflow-x-auto rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-medium">Provider capabilities</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Availability is read from the active connector configuration.
              </p>
            </div>
          </div>
          <table className="mt-3 w-full min-w-[680px] text-left text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-2">Provider</th>
                {[
                  "jobs",
                  "stages",
                  "candidates",
                  "applications",
                  "resumes",
                  "interviews",
                  "notes",
                ].map((entity) => (
                  <th key={entity} className="px-2 py-2 capitalize">
                    {entity}
                  </th>
                ))}
                <th className="py-2">Template</th>
              </tr>
            </thead>
            <tbody>
              {capabilities
                .filter((item) => ["greenhouse", "lever", "workable"].includes(item.provider))
                .map((item) => (
                  <tr key={item.provider} className="border-t">
                    <td className="py-2 font-medium">{item.display_name}</td>
                    {[
                      "jobs",
                      "stages",
                      "candidates",
                      "applications",
                      "resumes",
                      "interviews",
                      "notes",
                    ].map((entity) => (
                      <td key={entity} className="px-2 py-2">
                        {item.entities[entity] ? "Supported" : "Unavailable"}
                      </td>
                    ))}
                    <td className="py-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setTemplate(template === item.provider ? null : item.provider)
                        }
                      >
                        {template === item.provider ? "Hide" : "View"}
                      </Button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {template && (
            <pre className="mt-3 max-h-64 overflow-auto rounded-md bg-muted/40 p-3 text-xs">
              {JSON.stringify(
                capabilities.find((item) => item.provider === template)?.mapping_template,
                null,
                2,
              )}
            </pre>
          )}
        </div>
      )}
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {providers.map(([id, name, description]) => {
          const item = existing(id);
          const pending = id === "workday" || id === "icims";
          return (
            <div key={id} className="rounded-lg border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-medium">{name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{description}</p>
                </div>
                {item?.status === "connected" ? (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                    <Check className="h-3 w-3" />
                    Connected
                  </span>
                ) : item?.status === "pending_provider_setup" ? (
                  <span className="text-xs text-amber-600">Pending setup</span>
                ) : null}
              </div>
              {item?.status === "connected" ? (
                <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {item.masked_key_last4
                      ? `Key ends in ${item.masked_key_last4}`
                      : "Credential saved"}
                    {item.last_synced_at
                      ? ` · Last synced ${new Date(item.last_synced_at).toLocaleString()}`
                      : ""}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => disconnect(item.id)}>
                    <Unplug className="mr-1 h-3 w-3" />
                    Disconnect
                  </Button>
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
                      {pending ? (
                        <>
                          <p className="text-sm text-muted-foreground">
                            {id === "workday"
                              ? "Your Workday admin must create an ISU and custom report first."
                              : "An iCIMS Integration Specialist must authorize the integration."}
                          </p>
                          <textarea
                            className="min-h-20 w-full rounded-md border bg-background p-2 text-sm"
                            placeholder="Tenant and contact details"
                            value={details}
                            onChange={(event) => setDetails(event.target.value)}
                          />
                          <Button size="sm" onClick={() => connect(id)}>
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
                            <option value="oauth2">OAuth2</option>
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
                          {generic.auth === "oauth2" ? (
                            <>
                              <input
                                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                                placeholder="OAuth client ID"
                                value={generic.clientId}
                                onChange={(event) =>
                                  setGeneric({ ...generic, clientId: event.target.value })
                                }
                              />
                              <input
                                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                                placeholder="OAuth client secret"
                                type="password"
                                value={generic.clientSecret}
                                onChange={(event) =>
                                  setGeneric({ ...generic, clientSecret: event.target.value })
                                }
                              />
                              <input
                                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                                placeholder="Authorize URL"
                                value={generic.authorizeUrl}
                                onChange={(event) =>
                                  setGeneric({ ...generic, authorizeUrl: event.target.value })
                                }
                              />
                              <input
                                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                                placeholder="Token URL"
                                value={generic.tokenUrl}
                                onChange={(event) =>
                                  setGeneric({ ...generic, tokenUrl: event.target.value })
                                }
                              />
                            </>
                          ) : (
                            <input
                              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                              placeholder="API key"
                              type="password"
                              value={key}
                              onChange={(event) => setKey(event.target.value)}
                            />
                          )}
                          <textarea
                            className="min-h-20 w-full rounded-md border bg-background p-2 text-sm"
                            placeholder="Field mapping JSON"
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
                          {id === "bamboohr" && (
                            <input
                              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                              placeholder="Company subdomain"
                              value={subdomain}
                              onChange={(event) => setSubdomain(event.target.value)}
                            />
                          )}
                          <input
                            className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                            placeholder="Paste API key or token"
                            type="password"
                            value={key}
                            onChange={(event) => setKey(event.target.value)}
                          />
                          <Button size="sm" onClick={() => connect(id)}>
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

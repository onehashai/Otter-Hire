"use client";

import { useState, type ReactNode } from "react";
import { Check, Clipboard, KeyRound } from "lucide-react";
import { Button } from "@onehash/ui/button";
import { API_BASE_URL } from "@/api";

const MCP_CONFIGURED_URL = (
  process.env.NEXT_PUBLIC_MCP_SERVER_URL || "https://smartats.in/mcp/sse"
).replace(/\/+$/, "");
const MCP_OAUTH_URL = MCP_CONFIGURED_URL.replace(/\/sse$/, "");
const MCP_API_KEY_URL = MCP_CONFIGURED_URL.endsWith("/sse")
  ? MCP_CONFIGURED_URL
  : `${MCP_OAUTH_URL}/sse`;

export function McpSetupPanel({ canManage = true }: { canManage?: boolean }) {
  const [name, setName] = useState("Otter Hire AI Client");
  const [scope, setScope] = useState<"read_only" | "read_write">("read_only");
  const [key, setKey] = useState("");
  const [message, setMessage] = useState("");
  const [oauthUrlCopied, setOauthUrlCopied] = useState(false);
  const [configCopied, setConfigCopied] = useState(false);
  const apiKeyConfig = key
    ? JSON.stringify(
        {
          mcpServers: {
            "otter-hire": {
              command: "npx",
              args: [
                "-y",
                "mcp-remote",
                MCP_API_KEY_URL,
                "--transport",
                "sse-only",
                "--header",
                "Authorization:${OTTER_HIRE_AUTH_HEADER}",
              ],
              env: { OTTER_HIRE_AUTH_HEADER: `Bearer ${key}` },
            },
          },
        },
        null,
        2,
      )
    : "Generate an MCP key to create your Claude Desktop configuration.";
  const genericPrompt = `You are connected to Otter Hire. Help me migrate candidates safely.

1. List the connected ATS integrations.
2. Preview a sync first; do not change data during the preview.
3. Start the sync only after I explicitly approve it.
4. Wait for the pending import batch, then show total, valid, duplicate, and error rows.
5. Preview the batch approval and explain every duplicate and error.
6. Do not approve or commit anything unless I explicitly say: Approve batch <batch_id>.
7. When I approve, commit the batch and report the final counts.`;

  async function generateKey() {
    const response = await fetch(`${API_BASE_URL}/mcp-keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name, scope }),
    });
    const payload = await response.json();
    if (response.ok) {
      setKey(payload.key);
      setMessage("Copy this key now. It will not be shown again.");
    } else {
      setMessage(payload.detail || "Unable to generate MCP key.");
    }
  }

  async function copyKey() {
    await navigator.clipboard.writeText(key);
    setMessage("MCP key copied.");
  }

  async function copyPrompt() {
    await navigator.clipboard.writeText(genericPrompt);
    setMessage("Prompt copied.");
  }

  async function copyOauthUrl() {
    await navigator.clipboard.writeText(MCP_OAUTH_URL);
    setOauthUrlCopied(true);
    window.setTimeout(() => setOauthUrlCopied(false), 2000);
  }

  async function copyConfig() {
    if (!key) return;
    await navigator.clipboard.writeText(apiKeyConfig);
    setConfigCopied(true);
    setMessage("Claude Desktop config copied. Keep it private because it contains your MCP key.");
    window.setTimeout(() => setConfigCopied(false), 2000);
  }

  function Step({
    number,
    title,
    children,
  }: {
    number: number;
    title: string;
    children: ReactNode;
  }) {
    return (
      <li className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full border bg-background text-sm font-semibold">
          {number}
        </span>
        <div className="space-y-1 pt-1">
          <p className="text-sm font-medium">{title}</p>
          <div className="text-sm leading-6 text-muted-foreground">{children}</div>
        </div>
      </li>
    );
  }

  return (
    <section className="space-y-5" aria-labelledby="mcp-title">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
        <div>
          <h2 id="mcp-title" className="text-base font-semibold">
            MCP Server
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect Claude, Cursor, or another MCP-compatible AI client to Otter Hire.
          </p>
        </div>
        <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
          Admin setup
        </span>
      </div>

      <section className="space-y-4 border-b pb-6" aria-labelledby="mcp-oauth-title">
        <div>
          <h3 id="mcp-oauth-title" className="text-sm font-semibold">
            1. Connect with OAuth 2.0{" "}
            <span className="font-normal text-muted-foreground">(Recommended)</span>
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in through Otter Hire and approve access in your browser. No API key or JSON
            editing is needed.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted/40 p-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">Remote MCP server URL</p>
            <code className="break-all text-xs text-muted-foreground">{MCP_OAUTH_URL}</code>
          </div>
          <Button variant="outline" size="sm" onClick={() => void copyOauthUrl()}>
            {oauthUrlCopied ? (
              <Check className="mr-2 h-4 w-4" />
            ) : (
              <Clipboard className="mr-2 h-4 w-4" />
            )}
            {oauthUrlCopied ? "Copied" : "Copy URL"}
          </Button>
        </div>
        <ol className="space-y-4">
          <Step number={1} title="Open your AI client’s connector settings">
            In Claude, open <strong className="text-foreground">Settings → Connectors</strong>,
            choose <strong className="text-foreground">Add</strong>, then select the option to add a
            custom connector.
          </Step>
          <Step number={2} title="Add the Otter Hire server">
            Enter <strong className="text-foreground">Otter Hire</strong> as the name, paste the
            Remote MCP server URL above, and choose <strong className="text-foreground">Add</strong>{" "}
            or <strong className="text-foreground">Connect</strong>.
          </Step>
          <Step number={3} title="Sign in and approve access">
            When prompted, sign in to the Otter Hire account and workspace you want to use. Review
            the requested permissions and approve the connection.
          </Step>
          <Step number={4} title="Enable it in a conversation">
            Start or reopen a chat, open the tools/connectors menu, and make sure Otter Hire is
            enabled. Ask the client to list available tools to verify the connection.
          </Step>
        </ol>
      </section>

      <section className="space-y-4" aria-labelledby="mcp-key-title">
        <div>
          <h3 id="mcp-key-title" className="text-sm font-semibold">
            2. Connect with an MCP API key{" "}
            <span className="font-normal text-muted-foreground">(Manual setup)</span>
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Use this method for Claude Desktop clients configured with a local MCP bridge. It
            requires Node.js 18 or newer and editing Claude’s JSON config.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span>Key name</span>
            <input
              className="h-9 rounded-md border bg-background px-2"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span>Permission</span>
            <select
              className="h-9 rounded-md border bg-background px-2"
              value={scope}
              onChange={(event) => setScope(event.target.value as typeof scope)}
            >
              <option value="read_only">Read only</option>
              <option value="read_write">Read and write</option>
            </select>
          </label>
        </div>
        <div className="rounded-md bg-muted/40 p-3 text-sm">
          <p className="font-medium">Server URL</p>
          <code className="break-all text-xs text-muted-foreground">{MCP_API_KEY_URL}</code>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={!canManage} onClick={() => void generateKey()}>
            <KeyRound className="mr-2 h-4 w-4" />
            Generate MCP key
          </Button>
          {key && (
            <Button variant="outline" onClick={() => void copyKey()}>
              <Clipboard className="mr-2 h-4 w-4" />
              Copy key
            </Button>
          )}
        </div>
        {!canManage && (
          <p className="text-sm text-muted-foreground">
            Only organization owners and administrators can generate connection keys.
          </p>
        )}
        {key && (
          <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/30">
            <p className="font-medium">Copy this key now</p>
            <code className="block break-all text-xs">{key}</code>
            <p className="text-xs text-muted-foreground">
              It will not be shown again after you leave this page.
            </p>
          </div>
        )}
        {message && <p className="text-sm text-muted-foreground">{message}</p>}
        <ol className="space-y-5 border-t pt-5">
          <Step number={1} title="Create a key">
            Choose a key name and permission above, then select{" "}
            <strong className="text-foreground">Generate MCP key</strong>. Read only is recommended
            unless the client needs to make changes. Copy and store the key securely; it is shown
            only once.
          </Step>
          <Step number={2} title="Open Claude Desktop’s configuration file">
            In Claude Desktop, open{" "}
            <strong className="text-foreground">Settings → Developer → Edit Config</strong>. On
            macOS the file is{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs text-foreground">
              ~/Library/Application Support/Claude/claude_desktop_config.json
            </code>
            . Keep a copy of its current contents before editing.
          </Step>
          <Step number={3} title="Add the Otter Hire server entry">
            Use the configuration below. Merge the{" "}
            <code className="text-xs text-foreground">otter-hire</code> entry into the existing{" "}
            <code className="text-xs text-foreground">mcpServers</code> object; do not replace other
            server entries or the rest of the file. Select{" "}
            <strong className="text-foreground">Copy config</strong> after generating a key, then
            replace the matching entry or paste it into the object. The copied config contains your
            secret key, so do not share it or commit it to source control.
          </Step>
          <li className="ml-11 space-y-2">
            <pre className="max-h-72 overflow-auto rounded-md border bg-muted/30 p-3 text-xs leading-5">
              <code>{apiKeyConfig}</code>
            </pre>
            <Button variant="outline" size="sm" disabled={!key} onClick={() => void copyConfig()}>
              {configCopied ? (
                <Check className="mr-2 h-4 w-4" />
              ) : (
                <Clipboard className="mr-2 h-4 w-4" />
              )}
              {configCopied ? "Config copied" : "Copy config"}
            </Button>
          </li>
          <Step number={4} title="Save and restart Claude Desktop">
            Save the JSON file, fully quit Claude Desktop with{" "}
            <strong className="text-foreground">Cmd+Q</strong>, then reopen it. Claude starts the
            local <code className="text-xs text-foreground">mcp-remote</code> bridge and connects to
            the server URL shown above.
          </Step>
          <Step number={5} title="Confirm the connection">
            Open a new chat and check the tools menu for Otter Hire. Ask Claude to list the
            available Otter Hire tools. Start with a read-only preview before approving any action
            that changes ATS data.
          </Step>
        </ol>
        <details className="border-t pt-4">
          <summary className="cursor-pointer text-sm font-medium">
            Show starter prompt for your AI client
          </summary>
          <div className="mt-3 space-y-2">
            <textarea
              readOnly
              className="min-h-36 w-full rounded-md border bg-background p-3 text-xs"
              value={genericPrompt}
            />
            <Button variant="outline" size="sm" onClick={() => void copyPrompt()}>
              <Clipboard className="mr-2 h-4 w-4" />
              Copy prompt
            </Button>
          </div>
        </details>
      </section>
    </section>
  );
}

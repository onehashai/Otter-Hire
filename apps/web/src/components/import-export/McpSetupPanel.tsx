"use client";

import { useState } from "react";
import { Clipboard, KeyRound } from "lucide-react";
import { Button } from "@onehash/ui/button";
import { API_BASE_URL } from "@/api";

const MCP_URL = process.env.NEXT_PUBLIC_MCP_SERVER_URL || "http://127.0.0.1:8765/sse";

export function McpSetupPanel() {
  const [name, setName] = useState("Otter Hire MCP");
  const [scope, setScope] = useState<"read_only" | "read_write">("read_only");
  const [key, setKey] = useState("");
  const [message, setMessage] = useState("");
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

  return (
    <section className="mt-6 space-y-5 rounded-lg border bg-card p-5" aria-labelledby="mcp-title">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
        <div>
          <h2 id="mcp-title" className="text-base font-semibold">
            Otter Hire MCP server
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect Claude, Cursor, or another MCP-compatible AI client to Otter Hire.
          </p>
        </div>
        <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
          Admin setup
        </span>
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
        <code className="break-all text-xs text-muted-foreground">{MCP_URL}</code>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void generateKey()}>
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
      <ol className="grid gap-3 border-t pt-4 text-sm md:grid-cols-3">
        <li className="flex gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted font-medium">
            1
          </span>
          <span className="text-muted-foreground">
            Generate a read-only key for searching, or a read/write key for actions.
          </span>
        </li>
        <li className="flex gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted font-medium">
            2
          </span>
          <span className="text-muted-foreground">
            Add the server URL and key to your MCP-compatible AI client.
          </span>
        </li>
        <li className="flex gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted font-medium">
            3
          </span>
          <span className="text-muted-foreground">
            Ask the client to preview first. Approval is required before changes.
          </span>
        </li>
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
  );
}

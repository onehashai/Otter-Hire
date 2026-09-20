"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createDeveloperApiKey,
  getDeveloperApiKeys,
  revokeDeveloperApiKey,
  type DeveloperApiKey,
} from "@/api";
import { copyToClipboard } from "@/lib/clipboard";
import { Badge } from "@onehash/ui/badge";
import { Button } from "@onehash/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@onehash/ui/dialog";
import { InputField } from "@onehash/ui/input";
import { toast } from "@onehash/ui/sonner";
import { Copy, KeyRound, Loader2, Plus, Trash2 } from "lucide-react";

type DeveloperApiKeysProps = {
  canManage: boolean;
};

function formatTimestamp(value: string | null): string {
  if (!value) return "Never";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function DeveloperApiKeys({ canManage }: DeveloperApiKeysProps) {
  const [keys, setKeys] = useState<DeveloperApiKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [keyName, setKeyName] = useState("External integration");
  const [generatedKey, setGeneratedKey] = useState("");
  const [generating, setGenerating] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<DeveloperApiKey | null>(null);
  const [revoking, setRevoking] = useState(false);

  const loadKeys = useCallback(async () => {
    if (!canManage) return;
    setLoading(true);
    try {
      const response = await getDeveloperApiKeys();
      setKeys(response.items);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load API keys.");
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    void loadKeys();
  }, [loadKeys]);

  const handleCreateOpenChange = (open: boolean) => {
    setCreateOpen(open);
    if (!open) {
      setGeneratedKey("");
      setKeyName("External integration");
    }
  };

  const handleGenerate = async () => {
    const name = keyName.trim();
    if (!name) return;

    setGenerating(true);
    try {
      const response = await createDeveloperApiKey(name);
      setGeneratedKey(response.key);
      await loadKeys();
      toast.success("API key generated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to generate API key.");
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    const copied = await copyToClipboard(generatedKey);
    if (copied) toast.success("API key copied.");
    else toast.error("Unable to copy API key.");
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      await revokeDeveloperApiKey(revokeTarget.id);
      setRevokeTarget(null);
      await loadKeys();
      toast.success("API key revoked.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to revoke API key.");
    } finally {
      setRevoking(false);
    }
  };

  return (
    <section className="space-y-4" aria-labelledby="developer-api-title">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
        <div>
          <h2 id="developer-api-title" className="text-base font-semibold">
            API Key
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Organization credentials for external API access.
          </p>
        </div>
        <Button
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => setCreateOpen(true)}
          disabled={!canManage}
        >
          <Plus className="h-3.5 w-3.5" />
          Generate key
        </Button>
      </div>

      {!canManage ? (
        <div className="rounded-md border px-4 py-6 text-sm text-muted-foreground">
          Owner or admin access is required to manage API keys.
        </div>
      ) : loading ? (
        <div className="flex min-h-24 items-center justify-center rounded-md border">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : keys.length === 0 ? (
        <div className="rounded-md border px-4 py-6 text-sm text-muted-foreground">
          No API keys generated.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Key</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Last used</th>
                <th className="w-24 px-4 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {keys.map((apiKey) => (
                <tr key={apiKey.id}>
                  <td className="px-4 py-3 font-medium">{apiKey.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {apiKey.prefix}...
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={apiKey.active ? "secondary" : "outline"}>
                      {apiKey.active ? "Active" : "Revoked"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {formatTimestamp(apiKey.created_at)}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {formatTimestamp(apiKey.last_used_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1.5 text-xs text-destructive hover:text-destructive"
                      disabled={!apiKey.active}
                      onClick={() => setRevokeTarget(apiKey)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Revoke
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={handleCreateOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Generate API key</DialogTitle>
            <DialogDescription>
              The key belongs to this organization and is shown only once.
            </DialogDescription>
          </DialogHeader>

          {generatedKey ? (
            <div className="space-y-3">
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <KeyRound className="h-4 w-4" />
                  Copy this key now
                </div>
                <code className="block break-all text-xs">{generatedKey}</code>
              </div>
              <p className="text-xs text-muted-foreground">
                Send it in the <code>X-API-Key</code> header. Closing this dialog permanently hides
                the full value.
              </p>
            </div>
          ) : (
            <InputField
              label="Key name"
              value={keyName}
              maxLength={120}
              autoFocus
              onChange={(event) => setKeyName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && keyName.trim()) void handleGenerate();
              }}
            />
          )}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleCreateOpenChange(false)}
              disabled={generating}
            >
              {generatedKey ? "Done" : "Cancel"}
            </Button>
            {generatedKey ? (
              <Button type="button" size="sm" className="gap-1.5" onClick={() => void handleCopy()}>
                <Copy className="h-3.5 w-3.5" />
                Copy key
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                className="gap-1.5"
                onClick={() => void handleGenerate()}
                disabled={generating || !keyName.trim()}
              >
                {generating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <KeyRound className="h-3.5 w-3.5" />
                )}
                Generate
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={revokeTarget !== null} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Revoke API key</DialogTitle>
            <DialogDescription>
              {revokeTarget?.name} will immediately stop authenticating API requests.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRevokeTarget(null)}
              disabled={revoking}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => void handleRevoke()}
              disabled={revoking}
            >
              {revoking ? "Revoking..." : "Revoke"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

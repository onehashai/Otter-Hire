"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ListChecks, Loader2, X } from "lucide-react";
import { Button } from "@onehash/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@onehash/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@onehash/ui/tabs";
import { ImportExportHub } from "@/components/import-export/ImportExportHub";
import { AtsProviderCards } from "@/components/import-export/AtsProviderCards";
import { McpProviderCards } from "@/components/import-export/McpProviderCards";
import { API_BASE_URL } from "@/api";

const AUTO_IMPORT_ENABLED = process.env.NEXT_PUBLIC_ATS_AUTO_IMPORT_ENABLED !== "false";

type Batch = {
  id: string;
  integration_id: string;
  source: string;
  status: string;
  total_rows: number;
  valid_rows: number;
  flagged_rows: number;
  error_rows: number;
  created_at: string;
  entity_counts?: Record<string, number | string>;
  warnings?: string[];
  error_reason?: string | null;
};

type Integration = {
  id: string;
  provider: string;
  connection_type?: "api" | "native_mcp" | "smartats_bridge";
  mcp_connection_type?: string | null;
};

const PROVIDER_LABELS: Record<string, string> = {
  bamboohr: "BambooHR",
  greenhouse: "Greenhouse",
  icims: "iCIMS",
  lever: "Lever",
  smartrecruiters: "SmartRecruiters",
  workable: "Workable",
  workday: "Workday",
};

function providerLabel(provider: string) {
  return (
    PROVIDER_LABELS[provider] ||
    provider.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase())
  );
}

type ImportChannel = "api" | "bridge" | "mcp";
type SyncRequest = { integrationId: string; requestId: number };

const CHANNEL_LABELS: Record<ImportChannel, string> = {
  api: "API",
  bridge: "Migration Bridge",
  mcp: "MCP",
};

function ImportBatchesDialog({
  channel,
  open,
  onOpenChange,
  syncRequest,
}: {
  channel: ImportChannel;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  syncRequest: SyncRequest | null;
}) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busyBatch, setBusyBatch] = useState<string | null>(null);
  const actionPending = useRef(false);
  const [message, setMessage] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const syncStarts = useRef(new Map<number, Promise<Response>>());

  useEffect(() => {
    if (!syncRequest) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    setSyncing(true);
    setSyncError("");
    setMessage("");
    setSelectedBatch(null);
    const base = `${API_BASE_URL}/ats-migrations/integrations/${syncRequest.integrationId}/sync`;

    async function readResponse(response: Response) {
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.detail || payload.message || "Sync could not be started.");
      return payload;
    }

    async function followBatch(batchId: string) {
      if (cancelled) return;
      try {
        const batch = await readResponse(
          await fetch(`${API_BASE_URL}/ats-migrations/batches/${batchId}`, {
            credentials: "include",
            cache: "no-store",
          }),
        );
        if (cancelled) return;
        setSelectedBatch(batch);
        setSyncing(false);
        setSyncError("");
        timer = setTimeout(() => void followBatch(batchId), 2000);
      } catch (error) {
        fail(error);
      }
    }

    function fail(error: unknown) {
      if (cancelled) return;
      setSyncing(false);
      setSyncError(
        error instanceof Error ? error.message : "The provider sync could not be completed.",
      );
    }

    async function followSync(workflowId: string) {
      if (cancelled) return;
      try {
        const result = await readResponse(
          await fetch(`${base}/${encodeURIComponent(workflowId)}`, {
            credentials: "include",
            cache: "no-store",
          }),
        );
        if (cancelled) return;
        if (result.batch_id) {
          await followBatch(result.batch_id);
        } else if (result.status === "failed") {
          throw new Error(result.error || "The provider sync failed.");
        } else {
          timer = setTimeout(() => void followSync(workflowId), 2000);
        }
      } catch (error) {
        fail(error);
      }
    }

    // Reuse the POST during effect replays so one click starts only one sync.
    let start = syncStarts.current.get(syncRequest.requestId);
    if (!start) {
      start = fetch(base, { method: "POST", credentials: "include" });
      syncStarts.current.set(syncRequest.requestId, start);
    }
    void start
      .then((response) => readResponse(response.clone()))
      .then(async (result) => {
        if (cancelled) return;
        if (result.batch_id) await followBatch(result.batch_id);
        else if (result.workflow_id) await followSync(result.workflow_id);
        else throw new Error("Sync did not return an import reference. Please try again.");
      })
      .catch(fail);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [syncRequest]);

  const loadBatches = useCallback(async () => {
    try {
      const [batchResponse, integrationResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/ats-migrations/batches`, { credentials: "include" }),
        fetch(`${API_BASE_URL}/ats-migrations/integrations`, { credentials: "include" }),
      ]);
      if (!batchResponse.ok || !integrationResponse.ok) throw new Error("Loading failed");
      const [nextBatches, nextIntegrations] = await Promise.all([
        batchResponse.json(),
        integrationResponse.json(),
      ]);
      setBatches(nextBatches);
      setIntegrations(nextIntegrations);
      setLoadError("");
    } catch {
      setLoadError("Imports could not be refreshed. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  async function runAction(id: string, action: () => Promise<void>) {
    if (actionPending.current) return;
    actionPending.current = true;
    setBusyBatch(id);
    setMessage("");
    try {
      await action();
    } catch {
      setMessage("The request could not be completed. Please refresh imports before trying again.");
    } finally {
      actionPending.current = false;
      setBusyBatch(null);
    }
  }

  async function approve(id: string) {
    const response = await fetch(`${API_BASE_URL}/ats-migrations/batches/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    setMessage(
      response.ok
        ? "Import queued. The batch will update with row results."
        : "Batch approval failed.",
    );
    await loadBatches();
    if (response.ok && selectedBatch?.id === id) {
      setSelectedBatch({ ...selectedBatch, status: "approval_queued" });
    }
  }

  async function reject(id: string) {
    if (!window.confirm("Reject this batch and discard its pending records?")) return;
    const response = await fetch(`${API_BASE_URL}/ats-migrations/batches/${id}/reject`, {
      method: "POST",
      credentials: "include",
    });
    setMessage(response.ok ? "Batch rejected." : "Batch rejection failed.");
    await loadBatches();
    if (response.ok && selectedBatch?.id === id) {
      setSelectedBatch({ ...selectedBatch, status: "rejected" });
    }
  }

  useEffect(() => {
    void loadBatches();
    const interval = window.setInterval(() => {
      void loadBatches();
    }, 5000);
    return () => window.clearInterval(interval);
  }, [loadBatches]);

  const integrationsById = new Map(
    integrations.map((integration) => [integration.id, integration]),
  );
  const channelBatches = batches.filter((batch) => {
    const integration = integrationsById.get(batch.integration_id);
    const connectionType =
      integration?.connection_type || (integration?.mcp_connection_type ? "native_mcp" : "api");
    return channel === "mcp"
      ? connectionType === "native_mcp"
      : channel === "bridge"
        ? connectionType === "smartats_bridge"
        : connectionType === "api";
  });
  const visibleBatches = syncRequest ? (selectedBatch ? [selectedBatch] : []) : channelBatches;
  const channelLabel = CHANNEL_LABELS[channel];

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        onOpenChange(open);
        if (open) void loadBatches();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ListChecks className="mr-2 h-4 w-4" aria-hidden="true" />
          Imports
          {!loading && !loadError && (
            <span className="ml-2 min-w-5 rounded bg-muted px-1 text-xs tabular-nums">
              {channelBatches.length}
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[85dvh] w-[calc(100%-2rem)] max-w-5xl flex-col gap-0 overflow-hidden rounded-lg p-0">
        <DialogHeader className="shrink-0 border-b p-4 text-left sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="tracking-normal">{channelLabel} imports</DialogTitle>
            <DialogClose asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                aria-label="Close imports"
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogClose>
          </div>
          <DialogDescription className="sr-only">
            {channelLabel} import batches and their status.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 space-y-4 overflow-y-auto p-4 sm:p-6">
          {syncRequest && syncing && (
            <p role="status" className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Fetching records for approval...
            </p>
          )}
          {syncError && (
            <p role="alert" className="text-sm text-destructive">
              {syncError}
            </p>
          )}
          {message && (
            <p role="status" className="text-sm text-muted-foreground">
              {message}
            </p>
          )}
          {loadError && (
            <div
              role="alert"
              className="flex flex-wrap items-center gap-2 text-sm text-destructive"
            >
              <span>{loadError}</span>
              <Button variant="outline" size="sm" onClick={() => void loadBatches()}>
                Refresh
              </Button>
            </div>
          )}
          {!syncRequest && loading ? (
            <p role="status" className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading imports...
            </p>
          ) : visibleBatches.length === 0 ? (
            !loadError &&
            !syncRequest && (
              <p className="py-8 text-sm text-muted-foreground">
                No {channelLabel} import batches yet.
              </p>
            )
          ) : (
            <div className="space-y-3">
              {visibleBatches.map((batch) => {
                const integration = integrationsById.get(batch.integration_id);
                const label = integration
                  ? providerLabel(integration.provider)
                  : batch.source === "ats-sync"
                    ? "ATS"
                    : providerLabel(batch.source.replace(/^retry:/, ""));
                const isRetry = batch.source.startsWith("retry:");
                return (
                  <div key={batch.id} className="rounded-lg border bg-card p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium">
                          {label} {channelLabel} {isRetry ? "retry" : "import"}
                        </p>
                        <p className="break-all text-xs text-muted-foreground">{batch.id}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="rounded-md bg-muted px-2 py-1 text-xs">
                          {batch.status}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                      <span>Total: {batch.total_rows}</span>
                      <span>Valid: {batch.valid_rows}</span>
                      <span>Flagged: {batch.flagged_rows}</span>
                      <span>Errors: {batch.error_rows}</span>
                    </div>
                    {batch.entity_counts && (
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {Object.entries(batch.entity_counts).map(([entity, count]) => (
                          <span key={entity} className="capitalize">
                            {entity}: {count}
                          </span>
                        ))}
                      </div>
                    )}
                    {batch.warnings?.map((warning) => (
                      <p key={warning} className="mt-2 break-words text-xs text-amber-600 dark:text-amber-400">
                        {warning}
                      </p>
                    ))}
                    {batch.error_reason && (
                      <p className="mt-3 break-words text-sm text-destructive">
                        Import failed: {batch.error_reason}
                      </p>
                    )}
                    {batch.status === "pending_approval" && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          disabled={busyBatch !== null}
                          onClick={() => void runAction(batch.id, () => approve(batch.id))}
                        >
                          Approve batch
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={busyBatch !== null}
                          onClick={() => void runAction(batch.id, () => reject(batch.id))}
                        >
                          Reject batch
                        </Button>
                      </div>
                    )}
                    {(batch.status === "approval_queued" || busyBatch === batch.id) && (
                      <p
                        role="status"
                        className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"
                      >
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        {batch.status === "approval_queued"
                          ? "Import in progress"
                          : "Updating import..."}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function DataMigrationPage() {
  const [tab, setTab] = useState(AUTO_IMPORT_ENABLED ? "api" : "csv");
  const [importsOpen, setImportsOpen] = useState(false);
  const [syncRequest, setSyncRequest] = useState<SyncRequest | null>(null);
  const nextRequestId = useRef(0);
  function requestSync(integrationId: string) {
    setSyncRequest({ integrationId, requestId: ++nextRequestId.current });
    setImportsOpen(true);
  }
  return (
    <>
      <Tabs
        value={tab}
        onValueChange={(nextTab) => {
          setTab(nextTab);
          setImportsOpen(false);
          setSyncRequest(null);
        }}
        className="mt-8"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            {AUTO_IMPORT_ENABLED && <TabsTrigger value="api">API</TabsTrigger>}
            {AUTO_IMPORT_ENABLED && <TabsTrigger value="mcp">MCP</TabsTrigger>}
            {/*
          {AUTO_IMPORT_ENABLED && <TabsTrigger value="bridge">Migration Bridge</TabsTrigger>}
          */}
            <TabsTrigger value="csv">CSV</TabsTrigger>
          </TabsList>
          {AUTO_IMPORT_ENABLED && (tab === "api" || tab === "mcp") && (
            <ImportBatchesDialog
              key={tab}
              channel={tab}
              open={importsOpen}
              syncRequest={syncRequest}
              onOpenChange={(open) => {
                setImportsOpen(open);
                if (!open) setSyncRequest(null);
              }}
            />
          )}
        </div>
        <TabsContent value="csv">
          <ImportExportHub />
        </TabsContent>
        {AUTO_IMPORT_ENABLED && (
          <TabsContent value="api">
            <AtsProviderCards onSyncRequested={requestSync} />
          </TabsContent>
        )}
        {AUTO_IMPORT_ENABLED && (
          <TabsContent value="mcp">
            <McpProviderCards onSyncRequested={requestSync} />
          </TabsContent>
        )}
        {/*
        {AUTO_IMPORT_ENABLED && (
          <TabsContent value="bridge">
            <AtsProviderCards connectionType="smartats_bridge" />
          </TabsContent>
        )}
        */}
      </Tabs>
    </>
  );
}

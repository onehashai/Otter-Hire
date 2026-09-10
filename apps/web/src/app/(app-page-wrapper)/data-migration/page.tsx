"use client";

import { useEffect, useState } from "react";
import { Button } from "@onehash/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@onehash/ui/tabs";
import { ImportExportHub } from "@/components/import-export/ImportExportHub";
import { AtsProviderCards } from "@/components/import-export/AtsProviderCards";
import { McpSetupPanel } from "@/components/import-export/McpSetupPanel";
import { McpProviderCards } from "@/components/import-export/McpProviderCards";
import { API_BASE_URL } from "@/api";

const AUTO_IMPORT_ENABLED = process.env.NEXT_PUBLIC_ATS_AUTO_IMPORT_ENABLED === "true";
const MCP_ENABLED = process.env.NEXT_PUBLIC_MCP_SERVER_ENABLED === "true";

type Batch = {
  id: string;
  source: string;
  status: string;
  total_rows: number;
  valid_rows: number;
  flagged_rows: number;
  error_rows: number;
  created_at: string;
  entity_counts?: Record<string, number | string>;
};

type BatchRow = {
  id: string;
  row_number: number;
  row_status: "valid" | "duplicate" | "error";
  entity_type?: string;
  error_reason: string | null;
  mapped_payload: Record<string, unknown> | null;
};

type BatchPreview = {
  created: number;
  updated: number;
  skipped: number;
};

function PendingBatches() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);
  const [rows, setRows] = useState<Record<string, BatchRow[]>>({});
  const [previews, setPreviews] = useState<Record<string, BatchPreview>>({});
  const [message, setMessage] = useState("");

  async function loadBatches() {
    const response = await fetch(`${API_BASE_URL}/ats-migrations/batches`, {
      credentials: "include",
    });
    if (response.ok) setBatches(await response.json());
  }

  async function approve(id: string) {
    const response = await fetch(`${API_BASE_URL}/ats-migrations/batches/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    setMessage(response.ok ? "Batch approved successfully." : "Batch approval failed.");
    await loadBatches();
  }

  async function preview(id: string) {
    const response = await fetch(`${API_BASE_URL}/ats-migrations/batches/${id}/preview`, {
      credentials: "include",
    });
    if (response.ok) {
      const data = await response.json();
      setPreviews((current) => ({ [id]: data, ...current }));
    }
  }

  async function retry(id: string, entityType?: string) {
    const response = await fetch(`${API_BASE_URL}/ats-migrations/batches/${id}/retry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(entityType ? { entity_type: entityType } : {}),
    });
    setMessage(
      response.ok ? "Retry batch created for the failed rows." : "Retry could not be started.",
    );
    await loadBatches();
  }

  async function toggleDetails(id: string) {
    if (expandedBatch === id) {
      setExpandedBatch(null);
      return;
    }
    if (!rows[id]) {
      const response = await fetch(`${API_BASE_URL}/ats-migrations/batches/${id}`, {
        credentials: "include",
      });
      if (!response.ok) return;
      const detail = await response.json();
      setRows((current) => ({ ...current, [id]: detail.rows || [] }));
    }
    setExpandedBatch(id);
  }

  async function reject(id: string) {
    if (!window.confirm("Reject this batch and discard its pending records?")) return;
    const response = await fetch(`${API_BASE_URL}/ats-migrations/batches/${id}/reject`, {
      method: "POST",
      credentials: "include",
    });
    setMessage(response.ok ? "Batch rejected." : "Batch rejection failed.");
    await loadBatches();
  }

  useEffect(() => {
    void loadBatches();
  }, []);

  return (
    <section className="mt-6 space-y-4" aria-labelledby="pending-batches-title">
      <div>
        <h2 id="pending-batches-title" className="text-base font-semibold">
          Pending Batches
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Review each batch once. Clean records are imported and duplicate records are flagged for
          review.
        </p>
      </div>
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
      {batches.length === 0 ? (
        <div className="rounded-lg border p-6 text-sm text-muted-foreground">
          No pending batches.
        </div>
      ) : (
        <div className="space-y-3">
          {batches.map((batch) => (
            <div key={batch.id} className="rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{batch.source}</p>
                  <p className="text-xs text-muted-foreground">{batch.id}</p>
                </div>
                <span className="rounded-md bg-muted px-2 py-1 text-xs">{batch.status}</span>
              </div>
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-4">
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
              <Button
                size="sm"
                variant="ghost"
                className="mt-3 px-0"
                onClick={() => toggleDetails(batch.id)}
              >
                {expandedBatch === batch.id ? "Hide row details" : "Review row details"}
              </Button>
              {expandedBatch === batch.id && (
                <div className="mt-3 overflow-x-auto rounded-md border">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">Row</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Entity</th>
                        <th className="px-3 py-2">Reason</th>
                        <th className="px-3 py-2">Candidate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(rows[batch.id] || [])
                        .filter((row) => row.row_status !== "valid")
                        .map((row) => (
                          <tr key={row.id} className="border-t">
                            <td className="px-3 py-2">{row.row_number}</td>
                            <td className="px-3 py-2">{row.row_status}</td>
                            <td className="px-3 py-2 capitalize">{row.entity_type}</td>
                            <td className="px-3 py-2 text-destructive">
                              {row.error_reason || "Existing candidate"}
                            </td>
                            <td className="max-w-xs truncate px-3 py-2">
                              {String(
                                row.mapped_payload?.email ||
                                  row.mapped_payload?.phone ||
                                  "Not mapped",
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
              {batch.status === "pending_approval" && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => preview(batch.id)}>
                    Preview changes
                  </Button>
                  <Button size="sm" onClick={() => approve(batch.id)}>
                    Approve batch
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => reject(batch.id)}>
                    Reject batch
                  </Button>
                </div>
              )}
              {previews[batch.id] && (
                <div className="mt-3 rounded-md bg-muted/40 p-3 text-sm">
                  <span className="font-medium">Preview:</span> {previews[batch.id].created}{" "}
                  created, {previews[batch.id].updated} updated, {previews[batch.id].skipped}{" "}
                  skipped.
                </div>
              )}
              {batch.error_rows > 0 && batch.status === "pending_approval" && (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>Retry failed rows:</span>
                  <Button size="sm" variant="outline" onClick={() => retry(batch.id)}>
                    All errors
                  </Button>
                  {Array.from(
                    new Set(
                      (rows[batch.id] || [])
                        .filter((row) => row.row_status === "error")
                        .map((row) => row.entity_type),
                    ),
                  ).map((entity) => (
                    <Button
                      key={entity}
                      size="sm"
                      variant="ghost"
                      onClick={() => retry(batch.id, entity)}
                    >
                      {entity}
                    </Button>
                  ))}
                </div>
              )}
              <div className="mt-3 flex gap-3 text-xs">
                <a
                  className="underline"
                  href={`${API_BASE_URL}/ats-migrations/batches/${batch.id}/report?format=csv`}
                >
                  Download CSV report
                </a>
                <a
                  className="underline"
                  href={`${API_BASE_URL}/ats-migrations/batches/${batch.id}/report?format=json`}
                >
                  Download JSON report
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function DataMigrationPage() {
  return (
    <>
      <Tabs defaultValue={AUTO_IMPORT_ENABLED ? "ats" : "csv"} className="mt-8">
        <TabsList>
          {AUTO_IMPORT_ENABLED && <TabsTrigger value="ats">Another ATS</TabsTrigger>}
          {MCP_ENABLED && <TabsTrigger value="mcp">MCP</TabsTrigger>}
          <TabsTrigger value="csv">CSV</TabsTrigger>
        </TabsList>
        <TabsContent value="csv">
          <ImportExportHub />
        </TabsContent>
        {AUTO_IMPORT_ENABLED && (
          <TabsContent value="ats">
            <AtsProviderCards />
          </TabsContent>
        )}
        {MCP_ENABLED && (
          <TabsContent value="mcp">
            <McpProviderCards />
            <McpSetupPanel />
          </TabsContent>
        )}
      </Tabs>
      {AUTO_IMPORT_ENABLED && <PendingBatches />}
    </>
  );
}

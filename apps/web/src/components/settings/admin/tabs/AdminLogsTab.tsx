"use client";

import { useCallback, useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@onehash/ui/select";
import { getAdminOrganizations } from "@/api/admin";
import { getAdminEmailLogs, type AdminEmailLogRow } from "@/api/email-logs";
import { EmailLogsTable } from "@/components/settings/logs/EmailLogsTable";

export function AdminLogsTab() {
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([]);
  const [selectedOrg, setSelectedOrg] = useState("");
  const [rows, setRows] = useState<AdminEmailLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [senderFilter, setSenderFilter] = useState("");

  useEffect(() => {
    getAdminOrganizations()
      .then((data) => setOrgs(data.map((o) => ({ id: String(o.id), name: o.name }))))
      .catch(() => { });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getAdminEmailLogs(selectedOrg || undefined, {
        status: statusFilter || undefined,
        sender: senderFilter || undefined,
        limit: 100,
      });
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load logs");
    } finally {
      setLoading(false);
    }
  }, [selectedOrg, statusFilter, senderFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-1">Email Logs</h2>
        <p className="text-xs text-muted-foreground">
          View inbound email parsing activity across all organizations. Logs retained for 30 days.
        </p>
      </div>

      <EmailLogsTable
        rows={rows}
        loading={loading}
        error={error}
        statusFilter={statusFilter}
        senderFilter={senderFilter}
        onStatusChange={setStatusFilter}
        onSenderChange={setSenderFilter}
        onClearFilters={() => {
          setStatusFilter("");
          setSenderFilter("");
        }}
        onRetry={load}
        showOrgColumn
        extraFilters={
          <Select
            value={selectedOrg || "all"}
            onValueChange={(v) => setSelectedOrg(v === "all" ? "" : v)}
          >
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue placeholder="All organizations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All organizations</SelectItem>
              {orgs.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
    </div>
  );
}

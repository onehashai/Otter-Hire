"use client";

import { useCallback, useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@onehash/ui/select";
import { getAdminOrganizations } from "@/api/admin";
import {
  getAdminEmailLogsPaginated,
  type AdminEmailLogRow,
  type EmailLogFilters,
} from "@/api/email-logs";
import { downloadEmailLogsCsv, EmailLogsTable } from "@/components/settings/logs/EmailLogsTable";
import { getMyPreferences, updateMyPreferences } from "@/api/users";
import {
  DEFAULT_TABLE_PAGE_SIZE,
  TABLE_PAGE_SIZE_OPTIONS,
} from "@/components/common/TablePagination";
import { toast } from "@onehash/ui/sonner";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizePageSize(value: unknown): number {
  const pageSize = typeof value === "number" ? value : Number(value);
  return TABLE_PAGE_SIZE_OPTIONS.includes(pageSize) ? pageSize : DEFAULT_TABLE_PAGE_SIZE;
}

async function persistPageSize(pageSize: number) {
  const { preferences } = await getMyPreferences();
  const tables = asRecord(preferences.tables);
  await updateMyPreferences({
    ...preferences,
    tables: {
      ...tables,
      admin_email_logs: {
        ...asRecord(tables.admin_email_logs),
        page_size: pageSize,
      },
    },
  });
}

export function AdminLogsTab() {
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([]);
  const [selectedOrg, setSelectedOrg] = useState("");
  const [rows, setRows] = useState<AdminEmailLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [senderFilter, setSenderFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    getAdminOrganizations()
      .then((data) => setOrgs(data.map((o) => ({ id: String(o.id), name: o.name }))))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    void getMyPreferences()
      .then(({ preferences }) => {
        if (cancelled) return;
        const tables = asRecord(preferences.tables);
        setPageSize(normalizePageSize(asRecord(tables.admin_email_logs).page_size));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const filters = useCallback(
    (): EmailLogFilters => ({
      status: statusFilter || undefined,
      sender: senderFilter || undefined,
    }),
    [statusFilter, senderFilter],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getAdminEmailLogsPaginated(selectedOrg || undefined, {
        ...filters(),
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      setRows(data.items);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load logs");
    } finally {
      setLoading(false);
    }
  }, [filters, page, pageSize, selectedOrg]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    if (total > 0 && page > totalPages) setPage(totalPages);
  }, [page, pageSize, total]);

  const handlePageSizeChange = (nextPageSize: number) => {
    if (!TABLE_PAGE_SIZE_OPTIONS.includes(nextPageSize) || nextPageSize === pageSize) return;
    setPageSize(nextPageSize);
    setPage(1);
    void persistPageSize(nextPageSize).catch(() =>
      toast.error("Unable to save email log page-size preference."),
    );
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const rowsToExport: AdminEmailLogRow[] = [];
      let offset = 0;
      let expectedTotal = 0;
      let fetched = 0;
      do {
        const result = await getAdminEmailLogsPaginated(selectedOrg || undefined, {
          ...filters(),
          limit: 200,
          offset,
        });
        rowsToExport.push(...result.items);
        expectedTotal = result.total;
        fetched = result.items.length;
        offset += fetched;
      } while (offset < expectedTotal && fetched > 0);
      downloadEmailLogsCsv(rowsToExport, "admin-email-logs.csv");
    } catch (exportError) {
      toast.error(
        exportError instanceof Error ? exportError.message : "Unable to export email logs.",
      );
    } finally {
      setExporting(false);
    }
  };

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
        total={total}
        page={page}
        pageSize={pageSize}
        loading={loading}
        error={error}
        statusFilter={statusFilter}
        senderFilter={senderFilter}
        onStatusChange={(value) => {
          setStatusFilter(value);
          setPage(1);
        }}
        onSenderChange={(value) => {
          setSenderFilter(value);
          setPage(1);
        }}
        onClearFilters={() => {
          setStatusFilter("");
          setSenderFilter("");
          setPage(1);
        }}
        onRetry={load}
        onPageChange={setPage}
        onPageSizeChange={handlePageSizeChange}
        onExport={() => void handleExport()}
        exporting={exporting}
        showOrgColumn
        extraFilters={
          <Select
            value={selectedOrg || "all"}
            onValueChange={(v) => {
              setSelectedOrg(v === "all" ? "" : v);
              setPage(1);
            }}
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

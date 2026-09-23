"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Icon } from "@onehash/ui/icon";
import { Button } from "@onehash/ui/button";
import { toast } from "@onehash/ui/sonner";
import { useAuthSession } from "@/app/providers";
import { useSetPageMetadata } from "@/hooks/useSetPageMetadata";
import { getOrgEmailLogsPaginated, type EmailLogRow, type EmailLogFilters } from "@/api/email-logs";
import { downloadEmailLogsCsv, EmailLogsTable } from "@/components/settings/logs/EmailLogsTable";
import { getMyPreferences, updateMyPreferences } from "@/api/users";
import {
  DEFAULT_TABLE_PAGE_SIZE,
  TABLE_PAGE_SIZE_OPTIONS,
} from "@/components/common/TablePagination";

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
      email_logs: {
        ...asRecord(tables.email_logs),
        page_size: pageSize,
      },
    },
  });
}

export default function LogsPage() {
  const { user, loading: authLoading } = useAuthSession();
  const router = useRouter();
  const { t } = useTranslation();

  useSetPageMetadata({
    title: t("logs_title"),
    subtitle: t("logs_subtitle"),
  });
  const [rows, setRows] = useState<EmailLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [senderFilter, setSenderFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [exporting, setExporting] = useState(false);

  const isAllowed = user?.membership_role === "owner" || user?.membership_role === "admin";

  useEffect(() => {
    let cancelled = false;
    void getMyPreferences()
      .then(({ preferences }) => {
        if (cancelled) return;
        const tables = asRecord(preferences.tables);
        setPageSize(normalizePageSize(asRecord(tables.email_logs).page_size));
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
      const data = await getOrgEmailLogsPaginated({
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
  }, [filters, page, pageSize]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    if (total > 0 && page > totalPages) setPage(totalPages);
  }, [page, pageSize, total]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAllowed) {
      router.replace("/jobs");
      return;
    }
    void load();
  }, [authLoading, isAllowed, load, router]);

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
      const rowsToExport: EmailLogRow[] = [];
      let offset = 0;
      let expectedTotal = 0;
      let fetched = 0;
      do {
        const result = await getOrgEmailLogsPaginated({ ...filters(), limit: 200, offset });
        rowsToExport.push(...result.items);
        expectedTotal = result.total;
        fetched = result.items.length;
        offset += fetched;
      } while (offset < expectedTotal && fetched > 0);
      downloadEmailLogsCsv(rowsToExport, "email-logs.csv");
    } catch (exportError) {
      toast.error(
        exportError instanceof Error ? exportError.message : "Unable to export email logs.",
      );
    } finally {
      setExporting(false);
    }
  };

  if (authLoading || !user) return null;

  if (!isAllowed) {
    return (
      <div className="py-16 text-center space-y-3">
        <Icon name="Shield" className="h-10 w-10 mx-auto text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">You don&apos;t have access to this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
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
        extraFilters={
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1.5 shrink-0 w-full sm:w-auto ml-auto"
            onClick={load}
          >
            <Icon name="RefreshCw" className="h-3.5 w-3.5" />
            Refresh
          </Button>
        }
      />
    </div>
  );
}

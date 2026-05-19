"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Icon } from "@onehash/ui/icon";
import { Button } from "@onehash/ui/button";
import { useAuthSession } from "@/app/providers";
import { useSetPageMetadata } from "@/hooks/useSetPageMetadata";
import { getOrgEmailLogs, type EmailLogRow } from "@/api/email-logs";
import { EmailLogsTable } from "@/components/settings/logs/EmailLogsTable";

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

  const isAllowed = user?.membership_role === "owner" || user?.membership_role === "admin";

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getOrgEmailLogs({
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
  }, [statusFilter, senderFilter]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAllowed) {
      router.replace("/jobs");
      return;
    }
    void load();
  }, [authLoading, isAllowed, load, router]);

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

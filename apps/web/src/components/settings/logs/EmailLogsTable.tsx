"use client";

import React, { useState } from "react";
import { Badge } from "@onehash/ui/badge";
import { Button } from "@onehash/ui/button";
import { Card, CardContent } from "@onehash/ui/card";
import { InputField } from "@onehash/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@onehash/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@onehash/ui/table";
import { Icon } from "@onehash/ui/icon";
import { cn } from "@/lib/utils";
import { getOrgEmailLogBody, getAdminEmailLogBody, type EmailLogRow } from "@/api/email-logs";
import { EmailViewModal, type EmailViewModalData } from "@/components/common/EmailViewModal";

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  processed: {
    label: "Parsed",
    cls: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  },
  failed: { label: "Failed", cls: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
  ignored: { label: "Ignored", cls: "bg-muted text-muted-foreground" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };
  return (
    <Badge
      variant="secondary"
      className={cn("text-[10px] px-2 py-0 h-5 font-medium border-0", cfg.cls)}
    >
      {cfg.label}
    </Badge>
  );
}

function formatTs(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function ExpandedDetail({
  row,
  isAdmin,
}: {
  row: EmailLogRow & { org_name?: string };
  isAdmin?: boolean;
}) {
  const [showBody, setShowBody] = useState(false);
  const [loadingBody, setLoadingBody] = useState(false);
  const [bodyData, setBodyData] = useState<{ text_body: string; html_body: string } | null>(null);
  const [bodyError, setBodyError] = useState<string | null>(null);

  const handleToggleBody = async () => {
    if (showBody) {
      setShowBody(false);
      return;
    }
    setShowBody(true);
    if (!bodyData && !loadingBody) {
      setLoadingBody(true);
      setBodyError(null);
      try {
        const data = isAdmin
          ? await getAdminEmailLogBody(row.id)
          : await getOrgEmailLogBody(row.id);
        setBodyData(data);
      } catch (err) {
        setBodyError(err instanceof Error ? err.message : "Failed to load email body");
      } finally {
        setLoadingBody(false);
      }
    }
  };

  React.useEffect(() => {
    if (!bodyData && !loadingBody) {
      handleToggleBody();
    }
  }, []);


  return (
    <div className="px-4 py-3 bg-muted/30 border-t text-xs space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1.5">
        <div>
          <span className="text-muted-foreground">Inbox: </span>
          <span className="font-mono break-all">{row.inbox_address}</span>
        </div>
        {row.org_name && (
          <div>
            <span className="text-muted-foreground">Org: </span>
            {row.org_name}
          </div>
        )}
        <div>
          <span className="text-muted-foreground">Attachments: </span>
          {row.attachment_count}
        </div>
        {row.attachment_primary_filename && (
          <div>
            <span className="text-muted-foreground">File: </span>
            {row.attachment_primary_filename}
          </div>
        )}
        {row.parse_duration_ms != null && (
          <div>
            <span className="text-muted-foreground">Duration: </span>
            {row.parse_duration_ms}ms
          </div>
        )}
        {row.parsed_candidate_id && (
          <div className="col-span-2">
            <span className="text-muted-foreground">Candidate ID: </span>
            <span className="font-mono">{row.parsed_candidate_id}</span>
          </div>
        )}
      </div>
      {row.parse_error && (
        <div className="p-2 rounded bg-destructive/10 text-destructive font-mono whitespace-pre-wrap break-all">
          {row.parse_error}
        </div>
      )}

      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={handleToggleBody}
        >
          <Icon name={showBody ? "ChevronUp" : "Mail"} className="mr-1.5 h-3.5 w-3.5" />
          {showBody ? "Hide Email Body" : "View Whole Email Body"}
        </Button>

        {showBody && (
          <div className="mt-2 p-3 rounded border bg-background text-foreground space-y-2">
            {loadingBody ? (
              <div className="flex items-center gap-2 text-muted-foreground py-2">
                <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-current" />
                Loading email content...
              </div>
            ) : bodyError ? (
              <div className="text-destructive font-mono py-1">{bodyError}</div>
            ) : bodyData ? (
              <div className="space-y-2">
                {bodyData.text_body ? (
                  <pre className="whitespace-pre-wrap font-sans text-xs break-words leading-relaxed p-2 rounded bg-muted/40 max-h-96 overflow-y-auto select-text">
                    {bodyData.text_body}
                  </pre>
                ) : bodyData.html_body ? (
                  <iframe
                    title="Email Content"
                    srcDoc={bodyData.html_body}
                    sandbox="allow-same-origin"
                    className="w-full h-64 border rounded bg-white"
                  />
                ) : (
                  <div className="text-muted-foreground italic py-1">No email content available.</div>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}


export interface EmailLogsTableProps {
  rows: (EmailLogRow & { org_name?: string })[];
  loading: boolean;
  error: string;
  statusFilter: string;
  senderFilter: string;
  onStatusChange: (v: string) => void;
  onSenderChange: (v: string) => void;
  onClearFilters: () => void;
  onRetry: () => void;
  showOrgColumn?: boolean;
  isAdmin?: boolean;
  extraFilters?: React.ReactNode;
}

export function EmailLogsTable({
  rows,
  loading,
  error,
  statusFilter,
  senderFilter,
  onStatusChange,
  onSenderChange,
  onClearFilters,
  onRetry,
  showOrgColumn,
  isAdmin,
  extraFilters,
}: EmailLogsTableProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [modalEmail, setModalEmail] = useState<EmailViewModalData | null>(null);
  const [loadingModalId, setLoadingModalId] = useState<string | null>(null);

  const colSpan = showOrgColumn ? 7 : 6;
  const isUserAdmin = isAdmin ?? showOrgColumn;

  const handleOpenModal = async (row: EmailLogRow & { org_name?: string }, e: React.MouseEvent) => {
    e.stopPropagation();
    setLoadingModalId(row.id);
    try {
      const data = isUserAdmin
        ? await getAdminEmailLogBody(row.id)
        : await getOrgEmailLogBody(row.id);

      setModalEmail({
        id: row.id,
        from_name: row.from_name || row.from_email,
        from_email: row.from_email,
        to_email: row.to_email || "Inbox",
        subject: row.subject || "(no subject)",
        received_at: row.received_at,
        body: data.text_body,
        html_body: data.html_body,
        attachments: (data as any).attachments || [],
      });
    } catch (err) {
      setModalEmail({
        id: row.id,
        from_name: row.from_name || row.from_email,
        from_email: row.from_email,
        to_email: row.to_email || "Inbox",
        subject: row.subject || "(no subject)",
        received_at: row.received_at,
        body: "Could not load email body.",
      });
    } finally {
      setLoadingModalId(null);
    }
  };



  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center flex-1">
          <div className="w-full sm:w-52 shrink-0">
            <InputField
              className="h-8 text-xs"
              placeholder="Filter by sender…"
              value={senderFilter}
              onChange={(e) => onSenderChange(e.target.value)}
            />
          </div>
          <Select
            value={statusFilter || "all"}
            onValueChange={(v) => onStatusChange(v === "all" ? "" : v)}
          >
            <SelectTrigger className="h-8 w-full sm:w-36 text-xs">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="processed">Parsed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="ignored">Ignored</SelectItem>
            </SelectContent>
          </Select>
          {(statusFilter || senderFilter) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground w-full sm:w-auto"
              onClick={onClearFilters}
            >
              Clear
            </Button>
          )}
        </div>
        <div className="flex sm:justify-end shrink-0 w-full sm:w-auto">{extraFilters}</div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-foreground" />
            </div>
          ) : error ? (
            <div className="py-12 text-center space-y-3">
              <Icon name="CircleAlert" className="h-8 w-8 mx-auto text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button size="sm" variant="outline" className="text-xs h-8" onClick={onRetry}>
                Try again
              </Button>
            </div>
          ) : rows.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <Icon name="Inbox" className="h-10 w-10 mx-auto text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No email logs found.</p>
              <p className="text-xs text-muted-foreground">Logs are retained for 30 days.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs font-medium h-10">Received</TableHead>
                  <TableHead className="text-xs font-medium h-10">From</TableHead>
                  <TableHead className="text-xs font-medium h-10">Email Content</TableHead>
                  <TableHead className="text-xs font-medium h-10">Subject</TableHead>
                  {showOrgColumn && <TableHead className="text-xs font-medium h-10">Org</TableHead>}
                  <TableHead className="text-xs font-medium h-10">Status</TableHead>
                  <TableHead className="text-xs font-medium h-10 w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <React.Fragment key={row.id}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() => setExpanded(expanded === row.id ? null : row.id)}
                    >
                      <TableCell className="py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                        {formatTs(row.received_at)}
                      </TableCell>
                      <TableCell className="py-2.5 text-xs max-w-[180px]">
                        <div className="truncate">{row.from_email ?? "—"}</div>
                        {row.from_name && (
                          <div className="text-muted-foreground truncate">{row.from_name}</div>
                        )}
                      </TableCell>
                      <TableCell className="py-2.5 text-xs">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-6 text-[11px] px-2.5 font-medium border-muted-foreground/30 hover:border-foreground transition-all gap-1"
                          onClick={(e) => handleOpenModal(row, e)}
                          disabled={loadingModalId === row.id}
                        >
                          <Icon name="Mail" className="h-3 w-3 text-primary shrink-0" />
                          {loadingModalId === row.id ? "Loading…" : "Expand Full Email"}
                        </Button>
                      </TableCell>
                      <TableCell className="py-2.5 text-xs max-w-[240px] truncate text-muted-foreground">
                        {row.subject ?? "—"}
                      </TableCell>
                      {showOrgColumn && (
                        <TableCell className="py-2.5 text-xs text-muted-foreground">
                          {row.org_name}
                        </TableCell>
                      )}
                      <TableCell className="py-2.5">
                        <StatusBadge status={row.parse_status} />
                      </TableCell>
                      <TableCell className="py-2.5">
                        <Icon
                          name={expanded === row.id ? "ChevronUp" : "ChevronDown"}
                          className="h-3.5 w-3.5 text-muted-foreground"
                        />
                      </TableCell>
                    </TableRow>
                    {expanded === row.id && (
                      <TableRow key={`${row.id}-exp`} className="hover:bg-transparent">
                        <TableCell colSpan={colSpan} className="p-0">
                          <ExpandedDetail row={row} isAdmin={isUserAdmin} />
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <EmailViewModal
        open={!!modalEmail}
        onOpenChange={(o) => !o && setModalEmail(null)}
        email={modalEmail}
      />
    </div>
  );
}

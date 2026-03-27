"use client";

import { Card, CardContent } from "@onehash/ui/card";

type ApplicationResponseFile = {
  name: string;
  url: string;
};

type ApplicationResponseItem = {
  key: string;
  label: string;
  type: string;
  required: boolean;
  response: string | number | boolean | string[] | null;
  files: ApplicationResponseFile[];
};

interface ApplicationResponsesTabProps {
  loading?: boolean;
  error?: string | null;
  items: ApplicationResponseItem[];
  submittedAt?: string | null;
  onRetry?: () => void;
}

function formatDisplayFileName(rawName: string): string {
  const base = decodeURIComponent((rawName || "").split("/").pop() || rawName || "attachment");
  const withoutUuidPrefix = base.replace(/^[0-9a-f]{8,}-[0-9a-f-]{20,}_(.+)$/i, "$1");
  const clean = withoutUuidPrefix.replace(/^tmp-\d+-\d+_(.+)$/i, "$1");
  return clean || base;
}

function renderResponseValue(
  item: ApplicationResponseItem,
): string | number | boolean | string[] | null {
  if (item.type === "file_upload") return null;
  return item.response;
}

export function ApplicationResponsesTab({
  loading = false,
  error = null,
  items,
  submittedAt,
  onRetry,
}: ApplicationResponsesTabProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Loading application responses...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-4 space-y-2">
          <p className="text-xs text-destructive">{error}</p>
          {onRetry ? (
            <button
              type="button"
              className="text-xs text-muted-foreground underline underline-offset-2"
              onClick={onRetry}
            >
              Retry
            </button>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  if (!items.length) {
    return (
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">No application responses found.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        {submittedAt ? (
          <div className="border-b px-4 py-3 text-[11px] text-muted-foreground">
            Submitted on {new Date(submittedAt).toLocaleString()}
          </div>
        ) : null}
        <div className="divide-y">
          {items.map((item) => {
            const value = renderResponseValue(item);
            const hasFiles = item.type === "file_upload" && item.files.length > 0;
            return (
              <div key={item.key} className="px-4 py-3 space-y-1">
                <p className="text-xs font-medium">
                  {item.label}
                  {item.required ? " *" : ""}
                </p>
                {hasFiles ? (
                  <div className="space-y-1">
                    {item.files.map((file) => (
                      <a
                        key={`${item.key}-${file.url}`}
                        className="block text-xs text-muted-foreground underline underline-offset-2"
                        href={file.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {formatDisplayFileName(file.name)}
                      </a>
                    ))}
                  </div>
                ) : Array.isArray(value) ? (
                  value.length > 0 ? (
                    <p className="text-xs text-muted-foreground">{value.join(", ")}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">-</p>
                  )
                ) : value === null || value === undefined || value === "" ? (
                  <p className="text-xs text-muted-foreground">-</p>
                ) : (
                  <p className="text-xs text-muted-foreground">{String(value)}</p>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

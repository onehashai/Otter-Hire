"use client";

import { Button } from "@onehash/ui/button";
import { Card, CardContent } from "@onehash/ui/card";
import { Icon } from "@onehash/ui/icon";

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

function formatAnswerValue(value: string | number | boolean | string[] | null): {
  kind: "empty" | "text" | "chips";
  text?: string;
  chips?: string[];
} {
  if (Array.isArray(value)) {
    const chips = value.map((item) => String(item).trim()).filter(Boolean);
    return chips.length ? { kind: "chips", chips } : { kind: "empty" };
  }
  if (typeof value === "boolean") {
    return { kind: "text", text: value ? "Yes" : "No" };
  }
  if (value === null || value === undefined) {
    return { kind: "empty" };
  }
  const text = String(value).trim();
  return text ? { kind: "text", text } : { kind: "empty" };
}

function formatSubmittedAt(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
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
        <CardContent className="p-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Icon name="Loader" className="h-3.5 w-3.5 animate-spin" />
              <span>Loading application responses...</span>
            </div>
            <div className="space-y-2">
              {[0, 1, 2].map((row) => (
                <div key={row} className="rounded-lg border p-3">
                  <div className="h-3 w-1/3 rounded bg-muted" />
                  <div className="mt-2 h-3 w-2/3 rounded bg-muted" />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 space-y-3">
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
            <p className="text-xs text-destructive">{error}</p>
          </div>
          {onRetry ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={onRetry}
            >
              Retry
            </Button>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  if (!items.length) {
    return (
      <Card>
        <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
            <Icon name="CircleHelp" className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground">No application responses found.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4 md:p-5">
        <div className="flex items-center justify-between gap-2 rounded-md bg-muted/30 px-3 py-2">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground leading-none">
            <Icon name="CalendarClock" className="h-3.5 w-3.5" />
            <span>
              {submittedAt
                ? `Submitted ${formatSubmittedAt(submittedAt)}`
                : "Submission timestamp unavailable"}
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground leading-none">
            {items.length} response{items.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="mt-4 space-y-4">
          {items.map((item, index) => {
            const value = renderResponseValue(item);
            const hasFiles = item.type === "file_upload" && item.files.length > 0;
            const answer = formatAnswerValue(value);
            const isLast = index === items.length - 1;
            return (
              <div key={item.key} className="relative pl-6">
                <div className="absolute left-1.5 top-1.5 h-2 w-2 rounded-full bg-border" />
                {!isLast ? (
                  <div className="absolute left-[10px] top-4 bottom-0 w-px bg-border" />
                ) : null}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium leading-snug text-foreground">
                      {item.label}
                      {item.required ? (
                        <span className="ml-1 text-foreground" aria-hidden="true">
                          *
                        </span>
                      ) : null}
                      {item.required ? <span className="sr-only">(Required)</span> : null}
                    </p>
                    <span className="sr-only">
                      {item.required ? "Required field" : "Optional field"}
                    </span>
                  </div>
                  {hasFiles ? (
                    <div className="space-y-1.5">
                      {item.files.map((file) => (
                        <a
                          key={`${item.key}-${file.url}`}
                          className="group flex items-center gap-2 rounded-md bg-muted/40 px-2.5 py-2 text-xs hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          href={file.url}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Open file ${formatDisplayFileName(file.name)}`}
                        >
                          <Icon
                            name="Paperclip"
                            className="h-3.5 w-3.5 text-muted-foreground shrink-0"
                          />
                          <span className="truncate text-foreground/90">
                            {formatDisplayFileName(file.name)}
                          </span>
                          <span className="ml-auto text-muted-foreground transition-colors group-hover:text-foreground">
                            Open
                          </span>
                        </a>
                      ))}
                    </div>
                  ) : answer.kind === "chips" ? (
                    <div className="flex flex-wrap gap-1.5">
                      {(answer.chips || []).map((chip) => (
                        <span
                          key={`${item.key}-${chip}`}
                          className="text-[11px] rounded-full bg-muted px-2 py-0.5 text-foreground/80"
                        >
                          {chip}
                        </span>
                      ))}
                    </div>
                  ) : answer.kind === "empty" ? (
                    <div className="rounded-md bg-muted/40 px-2.5 py-2">
                      <p className="text-xs text-muted-foreground">—</p>
                    </div>
                  ) : (
                    <div className="rounded-md bg-muted/40 px-2.5 py-2">
                      <p className="text-sm leading-relaxed text-foreground">{answer.text}</p>
                    </div>
                  )}
                </div>
                {!isLast ? <div className="mt-4 border-b border-border/60" /> : null}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

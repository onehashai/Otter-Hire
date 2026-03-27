"use client";

import { Card, CardContent } from "@onehash/ui/card";
import { Button } from "@onehash/ui/button";
import { Icon } from "@onehash/ui/icon";

interface Document {
  id?: string;
  name: string;
  type: string;
  date: string;
  size: string;
  url?: string;
}

interface DocumentsTabProps {
  documents: Document[];
  onUploadDocument?: () => void;
  onDeleteDocument?: (documentId: string) => void;
}

function formatDisplayFileName(rawName: string): string {
  const base = decodeURIComponent((rawName || "").split("/").pop() || rawName || "document");
  // Stored names can be prefixed like "<uuid>_tmp-.._<original>" for uniqueness.
  const withoutUuidPrefix = base.replace(/^[0-9a-f]{8,}-[0-9a-f-]{20,}_(.+)$/i, "$1");
  const clean = withoutUuidPrefix.replace(/^tmp-\d+-\d+_(.+)$/i, "$1");
  return clean || base;
}

export function DocumentsTab({ documents, onUploadDocument, onDeleteDocument }: DocumentsTabProps) {
  return (
    <div className="space-y-3">
      {documents.length === 0 ? (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
              <Icon name="ScrollText" className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">No documents uploaded</p>
            <Button size="sm" className="h-7 text-xs gap-1.5" onClick={onUploadDocument}>
              <Icon name="Upload" className="h-3 w-3" /> Upload Document
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {documents.map((doc, i) => (
            <Card key={doc.id ?? i}>
              <CardContent className="p-3 flex items-center gap-3">
                <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                  <Icon name="ScrollText" className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{formatDisplayFileName(doc.name)}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {doc.type} · {doc.size} · {doc.date}
                  </p>
                </div>
                {doc.url ? (
                  <a
                    className="text-xs text-muted-foreground hover:underline"
                    href={doc.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View
                  </a>
                ) : null}
                {doc.id && onDeleteDocument ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[10px]"
                    onClick={() => onDeleteDocument(doc.id as string)}
                  >
                    Delete
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5 w-full"
            onClick={onUploadDocument}
          >
            <Icon name="Upload" className="h-3.5 w-3.5" /> Upload Document
          </Button>
        </>
      )}
    </div>
  );
}

"use client";

import { Card, CardContent } from "@onehash/ui/card";
import { Button } from "@onehash/ui/button";
import { Icon } from "@onehash/ui/icon";

interface Document {
  name: string;
  type: string;
  date: string;
  size: string;
}

interface DocumentsTabProps {
  documents: Document[];
}

export function DocumentsTab({ documents }: DocumentsTabProps) {
  return (
    <div className="space-y-3">
      {documents.length === 0 ? (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
              <Icon name="ScrollText" className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">No documents uploaded</p>
            <Button size="sm" className="h-7 text-xs gap-1.5">
              <Icon name="Upload" className="h-3 w-3" /> Upload Document
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {documents.map((doc, i) => (
            <Card key={i}>
              <CardContent className="p-3 flex items-center gap-3">
                <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                  <Icon name="ScrollText" className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{doc.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {doc.type} · {doc.size} · {doc.date}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 w-full">
            <Icon name="Upload" className="h-3.5 w-3.5" /> Upload Document
          </Button>
        </>
      )}
    </div>
  );
}

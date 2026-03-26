"use client";

import { Card, CardContent } from "@onehash/ui/card";
import { Icon } from "@onehash/ui/icon";
import { Button } from "@onehash/ui/button";

type ResumeTabProps = {
  resumeUrl?: string | null;
  previewUrl?: string | null;
  resumeName?: string | null;
  onUploadDocument?: () => void;
};

export function ResumeTab({ resumeUrl, previewUrl, resumeName, onUploadDocument }: ResumeTabProps) {
  if (!resumeUrl) {
    return (
      <Card>
        <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
            <Icon name="ScrollText" className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground">No resume available to preview</p>
          {onUploadDocument ? (
            <Button size="sm" className="h-7 text-xs gap-1.5" onClick={onUploadDocument}>
              <Icon name="Upload" className="h-3 w-3" /> Upload Resume
            </Button>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  const previewSrc = previewUrl ?? resumeUrl;
  const iframeSrc = `${previewSrc}${previewSrc.includes("#") ? "&" : "#"}zoom=100`;
  const isPdf =
    !!previewUrl ||
    resumeUrl.toLowerCase().includes(".pdf") ||
    resumeUrl.toLowerCase().includes("application/pdf");
  void resumeName;

  return (
    <div>
      <Card>
        <CardContent className="p-0">
          {isPdf ? (
            <iframe title="Resume preview" src={iframeSrc} className="w-full h-[70vh] rounded-md" />
          ) : (
            <div className="p-6 text-center text-xs text-muted-foreground">
              Preview not available for this file type. Use “Open” to view it.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

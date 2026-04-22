"use client";

import { useRef } from "react";
import { Card, CardContent } from "@onehash/ui/card";
import { Icon } from "@onehash/ui/icon";
import { Button } from "@onehash/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

type ResumeTabProps = {
  resumeUrl?: string | null;
  previewUrl?: string | null;
  resumeName?: string | null;
  onUploadDocument?: () => void;
  onUploadResumeFile?: (file: File) => void | Promise<void>;
};

export function ResumeTab({
  resumeUrl,
  previewUrl,
  resumeName,
  onUploadDocument,
  onUploadResumeFile,
}: ResumeTabProps) {
  const resumeInputRef = useRef<HTMLInputElement | null>(null);
  const isMobile = useIsMobile();

  if (!resumeUrl) {
    return (
      <Card>
        <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
            <Icon name="ScrollText" className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground">No resume available to preview</p>
          {onUploadDocument || onUploadResumeFile ? (
            <>
              {onUploadResumeFile ? (
                <input
                  ref={resumeInputRef}
                  type="file"
                  accept="application/pdf,.pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    void onUploadResumeFile(file);
                    e.currentTarget.value = "";
                  }}
                />
              ) : null}
              <Button
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={() => {
                  if (onUploadResumeFile) {
                    resumeInputRef.current?.click();
                    return;
                  }
                  onUploadDocument?.();
                }}
              >
                <Icon name="Upload" className="h-3 w-3" /> Upload Resume
              </Button>
            </>
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
  const viewerHeightClass = isMobile
    ? "h-[min(64dvh,calc(100dvh-15.5rem))] min-h-[300px]"
    : "h-[70vh]";

  return (
    <div className="min-w-0 max-w-full overflow-x-hidden">
      <Card className="min-w-0 max-w-full overflow-hidden">
        <CardContent className="p-0 min-w-0 max-w-full overflow-hidden">
          {isPdf ? (
            <div className="min-w-0 max-w-full overflow-hidden px-2 py-2 sm:px-0 sm:py-0">
              <iframe
                title="Resume preview"
                src={iframeSrc}
                className={`block w-full max-w-full rounded-md border border-border ${viewerHeightClass}`}
              />
            </div>
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

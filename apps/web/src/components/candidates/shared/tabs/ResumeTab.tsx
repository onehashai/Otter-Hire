"use client";

import { useRef } from "react";
import { Card, CardContent } from "@onehash/ui/card";
import { Icon } from "@onehash/ui/icon";
import { Button } from "@onehash/ui/button";

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
                  accept="application/pdf,.pdf"
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

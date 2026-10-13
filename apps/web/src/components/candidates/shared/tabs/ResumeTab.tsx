"use client";

import { useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import dynamic from "next/dynamic";
import { Card, CardContent } from "@onehash/ui/card";
import { Icon } from "@onehash/ui/icon";
import { Button } from "@onehash/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

const PdfResumeViewer = dynamic(
  () => import("./PdfResumeViewer").then((mod) => mod.PdfResumeViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col items-center justify-center gap-2 h-[70vh] min-h-[300px] w-full rounded-md border border-border bg-muted/20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-xs text-muted-foreground">Loading PDF viewer...</p>
      </div>
    ),
  }
);

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
  const router = useRouter();
  const resumeInputRef = useRef<HTMLInputElement | null>(null);
  const isMobile = useIsMobile();

  const goBack = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
    } else {
      router.replace("/candidates");
    }
  }, [router]);

  /*
  if (!resumeUrl) {
    return (
      <Card className="min-h-[380px] md:h-[65vh] flex items-center justify-center p-6 sm:p-12">
        <section className="w-full max-w-xl">
          <div>
            <p className="max-w-md text-sm leading-6 text-muted-foreground sm:text-base">
              This document or attachment is unavailable.
              <br className="hidden sm:inline" />
              {" "}It may have expired or use an unsupported file format.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-5">
              <Button onClick={goBack} className="h-10 rounded-full px-5">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Return to App
              </Button>
            </div>
          </div>
        </section>
      </Card>
    );
  }
  */

  if (!resumeUrl) {
    return (
      <div className="flex min-h-[380px] md:h-[65vh] items-center justify-center rounded-lg bg-[#0b0b0b] px-6 py-10 text-white border border-border">
        <section className="w-full max-w-[620px] -translate-y-2 md:-translate-y-4">
          <h1 className="text-2xl font-semibold tracking-normal sm:text-3xl">
            Resume unavailable
          </h1>

          <p className="mt-4 text-sm leading-relaxed text-[#929292] sm:text-base">
            A resume isn&apos;t available to review for this candidate.
            <br className="hidden sm:block" /> It may not have been attached or
            could not be opened. You can continue reviewing the candidate&apos;s
            profile or request an updated copy.
          </p>

          <button
            type="button"
            onClick={goBack}
            className="mt-7 inline-flex h-10 items-center gap-2.5 rounded-full bg-[#f5f5f5] px-5 text-sm font-medium text-[#111] transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            Return to App
          </button>
        </section>
      </div>
    );
  }

  const previewSrc = previewUrl ?? resumeUrl;
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
              <PdfResumeViewer
                url={previewSrc}
                className={`block w-full max-w-full ${viewerHeightClass}`}
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

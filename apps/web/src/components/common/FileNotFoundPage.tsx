"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@onehash/ui/button";

export function FileNotFoundPage({ resumeUnavailable = false }: { resumeUnavailable?: boolean }) {
  const router = useRouter();

  const goBack = useCallback(() => {
    if (window.history.length > 1) window.history.back();
    else router.replace("/");
  }, [router]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const isEditable =
        target instanceof HTMLElement &&
        (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      if (isEditable || (event.key !== "Escape" && event.key !== "Backspace")) return;
      event.preventDefault();
      goBack();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goBack]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16 text-foreground">
      <section className="w-full max-w-xl">
        <h1 className="flex flex-wrap items-center gap-3 text-2xl font-semibold sm:text-3xl">
          {!resumeUnavailable && (
            <>
              <span className="text-muted-foreground">404</span>
              <span aria-hidden="true" className="h-7 border-l border-border sm:h-8" />
            </>
          )}
          <span>{resumeUnavailable ? "Resume unavailable" : "File Not Found"}</span>
        </h1>
        <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground sm:text-base">
          {resumeUnavailable
            ? "A resume isn't available to review for this candidate. It may not have been attached or could not be opened. You can continue reviewing the candidate's profile or request an updated copy."
            : "This document or attachment is unavailable. It may have expired or use an unsupported file format."}
        </p>
        <div className="mt-8">
          <Button onClick={goBack} className="h-10 rounded-full px-5">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Return to App
          </Button>
        </div>
      </section>
    </main>
  );
}

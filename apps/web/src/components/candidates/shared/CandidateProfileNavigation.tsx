"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@onehash/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  getCandidateNavigationContext,
  setCandidateNavigationContext,
  type CandidateNavigationContext,
} from "@/lib/candidate-navigation";
import { getCandidatesPaginated } from "@/api/candidates";

interface CandidateProfileNavigationProps {
  candidateId: string | undefined;
  jobRouteJobId?: string;
  stageId?: string;
  className?: string;
}

function isInteractiveInputElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  if (tagName === "input" || tagName === "textarea" || tagName === "select") {
    return true;
  }
  if (target.isContentEditable || target.getAttribute("contenteditable") === "true") {
    return true;
  }
  if (target.closest("input, textarea, select, [contenteditable='true'], [role='textbox']")) {
    return true;
  }
  return false;
}

export function CandidateProfileNavigation({
  candidateId,
  jobRouteJobId,
  stageId,
  className = "",
}: CandidateProfileNavigationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();

  const [navContext, setNavContext] = useState<CandidateNavigationContext | null>(() =>
    getCandidateNavigationContext(),
  );

  // If candidate is not in existing context (e.g. direct URL visit or refreshed page),
  // fetch default candidate list to initialize navigation context
  useEffect(() => {
    if (!candidateId) return;

    const existing = getCandidateNavigationContext();
    if (existing && existing.ids.includes(candidateId)) {
      setNavContext(existing);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const response = await getCandidatesPaginated({ limit: 50, offset: 0 });
        if (cancelled) return;
        const fetchedIds = response.items.map((c) => c.id);
        const combinedIds = fetchedIds.includes(candidateId)
          ? fetchedIds
          : [candidateId, ...fetchedIds];

        const newContext: CandidateNavigationContext = {
          ids: combinedIds,
          total: Math.max(response.total, combinedIds.length),
          sourceUrl: "/candidates",
          sourceName: "Candidates",
        };
        setCandidateNavigationContext(newContext);
        setNavContext(newContext);
      } catch {
        // Fallback gracefully without navigation bar if fetch fails
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [candidateId]);

  const { currentIndex, totalDisplay, prevCandidateId, nextCandidateId, hasPrev, hasNext } =
    useMemo(() => {
      if (!navContext || !candidateId) {
        return {
          currentIndex: -1,
          totalDisplay: 0,
          prevCandidateId: null,
          nextCandidateId: null,
          hasPrev: false,
          hasNext: false,
        };
      }

      const idx = navContext.ids.indexOf(candidateId);
      const total = navContext.total ?? navContext.ids.length;

      return {
        currentIndex: idx,
        totalDisplay: total > 0 ? total : navContext.ids.length,
        prevCandidateId: idx > 0 ? navContext.ids[idx - 1] : null,
        nextCandidateId: idx >= 0 && idx < navContext.ids.length - 1 ? navContext.ids[idx + 1] : null,
        hasPrev: idx > 0,
        hasNext: idx >= 0 && idx < navContext.ids.length - 1,
      };
    }, [navContext, candidateId]);

  const navigateToCandidate = useCallback(
    (targetId: string | null) => {
      if (!targetId) return;

      const currentParams = new URLSearchParams(searchParams.toString());
      const queryStr = currentParams.toString() ? `?${currentParams.toString()}` : "";

      if (jobRouteJobId && stageId) {
        router.push(
          `/jobs/${encodeURIComponent(jobRouteJobId)}/stage/${encodeURIComponent(stageId)}/candidates/${encodeURIComponent(targetId)}${queryStr}`,
        );
      } else if (jobRouteJobId) {
        router.push(
          `/jobs/${encodeURIComponent(jobRouteJobId)}/candidates/${encodeURIComponent(targetId)}${queryStr}`,
        );
      } else {
        router.push(`/candidates/${encodeURIComponent(targetId)}${queryStr}`);
      }
    },
    [router, searchParams, jobRouteJobId, stageId],
  );

  const goToPrev = useCallback(() => {
    if (hasPrev && prevCandidateId) {
      navigateToCandidate(prevCandidateId);
    }
  }, [hasPrev, prevCandidateId, navigateToCandidate]);

  const goToNext = useCallback(() => {
    if (hasNext && nextCandidateId) {
      navigateToCandidate(nextCandidateId);
    }
  }, [hasNext, nextCandidateId, navigateToCandidate]);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isInteractiveInputElement(e.target)) {
        return;
      }

      const key = e.key.toLowerCase();
      const isNextKey =
        ((e.metaKey || e.ctrlKey) && key === "n") ||
        (e.altKey && (key === "n" || e.key === "ArrowRight")) ||
        ((e.metaKey || e.ctrlKey) && e.key === "ArrowRight") ||
        (!e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey && (key === "j" || e.key === "]"));

      const isPrevKey =
        ((e.metaKey || e.ctrlKey) && key === "p") ||
        (e.altKey && (key === "p" || e.key === "ArrowLeft")) ||
        ((e.metaKey || e.ctrlKey) && e.key === "ArrowLeft") ||
        (!e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey && (key === "k" || e.key === "["));

      if (isNextKey) {
        e.preventDefault();
        e.stopPropagation();
        if (hasNext && nextCandidateId) {
          goToNext();
        }
      } else if (isPrevKey) {
        e.preventDefault();
        e.stopPropagation();
        if (hasPrev && prevCandidateId) {
          goToPrev();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [hasNext, nextCandidateId, hasPrev, prevCandidateId, goToNext, goToPrev]);

  if (currentIndex === -1 || totalDisplay <= 0) {
    return null;
  }

  const isMac =
    typeof navigator !== "undefined" &&
    /mac|iphone|ipad|ipod/i.test(navigator.userAgent || navigator.platform || "");
  const modKey = isMac ? "⌘" : "Ctrl+";

  return (
    <div className={`flex items-center gap-1 sm:gap-1.5 ${className}`}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!hasPrev}
        onClick={goToPrev}
        className="h-8 w-8 p-0 shrink-0 text-foreground hover:text-foreground disabled:opacity-40"
        tooltip={`Previous candidate (${modKey}P or ←)`}
        aria-label="Previous candidate"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <div
        className="inline-flex items-center justify-center px-2.5 py-1 text-xs font-medium text-muted-foreground bg-muted/50 border border-border/60 rounded-md whitespace-nowrap select-none h-8"
        title="Candidate position in current list"
      >
        <span>
          {isMobile
            ? `${currentIndex + 1} / ${totalDisplay}`
            : `Candidate ${currentIndex + 1} of ${totalDisplay}`}
        </span>
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!hasNext}
        onClick={goToNext}
        className="h-8 w-8 p-0 shrink-0 text-foreground hover:text-foreground disabled:opacity-40"
        tooltip={`Next candidate (${modKey}N or →)`}
        aria-label="Next candidate"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

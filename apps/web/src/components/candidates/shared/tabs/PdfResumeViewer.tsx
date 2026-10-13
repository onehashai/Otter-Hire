"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import {
  EventBus,
  PDFLinkService,
  PDFViewer,
  LinkTarget,
} from "pdfjs-dist/web/pdf_viewer.mjs";
import "pdfjs-dist/web/pdf_viewer.css";

import { Button } from "@onehash/ui/button";
import { ChevronLeft, ChevronRight, Minus, Plus, AlertCircle } from "lucide-react";

// Configure local worker
if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
}

interface PdfResumeViewerProps {
  url: string;
  className?: string;
  onLoadSuccess?: (pagesCount: number) => void;
  onLoadError?: (error: Error) => void;
}

export function PdfResumeViewer({
  url,
  className = "",
  onLoadSuccess,
  onLoadError,
}: PdfResumeViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const pdfViewerRef = useRef<PDFViewer | null>(null);
  const linkServiceRef = useRef<PDFLinkService | null>(null);
  const loadingTaskRef = useRef<any>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState<number | string>("page-width");

  const onLoadSuccessRef = useRef(onLoadSuccess);
  const onLoadErrorRef = useRef(onLoadError);
  const scaleRef = useRef(scale);

  useEffect(() => {
    onLoadSuccessRef.current = onLoadSuccess;
  }, [onLoadSuccess]);

  useEffect(() => {
    onLoadErrorRef.current = onLoadError;
  }, [onLoadError]);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  // Validate URL protocol: only allow safe http: and https:
  const isSafeUrl = (targetUrl: string): boolean => {
    try {
      const parsed = new URL(targetUrl, window.location.href);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  };

  // Intercept any link clicks inside the PDF container
  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = (e.target as HTMLElement).closest("a");
    if (!target) return;

    const href = target.getAttribute("href");
    if (!href) return;

    // Internal PDF links (e.g. named destinations or #page=...)
    if (href.startsWith("#")) {
      return;
    }

    // External link: ensure it uses a safe http/https protocol
    if (!isSafeUrl(href)) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // Enforce target="_blank" and rel="noopener noreferrer"
    target.setAttribute("target", "_blank");
    target.setAttribute("rel", "noopener noreferrer");
  };

  const handlePrevPage = () => {
    if (pdfViewerRef.current && currentPage > 1) {
      pdfViewerRef.current.currentPageNumber = currentPage - 1;
    }
  };

  const handleNextPage = () => {
    if (pdfViewerRef.current && currentPage < totalPages) {
      pdfViewerRef.current.currentPageNumber = currentPage + 1;
    }
  };

  const handleZoomIn = () => {
    if (pdfViewerRef.current) {
      const newScale = Math.min(3.0, (pdfViewerRef.current.currentScale || 1.0) * 1.2);
      pdfViewerRef.current.currentScale = newScale;
      setScale(newScale);
    }
  };

  const handleZoomOut = () => {
    if (pdfViewerRef.current) {
      const newScale = Math.max(0.4, (pdfViewerRef.current.currentScale || 1.0) / 1.2);
      pdfViewerRef.current.currentScale = newScale;
      setScale(newScale);
    }
  };

  const handleFitWidth = () => {
    if (pdfViewerRef.current) {
      pdfViewerRef.current.currentScaleValue = "page-width";
      setScale("page-width");
    }
  };

  const handleFitPage = () => {
    if (pdfViewerRef.current) {
      pdfViewerRef.current.currentScaleValue = "page-fit";
      setScale("page-fit");
    }
  };

  useEffect(() => {
    let isCancelled = false;

    if (!containerRef.current || !viewerRef.current || !url) return;

    setLoading(true);
    setError(null);
    setCurrentPage(1);
    setTotalPages(0);

    // Cancel any previous loading task
    if (loadingTaskRef.current) {
      loadingTaskRef.current.destroy().catch(() => {});
      loadingTaskRef.current = null;
    }

    const eventBus = new EventBus();

    // Configure LinkService to open external links in a new tab with rel="noopener noreferrer"
    const linkService = new PDFLinkService({
      eventBus,
      externalLinkTarget: LinkTarget.BLANK,
      externalLinkRel: "noopener noreferrer",
      externalLinkEnabled: true,
      ignoreDestinationZoom: false,
    });
    linkServiceRef.current = linkService;

    const pdfViewer = new PDFViewer({
      container: containerRef.current,
      viewer: viewerRef.current,
      eventBus,
      linkService,
      removePageBorders: false,
      textLayerMode: 1,
      annotationMode: 1,
    });
    pdfViewerRef.current = pdfViewer;
    linkService.setViewer(pdfViewer);

    // Event bus handlers
    const onPagesInit = () => {
      if (isCancelled) return;
      pdfViewer.currentScaleValue =
        typeof scaleRef.current === "string" ? scaleRef.current : "page-width";
    };

    const onPagesLoaded = (evt: { pagesCount: number }) => {
      if (isCancelled) return;
      setTotalPages(evt.pagesCount);
      setLoading(false);
      onLoadSuccessRef.current?.(evt.pagesCount);
    };

    const onPageChanging = (evt: { pageNumber: number }) => {
      if (isCancelled) return;
      setCurrentPage(evt.pageNumber);
    };

    eventBus.on("pagesinit", onPagesInit);
    eventBus.on("pagesloaded", onPagesLoaded);
    eventBus.on("pagechanging", onPageChanging);

    // Load PDF document
    const loadingTask = pdfjsLib.getDocument({
      url,
      withCredentials: true,
      cMapUrl: "https://unpkg.com/pdfjs-dist@4.10.38/cmaps/",
      cMapPacked: true,
    });
    loadingTaskRef.current = loadingTask;

    loadingTask.promise
      .then((pdfDocument) => {
        if (isCancelled) {
          pdfDocument.destroy().catch(() => {});
          return;
        }
        pdfViewer.setDocument(pdfDocument);
        linkService.setDocument(pdfDocument, null);
      })
      .catch((err) => {
        if (isCancelled) return;
        setLoading(false);
        const errorMsg = err instanceof Error ? err.message : "Failed to load PDF preview";
        setError(errorMsg);
        onLoadErrorRef.current?.(err instanceof Error ? err : new Error(errorMsg));
      });

    // Resize observer for responsive re-scaling
    const resizeObserver = new ResizeObserver(() => {
      if (pdfViewerRef.current && (scaleRef.current === "page-width" || scaleRef.current === "page-fit")) {
        pdfViewerRef.current.currentScaleValue = scaleRef.current;
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      isCancelled = true;
      resizeObserver.disconnect();
      eventBus.off("pagesinit", onPagesInit);
      eventBus.off("pagesloaded", onPagesLoaded);
      eventBus.off("pagechanging", onPageChanging);
      if (loadingTaskRef.current) {
        loadingTaskRef.current.destroy().catch(() => {});
        loadingTaskRef.current = null;
      }
      if (pdfViewerRef.current) {
        pdfViewerRef.current.cleanup();
      }
    };
  }, [url]);

  return (
    <div className={`flex flex-col bg-background relative overflow-hidden rounded-md border border-border ${className}`}>
      {/* PDF Navigation & Zoom Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/40 text-xs shrink-0 select-none">
        {/* Page controls */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handlePrevPage}
            disabled={loading || currentPage <= 1}
            aria-label="Previous Page"
            title="Previous Page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <span className="text-[11px] font-medium text-muted-foreground px-1 whitespace-nowrap">
            {totalPages > 0 ? (
              <>
                Page <span className="text-foreground font-semibold">{currentPage}</span> of {totalPages}
              </>
            ) : (
              "Page —"
            )}
          </span>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleNextPage}
            disabled={loading || currentPage >= totalPages}
            aria-label="Next Page"
            title="Next Page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Zoom & Fit controls */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleZoomOut}
            disabled={loading}
            aria-label="Zoom Out"
            title="Zoom Out"
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleZoomIn}
            disabled={loading}
            aria-label="Zoom In"
            title="Zoom In"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px] hidden sm:inline-flex"
            onClick={handleFitWidth}
            disabled={loading}
            title="Fit to Width"
          >
            Fit Width
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px] hidden sm:inline-flex"
            onClick={handleFitPage}
            disabled={loading}
            title="Fit to Page"
          >
            Fit Page
          </Button>
        </div>
      </div>

      {/* PDF Viewport Container */}
      <div className="relative flex-1 w-full min-h-0 overflow-hidden">
        <div
          ref={containerRef}
          onClick={handleContainerClick}
          className="pdfViewerContainer absolute inset-0 overflow-auto bg-slate-100 dark:bg-slate-950 focus:outline-none"
          tabIndex={0}
        >
          <div ref={viewerRef} className="pdfViewer py-4 flex flex-col items-center gap-4" />

          {/* Loading overlay */}
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-xs z-10">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-xs text-muted-foreground font-medium animate-pulse">
                Loading resume preview...
              </p>
            </div>
          )}

          {/* Error overlay */}
          {error && !loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center bg-background/95 z-10">
              <div className="h-10 w-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
                <AlertCircle className="h-5 w-5" />
              </div>
              <p className="text-xs text-destructive font-medium">{error}</p>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => {
                  if (url) {
                    window.open(url, "_blank", "noopener,noreferrer");
                  }
                }}
              >
                Open in new tab
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { describe, expect, it, beforeAll } from "vitest";
import * as pdfjsLib from "pdfjs-dist";

describe("PDF Link Service and target configuration", () => {
  beforeAll(() => {
    (globalThis as any).pdfjsLib = pdfjsLib;
    if (typeof globalThis.document === "undefined") {
      (globalThis as any).document = {
        documentElement: { style: {} },
        createElement: () => ({ style: {} }),
      };
    }
    if (typeof globalThis.window === "undefined") {
      (globalThis as any).window = {
        location: { href: "https://app.otter.bz" },
        matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
        requestAnimationFrame: (cb: Function) => setTimeout(cb, 0),
        cancelAnimationFrame: () => {},
      };
    }
  });

  it("configures LinkTarget.BLANK (new tab) and rel=noopener noreferrer for external links", async () => {
    const { PDFLinkService, LinkTarget } = await import("pdfjs-dist/web/pdf_viewer.mjs");

    const linkService = new PDFLinkService({
      externalLinkTarget: LinkTarget.BLANK,
      externalLinkRel: "noopener noreferrer",
      externalLinkEnabled: true,
    });

    expect(linkService.externalLinkTarget).toBe(LinkTarget.BLANK);
    expect(linkService.externalLinkRel).toBe("noopener noreferrer");
    expect(linkService.externalLinkEnabled).toBe(true);
    expect(LinkTarget.BLANK).toBe(2);
  });

  it("LinkTarget.BLANK equals value 2", async () => {
    const { LinkTarget } = await import("pdfjs-dist/web/pdf_viewer.mjs");
    expect(LinkTarget.BLANK).toBe(2);
  });

  it("validates external URLs allowing only safe http and https protocols", () => {
    const isSafeUrl = (targetUrl: string): boolean => {
      try {
        const parsed = new URL(targetUrl, "https://app.otter.bz");
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        return false;
      }
    };

    expect(isSafeUrl("https://github.com/example")).toBe(true);
    expect(isSafeUrl("http://example.com")).toBe(true);
    expect(isSafeUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(isSafeUrl("file:///etc/passwd")).toBe(false);
    expect(isSafeUrl("blob:https://app.otter.bz/uuid")).toBe(false);
  });
});

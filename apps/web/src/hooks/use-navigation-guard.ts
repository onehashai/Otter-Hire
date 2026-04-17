import { useEffect } from "react";
import { usePathname } from "next/navigation";

const jobSetupTabs = new Set([
  "info",
  "description",
  "application",
  "stages",
  "team",
  "integration",
]);

function toSegments(path: string): string[] {
  const cleanPath = path.split("?")[0].split("#")[0];
  return cleanPath.split("/").filter(Boolean);
}

function isJobSetupTabPath(path: string): boolean {
  const segments = toSegments(path);
  if (segments.length !== 3 || segments[0] !== "jobs") {
    return false;
  }
  return jobSetupTabs.has(segments[2]);
}

function getJobBase(path: string): string | null {
  const segments = toSegments(path);
  if (segments.length < 2 || segments[0] !== "jobs") {
    return null;
  }
  return `/jobs/${segments[1]}`;
}

export function useNavigationGuard(shouldBlock: boolean, onNavigate: (path: string) => void) {
  const pathname = usePathname();

  useEffect(() => {
    if (!shouldBlock) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest("a");

      if (!link) return;

      const href = link.getAttribute("href");
      if (!href || href.startsWith("#")) return;

      // Check if it's an internal link
      if (href.startsWith("/")) {
        const currentBase = getJobBase(pathname);
        const targetBase = getJobBase(href);
        const sameJob = currentBase !== null && currentBase === targetBase;

        // Allow navigation between setup tabs of same job only.
        if (sameJob && isJobSetupTabPath(pathname) && isJobSetupTabPath(href)) {
          return;
        }

        // Block navigation to different pages
        e.preventDefault();
        e.stopPropagation();
        onNavigate(href);
      }
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [shouldBlock, pathname, onNavigate]);
}

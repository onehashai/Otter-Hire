import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

export function useNavigationGuard(shouldBlock: boolean, onNavigate: (path: string) => void) {
  const pathname = usePathname();
  const router = useRouter();

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
        // Check if navigating outside current job page
        const currentJobMatch = pathname.match(/^\/jobs\/[^/]+/);
        const targetJobMatch = href.match(/^\/jobs\/[^/]+/);

        // Allow navigation within same job page (different tabs)
        if (currentJobMatch && targetJobMatch && currentJobMatch[0] === targetJobMatch[0]) {
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

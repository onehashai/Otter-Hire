import { useEffect } from "react";
import { usePathname } from "next/navigation";

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

      if (href.startsWith("/")) {
        e.preventDefault();
        e.stopPropagation();
        onNavigate(href);
      }
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [shouldBlock, pathname, onNavigate]);
}

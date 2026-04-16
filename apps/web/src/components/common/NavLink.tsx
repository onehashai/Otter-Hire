"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface NavLinkProps extends Omit<React.ComponentProps<typeof Link>, "className"> {
  className?: string;
  activeClassName?: string;
  end?: boolean;
  ref?: React.Ref<HTMLAnchorElement>;
}

function NavLink({ ref, className, activeClassName, end, href, ...props }: NavLinkProps) {
  const pathname = usePathname();
  const hrefString = typeof href === "string" ? href : href.pathname || "";
  const isActive = end ? pathname === hrefString : pathname.startsWith(hrefString);

  return (
    <Link ref={ref} href={href} className={cn(className, isActive && activeClassName)} {...props} />
  );
}

NavLink.displayName = "NavLink";

export { NavLink };

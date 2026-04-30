"use client";

import Image from "next/image";
import Link from "next/link";
import { X } from "lucide-react";
import { useEffect, useState } from "react";

const navLinks: { label: string; section: string }[] = [];

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

const TwoLineMenu = () => (
  <svg width="22" height="14" viewBox="0 0 22 14" fill="none" aria-hidden="true">
    <line
      x1="0"
      y1="2"
      x2="22"
      y2="2"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
    />
    <line
      x1="0"
      y1="12"
      x2="22"
      y2="12"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
    />
  </svg>
);

function useAuthState() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const check = () => {
      fetch(`/api/auth/check?_=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      })
        .then((res) => res.json())
        .then((data: { authenticated: boolean }) => setIsLoggedIn(data.authenticated))
        .catch(() => setIsLoggedIn(false));
    };

    check();

    // Re-check when user returns to this tab (e.g. after logging out in another tab)
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  return isLoggedIn;
}

function getAppUrl(path: string) {
  const rootHost = process.env.NEXT_PUBLIC_APP_ROOT_HOST || "localhost:3000";
  const appSubdomain = process.env.NEXT_PUBLIC_APP_SUBDOMAIN || "app";
  const protocol = typeof window !== "undefined" ? window.location.protocol : "http:";
  return `${protocol}//${appSubdomain}.${rootHost}${path}`;
}

export default function MarketingNav({ onLegalPage = false }: { onLegalPage?: boolean }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const isLoggedIn = useAuthState();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const ctaHref = isLoggedIn ? getAppUrl("/jobs") : "/signup";
  const ctaLabel = isLoggedIn ? "Go to Dashboard" : "Get Otter Hire";

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 px-4 sm:px-6 transition-all duration-300 ${scrolled || open ? "pt-4" : "pt-4 md:pt-5"}`}
    >
      {/* Main bar */}
      <div
        className={`mx-auto flex items-center justify-between gap-6 px-5 py-3 sm:px-6 max-w-6xl [transition:background_300ms,border-color_300ms,border-radius_300ms,box-shadow_300ms,backdrop-filter_300ms] ${
          scrolled || open
            ? "marketing-shell shadow-[0_20px_50px_rgba(15,23,42,0.10)]"
            : "marketing-nav-top"
        }`}
      >
        <Link
          href="/"
          onClick={
            !onLegalPage
              ? (e) => {
                  e.preventDefault();
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }
              : undefined
          }
          className="flex items-center"
        >
          <Image
            src="/brand/logo.svg"
            alt="Otter Hire"
            width={2000}
            height={491}
            className="h-7 w-auto sm:h-10"
            priority
          />
        </Link>

        {/* Desktop nav links — hidden on legal pages */}
        {!onLegalPage && (
          <nav className="hidden items-center gap-1 md:flex">
            {navLinks.map((link) => (
              <button
                key={link.section}
                type="button"
                onClick={() => scrollToSection(link.section)}
                className="marketing-nav-link rounded-full px-5 py-2.5 transition-all duration-200 hover:bg-white/35 hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.16)] hover:backdrop-blur-md"
              >
                {link.label}
              </button>
            ))}
          </nav>
        )}

        <div className="hidden items-center md:flex">
          {/* Render nothing until auth state resolves to avoid layout shift */}
          {isLoggedIn !== null && (
            <a
              href={ctaHref}
              target="_blank"
              rel="noopener noreferrer"
              className="marketing-button marketing-button-primary"
            >
              {ctaLabel}
            </a>
          )}
        </div>

        {/* Hamburger — 2-line icon, mobile only */}
        <button
          type="button"
          className="rounded-full p-2.5 text-slate-700 transition-colors hover:bg-black/5 md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <TwoLineMenu />}
        </button>
      </div>

      {/* Mobile dropdown — frosted glass, content-sized */}
      {open && (
        <div className="mx-auto mt-2 max-w-6xl md:hidden">
          <div
            className="overflow-hidden rounded-3xl border border-white/40"
            style={{
              background: "rgba(255,255,255,0.55)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
            }}
          >
            {(onLegalPage || navLinks.length > 0) && (
              <div className="flex flex-col items-center py-4">
                {!onLegalPage &&
                  navLinks.map((link) => (
                    <button
                      key={link.section}
                      type="button"
                      className="w-full px-6 py-4 text-center text-xl font-medium text-slate-800 transition-colors hover:bg-white/40"
                      onClick={() => {
                        scrollToSection(link.section);
                        setOpen(false);
                      }}
                    >
                      {link.label}
                    </button>
                  ))}
                {onLegalPage && (
                  <Link
                    href="/"
                    className="w-full px-6 py-4 text-center text-xl font-medium text-slate-800 transition-colors hover:bg-white/40"
                    onClick={() => setOpen(false)}
                  >
                    Home
                  </Link>
                )}
              </div>
            )}
            <div className="p-4">
              {isLoggedIn !== null && (
                <a
                  href={ctaHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="marketing-button marketing-button-primary w-full justify-center py-4 text-base"
                  onClick={() => setOpen(false)}
                >
                  {ctaLabel}
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

import Image from "next/image";
import Link from "next/link";

export default function MarketingFooter() {
  return (
    <footer className="marketing-footer-card mx-4 mb-6 sm:mx-6">
      <div className="flex flex-col items-center text-center">
        <Image
          src="/brand/logo.svg"
          alt="Otter Hire"
          width={2000}
          height={491}
          className="h-7 w-auto sm:h-10"
        />
        <p className="mt-4 text-base text-slate-600">Open-source ATS for modern hiring teams.</p>
        <p className="text-sm text-slate-500">
          Recruit faster with AI screening, pipeline automation, and structured collaboration.
        </p>
      </div>

      <div className="mt-8 border-t border-black/6 pt-5">
        <div className="flex flex-col items-center gap-4 sm:grid sm:grid-cols-3 sm:items-center sm:gap-0">
          {/* Social icons */}
          <div className="flex items-center gap-3">
            <a
              href="https://linkedin.com/company/onehash"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-black/10 text-slate-500 hover:border-black/20 hover:text-slate-900 transition-colors"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
                <rect x="2" y="9" width="4" height="12" />
                <circle cx="4" cy="4" r="2" />
              </svg>
            </a>
            <a
              href="https://x.com/OneHash"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="X (Twitter)"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-black/10 text-slate-500 hover:border-black/20 hover:text-slate-900 transition-colors"
            >
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.912-5.622Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
          </div>

          {/* Copyright */}
          <p className="text-center text-sm text-slate-500">
            © 2026 Otter Hire. All rights reserved.
          </p>

          {/* Legal links */}
          <div className="flex items-center justify-center gap-5 text-sm text-slate-500 sm:justify-end">
            <Link href="/privacy-policy" className="hover:text-slate-900 transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-slate-900 transition-colors">
              Terms &amp; Conditions
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

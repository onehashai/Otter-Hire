import type { Metadata } from "next";
import * as Sentry from "@sentry/nextjs";
import { PLATFORM_NAME } from "@/lib/constants";
import { Providers } from "./providers";
import { SonnerToaster } from "@onehash/ui/sonner";
import { headers } from "next/headers";
import "../styles/globals.css";

const baseMetadata: Metadata = {
  metadataBase: new URL("https://smartats.in"),
  title: PLATFORM_NAME,
  description: "AI-powered, open source modern ATS to recruit top talent faster and smarter.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/site.webmanifest",
  openGraph: {
    title: "Otter - AI-Powered Modern ATS",
    description: "AI-powered, open source modern ATS to recruit top talent faster and smarter.",
    url: "https://smartats.in",
    siteName: "Otter",
    images: [
      {
        url: "/social_media/og-image.png",
        width: 1200,
        height: 630,
        alt: "Otter - AI-powered, open source modern ATS",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Otter - AI-Powered Modern ATS",
    description: "AI-powered, open source modern ATS to recruit top talent faster and smarter.",
    images: ["/social_media/og-image.png"],
  },
};

export function generateMetadata(): Metadata {
  return {
    ...baseMetadata,
    other: {
      ...(baseMetadata.other ?? {}),
      ...Sentry.getTraceData(),
    },
  };
}

function isJobsSubdomain(host: string): boolean {
  const jobsSubdomain = (process.env.NEXT_PUBLIC_JOBS_SUBDOMAIN || "jobs").toLowerCase();
  const appSubdomain = (process.env.NEXT_PUBLIC_APP_SUBDOMAIN || "app").toLowerCase();
  const hostname = host.split(":")[0]?.toLowerCase();
  const hostSubdomain = hostname?.split(".")[0];
  if (!hostSubdomain) return false;
  // Keep app shell rendering on app subdomain even when env values drift.
  if (hostSubdomain === appSubdomain) return false;
  return hostSubdomain === jobsSubdomain;
}

/**
 * Returns true for the root/marketing domain so the auth Providers wrapper is
 * skipped — the marketing page has no protected routes and must not trigger
 * the client-side auth check that would redirect guests to /login.
 * Matches NEXT_PUBLIC_APP_ROOT_HOST plus bare localhost in development.
 */
function isMarketingDomain(host: string): boolean {
  const hostname = host.split(":")[0]?.toLowerCase();
  if (!hostname) return false;

  const marketingHosts = new Set(["localhost", "127.0.0.1"]);
  const configuredRootHostname = (process.env.NEXT_PUBLIC_APP_ROOT_HOST || "")
    .split(":")[0]
    .toLowerCase();

  if (configuredRootHostname) {
    marketingHosts.add(configuredRootHostname);
    marketingHosts.add(`www.${configuredRootHostname}`);
  }

  return marketingHosts.has(hostname);
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const host = headersList.get("host") || "";
  const isPublicSite = isJobsSubdomain(host) || isMarketingDomain(host);

  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {isPublicSite ? (
          <>
            <SonnerToaster />
            {children}
          </>
        ) : (
          <Providers>{children}</Providers>
        )}
      </body>
    </html>
  );
}

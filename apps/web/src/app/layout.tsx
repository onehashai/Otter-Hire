import type { Metadata } from "next";
import { PLATFORM_NAME } from "@/lib/constants";
import { Providers } from "./providers";
import { SonnerToaster } from "@onehash/ui/sonner";
import { headers } from "next/headers";
import "../styles/globals.css";

export const metadata: Metadata = {
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

function isJobsSubdomain(host: string): boolean {
  const jobsSubdomain = process.env.NEXT_PUBLIC_JOBS_SUBDOMAIN || "jobs";
  return host.startsWith(`${jobsSubdomain}.`);
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const headersList = headers();
  const host = headersList.get("host") || "";
  const isPublicSite = isJobsSubdomain(host);

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
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

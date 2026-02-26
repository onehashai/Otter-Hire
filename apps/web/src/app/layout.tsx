import type { Metadata } from "next";
import { Providers } from "./providers";
import { headers } from "next/headers";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "OneHash ATS",
  description: "Applicant Tracking System",
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
      <body>{isPublicSite ? children : <Providers>{children}</Providers>}</body>
    </html>
  );
}

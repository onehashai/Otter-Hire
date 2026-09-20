import type { Metadata } from "next";

export const metadata: Metadata = { title: "API Key" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

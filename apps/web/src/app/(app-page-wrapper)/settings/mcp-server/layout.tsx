import type { Metadata } from "next";

export const metadata: Metadata = { title: "MCP Server" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

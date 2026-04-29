import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Otter Hire — AI-Powered Modern ATS",
  description:
    "Hire smarter. Move faster. Otter Hire is the modern ATS that replaces cluttered spreadsheets and legacy software.",
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <div className="marketing-root">{children}</div>;
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Otter — AI-Powered Modern ATS",
  description:
    "Hire smarter. Move faster. Otter is the modern ATS that replaces cluttered spreadsheets and legacy software.",
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <div className="marketing-root">{children}</div>;
}

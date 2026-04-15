"use client";

import { useEffect } from "react";
import { resolveBrowserLanguage, changeLanguage } from "@/i18n";

type Props = {
  /** Value from the API: a locale code like "en" | "es" | "fr" | "de" | "pt", or "browser" */
  jobsPageLanguage: string;
  children: React.ReactNode;
};

/**
 * Resolves and applies the correct language for the public jobs pages.
 * - "browser" → detect from navigator.language, fall back to "en"
 * - anything else → use that locale directly
 */
export function JobsI18nProvider({ jobsPageLanguage, children }: Props) {
  useEffect(() => {
    const resolved = jobsPageLanguage === "browser" ? resolveBrowserLanguage() : jobsPageLanguage;
    void changeLanguage(resolved || "en");
  }, [jobsPageLanguage]);

  return <>{children}</>;
}

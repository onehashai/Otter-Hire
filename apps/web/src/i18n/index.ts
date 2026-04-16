import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import commonEn from "../../public/static/locales/en/common.json";
import commonEs from "../../public/static/locales/es/common.json";
import commonFr from "../../public/static/locales/fr/common.json";
import commonDe from "../../public/static/locales/de/common.json";
import commonPt from "../../public/static/locales/pt/common.json";

i18n.use(initReactI18next).init({
  lng: "en",
  fallbackLng: "en",
  defaultNS: "common",
  ns: ["common"],
  resources: {
    en: { common: commonEn },
    es: { common: commonEs },
    fr: { common: commonFr },
    de: { common: commonDe },
    pt: { common: commonPt },
  },
  interpolation: { escapeValue: false },
});

export default i18n;

/** Languages available for the app UI (recruiter dashboard). */
export const APP_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "pt", label: "Português" },
] as const;

export type AppLanguageCode = (typeof APP_LANGUAGES)[number]["code"];

/** Languages available for the public jobs page (includes browser-detect option). */
export const JOBS_PAGE_LANGUAGES = [
  { code: "browser", label: "Visitor's Browser Language" },
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "pt", label: "Português" },
] as const;

export type JobsPageLanguageCode = (typeof JOBS_PAGE_LANGUAGES)[number]["code"];

const SUPPORTED_CODES = APP_LANGUAGES.map((l) => l.code) as string[];

/**
 * Resolve a BCP-47 browser language tag (e.g. "fr-CA") to a supported code.
 * Falls back to "en" if not supported.
 */
export function resolveBrowserLanguage(): AppLanguageCode {
  if (typeof navigator === "undefined") return "en";
  const tag = navigator.language ?? "en";
  const base = tag.split("-")[0].toLowerCase();
  return (SUPPORTED_CODES.includes(base) ? base : "en") as AppLanguageCode;
}

/** Change the active app language and persist to localStorage. */
export const changeLanguage = async (lng: string): Promise<void> => {
  await i18n.changeLanguage(lng);
  if (typeof window !== "undefined") {
    localStorage.setItem("app_language", lng);
  }
};

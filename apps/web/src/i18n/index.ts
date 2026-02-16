import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import HttpBackend from "i18next-http-backend";

const isClient = typeof window !== "undefined";

// Only use HttpBackend on the client — during SSR/build there is no server
// to fetch translations from, which would cause the build to hang.
if (isClient) {
  i18n.use(HttpBackend);
}

i18n
  .use(initReactI18next)
  .init({
    lng: isClient ? (localStorage.getItem("language") || "en") : "en",
    fallbackLng: "en",
    defaultNS: "common",
    ns: ["common"],
    interpolation: {
      escapeValue: false,
    },
    // HttpBackend options — only relevant on the client
    ...(isClient && {
      backend: {
        loadPath: "/static/locales/{{lng}}/{{ns}}.json",
      },
    }),
    // During SSR, provide empty resources so rendering doesn't block
    ...(!isClient && {
      resources: { en: { common: {} } },
    }),
  });

export default i18n;

/**
 * Available languages for the language switcher.
 */
export const languages = [
  { code: "en", label: "English" },
] as const;

/**
 * Change the active language and persist to localStorage.
 */
export const changeLanguage = (lng: string) => {
  i18n.changeLanguage(lng);
  if (isClient) {
    localStorage.setItem("language", lng);
  }
};

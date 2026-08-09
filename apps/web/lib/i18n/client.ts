"use client";

/**
 * i18n client entry point — React bindings.
 *
 * This module adds `react-i18next` and browser language detection on top
 * of the shared i18next instance from `./index`. It MUST only be imported
 * from "use client" components.
 *
 * DO NOT import this from Server Components or server utilities — the
 * internal React.createContext() call will break SSR builds because the
 * server-side React bundle does not include createContext.
 */

import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import i18n from "./index";
import { LANGUAGE_STORAGE_KEY } from "./languages";

// Wire up react-i18next and browser language detection on top of the
// already-initialized i18next instance. This must happen exactly once
// before any component calls useTranslation().
if (!i18n.isInitialized || !i18n.options?.detection) {
  // Re-init with React + detection plugins. i18next merges the new
  // options with the existing ones from ./index.ts.
  i18n.use(LanguageDetector).use(initReactI18next).init({
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
    },
    react: { useSuspense: false },
  });
}

// Re-export everything from the server-safe core so consumers only
// need a single import.
export {
  LANGUAGES,
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  getLanguageByCode,
  isLanguageSupported,
  changeLanguage,
  getCurrentLanguage,
  setLanguage,
  type Language,
} from "./index";

export default i18n;

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import { DEFAULT_LANGUAGE, LANGUAGES } from "./languages";

// Import all locale files
import en from "./locales/en.json";
import zhCN from "./locales/zh-CN.json";
import ja from "./locales/ja.json";
import ko from "./locales/ko.json";
import de from "./locales/de.json";
import fr from "./locales/fr.json";
import es from "./locales/es.json";
import pt from "./locales/pt.json";
import it from "./locales/it.json";
import nl from "./locales/nl.json";
import pl from "./locales/pl.json";
import ru from "./locales/ru.json";
import tr from "./locales/tr.json";
import vi from "./locales/vi.json";
import th from "./locales/th.json";
import id from "./locales/id.json";
import ms from "./locales/ms.json";
import hi from "./locales/hi.json";
import uk from "./locales/uk.json";
import sv from "./locales/sv.json";

// Resource bundle with all languages
const resources = {
  en: { translation: en },
  "zh-CN": { translation: zhCN },
  ja: { translation: ja },
  ko: { translation: ko },
  de: { translation: de },
  fr: { translation: fr },
  es: { translation: es },
  pt: { translation: pt },
  it: { translation: it },
  nl: { translation: nl },
  pl: { translation: pl },
  ru: { translation: ru },
  tr: { translation: tr },
  vi: { translation: vi },
  th: { translation: th },
  id: { translation: id },
  ms: { translation: ms },
  hi: { translation: hi },
  uk: { translation: uk },
  sv: { translation: sv },
};

// Get supported language codes
const supportedLanguages = LANGUAGES.map((lang) => lang.code);

// Initialize i18next
i18n
  .use(LanguageDetector) // Auto-detect user language
  .use(initReactI18next) // Pass i18n instance to react-i18next
  .init({
    resources,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: supportedLanguages,
    interpolation: {
      escapeValue: false, // React already escapes
    },
    detection: {
      // Detection order: localStorage first, then navigator
      order: ["localStorage", "navigator"],
      // Cache to localStorage
      caches: ["localStorage"],
      // LocalStorage key name
      lookupLocalStorage: "browse-mcp-language",
    },
    // React specific options
    react: {
      useSuspense: false, // Disable suspense to prevent loading states
    },
  });

/**
 * Change the current language and persist to localStorage.
 * @param langCode - Language code (e.g., "en", "zh-CN")
 */
export function changeLanguage(langCode: string): Promise<void> {
  return i18n.changeLanguage(langCode).then(() => {
    // Also save to localStorage (handled by detector, but explicit for clarity)
    localStorage.setItem("browse-mcp-language", langCode);
  });
}

/**
 * Get the current language code.
 */
export function getCurrentLanguage(): string {
  return i18n.language || DEFAULT_LANGUAGE;
}

export default i18n;

/**
 * i18n configuration for the web application.
 *
 * This module provides i18next initialization with localStorage persistence.
 * Uses the same translation files as the desktop app for consistency.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import { DEFAULT_LANGUAGE, LANGUAGES, LANGUAGE_STORAGE_KEY } from './languages';

// Import all locale files
import en from './locales/en.json';
import zhCN from './locales/zh-CN.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';
import de from './locales/de.json';
import fr from './locales/fr.json';
import es from './locales/es.json';
import pt from './locales/pt.json';
import it from './locales/it.json';
import nl from './locales/nl.json';
import pl from './locales/pl.json';
import ru from './locales/ru.json';
import tr from './locales/tr.json';
import vi from './locales/vi.json';
import th from './locales/th.json';
import id from './locales/id.json';
import ms from './locales/ms.json';
import hi from './locales/hi.json';
import uk from './locales/uk.json';
import sv from './locales/sv.json';

// Resource bundle with all languages
const resources = {
  en: { translation: en },
  'zh-CN': { translation: zhCN },
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

// Check if running on client or server
const isClient = typeof window !== 'undefined';

// Initialize i18next - must work on both client and server for SSR
if (!i18n.isInitialized) {
  // On client, use language detector; on server, use default language
  if (isClient) {
    i18n.use(LanguageDetector);
  }

  i18n
    .use(initReactI18next) // Pass i18n instance to react-i18next
    .init({
      resources,
      lng: isClient ? undefined : DEFAULT_LANGUAGE, // Server uses default, client uses detector
      fallbackLng: DEFAULT_LANGUAGE,
      supportedLngs: supportedLanguages,
      interpolation: {
        escapeValue: false, // React already escapes
      },
      detection: isClient ? {
        // Detection order: localStorage first, then navigator
        order: ['localStorage', 'navigator'],
        // Cache to localStorage
        caches: ['localStorage'],
        // LocalStorage key name
        lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      } : undefined,
      // React specific options
      react: {
        useSuspense: false, // Disable suspense to prevent loading states
      },
    });
}

// Re-export from languages module
export {
  LANGUAGES,
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  getLanguageByCode,
  isLanguageSupported,
  type Language,
} from './languages';

/**
 * Change the current language and persist to localStorage.
 * @param langCode - Language code (e.g., "en", "zh-CN")
 */
export function changeLanguage(langCode: string): Promise<void> {
  return i18n.changeLanguage(langCode).then(() => {
    // Also save to localStorage (handled by detector, but explicit for clarity)
    if (typeof window !== 'undefined') {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, langCode);
      // Dispatch a custom event so other components can react
      window.dispatchEvent(
        new CustomEvent('languagechange', { detail: { language: langCode } })
      );
    }
  });
}

/**
 * Get the current language code.
 */
export function getCurrentLanguage(): string {
  return i18n.language || DEFAULT_LANGUAGE;
}

/**
 * Set the current language and persist to localStorage.
 * @deprecated Use changeLanguage instead for i18next integration
 */
export function setLanguage(langCode: string): void {
  changeLanguage(langCode);
}

export default i18n;

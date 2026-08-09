/**
 * i18n core — server-safe entry point.
 *
 * This module depends ONLY on `i18next` (no React). It is safe to import
 * from Server Components, API routes, and server utilities.
 *
 * For React bindings (`useTranslation`, `Trans`, etc.), import from
 * `@/lib/i18n/client` instead — that module adds `react-i18next` on the
 * client side.
 *
 * Lazy-loads non-default languages to reduce initial bundle size.
 * Only en + zh-CN are eagerly loaded (~90 KB each); the other 18
 * languages are loaded on demand when changeLanguage() is called.
 */

import i18n from 'i18next';
import { DEFAULT_LANGUAGE, LANGUAGES, LANGUAGE_STORAGE_KEY } from './languages';

// Eagerly load only the two most-used languages
import en from './locales/en.json';
import zhCN from './locales/zh-CN.json';

// Resource bundle — starts with eager languages, lazy-loads the rest
const resources: Record<string, { translation: typeof en }> = {
  en: { translation: en },
  'zh-CN': { translation: zhCN },
};

// Track which languages have been loaded
const loadedLanguages = new Set<string>(['en', 'zh-CN']);

// Dynamic imports for remaining languages (loaded on first use)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const localeLoaders: Record<string, () => Promise<{ default: any }>> = {
  ja:  () => import('./locales/ja.json'),
  ko:  () => import('./locales/ko.json'),
  de:  () => import('./locales/de.json'),
  fr:  () => import('./locales/fr.json'),
  es:  () => import('./locales/es.json'),
  pt:  () => import('./locales/pt.json'),
  it:  () => import('./locales/it.json'),
  nl:  () => import('./locales/nl.json'),
  pl:  () => import('./locales/pl.json'),
  ru:  () => import('./locales/ru.json'),
  tr:  () => import('./locales/tr.json'),
  vi:  () => import('./locales/vi.json'),
  th:  () => import('./locales/th.json'),
  id:  () => import('./locales/id.json'),
  ms:  () => import('./locales/ms.json'),
  hi:  () => import('./locales/hi.json'),
  uk:  () => import('./locales/uk.json'),
  sv:  () => import('./locales/sv.json'),
};

// Get supported language codes
const supportedLanguages = LANGUAGES.map((lang) => lang.code);

// Initialize the base i18next instance.
// react-i18next is initialized separately in `./client.ts` (client-only).
if (!i18n.isInitialized) {
  i18n.init({
    resources,
    lng: typeof window !== 'undefined' ? undefined : DEFAULT_LANGUAGE,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: supportedLanguages,
    interpolation: { escapeValue: false },
  });
}

/**
 * Load a language bundle on demand and add it to i18next.
 */
async function loadLanguageBundle(langCode: string): Promise<void> {
  if (loadedLanguages.has(langCode)) return;

  const loader = localeLoaders[langCode];
  if (!loader) {
    console.warn(`[i18n] Unknown language: ${langCode}`);
    return;
  }

  try {
    const mod = await loader();
    const bundle = mod.default;
    // Add to i18next resources
    i18n.addResourceBundle(langCode, 'translation', bundle, true, true);
    loadedLanguages.add(langCode);
  } catch (err) {
    console.error(`[i18n] Failed to load language bundle: ${langCode}`, err);
  }
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
 * Lazy-loads the translation bundle if needed.
 */
export async function changeLanguage(langCode: string): Promise<void> {
  // Ensure the bundle is loaded before switching
  await loadLanguageBundle(langCode);

  return i18n.changeLanguage(langCode).then(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, langCode);
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

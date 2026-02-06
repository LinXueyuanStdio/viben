/**
 * i18n utilities for the web application.
 *
 * This module provides client-side language management with localStorage persistence.
 * Full translation support will be added in a future phase.
 */

import {
  LANGUAGES as LANG_LIST,
  DEFAULT_LANGUAGE as DEFAULT_LANG,
  LANGUAGE_STORAGE_KEY as LANG_KEY,
  isLanguageSupported as checkLanguageSupported,
} from './languages';

export {
  LANGUAGES,
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  getLanguageByCode,
  isLanguageSupported,
  type Language,
} from './languages';

/**
 * Get the current language from localStorage or browser preferences.
 * This function should only be called on the client side.
 */
export function getCurrentLanguage(): string {
  if (typeof window === 'undefined') {
    return 'en';
  }

  // Check localStorage first
  const stored = localStorage.getItem(LANG_KEY);
  if (stored) {
    return stored;
  }

  // Fall back to browser language
  const browserLang = navigator.language;

  // Check for exact match
  const exactMatch = LANG_LIST.find((lang) => lang.code === browserLang);
  if (exactMatch) {
    return exactMatch.code;
  }

  // Check for partial match (e.g., "en-US" -> "en")
  const langPrefix = browserLang.split('-')[0];
  const partialMatch = LANG_LIST.find((lang) => lang.code === langPrefix);
  if (partialMatch) {
    return partialMatch.code;
  }

  return DEFAULT_LANG;
}

/**
 * Set the current language and persist to localStorage.
 * This function should only be called on the client side.
 */
export function setLanguage(langCode: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  if (checkLanguageSupported(langCode)) {
    localStorage.setItem(LANG_KEY, langCode);
    // Dispatch a custom event so other components can react
    window.dispatchEvent(
      new CustomEvent('languagechange', { detail: { language: langCode } })
    );
  }
}

/**
 * Language configuration for i18n support.
 * Each language has a code, English name, and native name.
 */

export interface Language {
  code: string;
  name: string;
  nativeName: string;
}

/**
 * List of supported languages (20 LTR languages).
 * RTL languages (Arabic, Hebrew) are excluded in this phase.
 */
export const LANGUAGES: Language[] = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "zh-CN", name: "Chinese (Simplified)", nativeName: "简体中文" },
  { code: "ja", name: "Japanese", nativeName: "日本語" },
  { code: "ko", name: "Korean", nativeName: "한국어" },
  { code: "de", name: "German", nativeName: "Deutsch" },
  { code: "fr", name: "French", nativeName: "Français" },
  { code: "es", name: "Spanish", nativeName: "Español" },
  { code: "pt", name: "Portuguese", nativeName: "Português" },
  { code: "it", name: "Italian", nativeName: "Italiano" },
  { code: "nl", name: "Dutch", nativeName: "Nederlands" },
  { code: "pl", name: "Polish", nativeName: "Polski" },
  { code: "ru", name: "Russian", nativeName: "Русский" },
  { code: "tr", name: "Turkish", nativeName: "Türkçe" },
  { code: "vi", name: "Vietnamese", nativeName: "Tiếng Việt" },
  { code: "th", name: "Thai", nativeName: "ไทย" },
  { code: "id", name: "Indonesian", nativeName: "Bahasa Indonesia" },
  { code: "ms", name: "Malay", nativeName: "Bahasa Melayu" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी" },
  { code: "uk", name: "Ukrainian", nativeName: "Українська" },
  { code: "sv", name: "Swedish", nativeName: "Svenska" },
];

/**
 * Get language by code.
 */
export function getLanguageByCode(code: string): Language | undefined {
  return LANGUAGES.find((lang) => lang.code === code);
}

/**
 * Check if a language code is supported.
 */
export function isLanguageSupported(code: string): boolean {
  return LANGUAGES.some((lang) => lang.code === code);
}

/**
 * Get the default language code.
 */
export const DEFAULT_LANGUAGE = "en";

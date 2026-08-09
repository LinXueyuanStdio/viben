/**
 * Server-side translation helper.
 *
 * Provides a per-request translation function that respects the user's
 * language preference (read from cookies / Accept-Language header).
 *
 * Usage in Server Components:
 * ```tsx
 * import { getServerT } from "@/lib/i18n/server-t";
 *
 * export default async function MyPage() {
 *   const { t } = await getServerT();
 *   return <h1>{t("some.key")}</h1>;
 * }
 * ```
 *
 * For server utilities that need to translate outside a component:
 * ```ts
 * import { getServerT } from "@/lib/i18n/server-t";
 * const { t } = await getServerT("zh-CN");
 * ```
 *
 * Design notes:
 * — Uses `react.cache()` to deduplicate within a single render pass.
 * — `i18n.getFixedT(lang)` returns a `t` function bound to a specific
 *   language WITHOUT changing the global i18n instance language. This
 *   avoids race conditions across concurrent requests.
 */

import { cache } from "react";
import { cookies, headers } from "next/headers";
import i18n from "./index";

const LANGUAGE_COOKIE = "i18nextLng";

/** Maps Accept-Language header prefixes to supported language codes. */
const ACCEPT_LANGUAGE_MAP: Record<string, string | undefined> = {
  zh: "zh-CN",
  "zh-CN": "zh-CN",
  "zh-TW": "zh-CN",
  "zh-HK": "zh-CN",
  ja: "ja",
  ko: "ko",
  de: "de",
  fr: "fr",
  es: "es",
  pt: "pt",
  it: "it",
  nl: "nl",
  pl: "pl",
  ru: "ru",
  tr: "tr",
  vi: "vi",
  th: "th",
  id: "id",
  ms: "ms",
  hi: "hi",
  uk: "uk",
  sv: "sv",
};

function parseAcceptLanguage(header: string | null): string | null {
  if (!header) return null;
  // Accept-Language: zh-CN,zh;q=0.9,en;q=0.8
  const parts = header.split(",");
  for (const part of parts) {
    const langTag = part.split(";")[0]?.trim();
    if (!langTag) continue;
    const mapped = ACCEPT_LANGUAGE_MAP[langTag];
    if (mapped) return mapped;
    // Try prefix match: "zh" matches "zh-CN"
    const prefix = langTag.split("-")[0];
    const prefixMapped = ACCEPT_LANGUAGE_MAP[prefix];
    if (prefixMapped) return prefixMapped;
  }
  return null;
}

/**
 * Read the user's preferred language from the request.
 * Priority: cookie > Accept-Language header > default
 */
async function detectLanguage(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const cookieLang = cookieStore.get(LANGUAGE_COOKIE)?.value;
    if (cookieLang) return cookieLang;
  } catch {
    // cookies() throws outside of a request context — ignore
  }

  try {
    const headersList = await headers();
    const acceptLang = headersList.get("accept-language");
    const headerLang = parseAcceptLanguage(acceptLang);
    if (headerLang) return headerLang;
  } catch {
    // headers() throws outside of a request context — ignore
  }

  return null;
}

/**
 * Get a per-request translation function.
 *
 * Call this in Server Components or server utilities to translate
 * keys in the user's preferred language.
 *
 * `cache()` ensures that within a single render pass, the same
 * language detection and `changeLanguage` call only happens once
 * regardless of how many components call `getServerT()`.
 */
export const getServerT = cache(async (lang?: string): Promise<{
  t: (key: string) => string;
  language: string;
}> => {
  const language = lang ?? (await detectLanguage()) ?? i18n.language;

  // getFixedT returns a t function bound to a specific language without
  // mutating the global i18n instance — safe for concurrent requests.
  return {
    t: i18n.getFixedT(language) as (key: string) => string,
    language,
  };
});

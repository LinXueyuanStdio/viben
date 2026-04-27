/**
 * Icon Cache
 *
 * Module-level cache for dynamically loaded Lucide icons.
 * Shared between DynamicLucideIcon, use-lucide-icons hook, and IconDisplay.
 */

import dynamicIconImports from "lucide-react/dynamicIconImports";
import type { LucideIcon } from "lucide-react";
import { LUCIDE_ICON_MAP } from "./constants";

/** All available icon names (synchronously available) */
export const ALL_ICON_NAMES: string[] = Object.keys(dynamicIconImports);

/** Module-level cache: icon name -> loaded component */
const iconCache = new Map<string, LucideIcon>();

/** In-flight promises to avoid duplicate loads */
const loadingPromises = new Map<string, Promise<LucideIcon | null>>();

/**
 * Get a cached icon component. Returns null if not yet loaded.
 * Checks static LUCIDE_ICON_MAP first (zero-latency), then dynamic cache.
 */
export function getCachedIcon(name: string): LucideIcon | null {
  // Static fast path
  const staticIcon = LUCIDE_ICON_MAP[name];
  if (staticIcon) return staticIcon;

  // Dynamic cache
  return iconCache.get(name) ?? null;
}

/**
 * Load a single icon by name. Returns the component or null on failure.
 * Results are cached — subsequent calls return immediately from cache.
 */
export async function loadIcon(name: string): Promise<LucideIcon | null> {
  // Already cached
  const cached = getCachedIcon(name);
  if (cached) return cached;

  // Already loading
  const existing = loadingPromises.get(name);
  if (existing) return existing;

  // Not a valid icon name
  const importFn = dynamicIconImports[name as keyof typeof dynamicIconImports];
  if (!importFn) return null;

  const promise = importFn()
    .then((mod) => {
      const icon = mod.default;
      iconCache.set(name, icon);
      loadingPromises.delete(name);
      return icon;
    })
    .catch(() => {
      loadingPromises.delete(name);
      return null;
    });

  loadingPromises.set(name, promise);
  return promise;
}

/**
 * Load a batch of icons. Returns when all are loaded or failed.
 * Used by virtual scroll to preload visible rows.
 */
export async function loadIcons(names: string[]): Promise<void> {
  await Promise.all(names.map(loadIcon));
}

/**
 * Get the number of cached icons (for debugging).
 */
export function getCacheSize(): number {
  return iconCache.size;
}

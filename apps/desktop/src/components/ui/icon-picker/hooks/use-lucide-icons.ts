/**
 * useLucideIcons Hook
 *
 * Provides full Lucide icon set with:
 * - Search filtering (debounced via useDeferredValue)
 * - Category grouping with "Other" fallback
 * - Async batch loading for virtual scroll
 * - Module-level cache integration
 */

import { useState, useMemo, useDeferredValue, useCallback, useRef } from "react";
import type { LucideIcon } from "lucide-react";
import { ALL_ICON_NAMES, getCachedIcon, loadIcons as batchLoadIcons } from "../icon-cache";
import { LUCIDE_CATEGORIES, CATEGORIZED_ICON_NAMES } from "../constants";
import type { VirtualRow, CategoryGroup } from "../types";

const ICONS_PER_ROW = 8;
const LOAD_DEBOUNCE_MS = 100;

/**
 * Build category groups including the dynamic "Other" category.
 */
function buildCategoryGroups(): CategoryGroup[] {
  const groups: CategoryGroup[] = LUCIDE_CATEGORIES
    .filter((c) => c.id !== "other")
    .map((c) => ({
      id: c.id,
      labelKey: c.labelKey,
      label: c.id, // fallback label, i18n resolved in component
      icons: c.icons,
    }));

  // Collect uncategorized icons into "Other"
  const otherIcons = ALL_ICON_NAMES.filter((name) => !CATEGORIZED_ICON_NAMES.has(name));
  if (otherIcons.length > 0) {
    groups.push({
      id: "other",
      labelKey: "iconPicker.category.other",
      label: "Other",
      icons: otherIcons,
    });
  }

  return groups;
}

/** Cached category groups (computed once) */
let categoryGroupsCache: CategoryGroup[] | null = null;
function getCategoryGroups(): CategoryGroup[] {
  if (!categoryGroupsCache) {
    categoryGroupsCache = buildCategoryGroups();
  }
  return categoryGroupsCache;
}

/**
 * Build flat virtual rows from category groups.
 */
function buildCategoryRows(groups: CategoryGroup[]): VirtualRow[] {
  const rows: VirtualRow[] = [];
  for (const group of groups) {
    rows.push({ type: "header", categoryId: group.id, label: group.labelKey });
    for (let i = 0; i < group.icons.length; i += ICONS_PER_ROW) {
      rows.push({ type: "icons", names: group.icons.slice(i, i + ICONS_PER_ROW) });
    }
  }
  return rows;
}

/**
 * Build flat virtual rows from a filtered icon name list (search mode, no headers).
 */
function buildSearchRows(names: string[]): VirtualRow[] {
  const rows: VirtualRow[] = [];
  for (let i = 0; i < names.length; i += ICONS_PER_ROW) {
    rows.push({ type: "icons", names: names.slice(i, i + ICONS_PER_ROW) });
  }
  return rows;
}

export interface UseLucideIconsReturn {
  /** All icon names (sync) */
  allIconNames: string[];
  /** Category groups */
  categoryGroups: CategoryGroup[];
  /** Flat virtual rows for rendering */
  virtualRows: VirtualRow[];
  /** Whether in search mode */
  isSearching: boolean;
  /** Get a cached icon component (null if not loaded yet) */
  getIcon: (name: string) => LucideIcon | null;
  /** Trigger batch load for a set of icon names (debounced) */
  requestLoad: (names: string[]) => void;
  /** Search query */
  search: string;
  /** Set search query */
  setSearch: (q: string) => void;
  /** Category ID -> row index mapping for scroll-to-category */
  categoryRowIndex: Map<string, number>;
}

export function useLucideIcons(): UseLucideIconsReturn {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [, forceUpdate] = useState(0);

  // Debounce timer ref for batch loading
  const loadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingLoadRef = useRef<Set<string>>(new Set());

  const categoryGroups = useMemo(() => getCategoryGroups(), []);

  // Filter icons by search query
  const filteredNames = useMemo(() => {
    if (!deferredSearch.trim()) return null; // null = not searching
    const q = deferredSearch.trim().toLowerCase();
    return ALL_ICON_NAMES.filter((name) => name.includes(q));
  }, [deferredSearch]);

  const isSearching = filteredNames !== null;

  // Build virtual rows
  const virtualRows = useMemo(() => {
    if (filteredNames) {
      return buildSearchRows(filteredNames);
    }
    return buildCategoryRows(categoryGroups);
  }, [filteredNames, categoryGroups]);

  // Category ID -> row index mapping
  const categoryRowIndex = useMemo(() => {
    const map = new Map<string, number>();
    virtualRows.forEach((row, index) => {
      if (row.type === "header") {
        map.set(row.categoryId, index);
      }
    });
    return map;
  }, [virtualRows]);

  // Get cached icon
  const getIcon = useCallback((name: string): LucideIcon | null => {
    return getCachedIcon(name);
  }, []);

  // Debounced batch load
  const requestLoad = useCallback((names: string[]) => {
    for (const name of names) {
      if (!getCachedIcon(name)) {
        pendingLoadRef.current.add(name);
      }
    }

    if (pendingLoadRef.current.size === 0) return;

    if (loadTimerRef.current) {
      clearTimeout(loadTimerRef.current);
    }

    loadTimerRef.current = setTimeout(() => {
      const toLoad = Array.from(pendingLoadRef.current);
      pendingLoadRef.current.clear();
      loadTimerRef.current = null;

      if (toLoad.length > 0) {
        batchLoadIcons(toLoad).then(() => {
          // Force re-render so icons appear
          forceUpdate((n) => n + 1);
        });
      }
    }, LOAD_DEBOUNCE_MS);
  }, []);

  return {
    allIconNames: ALL_ICON_NAMES,
    categoryGroups,
    virtualRows,
    isSearching,
    getIcon,
    requestLoad,
    search,
    setSearch,
    categoryRowIndex,
  };
}

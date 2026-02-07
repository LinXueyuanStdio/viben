import { useMemo } from "react";
import type { SortMode, SortDirection } from "../components/sort-types";

interface SortableItem {
  id: string;
  title?: string;
  priority?: string;
  dueDate?: string;
  createdAt?: string;
  updatedAt?: string;
  order?: number;
}

const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
  none: 4,
};

export function useSortedItems<T extends SortableItem>(
  items: T[],
  mode: SortMode,
  direction: SortDirection
): T[] {
  return useMemo(() => {
    if (mode === "manual") {
      return [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }

    const sorted = [...items].sort((a, b) => {
      let comparison = 0;

      switch (mode) {
        case "priority":
          const pa = PRIORITY_ORDER[a.priority ?? "none"] ?? 4;
          const pb = PRIORITY_ORDER[b.priority ?? "none"] ?? 4;
          comparison = pa - pb;
          break;
        case "dueDate":
          const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
          const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
          comparison = da - db;
          break;
        case "createdAt":
          const ca = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const cb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          comparison = cb - ca; // Default: newer first
          break;
        case "updatedAt":
          const ua = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const ub = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          comparison = ub - ua;
          break;
        case "title":
          comparison = (a.title ?? "").localeCompare(b.title ?? "");
          break;
      }

      return direction === "desc" ? -comparison : comparison;
    });

    return sorted;
  }, [items, mode, direction]);
}

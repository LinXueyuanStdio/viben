import { useMemo } from "react";
import type { KanbanFilter } from "../components/kanban-filter-types";

interface FilterableItem {
  id: string;
  title: string;
  description?: string | null;
  priority?: string;
  tagIds?: string[];
  assigneeId?: string;
}

export function useFilteredItems<T extends FilterableItem>(
  items: T[],
  filter: KanbanFilter
): T[] {
  return useMemo(() => {
    return items.filter((item) => {
      // Search
      if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        const matches =
          item.title.toLowerCase().includes(searchLower) ||
          item.description?.toLowerCase().includes(searchLower);
        if (!matches) return false;
      }

      // Priority
      if (filter.priorities?.length) {
        if (!filter.priorities.includes(item.priority as any)) {
          return false;
        }
      }

      // Tags
      if (filter.tagIds?.length) {
        const itemTagIds = item.tagIds || [];
        const hasMatchingTag = filter.tagIds.some((id) => itemTagIds.includes(id));
        if (!hasMatchingTag) return false;
      }

      // Assignee
      if (filter.assigneeIds?.length) {
        if (!filter.assigneeIds.includes(item.assigneeId || "")) {
          return false;
        }
      }

      return true;
    });
  }, [items, filter]);
}

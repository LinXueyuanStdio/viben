import { useState, useCallback, useMemo } from "react";
import type { ListGroup } from "../components/grouped-list-types";

export interface UseGroupedListOptions<T> {
  /** Initial collapsed group IDs */
  initialCollapsed?: string[];
}

export interface UseGroupedListReturn {
  /** Set of collapsed group IDs */
  collapsedGroups: Set<string>;
  /** Toggle a group's collapsed state */
  toggleGroup: (groupId: string) => void;
  /** Check if a group is collapsed */
  isCollapsed: (groupId: string) => boolean;
  /** Collapse all groups */
  collapseAll: (groupIds: string[]) => void;
  /** Expand all groups */
  expandAll: () => void;
}

/**
 * Hook to manage collapsed groups state for GroupedListView
 */
export function useGroupedList<T>(
  options: UseGroupedListOptions<T> = {}
): UseGroupedListReturn {
  const { initialCollapsed = [] } = options;

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    () => new Set(initialCollapsed)
  );

  const toggleGroup = useCallback((groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  const isCollapsed = useCallback(
    (groupId: string) => {
      return collapsedGroups.has(groupId);
    },
    [collapsedGroups]
  );

  const collapseAll = useCallback((groupIds: string[]) => {
    setCollapsedGroups(new Set(groupIds));
  }, []);

  const expandAll = useCallback(() => {
    setCollapsedGroups(new Set());
  }, []);

  return {
    collapsedGroups,
    toggleGroup,
    isCollapsed,
    collapseAll,
    expandAll,
  };
}

/**
 * Helper function to group items by a key
 */
export function groupItemsByKey<T>(
  items: T[],
  getGroupId: (item: T) => string,
  groups: ListGroup[]
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();

  // Initialize all groups with empty arrays
  groups.forEach((group) => {
    grouped.set(group.id, []);
  });

  // Distribute items into groups
  items.forEach((item) => {
    const groupId = getGroupId(item);
    const groupItems = grouped.get(groupId);
    if (groupItems) {
      groupItems.push(item);
    }
  });

  return grouped;
}

/**
 * Hook to group items and manage collapse state together
 */
export function useGroupedListWithItems<T extends { id: string }>(
  items: T[],
  groups: ListGroup[],
  getGroupId: (item: T) => string,
  options: UseGroupedListOptions<T> = {}
) {
  const collapseState = useGroupedList<T>(options);

  const groupedItems = useMemo(
    () => groupItemsByKey(items, getGroupId, groups),
    [items, groups, getGroupId]
  );

  const groupsWithCounts = useMemo(
    () =>
      groups.map((group) => ({
        ...group,
        count: groupedItems.get(group.id)?.length ?? 0,
      })),
    [groups, groupedItems]
  );

  return {
    ...collapseState,
    groupedItems,
    groupsWithCounts,
  };
}

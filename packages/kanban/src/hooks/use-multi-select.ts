import { useState, useCallback, useMemo } from "react";

export interface MultiSelectState {
  selectedIds: Set<string>;
  isSelecting: boolean;
}

export function useMultiSelect<T extends { id: string }>(items: T[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(items.map((item) => item.id)));
  }, [items]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isSelected = useCallback(
    (id: string) => {
      return selectedIds.has(id);
    },
    [selectedIds]
  );

  const selectedItems = useMemo(() => {
    return items.filter((item) => selectedIds.has(item.id));
  }, [items, selectedIds]);

  // Select all items in a specific subset (e.g., column)
  const selectSubset = useCallback((subsetIds: string[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      subsetIds.forEach((id) => next.add(id));
      return next;
    });
  }, []);

  // Deselect all items in a specific subset
  const deselectSubset = useCallback((subsetIds: string[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      subsetIds.forEach((id) => next.delete(id));
      return next;
    });
  }, []);

  // Toggle selection of all items in a subset
  const toggleSubset = useCallback((subsetIds: string[]) => {
    setSelectedIds((prev) => {
      const allSelected = subsetIds.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allSelected) {
        // Deselect all in subset
        subsetIds.forEach((id) => next.delete(id));
      } else {
        // Select all in subset
        subsetIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }, []);

  // Check if all items in a subset are selected
  const isSubsetAllSelected = useCallback(
    (subsetIds: string[]): boolean => {
      if (subsetIds.length === 0) return false;
      return subsetIds.every((id) => selectedIds.has(id));
    },
    [selectedIds]
  );

  // Check if some (but not all) items in a subset are selected
  const isSubsetSomeSelected = useCallback(
    (subsetIds: string[]): boolean => {
      if (subsetIds.length === 0) return false;
      const someSelected = subsetIds.some((id) => selectedIds.has(id));
      const allSelected = subsetIds.every((id) => selectedIds.has(id));
      return someSelected && !allSelected;
    },
    [selectedIds]
  );

  return {
    selectedIds,
    selectedCount: selectedIds.size,
    isSelecting: selectedIds.size > 0,
    toggleSelect,
    selectAll,
    clearSelection,
    isSelected,
    selectedItems,
    // Column-level selection
    selectSubset,
    deselectSubset,
    toggleSubset,
    isSubsetAllSelected,
    isSubsetSomeSelected,
  };
}

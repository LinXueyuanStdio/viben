import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
  useSelectionPersistence,
  type SelectionPersistenceOptions,
} from "./use-selection-persistence";

export interface MultiSelectState {
  selectedIds: Set<string>;
  isSelecting: boolean;
}

export interface UseMultiSelectOptions {
  /** Enable persistence across page refreshes and project switches */
  persistence?: SelectionPersistenceOptions;
}

export function useMultiSelect<T extends { id: string }>(
  items: T[],
  options?: UseMultiSelectOptions
) {
  const { persistence } = options ?? {};
  const isInitializedRef = useRef(false);

  // Persistence hook (always called, but disabled when no persistence options)
  const {
    loadPersistedSelection,
    saveSelectionDebounced,
    clearPersistedSelection,
    cleanupStaleIds,
  } = useSelectionPersistence({
    projectId: persistence?.projectId ?? "",
    storageKey: persistence?.storageKey,
    debounceMs: persistence?.debounceMs,
    enabled: !!persistence?.enabled && !!persistence?.projectId,
  });

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    // Load persisted selection on initial mount
    if (persistence?.enabled && persistence?.projectId) {
      return loadPersistedSelection();
    }
    return new Set();
  });

  // Reload persisted selection when projectId changes
  useEffect(() => {
    if (persistence?.enabled && persistence?.projectId) {
      const persisted = loadPersistedSelection();
      setSelectedIds(persisted);
      isInitializedRef.current = true;
    }
  }, [persistence?.enabled, persistence?.projectId, loadPersistedSelection]);

  // Clean up stale IDs when items change
  useEffect(() => {
    if (!isInitializedRef.current) return;
    if (selectedIds.size === 0) return;

    const validIds = new Set(items.map((item) => item.id));
    const hasStaleIds = Array.from(selectedIds).some((id) => !validIds.has(id));

    if (hasStaleIds) {
      const cleanedIds = cleanupStaleIds(validIds, selectedIds);
      if (cleanedIds.size !== selectedIds.size) {
        setSelectedIds(cleanedIds);
      }
    }
  }, [items, selectedIds, cleanupStaleIds]);

  // Persist selection changes (debounced)
  useEffect(() => {
    if (!isInitializedRef.current) return;
    if (persistence?.enabled && persistence?.projectId) {
      saveSelectionDebounced(selectedIds);
    }
  }, [selectedIds, persistence?.enabled, persistence?.projectId, saveSelectionDebounced]);

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
    if (persistence?.enabled && persistence?.projectId) {
      clearPersistedSelection();
    }
  }, [persistence?.enabled, persistence?.projectId, clearPersistedSelection]);

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

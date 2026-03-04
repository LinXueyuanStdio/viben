import { useCallback, useEffect, useRef } from "react";

export interface SelectionPersistenceOptions {
  /** Project/workspace ID for scoped storage */
  projectId: string;
  /** Custom storage key prefix (default: "viben-kanban-selection") */
  storageKey?: string;
  /** Debounce delay in ms for saving (default: 300) */
  debounceMs?: number;
  /** Whether persistence is enabled (default: true) */
  enabled?: boolean;
}

interface StoredSelection {
  selectedIds: string[];
  timestamp: number;
}

const DEFAULT_STORAGE_KEY = "viben-kanban-selection";
const DEFAULT_DEBOUNCE_MS = 300;
const MAX_SELECTION_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getStorageKey(projectId: string, customKey?: string): string {
  const baseKey = customKey || DEFAULT_STORAGE_KEY;
  return `${baseKey}:${projectId}`;
}

function loadSelection(storageKey: string): Set<string> {
  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) {
      return new Set();
    }
    const parsed: StoredSelection = JSON.parse(stored);

    // Check if selection is too old
    if (Date.now() - parsed.timestamp > MAX_SELECTION_AGE_MS) {
      localStorage.removeItem(storageKey);
      return new Set();
    }

    return new Set(parsed.selectedIds);
  } catch {
    return new Set();
  }
}

function saveSelection(storageKey: string, selectedIds: Set<string>): void {
  try {
    if (selectedIds.size === 0) {
      localStorage.removeItem(storageKey);
      return;
    }
    const data: StoredSelection = {
      selectedIds: Array.from(selectedIds),
      timestamp: Date.now(),
    };
    localStorage.setItem(storageKey, JSON.stringify(data));
  } catch {
    // Silently fail if localStorage is not available
  }
}

export interface UseSelectionPersistenceReturn {
  /** Load persisted selection for current project */
  loadPersistedSelection: () => Set<string>;
  /** Save selection state (debounced) */
  saveSelectionDebounced: (selectedIds: Set<string>) => void;
  /** Save selection state immediately */
  saveSelectionImmediate: (selectedIds: Set<string>) => void;
  /** Clear persisted selection */
  clearPersistedSelection: () => void;
  /** Clean up stale IDs that no longer exist */
  cleanupStaleIds: (validIds: Set<string>, selectedIds: Set<string>) => Set<string>;
}

export function useSelectionPersistence(
  options: SelectionPersistenceOptions
): UseSelectionPersistenceReturn {
  const {
    projectId,
    storageKey: customStorageKey,
    debounceMs = DEFAULT_DEBOUNCE_MS,
    enabled = true,
  } = options;

  const storageKey = getStorageKey(projectId, customStorageKey);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const loadPersistedSelection = useCallback((): Set<string> => {
    if (!enabled) return new Set();
    return loadSelection(storageKey);
  }, [enabled, storageKey]);

  const saveSelectionImmediate = useCallback(
    (selectedIds: Set<string>) => {
      if (!enabled) return;
      saveSelection(storageKey, selectedIds);
    },
    [enabled, storageKey]
  );

  const saveSelectionDebounced = useCallback(
    (selectedIds: Set<string>) => {
      if (!enabled) return;

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        saveSelection(storageKey, selectedIds);
        debounceTimerRef.current = null;
      }, debounceMs);
    },
    [enabled, storageKey, debounceMs]
  );

  const clearPersistedSelection = useCallback(() => {
    if (!enabled) return;
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // Silently fail
    }
  }, [enabled, storageKey]);

  const cleanupStaleIds = useCallback(
    (validIds: Set<string>, selectedIds: Set<string>): Set<string> => {
      const cleanedIds = new Set<string>();
      selectedIds.forEach((id) => {
        if (validIds.has(id)) {
          cleanedIds.add(id);
        }
      });

      // If we removed any stale IDs, persist the cleaned set
      if (cleanedIds.size !== selectedIds.size && enabled) {
        saveSelection(storageKey, cleanedIds);
      }

      return cleanedIds;
    },
    [enabled, storageKey]
  );

  return {
    loadPersistedSelection,
    saveSelectionDebounced,
    saveSelectionImmediate,
    clearPersistedSelection,
    cleanupStaleIds,
  };
}

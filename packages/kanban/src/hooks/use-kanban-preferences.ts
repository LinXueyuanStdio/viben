import { useState, useEffect, useCallback } from "react";
import type { SortMode, SortDirection } from "../components/sort-types";
import type { ViewMode } from "../components/view-types";
import type { KanbanFilter } from "../components/kanban-filter-types";

export interface SavedFilter {
  id: string;
  name: string;
  filter: KanbanFilter;
}

export interface KanbanPreferences {
  // View preferences
  viewMode: ViewMode;
  sortMode: SortMode;
  sortDirection: SortDirection;

  // Column state
  collapsedColumns: string[];
  columnOrder: string[];
  hiddenColumns: string[];

  // Panel state
  detailPanelWidth: number;
  showStats: boolean;

  // Filters
  savedFilters: SavedFilter[];
}

const DEFAULT_PREFERENCES: KanbanPreferences = {
  viewMode: "kanban",
  sortMode: "manual",
  sortDirection: "asc",
  collapsedColumns: [],
  columnOrder: [],
  hiddenColumns: [],
  detailPanelWidth: 30,
  showStats: false,
  savedFilters: [],
};

export interface UseKanbanPreferencesOptions {
  projectId: string;
  storageKey?: string;
}

export interface UseKanbanPreferencesReturn {
  preferences: KanbanPreferences;
  updatePreference: <K extends keyof KanbanPreferences>(
    key: K,
    value: KanbanPreferences[K]
  ) => void;
  resetPreferences: () => void;
  saveFilter: (name: string, filter: KanbanFilter) => string;
  deleteFilter: (filterId: string) => void;
}

function getStorageKey(projectId: string, customKey?: string): string {
  const baseKey = customKey || "viben-kanban-preferences";
  return `${baseKey}:${projectId}`;
}

function loadPreferences(storageKey: string): KanbanPreferences {
  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) {
      return { ...DEFAULT_PREFERENCES };
    }
    const parsed = JSON.parse(stored) as Partial<KanbanPreferences>;
    // Merge with defaults to ensure all fields exist
    return {
      ...DEFAULT_PREFERENCES,
      ...parsed,
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

function savePreferences(storageKey: string, preferences: KanbanPreferences): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(preferences));
  } catch {
    // Silently fail if localStorage is not available
  }
}

function generateFilterId(): string {
  return `filter-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useKanbanPreferences(
  options: UseKanbanPreferencesOptions
): UseKanbanPreferencesReturn {
  const { projectId, storageKey: customStorageKey } = options;
  const storageKey = getStorageKey(projectId, customStorageKey);

  const [preferences, setPreferences] = useState<KanbanPreferences>(() =>
    loadPreferences(storageKey)
  );

  // Reload preferences when projectId changes
  useEffect(() => {
    const newStorageKey = getStorageKey(projectId, customStorageKey);
    setPreferences(loadPreferences(newStorageKey));
  }, [projectId, customStorageKey]);

  // Save to localStorage whenever preferences change
  useEffect(() => {
    savePreferences(storageKey, preferences);
  }, [storageKey, preferences]);

  const updatePreference = useCallback(
    <K extends keyof KanbanPreferences>(key: K, value: KanbanPreferences[K]) => {
      setPreferences((prev) => ({
        ...prev,
        [key]: value,
      }));
    },
    []
  );

  const resetPreferences = useCallback(() => {
    setPreferences({ ...DEFAULT_PREFERENCES });
  }, []);

  const saveFilter = useCallback((name: string, filter: KanbanFilter): string => {
    const id = generateFilterId();
    const newFilter: SavedFilter = { id, name, filter };
    setPreferences((prev) => ({
      ...prev,
      savedFilters: [...prev.savedFilters, newFilter],
    }));
    return id;
  }, []);

  const deleteFilter = useCallback((filterId: string) => {
    setPreferences((prev) => ({
      ...prev,
      savedFilters: prev.savedFilters.filter((f) => f.id !== filterId),
    }));
  }, []);

  return {
    preferences,
    updatePreference,
    resetPreferences,
    saveFilter,
    deleteFilter,
  };
}

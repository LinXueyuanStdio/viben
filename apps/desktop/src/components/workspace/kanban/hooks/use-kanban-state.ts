import { useState, useCallback, useMemo } from "react";
import {
  useKanbanPreferences,
  useCommandPalette,
  type KanbanFilter,
  type ViewMode,
  type SortMode,
  type SortDirection,
} from "@viben/kanban";

export interface UseKanbanStateOptions {
  projectId: string;
}

export interface DialogState {
  createTask: { open: boolean; columnId: string };
  settings: boolean;
  queueSettings: boolean;
  commandPalette: boolean;
}

export interface KanbanState {
  // Selection state
  selectedTaskId: string | null;
  setSelectedTaskId: (id: string | null) => void;
  autoStartTaskOnOpen: boolean;
  setAutoStartTaskOnOpen: (value: boolean) => void;

  // View and sorting (synced from preferences)
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  sortMode: SortMode;
  sortDirection: SortDirection;
  setSorting: (mode: SortMode, direction: SortDirection) => void;

  // Filter
  filter: KanbanFilter;
  setFilter: (filter: KanbanFilter) => void;
  clearFilter: () => void;

  // UI toggles
  showStats: boolean;
  setShowStats: (show: boolean | ((prev: boolean) => boolean)) => void;

  // Dialog state
  dialogs: DialogState;
  openCreateDialog: (columnId: string) => void;
  closeCreateDialog: () => void;
  setSettingsOpen: (open: boolean) => void;
  setQueueSettingsOpen: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
}

const EMPTY_FILTER: KanbanFilter = {};

export function useKanbanState(options: UseKanbanStateOptions): KanbanState {
  const { projectId } = options;

  // Use kanban preferences for persisted state
  const { preferences, updatePreference } = useKanbanPreferences({ projectId });

  // Command palette from @viben/kanban
  const {
    isOpen: isCommandPaletteOpen,
    setIsOpen: setCommandPaletteOpenInternal,
  } = useCommandPalette();

  // Local state - selection
  const [selectedTaskId, setSelectedTaskIdInternal] = useState<string | null>(null);
  const [autoStartTaskOnOpen, setAutoStartTaskOnOpenInternal] = useState(false);

  // Local state - filter
  const [filter, setFilterInternal] = useState<KanbanFilter>(EMPTY_FILTER);

  // Local state - dialogs
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createDialogColumnId, setCreateDialogColumnId] = useState<string>("backlog");
  const [settingsOpen, setSettingsOpenInternal] = useState(false);
  const [queueSettingsOpen, setQueueSettingsOpenInternal] = useState(false);

  // Derived state from preferences
  const viewMode = preferences.viewMode;
  // Convert "manual" to "createdAt" for sorting (manual sorting not fully implemented)
  const sortMode: SortMode = preferences.sortMode === "manual" ? "createdAt" : preferences.sortMode;
  const sortDirection = preferences.sortDirection;
  const showStats = preferences.showStats;

  // Setters that wrap state updates

  const setSelectedTaskId = useCallback((id: string | null) => {
    setSelectedTaskIdInternal(id);
  }, []);

  const setAutoStartTaskOnOpen = useCallback((value: boolean) => {
    setAutoStartTaskOnOpenInternal(value);
  }, []);

  const setViewMode = useCallback((mode: ViewMode) => {
    updatePreference("viewMode", mode);
  }, [updatePreference]);

  const setSorting = useCallback((mode: SortMode, direction: SortDirection) => {
    updatePreference("sortMode", mode);
    updatePreference("sortDirection", direction);
  }, [updatePreference]);

  const setFilter = useCallback((newFilter: KanbanFilter) => {
    setFilterInternal(newFilter);
  }, []);

  const clearFilter = useCallback(() => {
    setFilterInternal(EMPTY_FILTER);
  }, []);

  const setShowStats = useCallback((show: boolean | ((prev: boolean) => boolean)) => {
    if (typeof show === "function") {
      updatePreference("showStats", show(preferences.showStats));
    } else {
      updatePreference("showStats", show);
    }
  }, [updatePreference, preferences.showStats]);

  // Dialog control callbacks

  const openCreateDialog = useCallback((columnId: string) => {
    setCreateDialogColumnId(columnId);
    setCreateDialogOpen(true);
  }, []);

  const closeCreateDialog = useCallback(() => {
    setCreateDialogOpen(false);
  }, []);

  const setSettingsOpen = useCallback((open: boolean) => {
    setSettingsOpenInternal(open);
  }, []);

  const setQueueSettingsOpen = useCallback((open: boolean) => {
    setQueueSettingsOpenInternal(open);
  }, []);

  const setCommandPaletteOpen = useCallback((open: boolean) => {
    setCommandPaletteOpenInternal(open);
  }, [setCommandPaletteOpenInternal]);

  // Compose dialog state
  const dialogs = useMemo<DialogState>(() => ({
    createTask: { open: createDialogOpen, columnId: createDialogColumnId },
    settings: settingsOpen,
    queueSettings: queueSettingsOpen,
    commandPalette: isCommandPaletteOpen,
  }), [createDialogOpen, createDialogColumnId, settingsOpen, queueSettingsOpen, isCommandPaletteOpen]);

  return {
    // Selection state
    selectedTaskId,
    setSelectedTaskId,
    autoStartTaskOnOpen,
    setAutoStartTaskOnOpen,

    // View and sorting
    viewMode,
    setViewMode,
    sortMode,
    sortDirection,
    setSorting,

    // Filter
    filter,
    setFilter,
    clearFilter,

    // UI toggles
    showStats,
    setShowStats,

    // Dialog state
    dialogs,
    openCreateDialog,
    closeCreateDialog,
    setSettingsOpen,
    setQueueSettingsOpen,
    setCommandPaletteOpen,
  };
}

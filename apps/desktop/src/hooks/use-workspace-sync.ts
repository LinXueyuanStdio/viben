import { useState, useCallback } from "react";

// ============================================================================
// Types
// ============================================================================

/**
 * A cloud workspace representing a user's synced environment
 */
export interface CloudWorkspace {
  /** Unique workspace ID */
  id: string;
  /** Workspace display name */
  name: string;
  /** URL-friendly slug */
  slug: string;
  /** Optional description */
  description: string | null;
  /** Whether this is the user's personal workspace */
  isPersonal: boolean;
  /** ISO timestamp when the workspace was created */
  createdAt: string;
  /** ISO timestamp when the workspace was last updated */
  updatedAt: string;
}

/**
 * Configuration for a package in a workspace
 */
export interface WorkspacePackageConfig {
  /** Package ID from the cloud platform */
  packageId: string;
  /** Type of package: "mcp" or "skill" */
  packageType: string;
  /** Package-specific configuration */
  config: Record<string, unknown>;
  /** Whether the package is enabled */
  enabled: boolean;
}

/**
 * Detailed workspace information including packages
 */
export interface WorkspaceDetails {
  /** Workspace information */
  workspace: CloudWorkspace;
  /** Packages configured in this workspace */
  packages: WorkspacePackageConfig[];
}

/**
 * Result of a workspace sync operation
 */
export interface SyncResult {
  /** Workspace ID that was synced */
  workspaceId: string;
  /** Number of packages that were synced (metadata updated) */
  packagesSynced: number;
  /** Number of packages that were newly installed */
  packagesInstalled: number;
  /** Number of packages that were removed */
  packagesRemoved: number;
  /** Whether the sync operation succeeded */
  success: boolean;
  /** Error message if the sync failed */
  error: string | null;
}

/**
 * Current sync status
 */
export interface SyncStatus {
  /** Whether a sync is currently in progress */
  isSyncing: boolean;
  /** Currently active workspace ID (if any) */
  activeWorkspaceId: string | null;
  /** Timestamp of last successful sync */
  lastSyncAt: string | null;
  /** Error from last sync attempt (if any) */
  lastSyncError: string | null;
}

/**
 * Sync settings stored in app preferences
 */
export interface SyncSettings {
  /** Whether auto-sync is enabled */
  autoSyncEnabled: boolean;
  /** Auto-sync interval in minutes */
  autoSyncIntervalMinutes: number;
  /** Conflict resolution strategy: 'local' or 'cloud' */
  conflictResolution: "local" | "cloud";
}

/**
 * Options for useWorkspaceSync hook
 */
export interface UseWorkspaceSyncOptions {
  /** Whether to fetch workspaces on mount (default: true) */
  fetchOnMount?: boolean;
  /** Whether to fetch sync status on mount (default: true) */
  fetchStatusOnMount?: boolean;
}

/**
 * Return type for useWorkspaceSync hook
 */
export interface UseWorkspaceSyncReturn {
  /** List of available workspaces */
  workspaces: CloudWorkspace[];
  /** Currently selected workspace */
  selectedWorkspace: CloudWorkspace | null;
  /** Details of the selected workspace including packages */
  workspaceDetails: WorkspaceDetails | null;
  /** Current sync status */
  syncStatus: SyncStatus | null;
  /** Sync settings */
  settings: SyncSettings;
  /** Whether workspaces are being fetched */
  loading: boolean;
  /** Whether a sync is in progress */
  syncing: boolean;
  /** Progress info during sync (packages synced, installed, removed) */
  syncProgress: { synced: number; installed: number; removed: number } | null;
  /** Error message if any operation failed */
  error: string | null;
  /** Fetch workspaces from cloud */
  fetchWorkspaces: () => Promise<void>;
  /** Select a workspace */
  selectWorkspace: (workspaceId: string) => Promise<void>;
  /** Sync the selected workspace (pull from cloud) */
  syncWorkspace: (pythonPath?: string) => Promise<SyncResult | null>;
  /** Push local config to the selected workspace */
  pushLocalConfig: () => Promise<SyncResult | null>;
  /** Fetch sync status */
  fetchSyncStatus: () => Promise<void>;
  /** Update sync settings */
  updateSettings: (settings: Partial<SyncSettings>) => void;
  /** Format last sync time for display */
  formatLastSyncTime: (timestamp: string | null) => string;
}

// ============================================================================
// Default Settings
// ============================================================================

const DEFAULT_SETTINGS: SyncSettings = {
  autoSyncEnabled: false,
  autoSyncIntervalMinutes: 30,
  conflictResolution: "cloud",
};

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for managing workspace synchronization
 *
 * NOTE: Cloud workspace sync feature has been removed.
 * This hook now returns disabled/empty state for backwards compatibility.
 */
export function useWorkspaceSync(
  _options: UseWorkspaceSyncOptions = {}
): UseWorkspaceSyncReturn {
  const [settings, setSettings] = useState<SyncSettings>(DEFAULT_SETTINGS);
  const [error] = useState<string | null>("Workspace sync is not available");

  const fetchWorkspaces = useCallback(async () => {
    // No-op: workspace sync removed
  }, []);

  const selectWorkspace = useCallback(async (_workspaceId: string) => {
    // No-op: workspace sync removed
  }, []);

  const syncWorkspace = useCallback(
    async (_pythonPath?: string): Promise<SyncResult | null> => {
      return null;
    },
    []
  );

  const pushLocalConfig = useCallback(async (): Promise<SyncResult | null> => {
    return null;
  }, []);

  const fetchSyncStatus = useCallback(async () => {
    // No-op: workspace sync removed
  }, []);

  const updateSettings = useCallback((newSettings: Partial<SyncSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  }, []);

  const formatLastSyncTime = useCallback((timestamp: string | null): string => {
    if (!timestamp) return "Never";
    return new Date(timestamp).toLocaleDateString();
  }, []);

  return {
    workspaces: [],
    selectedWorkspace: null,
    workspaceDetails: null,
    syncStatus: null,
    settings,
    loading: false,
    syncing: false,
    syncProgress: null,
    error,
    fetchWorkspaces,
    selectWorkspace,
    syncWorkspace,
    pushLocalConfig,
    fetchSyncStatus,
    updateSettings,
    formatLastSyncTime,
  };
}

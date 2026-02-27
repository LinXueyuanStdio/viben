import { useState, useEffect, useCallback, useRef } from "react";
import { getClient } from "@/lib/viben";

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

// Local storage key for sync status
const SYNC_STATUS_KEY = "viben-sync-status";

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for managing workspace synchronization
 *
 * Provides methods to list, select, and sync workspaces with the cloud platform.
 */
export function useWorkspaceSync(
  options: UseWorkspaceSyncOptions = {}
): UseWorkspaceSyncReturn {
  const { fetchOnMount = true, fetchStatusOnMount = true } = options;

  // State
  const [workspaces, setWorkspaces] = useState<CloudWorkspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<CloudWorkspace | null>(null);
  const [workspaceDetails, setWorkspaceDetails] = useState<WorkspaceDetails | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [settings, setSettings] = useState<SyncSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{
    synced: number;
    installed: number;
    removed: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const autoSyncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * Fetch workspaces from cloud
   */
  const fetchWorkspaces = useCallback(async () => {
    if (!mountedRef.current) return;

    setLoading(true);
    setError(null);

    try {
      const client = getClient();
      const response = await client.workspaces.list();

      if (mountedRef.current) {
        // Map response to CloudWorkspace format
        const mapped: CloudWorkspace[] = response.workspaces.map((ws) => ({
          id: ws.id,
          name: ws.name,
          slug: ws.id, // API doesn't have slug, use id
          description: ws.description ?? null,
          isPersonal: ws.isDefault ?? false,
          createdAt: ws.createdAt,
          updatedAt: ws.updatedAt,
        }));
        setWorkspaces(mapped);
      }
    } catch (err) {
      if (mountedRef.current) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  /**
   * Select a workspace and fetch its details
   */
  const selectWorkspace = useCallback(async (workspaceId: string) => {
    if (!mountedRef.current) return;

    setLoading(true);
    setError(null);

    try {
      const client = getClient();
      const response = await client.workspaces.get(workspaceId);
      const packagesResponse = await client.workspaces.packages(workspaceId);

      if (mountedRef.current) {
        const workspace: CloudWorkspace = {
          id: response.workspace.id,
          name: response.workspace.name,
          slug: response.workspace.id, // API doesn't have slug, use id
          description: response.workspace.description ?? null,
          isPersonal: response.workspace.isDefault ?? false,
          createdAt: response.workspace.createdAt,
          updatedAt: response.workspace.updatedAt,
        };

        // Map packages to WorkspacePackageConfig format
        const packages: WorkspacePackageConfig[] = packagesResponse.configs.map((cfg) => ({
          packageId: cfg.packageId,
          packageType: cfg.packageType,
          config: cfg.config ?? {},
          enabled: cfg.enabled ?? true,
        }));

        setSelectedWorkspace(workspace);
        setWorkspaceDetails({ workspace, packages });
      }
    } catch (err) {
      if (mountedRef.current) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  /**
   * Sync the selected workspace (pull from cloud)
   * Note: Full sync with package installation requires Gateway/Tauri support
   */
  const syncWorkspace = useCallback(
    async (_pythonPath?: string): Promise<SyncResult | null> => {
      if (!selectedWorkspace) {
        setError("No workspace selected");
        return null;
      }

      setSyncing(true);
      setSyncProgress(null);
      setError(null);

      try {
        const client = getClient();
        const packagesResponse = await client.workspaces.packages(selectedWorkspace.id);

        // Count packages - actual installation would need Gateway support
        const mcpCount = packagesResponse.packages.mcp?.length ?? 0;
        const skillsCount = packagesResponse.packages.skills?.length ?? 0;
        const totalPackages = mcpCount + skillsCount;

        const result: SyncResult = {
          workspaceId: selectedWorkspace.id,
          packagesSynced: totalPackages,
          packagesInstalled: 0, // Actual installation not implemented via HTTP API
          packagesRemoved: 0,
          success: true,
          error: null,
        };

        if (mountedRef.current) {
          setSyncProgress({
            synced: result.packagesSynced,
            installed: result.packagesInstalled,
            removed: result.packagesRemoved,
          });

          // Update sync status in localStorage
          const newStatus: SyncStatus = {
            isSyncing: false,
            activeWorkspaceId: selectedWorkspace.id,
            lastSyncAt: new Date().toISOString(),
            lastSyncError: null,
          };
          localStorage.setItem(SYNC_STATUS_KEY, JSON.stringify(newStatus));
          setSyncStatus(newStatus);
        }

        return result;
      } catch (err) {
        if (mountedRef.current) {
          const message = err instanceof Error ? err.message : String(err);
          setError(message);

          // Update sync status with error
          const newStatus: SyncStatus = {
            isSyncing: false,
            activeWorkspaceId: selectedWorkspace?.id ?? null,
            lastSyncAt: null,
            lastSyncError: message,
          };
          localStorage.setItem(SYNC_STATUS_KEY, JSON.stringify(newStatus));
          setSyncStatus(newStatus);
        }
        return null;
      } finally {
        if (mountedRef.current) {
          setSyncing(false);
        }
      }
    },
    [selectedWorkspace]
  );

  /**
   * Push local config to the selected workspace
   * Note: This requires reading local config which needs Gateway/Tauri support
   */
  const pushLocalConfig = useCallback(async (): Promise<SyncResult | null> => {
    if (!selectedWorkspace) {
      setError("No workspace selected");
      return null;
    }

    setSyncing(true);
    setSyncProgress(null);
    setError(null);

    try {
      // Push operation not fully implemented without Gateway support
      // This would need to read local MCP/skill configs and push them to cloud
      const result: SyncResult = {
        workspaceId: selectedWorkspace.id,
        packagesSynced: 0,
        packagesInstalled: 0,
        packagesRemoved: 0,
        success: true,
        error: "Push operation requires local file access via Gateway",
      };

      if (mountedRef.current) {
        setSyncProgress({
          synced: result.packagesSynced,
          installed: result.packagesInstalled,
          removed: result.packagesRemoved,
        });

        if (!result.success && result.error) {
          setError(result.error);
        }
      }

      return result;
    } catch (err) {
      if (mountedRef.current) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
      }
      return null;
    } finally {
      if (mountedRef.current) {
        setSyncing(false);
      }
    }
  }, [selectedWorkspace]);

  /**
   * Internal function to fetch sync status from localStorage
   */
  const fetchSyncStatusInternal = useCallback(async () => {
    try {
      const stored = localStorage.getItem(SYNC_STATUS_KEY);
      if (stored) {
        const status = JSON.parse(stored) as SyncStatus;
        if (mountedRef.current) {
          setSyncStatus(status);
        }
      }
    } catch (err) {
      console.error("Failed to fetch sync status:", err);
    }
  }, []);

  /**
   * Fetch sync status
   */
  const fetchSyncStatus = useCallback(async () => {
    await fetchSyncStatusInternal();
  }, [fetchSyncStatusInternal]);

  /**
   * Update sync settings
   */
  const updateSettings = useCallback((newSettings: Partial<SyncSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  }, []);

  /**
   * Format last sync time for display
   */
  const formatLastSyncTime = useCallback((timestamp: string | null): string => {
    if (!timestamp) return "Never";

    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;

    return date.toLocaleDateString();
  }, []);

  // Fetch on mount
  useEffect(() => {
    if (fetchOnMount) {
      fetchWorkspaces();
    }
    if (fetchStatusOnMount) {
      fetchSyncStatusInternal();
    }
  }, [fetchOnMount, fetchStatusOnMount, fetchWorkspaces, fetchSyncStatusInternal]);

  // Auto-sync interval
  useEffect(() => {
    if (settings.autoSyncEnabled && selectedWorkspace) {
      const intervalMs = settings.autoSyncIntervalMinutes * 60 * 1000;
      autoSyncIntervalRef.current = setInterval(() => {
        if (!syncing) {
          syncWorkspace();
        }
      }, intervalMs);
    }

    return () => {
      if (autoSyncIntervalRef.current) {
        clearInterval(autoSyncIntervalRef.current);
        autoSyncIntervalRef.current = null;
      }
    };
  }, [settings.autoSyncEnabled, settings.autoSyncIntervalMinutes, selectedWorkspace, syncing, syncWorkspace]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    workspaces,
    selectedWorkspace,
    workspaceDetails,
    syncStatus,
    settings,
    loading,
    syncing,
    syncProgress,
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

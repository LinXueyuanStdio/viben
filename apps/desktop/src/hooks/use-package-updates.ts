import { useState, useEffect, useCallback, useRef } from "react";
import { getClient } from "@/lib/viben";
import { getGatewayClient } from "@/lib/gateway";
import i18n from "@/i18n";

// ============================================================================
// Types
// ============================================================================

/**
 * Information about a package update
 */
export interface PackageUpdate {
  /** Package ID */
  package_id: string;
  /** Type of package: 'mcp' or 'skill' */
  package_type: "mcp" | "skill";
  /** Package display name */
  name: string;
  /** Currently installed version */
  current_version: string;
  /** Latest available version */
  latest_version: string;
  /** Release notes for the latest version */
  release_notes?: string;
}

/**
 * Information about an installed package
 */
interface InstalledPackage {
  id: string;
  name: string;
  version: string;
  package_type: string;
  install_path: string;
  installed_at: string;
  slug?: string;
}

/**
 * Installed packages info
 */
interface InstalledPackagesInfo {
  mcp: InstalledPackage[];
  skills: InstalledPackage[];
}

/**
 * Options for usePackageUpdates hook
 */
export interface UsePackageUpdatesOptions {
  /** Interval in milliseconds for background checks (default: 0 = no background check) */
  checkInterval?: number;
  /** Whether to check immediately on mount (default: false) */
  checkOnMount?: boolean;
}

/**
 * Return type for usePackageUpdates hook
 */
export interface UsePackageUpdatesReturn {
  /** List of available updates */
  updates: PackageUpdate[];
  /** Whether update check is in progress */
  checking: boolean;
  /** Timestamp of last check */
  lastChecked: Date | null;
  /** Error message if check failed */
  error: string | null;
  /** Number of available updates */
  updateCount: number;
  /** Check for updates manually */
  checkForUpdates: () => Promise<void>;
  /** Update a specific package */
  updatePackage: (id: string, type: "mcp" | "skill") => Promise<boolean>;
  /** Update all packages */
  updateAll: () => Promise<boolean>;
  /** Whether any update is being installed */
  updating: boolean;
  /** ID of package currently being updated */
  updatingPackageId: string | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Compare two semantic versions
 * Returns: -1 if v1 < v2, 0 if v1 == v2, 1 if v1 > v2
 */
function compareVersions(v1: string, v2: string): number {
  const normalize = (v: string): number[] => {
    return v
      .replace(/^v/, "")
      .split(".")
      .map((n) => parseInt(n, 10) || 0);
  };

  const parts1 = normalize(v1);
  const parts2 = normalize(v2);
  const maxLen = Math.max(parts1.length, parts2.length);

  for (let i = 0; i < maxLen; i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 < p2) return -1;
    if (p1 > p2) return 1;
  }
  return 0;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for checking and managing package updates
 *
 * This hook compares installed packages with cloud packages
 * to detect available updates and provides methods to update packages.
 */
export function usePackageUpdates(
  options: UsePackageUpdatesOptions = {}
): UsePackageUpdatesReturn {
  const { checkInterval = 0, checkOnMount = false } = options;

  const [updates, setUpdates] = useState<PackageUpdate[]>([]);
  const [checking, setChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [updatingPackageId, setUpdatingPackageId] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  /**
   * Check for updates by comparing installed packages with cloud versions
   */
  const checkForUpdates = useCallback(async () => {
    if (!mountedRef.current) return;

    setChecking(true);
    setError(null);

    try {
      // Get installed packages from Gateway
      const gateway = getGatewayClient();
      const installed = await gateway.get<InstalledPackagesInfo>("/api/packages/installed");

      const client = getClient();
      const newUpdates: PackageUpdate[] = [];

      // Check MCP packages
      for (const pkg of installed.mcp) {
        try {
          const response = await client.mcp.get(pkg.id);
          const cloudPkg = response.package;

          if (compareVersions(pkg.version, cloudPkg.version) < 0) {
            newUpdates.push({
              package_id: pkg.id,
              package_type: "mcp",
              name: pkg.name,
              current_version: pkg.version,
              latest_version: cloudPkg.version,
              release_notes: cloudPkg.description || undefined,
            });
          }
        } catch {
          // Skip if we can't fetch cloud package info
          console.warn(`Could not check updates for MCP package: ${pkg.id}`);
        }
      }

      // Check skill packages
      for (const pkg of installed.skills) {
        try {
          const response = await gateway.get<{
            package: { version: string; description?: string | null };
          }>(`/api/skill/info/${encodeURIComponent(pkg.id)}?format=platform`);
          const cloudPkg = response.package;

          if (compareVersions(pkg.version, cloudPkg.version) < 0) {
            newUpdates.push({
              package_id: pkg.id,
              package_type: "skill",
              name: pkg.name,
              current_version: pkg.version,
              latest_version: cloudPkg.version,
              release_notes: cloudPkg.description || undefined,
            });
          }
        } catch {
          // Skip if we can't fetch cloud package info
          console.warn(`Could not check updates for skill package: ${pkg.id}`);
        }
      }

      if (mountedRef.current) {
        setUpdates(newUpdates);
        setLastChecked(new Date());
      }
    } catch (err) {
      if (mountedRef.current) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
      }
    } finally {
      if (mountedRef.current) {
        setChecking(false);
      }
    }
  }, []);

  /**
   * Update a specific package
   * Note: Actual package installation requires Gateway support
   */
  const updatePackage = useCallback(
    async (id: string, type: "mcp" | "skill"): Promise<boolean> => {
      setUpdating(true);
      setUpdatingPackageId(id);
      setError(null);

      try {
        // Use Gateway to trigger package update
        const gateway = getGatewayClient();
        const result = await gateway.post<{
          success: boolean;
          error?: string;
        }>("/api/packages/update", {
          package_id: id,
          package_type: type,
        });

        if (!result.success) {
          throw new Error(result.error || i18n.t("errors.packages.updateFailed", "Update failed"));
        }

        // Remove the updated package from the updates list
        setUpdates((prev) => prev.filter((u) => u.package_id !== id));

        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        return false;
      } finally {
        setUpdating(false);
        setUpdatingPackageId(null);
      }
    },
    []
  );

  /**
   * Update all packages
   */
  const updateAll = useCallback(async (): Promise<boolean> => {
    if (updates.length === 0) return true;

    setUpdating(true);
    setError(null);

    let allSucceeded = true;
    const remainingUpdates: PackageUpdate[] = [];

    for (const update of updates) {
      setUpdatingPackageId(update.package_id);

      try {
        const gateway = getGatewayClient();
        const result = await gateway.post<{
          success: boolean;
          error?: string;
        }>("/api/packages/update", {
          package_id: update.package_id,
          package_type: update.package_type,
        });

        if (!result.success) {
          allSucceeded = false;
          remainingUpdates.push(update);
        }
      } catch {
        allSucceeded = false;
        remainingUpdates.push(update);
      }
    }

    setUpdates(remainingUpdates);
    setUpdating(false);
    setUpdatingPackageId(null);

    if (!allSucceeded) {
      setError(i18n.t("errors.packages.someUpdatesFailed", "Some packages failed to update"));
    }

    return allSucceeded;
  }, [updates]);

  // Check on mount if enabled
  useEffect(() => {
    if (checkOnMount) {
      checkForUpdates();
    }
  }, [checkOnMount, checkForUpdates]);

  // Set up background check interval
  useEffect(() => {
    if (checkInterval > 0) {
      intervalRef.current = setInterval(checkForUpdates, checkInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [checkInterval, checkForUpdates]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    updates,
    checking,
    lastChecked,
    error,
    updateCount: updates.length,
    checkForUpdates,
    updatePackage,
    updateAll,
    updating,
    updatingPackageId,
  };
}

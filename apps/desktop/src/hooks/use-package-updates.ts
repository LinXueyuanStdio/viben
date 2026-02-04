import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

// ============================================================================
// Types
// ============================================================================

/**
 * Information about a package update
 */
export interface PackageUpdate {
  /** Package ID */
  packageId: string;
  /** Type of package: 'mcp' or 'skill' */
  packageType: "mcp" | "skill";
  /** Package display name */
  name: string;
  /** Currently installed version */
  currentVersion: string;
  /** Latest available version */
  latestVersion: string;
  /** Release notes for the latest version */
  releaseNotes?: string;
}

/**
 * Information about an installed package (from TD9)
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
 * Installed packages info (from TD9)
 */
interface InstalledPackagesInfo {
  mcp: InstalledPackage[];
  skills: InstalledPackage[];
}

/**
 * Cloud MCP package info (from TD3)
 */
interface CloudMcpPackage {
  id: string;
  name: string;
  slug: string;
  version: string;
  description: string | null;
}

/**
 * Cloud skill package info (from TD4)
 */
interface CloudSkillPackage {
  id: string;
  name: string;
  slug: string;
  version: string;
  description: string | null;
}

/**
 * Install result from package_install commands
 */
interface InstallResult {
  package_id: string;
  package_type: string;
  install_path: string;
  version: string;
  success: boolean;
  error: string | null;
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
 * This hook compares installed packages (from TD9) with cloud packages (from TD3/TD4)
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
      // Get installed packages
      const installed = await invoke<InstalledPackagesInfo>("get_installed_packages");

      const newUpdates: PackageUpdate[] = [];

      // Check MCP packages
      for (const pkg of installed.mcp) {
        try {
          const cloudPkg = await invoke<CloudMcpPackage>("get_cloud_mcp_package", {
            id: pkg.id,
          });

          if (compareVersions(pkg.version, cloudPkg.version) < 0) {
            newUpdates.push({
              packageId: pkg.id,
              packageType: "mcp",
              name: pkg.name,
              currentVersion: pkg.version,
              latestVersion: cloudPkg.version,
              releaseNotes: cloudPkg.description || undefined,
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
          const cloudPkg = await invoke<CloudSkillPackage>("get_cloud_skill_package", {
            id: pkg.id,
          });

          if (compareVersions(pkg.version, cloudPkg.version) < 0) {
            newUpdates.push({
              packageId: pkg.id,
              packageType: "skill",
              name: pkg.name,
              currentVersion: pkg.version,
              latestVersion: cloudPkg.version,
              releaseNotes: cloudPkg.description || undefined,
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
   */
  const updatePackage = useCallback(
    async (id: string, type: "mcp" | "skill"): Promise<boolean> => {
      setUpdating(true);
      setUpdatingPackageId(id);
      setError(null);

      try {
        const result = await invoke<InstallResult>("update_package", {
          packageId: id,
          packageType: type,
          pythonPath: null, // Use default from registry
        });

        if (!result.success) {
          throw new Error(result.error || "Update failed");
        }

        // Remove the updated package from the updates list
        setUpdates((prev) => prev.filter((u) => u.packageId !== id));

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
      setUpdatingPackageId(update.packageId);

      try {
        const result = await invoke<InstallResult>("update_package", {
          packageId: update.packageId,
          packageType: update.packageType,
          pythonPath: null,
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
      setError("Some packages failed to update");
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

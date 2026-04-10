import { useState, useEffect, useCallback, useMemo } from "react";
import type { CliToolInfo, CliToolPath } from "@/lib/gateway";
import { getGatewayClient } from "@/lib/gateway";
import { useAppStore } from "@/stores";
import { invoke } from "@tauri-apps/api/core";

/** Cache TTL: 24 hours */
const CACHE_TTL = 24 * 60 * 60 * 1000;

/** Special source type for bundled sidecar */
const BUNDLED_SOURCE = "bundled" as const;

/** Extended source types including bundled sidecar */
export type VibenCliSource = CliToolPath["source"] | typeof BUNDLED_SOURCE;

/** Extended CliToolPath with bundled sidecar support */
export interface VibenCliPath {
  path: string;
  version?: string;
  source: VibenCliSource;
}

/** Return type for useVibenCli hook */
export interface UseVibenCliReturn {
  /** Viben CLI tool info from detection */
  vibenInfo: CliToolInfo | null;
  /** All available viben paths (bundled first, then alternatives) */
  alternatives: VibenCliPath[];
  /** Currently selected path (user selection > bundled > auto-detected) */
  selectedPath: string;
  /** Loading state during detection */
  isLoading: boolean;
  /** Error message if detection failed */
  error: string | null;
  /** Select a specific viben path */
  selectPath: (path: string) => Promise<void>;
  /** Validate a viben path */
  validatePath: (path: string) => Promise<boolean>;
  /** Bundled sidecar path from Tauri (if available) */
  bundledPath: string | null;
  /** Trigger detection refresh */
  detectViben: (forceRefresh?: boolean) => Promise<void>;
  /** Check if cache is still valid */
  isCacheValid: () => boolean;
}

/**
 * Get the bundled viben sidecar path from Tauri.
 * Returns null if the command doesn't exist or fails.
 */
async function getBundledVibenPath(): Promise<string | null> {
  try {
    const path = await invoke<string>("get_bundled_viben_path");
    return path || null;
  } catch (err) {
    // The Tauri command may not exist yet - handle gracefully
    console.debug("[useVibenCli] get_bundled_viben_path command not available:", err);
    return null;
  }
}

/**
 * Hook for Viben CLI detection and selection.
 *
 * This hook integrates with the unified CLI tools detection system
 * and provides support for bundled sidecar path as the first option.
 *
 * @example
 * ```tsx
 * function VibenSelector() {
 *   const {
 *     vibenInfo,
 *     alternatives,
 *     selectedPath,
 *     isLoading,
 *     selectPath,
 *     bundledPath,
 *   } = useVibenCli();
 *
 *   return (
 *     <select
 *       value={selectedPath}
 *       onChange={(e) => selectPath(e.target.value)}
 *       disabled={isLoading}
 *     >
 *       {alternatives.map((alt) => (
 *         <option key={alt.path} value={alt.path}>
 *           {alt.path} ({alt.source})
 *         </option>
 *       ))}
 *     </select>
 *   );
 * }
 * ```
 */
export function useVibenCli(): UseVibenCliReturn {
  const {
    cliToolsCache,
    setCliToolsCache,
    vibenPath: userSelectedVibenPath,
    setVibenPath,
  } = useAppStore();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bundledPath, setBundledPath] = useState<string | null>(null);

  // Get viben info from CLI tools cache
  const vibenInfo = cliToolsCache?.data?.viben ?? null;

  // Check if cache is valid
  const isCacheValid = useCallback(() => {
    if (!cliToolsCache?.data || !cliToolsCache.timestamp) return false;
    return Date.now() - cliToolsCache.timestamp < CACHE_TTL;
  }, [cliToolsCache]);

  // Build alternatives list with bundled path first
  const alternatives: VibenCliPath[] = useMemo(() => {
    const result: VibenCliPath[] = [];
    const seenPaths = new Set<string>();

    // Add bundled path first if available
    if (bundledPath) {
      result.push({
        path: bundledPath,
        source: BUNDLED_SOURCE,
      });
      seenPaths.add(bundledPath);
    }

    // Add primary detected path
    if (vibenInfo?.found && vibenInfo.path && !seenPaths.has(vibenInfo.path)) {
      result.push({
        path: vibenInfo.path,
        version: vibenInfo.version,
        source: vibenInfo.source,
      });
      seenPaths.add(vibenInfo.path);
    }

    // Add alternatives (already deduplicated by backend)
    if (vibenInfo?.alternatives) {
      for (const alt of vibenInfo.alternatives) {
        if (!seenPaths.has(alt.path)) {
          result.push(alt);
          seenPaths.add(alt.path);
        }
      }
    }

    return result;
  }, [vibenInfo, bundledPath]);

  // Determine currently selected path (user selection > bundled > auto-detected)
  const selectedPath: string = useMemo(() => {
    // User explicitly selected a path
    if (userSelectedVibenPath) {
      const found = alternatives.find((p) => p.path === userSelectedVibenPath);
      if (found) return found.path;
    }

    // Prefer bundled path if available
    if (bundledPath) {
      return bundledPath;
    }

    // Fall back to first alternative (auto-detected)
    if (alternatives.length > 0) {
      return alternatives[0].path;
    }

    return "";
  }, [alternatives, userSelectedVibenPath, bundledPath]);

  // Detect viben CLI using the CLI tools system
  const detectViben = useCallback(async (forceRefresh = false) => {
    // Skip if cache is valid and not forcing refresh
    if (!forceRefresh && isCacheValid()) {
      return;
    }

    console.log("[useVibenCli] Starting detection...");
    setIsLoading(true);
    setError(null);

    try {
      const client = getGatewayClient();
      const result = await client.detectCliTools({
        vibenPath: userSelectedVibenPath || undefined,
      });
      console.log("[useVibenCli] Detection result:", result);
      setCliToolsCache(result);
    } catch (err) {
      console.error("[useVibenCli] Detection error:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
      console.log("[useVibenCli] Detection complete");
    }
  }, [userSelectedVibenPath, isCacheValid, setCliToolsCache]);

  // Select a viben path
  const selectPath = useCallback(async (path: string): Promise<void> => {
    console.log("[useVibenCli] Selecting path:", path);
    setVibenPath(path);

    // Re-detect with new path to update cache
    try {
      const client = getGatewayClient();
      const result = await client.detectCliTools({
        vibenPath: path,
      });
      setCliToolsCache(result);
    } catch (err) {
      console.error("[useVibenCli] Failed to update after path selection:", err);
    }
  }, [setVibenPath, setCliToolsCache]);

  // Validate a viben path
  const validatePath = useCallback(async (path: string): Promise<boolean> => {
    try {
      const client = getGatewayClient();
      const result = await client.detectCliTools({
        vibenPath: path,
      });
      return result.viben?.found ?? false;
    } catch (err) {
      console.error("[useVibenCli] Validation error:", err);
      return false;
    }
  }, []);

  // Fetch bundled path on mount
  useEffect(() => {
    getBundledVibenPath().then((path) => {
      if (path) {
        console.log("[useVibenCli] Bundled sidecar path:", path);
        setBundledPath(path);
      }
    });
  }, []);

  // Auto-detect on mount if no valid cache
  useEffect(() => {
    if (!isCacheValid()) {
      detectViben(true);
    }
  }, []);

  return {
    vibenInfo,
    alternatives,
    selectedPath,
    isLoading,
    error,
    selectPath,
    validatePath,
    bundledPath,
    detectViben,
    isCacheValid,
  };
}

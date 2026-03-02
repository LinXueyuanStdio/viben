import { useState, useEffect, useCallback, useMemo } from "react";
import type { PythonInfo, PythonPackageInfo, CliToolInfo } from "@/lib/gateway";
import { getGatewayClient } from "@/lib/gateway";
import { useAppStore } from "@/stores";

// Re-export types for backwards compatibility
export type { PythonInfo };
export type PackageInfo = PythonPackageInfo;

/** Cache TTL: 24 hours */
const CACHE_TTL = 24 * 60 * 60 * 1000;

/**
 * Convert CliToolInfo (from new API) to PythonInfo[] (old format)
 * This ensures backward compatibility with existing consumers.
 * Backend already returns deduplicated alternatives (excluding primary).
 */
function convertCliToolInfoToPythons(pythonInfo: CliToolInfo | undefined): PythonInfo[] {
  if (!pythonInfo?.found || !pythonInfo.path) return [];

  const result: PythonInfo[] = [];

  // Add primary path
  result.push({
    path: pythonInfo.path,
    version: pythonInfo.version || null,
    is_valid: true, // If found, it's valid
  });

  // Add alternatives (already deduplicated by backend)
  if (pythonInfo.alternatives) {
    for (const alt of pythonInfo.alternatives) {
      result.push({
        path: alt.path,
        version: alt.version || null,
        is_valid: true,
      });
    }
  }

  return result;
}

/**
 * Hook for Python detection and browse-mcp management.
 *
 * This hook integrates with the unified CLI tools detection system
 * and provides backward-compatible API for existing consumers.
 */
export function usePython() {
  const {
    cliToolsCache,
    setCliToolsCache,
    pythonPath: userSelectedPythonPath,
  } = useAppStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [browseMcpInfo, setBrowseMcpInfo] = useState<PythonPackageInfo | null>(null);
  const [browseMcpLoading, setBrowseMcpLoading] = useState(false);

  // Get Python info from CLI tools cache
  const pythonCliInfo = cliToolsCache?.data?.python;

  // Convert new system data to backward-compatible pythons[] format
  const pythons: PythonInfo[] = useMemo(() => {
    return convertCliToolInfoToPythons(pythonCliInfo);
  }, [pythonCliInfo]);

  // Currently selected Python (user selection > auto-detected)
  const selectedPython: PythonInfo | null = useMemo(() => {
    if (pythons.length === 0) return null;

    // If user has selected a path, use it
    if (userSelectedPythonPath) {
      const found = pythons.find((p) => p.path === userSelectedPythonPath);
      if (found) return found;
    }

    // Otherwise use first (recommended) Python
    return pythons[0];
  }, [pythons, userSelectedPythonPath]);

  // Check if cache is valid
  const isCacheValid = useCallback(() => {
    if (!cliToolsCache?.data || !cliToolsCache.timestamp) return false;
    return Date.now() - cliToolsCache.timestamp < CACHE_TTL;
  }, [cliToolsCache]);

  // Detect Python using the new CLI tools system
  const detectPython = useCallback(async (forceRefresh = false) => {
    // Skip if cache is valid and not forcing refresh
    if (!forceRefresh && isCacheValid()) {
      return;
    }

    console.log("[usePython] Starting detection...");
    setLoading(true);
    setError(null);

    try {
      const client = getGatewayClient();
      const result = await client.detectCliTools({
        pythonPath: userSelectedPythonPath || undefined,
      });
      console.log("[usePython] Detection result:", result);
      setCliToolsCache(result);
    } catch (err) {
      console.error("[usePython] Detection error:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      console.log("[usePython] Detection complete");
    }
  }, [userSelectedPythonPath, isCacheValid, setCliToolsCache]);

  // Check a specific Python path (backward compatibility)
  const checkPythonPath = useCallback(async (path: string): Promise<PythonInfo> => {
    try {
      const client = getGatewayClient();
      return await client.checkPythonPath(path);
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : String(err));
    }
  }, []);

  // Check browse-mcp installation
  const checkBrowseMcp = useCallback(async (pythonPath: string): Promise<PythonPackageInfo> => {
    console.log("[usePython] Checking browse-mcp for:", pythonPath);
    setBrowseMcpLoading(true);

    try {
      const client = getGatewayClient();
      const info = await client.checkPythonPackage(pythonPath, "browse-mcp");
      console.log("[usePython] browse-mcp info:", info);
      setBrowseMcpInfo(info);
      return info;
    } catch (err) {
      console.error("[usePython] browse-mcp check error:", err);
      throw new Error(err instanceof Error ? err.message : String(err));
    } finally {
      setBrowseMcpLoading(false);
    }
  }, []);

  // Get install command for browse-mcp
  const getInstallCommand = useCallback(async (pythonPath: string): Promise<string> => {
    const client = getGatewayClient();
    const result = await client.getPythonInstallCommand(pythonPath, "browse-mcp");
    return result.command;
  }, []);

  // Get uv install command
  const getUvInstallCommand = useCallback(async (): Promise<string> => {
    const client = getGatewayClient();
    const result = await client.getPythonInstallCommand("python3", "browse-mcp");
    return result.uv_command;
  }, []);

  // Backward compatibility: setSelectedPython (no-op, use store's setPythonPath instead)
  const setSelectedPython = useCallback((_python: PythonInfo | null) => {
    console.warn("[usePython] setSelectedPython is deprecated. Use useAppStore().setPythonPath() instead.");
  }, []);

  // Auto-detect on mount if no valid cache
  useEffect(() => {
    if (!isCacheValid()) {
      detectPython(true);
    }
  }, []);

  // Auto-check browse-mcp when Python changes
  useEffect(() => {
    const currentPythonPath = userSelectedPythonPath || pythonCliInfo?.path;

    if (currentPythonPath && pythonCliInfo?.found) {
      checkBrowseMcp(currentPythonPath).catch((err) => {
        console.error("[usePython] Auto browse-mcp check failed:", err);
      });
    }
  }, [pythonCliInfo?.found, pythonCliInfo?.path, userSelectedPythonPath, checkBrowseMcp]);

  return {
    // Backward-compatible API
    pythons,
    selectedPython,
    setSelectedPython, // Deprecated
    browseMcpInfo,
    loading: loading || browseMcpLoading,
    error,

    // Methods
    detectPython,
    checkPythonPath,
    checkBrowseMcp,
    getInstallCommand,
    getUvInstallCommand,

    // New additions
    browseMcpLoading,
    isCacheValid,
  };
}

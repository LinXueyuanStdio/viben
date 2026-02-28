import { useState, useEffect, useCallback } from "react";
import type { PythonInfo, PythonPackageInfo } from "@/lib/gateway";
import { getGatewayClient } from "@/lib/gateway";

// Re-export types for backwards compatibility
export type { PythonInfo };
export type PackageInfo = PythonPackageInfo;

export function usePython() {
  const [pythons, setPythons] = useState<PythonInfo[]>([]);
  const [selectedPython, setSelectedPython] = useState<PythonInfo | null>(null);
  const [browseMcpInfo, setBrowseMcpInfo] = useState<PythonPackageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const detectPython = useCallback(async () => {
    console.log("[usePython] Starting detection...");
    setLoading(true);
    setError(null);
    try {
      const client = getGatewayClient();
      const detected = await client.detectPython();
      console.log("[usePython] Detected pythons:", detected);
      setPythons(detected);

      // Auto-select first valid Python
      const validPython = detected.find((p) => p.is_valid);
      console.log("[usePython] Valid python:", validPython);
      if (validPython) {
        setSelectedPython(validPython);
      }
    } catch (err) {
      console.error("[usePython] Detection error:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      console.log("[usePython] Detection complete, loading=false");
    }
  }, []);

  const checkPythonPath = useCallback(async (path: string) => {
    try {
      const client = getGatewayClient();
      return await client.checkPythonPath(path);
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const checkBrowseMcp = useCallback(async (pythonPath: string) => {
    try {
      const client = getGatewayClient();
      const info = await client.checkPythonPackage(pythonPath, "browse-mcp");
      setBrowseMcpInfo(info);
      return info;
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const getInstallCommand = useCallback(async (pythonPath: string) => {
    const client = getGatewayClient();
    const result = await client.getPythonInstallCommand(pythonPath, "browse-mcp");
    return result.command;
  }, []);

  const getUvInstallCommand = useCallback(async () => {
    const client = getGatewayClient();
    const result = await client.getPythonInstallCommand("python3", "browse-mcp");
    return result.uv_command;
  }, []);

  // Auto-detect on mount
  useEffect(() => {
    detectPython();
  }, [detectPython]);

  // Check browse-mcp when Python is selected
  useEffect(() => {
    if (selectedPython?.path) {
      checkBrowseMcp(selectedPython.path);
    }
  }, [selectedPython, checkBrowseMcp]);

  return {
    pythons,
    selectedPython,
    setSelectedPython,
    browseMcpInfo,
    loading,
    error,
    detectPython,
    checkPythonPath,
    checkBrowseMcp,
    getInstallCommand,
    getUvInstallCommand,
  };
}

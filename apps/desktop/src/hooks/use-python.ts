import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { PythonInfo, PackageInfo } from "@/types";

export function usePython() {
  const [pythons, setPythons] = useState<PythonInfo[]>([]);
  const [selectedPython, setSelectedPython] = useState<PythonInfo | null>(null);
  const [browseMcpInfo, setBrowseMcpInfo] = useState<PackageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const detectPython = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const detected = await invoke<PythonInfo[]>("detect_python");
      setPythons(detected);

      // Auto-select first valid Python
      const validPython = detected.find((p) => p.is_valid);
      if (validPython) {
        setSelectedPython(validPython);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const checkPythonPath = useCallback(async (path: string) => {
    try {
      const info = await invoke<PythonInfo>("check_python_path", {
        pythonPath: path,
      });
      return info;
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const checkBrowseMcp = useCallback(async (pythonPath: string) => {
    try {
      const info = await invoke<PackageInfo>("check_browse_mcp_installed", {
        pythonPath,
      });
      setBrowseMcpInfo(info);
      return info;
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const getInstallCommand = useCallback(async (pythonPath: string) => {
    return await invoke<string>("get_install_command", { pythonPath });
  }, []);

  const getUvInstallCommand = useCallback(async () => {
    return await invoke<string>("get_uv_install_command");
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

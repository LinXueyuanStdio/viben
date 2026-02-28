/**
 * Gateway Management Hook
 * 网关管理 Hook
 *
 * Provides functions for managing the viben gateway process via Tauri commands.
 * 通过 Tauri 命令管理 viben 网关进程。
 */

import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface GatewayStatus {
  running: boolean;
  pid: number | null;
  port: number;
  url: string;
  error: string | null;
}

export interface GatewayConfig {
  port: number;
  auto_start: boolean;
  host: string;
}

export interface UseGatewayReturn {
  /** Current gateway status */
  status: GatewayStatus | null;
  /** Gateway configuration */
  config: GatewayConfig | null;
  /** Whether we're loading status */
  isLoading: boolean;
  /** Whether we're performing an action */
  isActioning: boolean;
  /** Last error message */
  error: string | null;
  /** Path to gateway binary (if found) */
  binaryPath: string | null;
  /** Auto-discovered gateway URL (if different from configured) */
  discoveredUrl: string | null;
  /** Start the gateway */
  startGateway: () => Promise<void>;
  /** Stop the gateway */
  stopGateway: () => Promise<void>;
  /** Restart the gateway */
  restartGateway: () => Promise<void>;
  /** Refresh status */
  refreshStatus: () => Promise<void>;
  /** Update configuration */
  updateConfig: (config: Partial<GatewayConfig>) => Promise<void>;
  /** Auto-discover running gateway */
  discoverGateway: () => Promise<string | null>;
}

export function useGateway(): UseGatewayReturn {
  const [status, setStatus] = useState<GatewayStatus | null>(null);
  const [config, setConfig] = useState<GatewayConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActioning, setIsActioning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [binaryPath, setBinaryPath] = useState<string | null>(null);
  const [discoveredUrl, setDiscoveredUrl] = useState<string | null>(null);

  // Fetch status
  const refreshStatus = useCallback(async () => {
    try {
      const result = await invoke<GatewayStatus>("get_gateway_status");
      setStatus(result);
      setError(result.error || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  // Fetch config
  const refreshConfig = useCallback(async () => {
    try {
      const result = await invoke<GatewayConfig>("get_gateway_config");
      setConfig(result);
    } catch (err) {
      console.error("Failed to get gateway config:", err);
    }
  }, []);

  // Check binary path
  const checkBinary = useCallback(async () => {
    try {
      const path = await invoke<string | null>("check_gateway_binary");
      setBinaryPath(path);
    } catch (err) {
      console.error("Failed to check gateway binary:", err);
    }
  }, []);

  // Auto-discover running gateway
  const discoverGateway = useCallback(async (): Promise<string | null> => {
    try {
      const url = await invoke<string | null>("discover_gateway");
      setDiscoveredUrl(url);
      return url;
    } catch (err) {
      console.error("Failed to discover gateway:", err);
      return null;
    }
  }, []);

  // Initial load
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await Promise.all([refreshStatus(), refreshConfig(), checkBinary(), discoverGateway()]);
      setIsLoading(false);
    };
    init();

    // Poll status every 5 seconds
    const interval = setInterval(refreshStatus, 5000);
    return () => clearInterval(interval);
  }, [refreshStatus, refreshConfig, checkBinary, discoverGateway]);

  // Start gateway
  const startGateway = useCallback(async () => {
    setIsActioning(true);
    setError(null);
    try {
      const result = await invoke<GatewayStatus>("start_gateway");
      setStatus(result);
      if (result.error) {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsActioning(false);
    }
  }, []);

  // Stop gateway
  const stopGateway = useCallback(async () => {
    setIsActioning(true);
    setError(null);
    try {
      const result = await invoke<GatewayStatus>("stop_gateway");
      setStatus(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsActioning(false);
    }
  }, []);

  // Restart gateway
  const restartGateway = useCallback(async () => {
    setIsActioning(true);
    setError(null);
    try {
      const result = await invoke<GatewayStatus>("restart_gateway");
      setStatus(result);
      if (result.error) {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsActioning(false);
    }
  }, []);

  // Update config
  const updateConfig = useCallback(
    async (newConfig: Partial<GatewayConfig>) => {
      if (!config) return;

      const updatedConfig = { ...config, ...newConfig };
      try {
        await invoke("set_gateway_config", { config: updatedConfig });
        setConfig(updatedConfig);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [config]
  );

  return {
    status,
    config,
    isLoading,
    isActioning,
    error,
    binaryPath,
    discoveredUrl,
    startGateway,
    stopGateway,
    restartGateway,
    refreshStatus,
    updateConfig,
    discoverGateway,
  };
}

/**
 * Gateway Management Hook
 * 网关管理 Hook
 *
 * Provides functions for managing the viben gateway process via Tauri commands.
 * 通过 Tauri 命令管理 viben 网关进程。
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useVibenCli } from "./use-viben-cli";
import type { VersionCheckResult } from "@/lib/onboarding/version-policy";
import { classifyGatewayError } from "@/lib/onboarding/gateway-diagnostics";
import type { GatewayRuntimeStateCode } from "@/lib/onboarding/gateway-diagnostics";

export interface GatewayStatus {
  running: boolean;
  pid: number | null;
  port: number;
  url: string;
  error: string | null;
  /** Path to the viben binary that was used */
  binary_path: string | null;
  /** Full command that was executed */
  command: string | null;
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
  /** Currently selected viben path (user selection > bundled > auto-detected) */
  vibenPath: string;
  /** Version check result */
  versionCheck: VersionCheckResult | null;
  /** Gateway runtime state classification */
  runtimeState: GatewayRuntimeStateCode;
  /** Start the gateway, returns the status */
  startGateway: () => Promise<GatewayStatus | null>;
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
  // Version check result - populated by CLI installer hook, exposed for UI
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [versionCheck, _setVersionCheck] = useState<VersionCheckResult | null>(null);
  const [runtimeState, setRuntimeState] = useState<GatewayRuntimeStateCode>("not_running");

  // Get viben CLI selection (bundled > user-selected > auto-detected)
  const { selectedPath: vibenPath } = useVibenCli();

  // Keep a ref of vibenPath for use in callbacks without causing re-renders
  const vibenPathRef = useRef(vibenPath);
  vibenPathRef.current = vibenPath;

  // Fetch status
  const refreshStatus = useCallback(async () => {
    try {
      const result = await invoke<GatewayStatus>("get_gateway_status");
      setStatus(result);
      setError(result.error || null);

      // Classify runtime state
      if (result.running) {
        setRuntimeState("healthy");
      } else if (result.error) {
        setRuntimeState(classifyGatewayError(result.error));
      } else {
        setRuntimeState("not_running");
      }

      // Check version if available (from gateway /health response)
      // Note: GatewayStatus doesn't currently include version, but could be extended
      // For now, we'll leave versionCheck null until CLI check provides it
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(errorMsg);
      setRuntimeState(classifyGatewayError(errorMsg));
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
  const startGateway = useCallback(async (): Promise<GatewayStatus | null> => {
    console.log("[useGateway] startGateway called");
    console.log("[useGateway] Current state:", {
      vibenPath: vibenPathRef.current,
      configPort: config?.port,
      configHost: config?.host,
      currentStatus: status,
    });

    setIsActioning(true);
    setError(null);
    try {
      const currentVibenPath = vibenPathRef.current;
      let result: GatewayStatus;

      if (currentVibenPath) {
        // Use selected/bundled viben path
        console.log("[useGateway] Starting gateway with viben path:", currentVibenPath);
        console.log("[useGateway] Invoking start_gateway_with_path with:", {
          vibenPath: currentVibenPath,
          port: config?.port,
          host: config?.host,
        });
        result = await invoke<GatewayStatus>("start_gateway_with_path", {
          vibenPath: currentVibenPath,
          port: config?.port,
          host: config?.host,
        });
        console.log("[useGateway] start_gateway_with_path returned:", result);
      } else {
        // Fall back to default start (uses PATH lookup)
        console.log("[useGateway] Starting gateway with default path lookup (no viben path set)");
        result = await invoke<GatewayStatus>("start_gateway");
        console.log("[useGateway] start_gateway returned:", result);
      }

      setStatus(result);
      if (result.error) {
        console.error("[useGateway] Gateway returned error:", result.error);
        setError(result.error);
      } else {
        console.log("[useGateway] Gateway started successfully:", {
          running: result.running,
          pid: result.pid,
          port: result.port,
          url: result.url,
        });
      }
      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("[useGateway] Exception during gateway start:", errorMsg);
      setError(errorMsg);
      return null;
    } finally {
      setIsActioning(false);
      console.log("[useGateway] startGateway completed");
    }
  }, [config?.port, config?.host, status]);

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
    vibenPath,
    versionCheck,
    runtimeState,
    startGateway,
    stopGateway,
    restartGateway,
    refreshStatus,
    updateConfig,
    discoverGateway,
  };
}

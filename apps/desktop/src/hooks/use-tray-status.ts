import { useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { useAppStore } from "@/stores";
import { useMcpStatusMonitor } from "./use-mcp-status-monitor";
import { useMcp } from "./use-mcp";
import { usePython } from "./use-python";
import { useApiKeys } from "./use-api-keys";

/**
 * Tray status types matching Rust enum
 */
type TrayStatus = "all_running" | "partial_running" | "has_errors" | "inactive";

/**
 * Hook to synchronize MCP server status with the system tray icon
 *
 * This hook:
 * 1. Monitors server status changes
 * 2. Updates tray icon color based on aggregate status
 * 3. Listens for tray menu events (start all, stop all)
 */
export function useTrayStatus() {
  const { mcpServers, mcpServerStatuses, setMcpServerStatus } = useAppStore();
  const { getStats } = useMcpStatusMonitor();
  const { startServer, stopServer } = useMcp();
  const { selectedPython } = usePython();
  const { getAllApiKeys } = useApiKeys();

  const lastStatusRef = useRef<TrayStatus | null>(null);

  /**
   * Calculate aggregate status from server stats
   */
  const calculateTrayStatus = useCallback((): TrayStatus => {
    const stats = getStats();

    if (stats.total === 0) {
      return "inactive";
    }

    if (stats.error > 0) {
      return "has_errors";
    }

    if (stats.running === stats.total) {
      return "all_running";
    }

    if (stats.running > 0) {
      return "partial_running";
    }

    return "inactive";
  }, [getStats]);

  /**
   * Update tray icon based on current status
   */
  const updateTrayIcon = useCallback(async () => {
    const status = calculateTrayStatus();

    // Only update if status changed
    if (status === lastStatusRef.current) {
      return;
    }

    lastStatusRef.current = status;

    try {
      await invoke("update_tray_status", { status });
    } catch (err) {
      // Tray might not be available (e.g., during development)
      console.debug("Failed to update tray status:", err);
    }
  }, [calculateTrayStatus]);

  /**
   * Handle "Start All" from tray menu
   */
  const handleStartAll = useCallback(async () => {
    if (!selectedPython?.path) return;

    const apiKeys = await getAllApiKeys();

    // Get servers that are not running
    const stoppedServers = mcpServers.filter((s) => {
      const status = mcpServerStatuses[s.id]?.status ?? s.status;
      return status !== "running";
    });

    for (const server of stoppedServers) {
      try {
        await startServer({
          python_path: selectedPython.path,
          transport: server.transport,
          port: server.port ?? 3000,
          download_path: server.downloadPath,
          enabled_sources: server.enabledSources,
          api_keys: apiKeys,
          server_id: server.id,
          server_name: server.name,
        });
        setMcpServerStatus(server.id, "running");
      } catch (err) {
        console.error(`Failed to start ${server.name}:`, err);
        setMcpServerStatus(server.id, "error", undefined, String(err));
      }
    }
  }, [selectedPython, mcpServers, mcpServerStatuses, getAllApiKeys, startServer, setMcpServerStatus]);

  /**
   * Handle "Stop All" from tray menu
   */
  const handleStopAll = useCallback(async () => {
    // Get servers that are running
    const runningServers = mcpServers.filter((s) => {
      const status = mcpServerStatuses[s.id]?.status ?? s.status;
      return status === "running";
    });

    for (const server of runningServers) {
      try {
        await stopServer();
        setMcpServerStatus(server.id, "stopped");
      } catch (err) {
        console.error(`Failed to stop ${server.name}:`, err);
      }
    }
  }, [mcpServers, mcpServerStatuses, stopServer, setMcpServerStatus]);

  // Update tray icon when status changes
  useEffect(() => {
    updateTrayIcon();
  }, [mcpServers, mcpServerStatuses, updateTrayIcon]);

  // Listen for tray menu events
  useEffect(() => {
    const unlistenFns: UnlistenFn[] = [];

    const setupListeners = async () => {
      try {
        const unlistenStartAll = await listen("tray-start-all", () => {
          handleStartAll();
        });
        unlistenFns.push(unlistenStartAll);

        const unlistenStopAll = await listen("tray-stop-all", () => {
          handleStopAll();
        });
        unlistenFns.push(unlistenStopAll);
      } catch (err) {
        console.debug("Failed to set up tray listeners:", err);
      }
    };

    setupListeners();

    return () => {
      unlistenFns.forEach((unlisten) => unlisten());
    };
  }, [handleStartAll, handleStopAll]);

  return {
    updateTrayIcon,
    handleStartAll,
    handleStopAll,
    currentStatus: calculateTrayStatus(),
  };
}

/**
 * Hook to be used in the main app layout
 * Initializes tray status synchronization
 */
export function useTrayStatusSync() {
  const { updateTrayIcon } = useTrayStatus();

  // Initial sync on mount
  useEffect(() => {
    // Small delay to ensure tray is ready
    const timer = setTimeout(() => {
      updateTrayIcon();
    }, 1000);

    return () => clearTimeout(timer);
  }, [updateTrayIcon]);
}

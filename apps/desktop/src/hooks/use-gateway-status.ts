/**
 * Gateway Status Hook
 *
 * Provides global gateway connection status monitoring.
 * Auto-pings the gateway periodically and tracks connection state.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { getGatewayClient, getGatewayUrl, setGatewayUrl } from "@/lib/gateway";
import { useWorkspaceStore, useAppStore } from "@/stores";
import type { Workspace } from "@/types";

export type GatewayStatus = "connected" | "disconnected" | "connecting" | "error";

export interface UseGatewayStatusReturn {
  /** Current connection status */
  status: GatewayStatus;
  /** Whether the gateway is connected */
  isConnected: boolean;
  /** Whether we're currently checking connection */
  isChecking: boolean;
  /** Last successful connection timestamp */
  lastConnected: number | null;
  /** Last error message if any */
  error: string | null;
  /** Current gateway URL */
  gatewayUrl: string;
  /** Manually check connection */
  checkConnection: () => Promise<boolean>;
  /** Update gateway URL */
  updateGatewayUrl: (url: string) => void;
}

// Global state for singleton pattern
let globalStatus: GatewayStatus = "disconnected";
let globalLastConnected: number | null = null;
let globalError: string | null = null;
let globalListeners: Set<() => void> = new Set();
let pingInterval: NodeJS.Timeout | null = null;

// Notify all listeners of state change
function notifyListeners() {
  globalListeners.forEach((listener) => listener());
}

// Load workspaces when gateway connects (only if no persisted data)
async function loadWorkspacesOnConnect() {
  const store = useWorkspaceStore.getState();

  // Skip if already have workspaces (persisted data) or if already loading
  if (store.workspaces.length > 0 || store.isLoading) {
    return;
  }

  try {
    store.setLoading(true);
    const client = getGatewayClient();
    const response = await client.listWorkspaces();

    // Transform gateway workspaces to local format
    // Gateway now includes global workspace with type: "global"
    const workspaces: Workspace[] = response.workspaces.map((w) => ({
      id: w.id,
      path: w.path,
      name: w.name,
      type: w.type || "custom",
      created_at: w.created_at || new Date().toISOString(),
      last_accessed: w.updated_at || new Date().toISOString(),
    }));

    store.setWorkspaces(workspaces);
  } catch (err) {
    console.error("Failed to load workspaces on gateway connect:", err);
  } finally {
    store.setLoading(false);
  }
}

// Load developer preferences from config when gateway connects
async function loadPreferencesOnConnect() {
  try {
    await useAppStore.getState().loadDeveloperPreferences();
  } catch (err) {
    console.error("Failed to load developer preferences on gateway connect:", err);
  }
}

// Ping the gateway and update global state
async function pingGateway(): Promise<boolean> {
  const client = getGatewayClient();
  const wasConnected = globalStatus === "connected";

  try {
    const isOnline = await client.ping();
    if (isOnline) {
      globalStatus = "connected";
      globalLastConnected = Date.now();
      globalError = null;

      // Load data on first connect or reconnect
      if (!wasConnected) {
        loadWorkspacesOnConnect();
        loadPreferencesOnConnect();
      }
    } else {
      globalStatus = "disconnected";
      globalError = null;
    }
    notifyListeners();
    return isOnline;
  } catch (err) {
    globalStatus = "error";
    globalError = err instanceof Error ? err.message : "Unknown error";
    notifyListeners();
    return false;
  }
}

// Start periodic ping if not already started
function startPingInterval() {
  if (pingInterval) return;

  // Initial ping
  pingGateway();

  // Ping every 10 seconds
  pingInterval = setInterval(() => {
    pingGateway();
  }, 10000);
}

// Stop periodic ping when no listeners
function stopPingInterval() {
  if (pingInterval && globalListeners.size === 0) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
}

/**
 * Hook to monitor gateway connection status globally.
 *
 * Uses a singleton pattern - all components share the same connection state.
 * Automatically pings the gateway periodically.
 */
export function useGatewayStatus(): UseGatewayStatusReturn {
  const [, forceUpdate] = useState({});
  const isMounted = useRef(true);

  // Register listener on mount, unregister on unmount
  useEffect(() => {
    isMounted.current = true;

    const listener = () => {
      if (isMounted.current) {
        forceUpdate({});
      }
    };

    globalListeners.add(listener);
    startPingInterval();

    return () => {
      isMounted.current = false;
      globalListeners.delete(listener);
      stopPingInterval();
    };
  }, []);

  const checkConnection = useCallback(async () => {
    globalStatus = "connecting";
    notifyListeners();
    return pingGateway();
  }, []);

  const updateGatewayUrl = useCallback((url: string) => {
    setGatewayUrl(url);
    getGatewayClient().setBaseUrl(url);
    // Immediately check connection with new URL
    checkConnection();
  }, [checkConnection]);

  return {
    status: globalStatus,
    isConnected: globalStatus === "connected",
    isChecking: globalStatus === "connecting",
    lastConnected: globalLastConnected,
    error: globalError,
    gatewayUrl: getGatewayUrl(),
    checkConnection,
    updateGatewayUrl,
  };
}

/**
 * Gateway Status Hook
 *
 * Provides global gateway connection status monitoring.
 * Auto-pings the gateway periodically and tracks connection state.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { getGatewayClient, getGatewayUrl, setGatewayUrl } from "@/lib/gateway";

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

// Ping the gateway and update global state
async function pingGateway(): Promise<boolean> {
  const client = getGatewayClient();
  try {
    const isOnline = await client.ping();
    if (isOnline) {
      globalStatus = "connected";
      globalLastConnected = Date.now();
      globalError = null;
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

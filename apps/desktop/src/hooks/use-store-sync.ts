import { useEffect, useCallback, useRef } from "react";
import { emit, listen, UnlistenFn } from "@tauri-apps/api/event";
import { getGatewayClient } from "@/lib/gateway";
import { useAppStore } from "@/stores";
import { useMcpWebSocket } from "./use-mcp-websocket";
import type { McpServerInstance, McpServerStatusInfo } from "@/types";
import type { McpConfigChangedData } from "@/lib/gateway/types";

/**
 * Event types for cross-window store synchronization
 */
const STORE_SYNC_EVENT = "store-sync-update";

/** Debounce time for mcpServers changes (more important, shorter delay) */
const DEBOUNCE_SERVERS = 500;
/** Debounce time for mcpServerStatuses changes (less critical, longer delay) */
const DEBOUNCE_STATUSES = 5000;

interface StoreSyncPayload {
  /** Timestamp when the update was made */
  timestamp: number;
  /** Which part of the store was updated */
  updated: "mcpServers" | "mcpServerStatuses" | "all";
  /** Source window that made the update */
  source: "main" | "tray";
}

/**
 * MCP Servers state persisted to file
 * This is the source of truth stored in ~/.viben/mcp-servers.json
 */
interface McpServersFileState {
  mcpServers: McpServerInstance[];
  mcpServerStatuses: Record<string, McpServerStatusInfo>;
  lastUpdated: number;
}

/** Cache of last written content to avoid unnecessary writes */
let lastWrittenContent: string | null = null;

/** Flag to prevent save during initial load */
let isInitialLoading = true;

/** Timestamp of last write, used to ignore WebSocket events triggered by own writes */
let lastWriteTimestamp = 0;

/** Grace period (ms) to ignore WebSocket events after our own write */
const WRITE_GRACE_PERIOD_MS = 500;

/**
 * Read MCP servers state from Gateway file
 * Gateway stores data in ~/.viben/mcp-servers.json
 */
async function readServersFromFile(): Promise<McpServersFileState | null> {
  try {
    const gateway = getGatewayClient();
    const config = await gateway.readMcpServersFile();

    // Check if config has our state format (mcpServers as array)
    const parsed = config as unknown as { mcpServers?: McpServerInstance[] | Record<string, unknown> };

    if (parsed.mcpServers && Array.isArray(parsed.mcpServers)) {
      const state = config as unknown as McpServersFileState;
      lastWrittenContent = JSON.stringify(state);
      return state;
    }

    // Empty or invalid format
    return null;
  } catch (err) {
    console.debug("Failed to read servers file:", err);
    return null;
  }
}

/**
 * Write MCP servers state to Gateway file (with content comparison)
 * Returns true if write was performed, false if skipped
 */
async function writeServersToFile(state: McpServersFileState): Promise<boolean> {
  // Don't write during initial loading
  if (isInitialLoading) {
    return false;
  }

  try {
    const content = JSON.stringify(state, null, 2);

    // Skip write if content hasn't changed
    if (content === lastWrittenContent) {
      return false;
    }

    const gateway = getGatewayClient();
    // Pass state directly - it already contains { mcpServers, mcpServerStatuses, lastUpdated }
    await gateway.writeMcpServersFile(state as unknown as Record<string, unknown>);
    lastWrittenContent = content;
    lastWriteTimestamp = Date.now();
    return true;
  } catch (err) {
    console.debug("Failed to write servers file:", err);
    return false;
  }
}

/**
 * Hook to synchronize Zustand store with Gateway's mcp-servers.json
 *
 * The Gateway file (~/.viben/mcp-servers.json) is the single source of truth.
 *
 * This hook:
 * 1. Loads MCP servers state from Gateway file on mount (always)
 * 2. Persists changes back to Gateway file
 * 3. Emits events when the store changes for cross-window sync
 * 4. Listens for events from other windows
 * 5. Listens for WebSocket config change events from Gateway
 */
export function useStoreSync(windowType: "main" | "tray" = "main") {
  const {
    mcpServers,
    mcpServerStatuses,
  } = useAppStore();

  const lastSyncRef = useRef<number>(0);
  const hasLoadedFromFile = useRef(false);

  /**
   * Load state from Gateway file into store
   */
  const loadFromFile = useCallback(async () => {
    try {
      const fileState = await readServersFromFile();

      if (fileState) {
        // Update MCP servers
        if (fileState.mcpServers && Array.isArray(fileState.mcpServers)) {
          useAppStore.setState({ mcpServers: fileState.mcpServers });
        }

        // Update MCP server statuses
        if (fileState.mcpServerStatuses) {
          useAppStore.setState({ mcpServerStatuses: fileState.mcpServerStatuses });
        }
      }

      hasLoadedFromFile.current = true;
      // Allow saves after initial load is complete
      setTimeout(() => {
        isInitialLoading = false;
      }, 100);
    } catch (err) {
      console.debug("Failed to load from file:", err);
      isInitialLoading = false;
    }
  }, []);

  /**
   * Handle WebSocket config change event
   */
  const handleConfigChanged = useCallback((data: McpConfigChangedData) => {
    // Ignore WebSocket events triggered by our own recent writes
    const timeSinceLastWrite = Date.now() - lastWriteTimestamp;
    if (timeSinceLastWrite < WRITE_GRACE_PERIOD_MS) {
      console.debug("[StoreSync] Ignoring config change triggered by own write");
      return;
    }

    console.log("[StoreSync] Config file changed via WebSocket:", data.change_type);

    // Reload from file when config changes
    // Use a small delay to ensure the file write is complete
    setTimeout(() => {
      loadFromFile();
    }, 100);
  }, [loadFromFile]);

  // Subscribe to WebSocket for real-time config change notifications
  const { isConnected: wsConnected } = useMcpWebSocket({
    enabled: true,
    updateStore: false, // Don't auto-update status, we handle config changes ourselves
    onConfigChanged: handleConfigChanged,
  });

  /**
   * Save current state to file and emit update event
   * Only emits event if file was actually written (content changed)
   */
  const saveAndEmit = useCallback(
    async (updated: StoreSyncPayload["updated"] = "all") => {
      const timestamp = Date.now();
      const store = useAppStore.getState();

      // Save to file (returns false if content unchanged)
      const didWrite = await writeServersToFile({
        mcpServers: store.mcpServers,
        mcpServerStatuses: store.mcpServerStatuses,
        lastUpdated: timestamp,
      });

      // Only emit event if we actually wrote something
      if (didWrite) {
        lastSyncRef.current = timestamp;

        try {
          await emit(STORE_SYNC_EVENT, {
            timestamp,
            updated,
            source: windowType,
          } as StoreSyncPayload);
        } catch (err) {
          console.debug("Failed to emit store sync event:", err);
        }
      }
    },
    [windowType]
  );

  const serversTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusesTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Debounced save for mcpServers (shorter delay)
   */
  const debouncedSaveServers = useCallback(() => {
    if (serversTimeoutRef.current) {
      clearTimeout(serversTimeoutRef.current);
    }
    serversTimeoutRef.current = setTimeout(() => {
      saveAndEmit("mcpServers");
    }, DEBOUNCE_SERVERS);
  }, [saveAndEmit]);

  /**
   * Debounced save for mcpServerStatuses (longer delay)
   */
  const debouncedSaveStatuses = useCallback(() => {
    if (statusesTimeoutRef.current) {
      clearTimeout(statusesTimeoutRef.current);
    }
    statusesTimeoutRef.current = setTimeout(() => {
      saveAndEmit("mcpServerStatuses");
    }, DEBOUNCE_STATUSES);
  }, [saveAndEmit]);

  // Load initial state from Gateway file on mount (always)
  useEffect(() => {
    loadFromFile();
  }, [loadFromFile]);

  // Watch for mcpServers changes and save to file
  useEffect(() => {
    // Skip if we haven't loaded from file yet
    if (!hasLoadedFromFile.current) {
      return;
    }

    debouncedSaveServers();

    return () => {
      if (serversTimeoutRef.current) {
        clearTimeout(serversTimeoutRef.current);
      }
    };
  }, [mcpServers, debouncedSaveServers]);

  // Watch for mcpServerStatuses changes (with longer debounce)
  useEffect(() => {
    // Skip if we haven't loaded from file yet
    if (!hasLoadedFromFile.current) {
      return;
    }

    debouncedSaveStatuses();

    return () => {
      if (statusesTimeoutRef.current) {
        clearTimeout(statusesTimeoutRef.current);
      }
    };
  }, [mcpServerStatuses, debouncedSaveStatuses]);

  // Listen for sync events from other windows (Tauri events as backup)
  useEffect(() => {
    const unlistenFns: UnlistenFn[] = [];

    const setupListeners = async () => {
      try {
        // Listen for store updates from other windows
        const unlistenSync = await listen<StoreSyncPayload>(STORE_SYNC_EVENT, (event) => {
          // Ignore events from self
          if (event.payload.source === windowType) return;

          // Ignore old events
          if (event.payload.timestamp <= lastSyncRef.current) return;

          lastSyncRef.current = event.payload.timestamp;

          // Reload store from file
          loadFromFile();
        });
        unlistenFns.push(unlistenSync);
      } catch (err) {
        console.debug("Failed to set up store sync listeners:", err);
      }
    };

    setupListeners();

    return () => {
      unlistenFns.forEach((unlisten) => unlisten());
    };
  }, [windowType, loadFromFile]);

  return {
    saveAndEmit,
    reloadFromFile: loadFromFile,
    wsConnected,
  };
}

/**
 * Hook specifically for the main window
 * Automatically syncs store changes to Gateway file and other windows
 */
export function useMainWindowStoreSync() {
  return useStoreSync("main");
}

/**
 * Hook specifically for the tray window
 * Listens for store changes from the main window
 */
export function useTrayWindowStoreSync() {
  return useStoreSync("tray");
}

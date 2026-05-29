import { useEffect, useCallback, useRef } from "react";
import { emit, listen, UnlistenFn } from "@tauri-apps/api/event";
import { getGatewayClient } from "@/lib/gateway";
import { useAppStore } from "@/stores";
import { useMcpWebSocket } from "./use-mcp-websocket";
import type { McpServerInstance } from "@/types";
import type { McpConfigChangedData } from "@/lib/gateway/types";

/**
 * Event types for cross-window store synchronization
 */
const STORE_SYNC_EVENT = "store-sync-update";

/** Debounce time for mcpServers changes */
const DEBOUNCE_SERVERS = 500;

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
 *
 * NOTE: We intentionally do NOT persist mcpServerStatuses.
 * Status info is transient, frequently updated by WebSocket events.
 * Persisting it would create a feedback loop.
 */
interface McpServersFileState {
  mcpServers: McpServerInstance[];
  lastUpdated: number;
}

/** Cache of last written mcpServers content (excluding lastUpdated) to avoid unnecessary writes */
let lastWrittenServersContent: string | null = null;

/** Flag to prevent save during initial load */
let isInitialLoading = true;

/** Timestamp of last write, used to ignore WebSocket events triggered by own writes */
let lastWriteTimestamp = 0;

/** Grace period (ms) to ignore WebSocket events after our own write */
const WRITE_GRACE_PERIOD_MS = 500;

/** Debug logging prefix */
const LOG_PREFIX = "[StoreSync]";

/** Debug logging helper - only logs in development */
const debugLog = (...args: unknown[]) => {
  if (import.meta.env.DEV) {
    console.log(...args);
  }
};

/** Counter for tracking API calls */
let readCallCount = 0;
let writeCallCount = 0;

/**
 * Read MCP servers state from Gateway file
 * Gateway stores data in ~/.viben/mcp-servers.json
 */
async function readServersFromFile(): Promise<McpServersFileState | null> {
  readCallCount++;
  const callId = readCallCount;
  const stack = new Error().stack?.split('\n').slice(2, 6).join('\n') || 'no stack';

  debugLog(`${LOG_PREFIX} 📖 READ #${callId} - readMcpServersFile() called`);
  debugLog(`${LOG_PREFIX} 📖 READ #${callId} - Call stack:\n${stack}`);

  try {
    const gateway = getGatewayClient();
    const config = await gateway.readMcpServersFile();

    // Check if config has our state format (mcpServers as array)
    const parsed = config as unknown as { mcpServers?: McpServerInstance[] | Record<string, unknown> };

    if (parsed.mcpServers && Array.isArray(parsed.mcpServers)) {
      const state = config as unknown as McpServersFileState;
      // Only cache mcpServers content, not lastUpdated (to avoid false positives)
      lastWrittenServersContent = JSON.stringify(state.mcpServers);
      debugLog(`${LOG_PREFIX} 📖 READ #${callId} - Success, got ${state.mcpServers.length} servers`);
      return state;
    }

    // Empty or invalid format
    debugLog(`${LOG_PREFIX} 📖 READ #${callId} - Empty or invalid format`);
    return null;
  } catch (err) {
    console.debug(`${LOG_PREFIX} 📖 READ #${callId} - Failed:`, err);
    return null;
  }
}

/**
 * Write MCP servers state to Gateway file (with content comparison)
 * Returns true if write was performed, false if skipped
 */
async function writeServersToFile(state: McpServersFileState): Promise<boolean> {
  writeCallCount++;
  const callId = writeCallCount;
  const stack = new Error().stack?.split('\n').slice(2, 6).join('\n') || 'no stack';

  debugLog(`${LOG_PREFIX} ✏️ WRITE #${callId} - writeServersToFile() called`);
  debugLog(`${LOG_PREFIX} ✏️ WRITE #${callId} - Call stack:\n${stack}`);

  // Don't write during initial loading
  if (isInitialLoading) {
    debugLog(`${LOG_PREFIX} ✏️ WRITE #${callId} - Skipped: isInitialLoading=true`);
    return false;
  }

  try {
    // Only compare mcpServers content, NOT lastUpdated (which changes every time)
    const serversContent = JSON.stringify(state.mcpServers);

    // Skip write if mcpServers hasn't actually changed
    if (serversContent === lastWrittenServersContent) {
      debugLog(`${LOG_PREFIX} ✏️ WRITE #${callId} - Skipped: mcpServers unchanged`);
      return false;
    }

    debugLog(`${LOG_PREFIX} ✏️ WRITE #${callId} - Writing ${state.mcpServers.length} servers to file...`);
    debugLog(`${LOG_PREFIX} ✏️ WRITE #${callId} - Content changed: ${lastWrittenServersContent?.slice(0, 50)}... → ${serversContent.slice(0, 50)}...`);
    const gateway = getGatewayClient();
    // Pass state directly - it already contains { mcpServers, lastUpdated }
    await gateway.writeMcpServersFile(state as unknown as Record<string, unknown>);
    lastWrittenServersContent = serversContent;
    lastWriteTimestamp = Date.now();
    debugLog(`${LOG_PREFIX} ✏️ WRITE #${callId} - Success at ${new Date(lastWriteTimestamp).toISOString()}`);
    return true;
  } catch (err) {
    console.debug(`${LOG_PREFIX} ✏️ WRITE #${callId} - Failed:`, err);
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
  debugLog(`${LOG_PREFIX} 🔄 useStoreSync initialized for window: ${windowType}`);

  const {
    mcpServers,
    // Note: mcpServerStatuses is intentionally not used here
    // Status info is transient and not persisted to file
  } = useAppStore();

  const lastSyncRef = useRef<number>(0);
  const hasLoadedFromFile = useRef(false);

  /**
   * Load state from Gateway file into store
   */
  const loadFromFile = useCallback(async () => {
    const stack = new Error().stack?.split('\n').slice(2, 5).join('\n') || 'no stack';
    debugLog(`${LOG_PREFIX} 📂 loadFromFile() called from ${windowType}`);
    debugLog(`${LOG_PREFIX} 📂 loadFromFile() stack:\n${stack}`);

    try {
      const fileState = await readServersFromFile();

      if (fileState) {
        // Update MCP servers only (statuses are not persisted)
        if (fileState.mcpServers && Array.isArray(fileState.mcpServers)) {
          // Compare with current store to avoid unnecessary updates that would trigger save loop
          const currentServers = useAppStore.getState().mcpServers;
          const currentContent = JSON.stringify(currentServers);
          const newContent = JSON.stringify(fileState.mcpServers);

          if (currentContent !== newContent) {
            debugLog(`${LOG_PREFIX} 📂 loadFromFile() updating store with ${fileState.mcpServers.length} servers (content changed)`);
            useAppStore.setState({ mcpServers: fileState.mcpServers });
          } else {
            debugLog(`${LOG_PREFIX} 📂 loadFromFile() skipping store update - content unchanged (${fileState.mcpServers.length} servers)`);
          }
        }
      }

      hasLoadedFromFile.current = true;
      debugLog(`${LOG_PREFIX} 📂 loadFromFile() complete, hasLoadedFromFile=true`);
      // Allow saves after initial load is complete
      setTimeout(() => {
        isInitialLoading = false;
        debugLog(`${LOG_PREFIX} 📂 isInitialLoading set to false`);
      }, 100);
    } catch (err) {
      console.debug(`${LOG_PREFIX} 📂 loadFromFile() failed:`, err);
      isInitialLoading = false;
    }
  }, [windowType]);

  /**
   * Handle WebSocket config change event
   */
  const handleConfigChanged = useCallback((data: McpConfigChangedData) => {
    // Ignore WebSocket events triggered by our own recent writes
    const timeSinceLastWrite = Date.now() - lastWriteTimestamp;
    debugLog(`${LOG_PREFIX} 🔔 WebSocket config change event received:`, {
      change_type: data.change_type,
      timeSinceLastWrite,
      willIgnore: timeSinceLastWrite < WRITE_GRACE_PERIOD_MS,
      windowType,
    });

    if (timeSinceLastWrite < WRITE_GRACE_PERIOD_MS) {
      debugLog(`${LOG_PREFIX} 🔔 Ignoring config change - within grace period (${timeSinceLastWrite}ms < ${WRITE_GRACE_PERIOD_MS}ms)`);
      return;
    }

    debugLog(`${LOG_PREFIX} 🔔 Config file changed via WebSocket: ${data.change_type}, scheduling reload...`);

    // Reload from file when config changes
    // Use a small delay to ensure the file write is complete
    setTimeout(() => {
      debugLog(`${LOG_PREFIX} 🔔 Executing delayed loadFromFile() after WebSocket event`);
      loadFromFile();
    }, 100);
  }, [loadFromFile, windowType]);

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
      const stack = new Error().stack?.split('\n').slice(2, 5).join('\n') || 'no stack';
      debugLog(`${LOG_PREFIX} 💾 saveAndEmit(${updated}) called from ${windowType}`);
      debugLog(`${LOG_PREFIX} 💾 saveAndEmit() stack:\n${stack}`);

      const timestamp = Date.now();
      const store = useAppStore.getState();

      // Save to file (returns false if content unchanged)
      // NOTE: Only mcpServers is persisted, not statuses
      const didWrite = await writeServersToFile({
        mcpServers: store.mcpServers,
        lastUpdated: timestamp,
      });

      debugLog(`${LOG_PREFIX} 💾 saveAndEmit() didWrite=${didWrite}`);

      // Only emit event if we actually wrote something
      if (didWrite) {
        lastSyncRef.current = timestamp;

        try {
          debugLog(`${LOG_PREFIX} 💾 Emitting ${STORE_SYNC_EVENT} event from ${windowType}`);
          await emit(STORE_SYNC_EVENT, {
            timestamp,
            updated,
            source: windowType,
          } as StoreSyncPayload);
        } catch (err) {
          console.debug(`${LOG_PREFIX} 💾 Failed to emit store sync event:`, err);
        }
      }
    },
    [windowType]
  );

  const serversTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Debounced save for mcpServers
   */
  const debouncedSaveServers = useCallback(() => {
    debugLog(`${LOG_PREFIX} ⏰ debouncedSaveServers() called, scheduling save in ${DEBOUNCE_SERVERS}ms`);
    if (serversTimeoutRef.current) {
      debugLog(`${LOG_PREFIX} ⏰ Clearing previous timeout`);
      clearTimeout(serversTimeoutRef.current);
    }
    serversTimeoutRef.current = setTimeout(() => {
      debugLog(`${LOG_PREFIX} ⏰ Debounce timeout fired, calling saveAndEmit("mcpServers")`);
      saveAndEmit("mcpServers");
    }, DEBOUNCE_SERVERS);
  }, [saveAndEmit]);

  // Load initial state from Gateway file on mount (always)
  useEffect(() => {
    debugLog(`${LOG_PREFIX} 🚀 Mount effect triggered for ${windowType}, calling loadFromFile()`);
    loadFromFile();
  }, [loadFromFile, windowType]);

  // Watch for mcpServers changes and save to file
  // NOTE: We intentionally do NOT sync mcpServerStatuses to file.
  // Status info is transient and frequently updated by WebSocket events.
  // Syncing it would create a loop: WS event -> status update -> file write -> WS event
  useEffect(() => {
    debugLog(`${LOG_PREFIX} 👀 mcpServers change detected in ${windowType}, hasLoadedFromFile=${hasLoadedFromFile.current}, servers count=${mcpServers.length}`);

    // Skip if we haven't loaded from file yet
    if (!hasLoadedFromFile.current) {
      debugLog(`${LOG_PREFIX} 👀 Skipping save - hasLoadedFromFile is false`);
      return;
    }

    debugLog(`${LOG_PREFIX} 👀 Triggering debouncedSaveServers()`);
    debouncedSaveServers();

    return () => {
      if (serversTimeoutRef.current) {
        debugLog(`${LOG_PREFIX} 👀 Cleanup: clearing serversTimeoutRef`);
        clearTimeout(serversTimeoutRef.current);
      }
    };
  }, [mcpServers, debouncedSaveServers, windowType]);

  // Listen for sync events from other windows (Tauri events as backup)
  useEffect(() => {
    debugLog(`${LOG_PREFIX} 👂 Setting up Tauri event listeners for ${windowType}`);
    const unlistenFns: UnlistenFn[] = [];

    const setupListeners = async () => {
      try {
        // Listen for store updates from other windows
        const unlistenSync = await listen<StoreSyncPayload>(STORE_SYNC_EVENT, (event) => {
          debugLog(`${LOG_PREFIX} 👂 Received ${STORE_SYNC_EVENT} event:`, {
            source: event.payload.source,
            updated: event.payload.updated,
            timestamp: event.payload.timestamp,
            myWindowType: windowType,
            lastSyncRef: lastSyncRef.current,
          });

          // Ignore events from self
          if (event.payload.source === windowType) {
            debugLog(`${LOG_PREFIX} 👂 Ignoring event from self (${windowType})`);
            return;
          }

          // Ignore old events
          if (event.payload.timestamp <= lastSyncRef.current) {
            debugLog(`${LOG_PREFIX} 👂 Ignoring old event (${event.payload.timestamp} <= ${lastSyncRef.current})`);
            return;
          }

          debugLog(`${LOG_PREFIX} 👂 Processing event, calling loadFromFile()`);
          lastSyncRef.current = event.payload.timestamp;

          // Reload store from file
          loadFromFile();
        });
        unlistenFns.push(unlistenSync);
        debugLog(`${LOG_PREFIX} 👂 Tauri event listener setup complete for ${windowType}`);
      } catch (err) {
        console.debug(`${LOG_PREFIX} 👂 Failed to set up store sync listeners:`, err);
      }
    };

    setupListeners();

    return () => {
      debugLog(`${LOG_PREFIX} 👂 Cleaning up Tauri event listeners for ${windowType}`);
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
  debugLog(`${LOG_PREFIX} 🖥️ useMainWindowStoreSync() called`);
  return useStoreSync("main");
}

/**
 * Hook specifically for the tray window
 * Listens for store changes from the main window
 */
export function useTrayWindowStoreSync() {
  debugLog(`${LOG_PREFIX} 📱 useTrayWindowStoreSync() called`);
  return useStoreSync("tray");
}

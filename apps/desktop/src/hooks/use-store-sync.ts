import { useEffect, useCallback, useRef } from "react";
import { emit, listen, UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "@/stores";
import type { McpServerInstance, McpServerStatusInfo } from "@/types";

/**
 * Event types for cross-window store synchronization
 */
const STORE_SYNC_EVENT = "store-sync-update";

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
 */
interface McpServersFileState {
  mcpServers: McpServerInstance[];
  mcpServerStatuses: Record<string, McpServerStatusInfo>;
  lastUpdated: number;
}

/**
 * Read MCP servers state from file
 */
async function readServersFromFile(): Promise<McpServersFileState | null> {
  try {
    const content = await invoke<string | null>("read_mcp_servers_file");
    if (!content) return null;
    return JSON.parse(content);
  } catch (err) {
    console.debug("Failed to read servers file:", err);
    return null;
  }
}

/**
 * Write MCP servers state to file
 */
async function writeServersToFile(state: McpServersFileState): Promise<void> {
  try {
    const content = JSON.stringify(state, null, 2);
    await invoke("write_mcp_servers_file", { content });
  } catch (err) {
    console.debug("Failed to write servers file:", err);
  }
}

/**
 * Hook to synchronize Zustand store across different Tauri windows
 * using file-based persistence (~/.browsemcp/browse_mcp_servers.json)
 *
 * This hook:
 * 1. Persists MCP servers state to a JSON file
 * 2. Emits events when the store changes
 * 3. Listens for events from other windows
 * 4. Reloads store data from file when notified
 */
export function useStoreSync(windowType: "main" | "tray" = "main") {
  const {
    mcpServers,
    mcpServerStatuses,
  } = useAppStore();

  const lastSyncRef = useRef<number>(0);
  const isInitialMount = useRef(true);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Save current state to file and emit update event
   */
  const saveAndEmit = useCallback(
    async (updated: StoreSyncPayload["updated"] = "all") => {
      const timestamp = Date.now();
      lastSyncRef.current = timestamp;

      const store = useAppStore.getState();

      // Save to file
      await writeServersToFile({
        mcpServers: store.mcpServers,
        mcpServerStatuses: store.mcpServerStatuses,
        lastUpdated: timestamp,
      });

      // Emit event to other windows
      try {
        await emit(STORE_SYNC_EVENT, {
          timestamp,
          updated,
          source: windowType,
        } as StoreSyncPayload);
      } catch (err) {
        console.debug("Failed to emit store sync event:", err);
      }
    },
    [windowType]
  );

  /**
   * Reload store data from file
   */
  const reloadFromFile = useCallback(async () => {
    try {
      const fileState = await readServersFromFile();
      if (!fileState) return;

      const store = useAppStore.getState();

      // Update MCP servers if changed
      if (fileState.mcpServers) {
        const currentJson = JSON.stringify(store.mcpServers);
        const newJson = JSON.stringify(fileState.mcpServers);

        if (currentJson !== newJson) {
          useAppStore.setState({ mcpServers: fileState.mcpServers });
        }
      }

      // Update MCP server statuses if changed
      if (fileState.mcpServerStatuses) {
        const currentJson = JSON.stringify(store.mcpServerStatuses);
        const newJson = JSON.stringify(fileState.mcpServerStatuses);

        if (currentJson !== newJson) {
          useAppStore.setState({ mcpServerStatuses: fileState.mcpServerStatuses });
        }
      }
    } catch (err) {
      console.debug("Failed to reload from file:", err);
    }
  }, []);

  /**
   * Debounced save function
   */
  const debouncedSave = useCallback(
    (updated: StoreSyncPayload["updated"]) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        saveAndEmit(updated);
      }, 200);
    },
    [saveAndEmit]
  );

  // Watch for store changes and save
  useEffect(() => {
    // Skip initial mount to avoid unnecessary sync
    if (isInitialMount.current) {
      isInitialMount.current = false;
      // But do load initial state from file for tray window
      if (windowType === "tray") {
        reloadFromFile();
      }
      return;
    }

    debouncedSave("mcpServers");

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [mcpServers, debouncedSave, windowType, reloadFromFile]);

  // Watch for status changes
  useEffect(() => {
    if (isInitialMount.current) return;

    debouncedSave("mcpServerStatuses");
  }, [mcpServerStatuses, debouncedSave]);

  // Listen for sync events from other windows
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
          reloadFromFile();
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
  }, [windowType, reloadFromFile]);

  // Load initial state from file on mount
  useEffect(() => {
    // For main window, only load if mcpServers is empty (first launch)
    // For tray window, always load to get latest state
    const loadInitial = async () => {
      const fileState = await readServersFromFile();
      if (fileState) {
        const store = useAppStore.getState();

        if (windowType === "tray" || store.mcpServers.length === 0) {
          if (fileState.mcpServers) {
            useAppStore.setState({ mcpServers: fileState.mcpServers });
          }
          if (fileState.mcpServerStatuses) {
            useAppStore.setState({ mcpServerStatuses: fileState.mcpServerStatuses });
          }
        }
      }
    };

    loadInitial();
  }, [windowType]);

  return {
    saveAndEmit,
    reloadFromFile,
  };
}

/**
 * Hook specifically for the main window
 * Automatically syncs store changes to file and other windows
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

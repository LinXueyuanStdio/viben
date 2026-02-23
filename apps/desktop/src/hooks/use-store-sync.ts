import { useEffect, useCallback, useRef } from "react";
import { emit, listen, UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "@/stores";
import type { McpServerInstance, McpServerStatusInfo } from "@/types";

/**
 * Event types for cross-window store synchronization
 */
const STORE_SYNC_EVENT = "store-sync-update";

/** Debounce time for mcpServers changes (more important, shorter delay) */
const DEBOUNCE_SERVERS = 300;
/** Debounce time for mcpServerStatuses changes (less critical, longer delay) */
const DEBOUNCE_STATUSES = 1000;

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

/** Cache of last written content to avoid unnecessary writes */
let lastWrittenContent: string | null = null;

/**
 * Read MCP servers state from file
 */
async function readServersFromFile(): Promise<McpServersFileState | null> {
  try {
    const content = await invoke<string | null>("read_mcp_servers_file");
    if (!content) return null;
    // Update cache when reading
    lastWrittenContent = content;
    return JSON.parse(content);
  } catch (err) {
    console.debug("Failed to read servers file:", err);
    return null;
  }
}

/**
 * Write MCP servers state to file (with content comparison)
 * Returns true if write was performed, false if skipped
 */
async function writeServersToFile(state: McpServersFileState): Promise<boolean> {
  try {
    const content = JSON.stringify(state, null, 2);

    // Skip write if content hasn't changed
    if (content === lastWrittenContent) {
      return false;
    }

    await invoke("write_mcp_servers_file", { content });
    lastWrittenContent = content;
    return true;
  } catch (err) {
    console.debug("Failed to write servers file:", err);
    return false;
  }
}

/**
 * Hook to synchronize Zustand store across different Tauri windows
 * using file-based persistence (~/.viben/viben_servers.json)
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

  // Watch for mcpServers changes
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

    debouncedSaveServers();

    return () => {
      if (serversTimeoutRef.current) {
        clearTimeout(serversTimeoutRef.current);
      }
    };
  }, [mcpServers, debouncedSaveServers, windowType, reloadFromFile]);

  // Watch for mcpServerStatuses changes (with longer debounce)
  useEffect(() => {
    if (isInitialMount.current) return;

    debouncedSaveStatuses();

    return () => {
      if (statusesTimeoutRef.current) {
        clearTimeout(statusesTimeoutRef.current);
      }
    };
  }, [mcpServerStatuses, debouncedSaveStatuses]);

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

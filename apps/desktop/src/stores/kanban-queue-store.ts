import { create, type StoreApi, type UseBoundStore } from "zustand";
import { persist } from "zustand/middleware";
import { getGatewayUrl } from "@/lib/gateway/config";
import { useMemo, useSyncExternalStore, useCallback, useRef } from "react";
import i18n from "@/i18n";

/**
 * Gateway Queue Status response type
 */
interface GatewayQueueStatus {
  pending_count: number;
  running_count: number;
  max_concurrency: number;
  tasks?: Array<{
    id: string;
    status: string;
    agent_id: string;
    created_at: number;
    position?: number;
  }>;
}

/**
 * Gateway Queue Config response type
 */
interface GatewayQueueConfig {
  max_concurrency: number;
  default_max_retries: number;
  persist_debounce_ms: number;
  shutdown_timeout_ms: number;
}

/**
 * Batch enqueue response type
 */
interface BatchEnqueueResponse {
  success: boolean;
  queued: number;
  failed: string[];
  error?: string;
}

/**
 * Kanban queue settings and archived tasks management store
 * Persisted per workspace using localStorage
 */

interface KanbanQueueState {
  // Queue settings (local)
  maxParallelTasks: number; // Default 3, range 1-10

  // Gateway queue status (fetched from API)
  gatewayQueueStatus: GatewayQueueStatus | null;
  isLoadingGatewayStatus: boolean;
  gatewayStatusError: string | null;

  // Archived tasks
  showArchived: boolean;
  archivedTaskIds: string[];

  // Actions - Queue settings (local)
  setMaxParallelTasks: (value: number) => void;

  // Actions - Gateway Queue API
  fetchGatewayQueueStatus: () => Promise<void>;
  updateGatewayMaxConcurrency: (value: number) => Promise<void>;
  queueAllBacklogTasks: (taskIds: string[]) => Promise<BatchEnqueueResponse>;

  // Actions - Archived tasks
  toggleShowArchived: () => void;
  setShowArchived: (show: boolean) => void;
  archiveTask: (taskId: string) => void;
  unarchiveTask: (taskId: string) => void;
  archiveAllDone: (taskIds: string[]) => void;
  clearArchivedTasks: () => void;
  isTaskArchived: (taskId: string) => boolean;

  // Getters
  getArchivedCount: () => number;
}

// ==========================================
// Workspace-Isolated Store Factory
// ==========================================

/**
 * Cache for workspace-specific stores
 * Key: workspace path (or 'global' for fallback)
 */
const workspaceStoreCache = new Map<string, UseBoundStore<StoreApi<KanbanQueueState>>>();

/**
 * Get storage key for a workspace
 */
function getWorkspaceStorageKey(workspacePath: string | undefined): string {
  if (!workspacePath) {
    return "kanban-queue-storage-global";
  }
  // Create a safe storage key from workspace path
  const safeKey = workspacePath.replace(/[^a-zA-Z0-9]/g, "_").slice(-50);
  return `kanban-queue-storage-${safeKey}`;
}

/**
 * Create a workspace-specific store
 */
function createWorkspaceQueueStore(workspacePath: string | undefined): UseBoundStore<StoreApi<KanbanQueueState>> {
  const storageKey = getWorkspaceStorageKey(workspacePath);

  return create<KanbanQueueState>()(
    persist(
      (set, get) => ({
        // Initial state
        maxParallelTasks: 3,
        gatewayQueueStatus: null,
        isLoadingGatewayStatus: false,
        gatewayStatusError: null,
        showArchived: false,
        archivedTaskIds: [],

        // Queue settings (local)
        setMaxParallelTasks: (value) => {
          // Validate range 1-10
          const clampedValue = Math.max(1, Math.min(10, value));
          set({ maxParallelTasks: clampedValue });
        },

        // Gateway Queue API
        fetchGatewayQueueStatus: async () => {
          set({ isLoadingGatewayStatus: true, gatewayStatusError: null });
          try {
            const gatewayUrl = getGatewayUrl();
            const response = await fetch(`${gatewayUrl}/api/queue/status`);

            if (!response.ok) {
              throw new Error(i18n.t("errors.kanbanQueue.fetchStatusFailed", { defaultValue: "Failed to fetch queue status: {{status}}", status: response.status }));
            }

            const data: GatewayQueueStatus = await response.json();
            set({
              gatewayQueueStatus: data,
              isLoadingGatewayStatus: false,
              // Sync local maxParallelTasks with Gateway max_concurrency
              maxParallelTasks: data.max_concurrency,
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : i18n.t("errors.kanbanQueue.fetchStatusFailed", "Failed to fetch queue status");
            set({
              gatewayStatusError: message,
              isLoadingGatewayStatus: false,
            });
            console.error("[KanbanQueueStore] Failed to fetch gateway queue status:", error);
          }
        },

        updateGatewayMaxConcurrency: async (value) => {
          const clampedValue = Math.max(1, Math.min(10, value));

          try {
            const gatewayUrl = getGatewayUrl();
            const response = await fetch(`${gatewayUrl}/api/queue/config`, {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ max_concurrency: clampedValue }),
            });

            if (!response.ok) {
              throw new Error(i18n.t("errors.kanbanQueue.updateConfigFailed", { defaultValue: "Failed to update queue config: {{status}}", status: response.status }));
            }

            const config: GatewayQueueConfig = await response.json();

            // Update both local and gateway status
            set({
              maxParallelTasks: config.max_concurrency,
              gatewayQueueStatus: get().gatewayQueueStatus
                ? { ...get().gatewayQueueStatus!, max_concurrency: config.max_concurrency }
                : null,
            });

            // Refresh full status
            await get().fetchGatewayQueueStatus();
          } catch (error) {
            console.error("[KanbanQueueStore] Failed to update gateway max concurrency:", error);
            // Still update local value for UI feedback
            set({ maxParallelTasks: clampedValue });
            throw error;
          }
        },

        queueAllBacklogTasks: async (taskIds) => {
          try {
            const gatewayUrl = getGatewayUrl();
            const response = await fetch(`${gatewayUrl}/api/queue/enqueue-batch`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ task_ids: taskIds }),
            });

            if (!response.ok) {
              throw new Error(i18n.t("errors.kanbanQueue.batchEnqueueFailed", { defaultValue: "Failed to batch enqueue: {{status}}", status: response.status }));
            }

            const result: BatchEnqueueResponse = await response.json();

            // Refresh queue status after batch operation
            await get().fetchGatewayQueueStatus();

            return result;
          } catch (error) {
            console.error("[KanbanQueueStore] Failed to batch enqueue tasks:", error);
            throw error;
          }
        },

        // Archived tasks
        toggleShowArchived: () =>
          set((state) => ({ showArchived: !state.showArchived })),

        setShowArchived: (show) => set({ showArchived: show }),

        archiveTask: (taskId) =>
          set((state) => {
            if (state.archivedTaskIds.includes(taskId)) {
              return state;
            }
            return {
              archivedTaskIds: [...state.archivedTaskIds, taskId],
            };
          }),

        unarchiveTask: (taskId) =>
          set((state) => ({
            archivedTaskIds: state.archivedTaskIds.filter((id) => id !== taskId),
          })),

        archiveAllDone: (taskIds) =>
          set((state) => {
            const newIds = taskIds.filter(
              (id) => !state.archivedTaskIds.includes(id)
            );
            return {
              archivedTaskIds: [...state.archivedTaskIds, ...newIds],
            };
          }),

        clearArchivedTasks: () => set({ archivedTaskIds: [] }),

        isTaskArchived: (taskId) => get().archivedTaskIds.includes(taskId),

        // Getters
        getArchivedCount: () => get().archivedTaskIds.length,
      }),
      {
        name: storageKey,
        partialize: (state) => ({
          maxParallelTasks: state.maxParallelTasks,
          showArchived: state.showArchived,
          archivedTaskIds: state.archivedTaskIds,
        }),
      }
    )
  );
}

/**
 * Get or create a workspace-specific store
 */
function getWorkspaceStore(workspacePath: string | undefined): UseBoundStore<StoreApi<KanbanQueueState>> {
  const cacheKey = workspacePath ?? "global";

  let store = workspaceStoreCache.get(cacheKey);
  if (!store) {
    store = createWorkspaceQueueStore(workspacePath);
    workspaceStoreCache.set(cacheKey, store);
    console.log(`[KanbanQueueStore] Created store for workspace: ${cacheKey}`);
  }

  return store;
}

/**
 * Global fallback store (backwards compatibility)
 * Use useWorkspaceKanbanQueue(workspacePath) for workspace-specific access
 */
export const useKanbanQueueStore = getWorkspaceStore(undefined);

/**
 * Hook to get queue store for a specific workspace
 * Uses a separate storage key per workspace
 *
 * @param workspacePath - The workspace path, or undefined for global fallback
 */
export function useWorkspaceKanbanQueue(workspacePath: string | undefined) {
  // Get or create the workspace-specific store
  const store = useMemo(() => getWorkspaceStore(workspacePath), [workspacePath]);

  // Subscribe to store changes
  const state = useSyncExternalStore(
    store.subscribe,
    store.getState,
    store.getState
  );

  // Memoize computed values
  const archivedCount = state.archivedTaskIds.length;
  const gatewayRunningCount = state.gatewayQueueStatus?.running_count ?? 0;
  const gatewayPendingCount = state.gatewayQueueStatus?.pending_count ?? 0;
  const gatewayMaxConcurrency = state.gatewayQueueStatus?.max_concurrency ?? state.maxParallelTasks;

  return {
    ...state,
    // Computed values
    archivedCount,
    // Gateway status shortcuts
    gatewayRunningCount,
    gatewayPendingCount,
    gatewayMaxConcurrency,
  };
}

/**
 * Hook that provides maxParallelTasks and a change listener for queue auto-promotion
 * Returns stable references for use in effects
 */
export function useWorkspaceQueueSettings(workspacePath: string | undefined) {
  const store = useMemo(() => getWorkspaceStore(workspacePath), [workspacePath]);

  // Subscribe to store changes
  const state = useSyncExternalStore(
    store.subscribe,
    store.getState,
    store.getState
  );

  // Track previous value for change detection
  const prevMaxParallelTasksRef = useRef(state.maxParallelTasks);

  // Return the current value and a way to detect changes
  return {
    maxParallelTasks: state.maxParallelTasks,
    archivedTaskIds: state.archivedTaskIds,
    setMaxParallelTasks: state.setMaxParallelTasks,
    // Helper to check if maxParallelTasks increased
    checkMaxParallelTasksIncreased: useCallback(() => {
      const current = store.getState().maxParallelTasks;
      const prev = prevMaxParallelTasksRef.current;
      prevMaxParallelTasksRef.current = current;
      return current > prev;
    }, [store]),
  };
}

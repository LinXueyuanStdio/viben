import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Kanban queue settings and archived tasks management store
 * Persisted per workspace using localStorage
 */

interface KanbanQueueState {
  // Queue settings
  maxParallelTasks: number; // Default 3, range 1-10

  // Archived tasks
  showArchived: boolean;
  archivedTaskIds: string[];

  // Actions - Queue settings
  setMaxParallelTasks: (value: number) => void;

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

export const useKanbanQueueStore = create<KanbanQueueState>()(
  persist(
    (set, get) => ({
      // Initial state
      maxParallelTasks: 3,
      showArchived: false,
      archivedTaskIds: [],

      // Queue settings
      setMaxParallelTasks: (value) => {
        // Validate range 1-10
        const clampedValue = Math.max(1, Math.min(10, value));
        set({ maxParallelTasks: clampedValue });
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
      name: "kanban-queue-storage",
      partialize: (state) => ({
        maxParallelTasks: state.maxParallelTasks,
        showArchived: state.showArchived,
        archivedTaskIds: state.archivedTaskIds,
      }),
    }
  )
);

/**
 * Hook to get queue store for a specific workspace
 * Uses a separate storage key per workspace
 */
export function useWorkspaceKanbanQueue(workspacePath: string | undefined) {
  // For now, use the global store
  // TODO: Implement per-workspace storage if needed
  const store = useKanbanQueueStore();

  return {
    ...store,
    // Computed values
    archivedCount: store.archivedTaskIds.length,
  };
}

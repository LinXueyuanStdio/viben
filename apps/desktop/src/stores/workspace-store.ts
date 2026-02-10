import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Workspace, WorkspaceAgent } from "@/types";

/**
 * Discovery task for a workspace - tracks auto-discovery progress
 */
export interface DiscoveryTask {
  workspaceId: string;
  status: "pending" | "running" | "completed" | "error";
  startedAt: number;
  completedAt?: number;
  error?: string;
  agents?: WorkspaceAgent[];
}

interface WorkspaceState {
  // Workspaces list
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  selectedAgentId: string | null;
  isLoading: boolean;
  error: string | null;

  // Discovery tasks - track auto-discovery for each workspace
  discoveryTasks: Record<string, DiscoveryTask>;

  // Actions - Workspace management
  setWorkspaces: (workspaces: Workspace[]) => void;
  addWorkspace: (workspace: Workspace) => void;
  removeWorkspace: (workspaceId: string) => void;
  setActiveWorkspace: (workspaceId: string | null) => void;
  updateWorkspaceAccessed: (workspaceId: string) => void;

  // Actions - Agent selection
  setSelectedAgentId: (agentId: string | null) => void;

  // Actions - Loading state
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Actions - Discovery tasks
  startDiscovery: (workspaceId: string) => void;
  completeDiscovery: (workspaceId: string, agents: WorkspaceAgent[]) => void;
  failDiscovery: (workspaceId: string, error: string) => void;
  clearDiscovery: (workspaceId: string) => void;

  // Getters
  getWorkspace: (workspaceId: string) => Workspace | undefined;
  getActiveWorkspace: () => Workspace | undefined;
  getDiscoveryTask: (workspaceId: string) => DiscoveryTask | undefined;
  hasRunningDiscovery: () => boolean;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      // Initial state
      workspaces: [],
      activeWorkspaceId: null,
      selectedAgentId: null,
      isLoading: false,
      error: null,
      discoveryTasks: {},

      // Workspace management
      setWorkspaces: (workspaces) => set({ workspaces }),

      addWorkspace: (workspace) =>
        set((state) => ({
          workspaces: [...state.workspaces, workspace],
        })),

      removeWorkspace: (workspaceId) =>
        set((state) => {
          const newWorkspaces = state.workspaces.filter(
            (w) => w.id !== workspaceId
          );
          // Clear active workspace if it was removed
          const activeId =
            state.activeWorkspaceId === workspaceId
              ? null
              : state.activeWorkspaceId;
          // Also remove discovery task
          const { [workspaceId]: _, ...remainingTasks } = state.discoveryTasks;
          return {
            workspaces: newWorkspaces,
            activeWorkspaceId: activeId,
            discoveryTasks: remainingTasks,
          };
        }),

      setActiveWorkspace: (workspaceId) =>
        set({
          activeWorkspaceId: workspaceId,
          selectedAgentId: null, // Clear agent selection when switching workspace
        }),

      updateWorkspaceAccessed: (workspaceId) =>
        set((state) => ({
          workspaces: state.workspaces.map((w) =>
            w.id === workspaceId
              ? { ...w, last_accessed: new Date().toISOString() }
              : w
          ),
        })),

      // Agent selection
      setSelectedAgentId: (agentId) => set({ selectedAgentId: agentId }),

      // Loading state
      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),

      // Discovery tasks
      startDiscovery: (workspaceId) =>
        set((state) => ({
          discoveryTasks: {
            ...state.discoveryTasks,
            [workspaceId]: {
              workspaceId,
              status: "running",
              startedAt: Date.now(),
            },
          },
        })),

      completeDiscovery: (workspaceId, agents) =>
        set((state) => ({
          discoveryTasks: {
            ...state.discoveryTasks,
            [workspaceId]: {
              ...state.discoveryTasks[workspaceId],
              status: "completed",
              completedAt: Date.now(),
              agents,
            },
          },
        })),

      failDiscovery: (workspaceId, error) =>
        set((state) => ({
          discoveryTasks: {
            ...state.discoveryTasks,
            [workspaceId]: {
              ...state.discoveryTasks[workspaceId],
              status: "error",
              completedAt: Date.now(),
              error,
            },
          },
        })),

      clearDiscovery: (workspaceId) =>
        set((state) => {
          const { [workspaceId]: _, ...remainingTasks } = state.discoveryTasks;
          return { discoveryTasks: remainingTasks };
        }),

      // Getters
      getWorkspace: (workspaceId) =>
        get().workspaces.find((w) => w.id === workspaceId),

      getActiveWorkspace: () => {
        const state = get();
        if (!state.activeWorkspaceId) return undefined;
        return state.workspaces.find((w) => w.id === state.activeWorkspaceId);
      },

      getDiscoveryTask: (workspaceId) => get().discoveryTasks[workspaceId],

      hasRunningDiscovery: () =>
        Object.values(get().discoveryTasks).some((t) => t.status === "running"),
    }),
    {
      name: "workspace-storage",
      partialize: (state) => ({
        // Persist workspaces and active workspace ID
        workspaces: state.workspaces,
        activeWorkspaceId: state.activeWorkspaceId,
        // Don't persist discovery tasks or loading state
      }),
    }
  )
);

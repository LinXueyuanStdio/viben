import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Workspace } from "@/types";

interface WorkspaceState {
  // Workspaces list
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  selectedAgentId: string | null;
  isLoading: boolean;
  error: string | null;

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

  // Getters
  getWorkspace: (workspaceId: string) => Workspace | undefined;
  getActiveWorkspace: () => Workspace | undefined;
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
          return {
            workspaces: newWorkspaces,
            activeWorkspaceId: activeId,
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

      // Getters
      getWorkspace: (workspaceId) =>
        get().workspaces.find((w) => w.id === workspaceId),

      getActiveWorkspace: () => {
        const state = get();
        if (!state.activeWorkspaceId) return undefined;
        return state.workspaces.find((w) => w.id === state.activeWorkspaceId);
      },
    }),
    {
      name: "workspace-storage",
      partialize: (state) => ({
        activeWorkspaceId: state.activeWorkspaceId,
        // Don't persist workspaces - load from backend
      }),
    }
  )
);

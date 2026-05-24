import { create } from "zustand";

const SIDEBAR_COLLAPSED_KEY = "sidebar-collapsed";

/**
 * Global UI state for dialogs, modals, and other UI elements
 * that need to be controlled from multiple places in the app.
 */
interface UiState {
  // Create Task Dialog (original modal version)
  isCreateTaskDialogOpen: boolean;
  openCreateTaskDialog: () => void;
  closeCreateTaskDialog: () => void;
  setCreateTaskDialogOpen: (open: boolean) => void;

  // Chat Popup (overlay version, triggered by button click or hover)
  isChatPopupOpen: boolean;
  openChatPopup: () => void;
  closeChatPopup: () => void;

  // Sidebar collapsed state
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

export const useUiStore = create<UiState>()((set) => ({
  // Create Task Dialog
  isCreateTaskDialogOpen: false,
  openCreateTaskDialog: () => set({ isCreateTaskDialogOpen: true }),
  closeCreateTaskDialog: () => set({ isCreateTaskDialogOpen: false }),
  setCreateTaskDialogOpen: (open) => set({ isCreateTaskDialogOpen: open }),

  // Chat Popup (overlay version)
  isChatPopupOpen: false,
  openChatPopup: () => set({ isChatPopupOpen: true }),
  closeChatPopup: () => set({ isChatPopupOpen: false }),

  // Sidebar collapsed state (initialized from localStorage)
  sidebarCollapsed: localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true",
  toggleSidebar: () =>
    set((state) => {
      const newValue = !state.sidebarCollapsed;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(newValue));
      return { sidebarCollapsed: newValue };
    }),
  setSidebarCollapsed: (collapsed) => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
    set({ sidebarCollapsed: collapsed });
  },
}));

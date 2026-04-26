import { create } from "zustand";

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
}));

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

  // Create Task Popup (overlay version, triggered by button click)
  isCreateTaskPopupOpen: boolean;
  openCreateTaskPopup: () => void;
  closeCreateTaskPopup: () => void;
}

export const useUiStore = create<UiState>()((set) => ({
  // Create Task Dialog
  isCreateTaskDialogOpen: false,
  openCreateTaskDialog: () => set({ isCreateTaskDialogOpen: true }),
  closeCreateTaskDialog: () => set({ isCreateTaskDialogOpen: false }),
  setCreateTaskDialogOpen: (open) => set({ isCreateTaskDialogOpen: open }),

  // Create Task Popup (overlay version)
  isCreateTaskPopupOpen: false,
  openCreateTaskPopup: () => set({ isCreateTaskPopupOpen: true }),
  closeCreateTaskPopup: () => set({ isCreateTaskPopupOpen: false }),
}));

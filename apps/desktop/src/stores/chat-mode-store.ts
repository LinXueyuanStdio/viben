/**
 * Chat Mode Store
 *
 * Zustand store for managing ChatApp display mode:
 * - full: Full screen mode, ChatApp occupies an independent column between sidebar and pages
 * - floating: Floating mode, displayed as a small button
 * - compact: Compact mode, floating in the bottom-left corner of pages area as a small card
 * - expanded: Expanded mode, floating in the bottom-left corner of pages area with full conversation interface
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ChatAppMode = "full" | "floating" | "compact" | "expanded";

interface ChatModeState {
  mode: ChatAppMode;
  setMode: (mode: ChatAppMode) => void;
  toggleMode: () => void; // Toggle between floating <-> expanded
}

export const useChatModeStore = create<ChatModeState>()(
  persist(
    (set, get) => ({
      mode: "expanded",
      setMode: (mode) => set({ mode }),
      toggleMode: () => {
        const current = get().mode;
        // floating -> expanded, expanded -> floating
        // full and compact do not participate in toggle
        if (current === "floating") set({ mode: "expanded" });
        else if (current === "expanded") set({ mode: "floating" });
      },
    }),
    {
      name: "viben-chat-mode",
    }
  )
);

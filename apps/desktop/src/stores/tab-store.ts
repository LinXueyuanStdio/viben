// apps/desktop/src/stores/tab-store.ts

/**
 * Tab Store - Global tab state management using Zustand
 *
 * Notion-like tab system supporting:
 * - Regular and pinned tabs
 * - Page history navigation (back/forward)
 * - Tab drag and drop reordering
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { IconData } from "@/components/ui/icon-picker";

// =============================================================================
// Types
// =============================================================================

/**
 * Tab types:
 * - page: Workspace page (from pages/ directory)
 * - chat: Chat session
 * - workspace: Generic workspace views (kanban, files, agents, etc.)
 * - settings: App settings
 * - web: External web URL (http/https)
 * - new-tab: Empty new tab
 */
export type TabType = "page" | "chat" | "workspace" | "settings" | "web" | "new-tab";

export interface PageTab {
  id: string;                       // Unique identifier
  type: TabType;                    // Tab type
  slug?: string;                    // Page/route identifier
  workspaceId?: string;             // Workspace this tab belongs to
  name: string;                     // Display name
  icon?: IconData;                  // Icon data (structured)
  pinned: boolean;                  // Whether the tab is pinned
  history: string[];                // Navigation history (URL list)
  historyIndex: number;             // Current position in history
  viewMode?: PageViewMode;          // View mode for page-type tabs (skill/page)
}

interface TabState {
  tabs: PageTab[];
  activeTabId: string | null;
}

/** Page view mode for page-type tabs */
export type PageViewMode = "skill" | "page";

interface TabActions {
  // Tab CRUD
  openTab: (tab: Omit<PageTab, "id" | "history" | "historyIndex">, url: string) => string;
  closeTab: (tabId: string) => void;
  closeOtherTabs: (tabId: string) => void;
  closeTabsToRight: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;

  // Tab properties
  updateTab: (tabId: string, updates: Partial<Omit<PageTab, "id">>) => void;
  pinTab: (tabId: string) => void;
  unpinTab: (tabId: string) => void;
  setViewMode: (tabId: string, mode: PageViewMode) => void;

  // Tab ordering
  moveTab: (fromIndex: number, toIndex: number) => void;

  // Navigation within tab
  navigate: (tabId: string, url: string) => void;
  goBack: (tabId: string) => void;
  goForward: (tabId: string) => void;
  canGoBack: (tabId: string) => boolean;
  canGoForward: (tabId: string) => boolean;
  getCurrentUrl: (tabId: string) => string | null;

  // Bulk operations
  closeAllTabs: () => void;
  restoreTab: (tab: PageTab) => void;
}

// =============================================================================
// Helpers
// =============================================================================

const generateTabId = () => `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

/**
 * Find the last index of a pinned tab in the array.
 * Returns -1 if no pinned tabs exist.
 */
function findLastPinnedIndex(tabs: PageTab[]): number {
  for (let i = tabs.length - 1; i >= 0; i--) {
    if (tabs[i].pinned) {
      return i;
    }
  }
  return -1;
}

// =============================================================================
// Store
// =============================================================================

export const useTabStore = create<TabState & TabActions>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeTabId: null,

      // =======================================================================
      // Tab CRUD
      // =======================================================================

      openTab: (tabData, url) => {
        const id = generateTabId();
        const newTab: PageTab = {
          ...tabData,
          id,
          history: [url],
          historyIndex: 0,
        };

        set((state) => {
          // New tabs are always added at the end (rightmost position)
          return {
            tabs: [...state.tabs, newTab],
            activeTabId: id,
          };
        });

        return id;
      },

      closeTab: (tabId) => {
        set((state) => {
          const tabIndex = state.tabs.findIndex((t) => t.id === tabId);
          if (tabIndex === -1) return state;

          const newTabs = state.tabs.filter((t) => t.id !== tabId);

          // Update active tab if needed
          let newActiveId = state.activeTabId;
          if (state.activeTabId === tabId) {
            if (newTabs.length === 0) {
              newActiveId = null;
            } else if (tabIndex >= newTabs.length) {
              newActiveId = newTabs[newTabs.length - 1].id;
            } else {
              newActiveId = newTabs[tabIndex].id;
            }
          }

          return {
            tabs: newTabs,
            activeTabId: newActiveId,
          };
        });
      },

      closeOtherTabs: (tabId) => {
        set((state) => {
          const tab = state.tabs.find((t) => t.id === tabId);
          if (!tab) return state;

          // Keep pinned tabs and the specified tab
          const newTabs = state.tabs.filter((t) => t.pinned || t.id === tabId);

          return {
            tabs: newTabs,
            activeTabId: tabId,
          };
        });
      },

      closeTabsToRight: (tabId) => {
        set((state) => {
          const tabIndex = state.tabs.findIndex((t) => t.id === tabId);
          if (tabIndex === -1) return state;

          // Keep tabs up to and including the specified tab, plus pinned tabs after
          const newTabs = state.tabs.filter((t, i) =>
            i <= tabIndex || t.pinned
          );

          // If active tab was closed, switch to specified tab
          const activeStillExists = newTabs.some((t) => t.id === state.activeTabId);

          return {
            tabs: newTabs,
            activeTabId: activeStillExists ? state.activeTabId : tabId,
          };
        });
      },

      setActiveTab: (tabId) => {
        set({ activeTabId: tabId });
      },

      // =======================================================================
      // Tab properties
      // =======================================================================

      updateTab: (tabId, updates) => {
        set((state) => ({
          tabs: state.tabs.map((t) =>
            t.id === tabId ? { ...t, ...updates } : t
          ),
        }));
      },

      pinTab: (tabId) => {
        set((state) => {
          const tabIndex = state.tabs.findIndex((t) => t.id === tabId);
          if (tabIndex === -1) return state;

          const tab = state.tabs[tabIndex];
          if (tab.pinned) return state;

          // Move tab to end of pinned section
          const newTabs = [...state.tabs];
          newTabs.splice(tabIndex, 1);

          const lastPinnedIndex = findLastPinnedIndex(newTabs);
          const insertIndex = lastPinnedIndex + 1;

          newTabs.splice(insertIndex, 0, { ...tab, pinned: true });

          return { tabs: newTabs };
        });
      },

      unpinTab: (tabId) => {
        set((state) => {
          const tabIndex = state.tabs.findIndex((t) => t.id === tabId);
          if (tabIndex === -1) return state;

          const tab = state.tabs[tabIndex];
          if (!tab.pinned) return state;

          // Move tab to start of unpinned section (after last pinned)
          const newTabs = [...state.tabs];
          newTabs.splice(tabIndex, 1);

          // After removing, find new last pinned index
          const lastPinnedIndex = findLastPinnedIndex(newTabs);
          const insertIndex = lastPinnedIndex + 1;

          newTabs.splice(insertIndex, 0, { ...tab, pinned: false });

          return { tabs: newTabs };
        });
      },

      setViewMode: (tabId, mode) => {
        set((state) => ({
          tabs: state.tabs.map((t) =>
            t.id === tabId ? { ...t, viewMode: mode } : t
          ),
        }));
      },

      // =======================================================================
      // Tab ordering
      // =======================================================================

      moveTab: (fromIndex, toIndex) => {
        set((state) => {
          if (fromIndex === toIndex) return state;
          if (fromIndex < 0 || fromIndex >= state.tabs.length) return state;
          if (toIndex < 0 || toIndex >= state.tabs.length) return state;

          const newTabs = [...state.tabs];
          const [movedTab] = newTabs.splice(fromIndex, 1);
          newTabs.splice(toIndex, 0, movedTab);

          return { tabs: newTabs };
        });
      },

      // =======================================================================
      // Navigation within tab
      // =======================================================================

      navigate: (tabId, url) => {
        set((state) => ({
          tabs: state.tabs.map((t) => {
            if (t.id !== tabId) return t;

            // Truncate forward history and add new URL
            const newHistory = [...t.history.slice(0, t.historyIndex + 1), url];
            return {
              ...t,
              history: newHistory,
              historyIndex: newHistory.length - 1,
            };
          }),
        }));
      },

      goBack: (tabId) => {
        set((state) => ({
          tabs: state.tabs.map((t) => {
            if (t.id !== tabId || t.historyIndex <= 0) return t;
            return {
              ...t,
              historyIndex: t.historyIndex - 1,
            };
          }),
        }));
      },

      goForward: (tabId) => {
        set((state) => ({
          tabs: state.tabs.map((t) => {
            if (t.id !== tabId || t.historyIndex >= t.history.length - 1) return t;
            return {
              ...t,
              historyIndex: t.historyIndex + 1,
            };
          }),
        }));
      },

      canGoBack: (tabId) => {
        const tab = get().tabs.find((t) => t.id === tabId);
        return tab ? tab.historyIndex > 0 : false;
      },

      canGoForward: (tabId) => {
        const tab = get().tabs.find((t) => t.id === tabId);
        return tab ? tab.historyIndex < tab.history.length - 1 : false;
      },

      getCurrentUrl: (tabId) => {
        const tab = get().tabs.find((t) => t.id === tabId);
        return tab ? tab.history[tab.historyIndex] ?? null : null;
      },

      // =======================================================================
      // Bulk operations
      // =======================================================================

      closeAllTabs: () => {
        set((state) => ({
          tabs: state.tabs.filter((t) => t.pinned),
          activeTabId: state.tabs.find((t) => t.pinned)?.id ?? null,
        }));
      },

      restoreTab: (tab) => {
        set((state) => ({
          tabs: [...state.tabs, tab],
          activeTabId: tab.id,
        }));
      },
    }),
    {
      name: "viben-tab-store",
      // Only persist tabs and activeTabId
      partialize: (state) => ({
        tabs: state.tabs,
        activeTabId: state.activeTabId,
      }),
    }
  )
);

// =============================================================================
// Selectors
// =============================================================================

export const selectActiveTab = (state: TabState) =>
  state.tabs.find((t) => t.id === state.activeTabId) ?? null;

export const selectPinnedTabs = (state: TabState) =>
  state.tabs.filter((t) => t.pinned);

export const selectUnpinnedTabs = (state: TabState) =>
  state.tabs.filter((t) => !t.pinned);

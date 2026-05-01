import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { IconData } from "@/components/ui/icon-picker";
import { createStackForLocation } from "@/navigation/breadcrumb-stack";
import {
  createTabNavigationState,
  popTo as popNavigationState,
  pushPage as pushNavigationState,
  replaceLocation as replaceNavigationState,
  resetStack as resetNavigationState,
} from "@/navigation/tab-navigation";
import { locationToUrl, type DesktopLocation, urlToLocation } from "@/navigation/location";
import type {
  BreadcrumbStackItem,
  PushPageOptions,
  TabNavigationState,
} from "@/navigation/view-target";

export type TabType =
  | "page"
  | "chat"
  | "workspace"
  | "settings"
  | "web"
  | "new-tab";

export type PageViewMode = "skill" | "page";

export interface PageTab {
  id: string;
  type: TabType;
  slug?: string;
  workspaceId?: string;
  name: string;
  icon?: IconData;
  pinned: boolean;
  history: string[];
  historyIndex: number;
  navigationHistory: TabNavigationState[];
  viewMode?: PageViewMode;
}

interface TabState {
  tabs: PageTab[];
  activeTabId: string | null;
}

interface OpenTabInput extends Omit<PageTab, "id" | "history" | "historyIndex" | "navigationHistory"> {
  navigationState?: TabNavigationState;
}

interface TabActions {
  openTab: (tab: OpenTabInput, url?: string) => string;
  closeTab: (tabId: string) => void;
  closeOtherTabs: (tabId: string) => void;
  closeTabsToRight: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateTab: (tabId: string, updates: Partial<Omit<PageTab, "id">>) => void;
  pinTab: (tabId: string) => void;
  unpinTab: (tabId: string) => void;
  setViewMode: (tabId: string, mode: PageViewMode) => void;
  moveTab: (fromIndex: number, toIndex: number) => void;
  navigate: (tabId: string, url: string) => void;
  navigateToLocation: (tabId: string, location: DesktopLocation, patch?: Partial<TabNavigationState>) => void;
  replaceLocation: (tabId: string, location: DesktopLocation, patch?: Partial<TabNavigationState>) => void;
  pushPage: (
    tabId: string,
    item: BreadcrumbStackItem,
    location: DesktopLocation,
    options?: PushPageOptions
  ) => void;
  popTo: (tabId: string, index: number) => void;
  resetStack: (tabId: string, next: TabNavigationState) => void;
  goBack: (tabId: string) => void;
  goForward: (tabId: string) => void;
  canGoBack: (tabId: string) => boolean;
  canGoForward: (tabId: string) => boolean;
  getCurrentUrl: (tabId: string) => string | null;
  getCurrentNavigationState: (tabId: string) => TabNavigationState | null;
  closeAllTabs: () => void;
  restoreTab: (tab: PageTab) => void;
}

const generateTabId = () =>
  `tab-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

function findLastPinnedIndex(tabs: PageTab[]): number {
  for (let index = tabs.length - 1; index >= 0; index -= 1) {
    if (tabs[index].pinned) {
      return index;
    }
  }
  return -1;
}

function buildFallbackLocation(url: string): DesktopLocation {
  if (url.startsWith("/documents")) {
    return { kind: "documents" };
  }

  if (url.startsWith("/devices/pair")) {
    return { kind: "device-pair" };
  }

  if (url.startsWith("/settings")) {
    const section = url.split("/")[2];
    return { kind: "settings", section };
  }

  return { kind: "documents" };
}

function buildStateFromUrl(url?: string): TabNavigationState {
  const location = (url ? urlToLocation(url) : null) ?? buildFallbackLocation(url ?? "/documents");
  return createTabNavigationState(location, createStackForLocation(location));
}

function stateToUrl(state: TabNavigationState): string {
  return locationToUrl(state.location);
}

function syncLegacyHistory(tab: PageTab): PageTab {
  const history = tab.navigationHistory.map(stateToUrl);
  const historyIndex = Math.min(
    Math.max(tab.historyIndex, 0),
    Math.max(history.length - 1, 0)
  );

  return {
    ...tab,
    history,
    historyIndex,
  };
}

function coerceNavigationHistory(tab: PageTab): PageTab {
  const navigationHistory =
    tab.navigationHistory?.length
      ? tab.navigationHistory
      : tab.history?.length
        ? tab.history.map((url) => buildStateFromUrl(url))
        : [buildStateFromUrl("/documents")];

  return syncLegacyHistory({
    ...tab,
    navigationHistory,
    historyIndex: Math.min(
      tab.historyIndex ?? navigationHistory.length - 1,
      navigationHistory.length - 1
    ),
  });
}

function updateTabHistory(
  tab: PageTab,
  updater: (tab: PageTab) => PageTab
): PageTab {
  return syncLegacyHistory(updater(coerceNavigationHistory(tab)));
}

export const useTabStore = create<TabState & TabActions>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeTabId: null,

      openTab: (tabData, url) => {
        const id = generateTabId();
        const navigationState =
          tabData.navigationState ?? buildStateFromUrl(url);

        const newTab = syncLegacyHistory({
          ...tabData,
          id,
          navigationHistory: [navigationState],
          history: [],
          historyIndex: 0,
        });

        set((state) => ({
          tabs: [...state.tabs, newTab],
          activeTabId: id,
        }));

        return id;
      },

      closeTab: (tabId) => {
        set((state) => {
          const tabIndex = state.tabs.findIndex((tab) => tab.id === tabId);
          if (tabIndex === -1) return state;

          const tabs = state.tabs.filter((tab) => tab.id !== tabId);
          let activeTabId = state.activeTabId;

          if (state.activeTabId === tabId) {
            if (tabs.length === 0) {
              activeTabId = null;
            } else if (tabIndex >= tabs.length) {
              activeTabId = tabs[tabs.length - 1].id;
            } else {
              activeTabId = tabs[tabIndex].id;
            }
          }

          return { tabs, activeTabId };
        });
      },

      closeOtherTabs: (tabId) => {
        set((state) => ({
          tabs: state.tabs.filter((tab) => tab.pinned || tab.id === tabId),
          activeTabId: tabId,
        }));
      },

      closeTabsToRight: (tabId) => {
        set((state) => {
          const tabIndex = state.tabs.findIndex((tab) => tab.id === tabId);
          if (tabIndex === -1) return state;

          const tabs = state.tabs.filter((tab, index) => index <= tabIndex || tab.pinned);
          const activeTabId = tabs.some((tab) => tab.id === state.activeTabId)
            ? state.activeTabId
            : tabId;

          return { tabs, activeTabId };
        });
      },

      setActiveTab: (tabId) => {
        set({ activeTabId: tabId });
      },

      updateTab: (tabId, updates) => {
        set((state) => ({
          tabs: state.tabs.map((tab) =>
            tab.id === tabId ? syncLegacyHistory({ ...coerceNavigationHistory(tab), ...updates }) : tab
          ),
        }));
      },

      pinTab: (tabId) => {
        set((state) => {
          const tabIndex = state.tabs.findIndex((tab) => tab.id === tabId);
          if (tabIndex === -1) return state;

          const tab = state.tabs[tabIndex];
          if (tab.pinned) return state;

          const tabs = [...state.tabs];
          tabs.splice(tabIndex, 1);

          const insertIndex = findLastPinnedIndex(tabs) + 1;
          tabs.splice(insertIndex, 0, { ...tab, pinned: true });

          return { tabs };
        });
      },

      unpinTab: (tabId) => {
        set((state) => {
          const tabIndex = state.tabs.findIndex((tab) => tab.id === tabId);
          if (tabIndex === -1) return state;

          const tab = state.tabs[tabIndex];
          if (!tab.pinned) return state;

          const tabs = [...state.tabs];
          tabs.splice(tabIndex, 1);

          const insertIndex = findLastPinnedIndex(tabs) + 1;
          tabs.splice(insertIndex, 0, { ...tab, pinned: false });

          return { tabs };
        });
      },

      setViewMode: (tabId, mode) => {
        set((state) => ({
          tabs: state.tabs.map((tab) =>
            tab.id === tabId ? { ...tab, viewMode: mode } : tab
          ),
        }));
      },

      moveTab: (fromIndex, toIndex) => {
        set((state) => {
          if (
            fromIndex === toIndex ||
            fromIndex < 0 ||
            toIndex < 0 ||
            fromIndex >= state.tabs.length ||
            toIndex >= state.tabs.length
          ) {
            return state;
          }

          const tabs = [...state.tabs];
          const [moved] = tabs.splice(fromIndex, 1);
          tabs.splice(toIndex, 0, moved);
          return { tabs };
        });
      },

      navigate: (tabId, url) => {
        set((state) => ({
          tabs: state.tabs.map((tab) => {
            if (tab.id !== tabId) return tab;

            return updateTabHistory(tab, (current) => {
              const baseHistory = current.navigationHistory.slice(0, current.historyIndex + 1);
              const nextState = buildStateFromUrl(url);
              return {
                ...current,
                navigationHistory: [...baseHistory, nextState],
                historyIndex: baseHistory.length,
              };
            });
          }),
        }));
      },

      navigateToLocation: (tabId, location, patch) => {
        set((state) => ({
          tabs: state.tabs.map((tab) => {
            if (tab.id !== tabId) return tab;

            return updateTabHistory(tab, (current) => {
              const nextState = createTabNavigationState(
                location,
                patch?.breadcrumbStack ?? createStackForLocation(location),
                patch
              );
              const baseHistory = current.navigationHistory.slice(0, current.historyIndex + 1);

              return {
                ...current,
                navigationHistory: [...baseHistory, nextState],
                historyIndex: baseHistory.length,
              };
            });
          }),
        }));
      },

      replaceLocation: (tabId, location, patch) => {
        set((state) => ({
          tabs: state.tabs.map((tab) => {
            if (tab.id !== tabId) return tab;

            return updateTabHistory(tab, (current) => {
              const currentState =
                current.navigationHistory[current.historyIndex] ?? buildStateFromUrl();
              const nextState = replaceNavigationState(currentState, location, patch);
              const navigationHistory = [...current.navigationHistory];
              navigationHistory[current.historyIndex] = nextState;

              return {
                ...current,
                navigationHistory,
              };
            });
          }),
        }));
      },

      pushPage: (tabId, item, location, options) => {
        set((state) => ({
          tabs: state.tabs.map((tab) => {
            if (tab.id !== tabId) return tab;

            return updateTabHistory(tab, (current) => {
              const currentState =
                current.navigationHistory[current.historyIndex] ?? buildStateFromUrl();
              const nextState = pushNavigationState(currentState, item, location, options);
              const baseHistory = current.navigationHistory.slice(0, current.historyIndex + 1);

              return {
                ...current,
                navigationHistory: [...baseHistory, nextState],
                historyIndex: baseHistory.length,
              };
            });
          }),
        }));
      },

      popTo: (tabId, index) => {
        set((state) => ({
          tabs: state.tabs.map((tab) => {
            if (tab.id !== tabId) return tab;

            return updateTabHistory(tab, (current) => {
              const currentState =
                current.navigationHistory[current.historyIndex] ?? buildStateFromUrl();
              const nextState = popNavigationState(currentState, index);
              const baseHistory = current.navigationHistory.slice(0, current.historyIndex + 1);

              return {
                ...current,
                navigationHistory: [...baseHistory, nextState],
                historyIndex: baseHistory.length,
              };
            });
          }),
        }));
      },

      resetStack: (tabId, next) => {
        set((state) => ({
          tabs: state.tabs.map((tab) => {
            if (tab.id !== tabId) return tab;

            return updateTabHistory(tab, (current) => {
              const baseHistory = current.navigationHistory.slice(0, current.historyIndex + 1);
              return {
                ...current,
                navigationHistory: [...baseHistory, resetNavigationState(next)],
                historyIndex: baseHistory.length,
              };
            });
          }),
        }));
      },

      goBack: (tabId) => {
        set((state) => ({
          tabs: state.tabs.map((tab) => {
            if (tab.id !== tabId) return tab;
            const current = coerceNavigationHistory(tab);
            if (current.historyIndex <= 0) return current;
            return syncLegacyHistory({
              ...current,
              historyIndex: current.historyIndex - 1,
            });
          }),
        }));
      },

      goForward: (tabId) => {
        set((state) => ({
          tabs: state.tabs.map((tab) => {
            if (tab.id !== tabId) return tab;
            const current = coerceNavigationHistory(tab);
            if (current.historyIndex >= current.navigationHistory.length - 1) {
              return current;
            }
            return syncLegacyHistory({
              ...current,
              historyIndex: current.historyIndex + 1,
            });
          }),
        }));
      },

      canGoBack: (tabId) => {
        const tab = get().tabs.find((item) => item.id === tabId);
        return tab ? coerceNavigationHistory(tab).historyIndex > 0 : false;
      },

      canGoForward: (tabId) => {
        const tab = get().tabs.find((item) => item.id === tabId);
        return tab
          ? coerceNavigationHistory(tab).historyIndex <
              coerceNavigationHistory(tab).navigationHistory.length - 1
          : false;
      },

      getCurrentUrl: (tabId) => {
        const tab = get().tabs.find((item) => item.id === tabId);
        if (!tab) return null;
        const current = coerceNavigationHistory(tab);
        return current.history[current.historyIndex] ?? null;
      },

      getCurrentNavigationState: (tabId) => {
        const tab = get().tabs.find((item) => item.id === tabId);
        if (!tab) return null;
        const current = coerceNavigationHistory(tab);
        return current.navigationHistory[current.historyIndex] ?? null;
      },

      closeAllTabs: () => {
        set((state) => {
          const tabs = state.tabs.filter((tab) => tab.pinned);
          return {
            tabs,
            activeTabId: tabs[0]?.id ?? null,
          };
        });
      },

      restoreTab: (tab) => {
        set((state) => ({
          tabs: [...state.tabs, coerceNavigationHistory(tab)],
          activeTabId: tab.id,
        }));
      },
    }),
    {
      name: "viben-tab-store",
      partialize: (state) => ({
        tabs: state.tabs,
        activeTabId: state.activeTabId,
      }),
      merge: (persisted, current) => {
        const merged = {
          ...current,
          ...(persisted as Partial<TabState>),
        };

        return {
          ...merged,
          tabs: (merged.tabs ?? []).map(coerceNavigationHistory),
        };
      },
    }
  )
);

export const selectActiveTab = (state: TabState) =>
  state.tabs.find((tab) => tab.id === state.activeTabId) ?? null;

export const selectPinnedTabs = (state: TabState) =>
  state.tabs.filter((tab) => tab.pinned);

export const selectUnpinnedTabs = (state: TabState) =>
  state.tabs.filter((tab) => !tab.pinned);

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { IconData } from "@/components/ui/icon-picker";
import { createStackForLocation } from "@/navigation/location-navigation";
import {
  createTabNavigationState,
  popTo as popNavigationState,
  pushPage as pushNavigationState,
  replaceLocation as replaceNavigationState,
  resetStack as resetNavigationState,
} from "@/navigation/tab-navigation";
import { locationToUrl, normalizeSettingsSection, urlToLocation } from "@/navigation/navigation-meta";
import type {
  DesktopLocation,
  BreadcrumbStackItem,
  PushPageOptions,
  TabNavigationState,
} from "@/navigation/navigation-meta";

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

export interface ClosedTabSnapshot {
  tab: PageTab;
  closedAt: number;
  originIndex: number;
}

interface TabState {
  tabs: PageTab[];
  activeTabId: string | null;
  recentlyClosedTabs: ClosedTabSnapshot[];
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
  jumpToHistory: (tabId: string, historyIndex: number) => void;
  goBack: (tabId: string) => void;
  goForward: (tabId: string) => void;
  canGoBack: (tabId: string) => boolean;
  canGoForward: (tabId: string) => boolean;
  getCurrentUrl: (tabId: string) => string | null;
  getCurrentNavigationState: (tabId: string) => TabNavigationState | null;
  closeAllTabs: () => void;
  duplicateTab: (tabId: string) => string | null;
  reopenClosedTab: () => string | null;
  restoreTab: (tab: PageTab) => void;
}

const generateTabId = () =>
  `tab-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
const MAX_RECENTLY_CLOSED_TABS = 20;

function findLastPinnedIndex(tabs: PageTab[]): number {
  for (let index = tabs.length - 1; index >= 0; index -= 1) {
    if (tabs[index].pinned) {
      return index;
    }
  }
  return -1;
}

function buildFallbackLocation(url: string): DesktopLocation {
  if (url.startsWith("/workspace/") && url.includes("/apps")) {
    const parts = url.split("/").filter(Boolean);
    const workspaceId = parts[1];
    if (workspaceId) {
      return { kind: "workspace-apps", workspaceId };
    }
  }

  if (url.startsWith("/documents")) {
    return { kind: "documents" };
  }

  if (url.startsWith("/devices/pair")) {
    return { kind: "device-pair" };
  }

  if (url.startsWith("/settings")) {
    const section = url.split("/")[2];
    return { kind: "settings", section: normalizeSettingsSection(section) };
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

function cloneTabWithNewId(tab: PageTab, overrides?: Partial<PageTab>): PageTab {
  return syncLegacyHistory({
    ...coerceNavigationHistory(tab),
    ...overrides,
    id: generateTabId(),
  });
}

function createClosedSnapshot(tab: PageTab, originIndex: number): ClosedTabSnapshot {
  return {
    tab: coerceNavigationHistory(tab),
    originIndex,
    closedAt: Date.now(),
  };
}

function pushClosedSnapshots(
  stack: ClosedTabSnapshot[],
  snapshots: ClosedTabSnapshot[]
): ClosedTabSnapshot[] {
  if (snapshots.length === 0) {
    return stack;
  }

  return [...snapshots].reverse().concat(stack).slice(0, MAX_RECENTLY_CLOSED_TABS);
}

function restoreClosedTabIntoTabs(
  tabs: PageTab[],
  snapshot: ClosedTabSnapshot
): { tabs: PageTab[]; restoredTab: PageTab } {
  const restoredTab = cloneTabWithNewId(snapshot.tab);
  const nextTabs = [...tabs];
  const insertIndex = Math.max(0, Math.min(snapshot.originIndex, nextTabs.length));
  nextTabs.splice(insertIndex, 0, restoredTab);
  return { tabs: nextTabs, restoredTab };
}

export const useTabStore = create<TabState & TabActions>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeTabId: null,
      recentlyClosedTabs: [],

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

          const recentlyClosedTabs = pushClosedSnapshots(
            state.recentlyClosedTabs,
            [createClosedSnapshot(state.tabs[tabIndex], tabIndex)]
          );
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

          return { tabs, activeTabId, recentlyClosedTabs };
        });
      },

      closeOtherTabs: (tabId) => {
        set((state) => {
          const snapshots = state.tabs
            .map((tab, index) => ({ tab, index }))
            .filter(({ tab }) => !tab.pinned && tab.id !== tabId)
            .map(({ tab, index }) => createClosedSnapshot(tab, index));

          return {
            tabs: state.tabs.filter((tab) => tab.pinned || tab.id === tabId),
            activeTabId: tabId,
            recentlyClosedTabs: pushClosedSnapshots(state.recentlyClosedTabs, snapshots),
          };
        });
      },

      closeTabsToRight: (tabId) => {
        set((state) => {
          const tabIndex = state.tabs.findIndex((tab) => tab.id === tabId);
          if (tabIndex === -1) return state;

          const snapshots = state.tabs
            .map((tab, index) => ({ tab, index }))
            .filter(({ tab, index }) => index > tabIndex && !tab.pinned)
            .map(({ tab, index }) => createClosedSnapshot(tab, index));
          const closingIds = new Set(snapshots.map((snapshot) => snapshot.tab.id));
          const tabs = state.tabs.filter((tab) => !closingIds.has(tab.id));
          const activeTabId = tabs.some((tab) => tab.id === state.activeTabId)
            ? state.activeTabId
            : tabId;

          return {
            tabs,
            activeTabId,
            recentlyClosedTabs: pushClosedSnapshots(state.recentlyClosedTabs, snapshots),
          };
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

      jumpToHistory: (tabId, historyIndex) => {
        set((state) => ({
          tabs: state.tabs.map((tab) => {
            if (tab.id !== tabId) return tab;
            const current = coerceNavigationHistory(tab);
            const nextIndex = Math.max(
              0,
              Math.min(historyIndex, current.navigationHistory.length - 1)
            );

            if (nextIndex === current.historyIndex) {
              return current;
            }

            return syncLegacyHistory({
              ...current,
              historyIndex: nextIndex,
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
          const snapshots = state.tabs
            .map((tab, index) => ({ tab, index }))
            .filter(({ tab }) => !tab.pinned)
            .map(({ tab, index }) => createClosedSnapshot(tab, index));
          const tabs = state.tabs.filter((tab) => tab.pinned);
          return {
            tabs,
            activeTabId: tabs[0]?.id ?? null,
            recentlyClosedTabs: pushClosedSnapshots(state.recentlyClosedTabs, snapshots),
          };
        });
      },

      duplicateTab: (tabId) => {
        const state = get();
        const tabIndex = state.tabs.findIndex((tab) => tab.id === tabId);
        if (tabIndex === -1) return null;

        const duplicatedTab = cloneTabWithNewId(state.tabs[tabIndex], {
          pinned: false,
        });

        set((current) => {
          const tabs = [...current.tabs];
          tabs.splice(tabIndex + 1, 0, duplicatedTab);
          return {
            tabs,
            activeTabId: duplicatedTab.id,
          };
        });

        return duplicatedTab.id;
      },

      reopenClosedTab: () => {
        const state = get();
        const snapshot = state.recentlyClosedTabs[0];
        if (!snapshot) return null;

        let restoredTabId: string | null = null;

        set((current) => {
          const [nextSnapshot, ...restSnapshots] = current.recentlyClosedTabs;
          if (!nextSnapshot) return current;

          const restored = restoreClosedTabIntoTabs(current.tabs, nextSnapshot);
          restoredTabId = restored.restoredTab.id;

          return {
            tabs: restored.tabs,
            activeTabId: restored.restoredTab.id,
            recentlyClosedTabs: restSnapshots,
          };
        });

        return restoredTabId;
      },

      restoreTab: (tab) => {
        const restoredTab = cloneTabWithNewId(tab);
        set((state) => ({
          tabs: [...state.tabs, restoredTab],
          activeTabId: restoredTab.id,
        }));
      },
    }),
    {
      name: "viben-tab-store",
      partialize: (state) => ({
        tabs: state.tabs,
        activeTabId: state.activeTabId,
        recentlyClosedTabs: state.recentlyClosedTabs,
      }),
      merge: (persisted, current) => {
        const merged = {
          ...current,
          ...(persisted as Partial<TabState>),
        };

        return {
          ...merged,
          tabs: (merged.tabs ?? []).map(coerceNavigationHistory),
          recentlyClosedTabs: (merged.recentlyClosedTabs ?? []).map((snapshot) => ({
            ...snapshot,
            tab: coerceNavigationHistory(snapshot.tab),
          })),
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

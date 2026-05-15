import { create } from "zustand";
import { persist } from "zustand/middleware";
import { buildColdStartBreadcrumb } from "@/navigation/breadcrumb-builder";
import type { BreadcrumbStackItem } from "@/navigation/breadcrumb-builder";

// ─── TabNavigationState (URL-based) ─────────────────────────────────────────

export interface TabNavigationState {
  url: string;
  breadcrumbStack: BreadcrumbStackItem[];
  activeNodeId?: string;
  activeIndexPath?: string[];
}

export type PageViewMode = "skill" | "page";

export interface PageTab {
  id: string;
  pinned: boolean;
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

interface OpenTabInput {
  pinned?: boolean;
  viewMode?: PageViewMode;
  navigationState: TabNavigationState;
}

export interface TabViewModel extends PageTab {
  currentState: TabNavigationState | null;
  currentUrl: string | null;
  label: string;
  titleKey?: string;
  icon?: BreadcrumbStackItem["icon"];
  descriptorId?: string;
  meta?: BreadcrumbStackItem["meta"];
  url: string | null;
}

interface TabActions {
  openTab: (tab: OpenTabInput) => string;
  closeTab: (tabId: string) => void;
  closeOtherTabs: (tabId: string) => void;
  closeTabsToRight: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  pinTab: (tabId: string) => void;
  unpinTab: (tabId: string) => void;
  setViewMode: (tabId: string, mode: PageViewMode) => void;
  moveTab: (fromIndex: number, toIndex: number) => void;
  navigate: (tabId: string, url: string) => void;
  pushNavigation: (tabId: string, url: string, leaf: BreadcrumbStackItem) => void;
  replaceNavigation: (tabId: string, url: string, leaf: BreadcrumbStackItem) => void;
  resetNavigation: (tabId: string, url: string, stack: BreadcrumbStackItem[]) => void;
  replaceLocation: (tabId: string, next: TabNavigationState) => void;
  pushLocation: (tabId: string, next: TabNavigationState) => void;
  insertHistoryBeforeCurrent: (tabId: string, state: TabNavigationState) => void;
  jumpToHistory: (tabId: string, historyIndex: number) => void;
  goBack: (tabId: string) => void;
  goForward: (tabId: string) => void;
  canGoBack: (tabId: string) => boolean;
  canGoForward: (tabId: string) => boolean;
  getCurrentUrl: (tabId: string) => string | null;
  getCurrentNavigationState: (tabId: string) => TabNavigationState | null;
  findHistoryEntryByUrl: (tabId: string, url: string) => number;
  closeAllTabs: () => void;
  duplicateTab: (tabId: string) => string | null;
  reopenClosedTab: () => string | null;
  restoreTab: (tab: PageTab) => void;
}

const generateTabId = () =>
  `tab-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
const MAX_RECENTLY_CLOSED_TABS = 20;
export const TAB_STORE_STORAGE_KEY = "viben-tab-store-v2";
const TAB_STORE_VERSION = 2;

function findLastPinnedIndex(tabs: PageTab[]): number {
  for (let index = tabs.length - 1; index >= 0; index -= 1) {
    if (tabs[index].pinned) {
      return index;
    }
  }
  return -1;
}

function buildStateFromUrl(url?: string): TabNavigationState {
  const targetUrl = url ?? "/documents";
  const stack = buildColdStartBreadcrumb(targetUrl);
  return { url: targetUrl, breadcrumbStack: stack };
}

function isNavigationState(value: unknown): value is TabNavigationState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<TabNavigationState>;
  return typeof candidate.url === "string" && Array.isArray(candidate.breadcrumbStack);
}

function isPersistedPageTab(value: unknown): value is PageTab {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PageTab>;
  return typeof candidate.id === "string" && Array.isArray(candidate.navigationHistory);
}

function isPersistedSnapshot(value: unknown): value is ClosedTabSnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ClosedTabSnapshot>;
  return (
    isPersistedPageTab(candidate.tab) &&
    typeof candidate.originIndex === "number" &&
    typeof candidate.closedAt === "number"
  );
}

function normalizeTab(tab: PageTab): PageTab {
  const navigationHistory = tab.navigationHistory.filter(isNavigationState);
  const safeHistory = navigationHistory.length > 0 ? navigationHistory : [buildStateFromUrl("/workspace")];
  const historyIndex = Math.min(
    Math.max(tab.historyIndex ?? safeHistory.length - 1, 0),
    safeHistory.length - 1
  );

  return {
    id: tab.id,
    pinned: Boolean(tab.pinned),
    historyIndex,
    navigationHistory: safeHistory,
    viewMode: tab.viewMode,
  };
}

function normalizeSnapshot(snapshot: ClosedTabSnapshot): ClosedTabSnapshot {
  return {
    tab: normalizeTab(snapshot.tab),
    originIndex: snapshot.originIndex,
    closedAt: snapshot.closedAt,
  };
}

export function mergePersistedTabState(
  persisted: Partial<TabState> | undefined,
  current: TabState
): TabState {
  const tabs = (persisted?.tabs ?? []).filter(isPersistedPageTab).map(normalizeTab);
  const tabIds = new Set(tabs.map((tab) => tab.id));
  const activeTabId =
    persisted?.activeTabId && tabIds.has(persisted.activeTabId)
      ? persisted.activeTabId
      : tabs[0]?.id ?? null;

  return {
    ...current,
    tabs,
    activeTabId,
    recentlyClosedTabs: (persisted?.recentlyClosedTabs ?? [])
      .filter(isPersistedSnapshot)
      .map(normalizeSnapshot),
  };
}

function cloneTabWithNewId(tab: PageTab, overrides?: Partial<PageTab>): PageTab {
  return normalizeTab({
    ...normalizeTab(tab),
    ...overrides,
    id: generateTabId(),
  });
}

function createClosedSnapshot(tab: PageTab, originIndex: number): ClosedTabSnapshot {
  return {
    tab: normalizeTab(tab),
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

export function getTabCurrentState(tab: PageTab): TabNavigationState | null {
  return tab.navigationHistory[tab.historyIndex] ?? null;
}

export function getTabCurrentLeaf(tab: PageTab): BreadcrumbStackItem | null {
  const current = getTabCurrentState(tab);
  return current?.breadcrumbStack[current.breadcrumbStack.length - 1] ?? null;
}

export function getTabUrl(tab: PageTab): string | null {
  const current = getTabCurrentState(tab);
  return current?.url ?? null;
}

export function getTabViewModel(tab: PageTab): TabViewModel {
  const currentState = getTabCurrentState(tab);
  const leaf = getTabCurrentLeaf(tab);
  const url = getTabUrl(tab);

  return {
    ...tab,
    currentState,
    currentUrl: url,
    label: leaf?.label ?? url ?? "Untitled",
    titleKey: leaf?.titleKey,
    icon: leaf?.icon,
    descriptorId: leaf?.pattern,
    meta: leaf?.meta,
    url,
  };
}

function findHistoryEntryByUrlInHistory(
  navigationHistory: TabNavigationState[],
  historyIndex: number,
  url: string
): number {
  for (let index = historyIndex - 1; index >= 0; index -= 1) {
    if (navigationHistory[index].url === url) {
      return index;
    }
  }
  return -1;
}


// ─── Store ───────────────────────────────────────────────────────────────────

export const useTabStore = create<TabState & TabActions>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeTabId: null,
      recentlyClosedTabs: [],

      openTab: (tabData) => {
        const id = generateTabId();
        const newTab = normalizeTab({
          id,
          pinned: tabData.pinned ?? false,
          navigationHistory: [tabData.navigationState],
          historyIndex: 0,
          viewMode: tabData.viewMode,
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
        get().pushLocation(tabId, buildStateFromUrl(url));
      },

      pushNavigation: (tabId, url, leaf) => {
        const tab = get().tabs.find((entry) => entry.id === tabId);
        const current = tab ? getTabCurrentState(normalizeTab(tab)) : null;
        const currentStack = current?.breadcrumbStack ?? [];
        const nextState: TabNavigationState = {
          url,
          breadcrumbStack: [...currentStack, leaf],
        };
        get().pushLocation(tabId, nextState);
      },

      replaceNavigation: (tabId, url, leaf) => {
        const tab = get().tabs.find((entry) => entry.id === tabId);
        const current = tab ? getTabCurrentState(normalizeTab(tab)) : null;
        const currentStack = current?.breadcrumbStack ?? [];
        const nextState: TabNavigationState = {
          url,
          breadcrumbStack: [...currentStack.slice(0, -1), leaf],
        };
        get().pushLocation(tabId, nextState);
      },

      resetNavigation: (tabId, url, stack) => {
        const nextState: TabNavigationState = { url, breadcrumbStack: stack };
        get().pushLocation(tabId, nextState);
      },

      replaceLocation: (tabId, next) => {
        set((state) => ({
          tabs: state.tabs.map((tab) => {
            if (tab.id !== tabId) return tab;
            const current = normalizeTab(tab);
            const baseHistory = current.navigationHistory.slice(0, current.historyIndex);
            return normalizeTab({
              ...current,
              navigationHistory: [...baseHistory, next],
              historyIndex: baseHistory.length,
            });
          }),
        }));
      },

      pushLocation: (tabId, next) => {
        set((state) => ({
          tabs: state.tabs.map((tab) => {
            if (tab.id !== tabId) return tab;
            const current = normalizeTab(tab);
            const baseHistory = current.navigationHistory.slice(0, current.historyIndex + 1);
            return normalizeTab({
              ...current,
              navigationHistory: [...baseHistory, next],
              historyIndex: baseHistory.length,
            });
          }),
        }));
      },

      insertHistoryBeforeCurrent: (tabId, next) => {
        set((state) => ({
          tabs: state.tabs.map((tab) => {
            if (tab.id !== tabId) return tab;
            const current = normalizeTab(tab);
            const before = current.navigationHistory.slice(0, current.historyIndex);
            const fromCurrent = current.navigationHistory.slice(current.historyIndex);
            return normalizeTab({
              ...current,
              navigationHistory: [...before, next, ...fromCurrent],
              historyIndex: before.length,
            });
          }),
        }));
      },

      jumpToHistory: (tabId, historyIndex) => {
        set((state) => ({
          tabs: state.tabs.map((tab) => {
            if (tab.id !== tabId) return tab;
            const current = normalizeTab(tab);
            return normalizeTab({
              ...current,
              historyIndex,
            });
          }),
        }));
      },

      goBack: (tabId) => {
        set((state) => ({
          tabs: state.tabs.map((tab) => {
            if (tab.id !== tabId) return tab;
            const current = normalizeTab(tab);
            if (current.historyIndex <= 0) return current;
            return {
              ...current,
              historyIndex: current.historyIndex - 1,
            };
          }),
        }));
      },

      goForward: (tabId) => {
        set((state) => ({
          tabs: state.tabs.map((tab) => {
            if (tab.id !== tabId) return tab;
            const current = normalizeTab(tab);
            if (current.historyIndex >= current.navigationHistory.length - 1) {
              return current;
            }
            return {
              ...current,
              historyIndex: current.historyIndex + 1,
            };
          }),
        }));
      },

      canGoBack: (tabId) => {
        const tab = get().tabs.find((item) => item.id === tabId);
        return tab ? normalizeTab(tab).historyIndex > 0 : false;
      },

      canGoForward: (tabId) => {
        const tab = get().tabs.find((item) => item.id === tabId);
        if (!tab) return false;
        const current = normalizeTab(tab);
        return current.historyIndex < current.navigationHistory.length - 1;
      },

      getCurrentUrl: (tabId) => {
        const tab = get().tabs.find((item) => item.id === tabId);
        if (!tab) return null;
        const current = getTabCurrentState(normalizeTab(tab));
        return current?.url ?? null;
      },

      getCurrentNavigationState: (tabId) => {
        const tab = get().tabs.find((item) => item.id === tabId);
        return tab ? getTabCurrentState(normalizeTab(tab)) : null;
      },

      findHistoryEntryByUrl: (tabId, url) => {
        const tab = get().tabs.find((item) => item.id === tabId);
        if (!tab) return -1;
        const current = normalizeTab(tab);
        return findHistoryEntryByUrlInHistory(
          current.navigationHistory,
          current.historyIndex,
          url
        );
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
      name: TAB_STORE_STORAGE_KEY,
      version: TAB_STORE_VERSION,
      partialize: (state) => ({
        tabs: state.tabs,
        activeTabId: state.activeTabId,
        recentlyClosedTabs: state.recentlyClosedTabs,
      }),
      merge: (persisted, current) => {
        return {
          ...current,
          ...mergePersistedTabState(
            persisted as Partial<TabState> | undefined,
            current
          ),
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

import { useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindowTabStore, getTabViewModel } from "@/stores/tab-store";
import type { TabNavigationState, TabViewModel } from "@/stores/tab-store";
import type { IconData } from "@/components/ui/icon-picker";
import { buildColdStartBreadcrumb } from "@/navigation/navigate";
import type { BreadcrumbStackItem } from "@/navigation/breadcrumb-builder";
import { normalizeWorkspaceSection } from "@/navigation/navigation-meta";
import { registry } from "@/navigation/route-registry";
import { useLocalWorkspaces } from "@/hooks/use-workspaces";
import type { PageConfig } from "@/hooks/use-pages";

// ─── Hook 1: useTabList ─────────────────────────────────────────────────────
// Returns the tab view model list. Only re-renders when the tabs array changes.

function useCurrentTabStore() {
  return useMemo(() => getCurrentWindowTabStore(), []);
}

export function useTabList(): TabViewModel[] {
  const tabStore = useCurrentTabStore();
  const rawTabs = tabStore((state) => state.tabs);
  const { workspaces } = useLocalWorkspaces();
  return useMemo(
    () =>
      rawTabs.map((tab) => {
        const vm = getTabViewModel(tab);
        // Fix tab label for workspace routes: the route entry's title function
        // returns the raw workspaceId (slug), but we want the display name.
        if (
          vm.descriptorId === "/workspace/:workspaceId" &&
          vm.meta?.workspaceId
        ) {
          const ws = workspaces.find((w) => w.id === vm.meta!.workspaceId);
          if (ws && vm.label === vm.meta!.workspaceId) {
            return { ...vm, label: ws.name };
          }
        }
        return vm;
      }),
    [rawTabs, workspaces],
  );
}

// ─── Hook 2: useActiveTabState ──────────────────────────────────────────────
// Returns reactive state about the active tab. Re-renders when active tab changes.

export interface ActiveTabState {
  activeTabId: string | null;
  activeTab: TabViewModel | null;
  canGoBack: boolean;
  canGoForward: boolean;
  currentUrl: string | null;
  currentNavigationState: TabNavigationState | null;
}

export function useActiveTabState(): ActiveTabState {
  const tabStore = useCurrentTabStore();
  const activeTabId = tabStore((state) => state.activeTabId);
  const activeTabRaw = tabStore(
    (state) => state.tabs.find((tab) => tab.id === state.activeTabId) ?? null,
  );
  const canGoBackFn = tabStore((state) => state.canGoBack);
  const canGoForwardFn = tabStore((state) => state.canGoForward);
  const getCurrentUrl = tabStore((state) => state.getCurrentUrl);
  const getCurrentNavigationState = tabStore(
    (state) => state.getCurrentNavigationState,
  );

  const activeTab = useMemo(
    () => (activeTabRaw ? getTabViewModel(activeTabRaw) : null),
    [activeTabRaw],
  );

  const canGoBack = activeTabId ? canGoBackFn(activeTabId) : false;
  const canGoForward = activeTabId ? canGoForwardFn(activeTabId) : false;
  const currentUrl = activeTabId ? getCurrentUrl(activeTabId) : null;
  const currentNavigationState = activeTabId
    ? getCurrentNavigationState(activeTabId)
    : null;

  return useMemo(
    () => ({
      activeTabId,
      activeTab,
      canGoBack,
      canGoForward,
      currentUrl,
      currentNavigationState,
    }),
    [
      activeTabId,
      activeTab,
      canGoBack,
      canGoForward,
      currentUrl,
      currentNavigationState,
    ],
  );
}

// ─── Hook 3: useTabActions ──────────────────────────────────────────────────
// Returns stable action functions for tab operations. These reference Zustand
// store actions + resolve navigation logic. Actions that depend on activeTabId
// will have their identity change when activeTabId changes.

export interface TabActions {
  openUrl: (
    url: string,
    options?: {
      breadcrumbStack?: BreadcrumbStackItem[];
      openInNewTab?: boolean;
    },
  ) => string;
  replaceUrl: (
    url: string,
    patch?: Partial<TabNavigationState>,
  ) => string | undefined;
  pushUrl: (
    url: string,
    patch?: Partial<TabNavigationState>,
  ) => string | undefined;
  pushPage: (item: BreadcrumbStackItem, url: string) => string | undefined;
  popTo: (index: number) => void;
  resetStack: (next: TabNavigationState) => string | undefined;
  navigateTo: (
    url: string,
    input: {
      label: string;
      icon?: IconData;
      descriptorId?: string;
      meta?: BreadcrumbStackItem["meta"];
    },
  ) => string | undefined;
  openPageTab: (
    page: PageConfig,
    workspaceId: string,
    breadcrumbStack?: BreadcrumbStackItem[],
  ) => string;
  openPageInNewTab: (
    page: PageConfig,
    workspaceId: string,
    breadcrumbStack?: BreadcrumbStackItem[],
  ) => string;
  openWorkspaceView: (
    workspaceId: string,
    viewPath: string,
    viewName: string,
    icon: IconData,
  ) => string;
  openGlobalView: (path: string, name: string, icon: IconData) => string;
  openWebUrl: (url: string, title?: string, workspaceId?: string) => string;
  openChatTab: (
    chatId: string,
    chatName: string,
    workspaceId: string,
  ) => string;
  switchToTab: (tabId: string) => string | null;
  closeTab: (tabId: string) => void;
  detachTabToNewWindow: (tabId: string) => Promise<boolean>;
  getTabLink: (tabId: string) => string | null;
}

export function useTabActions(): TabActions {
  const { getWorkspace } = useLocalWorkspaces();
  const tabStore = useCurrentTabStore();
  const activeTabId = tabStore((state) => state.activeTabId);
  const rawTabs = tabStore((state) => state.tabs);

  const openTab = tabStore((state) => state.openTab);
  const closeTabStore = tabStore((state) => state.closeTab);
  const setActiveTab = tabStore((state) => state.setActiveTab);
  const replaceLocationStore = tabStore((state) => state.replaceLocation);
  const pushLocationStore = tabStore((state) => state.pushLocation);
  const getCurrentUrl = tabStore((state) => state.getCurrentUrl);
  const getCurrentNavigationState = tabStore(
    (state) => state.getCurrentNavigationState,
  );

  const openUrl = useCallback(
    (
      url: string,
      options?: {
        breadcrumbStack?: BreadcrumbStackItem[];
        openInNewTab?: boolean;
      },
    ) => {
      const breadcrumbStack = options?.breadcrumbStack?.length
        ? options.breadcrumbStack
        : buildColdStartBreadcrumb(url);

      const navigationState: TabNavigationState = {
        url,
        breadcrumbStack,
      };

      if (options?.openInNewTab || !activeTabId) {
        return openTab({
          navigationState,
          pinned: false,
        });
      }

      replaceLocationStore(activeTabId, navigationState);
      return activeTabId;
    },
    [activeTabId, openTab, replaceLocationStore],
  );

  const replaceUrl = useCallback(
    (url: string, patch?: Partial<TabNavigationState>) => {
      if (!activeTabId) {
        return openUrl(url, {
          breadcrumbStack: patch?.breadcrumbStack,
          openInNewTab: true,
        });
      }

      const breadcrumbStack = patch?.breadcrumbStack?.length
        ? patch.breadcrumbStack
        : buildColdStartBreadcrumb(url);

      replaceLocationStore(activeTabId, {
        url,
        breadcrumbStack,
        activeIndexPath: patch?.activeIndexPath,
        activeNodeId: patch?.activeNodeId,
      });
      return activeTabId;
    },
    [activeTabId, openUrl, replaceLocationStore],
  );

  const pushUrl = useCallback(
    (url: string, patch?: Partial<TabNavigationState>) => {
      if (!activeTabId) {
        return openUrl(url, {
          breadcrumbStack: patch?.breadcrumbStack,
          openInNewTab: true,
        });
      }

      const breadcrumbStack = patch?.breadcrumbStack?.length
        ? patch.breadcrumbStack
        : buildColdStartBreadcrumb(url);

      pushLocationStore(activeTabId, {
        url,
        breadcrumbStack,
        activeIndexPath: patch?.activeIndexPath,
        activeNodeId: patch?.activeNodeId,
      });
      return activeTabId;
    },
    [activeTabId, openUrl, pushLocationStore],
  );

  const pushPage = useCallback(
    (item: BreadcrumbStackItem, url: string) => {
      if (!activeTabId) {
        const stack = buildColdStartBreadcrumb(url);
        return openUrl(url, {
          breadcrumbStack: [...stack, item],
          openInNewTab: true,
        });
      }

      // Push: append item to current breadcrumb stack
      const currentState = getCurrentNavigationState(activeTabId);
      const currentStack = currentState?.breadcrumbStack ?? [];
      pushLocationStore(activeTabId, {
        url,
        breadcrumbStack: [...currentStack, item],
      });
      return activeTabId;
    },
    [activeTabId, getCurrentNavigationState, openUrl, pushLocationStore],
  );

  const popTo = useCallback(
    (index: number) => {
      if (!activeTabId) return;
      const currentState = getCurrentNavigationState(activeTabId);
      if (!currentState) return;

      const targetItem = currentState.breadcrumbStack[index];
      if (!targetItem?.href) return;

      // Navigate to the breadcrumb target URL with truncated stack
      replaceLocationStore(activeTabId, {
        url: targetItem.href,
        breadcrumbStack: currentState.breadcrumbStack.slice(0, index + 1),
      });
    },
    [activeTabId, getCurrentNavigationState, replaceLocationStore],
  );

  const resetStack = useCallback(
    (next: TabNavigationState) => {
      if (!activeTabId) {
        return openUrl(next.url, {
          breadcrumbStack: next.breadcrumbStack,
          openInNewTab: true,
        });
      }

      replaceLocationStore(activeTabId, next);
      return activeTabId;
    },
    [activeTabId, openUrl, replaceLocationStore],
  );

  const navigateTo = useCallback(
    (
      url: string,
      input: {
        label: string;
        icon?: IconData;
        descriptorId?: string;
        meta?: BreadcrumbStackItem["meta"];
      },
    ) => {
      const isExternal =
        url.startsWith("http://") || url.startsWith("https://");
      if (isExternal) {
        const workspaceId = input.meta?.workspaceId ?? "global";
        const params = new URLSearchParams({ url, title: input.label });
        const webUrl = `/workspace/${encodeURIComponent(workspaceId)}/web?${params.toString()}`;
        return openUrl(webUrl);
      }

      // Use URL-based navigation directly
      const stack = buildColdStartBreadcrumb(url, {
        label: input.label,
        icon: input.icon,
      });

      if (activeTabId) {
        replaceLocationStore(activeTabId, {
          url,
          breadcrumbStack: stack,
        });
        return activeTabId;
      }

      return openTab({
        pinned: false,
        navigationState: {
          url,
          breadcrumbStack: stack,
        },
      });
    },
    [activeTabId, openUrl, openTab, replaceLocationStore],
  );

  const openPageTab = useCallback(
    (
      page: PageConfig,
      workspaceId: string,
      breadcrumbStack?: BreadcrumbStackItem[],
    ) => {
      const url = registry.build("/workspace/:workspaceId/page/:uid", {
        workspaceId,
        uid: page.uid,
      });
      return openUrl(url, { breadcrumbStack });
    },
    [openUrl],
  );

  const openPageInNewTab = useCallback(
    (
      page: PageConfig,
      workspaceId: string,
      breadcrumbStack?: BreadcrumbStackItem[],
    ) => {
      const url = registry.build("/workspace/:workspaceId/page/:uid", {
        workspaceId,
        uid: page.uid,
      });
      return openUrl(url, { openInNewTab: true, breadcrumbStack });
    },
    [openUrl],
  );

  const openWorkspaceView = useCallback(
    (
      workspaceId: string,
      viewPath: string,
      _viewName: string,
      _icon: IconData,
    ) => {
      if (!viewPath) {
        const url = registry.build("/workspace/:workspaceId", { workspaceId });
        return openUrl(url);
      }
      const section = normalizeWorkspaceSection(viewPath);
      const url = registry.build(`/workspace/:workspaceId/${section}`, {
        workspaceId,
      });
      return openUrl(url);
    },
    [openUrl],
  );

  const openGlobalView = useCallback(
    (path: string, _name: string, _icon: IconData) => {
      return openUrl(path);
    },
    [openUrl],
  );

  const openWebUrl = useCallback(
    (url: string, title?: string, workspaceId?: string) => {
      // Derive workspaceId from current tab URL via registry match
      const currentTabUrl = activeTabId ? getCurrentUrl(activeTabId) : null;
      const routeMatch = currentTabUrl ? registry.match(currentTabUrl) : null;
      const wsId = workspaceId ?? routeMatch?.params.workspaceId ?? "global";
      const params = new URLSearchParams({
        url,
        title: title ?? safeHostname(url),
      });
      const webUrl = `/workspace/${encodeURIComponent(wsId)}/web?${params.toString()}`;
      return openUrl(webUrl);
    },
    [activeTabId, getCurrentUrl, openUrl],
  );

  const openChatTab = useCallback(
    (_chatId: string, _chatName: string, workspaceId: string) => {
      const url = registry.build("/workspace/:workspaceId/chat", {
        workspaceId,
      });
      return openUrl(url);
    },
    [openUrl],
  );

  const switchToTab = useCallback(
    (tabId: string) => {
      setActiveTab(tabId);
      return getCurrentUrl(tabId);
    },
    [getCurrentUrl, setActiveTab],
  );

  const closeTab = useCallback(
    (tabId: string) => {
      closeTabStore(tabId);
    },
    [closeTabStore],
  );

  const getTabLink = useCallback(
    (tabId: string) => {
      const state = getCurrentNavigationState(tabId);
      return state?.url ?? null;
    },
    [getCurrentNavigationState],
  );

  const detachTabToNewWindow = useCallback(
    async (tabId: string) => {
      const tab = rawTabs.find((item) => item.id === tabId);
      const state = getCurrentNavigationState(tabId);
      const tabView = tab ? getTabViewModel(tab) : null;

      if (!tab || !state) {
        return false;
      }

      // Use registry match to extract route info from the URL
      const match = registry.match(state.url);
      const workspaceId = match?.params.workspaceId;
      if (!workspaceId) {
        return false;
      }

      const pageUid = match?.params.uid;
      const isPageRoute =
        match?.pattern === "/workspace/:workspaceId/page/:uid";

      if (isPageRoute && pageUid) {
        const workspace = getWorkspace(workspaceId);
        if (!workspace?.path) {
          return false;
        }

        await invoke("open_workspace_page_preview_window", {
          workspaceId,
          workspacePath: workspace.path,
          uid: pageUid,
          title: tabView?.label ?? pageUid,
          view: tab.viewMode ?? "page",
        });
        closeTabStore(tabId);
        return true;
      }

      await invoke("open_workspace_in_new_window", {
        workspaceId,
        routePath: state.url,
        title: tabView?.label ?? state.url,
      });
      closeTabStore(tabId);
      return true;
    },
    [closeTabStore, getCurrentNavigationState, getWorkspace, rawTabs],
  );

  return useMemo(
    () => ({
      openUrl,
      replaceUrl,
      pushUrl,
      pushPage,
      popTo,
      resetStack,
      navigateTo,
      openPageTab,
      openPageInNewTab,
      openWorkspaceView,
      openGlobalView,
      openWebUrl,
      openChatTab,
      switchToTab,
      closeTab,
      detachTabToNewWindow,
      getTabLink,
    }),
    [
      openUrl,
      replaceUrl,
      pushUrl,
      pushPage,
      popTo,
      resetStack,
      navigateTo,
      openPageTab,
      openPageInNewTab,
      openWorkspaceView,
      openGlobalView,
      openWebUrl,
      openChatTab,
      switchToTab,
      closeTab,
      detachTabToNewWindow,
      getTabLink,
    ],
  );
}

// ─── Hook 4: useTabNavigation ───────────────────────────────────────────────
// Returns navigation actions bound to the active tab (history back/forward/jump).

export interface TabNavigationActions {
  goBackInTab: () => void;
  goForwardInTab: () => void;
  jumpToHistory: (historyIndex: number) => void;
  navigateInTab: (url: string) => void;
}

export function useTabNavigation(): TabNavigationActions {
  const tabStore = useCurrentTabStore();
  const activeTabId = tabStore((state) => state.activeTabId);
  const navigate = tabStore((state) => state.navigate);
  const goBack = tabStore((state) => state.goBack);
  const goForward = tabStore((state) => state.goForward);
  const canGoBackFn = tabStore((state) => state.canGoBack);
  const canGoForwardFn = tabStore((state) => state.canGoForward);
  const jumpToHistoryStore = tabStore((state) => state.jumpToHistory);

  const goBackInTab = useCallback(() => {
    if (activeTabId && canGoBackFn(activeTabId)) {
      goBack(activeTabId);
    }
  }, [activeTabId, canGoBackFn, goBack]);

  const goForwardInTab = useCallback(() => {
    if (activeTabId && canGoForwardFn(activeTabId)) {
      goForward(activeTabId);
    }
  }, [activeTabId, canGoForwardFn, goForward]);

  const jumpToHistory = useCallback(
    (historyIndex: number) => {
      if (!activeTabId) return;
      jumpToHistoryStore(activeTabId, historyIndex);
    },
    [activeTabId, jumpToHistoryStore],
  );

  const navigateInTab = useCallback(
    (url: string) => {
      if (!activeTabId) return;
      navigate(activeTabId, url);
    },
    [activeTabId, navigate],
  );

  return useMemo(
    () => ({ goBackInTab, goForwardInTab, jumpToHistory, navigateInTab }),
    [goBackInTab, goForwardInTab, jumpToHistory, navigateInTab],
  );
}

// ─── Composed hook: usePageTabs (backward-compatible) ───────────────────────
// Composes the 4 granular hooks. Existing consumers can continue using this
// without changes, but new code should prefer the granular hooks.

export function usePageTabs() {
  const tabs = useTabList();
  const activeState = useActiveTabState();
  const actions = useTabActions();
  const navigation = useTabNavigation();

  return useMemo(
    () => ({
      tabs,
      ...activeState,
      ...actions,
      ...navigation,
    }),
    [tabs, activeState, actions, navigation],
  );
}

// ─── Utilities ──────────────────────────────────────────────────────────────

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

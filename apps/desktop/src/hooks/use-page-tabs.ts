import { useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getTabViewModel, useTabStore } from "@/stores/tab-store";
import type { TabNavigationState, TabViewModel } from "@/stores/tab-store";
import type { IconData } from "@/components/ui/icon-picker";
import { buildColdStartBreadcrumb } from "@/navigation/navigate";
import type { BreadcrumbStackItem } from "@/navigation/breadcrumb-builder";
import {
  type DesktopLocation,
  type PushPageOptions,
  locationToUrl,
  normalizeSettingsSection,
  normalizeWorkspaceSection,
} from "@/navigation/navigation-meta";
import { registry } from "@/navigation/route-registry";
import { useLocalWorkspaces } from "@/hooks/use-workspaces";
import type { PageConfig } from "@/hooks/use-pages";

// ─── Hook 1: useTabList ─────────────────────────────────────────────────────
// Returns the tab view model list. Only re-renders when the tabs array changes.

export function useTabList(): TabViewModel[] {
  const rawTabs = useTabStore((state) => state.tabs);
  return useMemo(() => rawTabs.map(getTabViewModel), [rawTabs]);
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
  const activeTabId = useTabStore((state) => state.activeTabId);
  const activeTabRaw = useTabStore((state) =>
    state.tabs.find((tab) => tab.id === state.activeTabId) ?? null
  );
  const canGoBackFn = useTabStore((state) => state.canGoBack);
  const canGoForwardFn = useTabStore((state) => state.canGoForward);
  const getCurrentUrl = useTabStore((state) => state.getCurrentUrl);
  const getCurrentNavigationState = useTabStore(
    (state) => state.getCurrentNavigationState
  );

  const activeTab = useMemo(
    () => (activeTabRaw ? getTabViewModel(activeTabRaw) : null),
    [activeTabRaw]
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
    [activeTabId, activeTab, canGoBack, canGoForward, currentUrl, currentNavigationState]
  );
}

// ─── Hook 3: useTabActions ──────────────────────────────────────────────────
// Returns stable action functions for tab operations. These reference Zustand
// store actions + resolve navigation logic. Actions that depend on activeTabId
// will have their identity change when activeTabId changes.

export interface TabActions {
  openLocation: (
    location: DesktopLocation,
    options?: { breadcrumbStack?: BreadcrumbStackItem[]; openInNewTab?: boolean }
  ) => string;
  replaceLocation: (
    location: DesktopLocation,
    patch?: Partial<TabNavigationState>
  ) => string | undefined;
  pushLocation: (
    location: DesktopLocation,
    patch?: Partial<TabNavigationState>
  ) => string | undefined;
  pushPage: (
    item: BreadcrumbStackItem,
    nextLocation: DesktopLocation,
    options?: PushPageOptions
  ) => string | undefined;
  popTo: (index: number) => void;
  resetStack: (next: TabNavigationState) => string | undefined;
  navigateTo: (
    url: string,
    input: { label: string; icon?: IconData; descriptorId?: string; meta?: BreadcrumbStackItem["meta"] }
  ) => string | undefined;
  openPageTab: (page: PageConfig, workspaceId: string, breadcrumbStack?: BreadcrumbStackItem[]) => string;
  openPageInNewTab: (page: PageConfig, workspaceId: string, breadcrumbStack?: BreadcrumbStackItem[]) => string;
  openWorkspaceView: (workspaceId: string, viewPath: string, viewName: string, icon: IconData) => string;
  openGlobalView: (path: string, name: string, icon: IconData) => string;
  openWebUrl: (url: string, title?: string, workspaceId?: string) => string;
  openChatTab: (chatId: string, chatName: string, workspaceId: string) => string;
  switchToTab: (tabId: string) => string | null;
  closeTab: (tabId: string) => void;
  detachTabToNewWindow: (tabId: string) => Promise<boolean>;
  getTabLink: (tabId: string) => string | null;
}

export function useTabActions(): TabActions {
  const { getWorkspace } = useLocalWorkspaces();
  const activeTabId = useTabStore((state) => state.activeTabId);
  const rawTabs = useTabStore((state) => state.tabs);

  const openTab = useTabStore((state) => state.openTab);
  const closeTabStore = useTabStore((state) => state.closeTab);
  const setActiveTab = useTabStore((state) => state.setActiveTab);
  const replaceLocationStore = useTabStore((state) => state.replaceLocation);
  const pushLocationStore = useTabStore((state) => state.pushLocation);
  const getCurrentUrl = useTabStore((state) => state.getCurrentUrl);
  const getCurrentNavigationState = useTabStore(
    (state) => state.getCurrentNavigationState
  );

  const resolveNavigation = useCallback(
    (
      location: DesktopLocation,
      input?: {
        breadcrumbStack?: BreadcrumbStackItem[];
        title?: string;
        icon?: IconData;
      }
    ): { url: string; breadcrumbStack: BreadcrumbStackItem[] } => {
      const url = locationToUrl(location);

      if (input?.breadcrumbStack?.length) {
        return { url, breadcrumbStack: input.breadcrumbStack };
      }

      const stack = buildColdStartBreadcrumb(url, {
        label: input?.title,
        icon: input?.icon,
      });

      return { url, breadcrumbStack: stack };
    },
    []
  );

  const openLocation = useCallback(
    (
      location: DesktopLocation,
      options?: {
        breadcrumbStack?: BreadcrumbStackItem[];
        openInNewTab?: boolean;
      }
    ) => {
      const resolved = resolveNavigation(location, {
        breadcrumbStack: options?.breadcrumbStack,
      });
      const navigationState: TabNavigationState = {
        url: resolved.url,
        breadcrumbStack: resolved.breadcrumbStack,
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
    [activeTabId, openTab, replaceLocationStore, resolveNavigation]
  );

  const replaceLocation = useCallback(
    (
      location: DesktopLocation,
      patch?: Partial<TabNavigationState>
    ) => {
      if (!activeTabId) {
        return openLocation(location, {
          breadcrumbStack: patch?.breadcrumbStack,
          openInNewTab: true,
        });
      }

      const resolved = resolveNavigation(location, {
        breadcrumbStack: patch?.breadcrumbStack,
      });
      replaceLocationStore(activeTabId, {
        url: resolved.url,
        breadcrumbStack: resolved.breadcrumbStack,
        activeIndexPath: patch?.activeIndexPath,
        activeNodeId: patch?.activeNodeId,
      });
      return activeTabId;
    },
    [activeTabId, openLocation, replaceLocationStore, resolveNavigation]
  );

  const pushLocation = useCallback(
    (
      location: DesktopLocation,
      patch?: Partial<TabNavigationState>
    ) => {
      if (!activeTabId) {
        return openLocation(location, {
          breadcrumbStack: patch?.breadcrumbStack,
          openInNewTab: true,
        });
      }

      const resolved = resolveNavigation(location, {
        breadcrumbStack: patch?.breadcrumbStack,
      });
      pushLocationStore(activeTabId, {
        url: resolved.url,
        breadcrumbStack: resolved.breadcrumbStack,
        activeIndexPath: patch?.activeIndexPath,
        activeNodeId: patch?.activeNodeId,
      });
      return activeTabId;
    },
    [activeTabId, openLocation, pushLocationStore, resolveNavigation]
  );

  const pushPage = useCallback(
    (
      item: BreadcrumbStackItem,
      nextLocation: DesktopLocation,
      _options?: PushPageOptions
    ) => {
      if (!activeTabId) {
        const resolved = resolveNavigation(nextLocation, {
          title: item.label,
          icon: item.icon,
        });
        return openLocation(nextLocation, {
          breadcrumbStack: [...resolved.breadcrumbStack, item],
          openInNewTab: true,
        });
      }

      // Push: append item to current breadcrumb stack
      const url = locationToUrl(nextLocation);
      const currentState = getCurrentNavigationState(activeTabId);
      const currentStack = currentState?.breadcrumbStack ?? [];
      pushLocationStore(activeTabId, {
        url,
        breadcrumbStack: [...currentStack, item],
      });
      return activeTabId;
    },
    [activeTabId, getCurrentNavigationState, openLocation, pushLocationStore, resolveNavigation]
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
    [activeTabId, getCurrentNavigationState, replaceLocationStore]
  );

  const resetStack = useCallback(
    (next: TabNavigationState) => {
      if (!activeTabId) {
        const location = buildLocationFromLegacyUrl(next.url);
        return openLocation(location, {
          breadcrumbStack: next.breadcrumbStack,
          openInNewTab: true,
        });
      }

      replaceLocationStore(activeTabId, next);
      return activeTabId;
    },
    [activeTabId, openLocation, replaceLocationStore]
  );

  const navigateTo = useCallback(
    (url: string, input: { label: string; icon?: IconData; descriptorId?: string; meta?: BreadcrumbStackItem["meta"] }) => {
      const isExternal = url.startsWith("http://") || url.startsWith("https://");
      if (isExternal) {
        const workspaceId = input.meta?.workspaceId ?? "global";
        return openLocation(
          {
            kind: "workspace-web",
            workspaceId,
            url,
            title: input.label,
          },
          { openInNewTab: false }
        );
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
    [activeTabId, openLocation, openTab, replaceLocationStore]
  );

  const openPageTab = useCallback(
    (page: PageConfig, workspaceId: string, breadcrumbStack?: BreadcrumbStackItem[]) =>
      openLocation(
        { kind: "workspace-page", workspaceId, pageSlug: page.slug },
        { breadcrumbStack }
      ),
    [openLocation]
  );

  const openPageInNewTab = useCallback(
    (page: PageConfig, workspaceId: string, breadcrumbStack?: BreadcrumbStackItem[]) =>
      openLocation(
        { kind: "workspace-page", workspaceId, pageSlug: page.slug },
        { openInNewTab: true, breadcrumbStack }
      ),
    [openLocation]
  );

  const openWorkspaceView = useCallback(
    (workspaceId: string, viewPath: string, _viewName: string, _icon: IconData) => {
      if (!viewPath) {
        return openLocation({ kind: "workspace-home", workspaceId });
      }
      return openLocation({
        kind: "workspace-section",
        workspaceId,
        section: normalizeWorkspaceSection(viewPath),
      });
    },
    [openLocation]
  );

  const openGlobalView = useCallback(
    (path: string, _name: string, _icon: IconData) => {
      const location = buildLocationFromLegacyUrl(path);
      return openLocation(location);
    },
    [openLocation]
  );

  const openWebUrl = useCallback(
    (url: string, title?: string, workspaceId?: string) => {
      // Derive workspaceId from current tab URL via registry match
      const currentTabUrl = activeTabId ? getCurrentUrl(activeTabId) : null;
      const routeMatch = currentTabUrl ? registry.match(currentTabUrl) : null;
      const wsId =
        workspaceId ??
        routeMatch?.params.workspaceId ??
        "global";
      return openLocation({
        kind: "workspace-web",
        workspaceId: wsId,
        title: title ?? safeHostname(url),
        url,
      });
    },
    [activeTabId, getCurrentUrl, openLocation]
  );

  const openChatTab = useCallback(
    (_chatId: string, _chatName: string, workspaceId: string) =>
      openLocation({
        kind: "workspace-section",
        workspaceId,
        section: "chat",
      }),
    [openLocation]
  );

  const switchToTab = useCallback(
    (tabId: string) => {
      setActiveTab(tabId);
      return getCurrentUrl(tabId);
    },
    [getCurrentUrl, setActiveTab]
  );

  const closeTab = useCallback(
    (tabId: string) => {
      closeTabStore(tabId);
    },
    [closeTabStore]
  );

  const getTabLink = useCallback(
    (tabId: string) => {
      const state = getCurrentNavigationState(tabId);
      return state?.url ?? null;
    },
    [getCurrentNavigationState]
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

      const pageSlug = match?.params.pageSlug;
      const isPageRoute = match?.pattern === "/workspace/:workspaceId/page/:pageSlug+";

      if (isPageRoute && pageSlug) {
        const workspace = getWorkspace(workspaceId);
        if (!workspace?.path) {
          return false;
        }

        await invoke("open_workspace_page_preview_window", {
          workspaceId,
          workspacePath: workspace.path,
          slug: pageSlug,
          title: tabView?.label ?? pageSlug,
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
    [closeTabStore, getCurrentNavigationState, getWorkspace, rawTabs]
  );

  return useMemo(
    () => ({
      openLocation,
      replaceLocation,
      pushLocation,
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
      openLocation,
      replaceLocation,
      pushLocation,
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
    ]
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
  const activeTabId = useTabStore((state) => state.activeTabId);
  const navigate = useTabStore((state) => state.navigate);
  const goBack = useTabStore((state) => state.goBack);
  const goForward = useTabStore((state) => state.goForward);
  const canGoBackFn = useTabStore((state) => state.canGoBack);
  const canGoForwardFn = useTabStore((state) => state.canGoForward);
  const jumpToHistoryStore = useTabStore((state) => state.jumpToHistory);

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
    [activeTabId, jumpToHistoryStore]
  );

  const navigateInTab = useCallback(
    (url: string) => {
      if (!activeTabId) return;
      navigate(activeTabId, url);
    },
    [activeTabId, navigate]
  );

  return useMemo(
    () => ({ goBackInTab, goForwardInTab, jumpToHistory, navigateInTab }),
    [goBackInTab, goForwardInTab, jumpToHistory, navigateInTab]
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
    [tabs, activeState, actions, navigation]
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

function buildLocationFromLegacyUrl(url: string): DesktopLocation {
  if (url === "/documents" || url === "/workspace") {
    return { kind: "documents" };
  }
  if (url === "/devices/pair") {
    return { kind: "device-pair" };
  }
  if (url.startsWith("/settings")) {
    const section = url.split("/")[2];
    return { kind: "settings", section: normalizeSettingsSection(section) };
  }

  if (url === "/publish" || url === "/my-packages" || url === "/analytics") {
    return { kind: "global-route", path: url };
  }

  if (url.startsWith("/workspace/")) {
    const parsed = new URL(url, "http://desktop.local");
    const parts = parsed.pathname.split("/").filter(Boolean);
    const workspaceId = parts[1];
    if (!workspaceId) {
      return { kind: "documents" };
    }

    if (parts.length === 2) {
      return { kind: "workspace-home", workspaceId };
    }

    if ((parts[2] === "pages" || parts[2] === "apps") && !parts[3]) {
      return { kind: "workspace-section", workspaceId, section: "pages" };
    }

    if (parts[2] === "page" && parts[3]) {
      return {
        kind: "workspace-page",
        workspaceId,
        pageSlug: parts
          .slice(3)
          .map((part) => decodeURIComponent(part))
          .join("/"),
      };
    }

    if (parts[2] === "agent" && parts[3]) {
      return {
        kind: "workspace-agent-detail",
        workspaceId,
        agentId: decodeURIComponent(parts[3]),
      };
    }

    if (parts[2] === "executor" && parts[3]) {
      return {
        kind: "workspace-executor-detail",
        workspaceId,
        executorType: decodeURIComponent(parts[3]),
      };
    }

    if (parts[2] === "web") {
      return {
        kind: "workspace-web",
        workspaceId,
        url: parsed.searchParams.get("url") ?? "",
        title: parsed.searchParams.get("title") ?? "Web",
        sourcePageSlug: parsed.searchParams.get("source_page") ?? undefined,
        webId: parsed.searchParams.get("web_id") ?? undefined,
      };
    }

    return {
      kind: "workspace-section",
      workspaceId,
      section: normalizeWorkspaceSection(parts[2] ?? "chat"),
    };
  }

  return { kind: "global-route", path: url };
}

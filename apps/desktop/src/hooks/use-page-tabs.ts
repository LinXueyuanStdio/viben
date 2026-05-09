import { useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useQueryClient } from "@tanstack/react-query";
import { getTabViewModel, useTabStore } from "@/stores/tab-store";
import type { ListPagesResult, PageConfig } from "@/lib/gateway";
import type { IconData } from "@/components/ui/icon-picker";
import { resolveLocationNavigation } from "@/navigation/location-navigation";
import {
  type DesktopLocation,
  type BreadcrumbStackItem,
  type PushPageOptions,
  type TabNavigationState,
  locationToUrl,
  urlToLocation,
  normalizeSettingsSection,
  normalizeWorkspaceSection,
} from "@/navigation/navigation-meta";
import { pageKeys } from "@/hooks/use-pages";
import { useLocalWorkspaces } from "@/hooks/use-workspaces";
import type { TabViewModel } from "@/stores/tab-store";

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
  const queryClient = useQueryClient();
  const { getWorkspace } = useLocalWorkspaces();
  const activeTabId = useTabStore((state) => state.activeTabId);
  const rawTabs = useTabStore((state) => state.tabs);

  const openTab = useTabStore((state) => state.openTab);
  const closeTabStore = useTabStore((state) => state.closeTab);
  const setActiveTab = useTabStore((state) => state.setActiveTab);
  const replaceLocationStore = useTabStore((state) => state.replaceLocation);
  const pushLocationStore = useTabStore((state) => state.pushLocation);
  const pushPageStore = useTabStore((state) => state.pushPage);
  const popToStore = useTabStore((state) => state.popTo);
  const resetStackStore = useTabStore((state) => state.resetStack);
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
        workspaceId?: string;
      }
    ) => {
      const workspaceId =
        input?.workspaceId ?? ("workspaceId" in location ? location.workspaceId : undefined);
      const workspace = workspaceId ? getWorkspace(workspaceId) : undefined;
      const cachedPages = workspace?.path
        ? queryClient.getQueryData<ListPagesResult | PageConfig[]>(
            pageKeys.list(workspace.path)
          )
        : undefined;
      const pages = Array.isArray(cachedPages)
        ? cachedPages
        : cachedPages?.pages;

      return resolveLocationNavigation({
        location,
        workspace,
        pages,
        breadcrumbStack: input?.breadcrumbStack,
        title: input?.title,
        icon: input?.icon,
      });
    },
    [getWorkspace, queryClient]
  );

  const openLocation = useCallback(
    (
      location: DesktopLocation,
      options?: {
        breadcrumbStack?: BreadcrumbStackItem[];
        openInNewTab?: boolean;
      }
    ) => {
      const resolvedNavigation = resolveNavigation(location, {
        breadcrumbStack: options?.breadcrumbStack,
      });
      const navigationState: TabNavigationState = {
        location,
        breadcrumbStack: resolvedNavigation.breadcrumbStack,
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

      const resolvedNavigation = resolveNavigation(location, {
        breadcrumbStack: patch?.breadcrumbStack,
      });
      replaceLocationStore(activeTabId, {
        location,
        breadcrumbStack: resolvedNavigation.breadcrumbStack,
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

      const resolvedNavigation = resolveNavigation(location, {
        breadcrumbStack: patch?.breadcrumbStack,
      });
      pushLocationStore(activeTabId, {
        location,
        breadcrumbStack: resolvedNavigation.breadcrumbStack,
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
      options?: PushPageOptions
    ) => {
      if (!activeTabId) {
        const resolvedNavigation = resolveNavigation(nextLocation, {
          title: item.label,
          icon: item.icon,
        });
        return openLocation(nextLocation, {
          breadcrumbStack: [...resolvedNavigation.breadcrumbStack, item],
          openInNewTab: true,
        });
      }

      pushPageStore(activeTabId, item, nextLocation, options);
      return activeTabId;
    },
    [activeTabId, openLocation, pushPageStore, resolveNavigation]
  );

  const popTo = useCallback(
    (index: number) => {
      if (!activeTabId) return;
      popToStore(activeTabId, index);
    },
    [activeTabId, popToStore]
  );

  const resetStack = useCallback(
    (next: TabNavigationState) => {
      if (!activeTabId) {
        return openLocation(next.location, {
          breadcrumbStack: next.breadcrumbStack,
          openInNewTab: true,
        });
      }

      resetStackStore(activeTabId, next);
      return activeTabId;
    },
    [activeTabId, openLocation, resetStackStore]
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

      if (activeTabId) {
        const location = buildLocationFromLegacyUrl(url);
        const resolvedNavigation = resolveNavigation(location, {
          title: input.label,
          icon: input.icon,
          workspaceId: input.meta?.workspaceId,
        });
        replaceLocationStore(activeTabId, {
          location,
          breadcrumbStack: resolvedNavigation.breadcrumbStack,
        });
        return activeTabId;
      }

      const location = buildLocationFromLegacyUrl(url);
      const resolvedNavigation = resolveNavigation(location, {
        title: input.label,
        icon: input.icon,
        workspaceId: input.meta?.workspaceId,
      });
      return openTab({
        pinned: false,
        navigationState: {
          location,
          breadcrumbStack: resolvedNavigation.breadcrumbStack,
        },
      });
    },
    [activeTabId, openLocation, openTab, replaceLocationStore, resolveNavigation]
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
      const activeState = activeTabId ? getCurrentNavigationState(activeTabId) : null;
      const activeLeaf = activeState?.breadcrumbStack[activeState.breadcrumbStack.length - 1];
      const wsId =
        workspaceId ??
        (activeState?.location && "workspaceId" in activeState.location
          ? activeState.location.workspaceId
          : undefined) ??
        activeLeaf?.meta?.workspaceId ??
        "global";
      return openLocation({
        kind: "workspace-web",
        workspaceId: wsId,
        title: title ?? safeHostname(url),
        url,
      });
    },
    [activeTabId, getCurrentNavigationState, openLocation]
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
      return state ? locationToUrl(state.location) : null;
    },
    [getCurrentNavigationState]
  );

  const detachTabToNewWindow = useCallback(
    async (tabId: string) => {
      const tab = rawTabs.find((item) => item.id === tabId);
      const state = getCurrentNavigationState(tabId);
      const tabView = tab ? getTabViewModel(tab) : null;

      if (!tab || !state || !("workspaceId" in state.location)) {
        return false;
      }

      if (state.location.kind === "workspace-page") {
        const workspace = getWorkspace(state.location.workspaceId);
        if (!workspace?.path) {
          return false;
        }

        await invoke("open_workspace_page_preview_window", {
          workspaceId: state.location.workspaceId,
          workspacePath: workspace.path,
          slug: state.location.pageSlug,
          title: tabView?.label ?? state.location.pageSlug,
          view: tab.viewMode ?? "page",
        });
        closeTabStore(tabId);
        return true;
      }

      const routePath = locationToUrl(state.location);
      await invoke("open_workspace_in_new_window", {
        workspaceId: state.location.workspaceId,
        routePath,
        title: tabView?.label ?? routePath,
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
  const parsed = urlToLocation(url);
  if (parsed) {
    return parsed;
  }

  if (url === "/documents") {
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

  if (url.startsWith("/workspace/page")) {
    const parsed = new URL(url, "http://desktop.local");
    const workspaceId = parsed.searchParams.get("workspace_id");
    const pagePath = parsed.searchParams.get("page_path");
    return {
      kind: "workspace-page",
      workspaceId: workspaceId ?? "global",
      pageSlug:
        pagePath?.replace(/^pages\//, "").replace(/\/SKILL\.md$/, "") ?? "page",
    };
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

    if (parts[2] === "apps" && !parts[3]) {
      return { kind: "workspace-apps", workspaceId };
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

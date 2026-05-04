import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTabStore, selectActiveTab } from "@/stores/tab-store";
import type { PageTab, TabType } from "@/stores/tab-store";
import type { ListPagesResult, PageConfig } from "@/lib/gateway";
import type { IconData } from "@/components/ui/icon-picker";
import { resolveLocationNavigation } from "@/navigation/location-navigation";
import {
  type DesktopLocation,
  locationToUrl,
  urlToLocation,
} from "@/navigation/location";
import {
  getSettingsSectionIcon,
  getSettingsSectionLabel,
  getWorkspaceSectionLabel,
  normalizeWorkspaceSection,
} from "@/navigation/navigation-meta";
import type {
  BreadcrumbStackItem,
  PushPageOptions,
  TabNavigationState,
} from "@/navigation/view-target";
import { pageKeys } from "@/hooks/use-pages";
import { useLocalWorkspaces } from "@/hooks/use-workspaces";

export interface TabInfo {
  type: TabType;
  name: string;
  icon?: IconData;
  slug?: string;
  workspaceId?: string;
}

function inferTabType(location: DesktopLocation, fallback?: TabType): TabType {
  if (fallback) return fallback;

  switch (location.kind) {
    case "workspace-apps":
      return "workspace";
    case "workspace-page":
    case "skill-detail":
    case "mcp-server-detail":
    case "subagent-detail":
    case "prompt-detail":
    case "command-detail":
      return "page";
    case "workspace-web":
      return "web";
    case "settings":
      return "settings";
    case "documents":
    case "device-pair":
      return "workspace";
    case "workspace-home":
    case "workspace-section":
    case "workspace-agent-detail":
    case "workspace-executor-detail":
    case "agent-detail":
    case "executor-detail":
    case "global-route":
      return "workspace";
    default: {
      const exhaustive: never = location;
      return exhaustive;
    }
  }
}

function inferTabName(location: DesktopLocation, fallback?: string): string {
  if (fallback) return fallback;

  switch (location.kind) {
    case "workspace-home":
      return location.workspaceId;
    case "workspace-apps":
      return "Apps";
    case "workspace-section":
      return getWorkspaceSectionLabel(location.section) || location.section;
    case "workspace-agent-detail":
      return location.agentId;
    case "workspace-executor-detail":
      return location.executorType;
    case "workspace-page":
      return location.pageSlug;
    case "workspace-web":
      return location.title;
    case "agent-detail":
      return location.agentId;
    case "executor-detail":
      return location.executorType;
    case "skill-detail":
      return location.skillId;
    case "mcp-server-detail":
      return location.serverName;
    case "subagent-detail":
      return location.configId;
    case "prompt-detail":
      return location.promptId;
    case "command-detail":
      return location.commandId;
    case "settings":
      return getSettingsSectionLabel(location.section);
    case "documents":
      return "Documents";
    case "device-pair":
      return "Devices";
    case "global-route":
      return location.path.replace(/^\//, "");
    default: {
      const exhaustive: never = location;
      return exhaustive;
    }
  }
}

function inferTabSlug(location: DesktopLocation, fallback?: string): string | undefined {
  if (fallback) return fallback;

  switch (location.kind) {
    case "workspace-apps":
      return "apps";
    case "workspace-section":
      return location.section;
    case "workspace-agent-detail":
      return location.agentId;
    case "workspace-executor-detail":
      return location.executorType;
    case "workspace-page":
      return location.pageSlug;
    case "workspace-web":
      return location.webId ?? location.url;
    case "agent-detail":
      return location.agentId;
    case "executor-detail":
      return location.executorType;
    case "skill-detail":
      return location.skillId;
    case "mcp-server-detail":
      return location.serverName;
    case "subagent-detail":
      return location.configId;
    case "prompt-detail":
      return location.promptId;
    case "command-detail":
      return location.commandId;
    case "settings":
      return location.section;
    case "global-route":
      return location.path;
    default:
      return undefined;
  }
}

function inferWorkspaceId(location: DesktopLocation, fallback?: string): string | undefined {
  if (fallback) return fallback;
  return "workspaceId" in location ? location.workspaceId : undefined;
}

export function usePageTabs() {
  const queryClient = useQueryClient();
  const { getWorkspace } = useLocalWorkspaces();
  const tabs = useTabStore((state) => state.tabs);
  const activeTabId = useTabStore((state) => state.activeTabId);
  const activeTab = useTabStore(selectActiveTab);

  const openTab = useTabStore((state) => state.openTab);
  const closeTabStore = useTabStore((state) => state.closeTab);
  const setActiveTab = useTabStore((state) => state.setActiveTab);
  const updateTab = useTabStore((state) => state.updateTab);
  const navigate = useTabStore((state) => state.navigate);
  const navigateToLocationStore = useTabStore((state) => state.navigateToLocation);
  const replaceLocationStore = useTabStore((state) => state.replaceLocation);
  const pushPageStore = useTabStore((state) => state.pushPage);
  const popToStore = useTabStore((state) => state.popTo);
  const resetStackStore = useTabStore((state) => state.resetStack);
  const jumpToHistoryStore = useTabStore((state) => state.jumpToHistory);
  const goBack = useTabStore((state) => state.goBack);
  const goForward = useTabStore((state) => state.goForward);
  const canGoBack = useTabStore((state) => state.canGoBack);
  const canGoForward = useTabStore((state) => state.canGoForward);
  const getCurrentUrl = useTabStore((state) => state.getCurrentUrl);
  const getCurrentNavigationState = useTabStore((state) => state.getCurrentNavigationState);

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
        tabInfo?: Partial<TabInfo>;
        breadcrumbStack?: BreadcrumbStackItem[];
        openInNewTab?: boolean;
      }
    ) => {
      const resolvedNavigation = resolveNavigation(location, {
        breadcrumbStack: options?.breadcrumbStack,
        title: options?.tabInfo?.name,
        icon: options?.tabInfo?.icon,
        workspaceId: options?.tabInfo?.workspaceId,
      });
      const navigationState: TabNavigationState = {
        location,
        breadcrumbStack: resolvedNavigation.breadcrumbStack,
      };
      const leaf = resolvedNavigation.leaf;

      const nextTab = {
        type: inferTabType(location, options?.tabInfo?.type),
        slug: inferTabSlug(location, options?.tabInfo?.slug),
        workspaceId: inferWorkspaceId(location, options?.tabInfo?.workspaceId),
        name: leaf?.label ?? inferTabName(location, options?.tabInfo?.name),
        icon: leaf?.icon ?? options?.tabInfo?.icon,
        pinned: false,
      };

      if (options?.openInNewTab || !activeTabId) {
        return openTab({
          ...nextTab,
          navigationState,
        });
      }

      updateTab(activeTabId, nextTab);
      navigateToLocationStore(activeTabId, location, {
        breadcrumbStack: navigationState.breadcrumbStack,
      });
      return activeTabId;
    },
    [activeTabId, navigateToLocationStore, openTab, resolveNavigation, updateTab]
  );

  const replaceLocation = useCallback(
    (
      location: DesktopLocation,
      patch?: Partial<TabNavigationState>,
      tabInfo?: Partial<TabInfo>
    ) => {
      if (!activeTabId) {
        return openLocation(location, {
          tabInfo,
          breadcrumbStack: patch?.breadcrumbStack,
          openInNewTab: true,
        });
      }

      updateTab(activeTabId, {
        type: inferTabType(location, tabInfo?.type),
        slug: inferTabSlug(location, tabInfo?.slug),
        workspaceId: inferWorkspaceId(location, tabInfo?.workspaceId),
        name: inferTabName(location, tabInfo?.name),
        icon: tabInfo?.icon,
      });
      replaceLocationStore(activeTabId, location, patch);
      return activeTabId;
    },
    [activeTabId, openLocation, replaceLocationStore, updateTab]
  );

  const pushPage = useCallback(
    (
      item: BreadcrumbStackItem,
      nextLocation: DesktopLocation,
      options?: PushPageOptions,
      tabInfo?: Partial<TabInfo>
    ) => {
      if (!activeTabId) {
        const resolvedNavigation = resolveNavigation(nextLocation, {
          title: tabInfo?.name,
          icon: tabInfo?.icon,
          workspaceId: tabInfo?.workspaceId,
        });
        return openLocation(nextLocation, {
          tabInfo,
          breadcrumbStack: [...resolvedNavigation.breadcrumbStack, item],
          openInNewTab: true,
        });
      }

      updateTab(activeTabId, {
        type: inferTabType(nextLocation, tabInfo?.type),
        slug: inferTabSlug(nextLocation, tabInfo?.slug),
        workspaceId: inferWorkspaceId(nextLocation, tabInfo?.workspaceId),
        name: inferTabName(nextLocation, tabInfo?.name),
        icon: tabInfo?.icon,
      });
      pushPageStore(activeTabId, item, nextLocation, options);
      return activeTabId;
    },
    [activeTabId, openLocation, pushPageStore, updateTab]
  );

  const popTo = useCallback(
    (index: number) => {
      if (!activeTabId) return;
      popToStore(activeTabId, index);
    },
    [activeTabId, popToStore]
  );

  const resetStack = useCallback(
    (next: TabNavigationState, tabInfo?: Partial<TabInfo>) => {
      if (!activeTabId) {
        return openLocation(next.location, {
          tabInfo,
          breadcrumbStack: next.breadcrumbStack,
          openInNewTab: true,
        });
      }

      updateTab(activeTabId, {
        type: inferTabType(next.location, tabInfo?.type),
        slug: inferTabSlug(next.location, tabInfo?.slug),
        workspaceId: inferWorkspaceId(next.location, tabInfo?.workspaceId),
        name: inferTabName(next.location, tabInfo?.name),
        icon: tabInfo?.icon,
      });
      resetStackStore(activeTabId, next);
      return activeTabId;
    },
    [activeTabId, openLocation, resetStackStore, updateTab]
  );

  const navigateTo = useCallback(
    (url: string, tabInfo: TabInfo) => {
      const isExternal = url.startsWith("http://") || url.startsWith("https://");
      if (isExternal) {
        const workspaceId = tabInfo.workspaceId ?? "global";
        return openLocation(
          {
            kind: "workspace-web",
            workspaceId,
            url,
            title: tabInfo.name,
          },
          { tabInfo }
        );
      }

      if (activeTabId) {
        updateTab(activeTabId, {
          type: tabInfo.type,
          slug: tabInfo.slug,
          workspaceId: tabInfo.workspaceId,
          name: tabInfo.name,
          icon: tabInfo.icon,
        });
        navigate(activeTabId, url);
        return activeTabId;
      }

      const location = buildLocationFromLegacyUrl(url);
      const resolvedNavigation = resolveNavigation(location, {
        title: tabInfo.name,
        icon: tabInfo.icon,
        workspaceId: tabInfo.workspaceId,
      });
      return openTab({
        type: tabInfo.type,
        slug: tabInfo.slug,
        workspaceId: tabInfo.workspaceId,
        name: tabInfo.name,
        icon: tabInfo.icon,
        pinned: false,
        navigationState: {
          location,
          breadcrumbStack: resolvedNavigation.breadcrumbStack,
        },
      });
    },
    [activeTabId, navigate, openLocation, openTab, resolveNavigation, updateTab]
  );

  const openPageTab = useCallback(
    (page: PageConfig, workspaceId: string, breadcrumbStack?: BreadcrumbStackItem[]) =>
      openLocation(
        {
          kind: "workspace-page",
          workspaceId,
          pageSlug: page.slug,
        },
        {
          breadcrumbStack,
          tabInfo: {
            type: "page",
            slug: page.slug,
            workspaceId,
            name: page.name,
            icon: page.icon ?? { type: "lucide", value: "file-text" },
          },
        }
      ),
    [openLocation]
  );

  const openPageInNewTab = useCallback(
    (page: PageConfig, workspaceId: string, breadcrumbStack?: BreadcrumbStackItem[]) =>
      openLocation(
        {
          kind: "workspace-page",
          workspaceId,
          pageSlug: page.slug,
        },
        {
          openInNewTab: true,
          breadcrumbStack,
          tabInfo: {
            type: "page",
            slug: page.slug,
            workspaceId,
            name: page.name,
            icon: page.icon ?? { type: "lucide", value: "file-text" },
          },
        }
      ),
    [openLocation]
  );

  const openWorkspaceView = useCallback(
    (workspaceId: string, viewPath: string, viewName: string, icon: IconData) => {
      if (!viewPath) {
        return openLocation(
          { kind: "workspace-home", workspaceId },
          {
            tabInfo: {
              type: "workspace",
              slug: "home",
              workspaceId,
              name: viewName,
              icon,
            },
          }
        );
      }

      return openLocation(
        {
          kind: "workspace-section",
          workspaceId,
          section: normalizeWorkspaceSection(viewPath),
        },
        {
          tabInfo: {
            type: "workspace",
            slug: viewPath,
            workspaceId,
            name: viewName,
            icon,
          },
        }
      );
    },
    [openLocation]
  );

  const openGlobalView = useCallback(
    (path: string, name: string, icon: IconData) => {
      const location = buildLocationFromLegacyUrl(path);
      return openLocation(location, {
        tabInfo: {
          type: inferTabType(location, "settings"),
          name,
          icon:
            location.kind === "settings"
              ? getSettingsSectionIcon(location.section)
              : icon,
        },
      });
    },
    [openLocation]
  );

  const openWebUrl = useCallback(
    (url: string, title?: string, workspaceId = activeTab?.workspaceId ?? "global") =>
      openLocation(
        {
          kind: "workspace-web",
          workspaceId,
          title: title ?? safeHostname(url),
          url,
        },
        {
          tabInfo: {
            type: "web",
            workspaceId,
            name: title ?? safeHostname(url),
            icon: { type: "lucide", value: "globe" },
          },
        }
      ),
    [activeTab?.workspaceId, openLocation]
  );

  const openChatTab = useCallback(
    (_chatId: string, chatName: string, workspaceId: string) =>
      openLocation(
        {
          kind: "workspace-section",
          workspaceId,
          section: "chat",
        },
        {
          tabInfo: {
            type: "chat",
            slug: "chat",
            workspaceId,
            name: chatName,
            icon: { type: "lucide", value: "message-square" },
          },
        }
      ),
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

  const navigateInTab = useCallback(
    (url: string) => {
      if (!activeTabId) return;
      navigate(activeTabId, url);
    },
    [activeTabId, navigate]
  );

  const goBackInTab = useCallback(() => {
    if (activeTabId && canGoBack(activeTabId)) {
      goBack(activeTabId);
    }
  }, [activeTabId, canGoBack, goBack]);

  const goForwardInTab = useCallback(() => {
    if (activeTabId && canGoForward(activeTabId)) {
      goForward(activeTabId);
    }
  }, [activeTabId, canGoForward, goForward]);

  const jumpToHistory = useCallback(
    (historyIndex: number) => {
      if (!activeTabId) return;
      jumpToHistoryStore(activeTabId, historyIndex);
    },
    [activeTabId, jumpToHistoryStore]
  );

  const getTabLink = useCallback(
    (tabId: string) => {
      const state = getCurrentNavigationState(tabId);
      return state ? locationToUrl(state.location) : null;
    },
    [getCurrentNavigationState]
  );

  return {
    tabs,
    activeTab,
    activeTabId,
    navigateTo,
    openLocation,
    replaceLocation,
    pushPage,
    popTo,
    resetStack,
    openPageTab,
    openWorkspaceView,
    openGlobalView,
    openWebUrl,
    openChatTab,
    openPageInNewTab,
    switchToTab,
    closeTab,
    getTabLink,
    navigateInTab,
    goBackInTab,
    goForwardInTab,
    jumpToHistory,
    canGoBack: activeTabId ? canGoBack(activeTabId) : false,
    canGoForward: activeTabId ? canGoForward(activeTabId) : false,
    currentUrl: activeTabId ? getCurrentUrl(activeTabId) : null,
    currentNavigationState: activeTabId
      ? getCurrentNavigationState(activeTabId)
      : null,
  };
}

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
    return { kind: "settings", section };
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

export type { PageTab, TabType };

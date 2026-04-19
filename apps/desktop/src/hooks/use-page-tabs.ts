// apps/desktop/src/hooks/use-page-tabs.ts

/**
 * Hook for managing page tabs
 *
 * Provides convenient tab operation methods, wrapping the underlying tab-store operations.
 * All navigation updates the current tab instead of creating new tabs.
 */

import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTabStore, selectActiveTab } from "@/stores/tab-store";
import type { PageTab, TabType } from "@/stores/tab-store";
import type { PageConfig } from "@/lib/gateway";

/**
 * Tab info for navigation - used to update the current tab
 */
export interface TabInfo {
  type: TabType;
  name: string;
  icon: string;
  slug?: string;
  workspaceId?: string;
}

export function usePageTabs() {
  const navigate = useNavigate();

  const tabs = useTabStore((state) => state.tabs);
  const activeTabId = useTabStore((state) => state.activeTabId);
  const activeTab = useTabStore(selectActiveTab);

  const openTab = useTabStore((state) => state.openTab);
  const closeTab = useTabStore((state) => state.closeTab);
  const setActiveTab = useTabStore((state) => state.setActiveTab);
  const updateTab = useTabStore((state) => state.updateTab);
  const tabNavigate = useTabStore((state) => state.navigate);
  const goBack = useTabStore((state) => state.goBack);
  const goForward = useTabStore((state) => state.goForward);
  const canGoBack = useTabStore((state) => state.canGoBack);
  const canGoForward = useTabStore((state) => state.canGoForward);
  const getCurrentUrl = useTabStore((state) => state.getCurrentUrl);

  /**
   * Navigate to a URL and update the current tab info.
   * This is the primary navigation method - always updates current tab.
   *
   * @param url - The URL to navigate to (internal route or external http/https)
   * @param tabInfo - Tab display info (name, icon, type)
   */
  const navigateTo = useCallback(
    (url: string, tabInfo: TabInfo) => {
      // Determine if this is an external URL
      const isExternal = url.startsWith("http://") || url.startsWith("https://");

      // If there's an active tab, update it
      if (activeTabId) {
        updateTab(activeTabId, {
          type: isExternal ? "web" : tabInfo.type,
          slug: tabInfo.slug,
          workspaceId: tabInfo.workspaceId,
          name: tabInfo.name,
          icon: tabInfo.icon,
        });
        tabNavigate(activeTabId, url);

        // For internal routes, use react-router navigate
        // For external URLs, we'd need a webview (handled by the page component)
        if (!isExternal) {
          navigate(url);
        }
        return activeTabId;
      }

      // No active tab, create one (only happens on first navigation)
      const tabId = openTab(
        {
          type: isExternal ? "web" : tabInfo.type,
          slug: tabInfo.slug,
          workspaceId: tabInfo.workspaceId,
          name: tabInfo.name,
          icon: tabInfo.icon,
          pinned: false,
        },
        url
      );

      if (!isExternal) {
        navigate(url);
      }
      return tabId;
    },
    [activeTabId, openTab, updateTab, tabNavigate, navigate]
  );

  /**
   * Navigate to a workspace page (from pages/ directory)
   */
  const openPageTab = useCallback(
    (page: PageConfig, workspaceId: string) => {
      const url = `/workspace/page?workspace_id=${workspaceId}&page_path=pages/${page.slug}/SKILL.md`;
      return navigateTo(url, {
        type: "page",
        slug: page.slug,
        workspaceId,
        name: page.name,
        icon: page.icon ?? "file-text",
      });
    },
    [navigateTo]
  );

  /**
   * Navigate to a workspace view (chat, kanban, files, agents, etc.)
   */
  const openWorkspaceView = useCallback(
    (workspaceId: string, viewPath: string, viewName: string, icon: string) => {
      const url = `/workspace/${workspaceId}/${viewPath}`;
      return navigateTo(url, {
        type: "workspace",
        slug: viewPath,
        workspaceId,
        name: viewName,
        icon,
      });
    },
    [navigateTo]
  );

  /**
   * Navigate to a global route (settings, documents, etc.)
   */
  const openGlobalView = useCallback(
    (path: string, name: string, icon: string) => {
      return navigateTo(path, {
        type: "settings",
        name,
        icon,
      });
    },
    [navigateTo]
  );

  /**
   * Navigate to an external web URL
   */
  const openWebUrl = useCallback(
    (url: string, title?: string) => {
      return navigateTo(url, {
        type: "web",
        name: title ?? new URL(url).hostname,
        icon: "globe",
      });
    },
    [navigateTo]
  );

  // Open a chat - updates current tab
  const openChatTab = useCallback(
    (chatId: string, chatName: string, workspaceId: string) => {
      const url = `/workspace/${workspaceId}/chat?chat_id=${chatId}`;
      return navigateTo(url, {
        type: "chat",
        slug: chatId,
        workspaceId,
        name: chatName,
        icon: "message-square",
      });
    },
    [navigateTo]
  );

  // Switch to a specific tab (used by tab bar clicks)
  const switchToTab = useCallback(
    (tabId: string) => {
      setActiveTab(tabId);
      const url = getCurrentUrl(tabId);
      if (url) {
        // Check if external URL
        if (url.startsWith("http://") || url.startsWith("https://")) {
          // External URLs are handled by webview in the page
          // Just set active tab, don't navigate
        } else {
          navigate(url);
        }
      }
    },
    [setActiveTab, getCurrentUrl, navigate]
  );

  // Close tab with navigation
  const closeTabWithNav = useCallback(
    (tabId: string) => {
      const tabIndex = tabs.findIndex((t) => t.id === tabId);
      const isActive = activeTabId === tabId;

      closeTab(tabId);

      if (isActive && tabs.length > 1) {
        // Navigate to next tab
        const remainingTabs = tabs.filter((t) => t.id !== tabId);
        const nextTab = remainingTabs[Math.min(tabIndex, remainingTabs.length - 1)];
        if (nextTab) {
          const url = nextTab.history[nextTab.historyIndex];
          if (url && !url.startsWith("http://") && !url.startsWith("https://")) {
            navigate(url);
          }
        }
      }
    },
    [tabs, activeTabId, closeTab, navigate]
  );

  // Navigate within current tab (for internal navigation without changing tab info)
  const navigateInTab = useCallback(
    (url: string) => {
      if (activeTabId) {
        tabNavigate(activeTabId, url);
      }
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        navigate(url);
      }
    },
    [activeTabId, tabNavigate, navigate]
  );

  // Go back in current tab
  const goBackInTab = useCallback(() => {
    if (activeTabId && canGoBack(activeTabId)) {
      goBack(activeTabId);
      const url = getCurrentUrl(activeTabId);
      if (url && !url.startsWith("http://") && !url.startsWith("https://")) {
        navigate(url);
      }
    }
  }, [activeTabId, canGoBack, goBack, getCurrentUrl, navigate]);

  // Go forward in current tab
  const goForwardInTab = useCallback(() => {
    if (activeTabId && canGoForward(activeTabId)) {
      goForward(activeTabId);
      const url = getCurrentUrl(activeTabId);
      if (url && !url.startsWith("http://") && !url.startsWith("https://")) {
        navigate(url);
      }
    }
  }, [activeTabId, canGoForward, goForward, getCurrentUrl, navigate]);

  return {
    // State
    tabs,
    activeTab,
    activeTabId,
    // Primary navigation (updates current tab)
    navigateTo,
    openPageTab,
    openWorkspaceView,
    openGlobalView,
    openWebUrl,
    openChatTab,
    // Tab switching (for tab bar)
    switchToTab,
    closeTab: closeTabWithNav,
    // History navigation
    navigateInTab,
    goBackInTab,
    goForwardInTab,
    canGoBack: activeTabId ? canGoBack(activeTabId) : false,
    canGoForward: activeTabId ? canGoForward(activeTabId) : false,
  };
}

// Re-export types for convenience
export type { PageTab, TabType };

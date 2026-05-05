import { useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { selectActiveTab, useTabStore } from "@/stores/tab-store";
import { resolveLocationNavigation } from "@/navigation/location-navigation";
import { locationToUrl, urlToLocation, type DesktopLocation } from "@/navigation/navigation-meta";
import type { ListPagesResult, PageConfig } from "@/lib/gateway";
import { pageKeys } from "@/hooks/use-pages";
import { useLocalWorkspaces } from "@/hooks/use-workspaces";

export function TabRouterBridge() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { getWorkspace } = useLocalWorkspaces();

  const activeTabId = useTabStore((state) => state.activeTabId);
  const activeTab = useTabStore(selectActiveTab);
  const openTab = useTabStore((state) => state.openTab);
  const navigateToLocation = useTabStore((state) => state.navigateToLocation);

  const currentUrl = useMemo(
    () =>
      `${location.pathname}${location.search}${location.hash}`,
    [location.hash, location.pathname, location.search]
  );

  const syncLockRef = useRef<string | null>(null);
  const targetUrl = useMemo(() => {
    if (!activeTab) return null;
    const currentState = activeTab.navigationHistory[activeTab.historyIndex];
    return currentState ? locationToUrl(currentState.location) : activeTab.history[activeTab.historyIndex] ?? null;
  }, [activeTab]);
  const activeTabState = useMemo(
    () =>
      activeTab?.navigationHistory[activeTab.historyIndex] ?? null,
    [activeTab]
  );

  const resolveNavigation = useMemo(
    () =>
      (nextLocation: DesktopLocation, input?: { title?: string }) => {
        const workspaceId =
          "workspaceId" in nextLocation ? nextLocation.workspaceId : undefined;
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
          location: nextLocation,
          workspace,
          pages,
          title: input?.title,
        });
      },
    [getWorkspace, queryClient]
  );

  useEffect(() => {
    if (!activeTabId || !targetUrl) return;
    if (!targetUrl || targetUrl === currentUrl) return;
    if (syncLockRef.current === `router:${targetUrl}`) {
      syncLockRef.current = null;
      return;
    }

    syncLockRef.current = `tab:${targetUrl}`;
    navigate(targetUrl, { replace: true });
  }, [activeTabId, currentUrl, navigate, targetUrl]);

  useEffect(() => {
    if (syncLockRef.current === `tab:${currentUrl}`) {
      syncLockRef.current = null;
      return;
    }

    const parsed = urlToLocation(currentUrl);
    if (!parsed) return;

    if (!activeTabId) {
      const resolved = resolveNavigation(parsed);
      openTab(
        {
          type: inferTabType(parsed),
          name: resolved.leaf?.label ?? inferTabName(parsed),
          pinned: false,
          workspaceId: "workspaceId" in parsed ? parsed.workspaceId : undefined,
          slug: inferSlug(parsed),
          navigationState: {
            location: parsed,
            breadcrumbStack: resolved.breadcrumbStack,
          },
        },
        currentUrl
      );
      return;
    }

    const currentStateUrl = activeTabState
      ? locationToUrl(activeTabState.location)
      : null;
    if (currentStateUrl === currentUrl) return;

    const resolved = resolveNavigation(parsed);
    syncLockRef.current = `router:${currentUrl}`;
    navigateToLocation(activeTabId, parsed, {
      breadcrumbStack: resolved.breadcrumbStack,
    });
  }, [
    activeTabId,
    activeTabState,
    currentUrl,
    navigateToLocation,
    openTab,
    resolveNavigation,
  ]);

  return null;
}

function inferTabType(location: DesktopLocation) {
  switch (location.kind) {
    case "workspace-apps":
      return "workspace" as const;
    case "workspace-page":
    case "skill-detail":
    case "mcp-server-detail":
    case "subagent-detail":
    case "prompt-detail":
    case "command-detail":
      return "page" as const;
    case "workspace-web":
      return "web" as const;
    case "settings":
      return "settings" as const;
    default:
      return "workspace" as const;
  }
}

function inferTabName(location: DesktopLocation): string {
  switch (location.kind) {
    case "workspace-home":
      return location.workspaceId;
    case "workspace-apps":
      return "Apps";
    case "workspace-section":
      return location.section;
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
      return location.section ?? "settings";
    case "documents":
      return "documents";
    case "device-pair":
      return "devices";
    case "global-route":
      return location.path.replace(/^\//, "");
    default: {
      const exhaustive: never = location;
      return exhaustive;
    }
  }
}

function inferSlug(location: DesktopLocation): string | undefined {
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

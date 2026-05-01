import { useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { selectActiveTab, useTabStore } from "@/stores/tab-store";
import { createStackForLocation } from "@/navigation/breadcrumb-stack";
import { locationToUrl, urlToLocation } from "@/navigation/location";
import type { DesktopLocation } from "@/navigation/location";

export function TabRouterBridge() {
  const navigate = useNavigate();
  const location = useLocation();

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
      openTab(
        {
          type: inferTabType(parsed),
          name: inferTabName(parsed),
          pinned: false,
          workspaceId: "workspaceId" in parsed ? parsed.workspaceId : undefined,
          slug: inferSlug(parsed),
          navigationState: {
            location: parsed,
            breadcrumbStack: createStackForLocation(parsed),
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

    syncLockRef.current = `router:${currentUrl}`;
    navigateToLocation(activeTabId, parsed, {
      breadcrumbStack: createStackForLocation(parsed),
    });
  }, [
    activeTabId,
    activeTabState,
    currentUrl,
    navigateToLocation,
    openTab,
  ]);

  return null;
}

function inferTabType(location: DesktopLocation) {
  switch (location.kind) {
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

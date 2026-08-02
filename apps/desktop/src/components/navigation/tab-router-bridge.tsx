import { useEffect, useRef } from "react";
import {
  useLocation,
  useNavigate as useRouterNavigate,
} from "react-router-dom";
import { registry } from "@/navigation/route-registry";
import { buildColdStartBreadcrumb } from "@/navigation/breadcrumb-builder";
import { getCurrentWindowTabStore, selectActiveTab } from "@/stores/tab-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import {
  hasNewTabRequest,
  withoutNewTabRequest,
} from "@/navigation/new-tab-request";

function canonicalizeNewTabUrl(url: string): string {
  return withoutNewTabRequest(url);
}

function normalizeUrlPreservingHash(url: string): string {
  const hashIndex = url.indexOf("#");
  const pathAndSearch = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const hash = hashIndex >= 0 ? url.slice(hashIndex) : "";
  const normalized = registry.normalizeUrl(pathAndSearch);
  // Normalize bare /workspace to /workspace/global to prevent redirect loops
  // caused by WorkspaceRedirect in React Router.
  const safe = normalized === "/workspace" ? "/workspace/global" : normalized;
  return `${safe}${hash}`;
}

/**
 * Tab-Router Bridge
 *
 * Unidirectional sync: Tab Store → React Router.
 * The tab store is the single source of truth for navigation state.
 * The router is a pure projection — it never writes back to the store.
 */
export function TabRouterBridge() {
  const routerNavigate = useRouterNavigate();
  const location = useLocation();
  const tabStore = useRef(getCurrentWindowTabStore()).current;

  const lastPushedToRouterRef = useRef<string | null>(null);
  const handledNewTabRequestRef = useRef<string | null>(null);

  // Get the active tab's current URL from the store
  const storeUrl = tabStore((s) => {
    const tab = selectActiveTab(s);
    return tab?.navigationHistory[tab.historyIndex]?.url ?? null;
  });

  // Store actions
  const openTab = tabStore((s) => s.openTab);

  useEffect(() => {
    if (!hasNewTabRequest(location.search)) return;

    const currentRouterUrl =
      location.pathname + location.search + location.hash;
    if (handledNewTabRequestRef.current === currentRouterUrl) return;
    handledNewTabRequestRef.current = currentRouterUrl;

    const requestedUrl = canonicalizeNewTabUrl(currentRouterUrl);
    const normalizedUrl = normalizeUrlPreservingHash(requestedUrl);
    const match = registry.match(normalizedUrl);

    if (!match) {
      routerNavigate(requestedUrl, { replace: true });
      return;
    }

    lastPushedToRouterRef.current = normalizedUrl;

    openTab({
      navigationState: {
        url: normalizedUrl,
        breadcrumbStack: buildColdStartBreadcrumb(normalizedUrl),
      },
      pinned: false,
    });

    routerNavigate(normalizedUrl, { replace: true });
  }, [
    location.pathname,
    location.search,
    location.hash,
    openTab,
    routerNavigate,
  ]);

  // Store -> Router: when store URL changes, update React Router
  useEffect(() => {
    console.warn("[TabRouterBridge] Store→Router effect", { storeUrl, currentRouterPath: location.pathname + location.search + location.hash });
    if (!storeUrl) {
      console.warn("[TabRouterBridge] Store→Router: storeUrl is null, skipping");
      return;
    }
    if (hasNewTabRequest(location.search)) return;

    const currentRouterPath =
      location.pathname + location.search + location.hash;
    const normalizedStoreUrl = normalizeUrlPreservingHash(storeUrl);

    // Sync workspace store whenever the active tab's URL changes
    const match = registry.match(normalizedStoreUrl);
    const workspaceId = match?.params?.workspaceId ?? null;
    if (workspaceId) {
      const { activeWorkspaceId } = useWorkspaceStore.getState();
      if (activeWorkspaceId !== workspaceId) {
        useWorkspaceStore.getState().setActiveWorkspace(workspaceId);
      }
    }

    if (normalizedStoreUrl === currentRouterPath) return;

    lastPushedToRouterRef.current = normalizedStoreUrl;
    console.warn("[TabRouterBridge] Store→Router: navigating", { from: currentRouterPath, to: normalizedStoreUrl });
    routerNavigate(normalizedStoreUrl, { replace: true });
  }, [
    storeUrl,
    routerNavigate,
    location.pathname,
    location.search,
    location.hash,
  ]);

  // Router→Store sync is intentionally removed.
  // Tab store is the single source of truth for navigation state.
  // All navigation originates from:
  //   - Tab store (startup restore, tab switch, in-app navigation)
  //   - Deep links (handled by useDesktopDeepLink)
  //   - New tab requests (handled by the effect above)
  // The router is a pure projection of the store — it never writes back.

  return null;
}

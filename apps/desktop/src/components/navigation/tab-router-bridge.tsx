import { useEffect, useRef } from "react";
import { useLocation, useNavigate as useRouterNavigate } from "react-router-dom";
import { registry } from "@/navigation/route-registry";
import { buildColdStartBreadcrumb, buildBreadcrumbItem } from "@/navigation/breadcrumb-builder";
import { isStackPrefixOf } from "@/navigation/navigate";
import { getCurrentWindowTabStore, selectActiveTab } from "@/stores/tab-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import {
  hasNewTabRequest,
  withoutNewTabRequest,
} from "@/navigation/new-tab-request";

function canonicalizeNewTabUrl(url: string): string {
  const strippedUrl = withoutNewTabRequest(url);
  return strippedUrl === "/workspace" ? "/workspace/global" : strippedUrl;
}

function normalizeUrlPreservingHash(url: string): string {
  const hashIndex = url.indexOf("#");
  const pathAndSearch = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const hash = hashIndex >= 0 ? url.slice(hashIndex) : "";
  return `${registry.normalizeUrl(pathAndSearch)}${hash}`;
}

/**
 * Tab-Router Bridge
 *
 * Bidirectional sync between the tab store's navigation state and React Router.
 * Uses URL-based deduplication to prevent infinite loops (more reliable than
 * timing-based locks like requestAnimationFrame).
 */
export function TabRouterBridge() {
  const routerNavigate = useRouterNavigate();
  const location = useLocation();
  const tabStore = useRef(getCurrentWindowTabStore()).current;

  // Track the last URL we pushed to each direction to deduplicate
  const lastPushedToRouterRef = useRef<string | null>(null);
  const lastPushedToStoreRef = useRef<string | null>(null);
  const handledNewTabRequestRef = useRef<string | null>(null);

  // Get the active tab's current URL from the store
  const storeUrl = tabStore((s) => {
    const tab = selectActiveTab(s);
    return tab?.navigationHistory[tab.historyIndex]?.url ?? null;
  });

  // Store actions
  const openTab = tabStore((s) => s.openTab);
  const pushNavigation = tabStore((s) => s.pushNavigation);
  const resetNavigation = tabStore((s) => s.resetNavigation);

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
  }, [location.pathname, location.search, location.hash, openTab, routerNavigate]);

  // Store -> Router: when store URL changes, update React Router
  useEffect(() => {
    if (!storeUrl) return;
    if (hasNewTabRequest(location.search)) return;

    const currentRouterPath = location.pathname + location.search + location.hash;
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

    // Skip if this store URL was set by our Router->Store sync
    if (normalizedStoreUrl === lastPushedToStoreRef.current) {
      lastPushedToStoreRef.current = null;
      return;
    }

    lastPushedToRouterRef.current = normalizedStoreUrl;
    routerNavigate(normalizedStoreUrl, { replace: true });
  }, [storeUrl, routerNavigate, location.pathname, location.search, location.hash]);

  // Router -> Store: when React Router URL changes externally, update store
  // NOTE: Neither storeUrl nor activeTabId are in deps. This effect must only
  // fire when the Router location actually changes (browser back/forward, deep
  // link, etc.). Including activeTabId caused a critical race: on tab switch,
  // this effect fires with the OLD location (router hasn't updated yet) and
  // overwrites the new tab's URL with the old tab's URL. All store reads happen
  // via getState() inside the effect to get fresh values without dep coupling.
  useEffect(() => {
    if (hasNewTabRequest(location.search)) return;

    const { activeTabId: currentTabId } = tabStore.getState();
    if (!currentTabId) return;

    const currentRouterUrl = location.pathname + location.search + location.hash;
    const normalizedUrl = normalizeUrlPreservingHash(currentRouterUrl);

    // Skip if this router URL was set by our Store->Router sync
    if (normalizedUrl === lastPushedToRouterRef.current) {
      lastPushedToRouterRef.current = null;
      return;
    }

    // Read fresh from store to avoid stale closure
    const activeTab = selectActiveTab(tabStore.getState());
    const currentState = activeTab?.navigationHistory[activeTab.historyIndex];

    // Skip if URLs already match
    const currentStoreUrl = currentState?.url ?? null;
    if (currentStoreUrl && normalizeUrlPreservingHash(currentStoreUrl) === normalizedUrl) return;

    // Match against registry
    const match = registry.match(normalizedUrl);
    if (!match) {
      // Unknown URL — don't update tab store, let React Router handle it
      return;
    }

    lastPushedToStoreRef.current = normalizedUrl;

    const currentStack = currentState?.breadcrumbStack ?? [];

    if (isStackPrefixOf(currentStack, match)) {
      // Smart push: existing stack is valid ancestor chain
      const leaf = buildBreadcrumbItem(match.entry, match.params);
      pushNavigation(currentTabId, normalizedUrl, leaf);
    } else {
      // Cold-start reset: deep link or direct URL entry
      const stack = buildColdStartBreadcrumb(normalizedUrl);
      resetNavigation(currentTabId, normalizedUrl, stack);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search, location.hash, pushNavigation, resetNavigation, tabStore]);

  return null;
}

import { useEffect, useRef } from "react";
import { useLocation, useNavigate as useRouterNavigate } from "react-router-dom";
import { registry } from "@/navigation/route-registry";
import { buildColdStartBreadcrumb, buildBreadcrumbItem } from "@/navigation/breadcrumb-builder";
import { isStackPrefixOf } from "@/navigation/navigate";
import { useTabStore, selectActiveTab } from "@/stores/tab-store";

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

  // Track the last URL we pushed to each direction to deduplicate
  const lastPushedToRouterRef = useRef<string | null>(null);
  const lastPushedToStoreRef = useRef<string | null>(null);

  // Get the active tab's current URL from the store
  const activeTabId = useTabStore((s) => s.activeTabId);
  const storeUrl = useTabStore((s) => {
    const tab = selectActiveTab(s);
    return tab?.navigationHistory[tab.historyIndex]?.url ?? null;
  });

  // Store actions
  const pushNavigation = useTabStore((s) => s.pushNavigation);
  const resetNavigation = useTabStore((s) => s.resetNavigation);

  // Store -> Router: when store URL changes, update React Router
  useEffect(() => {
    if (!storeUrl) return;

    const currentRouterPath = location.pathname + location.search;
    const normalizedStoreUrl = registry.normalizeUrl(storeUrl);

    if (normalizedStoreUrl === currentRouterPath) return;

    // Skip if this store URL was set by our Router->Store sync
    if (normalizedStoreUrl === lastPushedToStoreRef.current) {
      lastPushedToStoreRef.current = null;
      return;
    }

    lastPushedToRouterRef.current = normalizedStoreUrl;
    routerNavigate(normalizedStoreUrl, { replace: true });
  }, [storeUrl, routerNavigate, location.pathname, location.search]);

  // Router -> Store: when React Router URL changes externally, update store
  // NOTE: storeUrl is intentionally NOT in deps. This effect should only fire
  // when the Router location changes (e.g. browser back/forward). Including
  // storeUrl caused a race: store updates before Router, triggering this effect
  // with stale location, which incorrectly reset the breadcrumb to the old path.
  useEffect(() => {
    if (!activeTabId) return;

    const currentRouterUrl = location.pathname + location.search;
    const normalizedUrl = registry.normalizeUrl(currentRouterUrl);

    // Skip if this router URL was set by our Store->Router sync
    if (normalizedUrl === lastPushedToRouterRef.current) {
      lastPushedToRouterRef.current = null;
      return;
    }

    // Read fresh from store to avoid stale closure
    const activeTab = selectActiveTab(useTabStore.getState());
    const currentState = activeTab?.navigationHistory[activeTab.historyIndex];

    // Skip if URLs already match
    const currentStoreUrl = currentState?.url ?? null;
    if (currentStoreUrl && registry.normalizeUrl(currentStoreUrl) === normalizedUrl) return;

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
      pushNavigation(activeTabId, normalizedUrl, leaf);
    } else {
      // Cold-start reset: deep link or direct URL entry
      const stack = buildColdStartBreadcrumb(normalizedUrl);
      resetNavigation(activeTabId, normalizedUrl, stack);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search, activeTabId, pushNavigation, resetNavigation]);

  return null;
}

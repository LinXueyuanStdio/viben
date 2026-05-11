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
 * Uses a sync lock to prevent infinite loops.
 */
export function TabRouterBridge() {
  const routerNavigate = useRouterNavigate();
  const location = useLocation();
  const syncLockRef = useRef(false);

  // Get the active tab's current URL from the store
  const activeTab = useTabStore(selectActiveTab);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const storeUrl = activeTab?.navigationHistory[activeTab.historyIndex]?.url ?? null;

  // Store actions
  const pushNavigation = useTabStore((s) => s.pushNavigation);
  const resetNavigation = useTabStore((s) => s.resetNavigation);

  // Store -> Router: when store URL changes, update React Router
  useEffect(() => {
    if (!storeUrl) return;

    const currentRouterPath = location.pathname + location.search;
    const normalizedStoreUrl = registry.normalizeUrl(storeUrl);

    if (normalizedStoreUrl === currentRouterPath) return;

    // Set sync lock to prevent Router->Store from triggering
    syncLockRef.current = true;
    routerNavigate(normalizedStoreUrl, { replace: true });

    // Release lock after React Router processes the navigation
    requestAnimationFrame(() => {
      syncLockRef.current = false;
    });
  }, [storeUrl, routerNavigate, location.pathname, location.search]);

  // Router -> Store: when React Router URL changes externally, update store
  useEffect(() => {
    // Skip if we caused this navigation (sync lock active)
    if (syncLockRef.current) return;
    if (!activeTabId) return;

    const currentRouterUrl = location.pathname + location.search;
    const normalizedUrl = registry.normalizeUrl(currentRouterUrl);

    // Skip if URLs already match
    if (storeUrl && registry.normalizeUrl(storeUrl) === normalizedUrl) return;

    // Match against registry
    const match = registry.match(normalizedUrl);
    if (!match) {
      // Unknown URL — don't update tab store, let React Router handle it
      return;
    }

    // Set sync lock to prevent Store->Router from re-triggering
    syncLockRef.current = true;

    // Get current breadcrumb stack from active tab
    const currentState = activeTab?.navigationHistory[activeTab.historyIndex];
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

    // Release lock after store update propagates
    requestAnimationFrame(() => {
      syncLockRef.current = false;
    });
  }, [location.pathname, location.search, activeTabId, storeUrl, activeTab, pushNavigation, resetNavigation]);

  return null;
}

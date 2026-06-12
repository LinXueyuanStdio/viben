import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAppStore } from "@/stores/app-store";
import { getTabUrl, useTabStore, selectActiveTab } from "@/stores/tab-store";

/**
 * Hook to track zustand persist hydration state.
 * Returns true once the store has finished rehydrating from storage.
 */
function useHasHydrated() {
  const [hasHydrated, setHasHydrated] = useState(
    useTabStore.persist.hasHydrated()
  );

  useEffect(() => {
    // If already hydrated, no need to subscribe
    if (useTabStore.persist.hasHydrated()) {
      setHasHydrated(true);
      return;
    }

    // Subscribe to hydration finish event
    const unsubscribe = useTabStore.persist.onFinishHydration(() => {
      setHasHydrated(true);
    });

    return unsubscribe;
  }, []);

  return hasHydrated;
}

/**
 * Home redirect component - redirects based on app state.
 * - First-time users are redirected to /onboarding
 * - Returning users are redirected to the active tab's current URL
 * - Fallback to /workspace if no active tab
 *
 * NOTE: We must wait for zustand persist to finish rehydrating the tab store
 * before redirecting. Otherwise, activeTab will be null (initial state) and
 * the user will always be redirected to /workspace instead of their last tab.
 */
export function HomeRedirect() {
  const { onboardingCompleted } = useAppStore();
  const activeTab = useTabStore(selectActiveTab);
  const hasHydrated = useHasHydrated();

  // Log every render with key state
  const activeUrl = activeTab ? getTabUrl(activeTab) : null;
  console.warn("[HomeRedirect] render", {
    hasHydrated,
    activeTabId: activeTab?.id ?? null,
    activeUrl,
  });

  if (!onboardingCompleted) {
    console.warn("[HomeRedirect] redirecting to /onboarding (onboarding not completed)");
    return <Navigate to="/onboarding" replace />;
  }

  // Wait for tab store to finish hydrating from localStorage
  // Without this check, activeTab is null during initial render
  if (!hasHydrated) {
    console.warn("[HomeRedirect] waiting for hydration, rendering null");
    return null;
  }

  // Log detailed info when falling back to /workspace
  if (!activeUrl) {
    const { tabs, activeTabId } = useTabStore.getState();
    console.warn("[HomeRedirect] activeUrl is null, falling back to /workspace", {
      activeTab,
      tabsLength: tabs.length,
      activeTabId,
    });
  }

  const target = activeUrl || "/workspace";
  console.warn("[HomeRedirect] navigating to:", target);
  return <Navigate to={target} replace />;
}

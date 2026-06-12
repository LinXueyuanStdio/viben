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

  if (!onboardingCompleted) {
    return <Navigate to="/onboarding" replace />;
  }

  // Wait for tab store to finish hydrating from localStorage
  // Without this check, activeTab is null during initial render
  if (!hasHydrated) {
    return null;
  }

  // Restore the active tab's current URL if available
  const activeUrl = activeTab ? getTabUrl(activeTab) : null;

  return <Navigate to={activeUrl || "/workspace"} replace />;
}

import { Navigate } from "react-router-dom";
import { useAppStore } from "@/stores/app-store";
import { getTabUrl, useTabStore, selectActiveTab } from "@/stores/tab-store";

/**
 * Home redirect component - redirects based on app state.
 * - First-time users are redirected to /onboarding
 * - Returning users are redirected to the active tab's current URL
 * - Fallback to /workspace if no active tab
 */
export function HomeRedirect() {
  const { onboardingCompleted } = useAppStore();
  const activeTab = useTabStore(selectActiveTab);

  if (!onboardingCompleted) {
    return <Navigate to="/onboarding" replace />;
  }

  // Restore the active tab's current URL if available
  const activeUrl = activeTab ? getTabUrl(activeTab) : null;

  return <Navigate to={activeUrl || "/workspace"} replace />;
}

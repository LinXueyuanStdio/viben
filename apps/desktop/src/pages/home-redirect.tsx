import { Navigate } from "react-router-dom";
import { useAppStore } from "@/stores/app-store";

/**
 * Home redirect component - redirects based on app state.
 * - First-time users are redirected to /onboarding
 * - Returning users are redirected to /workspace/global
 */
export function HomeRedirect() {
  const { onboardingCompleted } = useAppStore();

  if (!onboardingCompleted) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Navigate to="/workspace/global" replace />;
}

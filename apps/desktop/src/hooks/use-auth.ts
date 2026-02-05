import { useCallback, useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { useAuthStore } from "@/stores/auth-store";

/**
 * Hook for authentication with auto-refresh support
 *
 * Wraps the auth store and provides:
 * - Auto-refresh of session before expiry
 * - Convenient access to auth state and methods
 * - Session initialization on mount
 *
 * @example
 * ```tsx
 * function UserProfile() {
 *   const { user, isAuthenticated, isLoading, login, logout } = useAuth();
 *
 *   if (isLoading) return <Spinner />;
 *   if (!isAuthenticated) return <LoginForm onSubmit={login} />;
 *
 *   return (
 *     <div>
 *       <Avatar src={user?.avatarUrl} />
 *       <span>{user?.displayName}</span>
 *       <button onClick={logout}>Logout</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useAuth() {
  const store = useAuthStore();
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear any existing timeout
  const clearRefreshTimeout = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
  }, []);

  // Schedule session refresh before expiry
  const scheduleRefresh = useCallback(() => {
    const { user, refreshSession } = useAuthStore.getState();

    if (!user?.expiresAt) {
      return;
    }

    // Calculate time until expiry (expiresAt is in milliseconds)
    const now = Date.now();
    const expiresIn = user.expiresAt - now;

    // Refresh 5 minutes before expiry
    const refreshThreshold = 5 * 60 * 1000;

    // If already expired or about to expire, refresh immediately
    if (expiresIn <= refreshThreshold) {
      refreshSession().catch((err) => {
        console.error("Session refresh failed:", err);
      });
      return;
    }

    // Schedule refresh for 5 minutes before expiry
    const refreshIn = expiresIn - refreshThreshold;

    clearRefreshTimeout();
    refreshTimeoutRef.current = setTimeout(() => {
      refreshSession().catch((err) => {
        console.error("Scheduled session refresh failed:", err);
      });
    }, refreshIn);
  }, [clearRefreshTimeout]);

  // Auto-refresh session before expiry
  useEffect(() => {
    if (!store.user) {
      clearRefreshTimeout();
      return;
    }

    scheduleRefresh();

    return () => {
      clearRefreshTimeout();
    };
  }, [store.user?.expiresAt, scheduleRefresh, clearRefreshTimeout]);

  // Initialize auth state on mount
  useEffect(() => {
    store.initializeAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for OAuth callback from deep link (browsemcp://oauth?code=xxx)
  useEffect(() => {
    const unlisten = listen<string>("oauth-callback", async (event) => {
      const code = event.payload;
      if (code) {
        try {
          await store.handleOAuthCallback(code);
        } catch (err) {
          console.error("OAuth callback failed:", err);
        }
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    /** Current user session */
    user: store.user,
    /** Whether user is authenticated */
    isAuthenticated: store.isAuthenticated,
    /** Loading state for auth operations */
    isLoading: store.isLoading,
    /** Error message from last failed operation */
    error: store.error,
    /** Login with email and password */
    login: store.login,
    /** Initiate GitHub OAuth flow */
    loginWithGitHub: store.loginWithGitHub,
    /** Handle OAuth callback */
    handleOAuthCallback: store.handleOAuthCallback,
    /** Log out and clear session */
    logout: store.logout,
    /** Refresh session manually */
    refreshSession: store.refreshSession,
    /** Clear error state */
    clearError: store.clearError,
  };
}

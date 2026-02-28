import { useCallback, useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "@/hooks/use-toast";

/**
 * Hook for authentication with auto-refresh support
 *
 * Wraps the auth store and provides:
 * - Auto-refresh of session before expiry
 * - Convenient access to auth state and methods
 * - Session initialization on mount
 * - Toast notifications for auth events
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

  // Listen for OAuth callback from deep link (viben://oauth?session=<base64url>)
  useEffect(() => {
    const unlistenCallback = listen<string>("oauth-callback", async (event) => {
      const sessionBase64 = event.payload;
      if (sessionBase64) {
        try {
          // Decode base64url to JSON
          const sessionJson = atob(sessionBase64.replace(/-/g, '+').replace(/_/g, '/'));
          const sessionData = JSON.parse(sessionJson);

          // Set session directly from decoded data
          await store.setSessionFromOAuth(sessionData);

          // Show success toast
          const { user } = useAuthStore.getState();
          toast.success("登录成功", {
            description: `欢迎回来，${user?.displayName || user?.username}！`,
          });
        } catch (err) {
          console.error("OAuth callback failed:", err);
          toast.error("登录失败", {
            description: err instanceof Error ? err.message : "OAuth 回调处理失败",
          });
        }
      }
    });

    const unlistenError = listen<string>("oauth-error", async (event) => {
      const error = event.payload;
      console.error("OAuth error:", error);
      store.setLoading(false);
      toast.error("登录失败", {
        description: `OAuth 认证失败: ${error}`,
      });
    });

    return () => {
      unlistenCallback.then((fn) => fn());
      unlistenError.then((fn) => fn());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Login with GitHub - opens browser
  const loginWithGitHub = useCallback(async () => {
    store.setLoading(true);
    store.clearError();

    try {
      const url = store.getGitHubOAuthUrl();
      await openUrl(url);
      toast.info("正在浏览器中打开", {
        description: "请在浏览器中完成 GitHub 授权",
      });
      // Keep loading true - will be set to false by OAuth callback
    } catch (err) {
      store.setLoading(false);
      const errorMessage = err instanceof Error ? err.message : String(err);
      toast.error("无法打开浏览器", {
        description: errorMessage,
      });
      throw err;
    }
  }, [store]);

  // Wrapped login with toast
  const login = useCallback(
    async (email: string, password: string) => {
      try {
        await store.login(email, password);
        const { user } = useAuthStore.getState();
        toast.success("登录成功", {
          description: `欢迎回来，${user?.displayName || user?.username}！`,
        });
      } catch (err) {
        toast.error("登录失败", {
          description: err instanceof Error ? err.message : "邮箱或密码错误",
        });
        throw err;
      }
    },
    [store]
  );

  // Wrapped logout with toast
  const logout = useCallback(async () => {
    await store.logout();
    toast.info("已退出登录");
  }, [store]);

  return {
    /** Current user session */
    user: store.user,
    /** Whether user is authenticated */
    isAuthenticated: store.isAuthenticated,
    /** Loading state for auth operations */
    isLoading: store.isLoading,
    /** Error message from last failed operation */
    error: store.error,
    /** Whether initial auth check is complete */
    isInitialized: store.isInitialized,
    /** Login with email and password */
    login,
    /** Initiate GitHub OAuth flow (opens browser) */
    loginWithGitHub,
    /** Handle OAuth callback */
    handleOAuthCallback: store.handleOAuthCallback,
    /** Log out and clear session */
    logout,
    /** Refresh session manually */
    refreshSession: store.refreshSession,
    /** Clear error state */
    clearError: store.clearError,
    /** Set loading state */
    setLoading: store.setLoading,
  };
}

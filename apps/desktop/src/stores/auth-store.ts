import { create } from "zustand";
import { persist } from "zustand/middleware";
import { VibenClient, type UserSession } from "@viben/api-client";

// Re-export UserSession type for convenience
export type { UserSession };

/**
 * Platform API base URL
 */
const PLATFORM_API_URL = "https://viben-web.vercel.app";

/**
 * Singleton API client instance
 */
let apiClient: VibenClient | null = null;

/**
 * Get or create the API client instance
 */
export function getApiClient(): VibenClient {
  if (!apiClient) {
    apiClient = new VibenClient({
      baseUrl: PLATFORM_API_URL,
    });
  }
  return apiClient;
}

/**
 * Authentication state interface
 */
interface AuthState {
  /** Current user session, null if not logged in */
  user: UserSession | null;
  /** Whether user is authenticated */
  isAuthenticated: boolean;
  /** Loading state for auth operations */
  isLoading: boolean;
  /** Error message from last failed operation */
  error: string | null;
  /** Whether initial auth check is complete */
  isInitialized: boolean;

  /**
   * Login with email and password
   * @throws Error if login fails
   */
  login: (email: string, password: string) => Promise<void>;

  /**
   * Initiate GitHub OAuth flow
   * Returns the OAuth URL (caller should open in browser)
   */
  getGitHubOAuthUrl: () => string;

  /**
   * Handle OAuth callback with authorization code
   * @param code - Authorization code from OAuth provider
   * @deprecated Use setSessionFromOAuth instead - OAuth code is single-use
   */
  handleOAuthCallback: (code: string) => Promise<void>;

  /**
   * Set session directly from OAuth callback data
   * @param data - Session data from OAuth callback
   */
  setSessionFromOAuth: (data: {
    user: {
      id: string;
      email: string;
      username: string;
      displayName: string;
      avatarUrl: string | null;
    };
    accessToken: string;
    refreshToken: string | null;
    expiresAt: number;
  }) => Promise<void>;

  /**
   * Log out and clear session
   */
  logout: () => Promise<void>;

  /**
   * Refresh the current session
   * Uses refresh token to get new access token
   */
  refreshSession: () => Promise<void>;

  /**
   * Validate and restore session on app startup
   * Returns true if session is valid
   */
  initializeAuth: () => Promise<boolean>;

  /**
   * Clear any error state
   */
  clearError: () => void;

  /**
   * Set loading state (for external use during OAuth flow)
   */
  setLoading: (loading: boolean) => void;
}

/**
 * Authentication store using Zustand with persistence
 *
 * Manages user authentication state and provides methods
 * for login, logout, and session management.
 *
 * @example
 * ```tsx
 * function LoginButton() {
 *   const { isAuthenticated, user, login, logout } = useAuthStore();
 *
 *   if (isAuthenticated) {
 *     return (
 *       <button onClick={logout}>
 *         Logout {user?.displayName}
 *       </button>
 *     );
 *   }
 *
 *   return <button onClick={() => login('email', 'pass')}>Login</button>;
 * }
 * ```
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      isInitialized: false,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const client = getApiClient();
          const session = await client.auth.login({ email, password });

          // Set token for future requests
          client.setAccessToken(session.accessToken);

          set({
            user: session,
            isAuthenticated: true,
            isLoading: false,
            isInitialized: true, // Mark as initialized to prevent re-validation
          });
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          set({
            error: errorMessage,
            isLoading: false,
          });
          throw new Error(errorMessage);
        }
      },

      getGitHubOAuthUrl: () => {
        const client = getApiClient();
        return client.auth.getOAuthUrl("github", {
          redirectUri: "viben://oauth",
          client: "desktop",
        });
      },

      handleOAuthCallback: async (code: string) => {
        set({ isLoading: true, error: null });
        try {
          const client = getApiClient();
          const session = await client.auth.handleOAuthCallback("github", code);

          // Set token for future requests
          client.setAccessToken(session.accessToken);

          set({
            user: session,
            isAuthenticated: true,
            isLoading: false,
            isInitialized: true, // Mark as initialized to prevent re-validation
          });
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          set({
            error: errorMessage,
            isLoading: false,
          });
          throw new Error(errorMessage);
        }
      },

      setSessionFromOAuth: async (data) => {
        set({ isLoading: true, error: null });
        try {
          const client = getApiClient();

          // Normalize expiresAt to milliseconds
          // If expiresAt is less than a reasonable timestamp in ms (year 2000 = 946684800000),
          // it's likely in seconds and needs to be converted
          let expiresAt = data.expiresAt;
          if (expiresAt < 946684800000) {
            // Convert seconds to milliseconds
            expiresAt = expiresAt * 1000;
          }

          // Build session object
          const session: UserSession = {
            id: data.user.id,
            email: data.user.email,
            username: data.user.username,
            displayName: data.user.displayName,
            avatarUrl: data.user.avatarUrl,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            expiresAt,
          };

          // Set token for future requests
          client.setAccessToken(session.accessToken);

          set({
            user: session,
            isAuthenticated: true,
            isLoading: false,
            isInitialized: true, // Mark as initialized to prevent re-validation
          });
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          set({
            error: errorMessage,
            isLoading: false,
          });
          throw new Error(errorMessage);
        }
      },

      logout: async () => {
        const client = getApiClient();
        try {
          await client.auth.logout();
        } catch (err) {
          console.error("Logout error:", err);
        }
        // Always clear local state and token, even if backend call fails
        client.setAccessToken(undefined);
        set({
          user: null,
          isAuthenticated: false,
          error: null,
        });
      },

      refreshSession: async () => {
        const { user } = get();
        if (!user?.refreshToken) {
          throw new Error("No refresh token available");
        }

        try {
          const client = getApiClient();
          const session = await client.auth.refresh(user.refreshToken);

          // Update token for future requests
          client.setAccessToken(session.accessToken);

          set({
            user: session,
            isAuthenticated: true,
          });
        } catch (err) {
          // If refresh fails, clear the session
          const client = getApiClient();
          client.setAccessToken(undefined);
          set({
            user: null,
            isAuthenticated: false,
          });
          throw err;
        }
      },

      initializeAuth: async () => {
        const { user } = get();

        // No stored session
        if (!user?.accessToken) {
          set({ isInitialized: true });
          return false;
        }

        // Set token from stored session
        const client = getApiClient();
        client.setAccessToken(user.accessToken);

        // Check if token is expired
        const now = Date.now();
        const isExpired = user.expiresAt <= now;
        const isExpiringSoon = user.expiresAt - now < 5 * 60 * 1000; // 5 minutes

        if (isExpired || isExpiringSoon) {
          // Try to refresh the token
          if (user.refreshToken) {
            try {
              const session = await client.auth.refresh(user.refreshToken);
              client.setAccessToken(session.accessToken);
              set({
                user: session,
                isAuthenticated: true,
                isInitialized: true,
              });
              return true;
            } catch (err) {
              console.error("Session refresh failed:", err);
              client.setAccessToken(undefined);
              set({
                user: null,
                isAuthenticated: false,
                isInitialized: true,
              });
              return false;
            }
          } else {
            // No refresh token, clear session
            client.setAccessToken(undefined);
            set({
              user: null,
              isAuthenticated: false,
              isInitialized: true,
            });
            return false;
          }
        }

        // Token is valid, validate with server in background
        try {
          const { valid } = await client.auth.validate();
          if (!valid) {
            // Token rejected by server, try refresh
            if (user.refreshToken) {
              const session = await client.auth.refresh(user.refreshToken);
              client.setAccessToken(session.accessToken);
              set({
                user: session,
                isAuthenticated: true,
                isInitialized: true,
              });
              return true;
            }
            // No refresh token, clear session
            client.setAccessToken(undefined);
            set({
              user: null,
              isAuthenticated: false,
              isInitialized: true,
            });
            return false;
          }

          set({ isAuthenticated: true, isInitialized: true });
          return true;
        } catch (err) {
          console.error("Token validation failed:", err);
          // Keep the session if validation fails due to network issues
          // The token might still be valid
          set({ isAuthenticated: true, isInitialized: true });
          return true;
        }
      },

      clearError: () => set({ error: null }),

      setLoading: (loading: boolean) => set({ isLoading: loading }),
    }),
    {
      name: "viben-auth",
      partialize: (state) => ({
        // Only persist user data, not loading/error states
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

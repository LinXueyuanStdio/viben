import { create } from "zustand";
import { persist } from "zustand/middleware";
import { invoke } from "@tauri-apps/api/core";

/**
 * User session data from the platform
 */
export interface UserSession {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number;
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

  /**
   * Login with email and password
   * @throws Error if login fails
   */
  login: (email: string, password: string) => Promise<void>;

  /**
   * Initiate GitHub OAuth flow
   * Opens browser to GitHub OAuth page
   */
  loginWithGitHub: () => Promise<void>;

  /**
   * Handle OAuth callback with authorization code
   * @param code - Authorization code from OAuth provider
   */
  handleOAuthCallback: (code: string) => Promise<void>;

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
   * Clear any error state
   */
  clearError: () => void;

  /**
   * Initialize auth state from Rust backend
   * Call this on app startup to restore session
   */
  initializeAuth: () => Promise<void>;
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

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const session = await invoke<UserSession>("login_with_credentials", {
            email,
            password,
          });
          set({
            user: session,
            isAuthenticated: true,
            isLoading: false,
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

      loginWithGitHub: async () => {
        set({ isLoading: true, error: null });
        try {
          await invoke<string>("login_with_github");
          // OAuth flow continues in browser, callback handled separately
          // Keep isLoading true until callback is processed or user cancels
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          set({
            error: errorMessage,
            isLoading: false,
          });
          throw new Error(errorMessage);
        }
      },

      handleOAuthCallback: async (code: string) => {
        set({ isLoading: true, error: null });
        try {
          const session = await invoke<UserSession>("handle_oauth_callback", {
            code,
          });
          set({
            user: session,
            isAuthenticated: true,
            isLoading: false,
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
        try {
          await invoke("logout");
        } catch (err) {
          console.error("Logout error:", err);
        }
        // Always clear local state, even if backend call fails
        set({
          user: null,
          isAuthenticated: false,
          error: null,
        });
      },

      refreshSession: async () => {
        const { user } = get();
        if (!user) {
          throw new Error("No active session to refresh");
        }

        try {
          const session = await invoke<UserSession>("refresh_session");
          set({
            user: session,
            isAuthenticated: true,
          });
        } catch (err) {
          // If refresh fails, clear the session
          set({
            user: null,
            isAuthenticated: false,
          });
          throw err;
        }
      },

      clearError: () => set({ error: null }),

      initializeAuth: async () => {
        try {
          // Try to get current user from Rust backend
          const session = await invoke<UserSession | null>("get_current_user");
          if (session) {
            set({
              user: session,
              isAuthenticated: true,
            });
          }
        } catch (err) {
          console.error("Failed to initialize auth:", err);
        }
      },
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

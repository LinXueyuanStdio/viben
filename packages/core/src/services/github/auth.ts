/**
 * GitHub Authentication Service
 *
 * Handles GitHub authentication:
 * - gh CLI detection and OAuth Device Flow
 * - Personal Access Token (PAT) verification
 * - Token management
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import {
  readGitHubConfig,
  updateGitHubAuth,
  clearGitHubAuth,
  githubRequest,
  isAuthError,
} from "./utils";
import type {
  GitHubAuthStatusResponse,
  GitHubUser,
  GitHubAuthType,
  GitHubAuth,
} from "../../types/github";

const execAsync = promisify(exec);

// ============================================================================
// gh CLI Detection
// ============================================================================

/**
 * Check if gh CLI is installed
 * @returns true if gh CLI is available
 */
export async function isGhCliInstalled(): Promise<boolean> {
  try {
    await execAsync("gh --version");
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if gh CLI is logged in
 * @returns true if gh CLI has valid authentication
 */
export async function isGhCliLoggedIn(): Promise<boolean> {
  try {
    const { stdout } = await execAsync("gh auth status");
    return stdout.includes("Logged in") || !stdout.includes("not logged");
  } catch (error) {
    // gh auth status returns non-zero exit code if not logged in
    // but we need to distinguish between "not logged in" and "gh not found"
    if (error instanceof Error && error.message.includes("not logged")) {
      return false;
    }
    // Check stderr for auth status
    const execError = error as { stderr?: string };
    if (execError.stderr?.includes("Logged in")) {
      return true;
    }
    return false;
  }
}

/**
 * Get token from gh CLI
 * @returns Access token or null if not available
 */
export async function getGhCliToken(): Promise<string | null> {
  try {
    const { stdout } = await execAsync("gh auth token");
    const token = stdout.trim();
    return token || null;
  } catch {
    return null;
  }
}

// ============================================================================
// OAuth Device Flow
// ============================================================================

/**
 * OAuth Device Flow state
 */
export interface OAuthDeviceFlowState {
  /** Device code */
  deviceCode: string;
  /** User code to display */
  userCode: string;
  /** Verification URL */
  verificationUri: string;
  /** Expiration time in seconds */
  expiresIn: number;
  /** Polling interval in seconds */
  interval: number;
}

/**
 * Start gh CLI OAuth Device Flow
 * This will open the browser for user authentication
 * @returns OAuth flow state for polling
 */
export async function startGhCliOAuth(): Promise<OAuthDeviceFlowState> {
  try {
    // Use gh auth login with device flow
    // The --web flag opens browser, -s sets scopes
    const { stdout, stderr } = await execAsync(
      "gh auth login --web -s repo,read:user,read:org",
      { timeout: 5000 }
    );

    // Parse the device code response
    // gh CLI outputs something like:
    // First copy your one-time code: XXXX-XXXX
    // Press Enter to open github.com in your browser...
    const codeMatch = (stdout + stderr).match(/code:\s*([A-Z0-9]{4}-[A-Z0-9]{4})/i);
    const userCode = codeMatch ? codeMatch[1] : "";

    return {
      deviceCode: "", // Not exposed by gh CLI
      userCode,
      verificationUri: "https://github.com/login/device",
      expiresIn: 900, // 15 minutes default
      interval: 5,
    };
  } catch (error) {
    // gh auth login might timeout waiting for Enter, which is expected
    const execError = error as { stdout?: string; stderr?: string };
    const output = (execError.stdout || "") + (execError.stderr || "");

    const codeMatch = output.match(/code:\s*([A-Z0-9]{4}-[A-Z0-9]{4})/i);
    const userCode = codeMatch ? codeMatch[1] : "";

    if (userCode) {
      return {
        deviceCode: "",
        userCode,
        verificationUri: "https://github.com/login/device",
        expiresIn: 900,
        interval: 5,
      };
    }

    throw new Error("Failed to start OAuth flow");
  }
}

/**
 * Complete gh CLI OAuth flow
 * Waits for user to complete authentication in browser
 * @returns Access token
 */
export async function completeGhCliOAuth(): Promise<string> {
  // Wait a moment for auth to complete
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const token = await getGhCliToken();
  if (!token) {
    throw new Error("OAuth flow not completed. Please complete authentication in browser.");
  }

  return token;
}

/**
 * Poll for OAuth completion
 * @param maxAttempts - Maximum polling attempts
 * @param intervalMs - Polling interval in milliseconds
 * @returns Access token when authentication completes
 */
export async function pollGhCliOAuthCompletion(
  maxAttempts: number = 60,
  intervalMs: number = 5000
): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const loggedIn = await isGhCliLoggedIn();
    if (loggedIn) {
      const token = await getGhCliToken();
      if (token) {
        return token;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error("OAuth flow timed out. Please try again.");
}

// ============================================================================
// PAT Verification
// ============================================================================

/**
 * Verify a Personal Access Token
 * @param token - PAT to verify
 * @returns User information if token is valid
 */
export async function verifyPAT(token: string): Promise<GitHubUser> {
  try {
    const { data } = await githubRequest<GitHubUser>(token, "/user");
    return data;
  } catch (error) {
    if (isAuthError(error)) {
      throw new Error("Invalid or expired token. Please check your PAT.");
    }
    throw error;
  }
}

// ============================================================================
// Authentication Status
// ============================================================================

/**
 * Get current authentication status for a workspace
 * @param workspacePath - Absolute path to the workspace
 * @returns Authentication status
 */
export async function getAuthStatus(workspacePath: string): Promise<GitHubAuthStatusResponse> {
  const config = await readGitHubConfig(workspacePath);

  // Check gh CLI availability
  const ghCliAvailable = await isGhCliInstalled();
  const ghCliLoggedIn = ghCliAvailable ? await isGhCliLoggedIn() : false;

  // If no saved auth, return unauthenticated status
  if (!config.auth?.token) {
    return {
      authenticated: false,
      gh_cli_available: ghCliAvailable,
      gh_cli_logged_in: ghCliLoggedIn,
    };
  }

  // Verify saved token is still valid
  try {
    const user = await verifyPAT(config.auth.token);
    return {
      authenticated: true,
      user,
      auth_type: config.auth.type,
      gh_cli_available: ghCliAvailable,
      gh_cli_logged_in: ghCliLoggedIn,
    };
  } catch {
    // Token is invalid, clear it
    await clearGitHubAuth(workspacePath);
    return {
      authenticated: false,
      gh_cli_available: ghCliAvailable,
      gh_cli_logged_in: ghCliLoggedIn,
    };
  }
}

/**
 * Authenticate with gh CLI
 * Uses existing gh CLI login or starts OAuth flow
 * @param workspacePath - Absolute path to the workspace
 * @returns User information
 */
export async function authenticateWithGhCli(workspacePath: string): Promise<GitHubUser> {
  // Check if gh CLI is installed
  const installed = await isGhCliInstalled();
  if (!installed) {
    throw new Error("gh CLI is not installed. Please install it first: https://cli.github.com");
  }

  // Check if already logged in
  const loggedIn = await isGhCliLoggedIn();

  let token: string | null = null;

  if (loggedIn) {
    // Get existing token
    token = await getGhCliToken();
  }

  if (!token) {
    throw new Error("gh CLI is not logged in. Please run: gh auth login");
  }

  // Verify token and get user info
  const user = await verifyPAT(token);

  // Save authentication
  const auth: GitHubAuth = {
    type: "gh_cli",
    token,
  };
  await updateGitHubAuth(workspacePath, auth);

  return user;
}

/**
 * Authenticate with Personal Access Token
 * @param workspacePath - Absolute path to the workspace
 * @param token - Personal access token
 * @returns User information
 */
export async function authenticateWithPAT(
  workspacePath: string,
  token: string
): Promise<GitHubUser> {
  // Verify token
  const user = await verifyPAT(token);

  // Save authentication
  const auth: GitHubAuth = {
    type: "pat",
    token,
  };
  await updateGitHubAuth(workspacePath, auth);

  return user;
}

/**
 * Sign out from GitHub
 * @param workspacePath - Absolute path to the workspace
 */
export async function signOut(workspacePath: string): Promise<void> {
  await clearGitHubAuth(workspacePath);
}

/**
 * Get current access token for a workspace
 * @param workspacePath - Absolute path to the workspace
 * @returns Access token or null if not authenticated
 */
export async function getAccessToken(workspacePath: string): Promise<string | null> {
  const config = await readGitHubConfig(workspacePath);
  return config.auth?.token || null;
}

/**
 * Ensure workspace is authenticated
 * @param workspacePath - Absolute path to the workspace
 * @returns Access token
 * @throws Error if not authenticated
 */
export async function requireAuth(workspacePath: string): Promise<string> {
  const token = await getAccessToken(workspacePath);
  if (!token) {
    throw new Error("Not authenticated. Please authenticate with GitHub first.");
  }
  return token;
}

/**
 * GitHub Service Utilities
 *
 * Shared utility functions for GitHub integration:
 * - Configuration file read/write
 * - GitHub API request helpers
 * - Path utilities
 */

import { join } from "node:path";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { readYaml, writeYaml } from "../../config/yaml";
import { getStateDir } from "../../config/paths";
import { proxyFetch } from "../../http";
import type {
  GitHubConfig,
  GitHubAuth,
  GitHubRepositoryConfig,
  GitHubPreferences,
  GitHubAPIError,
  GitHubRateLimit,
} from "../../types/github";

// ============================================================================
// Constants
// ============================================================================

/**
 * GitHub configuration file name
 */
export const GITHUB_CONFIG_FILE = "github.yaml";

/**
 * GitHub API base URL
 */
export const GITHUB_API_BASE = "https://api.github.com";

/**
 * Specs directory name within workspace
 */
export const SPECS_DIR = "specs";

/**
 * Issues specs subdirectory
 */
export const ISSUES_SPECS_DIR = "issues";

// ============================================================================
// Path Utilities
// ============================================================================

/**
 * Get the workspaces directory path
 */
export function getWorkspacesDir(): string {
  return join(getStateDir(), "workspaces");
}

/**
 * Get the path to a workspace's GitHub configuration file
 * @param workspaceId - Workspace identifier (hash or path-based ID)
 */
export function getGitHubConfigPath(workspaceId: string): string {
  return join(getWorkspacesDir(), workspaceId, GITHUB_CONFIG_FILE);
}

/**
 * Get the path to a workspace's specs directory
 * @param workspacePath - Absolute path to the workspace
 */
export function getSpecsDir(workspacePath: string): string {
  return join(workspacePath, ".viben", SPECS_DIR);
}

/**
 * Get the path to issue specs directory
 * @param workspacePath - Absolute path to the workspace
 */
export function getIssueSpecsDir(workspacePath: string): string {
  return join(getSpecsDir(workspacePath), ISSUES_SPECS_DIR);
}

/**
 * Get the path to an issue spec file
 * @param workspacePath - Absolute path to the workspace
 * @param issueNumber - Issue number
 */
export function getIssueSpecPath(workspacePath: string, issueNumber: number): string {
  return join(getIssueSpecsDir(workspacePath), `issue-${issueNumber}.yaml`);
}

/**
 * Generate a workspace ID from a workspace path
 * Uses a simple hash of the path
 */
export function generateWorkspaceId(workspacePath: string): string {
  // Simple hash function for path
  let hash = 0;
  for (let i = 0; i < workspacePath.length; i++) {
    const char = workspacePath.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // Return absolute value as hex string
  return Math.abs(hash).toString(16);
}

// ============================================================================
// Configuration Read/Write
// ============================================================================

/**
 * Read GitHub configuration for a workspace
 * @param workspacePath - Absolute path to the workspace
 * @returns GitHub configuration or empty config if not found
 */
export async function readGitHubConfig(workspacePath: string): Promise<GitHubConfig> {
  const workspaceId = generateWorkspaceId(workspacePath);
  const configPath = getGitHubConfigPath(workspaceId);

  if (!existsSync(configPath)) {
    return {};
  }

  const config = await readYaml<GitHubConfig>(configPath);
  return config || {};
}

/**
 * Write GitHub configuration for a workspace
 * @param workspacePath - Absolute path to the workspace
 * @param config - GitHub configuration to write
 */
export async function writeGitHubConfig(
  workspacePath: string,
  config: GitHubConfig
): Promise<void> {
  const workspaceId = generateWorkspaceId(workspacePath);
  const configPath = getGitHubConfigPath(workspaceId);

  // Ensure directory exists
  const configDir = join(getWorkspacesDir(), workspaceId);
  if (!existsSync(configDir)) {
    await mkdir(configDir, { recursive: true });
  }

  await writeYaml(configPath, config);
}

/**
 * Update GitHub authentication
 * @param workspacePath - Absolute path to the workspace
 * @param auth - Authentication configuration
 */
export async function updateGitHubAuth(
  workspacePath: string,
  auth: GitHubAuth
): Promise<void> {
  const config = await readGitHubConfig(workspacePath);
  config.auth = auth;
  await writeGitHubConfig(workspacePath, config);
}

/**
 * Clear GitHub authentication
 * @param workspacePath - Absolute path to the workspace
 */
export async function clearGitHubAuth(workspacePath: string): Promise<void> {
  const config = await readGitHubConfig(workspacePath);
  delete config.auth;
  await writeGitHubConfig(workspacePath, config);
}

/**
 * Update connected repository
 * @param workspacePath - Absolute path to the workspace
 * @param repository - Repository configuration
 */
export async function updateGitHubRepository(
  workspacePath: string,
  repository: GitHubRepositoryConfig
): Promise<void> {
  const config = await readGitHubConfig(workspacePath);
  config.repository = repository;
  await writeGitHubConfig(workspacePath, config);
}

/**
 * Clear connected repository
 * @param workspacePath - Absolute path to the workspace
 */
export async function clearGitHubRepository(workspacePath: string): Promise<void> {
  const config = await readGitHubConfig(workspacePath);
  delete config.repository;
  await writeGitHubConfig(workspacePath, config);
}

/**
 * Update GitHub preferences
 * @param workspacePath - Absolute path to the workspace
 * @param preferences - Preferences to update
 */
export async function updateGitHubPreferences(
  workspacePath: string,
  preferences: Partial<GitHubPreferences>
): Promise<void> {
  const config = await readGitHubConfig(workspacePath);
  config.preferences = {
    ...config.preferences,
    ...preferences,
  };
  await writeGitHubConfig(workspacePath, config);
}

// ============================================================================
// GitHub API Helpers
// ============================================================================

/**
 * GitHub API request options
 */
export interface GitHubRequestOptions {
  /** HTTP method */
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Request body */
  body?: unknown;
  /** Additional headers */
  headers?: Record<string, string>;
  /** Request timeout in ms */
  timeout?: number;
}

/**
 * GitHub API response with headers
 */
export interface GitHubResponse<T> {
  /** Response data */
  data: T;
  /** Rate limit information */
  rateLimit?: GitHubRateLimit;
}

/**
 * Make a GitHub API request
 * @param token - GitHub access token
 * @param endpoint - API endpoint (relative to GITHUB_API_BASE)
 * @param options - Request options
 */
export async function githubRequest<T>(
  token: string,
  endpoint: string,
  options: GitHubRequestOptions = {}
): Promise<GitHubResponse<T>> {
  const { method = "GET", body, headers = {}, timeout = 30000 } = options;

  const url = endpoint.startsWith("http")
    ? endpoint
    : `${GITHUB_API_BASE}${endpoint}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await proxyFetch(url, {
      method,
      headers: {
        "Accept": "application/vnd.github+json",
        "Authorization": `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Parse rate limit headers
    const rateLimit: GitHubRateLimit | undefined = response.headers.get("x-ratelimit-limit")
      ? {
          limit: parseInt(response.headers.get("x-ratelimit-limit") || "0", 10),
          remaining: parseInt(response.headers.get("x-ratelimit-remaining") || "0", 10),
          reset: parseInt(response.headers.get("x-ratelimit-reset") || "0", 10),
          used: parseInt(response.headers.get("x-ratelimit-used") || "0", 10),
        }
      : undefined;

    if (!response.ok) {
      const errorData = await response.json() as GitHubAPIError;
      const error = new Error(errorData.message || `GitHub API error: ${response.status}`);
      (error as Error & { status?: number; data?: GitHubAPIError }).status = response.status;
      (error as Error & { status?: number; data?: GitHubAPIError }).data = errorData;
      throw error;
    }

    // Handle empty responses (204 No Content)
    if (response.status === 204) {
      return { data: {} as T, rateLimit };
    }

    const data = await response.json() as T;
    return { data, rateLimit };
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Check if an error is a GitHub API error
 */
export function isGitHubAPIError(error: unknown): error is Error & { status?: number; data?: GitHubAPIError } {
  return error instanceof Error && "status" in error;
}

/**
 * Check if error is a rate limit error
 */
export function isRateLimitError(error: unknown): boolean {
  return isGitHubAPIError(error) && error.status === 403 &&
    (error.data?.message?.includes("rate limit") ?? false);
}

/**
 * Check if error is an authentication error
 */
export function isAuthError(error: unknown): boolean {
  return isGitHubAPIError(error) && (error.status === 401 || error.status === 403);
}

/**
 * Check if error is a not found error
 */
export function isNotFoundError(error: unknown): boolean {
  return isGitHubAPIError(error) && error.status === 404;
}

// ============================================================================
// Git Repository Detection
// ============================================================================

/**
 * Parse GitHub repository info from a remote URL
 * @param remoteUrl - Git remote URL (HTTPS or SSH)
 * @returns Owner and name, or null if not a GitHub URL
 */
export function parseGitHubRemoteUrl(remoteUrl: string): { owner: string; name: string } | null {
  // HTTPS format: https://github.com/owner/name.git
  const httpsMatch = remoteUrl.match(/github\.com[/:]([^/]+)\/([^/.]+)(\.git)?$/);
  if (httpsMatch) {
    return { owner: httpsMatch[1], name: httpsMatch[2] };
  }

  // SSH format: git@github.com:owner/name.git
  const sshMatch = remoteUrl.match(/git@github\.com:([^/]+)\/([^/.]+)(\.git)?$/);
  if (sshMatch) {
    return { owner: sshMatch[1], name: sshMatch[2] };
  }

  return null;
}

/**
 * Ensure specs directory exists
 * @param workspacePath - Absolute path to the workspace
 */
export async function ensureSpecsDir(workspacePath: string): Promise<void> {
  const specsDir = getIssueSpecsDir(workspacePath);
  if (!existsSync(specsDir)) {
    await mkdir(specsDir, { recursive: true });
  }
}

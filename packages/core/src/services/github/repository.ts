/**
 * GitHub Repository Service
 *
 * Handles repository operations:
 * - Repository listing
 * - Repository detection from .git
 * - Repository connection
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { requireAuth } from "./auth";
import {
  readGitHubConfig,
  updateGitHubRepository,
  clearGitHubRepository,
  githubRequest,
  parseGitHubRemoteUrl,
} from "./utils";
import type {
  GitHubRepository,
  GitHubRepositoryConfig,
  GitHubPaginatedResponse,
} from "../../types/github";

const execAsync = promisify(exec);

// ============================================================================
// Repository Listing
// ============================================================================

/**
 * GitHub API repository response
 */
interface GitHubRepoAPIResponse {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
  };
  default_branch: string;
  html_url: string;
  clone_url: string;
  ssh_url: string;
  private: boolean;
  description: string | null;
}

/**
 * List repositories accessible by the authenticated user
 * @param workspacePath - Absolute path to the workspace
 * @param page - Page number (1-based)
 * @param perPage - Items per page
 * @returns Paginated list of repositories
 */
export async function listRepositories(
  workspacePath: string,
  page: number = 1,
  perPage: number = 30
): Promise<GitHubPaginatedResponse<GitHubRepository>> {
  const token = await requireAuth(workspacePath);

  const { data } = await githubRequest<GitHubRepoAPIResponse[]>(
    token,
    `/user/repos?page=${page}&per_page=${perPage}&sort=updated&direction=desc`
  );

  const repositories: GitHubRepository[] = data.map((repo) => ({
    id: repo.id,
    owner: repo.owner.login,
    name: repo.name,
    full_name: repo.full_name,
    default_branch: repo.default_branch,
    url: repo.html_url,
    clone_url: repo.clone_url,
    ssh_url: repo.ssh_url,
    private: repo.private,
    description: repo.description || undefined,
  }));

  return {
    items: repositories,
    page,
    per_page: perPage,
    has_more: data.length === perPage,
  };
}

/**
 * Get repository details
 * @param workspacePath - Absolute path to the workspace
 * @param owner - Repository owner
 * @param name - Repository name
 * @returns Repository details
 */
export async function getRepository(
  workspacePath: string,
  owner: string,
  name: string
): Promise<GitHubRepository> {
  const token = await requireAuth(workspacePath);

  const { data } = await githubRequest<GitHubRepoAPIResponse>(
    token,
    `/repos/${owner}/${name}`
  );

  return {
    id: data.id,
    owner: data.owner.login,
    name: data.name,
    full_name: data.full_name,
    default_branch: data.default_branch,
    url: data.html_url,
    clone_url: data.clone_url,
    ssh_url: data.ssh_url,
    private: data.private,
    description: data.description || undefined,
  };
}

// ============================================================================
// Repository Detection
// ============================================================================

/**
 * Detect GitHub repository from workspace .git directory
 * @param workspacePath - Absolute path to the workspace
 * @returns Repository info or null if not a GitHub repository
 */
export async function detectRepository(
  workspacePath: string
): Promise<{ owner: string; name: string } | null> {
  const gitDir = join(workspacePath, ".git");

  // Check if .git directory exists
  if (!existsSync(gitDir)) {
    return null;
  }

  try {
    // Get remote origin URL
    const { stdout } = await execAsync("git remote get-url origin", {
      cwd: workspacePath,
    });

    const remoteUrl = stdout.trim();
    return parseGitHubRemoteUrl(remoteUrl);
  } catch {
    return null;
  }
}

/**
 * Detect and fetch repository details from workspace
 * @param workspacePath - Absolute path to the workspace
 * @returns Repository details or null if not a GitHub repository
 */
export async function detectAndFetchRepository(
  workspacePath: string
): Promise<GitHubRepository | null> {
  const detected = await detectRepository(workspacePath);
  if (!detected) {
    return null;
  }

  try {
    return await getRepository(workspacePath, detected.owner, detected.name);
  } catch {
    // Repository might not be accessible (private, deleted, etc.)
    return null;
  }
}

// ============================================================================
// Repository Connection
// ============================================================================

/**
 * Connect to a GitHub repository
 * @param workspacePath - Absolute path to the workspace
 * @param owner - Repository owner
 * @param name - Repository name
 * @returns Connected repository info
 */
export async function connectRepository(
  workspacePath: string,
  owner: string,
  name: string
): Promise<GitHubRepository> {
  // Fetch repository to verify it exists and is accessible
  const repo = await getRepository(workspacePath, owner, name);

  // Save to config
  const repoConfig: GitHubRepositoryConfig = {
    owner: repo.owner,
    name: repo.name,
    full_name: repo.full_name,
    default_branch: repo.default_branch,
    url: repo.url,
  };

  await updateGitHubRepository(workspacePath, repoConfig);

  return repo;
}

/**
 * Disconnect from GitHub repository
 * @param workspacePath - Absolute path to the workspace
 */
export async function disconnectRepository(workspacePath: string): Promise<void> {
  await clearGitHubRepository(workspacePath);
}

/**
 * Get connected repository for a workspace
 * @param workspacePath - Absolute path to the workspace
 * @returns Connected repository config or null
 */
export async function getConnectedRepository(
  workspacePath: string
): Promise<GitHubRepositoryConfig | null> {
  const config = await readGitHubConfig(workspacePath);
  return config.repository || null;
}

/**
 * Ensure workspace has a connected repository
 * @param workspacePath - Absolute path to the workspace
 * @returns Repository config
 * @throws Error if no repository is connected
 */
export async function requireRepository(
  workspacePath: string
): Promise<GitHubRepositoryConfig> {
  const repo = await getConnectedRepository(workspacePath);
  if (!repo) {
    throw new Error("No repository connected. Please connect to a GitHub repository first.");
  }
  return repo;
}

/**
 * Get branches for connected repository
 * @param workspacePath - Absolute path to the workspace
 * @param page - Page number
 * @param perPage - Items per page
 * @returns List of branch names
 */
export async function listBranches(
  workspacePath: string,
  page: number = 1,
  perPage: number = 100
): Promise<string[]> {
  const token = await requireAuth(workspacePath);
  const repo = await requireRepository(workspacePath);

  interface BranchAPIResponse {
    name: string;
  }

  const { data } = await githubRequest<BranchAPIResponse[]>(
    token,
    `/repos/${repo.owner}/${repo.name}/branches?page=${page}&per_page=${perPage}`
  );

  return data.map((branch) => branch.name);
}

/**
 * Get tags for connected repository
 * @param workspacePath - Absolute path to the workspace
 * @param page - Page number
 * @param perPage - Items per page
 * @returns List of tag names
 */
export async function listTags(
  workspacePath: string,
  page: number = 1,
  perPage: number = 100
): Promise<string[]> {
  const token = await requireAuth(workspacePath);
  const repo = await requireRepository(workspacePath);

  interface TagAPIResponse {
    name: string;
  }

  const { data } = await githubRequest<TagAPIResponse[]>(
    token,
    `/repos/${repo.owner}/${repo.name}/tags?page=${page}&per_page=${perPage}`
  );

  return data.map((tag) => tag.name);
}

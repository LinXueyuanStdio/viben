/**
 * GitHub Gateway Client
 *
 * Type-safe client for GitHub API endpoints.
 */

import { getGatewayUrl } from "./gateway";

// ============================================================================
// Types
// ============================================================================

/**
 * GitHub authentication type
 */
export type GitHubAuthType = "gh_cli" | "pat";

/**
 * GitHub user
 */
export interface GitHubUser {
  id: number;
  login: string;
  name?: string;
  avatar_url: string;
  html_url: string;
  email?: string;
}

/**
 * GitHub repository
 */
export interface GitHubRepository {
  id: number;
  owner: string;
  name: string;
  full_name: string;
  default_branch: string;
  url: string;
  clone_url?: string;
  ssh_url?: string;
  private: boolean;
  description?: string;
}

/**
 * GitHub repository config (stored)
 */
export interface GitHubRepositoryConfig {
  owner: string;
  name: string;
  full_name: string;
  default_branch: string;
  url: string;
  description?: string;
  stargazers_count?: number;
  forks_count?: number;
}

/**
 * GitHub label
 */
export interface GitHubLabel {
  id: number;
  name: string;
  color: string;
  description?: string;
}

/**
 * GitHub milestone
 */
export interface GitHubMilestone {
  id: number;
  number: number;
  title: string;
  description?: string;
  state: "open" | "closed";
  due_on?: string;
}

/**
 * GitHub issue
 */
export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body?: string;
  state: "open" | "closed";
  labels: GitHubLabel[];
  assignees: GitHubUser[];
  user: GitHubUser;
  created_at: string;
  updated_at: string;
  closed_at?: string;
  html_url: string;
  comments: number;
  milestone?: GitHubMilestone;
}

/**
 * GitHub pull request
 */
export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  body?: string;
  state: "open" | "closed" | "merged";
  merged: boolean;
  merged_at?: string;
  labels: GitHubLabel[];
  assignees?: GitHubUser[];
  user: GitHubUser;
  head: { ref: string; sha: string };
  base: { ref: string; sha: string };
  created_at: string;
  updated_at: string;
  closed_at?: string;
  html_url: string;
  draft: boolean;
  comments: number;
  commits: number;
  additions?: number;
  deletions?: number;
  changed_files?: number;
}

/**
 * GitHub release asset
 */
export interface GitHubReleaseAsset {
  id: number;
  name: string;
  content_type: string;
  size: number;
  browser_download_url: string;
  download_count: number;
}

/**
 * GitHub release
 */
export interface GitHubRelease {
  id: number;
  tag_name: string;
  name?: string;
  body?: string;
  draft: boolean;
  prerelease: boolean;
  created_at: string;
  published_at?: string;
  author: GitHubUser;
  html_url: string;
  target_commitish: string;
  assets: GitHubReleaseAsset[];
}

/**
 * Authentication status response
 */
export interface GitHubAuthStatus {
  authenticated: boolean;
  user?: GitHubUser;
  auth_type?: GitHubAuthType;
  gh_cli_available?: boolean;
  gh_cli_logged_in?: boolean;
}

/**
 * Issue investigation result
 */
export interface GitHubIssueInvestigation {
  issue_number: number;
  complexity: "simple" | "medium" | "complex";
  estimated_files: number;
  affected_areas: string[];
  implementation_hints: string[];
  spec_content?: string;
  spec_path?: string;
}

/**
 * Import result
 */
export interface GitHubImportResult {
  total: number;
  imported: number;
  failed: number;
  results: GitHubIssueInvestigation[];
  errors: Array<{ issue_number: number; error: string }>;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  per_page: number;
  has_more: boolean;
  total_count?: number;
}

// ============================================================================
// Client Class
// ============================================================================

export class GitHubClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = getGatewayUrl();
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(error.error || `Request failed: ${response.status}`);
    }

    return response.json();
  }

  // ---------------------------------------------------------------------------
  // Authentication
  // ---------------------------------------------------------------------------

  /**
   * Get authentication status
   */
  async getAuthStatus(workspacePath: string): Promise<GitHubAuthStatus> {
    return this.request(`/api/github/auth/status?workspace_path=${encodeURIComponent(workspacePath)}`);
  }

  /**
   * Authenticate with gh CLI
   */
  async authenticateWithGhCli(workspacePath: string): Promise<{ user: GitHubUser }> {
    return this.request(`/api/github/auth/gh-cli?workspace_path=${encodeURIComponent(workspacePath)}`, {
      method: "POST",
    });
  }

  /**
   * Authenticate with PAT
   */
  async authenticateWithPAT(workspacePath: string, token: string): Promise<{ user: GitHubUser }> {
    return this.request(`/api/github/auth/pat?workspace_path=${encodeURIComponent(workspacePath)}`, {
      method: "POST",
      body: JSON.stringify({ token }),
    });
  }

  /**
   * Sign out from GitHub
   */
  async signOut(workspacePath: string): Promise<{ success: boolean }> {
    return this.request(`/api/github/auth?workspace_path=${encodeURIComponent(workspacePath)}`, {
      method: "DELETE",
    });
  }

  // ---------------------------------------------------------------------------
  // Repository
  // ---------------------------------------------------------------------------

  /**
   * List accessible repositories
   */
  async listRepositories(
    workspacePath: string,
    page: number = 1,
    perPage: number = 30
  ): Promise<PaginatedResponse<GitHubRepository>> {
    return this.request(
      `/api/github/repos?workspace_path=${encodeURIComponent(workspacePath)}&page=${page}&per_page=${perPage}`
    );
  }

  /**
   * Detect repository from workspace .git
   */
  async detectRepository(workspacePath: string): Promise<{ repository: GitHubRepository | null }> {
    return this.request(`/api/github/repos/detect?workspace_path=${encodeURIComponent(workspacePath)}`);
  }

  /**
   * Get connected repository
   */
  async getConnectedRepository(workspacePath: string): Promise<{ repository: GitHubRepositoryConfig | null }> {
    return this.request(`/api/github/repos/connected?workspace_path=${encodeURIComponent(workspacePath)}`);
  }

  /**
   * Connect to a repository
   */
  async connectRepository(
    workspacePath: string,
    owner: string,
    name: string
  ): Promise<{ repository: GitHubRepository }> {
    return this.request(`/api/github/repos/connect?workspace_path=${encodeURIComponent(workspacePath)}`, {
      method: "POST",
      body: JSON.stringify({ owner, name }),
    });
  }

  /**
   * Disconnect from repository
   */
  async disconnectRepository(workspacePath: string): Promise<{ success: boolean }> {
    return this.request(`/api/github/repos/connect?workspace_path=${encodeURIComponent(workspacePath)}`, {
      method: "DELETE",
    });
  }

  // ---------------------------------------------------------------------------
  // Issues
  // ---------------------------------------------------------------------------

  /**
   * List issues
   */
  async listIssues(
    workspacePath: string,
    params: {
      state?: "open" | "closed" | "all";
      labels?: string;
      assignee?: string;
      sort?: "created" | "updated" | "comments";
      direction?: "asc" | "desc";
      page?: number;
      per_page?: number;
    } = {}
  ): Promise<PaginatedResponse<GitHubIssue>> {
    const queryParams = new URLSearchParams({
      workspace_path: workspacePath,
      ...(params.state && { state: params.state }),
      ...(params.labels && { labels: params.labels }),
      ...(params.assignee && { assignee: params.assignee }),
      ...(params.sort && { sort: params.sort }),
      ...(params.direction && { direction: params.direction }),
      ...(params.page && { page: String(params.page) }),
      ...(params.per_page && { per_page: String(params.per_page) }),
    });
    return this.request(`/api/github/issues?${queryParams.toString()}`);
  }

  /**
   * Get a single issue
   */
  async getIssue(workspacePath: string, issueNumber: number): Promise<{ issue: GitHubIssue }> {
    return this.request(
      `/api/github/issues/${issueNumber}?workspace_path=${encodeURIComponent(workspacePath)}`
    );
  }

  /**
   * Investigate an issue
   */
  async investigateIssue(
    workspacePath: string,
    issueNumber: number,
    saveSpec: boolean = false
  ): Promise<{ investigation: GitHubIssueInvestigation }> {
    return this.request(
      `/api/github/issues/${issueNumber}/investigate?workspace_path=${encodeURIComponent(workspacePath)}`,
      {
        method: "POST",
        body: JSON.stringify({ save_spec: saveSpec }),
      }
    );
  }

  /**
   * Import issues as specs
   */
  async importIssues(
    workspacePath: string,
    issueNumbers: number[]
  ): Promise<GitHubImportResult> {
    return this.request(`/api/github/issues/import?workspace_path=${encodeURIComponent(workspacePath)}`, {
      method: "POST",
      body: JSON.stringify({ issue_numbers: issueNumbers }),
    });
  }

  // ---------------------------------------------------------------------------
  // Pull Requests
  // ---------------------------------------------------------------------------

  /**
   * List pull requests
   */
  async listPullRequests(
    workspacePath: string,
    params: {
      state?: "open" | "closed" | "all";
      sort?: "created" | "updated" | "popularity" | "long-running";
      direction?: "asc" | "desc";
      page?: number;
      per_page?: number;
    } = {}
  ): Promise<PaginatedResponse<GitHubPullRequest>> {
    const queryParams = new URLSearchParams({
      workspace_path: workspacePath,
      ...(params.state && { state: params.state }),
      ...(params.sort && { sort: params.sort }),
      ...(params.direction && { direction: params.direction }),
      ...(params.page && { page: String(params.page) }),
      ...(params.per_page && { per_page: String(params.per_page) }),
    });
    return this.request(`/api/github/prs?${queryParams.toString()}`);
  }

  /**
   * Get a single pull request
   */
  async getPullRequest(workspacePath: string, prNumber: number): Promise<{ pr: GitHubPullRequest }> {
    return this.request(
      `/api/github/prs/${prNumber}?workspace_path=${encodeURIComponent(workspacePath)}`
    );
  }

  /**
   * Create a pull request
   */
  async createPullRequest(
    workspacePath: string,
    params: {
      title: string;
      body?: string;
      head: string;
      base: string;
      draft?: boolean;
    }
  ): Promise<{ pr: GitHubPullRequest }> {
    return this.request(`/api/github/prs?workspace_path=${encodeURIComponent(workspacePath)}`, {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  // ---------------------------------------------------------------------------
  // Releases
  // ---------------------------------------------------------------------------

  /**
   * List releases
   */
  async listReleases(
    workspacePath: string,
    page: number = 1,
    perPage: number = 30
  ): Promise<PaginatedResponse<GitHubRelease>> {
    return this.request(
      `/api/github/releases?workspace_path=${encodeURIComponent(workspacePath)}&page=${page}&per_page=${perPage}`
    );
  }

  /**
   * Get latest release
   */
  async getLatestRelease(workspacePath: string): Promise<{ release: GitHubRelease }> {
    return this.request(`/api/github/releases/latest?workspace_path=${encodeURIComponent(workspacePath)}`);
  }

  /**
   * Create a release
   */
  async createRelease(
    workspacePath: string,
    params: {
      tag_name: string;
      name?: string;
      body?: string;
      draft?: boolean;
      prerelease?: boolean;
      target_commitish?: string;
    }
  ): Promise<{ release: GitHubRelease }> {
    return this.request(`/api/github/releases?workspace_path=${encodeURIComponent(workspacePath)}`, {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  /**
   * Generate release notes
   */
  async generateReleaseNotes(
    workspacePath: string,
    tagName: string,
    previousTag?: string
  ): Promise<{ name: string; body: string }> {
    return this.request(`/api/github/releases/generate-notes?workspace_path=${encodeURIComponent(workspacePath)}`, {
      method: "POST",
      body: JSON.stringify({ tag_name: tagName, previous_tag: previousTag }),
    });
  }
}

// Singleton instance
let gitHubClient: GitHubClient | null = null;

/**
 * Get the GitHub client singleton
 */
export function getGitHubClient(): GitHubClient {
  if (!gitHubClient) {
    gitHubClient = new GitHubClient();
  }
  return gitHubClient;
}

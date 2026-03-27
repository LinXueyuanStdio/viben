/**
 * GitHub Gateway Client
 *
 * Type-safe client for GitHub API endpoints.
 */

import { getGatewayUrl } from "./gateway";
import type {
  GitHubAuthType,
  GitHubUser,
  GitHubRepository,
  GitHubRepositoryConfig,
  GitHubLabel,
  GitHubMilestone,
  GitHubIssue,
  GitHubComment,
  GitHubPullRequest,
  GitHubRelease,
  GitHubReleaseAsset,
  GitHubAuthStatusResponse,
  GitHubIssueInvestigation,
  GitHubPaginatedResponse,
} from "@viben/core/shared";

// Re-export types for convenience
export type {
  GitHubAuthType,
  GitHubUser,
  GitHubRepository,
  GitHubRepositoryConfig,
  GitHubLabel,
  GitHubMilestone,
  GitHubIssue,
  GitHubComment,
  GitHubPullRequest,
  GitHubRelease,
  GitHubReleaseAsset,
  GitHubIssueInvestigation,
};

// Local type aliases for backward compatibility
export type GitHubAuthStatus = GitHubAuthStatusResponse;
export type PaginatedResponse<T> = GitHubPaginatedResponse<T>;

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
 * Auto-fix task creation options
 */
export interface CreateAutoFixTaskOptions {
  require_approval?: boolean;
  base_branch?: string;
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
      body: JSON.stringify({}),
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

  /**
   * Get comments for an issue
   */
  async getIssueComments(
    workspacePath: string,
    issueNumber: number,
    page: number = 1,
    perPage: number = 30
  ): Promise<PaginatedResponse<GitHubComment>> {
    return this.request(
      `/api/github/issues/${issueNumber}/comments?workspace_path=${encodeURIComponent(workspacePath)}&page=${page}&per_page=${perPage}`
    );
  }

  // ---------------------------------------------------------------------------
  // Auto-Fix Tasks
  // ---------------------------------------------------------------------------

  /**
   * Create an auto-fix task for one or more issues
   */
  async createAutoFixTask(
    workspacePath: string,
    issueNumbers: number[],
    options?: CreateAutoFixTaskOptions
  ): Promise<{ task_id: string }> {
    return this.request(`/api/github/autofix/tasks?workspace_path=${encodeURIComponent(workspacePath)}`, {
      method: "POST",
      body: JSON.stringify({
        issue_numbers: issueNumbers,
        ...options,
      }),
    });
  }

  /**
   * Cancel an auto-fix task
   */
  async cancelAutoFixTask(
    workspacePath: string,
    taskId: string
  ): Promise<{ success: boolean }> {
    return this.request(
      `/api/github/autofix/tasks/${taskId}/cancel?workspace_path=${encodeURIComponent(workspacePath)}`,
      { method: "POST", body: JSON.stringify({}) }
    );
  }

  /**
   * Approve an auto-fix task awaiting approval
   */
  async approveAutoFixTask(
    workspacePath: string,
    taskId: string
  ): Promise<{ success: boolean }> {
    return this.request(
      `/api/github/autofix/tasks/${taskId}/approve?workspace_path=${encodeURIComponent(workspacePath)}`,
      { method: "POST", body: JSON.stringify({}) }
    );
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

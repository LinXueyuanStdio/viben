/**
 * GitHub Pull Requests Service
 *
 * Handles pull request operations:
 * - List PRs
 * - Get PR details
 * - Create PR
 */

import { requireAuth } from "./auth";
import { requireRepository } from "./repository";
import { githubRequest } from "./utils";
import type {
  GitHubPullRequest,
  GitHubLabel,
  GitHubUser,
  GitHubListPRsParams,
  GitHubPaginatedResponse,
  GitHubCreatePRRequest,
} from "../../types/github";

// ============================================================================
// API Response Types
// ============================================================================

interface PRAPIResponse {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  merged: boolean;
  merged_at: string | null;
  labels: Array<{
    id: number;
    name: string;
    color: string;
    description: string | null;
  }>;
  user: {
    id: number;
    login: string;
    name?: string;
    avatar_url: string;
    html_url: string;
    email?: string;
  };
  head: {
    ref: string;
    sha: string;
  };
  base: {
    ref: string;
    sha: string;
  };
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  html_url: string;
  draft: boolean;
  mergeable_state?: string;
  comments: number;
  commits: number;
  additions: number;
  deletions: number;
  changed_files: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

function mapUser(user: PRAPIResponse["user"]): GitHubUser {
  return {
    id: user.id,
    login: user.login,
    name: user.name,
    avatar_url: user.avatar_url,
    html_url: user.html_url,
    email: user.email,
  };
}

function mapLabel(label: PRAPIResponse["labels"][0]): GitHubLabel {
  return {
    id: label.id,
    name: label.name,
    color: label.color,
    description: label.description || undefined,
  };
}

function mapPR(pr: PRAPIResponse): GitHubPullRequest {
  return {
    id: pr.id,
    number: pr.number,
    title: pr.title,
    body: pr.body || undefined,
    state: pr.merged ? "merged" : pr.state,
    merged: pr.merged,
    merged_at: pr.merged_at || undefined,
    labels: pr.labels.map(mapLabel),
    user: mapUser(pr.user),
    head: pr.head,
    base: pr.base,
    created_at: pr.created_at,
    updated_at: pr.updated_at,
    closed_at: pr.closed_at || undefined,
    html_url: pr.html_url,
    draft: pr.draft,
    mergeable_state: pr.mergeable_state,
    comments: pr.comments,
    commits: pr.commits,
    additions: pr.additions,
    deletions: pr.deletions,
    changed_files: pr.changed_files,
  };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * List pull requests for connected repository
 * @param workspacePath - Absolute path to the workspace
 * @param params - Query parameters
 * @returns Paginated list of PRs
 */
export async function listPullRequests(
  workspacePath: string,
  params: GitHubListPRsParams = {}
): Promise<GitHubPaginatedResponse<GitHubPullRequest>> {
  const token = await requireAuth(workspacePath);
  const repo = await requireRepository(workspacePath);

  const {
    state = "open",
    sort = "created",
    direction = "desc",
    page = 1,
    per_page = 30,
  } = params;

  const queryParams = new URLSearchParams({
    state,
    sort,
    direction,
    page: String(page),
    per_page: String(per_page),
  });

  const { data } = await githubRequest<PRAPIResponse[]>(
    token,
    `/repos/${repo.owner}/${repo.name}/pulls?${queryParams.toString()}`
  );

  const prs = data.map(mapPR);

  return {
    items: prs,
    page,
    per_page,
    has_more: data.length === per_page,
  };
}

/**
 * Get a single pull request by number
 * @param workspacePath - Absolute path to the workspace
 * @param prNumber - PR number
 * @returns PR details
 */
export async function getPullRequest(
  workspacePath: string,
  prNumber: number
): Promise<GitHubPullRequest> {
  const token = await requireAuth(workspacePath);
  const repo = await requireRepository(workspacePath);

  const { data } = await githubRequest<PRAPIResponse>(
    token,
    `/repos/${repo.owner}/${repo.name}/pulls/${prNumber}`
  );

  return mapPR(data);
}

/**
 * Create a new pull request
 * @param workspacePath - Absolute path to the workspace
 * @param request - PR creation parameters
 * @returns Created PR
 */
export async function createPullRequest(
  workspacePath: string,
  request: GitHubCreatePRRequest
): Promise<GitHubPullRequest> {
  const token = await requireAuth(workspacePath);
  const repo = await requireRepository(workspacePath);

  const { data } = await githubRequest<PRAPIResponse>(
    token,
    `/repos/${repo.owner}/${repo.name}/pulls`,
    {
      method: "POST",
      body: {
        title: request.title,
        body: request.body,
        head: request.head,
        base: request.base,
        draft: request.draft,
      },
    }
  );

  return mapPR(data);
}

/**
 * Get PR diff
 * @param workspacePath - Absolute path to the workspace
 * @param prNumber - PR number
 * @returns Diff content
 */
export async function getPullRequestDiff(
  workspacePath: string,
  prNumber: number
): Promise<string> {
  const token = await requireAuth(workspacePath);
  const repo = await requireRepository(workspacePath);

  const { data } = await githubRequest<string>(
    token,
    `/repos/${repo.owner}/${repo.name}/pulls/${prNumber}`,
    {
      headers: {
        Accept: "application/vnd.github.diff",
      },
    }
  );

  return data;
}

/**
 * List PR commits
 * @param workspacePath - Absolute path to the workspace
 * @param prNumber - PR number
 * @returns List of commit SHAs
 */
export async function listPullRequestCommits(
  workspacePath: string,
  prNumber: number
): Promise<string[]> {
  const token = await requireAuth(workspacePath);
  const repo = await requireRepository(workspacePath);

  interface CommitAPIResponse {
    sha: string;
  }

  const { data } = await githubRequest<CommitAPIResponse[]>(
    token,
    `/repos/${repo.owner}/${repo.name}/pulls/${prNumber}/commits?per_page=100`
  );

  return data.map((c) => c.sha);
}

/**
 * List PR files
 * @param workspacePath - Absolute path to the workspace
 * @param prNumber - PR number
 * @returns List of changed files
 */
export async function listPullRequestFiles(
  workspacePath: string,
  prNumber: number
): Promise<Array<{ filename: string; status: string; additions: number; deletions: number }>> {
  const token = await requireAuth(workspacePath);
  const repo = await requireRepository(workspacePath);

  interface FileAPIResponse {
    filename: string;
    status: string;
    additions: number;
    deletions: number;
  }

  const { data } = await githubRequest<FileAPIResponse[]>(
    token,
    `/repos/${repo.owner}/${repo.name}/pulls/${prNumber}/files?per_page=100`
  );

  return data.map((f) => ({
    filename: f.filename,
    status: f.status,
    additions: f.additions,
    deletions: f.deletions,
  }));
}

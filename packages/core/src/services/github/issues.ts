/**
 * GitHub Issues Service
 *
 * Handles issue operations:
 * - List issues
 * - Get issue details
 * - Issue comments
 */

import { requireAuth } from "./auth";
import { requireRepository } from "./repository";
import { githubRequest } from "./utils";
import type {
  GitHubIssue,
  GitHubComment,
  GitHubLabel,
  GitHubUser,
  GitHubMilestone,
  GitHubListIssuesParams,
  GitHubPaginatedResponse,
} from "../../types/github";

// ============================================================================
// API Response Types
// ============================================================================

interface IssueAPIResponse {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  labels: Array<{
    id: number;
    name: string;
    color: string;
    description: string | null;
  }>;
  assignees: Array<{
    id: number;
    login: string;
    name?: string;
    avatar_url: string;
    html_url: string;
    email?: string;
  }>;
  user: {
    id: number;
    login: string;
    name?: string;
    avatar_url: string;
    html_url: string;
    email?: string;
  };
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  html_url: string;
  comments: number;
  milestone: {
    id: number;
    number: number;
    title: string;
    description: string | null;
    state: "open" | "closed";
    due_on: string | null;
  } | null;
  // Pull requests also show up in issues API
  pull_request?: unknown;
}

interface CommentAPIResponse {
  id: number;
  body: string;
  user: {
    id: number;
    login: string;
    name?: string;
    avatar_url: string;
    html_url: string;
    email?: string;
  };
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function mapUser(user: IssueAPIResponse["user"]): GitHubUser {
  return {
    id: user.id,
    login: user.login,
    name: user.name,
    avatar_url: user.avatar_url,
    html_url: user.html_url,
    email: user.email,
  };
}

function mapLabel(label: IssueAPIResponse["labels"][0]): GitHubLabel {
  return {
    id: label.id,
    name: label.name,
    color: label.color,
    description: label.description || undefined,
  };
}

function mapMilestone(milestone: NonNullable<IssueAPIResponse["milestone"]>): GitHubMilestone {
  return {
    id: milestone.id,
    number: milestone.number,
    title: milestone.title,
    description: milestone.description || undefined,
    state: milestone.state,
    due_on: milestone.due_on || undefined,
  };
}

function mapIssue(issue: IssueAPIResponse): GitHubIssue {
  return {
    id: issue.id,
    number: issue.number,
    title: issue.title,
    body: issue.body || undefined,
    state: issue.state,
    labels: issue.labels.map(mapLabel),
    assignees: issue.assignees.map(mapUser),
    user: mapUser(issue.user),
    created_at: issue.created_at,
    updated_at: issue.updated_at,
    closed_at: issue.closed_at || undefined,
    html_url: issue.html_url,
    comments: issue.comments,
    milestone: issue.milestone ? mapMilestone(issue.milestone) : undefined,
  };
}

// ============================================================================
// Issue Operations
// ============================================================================

/**
 * List issues for connected repository
 * @param workspacePath - Absolute path to the workspace
 * @param params - Query parameters
 * @returns Paginated list of issues
 */
export async function listIssues(
  workspacePath: string,
  params: GitHubListIssuesParams = {}
): Promise<GitHubPaginatedResponse<GitHubIssue>> {
  const token = await requireAuth(workspacePath);
  const repo = await requireRepository(workspacePath);

  const {
    state = "open",
    labels,
    assignee,
    sort = "created",
    direction = "desc",
    page = 1,
    per_page = 30,
  } = params;

  // Build query string
  const queryParams = new URLSearchParams({
    state,
    sort,
    direction,
    page: String(page),
    per_page: String(per_page),
  });

  if (labels) {
    queryParams.set("labels", labels);
  }
  if (assignee) {
    queryParams.set("assignee", assignee);
  }

  const { data } = await githubRequest<IssueAPIResponse[]>(
    token,
    `/repos/${repo.owner}/${repo.name}/issues?${queryParams.toString()}`
  );

  // Filter out pull requests (they appear in issues API)
  const issues = data
    .filter((item) => !item.pull_request)
    .map(mapIssue);

  return {
    items: issues,
    page,
    per_page,
    has_more: data.length === per_page,
  };
}

/**
 * Get a single issue by number
 * @param workspacePath - Absolute path to the workspace
 * @param issueNumber - Issue number
 * @returns Issue details
 */
export async function getIssue(
  workspacePath: string,
  issueNumber: number
): Promise<GitHubIssue> {
  const token = await requireAuth(workspacePath);
  const repo = await requireRepository(workspacePath);

  const { data } = await githubRequest<IssueAPIResponse>(
    token,
    `/repos/${repo.owner}/${repo.name}/issues/${issueNumber}`
  );

  return mapIssue(data);
}

/**
 * Get comments for an issue
 * @param workspacePath - Absolute path to the workspace
 * @param issueNumber - Issue number
 * @param page - Page number
 * @param perPage - Items per page
 * @returns Paginated list of comments
 */
export async function getIssueComments(
  workspacePath: string,
  issueNumber: number,
  page: number = 1,
  perPage: number = 30
): Promise<GitHubPaginatedResponse<GitHubComment>> {
  const token = await requireAuth(workspacePath);
  const repo = await requireRepository(workspacePath);

  const { data } = await githubRequest<CommentAPIResponse[]>(
    token,
    `/repos/${repo.owner}/${repo.name}/issues/${issueNumber}/comments?page=${page}&per_page=${perPage}`
  );

  const comments: GitHubComment[] = data.map((comment) => ({
    id: comment.id,
    body: comment.body,
    user: mapUser(comment.user),
    created_at: comment.created_at,
    updated_at: comment.updated_at,
  }));

  return {
    items: comments,
    page,
    per_page: perPage,
    has_more: data.length === perPage,
  };
}

/**
 * Get issue with comments
 * @param workspacePath - Absolute path to the workspace
 * @param issueNumber - Issue number
 * @returns Issue with all comments
 */
export async function getIssueWithComments(
  workspacePath: string,
  issueNumber: number
): Promise<{ issue: GitHubIssue; comments: GitHubComment[] }> {
  const [issue, commentsResult] = await Promise.all([
    getIssue(workspacePath, issueNumber),
    getIssueComments(workspacePath, issueNumber, 1, 100),
  ]);

  // If there are more comments, fetch all pages
  let allComments = commentsResult.items;
  let page = 2;

  while (commentsResult.has_more && page <= 10) {
    // Limit to 10 pages
    const moreComments = await getIssueComments(workspacePath, issueNumber, page, 100);
    allComments = allComments.concat(moreComments.items);
    if (!moreComments.has_more) break;
    page++;
  }

  return { issue, comments: allComments };
}

/**
 * Get labels for connected repository
 * @param workspacePath - Absolute path to the workspace
 * @returns List of labels
 */
export async function listLabels(workspacePath: string): Promise<GitHubLabel[]> {
  const token = await requireAuth(workspacePath);
  const repo = await requireRepository(workspacePath);

  interface LabelAPIResponse {
    id: number;
    name: string;
    color: string;
    description: string | null;
  }

  const { data } = await githubRequest<LabelAPIResponse[]>(
    token,
    `/repos/${repo.owner}/${repo.name}/labels?per_page=100`
  );

  return data.map((label) => ({
    id: label.id,
    name: label.name,
    color: label.color,
    description: label.description || undefined,
  }));
}

/**
 * Get milestones for connected repository
 * @param workspacePath - Absolute path to the workspace
 * @param state - Milestone state filter
 * @returns List of milestones
 */
export async function listMilestones(
  workspacePath: string,
  state: "open" | "closed" | "all" = "open"
): Promise<GitHubMilestone[]> {
  const token = await requireAuth(workspacePath);
  const repo = await requireRepository(workspacePath);

  interface MilestoneAPIResponse {
    id: number;
    number: number;
    title: string;
    description: string | null;
    state: "open" | "closed";
    due_on: string | null;
  }

  const { data } = await githubRequest<MilestoneAPIResponse[]>(
    token,
    `/repos/${repo.owner}/${repo.name}/milestones?state=${state}&per_page=100`
  );

  return data.map((milestone) => ({
    id: milestone.id,
    number: milestone.number,
    title: milestone.title,
    description: milestone.description || undefined,
    state: milestone.state,
    due_on: milestone.due_on || undefined,
  }));
}

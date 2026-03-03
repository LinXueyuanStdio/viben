/**
 * GitHub Integration Types
 *
 * Type definitions for GitHub integration in Viben workspace settings.
 * Supports authentication (gh CLI + PAT), repository management, issues,
 * pull requests, and releases.
 */

// ============================================================================
// Authentication Types
// ============================================================================

/**
 * Authentication method type
 */
export type GitHubAuthType = "gh_cli" | "pat";

/**
 * GitHub authentication configuration
 */
export interface GitHubAuth {
  /** Authentication method */
  type: GitHubAuthType;
  /** Access token (PAT or token from gh CLI) */
  token: string;
  /** Token expiration time (ISO 8601) */
  expires_at?: string;
}

/**
 * GitHub user information
 */
export interface GitHubUser {
  /** User ID */
  id: number;
  /** Username (login) */
  login: string;
  /** Display name */
  name?: string;
  /** Avatar URL */
  avatar_url: string;
  /** Profile URL */
  html_url: string;
  /** Email (may be null if private) */
  email?: string;
}

// ============================================================================
// Repository Types
// ============================================================================

/**
 * GitHub repository information
 */
export interface GitHubRepository {
  /** Repository ID */
  id: number;
  /** Repository owner */
  owner: string;
  /** Repository name */
  name: string;
  /** Full name (owner/name) */
  full_name: string;
  /** Default branch */
  default_branch: string;
  /** Repository URL */
  url: string;
  /** Clone URL (HTTPS) */
  clone_url?: string;
  /** SSH URL */
  ssh_url?: string;
  /** Whether the repository is private */
  private: boolean;
  /** Repository description */
  description?: string;
}

/**
 * Repository configuration stored in github.yaml
 */
export interface GitHubRepositoryConfig {
  /** Repository owner */
  owner: string;
  /** Repository name */
  name: string;
  /** Full name (owner/name) */
  full_name: string;
  /** Default branch */
  default_branch: string;
  /** Repository URL */
  url: string;
  /** Repository description */
  description?: string;
  /** Number of stars */
  stargazers_count?: number;
  /** Number of forks */
  forks_count?: number;
}

// ============================================================================
// Issue Types
// ============================================================================

/**
 * GitHub label
 */
export interface GitHubLabel {
  /** Label ID */
  id: number;
  /** Label name */
  name: string;
  /** Label color (hex without #) */
  color: string;
  /** Label description */
  description?: string;
}

/**
 * Issue state
 */
export type GitHubIssueState = "open" | "closed";

/**
 * GitHub issue
 */
export interface GitHubIssue {
  /** Issue ID */
  id: number;
  /** Issue number */
  number: number;
  /** Issue title */
  title: string;
  /** Issue body (markdown) */
  body?: string;
  /** Issue state */
  state: GitHubIssueState;
  /** Issue labels */
  labels: GitHubLabel[];
  /** Assignees */
  assignees: GitHubUser[];
  /** Issue author */
  user: GitHubUser;
  /** Creation timestamp */
  created_at: string;
  /** Last update timestamp */
  updated_at: string;
  /** Close timestamp (if closed) */
  closed_at?: string;
  /** Issue URL */
  html_url: string;
  /** Number of comments */
  comments: number;
  /** Milestone (if assigned) */
  milestone?: GitHubMilestone;
}

/**
 * GitHub milestone
 */
export interface GitHubMilestone {
  /** Milestone ID */
  id: number;
  /** Milestone number */
  number: number;
  /** Milestone title */
  title: string;
  /** Milestone description */
  description?: string;
  /** Milestone state */
  state: "open" | "closed";
  /** Due date */
  due_on?: string;
}

/**
 * Issue comment
 */
export interface GitHubComment {
  /** Comment ID */
  id: number;
  /** Comment body */
  body: string;
  /** Comment author */
  user: GitHubUser;
  /** Creation timestamp */
  created_at: string;
  /** Last update timestamp */
  updated_at: string;
}

// ============================================================================
// Pull Request Types
// ============================================================================

/**
 * Pull request state
 */
export type GitHubPRState = "open" | "closed" | "merged";

/**
 * GitHub pull request
 */
export interface GitHubPullRequest {
  /** PR ID */
  id: number;
  /** PR number */
  number: number;
  /** PR title */
  title: string;
  /** PR body (markdown) */
  body?: string;
  /** PR state */
  state: GitHubPRState;
  /** Whether PR is merged */
  merged: boolean;
  /** Merge timestamp (if merged) */
  merged_at?: string;
  /** PR labels */
  labels: GitHubLabel[];
  /** PR author */
  user: GitHubUser;
  /** Head branch */
  head: {
    ref: string;
    sha: string;
  };
  /** Base branch */
  base: {
    ref: string;
    sha: string;
  };
  /** Creation timestamp */
  created_at: string;
  /** Last update timestamp */
  updated_at: string;
  /** Close timestamp (if closed) */
  closed_at?: string;
  /** PR URL */
  html_url: string;
  /** Whether PR is draft */
  draft: boolean;
  /** Mergeable state */
  mergeable_state?: string;
  /** Number of comments */
  comments: number;
  /** Number of commits */
  commits: number;
  /** Number of additions */
  additions: number;
  /** Number of deletions */
  deletions: number;
  /** Number of changed files */
  changed_files: number;
  /** Assignees */
  assignees?: GitHubUser[];
}

// ============================================================================
// Release Types
// ============================================================================

/**
 * GitHub release asset
 */
export interface GitHubReleaseAsset {
  /** Asset ID */
  id: number;
  /** Asset name */
  name: string;
  /** Content type */
  content_type: string;
  /** File size in bytes */
  size: number;
  /** Download URL */
  browser_download_url: string;
  /** Download count */
  download_count: number;
}

/**
 * GitHub release
 */
export interface GitHubRelease {
  /** Release ID */
  id: number;
  /** Tag name */
  tag_name: string;
  /** Release name/title */
  name?: string;
  /** Release body (markdown) */
  body?: string;
  /** Whether release is draft */
  draft: boolean;
  /** Whether release is prerelease */
  prerelease: boolean;
  /** Creation timestamp */
  created_at: string;
  /** Publish timestamp */
  published_at?: string;
  /** Release author */
  author: GitHubUser;
  /** Release URL */
  html_url: string;
  /** Target commitish */
  target_commitish: string;
  /** Release assets */
  assets: GitHubReleaseAsset[];
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * GitHub preferences stored in config
 */
export interface GitHubPreferences {
  /** Auto sync issues on open */
  auto_sync_issues?: boolean;
  /** Labels to filter issues by */
  issue_labels_filter?: string[];
  /** Default assignee for new issues */
  default_assignee?: string;
}

/**
 * GitHub configuration file structure
 * Stored at ~/.viben/workspaces/{workspace_id}/github.yaml
 */
export interface GitHubConfig {
  /** Authentication information */
  auth?: GitHubAuth;
  /** Connected repository */
  repository?: GitHubRepositoryConfig;
  /** User preferences */
  preferences?: GitHubPreferences;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

/**
 * Authentication status response
 */
export interface GitHubAuthStatusResponse {
  /** Whether user is authenticated */
  authenticated: boolean;
  /** User information (if authenticated) */
  user?: GitHubUser;
  /** Authentication type (if authenticated) */
  auth_type?: GitHubAuthType;
  /** Whether gh CLI is available */
  gh_cli_available?: boolean;
  /** Whether gh CLI is logged in */
  gh_cli_logged_in?: boolean;
}

/**
 * OAuth device code response
 */
export interface GitHubOAuthDeviceCodeResponse {
  /** Device code */
  device_code: string;
  /** User code to enter */
  user_code: string;
  /** Verification URL */
  verification_uri: string;
  /** Expiration in seconds */
  expires_in: number;
  /** Polling interval in seconds */
  interval: number;
}

/**
 * OAuth token response
 */
export interface GitHubOAuthTokenResponse {
  /** Access token */
  access_token: string;
  /** Token type */
  token_type: string;
  /** Token scope */
  scope: string;
}

/**
 * PAT verification request
 */
export interface GitHubPATRequest {
  /** Personal access token */
  token: string;
}

/**
 * Repository connect request
 */
export interface GitHubConnectRepoRequest {
  /** Repository owner */
  owner: string;
  /** Repository name */
  name: string;
}

/**
 * Create PR request
 */
export interface GitHubCreatePRRequest {
  /** PR title */
  title: string;
  /** PR body */
  body?: string;
  /** Head branch */
  head: string;
  /** Base branch */
  base: string;
  /** Whether to create as draft */
  draft?: boolean;
}

/**
 * Create release request
 */
export interface GitHubCreateReleaseRequest {
  /** Tag name */
  tag_name: string;
  /** Release name */
  name?: string;
  /** Release body */
  body?: string;
  /** Whether release is draft */
  draft?: boolean;
  /** Whether release is prerelease */
  prerelease?: boolean;
  /** Target commitish (branch/commit) */
  target_commitish?: string;
}

/**
 * Issue investigation request
 */
export interface GitHubInvestigateIssueRequest {
  /** Whether to save spec file */
  save_spec?: boolean;
}

/**
 * Issue import request
 */
export interface GitHubImportIssuesRequest {
  /** Issue numbers to import */
  issue_numbers: number[];
}

/**
 * Issue investigation result
 */
export interface GitHubIssueInvestigation {
  /** Issue number */
  issue_number: number;
  /** Complexity assessment */
  complexity: "simple" | "medium" | "complex";
  /** Estimated number of files affected */
  estimated_files: number;
  /** Affected areas in the codebase */
  affected_areas: string[];
  /** Implementation hints */
  implementation_hints: string[];
  /** Generated spec content */
  spec_content?: string;
  /** Path to saved spec file */
  spec_path?: string;
}

/**
 * Paginated list response
 */
export interface GitHubPaginatedResponse<T> {
  /** Items */
  items: T[];
  /** Total count */
  total_count?: number;
  /** Current page */
  page: number;
  /** Items per page */
  per_page: number;
  /** Whether there are more pages */
  has_more: boolean;
}

/**
 * List issues query parameters
 */
export interface GitHubListIssuesParams {
  /** Issue state filter */
  state?: GitHubIssueState | "all";
  /** Labels filter (comma-separated) */
  labels?: string;
  /** Assignee filter */
  assignee?: string;
  /** Sort field */
  sort?: "created" | "updated" | "comments";
  /** Sort direction */
  direction?: "asc" | "desc";
  /** Page number */
  page?: number;
  /** Items per page */
  per_page?: number;
}

/**
 * List PRs query parameters
 */
export interface GitHubListPRsParams {
  /** PR state filter */
  state?: "open" | "closed" | "all";
  /** Sort field */
  sort?: "created" | "updated" | "popularity" | "long-running";
  /** Sort direction */
  direction?: "asc" | "desc";
  /** Page number */
  page?: number;
  /** Items per page */
  per_page?: number;
}

/**
 * List releases query parameters
 */
export interface GitHubListReleasesParams {
  /** Page number */
  page?: number;
  /** Items per page */
  per_page?: number;
}

// ============================================================================
// Spec File Types
// ============================================================================

/**
 * Spec file source information
 */
export interface SpecSource {
  /** Source type */
  type: "github_issue";
  /** Issue number */
  number: number;
  /** Issue URL */
  url: string;
  /** Sync timestamp */
  synced_at: string;
}

/**
 * Spec file analysis section
 */
export interface SpecAnalysis {
  /** Complexity assessment */
  complexity: "simple" | "medium" | "complex";
  /** Estimated number of files affected */
  estimated_files: number;
  /** Affected areas in the codebase */
  affected_areas: string[];
}

/**
 * Spec file content section
 */
export interface SpecContent {
  /** Spec title */
  title: string;
  /** Spec description */
  description: string;
  /** Requirements list */
  requirements: string[];
  /** Implementation hints */
  implementation_hints: string[];
}

/**
 * Spec file structure
 * Stored at .viben/specs/issues/issue-{number}.yaml
 */
export interface SpecFile {
  /** Source information */
  source: SpecSource;
  /** Analysis results */
  analysis: SpecAnalysis;
  /** Spec content */
  spec: SpecContent;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * GitHub API error response
 */
export interface GitHubAPIError {
  /** Error message */
  message: string;
  /** Error documentation URL */
  documentation_url?: string;
  /** Error details */
  errors?: Array<{
    resource: string;
    field: string;
    code: string;
  }>;
}

/**
 * GitHub rate limit information
 */
export interface GitHubRateLimit {
  /** Rate limit */
  limit: number;
  /** Remaining requests */
  remaining: number;
  /** Reset timestamp (Unix) */
  reset: number;
  /** Used requests */
  used: number;
}

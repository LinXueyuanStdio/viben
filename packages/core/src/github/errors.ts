/**
 * GitHub Error Types
 *
 * Error definitions for GitHub integration, including:
 * - Authentication errors (gh CLI not installed, not logged in)
 * - Repository errors (not a git repo, not a GitHub repo)
 * - API errors (rate limit, network, permission)
 * - Task errors (worktree conflict, task running)
 */

// ============================================================================
// Error Codes
// ============================================================================

/**
 * GitHub error codes
 */
export enum GitHubErrorCode {
  // Authentication related
  GH_NOT_INSTALLED = "GH_NOT_INSTALLED",
  GH_NOT_AUTHENTICATED = "GH_NOT_AUTHENTICATED",
  GH_AUTH_EXPIRED = "GH_AUTH_EXPIRED",

  // Repository related
  NOT_A_GIT_REPO = "NOT_A_GIT_REPO",
  NO_REMOTE_ORIGIN = "NO_REMOTE_ORIGIN",
  NOT_GITHUB_REPO = "NOT_GITHUB_REPO",
  REPO_NOT_CONNECTED = "REPO_NOT_CONNECTED",

  // API related
  RATE_LIMITED = "RATE_LIMITED",
  NETWORK_ERROR = "NETWORK_ERROR",
  PERMISSION_DENIED = "PERMISSION_DENIED",
  API_ERROR = "API_ERROR",

  // Task related
  WORKTREE_CONFLICT = "WORKTREE_CONFLICT",
  WORKTREE_CREATE_FAILED = "WORKTREE_CREATE_FAILED",
  TASK_ALREADY_RUNNING = "TASK_ALREADY_RUNNING",
  TASK_NOT_FOUND = "TASK_NOT_FOUND",

  // Issue related
  ISSUE_NOT_FOUND = "ISSUE_NOT_FOUND",
  ISSUE_ALREADY_CLOSED = "ISSUE_ALREADY_CLOSED",

  // Command related
  COMMAND_TIMEOUT = "COMMAND_TIMEOUT",
  COMMAND_FAILED = "COMMAND_FAILED",

  // Analysis related
  ANALYSIS_FAILED = "ANALYSIS_FAILED",
  MODEL_NOT_CONFIGURED = "MODEL_NOT_CONFIGURED",

  // General
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

// ============================================================================
// Error Class
// ============================================================================

/**
 * GitHub specific error with error code and recoverability info
 */
export class GitHubError extends Error {
  /** Error code */
  public readonly code: GitHubErrorCode;

  /** Whether the error is recoverable (can retry) */
  public readonly recoverable: boolean;

  /** Additional context data */
  public readonly context?: Record<string, unknown>;

  /** Original error that caused this error */
  public readonly originalCause?: Error;

  constructor(
    message: string,
    code: GitHubErrorCode,
    options?: {
      recoverable?: boolean;
      context?: Record<string, unknown>;
      cause?: Error;
    }
  ) {
    super(message);
    this.name = "GitHubError";
    this.code = code;
    this.recoverable = options?.recoverable ?? true;
    this.context = options?.context;
    this.originalCause = options?.cause;

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, GitHubError);
    }
  }

  /**
   * Create a user-friendly error message
   */
  toUserMessage(): string {
    switch (this.code) {
      case GitHubErrorCode.GH_NOT_INSTALLED:
        return "GitHub CLI is not installed. Please install it from https://cli.github.com";
      case GitHubErrorCode.GH_NOT_AUTHENTICATED:
        return "Not logged in to GitHub CLI. Please run: gh auth login";
      case GitHubErrorCode.GH_AUTH_EXPIRED:
        return "GitHub authentication has expired. Please re-authenticate.";
      case GitHubErrorCode.NOT_A_GIT_REPO:
        return "This directory is not a Git repository.";
      case GitHubErrorCode.NO_REMOTE_ORIGIN:
        return "No remote 'origin' configured for this repository.";
      case GitHubErrorCode.NOT_GITHUB_REPO:
        return "This repository is not hosted on GitHub.";
      case GitHubErrorCode.REPO_NOT_CONNECTED:
        return "No GitHub repository connected. Please connect to a repository first.";
      case GitHubErrorCode.RATE_LIMITED:
        return "GitHub API rate limit exceeded. Please wait before trying again.";
      case GitHubErrorCode.NETWORK_ERROR:
        return "Network error while connecting to GitHub. Please check your connection.";
      case GitHubErrorCode.PERMISSION_DENIED:
        return "Permission denied. Please check your access to this repository.";
      case GitHubErrorCode.WORKTREE_CONFLICT:
        return "A worktree already exists for this branch. Please clean up first.";
      case GitHubErrorCode.TASK_ALREADY_RUNNING:
        return "An auto-fix task is already running for this issue.";
      case GitHubErrorCode.ISSUE_NOT_FOUND:
        return "Issue not found.";
      case GitHubErrorCode.COMMAND_TIMEOUT:
        return "Command timed out. Please try again.";
      case GitHubErrorCode.MODEL_NOT_CONFIGURED:
        return "AI model not configured for GitHub analysis.";
      default:
        return this.message;
    }
  }

  /**
   * Serialize error for API response
   */
  toJSON(): Record<string, unknown> {
    return {
      error: this.message,
      code: this.code,
      recoverable: this.recoverable,
      context: this.context,
    };
  }
}

// ============================================================================
// Error Factory Functions
// ============================================================================

/**
 * Create gh CLI not installed error
 */
export function ghNotInstalledError(): GitHubError {
  return new GitHubError(
    "gh CLI is not installed",
    GitHubErrorCode.GH_NOT_INSTALLED,
    { recoverable: false }
  );
}

/**
 * Create gh CLI not authenticated error
 */
export function ghNotAuthenticatedError(): GitHubError {
  return new GitHubError(
    "gh CLI is not authenticated",
    GitHubErrorCode.GH_NOT_AUTHENTICATED,
    { recoverable: true }
  );
}

/**
 * Create not a git repo error
 */
export function notGitRepoError(path: string): GitHubError {
  return new GitHubError(
    `${path} is not a Git repository`,
    GitHubErrorCode.NOT_A_GIT_REPO,
    { recoverable: false, context: { path } }
  );
}

/**
 * Create not a GitHub repo error
 */
export function notGitHubRepoError(remoteUrl?: string): GitHubError {
  return new GitHubError(
    "Repository is not hosted on GitHub",
    GitHubErrorCode.NOT_GITHUB_REPO,
    { recoverable: false, context: { remoteUrl } }
  );
}

/**
 * Create rate limit error
 */
export function rateLimitError(resetTime?: number): GitHubError {
  return new GitHubError(
    "GitHub API rate limit exceeded",
    GitHubErrorCode.RATE_LIMITED,
    { recoverable: true, context: { resetTime } }
  );
}

/**
 * Create network error
 */
export function networkError(cause?: Error): GitHubError {
  return new GitHubError(
    "Network error while connecting to GitHub",
    GitHubErrorCode.NETWORK_ERROR,
    { recoverable: true, cause }
  );
}

/**
 * Create permission denied error
 */
export function permissionDeniedError(resource?: string): GitHubError {
  return new GitHubError(
    "Permission denied",
    GitHubErrorCode.PERMISSION_DENIED,
    { recoverable: false, context: { resource } }
  );
}

/**
 * Create worktree conflict error
 */
export function worktreeConflictError(branch: string, path: string): GitHubError {
  return new GitHubError(
    `Worktree already exists for branch ${branch}`,
    GitHubErrorCode.WORKTREE_CONFLICT,
    { recoverable: true, context: { branch, path } }
  );
}

/**
 * Create task already running error
 */
export function taskAlreadyRunningError(issueNumber: number, taskId: string): GitHubError {
  return new GitHubError(
    `Auto-fix task already running for issue #${issueNumber}`,
    GitHubErrorCode.TASK_ALREADY_RUNNING,
    { recoverable: false, context: { issueNumber, taskId } }
  );
}

/**
 * Create issue not found error
 */
export function issueNotFoundError(issueNumber: number): GitHubError {
  return new GitHubError(
    `Issue #${issueNumber} not found`,
    GitHubErrorCode.ISSUE_NOT_FOUND,
    { recoverable: false, context: { issueNumber } }
  );
}

/**
 * Create command timeout error
 */
export function commandTimeoutError(command: string, timeout: number): GitHubError {
  return new GitHubError(
    `Command timed out after ${timeout}ms`,
    GitHubErrorCode.COMMAND_TIMEOUT,
    { recoverable: true, context: { command, timeout } }
  );
}

/**
 * Create model not configured error
 */
export function modelNotConfiguredError(): GitHubError {
  return new GitHubError(
    "AI model not configured for GitHub analysis",
    GitHubErrorCode.MODEL_NOT_CONFIGURED,
    { recoverable: false }
  );
}

// ============================================================================
// Error Type Guards
// ============================================================================

/**
 * Check if an error is a GitHubError
 */
export function isGitHubError(error: unknown): error is GitHubError {
  return error instanceof GitHubError;
}

/**
 * Check if error is recoverable
 */
export function isRecoverableError(error: unknown): boolean {
  if (isGitHubError(error)) {
    return error.recoverable;
  }
  return true; // Assume unknown errors are recoverable
}

/**
 * Check if error is an auth error
 */
export function isAuthError(error: unknown): boolean {
  if (isGitHubError(error)) {
    return [
      GitHubErrorCode.GH_NOT_AUTHENTICATED,
      GitHubErrorCode.GH_AUTH_EXPIRED,
      GitHubErrorCode.PERMISSION_DENIED,
    ].includes(error.code);
  }
  return false;
}

/**
 * Check if error is a rate limit error
 */
export function isRateLimitError(error: unknown): boolean {
  return isGitHubError(error) && error.code === GitHubErrorCode.RATE_LIMITED;
}

/**
 * Wrap an error in GitHubError if not already
 */
export function wrapError(error: unknown, defaultCode: GitHubErrorCode = GitHubErrorCode.UNKNOWN_ERROR): GitHubError {
  if (isGitHubError(error)) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);
  const cause = error instanceof Error ? error : undefined;

  return new GitHubError(message, defaultCode, { cause });
}

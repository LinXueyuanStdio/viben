/**
 * GitHub CLI (gh) Client
 *
 * Wrapper for gh CLI operations with:
 * - Timeout protection (30s default)
 * - Exponential backoff retry
 * - JSON output parsing
 * - Working directory awareness
 */

import { exec, spawn } from "node:child_process";
import { promisify } from "node:util";
import {
  GitHubError,
  GitHubErrorCode,
  ghNotInstalledError,
  ghNotAuthenticatedError,
  commandTimeoutError,
  networkError,
  rateLimitError,
  wrapError,
} from "./errors";

const execAsync = promisify(exec);

// ============================================================================
// Types
// ============================================================================

/**
 * GH Client configuration
 */
export interface GHClientConfig {
  /** Working directory (for repo detection) */
  cwd: string;
  /** Command timeout in ms (default: 30000) */
  timeout?: number;
  /** Number of retries (default: 3) */
  retries?: number;
  /** Base delay for exponential backoff in ms (default: 1000) */
  retryDelay?: number;
}

/**
 * GitHub Issue from gh CLI
 */
export interface GHIssue {
  number: number;
  title: string;
  body: string;
  state: "OPEN" | "CLOSED";
  stateReason?: string;
  labels: Array<{ name: string }>;
  assignees: Array<{ login: string }>;
  author: { login: string };
  created_at: string;
  updated_at: string;
  closed_at?: string;
  url: string;
  comments: { totalCount: number };
  milestone?: { title: string; number: number };
}

/**
 * GitHub Comment from gh CLI
 */
export interface GHComment {
  id: string;
  body: string;
  author: { login: string };
  created_at: string;
  updated_at: string;
}

/**
 * GitHub PR from gh CLI
 */
export interface GHPR {
  number: number;
  title: string;
  body: string;
  state: "OPEN" | "CLOSED" | "MERGED";
  isDraft: boolean;
  author: { login: string };
  headRefName: string;
  baseRefName: string;
  url: string;
  created_at: string;
  updated_at: string;
  merged_at?: string;
  closed_at?: string;
  additions: number;
  deletions: number;
  changedFiles: number;
}

/**
 * Repository info
 */
export interface GHRepoInfo {
  owner: string;
  name: string;
  url: string;
  defaultBranch: string;
  isPrivate: boolean;
}

/**
 * List issues options
 */
export interface ListIssuesOptions {
  state?: "open" | "closed" | "all";
  labels?: string[];
  limit?: number;
  assignee?: string;
}

/**
 * Create PR options
 */
export interface CreatePROptions {
  title: string;
  body: string;
  head: string;
  base: string;
  draft?: boolean;
}

// ============================================================================
// Raw Types (matching gh CLI JSON output with camelCase)
// ============================================================================

/**
 * Raw GitHub Issue from gh CLI (camelCase)
 */
interface RawGHIssue {
  number: number;
  title: string;
  body: string;
  state: "OPEN" | "CLOSED";
  stateReason?: string;
  labels: Array<{ name: string }>;
  assignees: Array<{ login: string }>;
  author: { login: string };
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  url: string;
  comments: { totalCount: number };
  milestone?: { title: string; number: number };
}

/**
 * Raw GitHub PR from gh CLI (camelCase)
 */
interface RawGHPR {
  number: number;
  title: string;
  body: string;
  state: "OPEN" | "CLOSED" | "MERGED";
  isDraft: boolean;
  author: { login: string };
  headRefName: string;
  baseRefName: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  mergedAt?: string;
  closedAt?: string;
  additions: number;
  deletions: number;
  changedFiles: number;
}

// ============================================================================
// Transformation Functions
// ============================================================================

/**
 * Transform raw gh CLI issue to snake_case interface
 */
function transformIssue(raw: RawGHIssue): GHIssue {
  return {
    number: raw.number,
    title: raw.title,
    body: raw.body,
    state: raw.state,
    stateReason: raw.stateReason,
    labels: raw.labels,
    assignees: raw.assignees,
    author: raw.author,
    created_at: raw.createdAt,
    updated_at: raw.updatedAt,
    closed_at: raw.closedAt,
    url: raw.url,
    comments: raw.comments,
    milestone: raw.milestone,
  };
}

/**
 * Transform raw gh CLI PR to snake_case interface
 */
function transformPR(raw: RawGHPR): GHPR {
  return {
    number: raw.number,
    title: raw.title,
    body: raw.body,
    state: raw.state,
    isDraft: raw.isDraft,
    author: raw.author,
    headRefName: raw.headRefName,
    baseRefName: raw.baseRefName,
    url: raw.url,
    created_at: raw.createdAt,
    updated_at: raw.updatedAt,
    merged_at: raw.mergedAt,
    closed_at: raw.closedAt,
    additions: raw.additions,
    deletions: raw.deletions,
    changedFiles: raw.changedFiles,
  };
}

// ============================================================================
// GH Client Class
// ============================================================================

/**
 * GitHub CLI client wrapper
 */
export class GHClient {
  private readonly cwd: string;
  private readonly timeout: number;
  private readonly retries: number;
  private readonly retryDelay: number;

  constructor(config: GHClientConfig) {
    this.cwd = config.cwd;
    this.timeout = config.timeout ?? 30000;
    this.retries = config.retries ?? 3;
    this.retryDelay = config.retryDelay ?? 1000;
  }

  // --------------------------------------------------------------------------
  // Auth & Repo Info
  // --------------------------------------------------------------------------

  /**
   * Check if gh CLI is installed
   */
  async isInstalled(): Promise<boolean> {
    try {
      await this.exec(["--version"], { skipRetry: true, timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check authentication status
   */
  async checkAuth(): Promise<boolean> {
    try {
      await this.exec(["auth", "status"], { skipRetry: true, timeout: 10000 });
      return true;
    } catch (error) {
      // gh auth status returns non-zero if not logged in
      const message = error instanceof Error ? error.message : "";
      // Check if it's an auth issue vs gh not found
      if (message.includes("not logged") || message.includes("no accounts")) {
        return false;
      }
      // If stderr contains "Logged in", it's actually logged in
      if (message.includes("Logged in")) {
        return true;
      }
      return false;
    }
  }

  /**
   * Get the current GitHub auth token
   */
  async getToken(): Promise<string | null> {
    try {
      const result = await this.exec(["auth", "token"], { skipRetry: true });
      return result.trim() || null;
    } catch {
      return null;
    }
  }

  /**
   * Get repository info from current directory
   */
  async getRepoInfo(): Promise<GHRepoInfo> {
    const result = await this.exec([
      "repo",
      "view",
      "--json",
      "owner,name,url,defaultBranchRef,isPrivate",
    ]);

    const data = JSON.parse(result);
    return {
      owner: data.owner.login,
      name: data.name,
      url: data.url,
      defaultBranch: data.defaultBranchRef?.name || "main",
      isPrivate: data.isPrivate,
    };
  }

  // --------------------------------------------------------------------------
  // Issue Operations
  // --------------------------------------------------------------------------

  /**
   * List issues
   */
  async listIssues(options: ListIssuesOptions = {}): Promise<GHIssue[]> {
    const args = [
      "issue",
      "list",
      "--json",
      "number,title,body,state,stateReason,labels,assignees,author,createdAt,updatedAt,closedAt,url,comments,milestone",
      "--limit",
      String(options.limit ?? 30),
    ];

    if (options.state && options.state !== "all") {
      args.push("--state", options.state);
    }

    if (options.labels && options.labels.length > 0) {
      args.push("--label", options.labels.join(","));
    }

    if (options.assignee) {
      args.push("--assignee", options.assignee);
    }

    const result = await this.exec(args);
    const issues = JSON.parse(result) as RawGHIssue[];
    return issues.map(transformIssue);
  }

  /**
   * Get a single issue by number
   */
  async getIssue(number: number): Promise<GHIssue> {
    const result = await this.exec([
      "issue",
      "view",
      String(number),
      "--json",
      "number,title,body,state,stateReason,labels,assignees,author,createdAt,updatedAt,closedAt,url,comments,milestone",
    ]);

    const issue = JSON.parse(result) as RawGHIssue;
    return transformIssue(issue);
  }

  /**
   * Get issue comments with pagination support
   * Uses gh api with --paginate to fetch all comments automatically
   */
  async getIssueComments(number: number): Promise<GHComment[]> {
    const { owner, name } = await this.getRepoInfo();

    // Use gh api with --paginate flag which automatically handles pagination
    // and concatenates all pages into a single JSON array
    const result = await this.exec([
      "api",
      "--paginate",
      `repos/${owner}/${name}/issues/${number}/comments`,
    ]);

    if (!result.trim()) {
      return [];
    }

    // gh api --paginate returns concatenated JSON arrays, need to parse carefully
    // Each page is a separate JSON array, so we get "[...][...][...]"
    // We need to handle this by parsing as NDJSON or combining arrays
    try {
      // Try parsing as a single array first (single page case)
      const comments = JSON.parse(result) as Array<{
        id: number;
        body: string;
        user: { login: string };
        created_at: string;
        updated_at: string;
      }>;

      return comments.map((c) => ({
        id: String(c.id),
        body: c.body,
        author: { login: c.user.login },
        created_at: c.created_at,
        updated_at: c.updated_at,
      }));
    } catch {
      // Multi-page case: arrays are concatenated like "[...][...][...]"
      // Split by "][" and reconstruct
      const combined = result
        .replace(/\]\s*\[/g, ",")
        .replace(/^\[/, "[")
        .replace(/\]$/, "]");

      const comments = JSON.parse(combined) as Array<{
        id: number;
        body: string;
        user: { login: string };
        created_at: string;
        updated_at: string;
      }>;

      return comments.map((c) => ({
        id: String(c.id),
        body: c.body,
        author: { login: c.user.login },
        created_at: c.created_at,
        updated_at: c.updated_at,
      }));
    }
  }

  /**
   * Create an issue
   */
  async createIssue(
    title: string,
    body: string,
    labels?: string[]
  ): Promise<GHIssue> {
    const args = ["issue", "create", "--title", title, "--body", body];

    if (labels && labels.length > 0) {
      args.push("--label", labels.join(","));
    }

    // Get the issue number from output
    const result = await this.exec(args);
    const match = result.match(/https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/(\d+)/);
    if (!match) {
      throw new GitHubError(
        "Failed to parse created issue URL",
        GitHubErrorCode.API_ERROR
      );
    }

    // Fetch the full issue details
    return this.getIssue(parseInt(match[1], 10));
  }

  /**
   * Add labels to an issue
   */
  async addLabels(number: number, labels: string[]): Promise<void> {
    await this.exec([
      "issue",
      "edit",
      String(number),
      "--add-label",
      labels.join(","),
    ]);
  }

  /**
   * Remove labels from an issue
   */
  async removeLabels(number: number, labels: string[]): Promise<void> {
    await this.exec([
      "issue",
      "edit",
      String(number),
      "--remove-label",
      labels.join(","),
    ]);
  }

  /**
   * Close an issue
   */
  async closeIssue(number: number, comment?: string): Promise<void> {
    const args = ["issue", "close", String(number)];
    if (comment) {
      args.push("--comment", comment);
    }
    await this.exec(args);
  }

  /**
   * Add a comment to an issue
   */
  async addIssueComment(number: number, body: string): Promise<void> {
    await this.exec(["issue", "comment", String(number), "--body", body]);
  }

  // --------------------------------------------------------------------------
  // PR Operations
  // --------------------------------------------------------------------------

  /**
   * List pull requests
   */
  async listPRs(options: { state?: string; limit?: number } = {}): Promise<GHPR[]> {
    const args = [
      "pr",
      "list",
      "--json",
      "number,title,body,state,isDraft,author,headRefName,baseRefName,url,createdAt,updatedAt,mergedAt,closedAt,additions,deletions,changedFiles",
      "--limit",
      String(options.limit ?? 30),
    ];

    if (options.state && options.state !== "all") {
      args.push("--state", options.state);
    }

    const result = await this.exec(args);
    const prs = JSON.parse(result) as RawGHPR[];
    return prs.map(transformPR);
  }

  /**
   * Get a single PR by number
   */
  async getPR(number: number): Promise<GHPR> {
    const result = await this.exec([
      "pr",
      "view",
      String(number),
      "--json",
      "number,title,body,state,isDraft,author,headRefName,baseRefName,url,createdAt,updatedAt,mergedAt,closedAt,additions,deletions,changedFiles",
    ]);

    const pr = JSON.parse(result) as RawGHPR;
    return transformPR(pr);
  }

  /**
   * Create a pull request
   */
  async createPR(options: CreatePROptions): Promise<GHPR> {
    const args = [
      "pr",
      "create",
      "--title",
      options.title,
      "--body",
      options.body,
      "--head",
      options.head,
      "--base",
      options.base,
    ];

    if (options.draft) {
      args.push("--draft");
    }

    // Create PR and get URL
    const result = await this.exec(args);
    const match = result.match(/https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/(\d+)/);
    if (!match) {
      throw new GitHubError(
        "Failed to parse created PR URL",
        GitHubErrorCode.API_ERROR
      );
    }

    // Fetch the full PR details
    return this.getPR(parseInt(match[1], 10));
  }

  /**
   * Check if a branch exists on remote
   */
  async branchExists(branch: string): Promise<boolean> {
    try {
      await this.exec(["api", `repos/{owner}/{repo}/branches/${branch}`]);
      return true;
    } catch {
      return false;
    }
  }

  // --------------------------------------------------------------------------
  // Low-level Execution
  // --------------------------------------------------------------------------

  /**
   * Execute a gh CLI command with retries and timeout
   */
  private async exec(
    args: string[],
    options?: {
      skipRetry?: boolean;
      timeout?: number;
    }
  ): Promise<string> {
    const timeout = options?.timeout ?? this.timeout;
    const maxRetries = options?.skipRetry ? 0 : this.retries;

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.execOnce(args, timeout);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry for certain errors
        if (this.shouldNotRetry(lastError)) {
          break;
        }

        // Wait before retrying (exponential backoff)
        if (attempt < maxRetries) {
          const delay = this.retryDelay * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw this.categorizeError(lastError!);
  }

  /**
   * Execute command once
   */
  private async execOnce(args: string[], timeout: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const process = spawn("gh", args, {
        cwd: this.cwd,
        env: { ...globalThis.process.env },
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";
      let killed = false;

      // Set timeout
      const timer = setTimeout(() => {
        killed = true;
        process.kill("SIGTERM");
        reject(commandTimeoutError(["gh", ...args].join(" "), timeout));
      }, timeout);

      process.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      process.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      process.on("close", (code) => {
        clearTimeout(timer);
        if (killed) return;

        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(stderr || stdout || `Command failed with code ${code}`));
        }
      });

      process.on("error", (error) => {
        clearTimeout(timer);
        if (!killed) {
          reject(error);
        }
      });
    });
  }

  /**
   * Determine if error should not be retried
   */
  private shouldNotRetry(error: Error): boolean {
    const message = error.message.toLowerCase();

    // Auth errors - no point retrying
    if (message.includes("not logged") || message.includes("authentication")) {
      return true;
    }

    // Not found errors
    if (message.includes("not found") || message.includes("404")) {
      return true;
    }

    // Permission errors
    if (message.includes("permission") || message.includes("403")) {
      return true;
    }

    return false;
  }

  /**
   * Convert error to appropriate GitHubError
   */
  private categorizeError(error: Error): GitHubError {
    const message = error.message.toLowerCase();

    // gh CLI not installed
    if (message.includes("command not found") || message.includes("enoent")) {
      return ghNotInstalledError();
    }

    // Not authenticated
    if (message.includes("not logged") || message.includes("gh auth login")) {
      return ghNotAuthenticatedError();
    }

    // Rate limit
    if (message.includes("rate limit") || message.includes("429")) {
      return rateLimitError();
    }

    // Network error
    if (
      message.includes("network") ||
      message.includes("timeout") ||
      message.includes("econnrefused")
    ) {
      return networkError(error);
    }

    return wrapError(error, GitHubErrorCode.COMMAND_FAILED);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a GH client for a workspace
 */
export function createGHClient(workspacePath: string, options?: Omit<GHClientConfig, "cwd">): GHClient {
  return new GHClient({
    cwd: workspacePath,
    ...options,
  });
}

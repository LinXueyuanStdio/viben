/**
 * Git Worktree Manager
 *
 * Manages git worktrees for isolated auto-fix execution:
 * - Create worktrees for issue fixes
 * - Execute commands in worktrees
 * - Clean up worktrees after completion
 */

import { exec, spawn } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import {
  GitHubError,
  GitHubErrorCode,
  worktreeConflictError,
} from "../errors";
import { getWorktreeBaseDir, type GitHubAutoFixConfig } from "../config";

const execAsync = promisify(exec);

// ============================================================================
// Types
// ============================================================================

/**
 * Worktree information
 */
export interface WorktreeInfo {
  /** Absolute path to worktree */
  path: string;
  /** Branch name */
  branch: string;
  /** HEAD commit SHA */
  head: string;
  /** Whether it's the main worktree */
  isMain: boolean;
}

/**
 * Command execution result
 */
export interface ExecResult {
  /** Standard output */
  stdout: string;
  /** Standard error */
  stderr: string;
  /** Exit code */
  exitCode: number;
  /** Duration in ms */
  duration: number;
}

/**
 * Worktree manager options
 */
export interface WorktreeManagerOptions {
  /** Command timeout in ms */
  timeout?: number;
}

// ============================================================================
// Worktree Manager Class
// ============================================================================

/**
 * Git worktree manager for isolated execution
 */
export class WorktreeManager {
  private readonly workspacePath: string;
  private readonly baseDir: string;
  private readonly timeout: number;

  constructor(
    workspacePath: string,
    config: GitHubAutoFixConfig,
    options?: WorktreeManagerOptions
  ) {
    this.workspacePath = workspacePath;
    this.baseDir = getWorktreeBaseDir(workspacePath, config);
    this.timeout = options?.timeout ?? 300000; // 5 minutes default
  }

  /**
   * List all worktrees
   */
  async list(): Promise<WorktreeInfo[]> {
    try {
      const { stdout } = await execAsync("git worktree list --porcelain", {
        cwd: this.workspacePath,
      });

      const worktrees: WorktreeInfo[] = [];
      const entries = stdout.split("\n\n").filter((e) => e.trim());

      for (const entry of entries) {
        const lines = entry.split("\n");
        const pathLine = lines.find((l) => l.startsWith("worktree "));
        const headLine = lines.find((l) => l.startsWith("HEAD "));
        const branchLine = lines.find((l) => l.startsWith("branch "));

        if (pathLine) {
          worktrees.push({
            path: pathLine.replace("worktree ", ""),
            head: headLine?.replace("HEAD ", "") ?? "",
            branch: branchLine?.replace("branch refs/heads/", "") ?? "",
            isMain: !branchLine?.includes("worktree"),
          });
        }
      }

      return worktrees;
    } catch {
      return [];
    }
  }

  /**
   * Check if a worktree exists for a branch
   */
  async exists(branch: string): Promise<boolean> {
    const worktrees = await this.list();
    return worktrees.some((w) => w.branch === branch);
  }

  /**
   * Get worktree path for a branch
   */
  getWorktreePath(branch: string): string {
    // Sanitize branch name for filesystem
    const sanitized = branch.replace(/[^a-zA-Z0-9-_]/g, "-");
    return join(this.baseDir, sanitized);
  }

  /**
   * Create a new worktree
   */
  async create(
    branch: string,
    baseBranch?: string
  ): Promise<{ path: string; branch: string }> {
    const worktreePath = this.getWorktreePath(branch);

    // Check if worktree already exists
    if (existsSync(worktreePath)) {
      throw worktreeConflictError(branch, worktreePath);
    }

    // Ensure base directory exists
    if (!existsSync(this.baseDir)) {
      await mkdir(this.baseDir, { recursive: true });
    }

    // Fetch latest from remote first
    try {
      await execAsync("git fetch origin", {
        cwd: this.workspacePath,
        timeout: 60000,
      });
    } catch {
      // Ignore fetch errors (might be offline)
    }

    // Determine the base for the new branch
    const base = baseBranch ?? "HEAD";

    try {
      // Create the new branch and worktree
      await execAsync(
        `git worktree add -b "${branch}" "${worktreePath}" "${base}"`,
        {
          cwd: this.workspacePath,
          timeout: 60000,
        }
      );

      return { path: worktreePath, branch };
    } catch (error) {
      // Clean up if creation failed
      if (existsSync(worktreePath)) {
        await rm(worktreePath, { recursive: true, force: true });
      }

      throw new GitHubError(
        `Failed to create worktree: ${error instanceof Error ? error.message : error}`,
        GitHubErrorCode.WORKTREE_CREATE_FAILED,
        { context: { branch, baseBranch: base } }
      );
    }
  }

  /**
   * Execute a command in a worktree
   */
  async execute(
    worktreePath: string,
    command: string,
    options?: {
      timeout?: number;
      env?: Record<string, string>;
    }
  ): Promise<ExecResult> {
    const timeout = options?.timeout ?? this.timeout;
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const [cmd, ...args] = command.split(" ");
      const proc = spawn(cmd, args, {
        cwd: worktreePath,
        env: {
          ...process.env,
          ...options?.env,
        },
        shell: true,
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";
      let killed = false;

      const timer = setTimeout(() => {
        killed = true;
        proc.kill("SIGTERM");
        reject(new GitHubError(
          `Command timed out after ${timeout}ms`,
          GitHubErrorCode.COMMAND_TIMEOUT,
          { context: { command, timeout } }
        ));
      }, timeout);

      proc.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      proc.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      proc.on("close", (code) => {
        clearTimeout(timer);
        if (killed) return;

        const duration = Date.now() - startTime;
        resolve({
          stdout,
          stderr,
          exitCode: code ?? 0,
          duration,
        });
      });

      proc.on("error", (error) => {
        clearTimeout(timer);
        if (!killed) {
          reject(new GitHubError(
            `Command failed: ${error.message}`,
            GitHubErrorCode.COMMAND_FAILED,
            { context: { command }, cause: error }
          ));
        }
      });
    });
  }

  /**
   * Remove a worktree
   */
  async remove(branch: string): Promise<void> {
    const worktreePath = this.getWorktreePath(branch);

    try {
      // Remove the worktree using git
      await execAsync(`git worktree remove "${worktreePath}" --force`, {
        cwd: this.workspacePath,
        timeout: 30000,
      });
    } catch {
      // If git fails, try to remove manually
      if (existsSync(worktreePath)) {
        await rm(worktreePath, { recursive: true, force: true });

        // Prune worktree references
        try {
          await execAsync("git worktree prune", {
            cwd: this.workspacePath,
            timeout: 10000,
          });
        } catch {
          // Ignore prune errors
        }
      }
    }

    // Also delete the remote branch if it exists
    try {
      await execAsync(`git push origin --delete "${branch}"`, {
        cwd: this.workspacePath,
        timeout: 30000,
      });
    } catch {
      // Ignore - branch might not exist on remote
    }

    // Delete local branch
    try {
      await execAsync(`git branch -D "${branch}"`, {
        cwd: this.workspacePath,
        timeout: 10000,
      });
    } catch {
      // Ignore - branch might not exist
    }
  }

  /**
   * Clean up all auto-fix worktrees
   */
  async cleanup(): Promise<number> {
    let cleaned = 0;

    // Get all worktrees
    const worktrees = await this.list();

    // Find worktrees in our base directory
    for (const wt of worktrees) {
      if (wt.path.startsWith(this.baseDir) && !wt.isMain) {
        try {
          await this.remove(wt.branch);
          cleaned++;
        } catch {
          // Continue with other worktrees
        }
      }
    }

    // Remove base directory if empty
    if (existsSync(this.baseDir)) {
      try {
        await rm(this.baseDir, { recursive: true, force: true });
      } catch {
        // Ignore if not empty
      }
    }

    return cleaned;
  }

  /**
   * Commit changes in a worktree
   */
  async commit(
    worktreePath: string,
    message: string,
    options?: {
      addAll?: boolean;
      files?: string[];
    }
  ): Promise<string> {
    // Stage files
    if (options?.addAll) {
      await this.execute(worktreePath, "git add -A");
    } else if (options?.files && options.files.length > 0) {
      await this.execute(worktreePath, `git add ${options.files.join(" ")}`);
    }

    // Check if there are changes to commit
    const statusResult = await this.execute(worktreePath, "git status --porcelain");
    if (!statusResult.stdout.trim()) {
      throw new GitHubError(
        "No changes to commit",
        GitHubErrorCode.COMMAND_FAILED
      );
    }

    // Commit
    const commitResult = await this.execute(
      worktreePath,
      `git commit -m "${message.replace(/"/g, '\\"')}"`
    );

    if (commitResult.exitCode !== 0) {
      throw new GitHubError(
        `Commit failed: ${commitResult.stderr}`,
        GitHubErrorCode.COMMAND_FAILED
      );
    }

    // Get the commit SHA
    const shaResult = await this.execute(worktreePath, "git rev-parse HEAD");
    return shaResult.stdout.trim();
  }

  /**
   * Push changes to remote
   */
  async push(worktreePath: string, branch: string): Promise<void> {
    const result = await this.execute(
      worktreePath,
      `git push -u origin "${branch}"`
    );

    if (result.exitCode !== 0) {
      throw new GitHubError(
        `Push failed: ${result.stderr}`,
        GitHubErrorCode.COMMAND_FAILED
      );
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a worktree manager for a workspace
 */
export function createWorktreeManager(
  workspacePath: string,
  config: GitHubAutoFixConfig,
  options?: WorktreeManagerOptions
): WorktreeManager {
  return new WorktreeManager(workspacePath, config, options);
}

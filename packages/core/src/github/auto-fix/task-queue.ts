/**
 * Auto-Fix Task Queue
 *
 * Manages the queue of auto-fix tasks:
 * - Task lifecycle management
 * - Concurrent execution control
 * - Progress tracking
 * - Event emission for UI updates
 */

import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import {
  loadGitHubConfig,
  loadTaskState,
  upsertTask,
  updateTaskStatus,
  deleteTask,
  getActiveTaskCount,
  hasActiveTaskForIssue,
  type AutoFixTask,
  type AutoFixTaskStatus,
  type GitHubAutoFixConfig,
} from "../config";
import {
  GitHubError,
  GitHubErrorCode,
  taskAlreadyRunningError,
} from "../errors";
import { type GHClient, createGHClient } from "../gh-client";
import { analyzeIssue, type IssueAnalysis } from "../analysis";
import { createWorktreeManager, type WorktreeManager } from "./worktree-manager";

// ============================================================================
// Types
// ============================================================================

/**
 * Task queue event types
 */
export interface TaskQueueEvents {
  /** Task status changed */
  status_change: {
    task_id: string;
    status: AutoFixTaskStatus;
    task: AutoFixTask;
  };
  /** Task progress update */
  progress: {
    task_id: string;
    message: string;
    percent?: number;
  };
  /** Task log entry */
  log: {
    task_id: string;
    level: "info" | "warn" | "error";
    message: string;
  };
  /** Task error */
  error: {
    task_id: string;
    error: string;
  };
}

/**
 * Fix plan for an issue
 */
export interface FixPlan {
  /** Issue analysis */
  analysis: IssueAnalysis;
  /** Steps to implement the fix */
  steps: FixStep[];
  /** Estimated file changes */
  estimated_changes: FileChange[];
}

/**
 * A step in the fix plan
 */
export interface FixStep {
  /** Step description */
  description: string;
  /** Commands to execute */
  commands?: string[];
  /** File edits to make */
  file_edits?: FileEdit[];
}

/**
 * File edit specification
 */
export interface FileEdit {
  /** File path (relative to repo root) */
  path: string;
  /** Action to take */
  action: "create" | "modify" | "delete";
  /** New content (for create/modify) */
  content?: string;
  /** Patch content (for modify) */
  patch?: string;
}

/**
 * Estimated file change
 */
export interface FileChange {
  /** File path */
  path: string;
  /** Change type */
  type: "add" | "modify" | "delete";
}

/**
 * Task creation options
 */
export interface CreateTaskOptions {
  /** Issue numbers to fix */
  issue_numbers: number[];
  /** Whether to require approval before PR */
  require_approval?: boolean;
  /** Base branch for the fix */
  base_branch?: string;
}

// ============================================================================
// Task Queue Class
// ============================================================================

/**
 * Auto-fix task queue manager
 */
export class AutoFixTaskQueue extends EventEmitter {
  private readonly workspacePath: string;
  private config: GitHubAutoFixConfig | null = null;
  private ghClient: GHClient | null = null;
  private worktreeManager: WorktreeManager | null = null;
  private runningTasks: Map<string, Promise<void>> = new Map();
  private initialized = false;

  constructor(workspacePath: string) {
    super();
    this.workspacePath = workspacePath;
    this.setMaxListeners(100);
  }

  /**
   * Initialize the task queue
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.config = await loadGitHubConfig(this.workspacePath);
    this.ghClient = createGHClient(this.workspacePath);
    this.worktreeManager = createWorktreeManager(this.workspacePath, this.config);
    this.initialized = true;

    // Resume any pending tasks
    await this.resumePendingTasks();
  }

  /**
   * Ensure queue is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Get the current configuration
   */
  getConfig(): GitHubAutoFixConfig | null {
    return this.config;
  }

  /**
   * Create and enqueue a new task
   */
  async enqueue(options: CreateTaskOptions): Promise<string> {
    await this.ensureInitialized();

    const { issue_numbers, require_approval, base_branch } = options;

    // Check if any issue already has an active task
    for (const issueNumber of issue_numbers) {
      const existing = await hasActiveTaskForIssue(this.workspacePath, issueNumber);
      if (existing) {
        throw taskAlreadyRunningError(issueNumber, existing.id);
      }
    }

    // Check max parallel tasks
    const activeCount = await getActiveTaskCount(this.workspacePath);
    const maxParallel = this.config?.auto_fix?.max_parallel_tasks ?? 3;
    if (activeCount >= maxParallel) {
      throw new GitHubError(
        `Maximum parallel tasks (${maxParallel}) reached`,
        GitHubErrorCode.TASK_ALREADY_RUNNING
      );
    }

    // Create task
    const taskId = `task-${randomUUID().slice(0, 8)}`;
    const branchPrefix = this.config?.auto_fix?.branch_prefix ?? "autofix/issue-";
    const branchName = `${branchPrefix}${issue_numbers.join("-")}`;

    const task: AutoFixTask = {
      id: taskId,
      workspace_path: this.workspacePath,
      issue_numbers,
      status: "queued",
      branch_name: branchName,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Store task
    await upsertTask(this.workspacePath, task);

    // Emit status change
    this.emitStatusChange(task);

    // Start processing
    const taskPromise = this.processTask(task, {
      require_approval: require_approval ?? this.config?.auto_fix?.require_human_approval ?? true,
      base_branch: base_branch,
    });
    this.runningTasks.set(taskId, taskPromise);

    return taskId;
  }

  /**
   * Cancel a task
   */
  async cancel(taskId: string): Promise<void> {
    await this.ensureInitialized();

    const task = await updateTaskStatus(
      this.workspacePath,
      taskId,
      "cancelled"
    );

    if (task) {
      this.emitStatusChange(task);

      // Clean up worktree if exists
      if (task.worktree_path && this.worktreeManager) {
        try {
          await this.worktreeManager.remove(task.branch_name!);
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  }

  /**
   * Approve a task awaiting approval
   */
  async approve(taskId: string): Promise<void> {
    await this.ensureInitialized();

    const state = await loadTaskState(this.workspacePath);
    const task = state.tasks.find((t) => t.id === taskId);

    if (!task) {
      throw new GitHubError(
        `Task not found: ${taskId}`,
        GitHubErrorCode.TASK_NOT_FOUND
      );
    }

    if (task.status !== "awaiting_approval") {
      throw new GitHubError(
        `Task is not awaiting approval`,
        GitHubErrorCode.COMMAND_FAILED
      );
    }

    // Update status and continue processing
    const updatedTask = await updateTaskStatus(
      this.workspacePath,
      taskId,
      "creating_pr"
    );

    if (updatedTask) {
      this.emitStatusChange(updatedTask);
      // Continue to create PR
      await this.createPullRequest(updatedTask);
    }
  }

  /**
   * Get a task by ID
   */
  async getTask(taskId: string): Promise<AutoFixTask | null> {
    await this.ensureInitialized();
    const state = await loadTaskState(this.workspacePath);
    return state.tasks.find((t) => t.id === taskId) ?? null;
  }

  /**
   * List all tasks
   */
  async listTasks(): Promise<AutoFixTask[]> {
    await this.ensureInitialized();
    const state = await loadTaskState(this.workspacePath);
    return state.tasks;
  }

  /**
   * Delete a completed task
   */
  async deleteTask(taskId: string): Promise<boolean> {
    await this.ensureInitialized();
    return deleteTask(this.workspacePath, taskId);
  }

  // --------------------------------------------------------------------------
  // Task Processing
  // --------------------------------------------------------------------------

  /**
   * Process a task through the pipeline
   */
  private async processTask(
    task: AutoFixTask,
    options: {
      require_approval: boolean;
      base_branch?: string;
    }
  ): Promise<void> {
    try {
      // Step 1: Analyze
      await this.updateTaskProgress(task.id, "analyzing", "Analyzing issues...", 10);
      const analysis = await this.analyzeIssues(task);

      // Step 2: Plan
      await this.updateTaskProgress(task.id, "plan", "Generating fix plan...", 30);
      const plan = await this.generatePlan(task, analysis);

      // Step 3: Implement
      await this.updateTaskProgress(task.id, "implement", "Creating worktree...", 40);
      await this.executeFixPlan(task, plan, options.base_branch);

      // Step 4: Check
      await this.updateTaskProgress(task.id, "check", "Running tests...", 60);
      await this.runTests(task);

      // Step 5: Fix (if issues found)
      await this.updateTaskProgress(task.id, "fix", "Applying fixes...", 70);

      // Step 6: Approval or PR
      if (options.require_approval) {
        await this.updateTaskProgress(
          task.id,
          "awaiting_approval",
          "Waiting for approval...",
          80
        );
        // Will continue when approve() is called
      } else {
        await this.updateTaskProgress(task.id, "creating_pr", "Creating PR...", 90);
        await this.createPullRequest(task);
      }
    } catch (error) {
      await this.handleTaskError(task, error);
    } finally {
      this.runningTasks.delete(task.id);
    }
  }

  /**
   * Analyze issues for a task
   */
  private async analyzeIssues(task: AutoFixTask): Promise<IssueAnalysis[]> {
    if (!this.ghClient) {
      throw new GitHubError(
        "GH client not initialized",
        GitHubErrorCode.UNKNOWN_ERROR
      );
    }

    const analyses: IssueAnalysis[] = [];

    for (const issueNumber of task.issue_numbers) {
      this.emitLog(task.id, "info", `Analyzing issue #${issueNumber}...`);

      const issue = await this.ghClient.getIssue(issueNumber);
      const comments = await this.ghClient.getIssueComments(issueNumber);

      // Convert GHComment to the expected format
      const convertedComments = comments.map((c) => ({
        id: c.id,
        body: c.body,
        author: c.author,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      }));

      const analysis = await analyzeIssue(issue, convertedComments);
      analyses.push(analysis);
    }

    return analyses;
  }

  /**
   * Generate a fix plan
   */
  private async generatePlan(
    _task: AutoFixTask,
    analyses: IssueAnalysis[]
  ): Promise<FixPlan> {
    // For now, create a simple plan
    // TODO: Use AI to generate actual implementation steps

    const combinedAnalysis = analyses[0]; // Use first analysis as base
    const steps: FixStep[] = [];
    const estimatedChanges: FileChange[] = [];

    // Add files from analysis
    for (const analysis of analyses) {
      for (const file of analysis.estimated_files) {
        if (!estimatedChanges.find((c) => c.path === file)) {
          estimatedChanges.push({ path: file, type: "modify" });
        }
      }
    }

    // Create basic steps
    steps.push({
      description: "Review affected files",
      commands: ["git status"],
    });

    steps.push({
      description: "Implement fix",
      file_edits: [], // TODO: Generate actual edits
    });

    steps.push({
      description: "Run tests",
      commands: ["npm test || pnpm test || yarn test"],
    });

    return {
      analysis: combinedAnalysis,
      steps,
      estimated_changes: estimatedChanges,
    };
  }

  /**
   * Execute the fix plan
   */
  private async executeFixPlan(
    task: AutoFixTask,
    _plan: FixPlan,
    baseBranch?: string
  ): Promise<void> {
    if (!this.worktreeManager) {
      throw new GitHubError(
        "Worktree manager not initialized",
        GitHubErrorCode.UNKNOWN_ERROR
      );
    }

    // Create worktree
    const { path: worktreePath } = await this.worktreeManager.create(
      task.branch_name!,
      baseBranch
    );

    // Update task with worktree path
    await updateTaskStatus(this.workspacePath, task.id, task.status, {
      worktree_path: worktreePath,
    });

    this.emitLog(task.id, "info", `Created worktree at ${worktreePath}`);

    // TODO: Execute actual fix steps
    // For now, just create a placeholder commit
    this.emitLog(task.id, "info", "Fix implementation placeholder - manual review required");
  }

  /**
   * Run tests in the worktree
   */
  private async runTests(task: AutoFixTask): Promise<void> {
    if (!this.worktreeManager || !task.worktree_path) {
      return;
    }

    this.emitLog(task.id, "info", "Running tests...");

    // Try common test commands
    const testCommands = [
      "npm test --if-present",
      "pnpm test --if-present",
      "yarn test --if-present",
    ];

    for (const cmd of testCommands) {
      try {
        const result = await this.worktreeManager.execute(task.worktree_path, cmd);
        if (result.exitCode === 0) {
          this.emitLog(task.id, "info", "Tests passed");
          return;
        }
      } catch {
        // Try next command
      }
    }

    this.emitLog(task.id, "warn", "No tests found or tests skipped");
  }

  /**
   * Create a pull request
   */
  private async createPullRequest(task: AutoFixTask): Promise<void> {
    if (!this.ghClient || !this.worktreeManager || !task.worktree_path) {
      throw new GitHubError(
        "Required components not initialized",
        GitHubErrorCode.UNKNOWN_ERROR
      );
    }

    try {
      // Commit and push
      this.emitLog(task.id, "info", "Committing changes...");

      const commitMessage = `fix: auto-fix for issue(s) #${task.issue_numbers.join(", #")}

This fix was automatically generated.

Closes #${task.issue_numbers.join(", closes #")}`;

      await this.worktreeManager.commit(task.worktree_path, commitMessage, {
        addAll: true,
      });

      this.emitLog(task.id, "info", "Pushing to remote...");
      await this.worktreeManager.push(task.worktree_path, task.branch_name!);

      // Create PR
      this.emitLog(task.id, "info", "Creating pull request...");
      const repoInfo = await this.ghClient.getRepoInfo();

      const prBody = `## Summary

Auto-generated fix for:
${task.issue_numbers.map((n) => `- #${n}`).join("\n")}

## Changes

Please review the changes and ensure they meet the requirements.

---
*Generated by Viben Auto-Fix*`;

      const pr = await this.ghClient.createPR({
        title: `fix: auto-fix for #${task.issue_numbers.join(", #")}`,
        body: prBody,
        head: task.branch_name!,
        base: repoInfo.defaultBranch,
      });

      // Update task with PR number
      const completedTask = await updateTaskStatus(
        this.workspacePath,
        task.id,
        "completed",
        {
          pr_number: pr.number,
          progress_message: `PR #${pr.number} created`,
          progress_percent: 100,
        }
      );

      if (completedTask) {
        this.emitStatusChange(completedTask);
      }

      this.emitLog(task.id, "info", `Pull request #${pr.number} created`);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Handle task error
   */
  private async handleTaskError(
    task: AutoFixTask,
    error: unknown
  ): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);

    const failedTask = await updateTaskStatus(
      this.workspacePath,
      task.id,
      "failed",
      { error: errorMessage }
    );

    if (failedTask) {
      this.emitStatusChange(failedTask);
    }

    this.emitLog(task.id, "error", errorMessage);
    this.emit("error", { task_id: task.id, error: errorMessage });
  }

  /**
   * Resume pending tasks on startup
   */
  private async resumePendingTasks(): Promise<void> {
    const state = await loadTaskState(this.workspacePath);

    // Find tasks that were running but not completed
    const pendingStatuses: AutoFixTaskStatus[] = [
      "queued",
      "analyzing",
      "plan",
      "implement",
      "check",
      "fix",
    ];

    for (const task of state.tasks) {
      if (pendingStatuses.includes(task.status)) {
        // Mark as failed - they need to be restarted manually
        await updateTaskStatus(this.workspacePath, task.id, "failed", {
          error: "Task was interrupted and needs to be restarted",
        });
      }
    }
  }

  // --------------------------------------------------------------------------
  // Event Emission
  // --------------------------------------------------------------------------

  /**
   * Update task progress
   */
  private async updateTaskProgress(
    taskId: string,
    status: AutoFixTaskStatus,
    message: string,
    percent: number
  ): Promise<void> {
    const task = await updateTaskStatus(this.workspacePath, taskId, status, {
      progress_message: message,
      progress_percent: percent,
    });

    if (task) {
      this.emitStatusChange(task);
      this.emit("progress", { task_id: taskId, message, percent });
    }
  }

  /**
   * Emit status change event
   */
  private emitStatusChange(task: AutoFixTask): void {
    this.emit("status_change", {
      task_id: task.id,
      status: task.status,
      task,
    });
  }

  /**
   * Emit log event
   */
  private emitLog(
    taskId: string,
    level: "info" | "warn" | "error",
    message: string
  ): void {
    this.emit("log", { task_id: taskId, level, message });
  }
}

// ============================================================================
// Singleton Management
// ============================================================================

const taskQueues = new Map<string, AutoFixTaskQueue>();

/**
 * Get or create a task queue for a workspace
 */
export function getTaskQueue(workspacePath: string): AutoFixTaskQueue {
  let queue = taskQueues.get(workspacePath);
  if (!queue) {
    queue = new AutoFixTaskQueue(workspacePath);
    taskQueues.set(workspacePath, queue);
  }
  return queue;
}

/**
 * Remove a task queue
 */
export function removeTaskQueue(workspacePath: string): void {
  taskQueues.delete(workspacePath);
}

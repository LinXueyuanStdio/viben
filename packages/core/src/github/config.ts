/**
 * GitHub Auto-Fix Configuration
 *
 * Configuration management for GitHub auto-fix feature:
 * - Global config: ~/.viben/github-config.yaml
 * - Workspace config: {workspace}/.viben/github-config.yaml
 * - Task state: {workspace}/.viben/github-tasks.json
 *
 * Priority: workspace > global > defaults
 */

import { join } from "node:path";
import { existsSync } from "node:fs";
import { readYaml, writeYaml, readJson, writeJson, ensureDir } from "../config/yaml";
import { getStateDir } from "../config/paths";

// ============================================================================
// Types
// ============================================================================

/**
 * Model configuration for GitHub analysis
 */
export interface GitHubModelConfig {
  /** Provider name (anthropic, openai, ollama) */
  provider: string;
  /** Model name */
  model: string;
  /** Environment variable for API key */
  api_key_env?: string;
}

/**
 * Model configurations for different tasks
 */
export interface GitHubModelsConfig {
  /** Model for issue analysis (deep analysis) */
  analysis?: string;
  /** Model for triage (fast categorization) */
  triage?: string;
  /** Model for code generation */
  code_gen?: string;
}

/**
 * Auto-fix configuration
 */
export interface AutoFixConfig {
  /** Whether auto-fix is enabled */
  enabled: boolean;
  /** Labels that trigger auto-fix */
  labels: string[];
  /** Whether human approval is required before creating PR */
  require_human_approval: boolean;
  /** Maximum parallel tasks */
  max_parallel_tasks: number;
  /** Base directory for worktrees (relative to workspace) */
  worktree_base_dir: string;
  /** Branch name prefix for auto-fix branches */
  branch_prefix: string;
}

/**
 * Batch processing configuration
 */
export interface BatchConfig {
  /** Maximum issues per cluster */
  max_cluster_size: number;
  /** Similarity threshold for clustering (0-1) */
  similarity_threshold: number;
}

/**
 * Full GitHub auto-fix configuration
 */
export interface GitHubAutoFixConfig {
  /** Primary model configuration */
  model?: GitHubModelConfig;
  /** Task-specific models */
  models?: GitHubModelsConfig;
  /** Auto-fix configuration */
  auto_fix?: AutoFixConfig;
  /** Batch processing configuration */
  batch?: BatchConfig;
}

/**
 * Auto-fix task status
 */
export type AutoFixTaskStatus =
  | "queued"
  | "analyzing"
  | "planning"
  | "executing"
  | "testing"
  | "awaiting_approval"
  | "creating_pr"
  | "completed"
  | "failed"
  | "cancelled";

/**
 * Auto-fix task state
 */
export interface AutoFixTask {
  /** Task ID */
  id: string;
  /** Workspace path */
  workspace_path: string;
  /** Issue numbers being fixed */
  issue_numbers: number[];
  /** Current status */
  status: AutoFixTaskStatus;
  /** Worktree path (if created) */
  worktree_path?: string;
  /** Branch name */
  branch_name?: string;
  /** PR number (if created) */
  pr_number?: number;
  /** Error message (if failed) */
  error?: string;
  /** Progress message */
  progress_message?: string;
  /** Progress percentage (0-100) */
  progress_percent?: number;
  /** Created timestamp */
  created_at: string;
  /** Updated timestamp */
  updated_at: string;
}

/**
 * Task state file structure
 */
export interface GitHubTaskState {
  /** Active tasks */
  tasks: AutoFixTask[];
  /** Last updated timestamp */
  updated_at: string;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: Required<GitHubAutoFixConfig> = {
  model: {
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    api_key_env: "ANTHROPIC_API_KEY",
  },
  models: {
    analysis: "claude-sonnet-4-20250514",
    triage: "claude-haiku-3-5-20241022",
    code_gen: "claude-sonnet-4-20250514",
  },
  auto_fix: {
    enabled: true,
    labels: ["auto-fix", "good-first-issue"],
    require_human_approval: true,
    max_parallel_tasks: 3,
    worktree_base_dir: ".viben-worktrees",
    branch_prefix: "autofix/issue-",
  },
  batch: {
    max_cluster_size: 5,
    similarity_threshold: 0.7,
  },
};

// ============================================================================
// Path Utilities
// ============================================================================

/**
 * Get global config path
 */
export function getGlobalConfigPath(): string {
  return join(getStateDir(), "github-config.yaml");
}

/**
 * Get workspace config path
 */
export function getWorkspaceConfigPath(workspacePath: string): string {
  return join(workspacePath, ".viben", "github-config.yaml");
}

/**
 * Get task state path for workspace
 */
export function getTaskStatePath(workspacePath: string): string {
  return join(workspacePath, ".viben", "github-tasks.json");
}

/**
 * Get worktree base directory
 */
export function getWorktreeBaseDir(workspacePath: string, config: GitHubAutoFixConfig): string {
  const baseDir = config.auto_fix?.worktree_base_dir ?? DEFAULT_CONFIG.auto_fix.worktree_base_dir;
  return join(workspacePath, baseDir);
}

// ============================================================================
// Configuration Loading
// ============================================================================

/**
 * Load GitHub auto-fix configuration
 * Merges workspace > global > defaults
 */
export async function loadGitHubConfig(workspacePath?: string): Promise<Required<GitHubAutoFixConfig>> {
  // Start with defaults
  let config: GitHubAutoFixConfig = { ...DEFAULT_CONFIG };

  // Load global config
  const globalPath = getGlobalConfigPath();
  if (existsSync(globalPath)) {
    const globalConfig = await readYaml<GitHubAutoFixConfig>(globalPath);
    if (globalConfig) {
      config = mergeConfig(config, globalConfig);
    }
  }

  // Load workspace config (if provided)
  if (workspacePath) {
    const workspacePath2 = getWorkspaceConfigPath(workspacePath);
    if (existsSync(workspacePath2)) {
      const workspaceConfig = await readYaml<GitHubAutoFixConfig>(workspacePath2);
      if (workspaceConfig) {
        config = mergeConfig(config, workspaceConfig);
      }
    }
  }

  // Ensure all fields have values
  return {
    model: config.model ?? DEFAULT_CONFIG.model,
    models: {
      ...DEFAULT_CONFIG.models,
      ...config.models,
    },
    auto_fix: {
      ...DEFAULT_CONFIG.auto_fix,
      ...config.auto_fix,
    },
    batch: {
      ...DEFAULT_CONFIG.batch,
      ...config.batch,
    },
  };
}

/**
 * Save GitHub auto-fix configuration
 */
export async function saveGitHubConfig(
  config: Partial<GitHubAutoFixConfig>,
  workspacePath?: string
): Promise<void> {
  const configPath = workspacePath
    ? getWorkspaceConfigPath(workspacePath)
    : getGlobalConfigPath();

  // Ensure directory exists
  await ensureDir(join(configPath, ".."));

  // Read existing config
  const existing = existsSync(configPath)
    ? await readYaml<GitHubAutoFixConfig>(configPath) ?? {}
    : {};

  // Merge and save
  const merged = mergeConfig(existing, config);
  await writeYaml(configPath, merged);
}

/**
 * Deep merge two configs
 */
function mergeConfig(
  base: GitHubAutoFixConfig,
  override: Partial<GitHubAutoFixConfig>
): GitHubAutoFixConfig {
  const result: GitHubAutoFixConfig = {
    model: override.model ?? base.model,
  };

  // Merge models
  if (base.models || override.models) {
    result.models = {
      ...base.models,
      ...override.models,
    };
  }

  // Merge auto_fix
  if (base.auto_fix || override.auto_fix) {
    result.auto_fix = {
      ...(base.auto_fix ?? {}),
      ...(override.auto_fix ?? {}),
    } as AutoFixConfig;
  }

  // Merge batch
  if (base.batch || override.batch) {
    result.batch = {
      ...(base.batch ?? {}),
      ...(override.batch ?? {}),
    } as BatchConfig;
  }

  return result;
}

// ============================================================================
// Task State Management
// ============================================================================

/**
 * Load task state for workspace
 */
export async function loadTaskState(workspacePath: string): Promise<GitHubTaskState> {
  const statePath = getTaskStatePath(workspacePath);

  if (!existsSync(statePath)) {
    return {
      tasks: [],
      updated_at: new Date().toISOString(),
    };
  }

  const state = await readJson<GitHubTaskState>(statePath);
  return state ?? {
    tasks: [],
    updated_at: new Date().toISOString(),
  };
}

/**
 * Save task state for workspace
 */
export async function saveTaskState(
  workspacePath: string,
  state: GitHubTaskState
): Promise<void> {
  const statePath = getTaskStatePath(workspacePath);

  // Ensure directory exists
  await ensureDir(join(statePath, ".."));

  state.updated_at = new Date().toISOString();
  await writeJson(statePath, state);
}

/**
 * Get a task by ID
 */
export async function getTask(
  workspacePath: string,
  taskId: string
): Promise<AutoFixTask | null> {
  const state = await loadTaskState(workspacePath);
  return state.tasks.find((t) => t.id === taskId) ?? null;
}

/**
 * Create or update a task
 */
export async function upsertTask(
  workspacePath: string,
  task: AutoFixTask
): Promise<void> {
  const state = await loadTaskState(workspacePath);

  const existingIndex = state.tasks.findIndex((t) => t.id === task.id);
  if (existingIndex >= 0) {
    state.tasks[existingIndex] = {
      ...task,
      updated_at: new Date().toISOString(),
    };
  } else {
    state.tasks.push({
      ...task,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  await saveTaskState(workspacePath, state);
}

/**
 * Update task status
 */
export async function updateTaskStatus(
  workspacePath: string,
  taskId: string,
  status: AutoFixTaskStatus,
  extra?: Partial<AutoFixTask>
): Promise<AutoFixTask | null> {
  const state = await loadTaskState(workspacePath);

  const task = state.tasks.find((t) => t.id === taskId);
  if (!task) {
    return null;
  }

  task.status = status;
  task.updated_at = new Date().toISOString();

  if (extra) {
    Object.assign(task, extra);
  }

  await saveTaskState(workspacePath, state);
  return task;
}

/**
 * Delete a task
 */
export async function deleteTask(
  workspacePath: string,
  taskId: string
): Promise<boolean> {
  const state = await loadTaskState(workspacePath);

  const index = state.tasks.findIndex((t) => t.id === taskId);
  if (index < 0) {
    return false;
  }

  state.tasks.splice(index, 1);
  await saveTaskState(workspacePath, state);
  return true;
}

/**
 * List tasks with optional filter
 */
export async function listTasks(
  workspacePath: string,
  filter?: {
    status?: AutoFixTaskStatus | AutoFixTaskStatus[];
    issueNumber?: number;
  }
): Promise<AutoFixTask[]> {
  const state = await loadTaskState(workspacePath);
  let tasks = state.tasks;

  if (filter?.status) {
    const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
    tasks = tasks.filter((t) => statuses.includes(t.status));
  }

  if (filter?.issueNumber) {
    tasks = tasks.filter((t) => t.issue_numbers.includes(filter.issueNumber!));
  }

  return tasks;
}

/**
 * Get active (non-completed) tasks count
 */
export async function getActiveTaskCount(workspacePath: string): Promise<number> {
  const completedStatuses: AutoFixTaskStatus[] = ["completed", "failed", "cancelled"];
  const state = await loadTaskState(workspacePath);
  return state.tasks.filter((t) => !completedStatuses.includes(t.status)).length;
}

/**
 * Check if an issue already has an active task
 */
export async function hasActiveTaskForIssue(
  workspacePath: string,
  issueNumber: number
): Promise<AutoFixTask | null> {
  const completedStatuses: AutoFixTaskStatus[] = ["completed", "failed", "cancelled"];
  const state = await loadTaskState(workspacePath);

  return state.tasks.find(
    (t) =>
      t.issue_numbers.includes(issueNumber) &&
      !completedStatuses.includes(t.status)
  ) ?? null;
}

/**
 * Clean up old completed tasks (older than 7 days)
 */
export async function cleanupOldTasks(
  workspacePath: string,
  maxAgeDays: number = 7
): Promise<number> {
  const state = await loadTaskState(workspacePath);
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;

  const completedStatuses: AutoFixTaskStatus[] = ["completed", "failed", "cancelled"];
  const originalCount = state.tasks.length;

  state.tasks = state.tasks.filter((t) => {
    // Keep non-completed tasks
    if (!completedStatuses.includes(t.status)) {
      return true;
    }

    // Keep recent completed tasks
    const updatedAt = new Date(t.updated_at).getTime();
    return updatedAt > cutoff;
  });

  if (state.tasks.length !== originalCount) {
    await saveTaskState(workspacePath, state);
  }

  return originalCount - state.tasks.length;
}

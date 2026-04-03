/**
 * Work Phase Runner
 *
 * Core logic for spawning the work agent. This module is the primary entry point for:
 * - `viben task work-phase` - runs in current repo or worktree (preferred)
 *
 * NOTE: `viben swarm start` is DEPRECATED. Use `viben task work-phase` instead.
 *       The work-phase command auto-creates worktree when task.json has `worktree=true` or `branch` set.
 *
 * The work agent will:
 *    1. Read task.json from the task directory
 *    2. Execute each action in next_action array in order
 *    3. Actions: implement, check, finish (create-pr handled by start agent)
 *
 * Log files are ALWAYS written to the task directory (task_dir), not the working directory.
 * This ensures logs are accessible from the main repo regardless of worktree usage.
 *
 * @example
 * ```typescript
 * import { runWorkPhase } from "@viben/core/task/phase/work";
 *
 * // Run in current repo - log written to task_dir/work.log.jsonl
 * const result = await runWorkPhase({
 *   repoRoot: "/path/to/repo",
 *   workingDir: "/path/to/repo",
 *   task_dir: "/path/to/repo/.viben/tasks/03-12-my-task",
 *   platform: "claude",
 * });
 * // Log file: /path/to/repo/.viben/tasks/03-12-my-task/work.log.jsonl
 *
 * // Run in worktree - log still written to task_dir in main repo
 * const result = await runWorkPhase({
 *   repoRoot: "/path/to/repo",
 *   workingDir: "/path/to/worktree",
 *   task_dir: "/path/to/repo/.viben/tasks/03-12-my-task",
 *   platform: "claude",
 *   logFileName: "agent.log.jsonl",
 * });
 * // Log file: /path/to/repo/.viben/tasks/03-12-my-task/agent.log.jsonl
 * ```
 */

import { spawn, type SpawnOptions, type ChildProcess } from "node:child_process";
import { existsSync, writeFileSync, openSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { randomUUID } from "node:crypto";

import {
  readTaskJson,
  writeTaskJson,
  createCLIAdapter,
  registryAddAgent,
  registryRemoveById,
  DIR_VIBEN,
  DIR_TASKS,
} from "../../cli/lib/viben-workspace";

// =============================================================================
// Types
// =============================================================================

/**
 * Options for running the work phase
 */
export interface WorkPhaseOptions {
  /** Repository root path (for registry and validation) */
  repoRoot: string;
  /** Working directory where agent runs (repo root or worktree) */
  workingDir: string;
  /** Task directory absolute path */
  task_dir: string;
  /** Platform to use (default: "claude") */
  platform?: string;
  /** Enable verbose output */
  verbose?: boolean;
  /** Detach the process (run in background) */
  detach?: boolean;
  /** Skip permission prompts (default: true) */
  skipPermissions?: boolean;
  /** Output in JSON format */
  jsonOutput?: boolean;
  /** Log file name, written to task directory (default: "work.log.jsonl") */
  logFileName?: string;
  /** Agent ID prefix (default: "work") */
  agentIdPrefix?: string;
  /** Custom agent ID (overrides prefix) */
  agentId?: string;
  /** Skip next_action validation */
  skipNextActionValidation?: boolean;
}

/**
 * Result of running the work phase
 */
export interface WorkPhaseResult {
  /** Whether the phase started successfully */
  success: boolean;
  /** Agent ID for tracking */
  agentId?: string;
  /** Process ID of the spawned agent */
  pid?: number;
  /** Session ID for resume support */
  sessionId?: string;
  /** Path to the log file */
  logFile?: string;
  /** Working directory where agent runs */
  workingDir?: string;
  /** Error message if failed */
  error?: string;
}

/**
 * Task data structure
 */
interface TaskData {
  id?: string;
  name?: string;
  status?: string;
  session_id?: string;
  next_action?: Array<{ phase: number; action: string }>;
  [key: string]: unknown;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extract session ID from log content (for platforms that don't support session ID on create)
 */
function extractSessionIdFromLog(logContent: string): string | null {
  // Look for session ID patterns in the log
  const lines = logContent.split("\n");
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const data = JSON.parse(line);
      // Look for session_id field in various places
      if (data.session_id) {
        return data.session_id;
      }
      if (data.session?.id) {
        return data.session.id;
      }
    } catch {
      // Not JSON, continue
    }
  }
  return null;
}

// =============================================================================
// Main Function
// =============================================================================

/**
 * Run the work phase for a task
 *
 * This is the core work agent spawning logic used by `viben task work-phase`.
 *
 * - When task.json has NO worktree flag: workingDir = repoRoot
 * - When task.json has worktree=true or branch: workingDir = worktreePath (auto-created)
 *
 * NOTE: `viben swarm start` is DEPRECATED. Use `viben task work-phase` instead.
 *
 * @param options - Work phase options
 * @returns WorkPhaseResult with success status and details
 */
export async function runWorkPhase(
  options: WorkPhaseOptions
): Promise<WorkPhaseResult> {
  const {
    repoRoot,
    workingDir,
    task_dir: taskDir,
    platform = "claude",
    verbose = true,
    detach = false,
    skipPermissions = true,
    jsonOutput = true,
    logFileName = "work.log.jsonl",
    agentIdPrefix = "work",
    agentId: customAgentId,
    skipNextActionValidation = false,
  } = options;

  // Initialize CLI adapter
  const adapter = createCLIAdapter(platform);

  // taskDir must be absolute path
  const taskDirAbs = taskDir;
  // Calculate relative path from repoRoot for registry (not from workingDir!)
  // This ensures task_dir in registry always points to main repo's task directory
  const taskDirRelativeToRepo = relative(repoRoot, taskDir);

  // =============================================================================
  // Validation
  // =============================================================================

  // 1. Check task.json exists
  const taskJsonPath = join(taskDirAbs, "task.json");
  if (!existsSync(taskJsonPath)) {
    return {
      success: false,
      error: `task.json not found at ${taskJsonPath}`,
    };
  }

  // 2. Read task.json
  const taskData = readTaskJson(taskDirAbs) as TaskData | null;
  if (!taskData) {
    return {
      success: false,
      error: "Failed to read task.json",
    };
  }

  // 3. Check work agent exists
  const workMd = adapter.getAgentConfigPath("work", repoRoot);
  if (!existsSync(workMd)) {
    return {
      success: false,
      error: `work agent not found at ${workMd}. Platform: ${platform}`,
    };
  }

  // 4. Check next_action exists (unless skipped for worktree usage)
  if (!skipNextActionValidation) {
    if (!taskData.next_action || taskData.next_action.length === 0) {
      return {
        success: false,
        error: "task.json must have next_action array with at least one action",
      };
    }
  }

  // =============================================================================
  // Prepare and Start Agent
  // =============================================================================

  // Update task status
  taskData.status = "in_progress";
  writeTaskJson(taskDirAbs, taskData as Record<string, unknown>);

  // Log file location: write to task directory (in main repo, not worktree)
  // This ensures logs are always in the task directory regardless of worktree usage
  const logFile = join(taskDirAbs, logFileName);

  // Create empty log file
  writeFileSync(logFile, "", "utf-8");

  // Generate session ID for resume support (Claude Code only)
  let sessionId: string | null = null;
  if (adapter.supportsSessionIdOnCreate) {
    sessionId = randomUUID().toLowerCase();
    taskData.session_id = sessionId;
    writeTaskJson(taskDirAbs, taskData as Record<string, unknown>);
  }

  // Get proxy environment variables
  const httpsProxy = process.env.https_proxy || "";
  const httpProxy = process.env.http_proxy || "";
  const allProxy = process.env.all_proxy || "";

  // Build environment
  const env: Record<string, string> = { ...process.env } as Record<string, string>;
  env.https_proxy = httpsProxy;
  env.http_proxy = httpProxy;
  env.all_proxy = allProxy;

  // Set non-interactive env var based on platform
  Object.assign(env, adapter.getNonInteractiveEnv());

  // Build CLI command using adapter
  // Note: Use absolute path in prompt so agent can access task files regardless of working directory
  const cliCmd = adapter.buildRunCommand({
    agent: "work",
    prompt: `task_dir: ${taskDirAbs}

Follow your agent instructions to execute the task workflow. Read task.json from the task directory, then execute each action in next_action array in order.`,
    session_id: adapter.supportsSessionIdOnCreate ? sessionId || undefined : undefined,
    skipPermissions,
    verbose,
    jsonOutput,
  });

  // Open log file for writing
  const logFd = openSync(logFile, "w");

  // Spawn process in workingDir (could be repo root or worktree)
  const spawnOpts: SpawnOptions = {
    cwd: workingDir,
    env,
    stdio: ["ignore", logFd, logFd],
  };

  if (detach) {
    spawnOpts.detached = true;
  }

  // Generate agent ID early (needed for cleanup handler)
  const taskName = taskData.name || taskData.id || "unknown";
  const agentId = customAgentId || `${agentIdPrefix}-${taskName}`;

  let child: ChildProcess;
  try {
    child = spawn(cliCmd[0], cliCmd.slice(1), spawnOpts);
  } catch (error) {
    return {
      success: false,
      error: `Failed to spawn work agent: ${error}`,
    };
  }

  const agentPid = child.pid || 0;

  // =============================================================================
  // Register to Registry (always in main repo)
  // =============================================================================

  registryAddAgent(
    {
      agentId,
      worktreePath: workingDir,
      pid: agentPid,
      task_dir: taskDir, // Store absolute path (taskDir is already absolute)
      platform,
    },
    repoRoot
  );

  // =============================================================================
  // Handle detached vs blocking mode
  // =============================================================================

  if (detach) {
    // Detached mode: setup cleanup handler and return immediately
    child.on("exit", () => {
      registryRemoveById(agentId, repoRoot);
    });
    child.unref();

    // For platforms that don't support session ID on create, extract from logs
    if (!adapter.supportsSessionIdOnCreate) {
      // Wait a bit for the log to have session ID
      for (let i = 0; i < 10; i++) {
        await sleep(500);
        try {
          const logContent = readFileSync(logFile, "utf-8");
          const extractedSessionId = extractSessionIdFromLog(logContent);
          if (extractedSessionId) {
            sessionId = extractedSessionId;
            // Store in task.json
            taskData.session_id = sessionId;
            writeTaskJson(taskDirAbs, taskData as Record<string, unknown>);
            break;
          }
        } catch {
          // Continue trying
        }
      }
    }

    return {
      success: true,
      agentId,
      pid: agentPid,
      sessionId: sessionId || undefined,
      logFile,
      workingDir,
    };
  }

  // =============================================================================
  // Blocking mode: wait for process to complete
  // =============================================================================

  // For platforms that don't support session ID on create, extract from logs in parallel
  if (!adapter.supportsSessionIdOnCreate) {
    // Start background extraction (non-blocking)
    const extractionPromise = (async () => {
      for (let i = 0; i < 10; i++) {
        await sleep(500);
        try {
          const logContent = readFileSync(logFile, "utf-8");
          const extractedSessionId = extractSessionIdFromLog(logContent);
          if (extractedSessionId) {
            sessionId = extractedSessionId;
            taskData.session_id = sessionId;
            writeTaskJson(taskDirAbs, taskData as Record<string, unknown>);
            return;
          }
        } catch {
          // Continue trying
        }
      }
    })();

    // Don't await here, let it run in parallel with process
    extractionPromise.catch(() => {});
  }

  // Wait for process to complete
  const exitCode = await new Promise<number>((resolve) => {
    child.on("exit", (code) => {
      resolve(code ?? 0);
    });
    child.on("error", () => {
      resolve(1);
    });
  });

  // Cleanup registry after process exits
  registryRemoveById(agentId, repoRoot);

  return {
    success: exitCode === 0,
    agentId,
    pid: agentPid,
    sessionId: sessionId || undefined,
    logFile,
    workingDir,
    error: exitCode !== 0 ? `Process exited with code ${exitCode}` : undefined,
  };
}


/**
 * Work Phase Runner
 *
 * Core logic for spawning the dispatch agent. This module is reused by:
 * - `viben task work-phase` - runs in current repo
 * - `viben swarm start` - runs in worktree
 *
 * The dispatch agent will:
 *    1. Read task.json from the task directory
 *    2. Execute each action in next_action array in order
 *    3. Actions typically include: implement, check, finish, create-pr
 *
 * @example
 * ```typescript
 * import { runWorkPhase } from "@viben/core/task/phase/work";
 *
 * // Run in current repo
 * const result = await runWorkPhase({
 *   repoRoot: "/path/to/repo",
 *   workingDir: "/path/to/repo",
 *   taskDir: ".viben/tasks/03-12-my-task",
 *   platform: "claude",
 * });
 *
 * // Run in worktree (called by swarm start)
 * const result = await runWorkPhase({
 *   repoRoot: "/path/to/repo",
 *   workingDir: "/path/to/worktree",
 *   taskDir: ".viben/tasks/03-12-my-task",
 *   platform: "claude",
 *   logFileName: ".agent-log",
 * });
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
  taskDir: string;
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
  /** Log file name (default: ".work-log") */
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
 * This is the core dispatch agent spawning logic, reused by:
 * - `viben task work-phase` (workingDir = repoRoot)
 * - `viben swarm start` (workingDir = worktreePath)
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
    taskDir,
    platform = "claude",
    verbose = true,
    detach = true,
    skipPermissions = true,
    jsonOutput = true,
    logFileName = ".work-log",
    agentIdPrefix = "work",
    agentId: customAgentId,
    skipNextActionValidation = false,
  } = options;

  // Initialize CLI adapter
  const adapter = createCLIAdapter(platform);

  // taskDir must be absolute path
  const taskDirAbs = taskDir;
  // Calculate relative path from workingDir for the agent prompt
  const taskDirRelative = relative(workingDir, taskDir);

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

  // 3. Check dispatch agent exists
  const dispatchMd = adapter.getAgentConfigPath("dispatch", repoRoot);
  if (!existsSync(dispatchMd)) {
    return {
      success: false,
      error: `dispatch agent not found at ${dispatchMd}. Platform: ${platform}`,
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

  // Log file location depends on workingDir
  const logFile = join(workingDir, logFileName);

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
  const cliCmd = adapter.buildRunCommand({
    agent: "dispatch",
    prompt: `task_dir: ${taskDirRelative}

Follow your agent instructions to execute the task workflow. Read task.json from the task directory, then execute each action in next_action array in order.`,
    sessionId: adapter.supportsSessionIdOnCreate ? sessionId || undefined : undefined,
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

  let child: ChildProcess;
  try {
    child = spawn(cliCmd[0], cliCmd.slice(1), spawnOpts);
  } catch (error) {
    return {
      success: false,
      error: `Failed to spawn dispatch agent: ${error}`,
    };
  }

  if (detach) {
    child.unref();
  }

  const agentPid = child.pid || 0;

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

  // =============================================================================
  // Register to Registry (always in main repo)
  // =============================================================================

  // Generate agent ID
  const taskName = taskData.name || taskData.id || "unknown";
  const agentId = customAgentId || `${agentIdPrefix}-${taskName}`;

  registryAddAgent(
    {
      agentId,
      worktreePath: workingDir,
      pid: agentPid,
      taskDir: taskDirRelative,
      platform,
    },
    repoRoot
  );

  // =============================================================================
  // Return Result
  // =============================================================================

  return {
    success: true,
    agentId,
    pid: agentPid,
    sessionId: sessionId || undefined,
    logFile,
    workingDir,
  };
}


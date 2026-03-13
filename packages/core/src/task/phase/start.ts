/**
 * Start Phase Module
 *
 * Provides unified entry point for starting task execution.
 * Uses /viben:start workflow which handles both serial and parallel modes.
 *
 * The workflow:
 * 1. Read workflow.md for context
 * 2. Run plan-phase (research + configure + write PRD)
 * 3. Run work-phase (auto-creates worktree if needed)
 * 4. Report status
 *
 * @example
 * ```typescript
 * import { startTask } from "@viben/core/task/phase/start";
 *
 * const result = await startTask(repoRoot, taskDir, { platform: "claude" });
 * ```
 */

import { spawn, type SpawnOptions, type ChildProcess } from "node:child_process";
import { existsSync, writeFileSync, openSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
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
 * Options for starting a task
 */
export interface StartTaskOptions {
  /** Platform to use (default: "claude") */
  platform?: string;
  /** Enable verbose output (default: false) */
  verbose?: boolean;
  /** Detach the process (run in background, default: true) */
  detach?: boolean;
  /** Skip permission prompts (default: true) */
  skipPermissions?: boolean;
}

/**
 * Result of starting a task
 */
export interface StartTaskResult {
  /** Whether the task started successfully */
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
  title?: string;
  description?: string;
  status?: string;
  dev_type?: string;
  session_id?: string;
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
 * Extract session ID from log content
 */
function extractSessionIdFromLog(logContent: string): string | null {
  const lines = logContent.split("\n");
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const data = JSON.parse(line);
      if (data.session_id) return data.session_id;
      if (data.session?.id) return data.session.id;
    } catch {
      // Not JSON, continue
    }
  }
  return null;
}

/**
 * Resolve task directory to absolute path
 */
function resolveTaskDir(repoRoot: string, taskDir: string): string {
  if (taskDir.startsWith("/")) {
    return taskDir;
  } else if (taskDir.startsWith(DIR_VIBEN) || taskDir.includes("/")) {
    return join(repoRoot, taskDir);
  } else {
    // Task name only - look in tasks directory
    return join(repoRoot, DIR_VIBEN, DIR_TASKS, taskDir);
  }
}

/**
 * Options for building a prompt-only command (no agent)
 */
interface PromptCommandOptions {
  prompt: string;
  sessionId?: string;
  skipPermissions?: boolean;
  verbose?: boolean;
  jsonOutput?: boolean;
}

/**
 * Build CLI command for running with just a prompt (no agent specified)
 *
 * This sends the prompt to Claude as a normal session, not to a specific agent.
 */
function buildPromptCommand(
  adapter: ReturnType<typeof createCLIAdapter>,
  options: PromptCommandOptions
): string[] {
  const {
    prompt,
    sessionId,
    skipPermissions = true,
    verbose = true,
    jsonOutput = true,
  } = options;

  // Build command based on platform
  switch (adapter.platform) {
    case "opencode": {
      const cmd = ["opencode", "run"];
      if (jsonOutput) {
        cmd.push("--format", "json");
      }
      if (verbose) {
        cmd.push("--log-level", "DEBUG", "--print-logs");
      }
      cmd.push(prompt);
      return cmd;
    }

    case "codex":
      return ["codex", "exec", prompt];

    case "kiro":
      return ["kiro", "run", prompt];

    case "gemini":
      return ["gemini", prompt];

    default: {
      // claude
      const cmd = ["claude", "-p"];

      if (sessionId) {
        cmd.push("--session-id", sessionId);
      }

      if (skipPermissions) {
        cmd.push("--dangerously-skip-permissions");
      }

      if (jsonOutput) {
        cmd.push("--output-format", "stream-json");
        // stream-json requires --verbose
        cmd.push("--verbose");
      } else if (verbose) {
        cmd.push("--verbose");
      }

      cmd.push(prompt);
      return cmd;
    }
  }
}

// =============================================================================
// Main Entry Point
// =============================================================================

/**
 * Start a task execution
 *
 * Spawns an agent with the /viben:start workflow which:
 * 1. Reads workflow.md for context
 * 2. Runs plan-phase (research + configure + write PRD)
 * 3. Runs work-phase (auto-creates worktree if task.json has worktree=true or branch set)
 * 4. Reports status
 *
 * @param repoRoot - Repository root path (absolute)
 * @param taskDir - Task directory path (relative or absolute)
 * @param options - Start options
 * @returns StartTaskResult
 *
 * @example
 * ```typescript
 * import { startTask } from "@viben/core/task/phase/start";
 *
 * const result = await startTask("/path/to/repo", "03-12-my-task");
 *
 * if (result.success) {
 *   console.log(`Task started`);
 *   console.log(`Agent ID: ${result.agentId}`);
 *   console.log(`Log file: ${result.logFile}`);
 * } else {
 *   console.error(`Failed: ${result.error}`);
 * }
 * ```
 */
export async function startTask(
  repoRoot: string,
  taskDir: string,
  options: StartTaskOptions = {}
): Promise<StartTaskResult> {
  const {
    platform = "claude",
    verbose = false,
    detach = true,
    skipPermissions = true,
  } = options;

  // Resolve task directory to absolute path
  const taskDirAbs = resolveTaskDir(repoRoot, taskDir);
  const adapter = createCLIAdapter(platform);
  const taskDirRel = relative(repoRoot, taskDirAbs);

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  // Check task.json exists
  const taskJsonPath = join(taskDirAbs, "task.json");
  if (!existsSync(taskJsonPath)) {
    return {
      success: false,
      error: `task.json not found at ${taskJsonPath}`,
    };
  }

  // Read task.json
  const taskData = readTaskJson(taskDirAbs) as TaskData | null;
  if (!taskData) {
    return {
      success: false,
      error: "Failed to read task.json",
    };
  }

  // Check start command exists
  const startMd = adapter.getCommandsPath(repoRoot, "viben", "start.md");
  if (!existsSync(startMd)) {
    return {
      success: false,
      error: `Start command not found at ${startMd}. Platform: ${platform}`,
    };
  }

  // ---------------------------------------------------------------------------
  // Prepare and Start Agent
  // ---------------------------------------------------------------------------

  // Update task status
  taskData.status = "in_progress";
  writeTaskJson(taskDirAbs, taskData as Record<string, unknown>);

  // Log file
  const logFile = join(taskDirAbs, ".start-log");
  writeFileSync(logFile, "", "utf-8");

  // Generate session ID for resume support
  let sessionId: string | null = null;
  if (adapter.supportsSessionIdOnCreate) {
    sessionId = randomUUID().toLowerCase();
    taskData.session_id = sessionId;
    writeTaskJson(taskDirAbs, taskData as Record<string, unknown>);
  }

  // Build environment
  const env: Record<string, string> = { ...process.env } as Record<string, string>;
  Object.assign(env, adapter.getNonInteractiveEnv());

  // Build CLI command - read /viben:start command content and send as prompt
  const taskName = taskData.name || taskData.id || "unknown";

  // Read the start command content
  const startCommandContent = readFileSync(startMd, "utf-8");

  // Send the start command content directly as prompt with task context
  const prompt = `${startCommandContent}

---
Current task context:
- Task directory: ${taskDirRel}
- Task name: ${taskName}`;

  // Build CLI command without specifying agent (runs as normal session)
  const cliCmd = buildPromptCommand(adapter, {
    prompt,
    sessionId: adapter.supportsSessionIdOnCreate ? sessionId || undefined : undefined,
    skipPermissions,
    verbose,
    jsonOutput: true,
  });

  // Open log file for writing
  const logFd = openSync(logFile, "w");

  // Spawn process
  const spawnOpts: SpawnOptions = {
    cwd: repoRoot,
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
      error: `Failed to spawn agent: ${error}`,
    };
  }

  if (detach) {
    child.unref();
  }

  const agentPid = child.pid || 0;

  // Extract session ID from logs if needed
  if (!adapter.supportsSessionIdOnCreate) {
    for (let i = 0; i < 10; i++) {
      await sleep(500);
      try {
        const logContent = readFileSync(logFile, "utf-8");
        const extractedSessionId = extractSessionIdFromLog(logContent);
        if (extractedSessionId) {
          sessionId = extractedSessionId;
          taskData.session_id = sessionId;
          writeTaskJson(taskDirAbs, taskData as Record<string, unknown>);
          break;
        }
      } catch {
        // Continue trying
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Register to Registry
  // ---------------------------------------------------------------------------

  const agentId = `start-${taskName}`;

  registryAddAgent(
    {
      agentId,
      worktreePath: repoRoot,
      pid: agentPid,
      taskDir: taskDirRel,
      platform,
    },
    repoRoot
  );

  // ---------------------------------------------------------------------------
  // Return Result
  // ---------------------------------------------------------------------------

  if (verbose) {
    console.log(`[start] Task: ${taskName}`);
    console.log(`[start] Agent ID: ${agentId}`);
    console.log(`[start] PID: ${agentPid}`);
    console.log(`[start] Log: ${logFile}`);
  }

  return {
    success: true,
    agentId,
    pid: agentPid,
    sessionId: sessionId || undefined,
    logFile,
    workingDir: repoRoot,
  };
}

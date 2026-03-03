/**
 * Multi-Agent Pipeline: Start Worktree Agent
 *
 * TypeScript implementation of packages/core/templates/viben/scripts/multi_agent/start.py
 *
 * This module:
 * 1. Creates worktree (if not exists) with dependency install
 * 2. Copies environment files (from worktree.yaml config)
 * 3. Sets .current-task in worktree
 * 4. Starts claude agent in background
 * 5. Registers agent to registry.json
 *
 * Prerequisites:
 *    - task.json must exist with 'branch' field
 *    - prd.md must exist (plan completed)
 *    - agents/dispatch.md must exist (in .claude/, .cursor/, .iflow/, or .opencode/)
 *
 * Configuration: .viben/worktree.yaml
 */

import { spawn, execSync, type SpawnOptions, type ChildProcess } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  rmSync,
  cpSync,
  openSync,
} from "node:fs";
import { join, resolve, relative, dirname } from "node:path";
import { randomUUID } from "node:crypto";

import {
  DIR_VIBEN,
  FILE_CURRENT_TASK,
  FILE_TASK_JSON,
  readTaskJson,
  writeTaskJson,
  runGitCommand,
  getWorktreeConfig,
  getWorktreeBaseDir,
  parseSimpleYaml,
  registryAddAgent,
  getCLIAdapter,
  type Platform,
} from "../viben-workspace";

// =============================================================================
// Types
// =============================================================================

/**
 * Options for starting an agent
 */
export interface StartOptions {
  /** Platform to use (default: claude) */
  platform?: Platform;
  /** Run in detached mode (default: true) */
  detach?: boolean;
  /** Skip permission prompts (default: true) */
  skipPermissions?: boolean;
  /** Enable verbose output (default: true) */
  verbose?: boolean;
  /** Output JSON format (default: true) */
  jsonOutput?: boolean;
}

/**
 * Result of starting an agent
 */
export interface StartResult {
  /** Whether the operation was successful */
  success: boolean;
  /** Agent ID (task ID) */
  agentId?: string;
  /** Process ID */
  pid?: number;
  /** Session ID for resuming */
  sessionId?: string;
  /** Path to the worktree */
  worktreePath?: string;
  /** Path to the log file */
  logFile?: string;
  /** Error message if failed */
  error?: string;
}

/**
 * Task data structure
 */
interface TaskData {
  id?: string;
  name?: string;
  branch?: string;
  status?: string;
  base_branch?: string;
  worktree_path?: string;
  [key: string]: unknown;
}

// =============================================================================
// Worktree Configuration Helpers
// =============================================================================

/**
 * Get list of files to copy from worktree.yaml
 */
function getWorktreeCopyFiles(repoRoot: string): string[] {
  const configPath = getWorktreeConfig(repoRoot);
  if (!existsSync(configPath)) {
    return [];
  }

  try {
    const content = readFileSync(configPath, "utf-8");
    const config = parseSimpleYaml(content);
    const copyFiles = config.copy;
    if (Array.isArray(copyFiles)) {
      return copyFiles.filter((f): f is string => typeof f === "string");
    }
  } catch {
    // Ignore errors
  }

  return [];
}

/**
 * Get post_create hooks from worktree.yaml
 */
function getWorktreePostCreateHooks(repoRoot: string): string[] {
  const configPath = getWorktreeConfig(repoRoot);
  if (!existsSync(configPath)) {
    return [];
  }

  try {
    const content = readFileSync(configPath, "utf-8");
    const config = parseSimpleYaml(content);
    const hooks = config.post_create;
    if (Array.isArray(hooks)) {
      return hooks.filter((h): h is string => typeof h === "string");
    }
  } catch {
    // Ignore errors
  }

  return [];
}

/**
 * Extract session ID from OpenCode logs
 */
function extractSessionIdFromLog(logContent: string): string | null {
  // OpenCode format: look for session ID in JSON logs
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

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =============================================================================
// Main Function
// =============================================================================

/**
 * Start an agent for a task in a worktree
 *
 * @param repoRoot - Repository root path
 * @param taskDir - Task directory path (relative or absolute)
 * @param options - Start options
 * @returns StartResult with success status and details
 */
export async function startAgent(
  repoRoot: string,
  taskDir: string,
  options: StartOptions = {}
): Promise<StartResult> {
  const {
    platform = "claude",
    detach = true,
    skipPermissions = true,
    verbose = true,
    jsonOutput = true,
  } = options;

  // Initialize CLI adapter
  const adapter = getCLIAdapter(platform);

  // Normalize paths
  let taskDirRelative: string;
  let taskDirAbs: string;

  if (taskDir.startsWith("/")) {
    taskDirAbs = taskDir;
    taskDirRelative = relative(repoRoot, taskDir);
  } else {
    taskDirRelative = taskDir;
    taskDirAbs = resolve(repoRoot, taskDir);
  }

  const taskJsonPath = join(taskDirAbs, FILE_TASK_JSON);

  // =============================================================================
  // Validation
  // =============================================================================

  // Check task.json exists
  if (!existsSync(taskJsonPath)) {
    return {
      success: false,
      error: `task.json not found at ${taskJsonPath}`,
    };
  }

  // Check dispatch agent exists
  const dispatchMd = adapter.getAgentPath("dispatch", repoRoot);
  if (!existsSync(dispatchMd)) {
    return {
      success: false,
      error: `dispatch.md not found at ${dispatchMd}. Platform: ${platform}`,
    };
  }

  // Check worktree.yaml exists
  const configFile = getWorktreeConfig(repoRoot);
  if (!existsSync(configFile)) {
    return {
      success: false,
      error: `worktree.yaml not found at ${configFile}`,
    };
  }

  // =============================================================================
  // Read Task Config
  // =============================================================================

  const taskData = readTaskJson(taskDirAbs) as TaskData | null;
  if (!taskData) {
    return {
      success: false,
      error: "Failed to read task.json",
    };
  }

  const branch = taskData.branch;
  const taskName = taskData.name;
  const taskStatus = taskData.status;
  let worktreePath = taskData.worktree_path;

  // Check if task was rejected
  if (taskStatus === "rejected") {
    const rejectedFile = join(taskDirAbs, "REJECTED.md");
    let reason = "";
    if (existsSync(rejectedFile)) {
      reason = readFileSync(rejectedFile, "utf-8");
    }
    return {
      success: false,
      error: `Task was rejected by Plan Agent. ${reason ? `Reason: ${reason}` : "Check REJECTED.md for details."}`,
    };
  }

  // Check if prd.md exists (plan completed successfully)
  const prdFile = join(taskDirAbs, "prd.md");
  if (!existsSync(prdFile)) {
    return {
      success: false,
      error: `prd.md not found - Plan Agent may not have completed. Check ${join(taskDirAbs, ".plan-log")} for details.`,
    };
  }

  // Check branch field
  if (!branch) {
    return {
      success: false,
      error: `branch field not set in task.json. Please set it first, e.g.: jq '.branch = "task/my-task"' task.json > tmp && mv tmp task.json`,
    };
  }

  // =============================================================================
  // Step 1: Create Worktree (if not exists)
  // =============================================================================

  if (!worktreePath || !existsSync(worktreePath)) {
    // Record current branch as base_branch (PR target)
    const { stdout: baseBranchOut } = runGitCommand(
      ["branch", "--show-current"],
      repoRoot
    );
    const baseBranch = baseBranchOut.trim() || "main";

    // Calculate worktree path
    let worktreeBaseDir = getWorktreeBaseDir(repoRoot);
    if (!existsSync(worktreeBaseDir)) {
      mkdirSync(worktreeBaseDir, { recursive: true });
    }
    worktreeBaseDir = resolve(worktreeBaseDir);

    const worktreePathObj = join(worktreeBaseDir, branch);
    worktreePath = worktreePathObj;

    // Create parent directory
    const parentDir = dirname(worktreePathObj);
    if (!existsSync(parentDir)) {
      mkdirSync(parentDir, { recursive: true });
    }

    // Check if branch exists
    const { code: refCode } = runGitCommand(
      ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`],
      repoRoot
    );

    let gitResult: { code: number; stderr: string };
    if (refCode === 0) {
      // Branch exists, check it out
      gitResult = runGitCommand(
        ["worktree", "add", worktreePath, branch],
        repoRoot
      );
    } else {
      // Create new branch
      gitResult = runGitCommand(
        ["worktree", "add", "-b", branch, worktreePath],
        repoRoot
      );
    }

    if (gitResult.code !== 0) {
      return {
        success: false,
        error: `Failed to create worktree: ${gitResult.stderr}`,
      };
    }

    // Update task.json with worktree_path and base_branch
    taskData.worktree_path = worktreePath;
    taskData.base_branch = baseBranch;
    writeTaskJson(taskDirAbs, taskData as Record<string, unknown>);

    // ----- Copy environment files -----
    const copyList = getWorktreeCopyFiles(repoRoot);
    for (const item of copyList) {
      if (!item) continue;

      const source = join(repoRoot, item);
      const target = join(worktreePath, item);

      if (existsSync(source)) {
        const targetDir = dirname(target);
        if (!existsSync(targetDir)) {
          mkdirSync(targetDir, { recursive: true });
        }
        copyFileSync(source, target);
      }
    }

    // ----- Copy task directory (may not be committed yet) -----
    const taskTargetDir = join(worktreePath, taskDirRelative);
    const taskTargetParent = dirname(taskTargetDir);
    if (!existsSync(taskTargetParent)) {
      mkdirSync(taskTargetParent, { recursive: true });
    }
    if (existsSync(taskTargetDir)) {
      rmSync(taskTargetDir, { recursive: true, force: true });
    }
    cpSync(taskDirAbs, taskTargetDir, { recursive: true });

    // ----- Run post_create hooks -----
    const postCreateHooks = getWorktreePostCreateHooks(repoRoot);
    for (const cmd of postCreateHooks) {
      if (!cmd) continue;

      try {
        execSync(cmd, {
          cwd: worktreePath,
          stdio: "inherit",
          shell: "/bin/sh",
        });
      } catch (error) {
        return {
          success: false,
          error: `Post-create hook failed: ${cmd}. Error: ${error}`,
        };
      }
    }
  }

  // =============================================================================
  // Step 2: Set .current-task in Worktree
  // =============================================================================

  const worktreeWorkflowDir = join(worktreePath, DIR_VIBEN);
  if (!existsSync(worktreeWorkflowDir)) {
    mkdirSync(worktreeWorkflowDir, { recursive: true });
  }

  const currentTaskFile = join(worktreeWorkflowDir, FILE_CURRENT_TASK);
  writeFileSync(currentTaskFile, taskDirRelative, "utf-8");

  // =============================================================================
  // Step 3: Prepare and Start Agent
  // =============================================================================

  // Update task status
  taskData.status = "in_progress";
  writeTaskJson(taskDirAbs, taskData as Record<string, unknown>);

  const logFile = join(worktreePath, ".agent-log");
  const sessionIdFile = join(worktreePath, ".session-id");

  // Create empty log file
  writeFileSync(logFile, "", "utf-8");

  // Generate session ID for resume support (Claude Code only)
  let sessionId: string | null = null;
  if (adapter.supportsSessionIdOnCreate) {
    sessionId = randomUUID().toLowerCase();
    writeFileSync(sessionIdFile, sessionId, "utf-8");
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
    prompt:
      "Follow your agent instructions to execute the task workflow. Start by reading .viben/.current-task to get the task directory, then execute each action in task.json next_action array in order.",
    sessionId: adapter.supportsSessionIdOnCreate ? sessionId || undefined : undefined,
    skipPermissions,
    verbose,
    jsonOutput,
  });

  // Open log file for writing
  const logFd = openSync(logFile, "w");

  // Spawn process
  const spawnOpts: SpawnOptions = {
    cwd: worktreePath,
    env,
    stdio: ["ignore", logFd, logFd],
  };

  if (detach) {
    spawnOpts.detached = true;
  }

  // Platform-specific spawn options
  if (process.platform === "win32") {
    // Windows: CREATE_NEW_PROCESS_GROUP
    // Note: Node.js doesn't expose creationflags directly, but detached achieves similar effect
  } else {
    // Unix: start_new_session equivalent is handled by detached
  }

  let child: ChildProcess;
  try {
    child = spawn(cliCmd[0], cliCmd.slice(1), spawnOpts);
  } catch (error) {
    return {
      success: false,
      error: `Failed to spawn agent process: ${error}`,
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
          writeFileSync(sessionIdFile, sessionId, "utf-8");
          break;
        }
      } catch {
        // Continue trying
      }
    }
  }

  // =============================================================================
  // Step 4: Register to Registry (in main repo, not worktree)
  // =============================================================================

  // Generate agent ID
  let taskId = taskData.id;
  if (!taskId) {
    taskId = branch.replace(/\//g, "-");
  }

  registryAddAgent(
    {
      agentId: taskId,
      worktreePath: worktreePath,
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
    agentId: taskId,
    pid: agentPid,
    sessionId: sessionId || undefined,
    worktreePath,
    logFile,
  };
}

/**
 * Start agent synchronously (for CLI commands)
 *
 * @param repoRoot - Repository root path
 * @param taskDir - Task directory path
 * @param options - Start options
 * @returns StartResult
 */
export function startAgentSync(
  repoRoot: string,
  taskDir: string,
  options: StartOptions = {}
): StartResult {
  // For synchronous usage, we can't wait for session ID extraction
  // Just run the async function without waiting for session extraction
  const {
    platform = "claude",
    detach = true,
    skipPermissions = true,
    verbose = true,
    jsonOutput = true,
  } = options;

  const adapter = getCLIAdapter(platform);

  // Normalize paths
  let taskDirRelative: string;
  let taskDirAbs: string;

  if (taskDir.startsWith("/")) {
    taskDirAbs = taskDir;
    taskDirRelative = relative(repoRoot, taskDir);
  } else {
    taskDirRelative = taskDir;
    taskDirAbs = resolve(repoRoot, taskDir);
  }

  const taskJsonPath = join(taskDirAbs, FILE_TASK_JSON);

  // Validation
  if (!existsSync(taskJsonPath)) {
    return {
      success: false,
      error: `task.json not found at ${taskJsonPath}`,
    };
  }

  const dispatchMd = adapter.getAgentPath("dispatch", repoRoot);
  if (!existsSync(dispatchMd)) {
    return {
      success: false,
      error: `dispatch.md not found at ${dispatchMd}. Platform: ${platform}`,
    };
  }

  const configFile = getWorktreeConfig(repoRoot);
  if (!existsSync(configFile)) {
    return {
      success: false,
      error: `worktree.yaml not found at ${configFile}`,
    };
  }

  const taskData = readTaskJson(taskDirAbs) as TaskData | null;
  if (!taskData) {
    return {
      success: false,
      error: "Failed to read task.json",
    };
  }

  const branch = taskData.branch;
  const taskStatus = taskData.status;
  let worktreePath = taskData.worktree_path;

  if (taskStatus === "rejected") {
    return {
      success: false,
      error: "Task was rejected by Plan Agent",
    };
  }

  const prdFile = join(taskDirAbs, "prd.md");
  if (!existsSync(prdFile)) {
    return {
      success: false,
      error: "prd.md not found - Plan Agent may not have completed",
    };
  }

  if (!branch) {
    return {
      success: false,
      error: "branch field not set in task.json",
    };
  }

  // Create worktree if needed
  if (!worktreePath || !existsSync(worktreePath)) {
    const { stdout: baseBranchOut } = runGitCommand(
      ["branch", "--show-current"],
      repoRoot
    );
    const baseBranch = baseBranchOut.trim() || "main";

    let worktreeBaseDir = getWorktreeBaseDir(repoRoot);
    if (!existsSync(worktreeBaseDir)) {
      mkdirSync(worktreeBaseDir, { recursive: true });
    }
    worktreeBaseDir = resolve(worktreeBaseDir);

    worktreePath = join(worktreeBaseDir, branch);

    const parentDir = dirname(worktreePath);
    if (!existsSync(parentDir)) {
      mkdirSync(parentDir, { recursive: true });
    }

    const { code: refCode } = runGitCommand(
      ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`],
      repoRoot
    );

    let gitResult: { code: number; stderr: string };
    if (refCode === 0) {
      gitResult = runGitCommand(
        ["worktree", "add", worktreePath, branch],
        repoRoot
      );
    } else {
      gitResult = runGitCommand(
        ["worktree", "add", "-b", branch, worktreePath],
        repoRoot
      );
    }

    if (gitResult.code !== 0) {
      return {
        success: false,
        error: `Failed to create worktree: ${gitResult.stderr}`,
      };
    }

    taskData.worktree_path = worktreePath;
    taskData.base_branch = baseBranch;
    writeTaskJson(taskDirAbs, taskData as Record<string, unknown>);

    // Copy environment files
    const copyList = getWorktreeCopyFiles(repoRoot);
    for (const item of copyList) {
      if (!item) continue;
      const source = join(repoRoot, item);
      const target = join(worktreePath, item);
      if (existsSync(source)) {
        const targetDir = dirname(target);
        if (!existsSync(targetDir)) {
          mkdirSync(targetDir, { recursive: true });
        }
        copyFileSync(source, target);
      }
    }

    // Copy task directory
    const taskTargetDir = join(worktreePath, taskDirRelative);
    const taskTargetParent = dirname(taskTargetDir);
    if (!existsSync(taskTargetParent)) {
      mkdirSync(taskTargetParent, { recursive: true });
    }
    if (existsSync(taskTargetDir)) {
      rmSync(taskTargetDir, { recursive: true, force: true });
    }
    cpSync(taskDirAbs, taskTargetDir, { recursive: true });

    // Run post_create hooks
    const postCreateHooks = getWorktreePostCreateHooks(repoRoot);
    for (const cmd of postCreateHooks) {
      if (!cmd) continue;
      try {
        execSync(cmd, {
          cwd: worktreePath,
          stdio: "inherit",
          shell: "/bin/sh",
        });
      } catch (error) {
        return {
          success: false,
          error: `Post-create hook failed: ${cmd}`,
        };
      }
    }
  }

  // Set current task
  const worktreeWorkflowDir = join(worktreePath, DIR_VIBEN);
  if (!existsSync(worktreeWorkflowDir)) {
    mkdirSync(worktreeWorkflowDir, { recursive: true });
  }
  const currentTaskFile = join(worktreeWorkflowDir, FILE_CURRENT_TASK);
  writeFileSync(currentTaskFile, taskDirRelative, "utf-8");

  // Update task status
  taskData.status = "in_progress";
  writeTaskJson(taskDirAbs, taskData as Record<string, unknown>);

  const logFile = join(worktreePath, ".agent-log");
  const sessionIdFile = join(worktreePath, ".session-id");

  writeFileSync(logFile, "", "utf-8");

  let sessionId: string | null = null;
  if (adapter.supportsSessionIdOnCreate) {
    sessionId = randomUUID().toLowerCase();
    writeFileSync(sessionIdFile, sessionId, "utf-8");
  }

  const env: Record<string, string> = { ...process.env } as Record<string, string>;
  env.https_proxy = process.env.https_proxy || "";
  env.http_proxy = process.env.http_proxy || "";
  env.all_proxy = process.env.all_proxy || "";
  Object.assign(env, adapter.getNonInteractiveEnv());

  const cliCmd = adapter.buildRunCommand({
    agent: "dispatch",
    prompt:
      "Follow your agent instructions to execute the task workflow. Start by reading .viben/.current-task to get the task directory, then execute each action in task.json next_action array in order.",
    sessionId: adapter.supportsSessionIdOnCreate ? sessionId || undefined : undefined,
    skipPermissions,
    verbose,
    jsonOutput,
  });

  const logFd = openSync(logFile, "w");

  const spawnOpts: SpawnOptions = {
    cwd: worktreePath,
    env,
    stdio: ["ignore", logFd, logFd],
    detached: detach,
  };

  let child: ChildProcess;
  try {
    child = spawn(cliCmd[0], cliCmd.slice(1), spawnOpts);
  } catch (error) {
    return {
      success: false,
      error: `Failed to spawn agent process: ${error}`,
    };
  }

  if (detach) {
    child.unref();
  }

  const agentPid = child.pid || 0;

  let taskId = taskData.id;
  if (!taskId) {
    taskId = branch.replace(/\//g, "-");
  }

  registryAddAgent(
    {
      agentId: taskId,
      worktreePath: worktreePath,
      pid: agentPid,
      taskDir: taskDirRelative,
      platform,
    },
    repoRoot
  );

  return {
    success: true,
    agentId: taskId,
    pid: agentPid,
    sessionId: sessionId || undefined,
    worktreePath,
    logFile,
  };
}

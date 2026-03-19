/**
 * Wait utilities for multi-agent pipeline.
 *
 * Provides functions for waiting until agents complete, with timeout handling.
 * Used in FileRL flows to synchronize parallel task execution.
 */
import { join } from "node:path";
import { execFileSync } from "node:child_process";

import { readTaskJson, resolveTaskDirectory } from "../viben-workspace";
import { isProcessRunning } from "./status";
import { readRegistry } from "./registry";
import type { AgentEntry } from "./registry";

// =============================================================================
// Types
// =============================================================================

/**
 * Options for waiting on agents
 */
export interface WaitOptions {
  /** Polling interval in seconds (default: 10) */
  pollingIntervalSeconds: number;
  /** Timeout per task in seconds (default: 300) */
  timeoutSeconds: number;
  /** Global timeout in seconds, 0 = no global timeout (default: 0) */
  globalTimeoutSeconds?: number;
  /** Show verbose output with status table each poll */
  verbose: boolean;
  /** Quiet mode - minimal output */
  quiet: boolean;
  /** Current process PID to exclude from waiting (prevents deadlock) */
  excludePid?: number;
}

/**
 * Result of a single task wait
 */
export interface TaskWaitResult {
  /** Task name */
  task: string;
  /** Final status */
  status: "completed" | "failed" | "timeout" | "exited";
  /** Time elapsed in seconds */
  elapsedSeconds: number;
  /** Optional reason for the status */
  reason?: string;
}

/**
 * Overall wait result
 */
export interface WaitResult {
  /** Tasks that completed successfully */
  completed: string[];
  /** Tasks that failed */
  failed: string[];
  /** Tasks that timed out */
  timeout: string[];
  /** Detailed results for each task */
  results: TaskWaitResult[];
}

/**
 * Internal tracking state for a waiting task
 */
interface WaitingTask {
  task: string;
  taskDir: string;
  agent: AgentEntry;
  startTime: number;
  done: boolean;
  result?: TaskWaitResult;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get task status from task.json
 */
function getTaskStatus(taskDir: string): string | null {
  const taskData = readTaskJson(taskDir);
  if (!taskData) {
    return null;
  }
  return (taskData.status as string) || null;
}

/**
 * Check if a task has completed (in a terminal state)
 */
function isTaskCompleted(status: string | null): boolean {
  if (!status) return false;
  return ["completed", "failed", "cancelled", "archived"].includes(status);
}

/**
 * Format seconds to human readable (e.g., "5m 30s")
 */
function formatSeconds(seconds: number): string {
  if (seconds < 60) {
    return `${Math.floor(seconds)}s`;
  } else if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  }
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Call viben task reject to handle timeout
 *
 * Note: rejectTask only works on "review" status tasks.
 * For tasks in other states (like in_progress), we'll just mark them as timeout
 * and stop the process.
 *
 * @returns Object with kill and reject status for verbose logging
 */
function handleTimeout(
  repoRoot: string,
  task: string,
  pid: number,
  verbose: boolean = false
): { killed: boolean; rejected: boolean; rejectError?: string } {
  const result = { killed: false, rejected: false, rejectError: undefined as string | undefined };

  // Try to stop the agent process first
  if (isProcessRunning(pid)) {
    try {
      process.kill(pid, "SIGTERM");
      result.killed = true;
    } catch (e) {
      if (verbose) {
        result.rejectError = `Failed to kill process ${pid}: ${e}`;
      }
    }
  }

  // Try to call reject, but this may fail if task is not in review status
  // That's ok - the important thing is we've stopped the process
  try {
    execFileSync("viben", ["task", "reject", task, "--reason", "Timeout in swarm wait"], {
      cwd: repoRoot,
      stdio: "pipe",
      encoding: "utf-8",
    });
    result.rejected = true;
  } catch (e) {
    // Ignore errors - reject only works on review status
    // The timeout will still be recorded in the result
    if (verbose) {
      result.rejectError = `Task reject failed (expected if not in review status): ${e}`;
    }
  }

  return result;
}

// =============================================================================
// Main Wait Function
// =============================================================================

/**
 * Find agent by task name with precise matching
 *
 * Matching priority:
 * 1. Exact ID match
 * 2. Exact task directory name match (basename)
 * 3. Task directory contains the search term
 *
 * @param taskName - Task name to search for
 * @param agents - List of agents to search
 * @returns Matching agent or undefined
 */
function findAgentByTask(taskName: string, agents: AgentEntry[]): AgentEntry | undefined {
  // 1. Exact ID match (highest priority)
  const exactId = agents.find((a) => a.id === taskName);
  if (exactId) return exactId;

  // 2. Exact task directory name match
  const exactDir = agents.find((a) => {
    const dirName = a.task_dir.split("/").pop() || "";
    return dirName === taskName;
  });
  if (exactDir) return exactDir;

  // 3. Task directory contains the search term (lowest priority)
  return agents.find((a) => a.task_dir.includes(taskName));
}

/**
 * Wait for agents to complete
 *
 * @param repoRoot - Repository root path
 * @param tasks - Array of task names to wait for (empty = wait for all running agents)
 * @param options - Wait options
 * @returns WaitResult with completion status
 */
export async function waitForAgents(
  repoRoot: string,
  tasks: string[],
  options: WaitOptions
): Promise<WaitResult> {
  const registry = readRegistry(repoRoot);
  const currentPid = options.excludePid ?? process.pid;

  // Build list of tasks to wait for, excluding self to prevent deadlock
  let agentsToWait: AgentEntry[] = [];

  if (tasks.length === 0) {
    // Wait for all running agents (excluding self)
    agentsToWait = registry.agents.filter(
      (a) => isProcessRunning(a.pid) && a.pid !== currentPid
    );
  } else {
    // Wait for specific tasks
    for (const taskName of tasks) {
      // Find agent by task name or ID with precise matching
      const agent = findAgentByTask(taskName, registry.agents);
      if (agent) {
        // Skip self to prevent deadlock
        if (agent.pid === currentPid) {
          if (!options.quiet) {
            console.log(`⚠️  Skipping self (${taskName}): waiting for own process would cause deadlock`);
          }
          continue;
        }
        agentsToWait.push(agent);
      }
    }
  }

  // Initialize result
  const result: WaitResult = {
    completed: [],
    failed: [],
    timeout: [],
    results: [],
  };

  // No agents to wait for
  if (agentsToWait.length === 0) {
    return result;
  }

  // Initialize waiting tasks
  const waitingTasks: WaitingTask[] = agentsToWait.map((agent) => {
    const taskDir = resolveTaskDirectory(agent.task_dir, repoRoot) ||
                    join(repoRoot, agent.task_dir);
    return {
      task: agent.id,
      taskDir,
      agent,
      startTime: Date.now(),
      done: false,
    };
  });

  const totalTasks = waitingTasks.length;
  let completedCount = 0;
  const globalStartTime = Date.now();
  const globalTimeoutSeconds = options.globalTimeoutSeconds || 0;

  // Polling loop
  while (waitingTasks.some((t) => !t.done)) {
    const globalElapsed = Math.floor((Date.now() - globalStartTime) / 1000);

    // Check global timeout first
    if (globalTimeoutSeconds > 0 && globalElapsed >= globalTimeoutSeconds) {
      // Mark all remaining tasks as timeout
      for (const wt of waitingTasks) {
        if (wt.done) continue;
        const taskElapsed = Math.floor((Date.now() - wt.startTime) / 1000);
        wt.done = true;
        wt.result = {
          task: wt.task,
          status: "timeout",
          elapsedSeconds: taskElapsed,
          reason: `Global timeout exceeded (${globalTimeoutSeconds}s)`,
        };
        result.timeout.push(wt.task);
        completedCount++;
        const timeoutResult = handleTimeout(repoRoot, wt.task, wt.agent.pid, options.verbose);
        if (!options.quiet) {
          console.log(`  [GLOBAL TIMEOUT] ${wt.task} (${formatSeconds(taskElapsed)})`);
        }
        if (options.verbose && timeoutResult.rejectError) {
          console.log(`    ${timeoutResult.rejectError}`);
        }
      }
      break;
    }

    // Check each waiting task
    for (const wt of waitingTasks) {
      if (wt.done) continue;

      const taskElapsed = Math.floor((Date.now() - wt.startTime) / 1000);
      const processRunning = isProcessRunning(wt.agent.pid);
      const taskStatus = getTaskStatus(wt.taskDir);

      // Check for per-task timeout first
      if (taskElapsed >= options.timeoutSeconds) {
        wt.done = true;
        wt.result = {
          task: wt.task,
          status: "timeout",
          elapsedSeconds: taskElapsed,
          reason: `Exceeded ${options.timeoutSeconds}s timeout`,
        };
        result.timeout.push(wt.task);
        completedCount++;

        // Handle timeout (stop process, attempt reject)
        const timeoutResult = handleTimeout(repoRoot, wt.task, wt.agent.pid, options.verbose);

        if (!options.quiet) {
          console.log(`  [TIMEOUT] ${wt.task} (${formatSeconds(taskElapsed)})`);
        }
        if (options.verbose && timeoutResult.rejectError) {
          console.log(`    ${timeoutResult.rejectError}`);
        }
        continue;
      }

      // Check if process has exited
      if (!processRunning) {
        wt.done = true;

        // Determine final status based on task.json status
        if (isTaskCompleted(taskStatus)) {
          if (taskStatus === "completed") {
            wt.result = {
              task: wt.task,
              status: "completed",
              elapsedSeconds: taskElapsed,
            };
            result.completed.push(wt.task);
          } else if (taskStatus === "failed") {
            wt.result = {
              task: wt.task,
              status: "failed",
              elapsedSeconds: taskElapsed,
            };
            result.failed.push(wt.task);
          } else {
            // Other terminal states (cancelled)
            wt.result = {
              task: wt.task,
              status: "exited",
              elapsedSeconds: taskElapsed,
              reason: `Task in ${taskStatus} status`,
            };
            result.completed.push(wt.task); // Treat as completed
          }
        } else {
          // Process exited but task not in terminal state - abnormal exit
          wt.result = {
            task: wt.task,
            status: "exited",
            elapsedSeconds: taskElapsed,
            reason: `Process exited with task status: ${taskStatus || "unknown"}`,
          };
          result.failed.push(wt.task);
        }
        completedCount++;

        if (!options.quiet) {
          const statusIcon = wt.result.status === "completed" ? "\u2713" :
                            wt.result.status === "failed" ? "\u2717" : "?";
          console.log(`  [${statusIcon}] ${wt.task} ${wt.result.status} (${formatSeconds(taskElapsed)})`);
        }
        continue;
      }

      // Process is still running, but check if task is already in terminal state
      // This can happen if agent finished but process is still cleaning up
      if (isTaskCompleted(taskStatus)) {
        wt.done = true;
        if (taskStatus === "completed") {
          wt.result = {
            task: wt.task,
            status: "completed",
            elapsedSeconds: taskElapsed,
            reason: "Task completed while process still running",
          };
          result.completed.push(wt.task);
        } else if (taskStatus === "failed") {
          wt.result = {
            task: wt.task,
            status: "failed",
            elapsedSeconds: taskElapsed,
            reason: "Task failed while process still running",
          };
          result.failed.push(wt.task);
        } else {
          wt.result = {
            task: wt.task,
            status: "exited",
            elapsedSeconds: taskElapsed,
            reason: `Task in ${taskStatus} status`,
          };
          result.completed.push(wt.task);
        }
        completedCount++;

        if (!options.quiet) {
          const statusIcon = wt.result.status === "completed" ? "\u2713" :
                            wt.result.status === "failed" ? "\u2717" : "?";
          console.log(`  [${statusIcon}] ${wt.task} ${wt.result.status} (${formatSeconds(taskElapsed)})`);
        }
        continue;
      }

      // Task still running and not in terminal state - continue waiting
    }

    // Progress output (if not quiet)
    if (!options.quiet && waitingTasks.some((t) => !t.done)) {
      process.stdout.write(`\rWaiting for ${totalTasks} agents... [${formatSeconds(globalElapsed)}] ${completedCount}/${totalTasks} completed`);
    }

    // Verbose output - show status table
    if (options.verbose && waitingTasks.some((t) => !t.done)) {
      console.log();
      console.log(`=== Polling [${formatSeconds(globalElapsed)}] ===`);
      console.log("Task".padEnd(20) + "PID".padEnd(10) + "Status".padEnd(10) + "Elapsed".padEnd(10) + "State");
      console.log("-".repeat(60));

      for (const wt of waitingTasks) {
        const taskElapsed = Math.floor((Date.now() - wt.startTime) / 1000);
        const processRunning = isProcessRunning(wt.agent.pid);
        const statusStr = processRunning ? "running" : "exited";
        const stateStr = wt.done ? wt.result?.status : "waiting";

        console.log(
          wt.task.slice(0, 18).padEnd(20) +
          String(wt.agent.pid).padEnd(10) +
          statusStr.padEnd(10) +
          formatSeconds(taskElapsed).padEnd(10) +
          stateStr
        );
      }
      console.log();
    }

    // Sleep before next poll
    if (waitingTasks.some((t) => !t.done)) {
      await sleep(options.pollingIntervalSeconds * 1000);
    }
  }

  // Clear the progress line
  if (!options.quiet) {
    process.stdout.write("\r" + " ".repeat(80) + "\r");
  }

  // Collect all results
  result.results = waitingTasks
    .filter((wt) => wt.result)
    .map((wt) => wt.result!);

  return result;
}

/**
 * Get all running agents from registry
 */
export function getRunningAgents(repoRoot: string): AgentEntry[] {
  const registry = readRegistry(repoRoot);
  return registry.agents.filter((a) => isProcessRunning(a.pid));
}

/**
 * Format wait result for display
 */
export function formatWaitResult(result: WaitResult): string {
  const lines: string[] = [];

  lines.push("=== Wait Complete ===");

  for (const r of result.results) {
    const icon = r.status === "completed" ? "\u2713" :
                 r.status === "failed" ? "\u2717" :
                 r.status === "timeout" ? "\u2717" : "?";
    const statusPad = r.status.padEnd(10);
    lines.push(`  [${icon}] ${r.task.padEnd(15)} ${statusPad} (${formatSeconds(r.elapsedSeconds)})`);
  }

  lines.push("");
  lines.push(`Summary: ${result.completed.length} completed, ${result.failed.length} failed, ${result.timeout.length} timeout`);

  return lines.join("\n");
}

/**
 * Task stuck detection operations
 *
 * Check if a task is stuck based on:
 * 1. Event timestamp - no events for threshold duration
 * 2. Process status - agent process not running
 * 3. Log activity - no recent log entries
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  readTaskJson,
  resolveTaskDirectory,
  registrySearchAgent,
  isProcessRunning,
  calcElapsed,
} from "../../cli/lib/viben-workspace";

import type { UnifiedTask, TaskStatus } from "./types";

// =============================================================================
// Constants
// =============================================================================

/** Default stuck threshold: 2 minutes */
const DEFAULT_STUCK_THRESHOLD_MS = 2 * 60 * 1000;

/** Active task statuses that can be considered stuck */
const ACTIVE_STATUSES: TaskStatus[] = ["in_progress", "queue"];

// =============================================================================
// Types
// =============================================================================

/**
 * Stuck detection result for a single check
 */
export interface StuckCheckDetail {
  /** Check name */
  name: string;
  /** Whether this check indicates stuck */
  isStuck: boolean;
  /** Reason or explanation */
  reason: string;
  /** Additional data */
  data?: Record<string, unknown>;
}

/**
 * Overall stuck check result
 */
export interface CheckStuckResult {
  success: boolean;
  /** Task directory name */
  taskDir?: string;
  /** Task data */
  task?: UnifiedTask;
  /** Whether task is considered stuck */
  isStuck: boolean;
  /** Summary reason */
  summary: string;
  /** Individual check results */
  checks: StuckCheckDetail[];
  /** Error message if check failed */
  error?: string;
}

/**
 * Options for stuck check
 */
export interface CheckStuckOptions {
  /** Stuck threshold in milliseconds (default: 2 minutes) */
  thresholdMs?: number;
  /** Include detailed log analysis */
  verbose?: boolean;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if a task status is active (can be stuck)
 */
function isActiveStatus(status: TaskStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

/**
 * Get the last event timestamp from task
 */
function getLastEventTime(task: UnifiedTask): number | null {
  // Check lastEvent first
  if (task.last_event?.timestamp) {
    return new Date(task.last_event.timestamp).getTime();
  }

  // Fall back to updatedAt
  if (task.updated_at) {
    return new Date(task.updated_at).getTime();
  }

  return null;
}

/**
 * Get last modification time of agent log file
 */
function getLogLastModifiedTime(worktreePath: string): number | null {
  const logFile = join(worktreePath, "agent.log.jsonl");
  if (!existsSync(logFile)) {
    return null;
  }

  try {
    const stats = statSync(logFile);
    return stats.mtimeMs;
  } catch {
    return null;
  }
}

/**
 * Parse last N lines from JSONL log file
 */
function getRecentLogEntries(
  worktreePath: string,
  maxLines: number = 10
): Array<{ type: string; timestamp?: string }> {
  const logFile = join(worktreePath, "agent.log.jsonl");
  if (!existsSync(logFile)) {
    return [];
  }

  try {
    const content = readFileSync(logFile, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim());
    const recentLines = lines.slice(-maxLines);

    return recentLines.map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return { type: "unknown" };
      }
    });
  } catch {
    return [];
  }
}

// =============================================================================
// Main Check Function
// =============================================================================

/**
 * Check if a task is stuck
 *
 * Performs multiple checks:
 * 1. Status check - is task in an active state?
 * 2. Event check - has there been recent activity based on lastEvent?
 * 3. Process check - is the agent process running?
 * 4. Log check - is there recent log activity?
 *
 * @param repoRoot - Repository root path
 * @param taskName - Task name or directory
 * @param options - Check options
 * @returns Check result with detailed breakdown
 */
export function checkStuck(
  repoRoot: string,
  taskName: string,
  options: CheckStuckOptions = {}
): CheckStuckResult {
  const thresholdMs = options.thresholdMs ?? DEFAULT_STUCK_THRESHOLD_MS;
  const checks: StuckCheckDetail[] = [];
  const now = Date.now();

  // Resolve task directory
  const taskDirPath = resolveTaskDirectory(taskName, repoRoot);
  if (!taskDirPath) {
    return {
      success: false,
      isStuck: false,
      summary: "Task not found",
      checks: [],
      error: `Task not found: ${taskName}`,
    };
  }

  // Read task data
  const task = readTaskJson(taskDirPath) as UnifiedTask | null;
  if (!task) {
    return {
      success: false,
      isStuck: false,
      summary: "Failed to read task.json",
      checks: [],
      error: "Failed to read task.json",
    };
  }

  const taskDir = taskDirPath.split("/").pop() || taskName;

  // ==========================================================================
  // Check 1: Status Check
  // ==========================================================================
  const statusCheck: StuckCheckDetail = {
    name: "status",
    isStuck: false,
    reason: "",
    data: { status: task.status },
  };

  if (!isActiveStatus(task.status)) {
    statusCheck.reason = `Task status is '${task.status}' (not active)`;
    checks.push(statusCheck);

    return {
      success: true,
      taskDir,
      task,
      isStuck: false,
      summary: `Task is not in an active state (${task.status})`,
      checks,
    };
  }

  statusCheck.reason = `Task is in active state: ${task.status}`;
  checks.push(statusCheck);

  // ==========================================================================
  // Check 2: Event Timestamp Check
  // ==========================================================================
  const eventCheck: StuckCheckDetail = {
    name: "event_timestamp",
    isStuck: false,
    reason: "",
    data: {},
  };

  const lastEventTime = getLastEventTime(task);
  if (lastEventTime) {
    const elapsed = now - lastEventTime;
    const elapsedStr = formatDuration(elapsed);
    eventCheck.data = {
      lastEventTime: new Date(lastEventTime).toISOString(),
      elapsedMs: elapsed,
      elapsedStr,
      thresholdMs,
    };

    if (elapsed > thresholdMs) {
      eventCheck.isStuck = true;
      eventCheck.reason = `No events for ${elapsedStr} (threshold: ${formatDuration(thresholdMs)})`;
    } else {
      eventCheck.reason = `Last event ${elapsedStr} ago (within threshold)`;
    }
  } else if (task.status === "queue" && task.queued_at) {
    // For queue status, check queuedAt if no event timestamp
    const queuedTime = new Date(task.queued_at).getTime();
    const elapsed = now - queuedTime;
    const elapsedStr = formatDuration(elapsed);
    eventCheck.data = {
      queuedAt: task.queued_at,
      elapsedMs: elapsed,
      elapsedStr,
      thresholdMs,
    };

    if (elapsed > thresholdMs) {
      eventCheck.isStuck = true;
      eventCheck.reason = `Queued for ${elapsedStr} without starting (threshold: ${formatDuration(thresholdMs)})`;
    } else {
      eventCheck.reason = `Queued ${elapsedStr} ago (within threshold)`;
    }
  } else {
    eventCheck.reason = "No event timestamp available";
    eventCheck.data = { lastEventTime: null };
  }
  checks.push(eventCheck);

  // ==========================================================================
  // Check 3: Process Check
  // ==========================================================================
  const processCheck: StuckCheckDetail = {
    name: "process",
    isStuck: false,
    reason: "",
    data: {},
  };

  const agent = registrySearchAgent(taskDir, repoRoot);
  if (agent) {
    const pid = agent.pid;
    const running = isProcessRunning(pid);
    processCheck.data = {
      pid,
      running,
      worktreePath: agent.worktree_path,
      startedAt: agent.started_at,
    };

    if (running) {
      const elapsed = calcElapsed(agent.started_at);
      processCheck.reason = `Agent process running (PID: ${pid}, elapsed: ${elapsed})`;
    } else {
      processCheck.isStuck = true;
      processCheck.reason = `Agent process not running (PID: ${pid})`;
    }
  } else {
    processCheck.reason = "No agent registered for this task";
    processCheck.data = { registered: false };
  }
  checks.push(processCheck);

  // ==========================================================================
  // Check 4: Log Activity Check
  // ==========================================================================
  const logCheck: StuckCheckDetail = {
    name: "log_activity",
    isStuck: false,
    reason: "",
    data: {},
  };

  const worktreePath = agent?.worktree_path || task.worktree_path;
  if (worktreePath && existsSync(worktreePath)) {
    const logModTime = getLogLastModifiedTime(worktreePath);

    if (logModTime) {
      const elapsed = now - logModTime;
      const elapsedStr = formatDuration(elapsed);
      logCheck.data = {
        lastModified: new Date(logModTime).toISOString(),
        elapsedMs: elapsed,
        elapsedStr,
      };

      if (elapsed > thresholdMs) {
        logCheck.isStuck = true;
        logCheck.reason = `Log file not modified for ${elapsedStr}`;
      } else {
        logCheck.reason = `Log file modified ${elapsedStr} ago`;
      }

      // Add recent log entries if verbose
      if (options.verbose) {
        const recentEntries = getRecentLogEntries(worktreePath, 5);
        logCheck.data.recentEntries = recentEntries.map((e) => e.type);
      }
    } else {
      logCheck.reason = "No log file found";
      logCheck.data = { logFile: null };
    }
  } else {
    logCheck.reason = "No worktree path available";
    logCheck.data = { worktreePath: null };
  }
  checks.push(logCheck);

  // ==========================================================================
  // Determine Overall Stuck Status
  // ==========================================================================
  // Task is considered stuck if:
  // - For in_progress: process is not running, OR (event timeout AND log inactive)
  // - For queue: event timeout (queued too long without starting)
  let isStuck: boolean;

  if (task.status === "queue") {
    // Queue tasks are stuck if they've been waiting too long
    isStuck = eventCheck.isStuck;
  } else {
    // in_progress tasks need process or activity check
    isStuck = processCheck.isStuck || (eventCheck.isStuck && logCheck.isStuck);
  }

  let summary: string;
  if (isStuck) {
    const reasons: string[] = [];
    if (processCheck.isStuck) reasons.push("process not running");
    if (eventCheck.isStuck) {
      if (task.status === "queue") {
        reasons.push("queued too long");
      } else {
        reasons.push("no recent events");
      }
    }
    if (logCheck.isStuck) reasons.push("no log activity");
    summary = `Task appears stuck: ${reasons.join(", ")}`;
  } else {
    summary = "Task is running normally";
  }

  return {
    success: true,
    taskDir,
    task,
    isStuck,
    summary,
    checks,
  };
}

// =============================================================================
// Helper: Format Duration
// =============================================================================

/**
 * Format milliseconds as human-readable duration
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }

  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

/**
 * Worker Manager
 *
 * Spawns and manages detached worker processes.
 * Each command runs in its own fully detached process.
 */

import { spawn, type SpawnOptions } from "node:child_process";
import { openSync, closeSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { QueueItem, RunningItem, CompletedItem } from "../ops/types";
import {
  createLogFile,
  writeRunningItem,
  deleteRunningItem,
  appendCompletedItem,
  getLogPath,
} from "./persistence";

/**
 * Spawn result
 */
export interface SpawnResult {
  success: boolean;
  pid?: number;
  logFile?: string;
  error?: string;
}

/**
 * Check if a process is running by PID
 */
export function isProcessRunning(pid: number): boolean {
  try {
    // Sending signal 0 doesn't kill the process, just checks if it exists
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Spawn a detached worker process for a queue item
 *
 * The process:
 * 1. Runs completely detached from the parent
 * 2. Writes stdout/stderr to a log file
 * 3. Parent doesn't wait for completion
 *
 * @param item - Queue item to execute
 * @returns SpawnResult with PID and log file path
 */
export function spawnWorker(item: QueueItem): SpawnResult {
  try {
    // Create log file
    const logFile = createLogFile(item.id);

    // Open log file for writing
    const logFd = openSync(logFile, "a");

    // Build spawn options for fully detached process
    const spawnOptions: SpawnOptions = {
      cwd: item.cwd,
      detached: true,
      stdio: ["ignore", logFd, logFd],
      env: {
        ...process.env,
        VIBEN_QUEUE_ITEM_ID: item.id,
      },
    };

    // Parse command into shell execution
    // Use shell to handle complex commands
    const child = spawn("sh", ["-c", item.command], spawnOptions);

    // Check if spawn was successful
    if (!child.pid) {
      closeSync(logFd);
      return {
        success: false,
        error: "Failed to spawn process - no PID returned",
      };
    }

    const pid = child.pid;

    // Unref to allow parent to exit
    child.unref();

    // Close log file descriptor in parent
    // The child has its own copy
    closeSync(logFd);

    // Create running item
    const runningItem: RunningItem = {
      ...item,
      pid,
      started_at: Date.now(),
      log_file: logFile,
    };

    // Write running item to persistence
    writeRunningItem(runningItem);

    return {
      success: true,
      pid,
      logFile,
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return { success: false, error };
  }
}

/**
 * Spawn wrapper script path
 * This script wraps the command and writes completion status
 */
function getWrapperScriptPath(): string {
  return join(process.cwd(), ".viben-queue-wrapper.sh");
}

/**
 * Spawn a detached worker with completion callback support
 *
 * This version spawns a wrapper script that:
 * 1. Executes the command
 * 2. Writes exit code to a status file when done
 * 3. The Monitor can then detect completion
 *
 * @param item - Queue item to execute
 * @returns SpawnResult with PID and log file path
 */
export function spawnWorkerWithCallback(item: QueueItem): SpawnResult {
  try {
    // Create log file
    const logFile = createLogFile(item.id);
    const statusFile = getLogPath(item.id).replace(".log", ".status");

    // Build the wrapper command that writes exit status
    // The wrapper script will:
    // 1. Execute the command
    // 2. Capture exit code
    // 3. Write exit code to status file
    const wrapperCommand = `
set -e
cd "${item.cwd}"
${item.command}
EXIT_CODE=$?
echo $EXIT_CODE > "${statusFile}"
exit $EXIT_CODE
`;

    // Open log file for writing
    const logFd = openSync(logFile, "a");

    // Build spawn options for fully detached process
    const spawnOptions: SpawnOptions = {
      cwd: item.cwd,
      detached: true,
      stdio: ["ignore", logFd, logFd],
      env: {
        ...process.env,
        VIBEN_QUEUE_ITEM_ID: item.id,
        VIBEN_QUEUE_STATUS_FILE: statusFile,
      },
    };

    // Spawn using shell
    const child = spawn("sh", ["-c", wrapperCommand], spawnOptions);

    // Check if spawn was successful
    if (!child.pid) {
      closeSync(logFd);
      return {
        success: false,
        error: "Failed to spawn process - no PID returned",
      };
    }

    const pid = child.pid;

    // Unref to allow parent to exit
    child.unref();

    // Close log file descriptor in parent
    closeSync(logFd);

    // Create running item with status file in metadata
    const runningItem: RunningItem = {
      ...item,
      pid,
      started_at: Date.now(),
      log_file: logFile,
      metadata: {
        ...item.metadata,
        status_file: statusFile,
      },
    };

    // Write running item to persistence
    writeRunningItem(runningItem);

    return {
      success: true,
      pid,
      logFile,
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return { success: false, error };
  }
}

/**
 * Kill a running process
 *
 * @param pid - Process ID to kill
 * @param force - Use SIGKILL instead of SIGTERM
 * @returns True if signal was sent successfully
 */
export function killProcess(pid: number, force = false): boolean {
  try {
    const signal = force ? "SIGKILL" : "SIGTERM";
    process.kill(pid, signal);
    return true;
  } catch {
    return false;
  }
}

/**
 * Mark a running item as completed
 *
 * @param id - Queue item ID
 * @param exitCode - Process exit code
 * @returns The completed item, or null if not found
 */
export function markCompleted(id: string, exitCode: number): CompletedItem | null {
  // Import running item
  const { readRunningItem } = require("./persistence");
  const runningItem = readRunningItem(id) as RunningItem | null;

  if (!runningItem) {
    return null;
  }

  // Create completed item
  const completedItem: CompletedItem = {
    ...runningItem,
    completed_at: Date.now(),
    exit_code: exitCode,
  };

  // Delete from running, add to completed
  deleteRunningItem(id);
  appendCompletedItem(completedItem);

  return completedItem;
}

/**
 * Check exit status file for a running item
 *
 * @param runningItem - Running item to check
 * @returns Exit code if completed, null if still running
 */
export function checkStatusFile(runningItem: RunningItem): number | null {
  const statusFile = runningItem.metadata?.status_file as string | undefined;

  if (!statusFile) {
    return null;
  }

  if (!existsSync(statusFile)) {
    return null;
  }

  try {
    const content = require("node:fs").readFileSync(statusFile, "utf-8").trim();
    const exitCode = parseInt(content, 10);

    if (isNaN(exitCode)) {
      return null;
    }

    // Clean up status file
    require("node:fs").unlinkSync(statusFile);

    return exitCode;
  } catch {
    return null;
  }
}

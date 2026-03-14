/**
 * Logs operation
 *
 * Reads execution logs for a queue item
 */

import { existsSync, readFileSync, statSync, openSync, readSync, closeSync } from "node:fs";
import type { LogsResult, RunningItem } from "./types";
import { readRunningQueue, readCompletedItems, getLogPath } from "../core/persistence";

/**
 * Logs options
 */
export interface LogsOptions {
  /** Queue item ID */
  id: string;
  /** Maximum bytes to read (default: 64KB) */
  max_bytes?: number;
  /** Read from end instead of beginning */
  tail?: boolean;
  /** Number of lines to read from end (with tail) */
  lines?: number;
}

/**
 * Get execution logs for a queue item
 *
 * @param options - Logs options
 * @returns LogsResult with log content
 */
export function logs(options: LogsOptions): LogsResult {
  try {
    const { id, max_bytes = 64 * 1024, tail = false, lines } = options;

    if (!id || id.trim().length === 0) {
      return { success: false, error: "Item ID is required" };
    }

    // Find the item (running or completed)
    let logFile: string | undefined;

    // Check running queue
    const running = readRunningQueue();
    const runningItem = running.find((item) => item.id === id);
    if (runningItem) {
      logFile = runningItem.log_file;
    }

    // Check completed items
    if (!logFile) {
      const completed = readCompletedItems();
      const completedItem = completed.find((item) => item.id === id);
      if (completedItem) {
        logFile = completedItem.log_file;
      }
    }

    if (!logFile) {
      return { success: false, error: `Item not found or has no log file: ${id}` };
    }

    if (!existsSync(logFile)) {
      return {
        success: true,
        id,
        content: "",
        size: 0,
        truncated: false,
      };
    }

    const stats = statSync(logFile);
    const fileSize = stats.size;

    let content: string;
    let truncated = false;

    if (tail && lines) {
      // Read last N lines
      content = readLastLines(logFile, lines);
      truncated = fileSize > Buffer.byteLength(content);
    } else if (fileSize > max_bytes) {
      // Truncate large files
      const buffer = Buffer.alloc(max_bytes);
      const fd = openSync(logFile, "r");
      if (tail) {
        // Read from end
        readSync(fd, buffer, 0, max_bytes, fileSize - max_bytes);
      } else {
        // Read from beginning
        readSync(fd, buffer, 0, max_bytes, 0);
      }
      closeSync(fd);
      content = buffer.toString("utf-8");
      truncated = true;
    } else {
      content = readFileSync(logFile, "utf-8");
    }

    return {
      success: true,
      id,
      content,
      size: fileSize,
      truncated,
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return { success: false, error };
  }
}

/**
 * Read last N lines from a file
 */
function readLastLines(filePath: string, numLines: number): string {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  // Handle trailing newline
  const effectiveLines = lines[lines.length - 1] === "" ? lines.slice(0, -1) : lines;

  return effectiveLines.slice(-numLines).join("\n") + "\n";
}

/**
 * Follow logs for a running item (returns content periodically)
 *
 * This is a generator function that yields new content as it appears.
 * Use in SSE endpoints or CLI watch mode.
 *
 * @param id - Queue item ID
 * @param intervalMs - Check interval in milliseconds (default: 1000)
 */
export async function* followLogs(
  id: string,
  intervalMs = 1000
): AsyncGenerator<string, void, unknown> {
  let lastSize = 0;
  let running = true;

  while (running) {
    // Check if item is still running
    const runningQueue = readRunningQueue();
    const isRunning = runningQueue.some((item) => item.id === id);

    // Find log file
    let logFile: string | undefined;
    const runningItem = runningQueue.find((item) => item.id === id);
    if (runningItem) {
      logFile = runningItem.log_file;
    } else {
      // Check completed
      const completed = readCompletedItems();
      const completedItem = completed.find((item) => item.id === id);
      if (completedItem) {
        logFile = completedItem.log_file;
        running = false; // Last iteration
      }
    }

    if (logFile && existsSync(logFile)) {
      const stats = statSync(logFile);
      const currentSize = stats.size;

      if (currentSize > lastSize) {
        // Read new content
        const fd = openSync(logFile, "r");
        const buffer = Buffer.alloc(currentSize - lastSize);
        readSync(fd, buffer, 0, currentSize - lastSize, lastSize);
        closeSync(fd);

        const newContent = buffer.toString("utf-8");
        lastSize = currentSize;

        yield newContent;
      }
    }

    if (!isRunning && !running) {
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

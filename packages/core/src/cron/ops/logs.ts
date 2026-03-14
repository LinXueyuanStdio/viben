/**
 * Cron execution log operations
 *
 * Pure functions for managing cron job execution logs.
 * Logs are stored in JSONL format for easy querying.
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile, appendFile } from "node:fs/promises";

import type { CronJob, CronExecutionLog, GetLogsResult, ClearLogsResult } from "./types";
import { getLogDir, getLogPath } from "./crud";

// =============================================================================
// Constants
// =============================================================================

/** Maximum output length to store in logs */
export const MAX_LOG_OUTPUT_LENGTH = 10000;

/** Maximum number of log entries to keep per job */
export const MAX_LOG_ENTRIES_PER_JOB = 1000;

// =============================================================================
// Log Operations
// =============================================================================

/**
 * Generate a unique execution ID
 */
export function generateExecutionId(): string {
  return `exec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Append an execution log entry
 */
export async function appendExecutionLog(job: CronJob, log: CronExecutionLog): Promise<void> {
  const logDir = getLogDir(job);
  const logPath = getLogPath(job);

  try {
    // Ensure log directory exists
    await mkdir(logDir, { recursive: true });

    // Append log entry as JSONL
    const logLine = JSON.stringify(log) + "\n";
    await appendFile(logPath, logLine, "utf-8");

    // Rotate logs if needed (async, don't block)
    rotateLogsIfNeeded(job).catch(() => {
      // Ignore rotation errors
    });
  } catch (e) {
    // Log error but don't fail the execution
    console.error(`[cron] Failed to write execution log for job ${job.id}:`, e);
  }
}

/**
 * Rotate logs if they exceed the maximum entries
 */
export async function rotateLogsIfNeeded(job: CronJob): Promise<void> {
  const logPath = getLogPath(job);

  try {
    if (!existsSync(logPath)) return;

    const content = await readFile(logPath, "utf-8");
    const lines = content.trim().split("\n").filter((line) => line.length > 0);

    if (lines.length > MAX_LOG_ENTRIES_PER_JOB) {
      // Keep only the most recent entries
      const trimmedLines = lines.slice(-MAX_LOG_ENTRIES_PER_JOB);
      await writeFile(logPath, trimmedLines.join("\n") + "\n", "utf-8");
    }
  } catch {
    // Ignore rotation errors
  }
}

/**
 * Get execution logs for a job
 * @param job - The cron job
 * @param limit - Maximum number of entries to return (default 100)
 * @param offset - Number of entries to skip from the end (default 0)
 * @returns Array of execution logs (newest first)
 */
export async function getExecutionLogs(
  job: CronJob,
  limit = 100,
  offset = 0
): Promise<GetLogsResult> {
  const logPath = getLogPath(job);

  try {
    if (!existsSync(logPath)) {
      return { success: true, logs: [] };
    }

    const content = await readFile(logPath, "utf-8");
    const lines = content.trim().split("\n").filter((line) => line.length > 0);

    // Parse and return logs (newest first)
    const logs: CronExecutionLog[] = [];
    const startIndex = Math.max(0, lines.length - offset - limit);
    const endIndex = Math.max(0, lines.length - offset);

    for (let i = endIndex - 1; i >= startIndex; i--) {
      try {
        const log = JSON.parse(lines[i]) as CronExecutionLog;
        logs.push(log);
      } catch {
        // Skip invalid lines
      }
    }

    return { success: true, logs };
  } catch (error) {
    return {
      success: false,
      logs: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Clear execution logs for a job
 */
export async function clearExecutionLogs(job: CronJob): Promise<ClearLogsResult> {
  const logPath = getLogPath(job);

  try {
    if (existsSync(logPath)) {
      await writeFile(logPath, "", "utf-8");
    }
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Truncate output to maximum length for logging
 */
export function truncateOutput(output: string | undefined): string | undefined {
  if (!output) return output;
  if (output.length > MAX_LOG_OUTPUT_LENGTH) {
    return output.slice(0, MAX_LOG_OUTPUT_LENGTH) + "...[truncated]";
  }
  return output;
}

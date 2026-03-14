/**
 * Clean operation
 *
 * Cleans up old completed records and log files
 */

import { existsSync, unlinkSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { CleanResult } from "./types";
import {
  readCompletedItems,
  writeCompletedItems,
  readConfig as readQueueConfig,
  getLogsDir,
} from "../core/persistence";

/**
 * Clean options
 */
export interface CleanOptions {
  /** Clean completed records older than N days (default: from config) */
  completed_days?: number;
  /** Clean log files older than N days (default: from config) */
  log_days?: number;
  /** Dry run - don't actually delete */
  dry_run?: boolean;
  /** Clean only completed records */
  records_only?: boolean;
  /** Clean only log files */
  logs_only?: boolean;
}

/**
 * Clean up old completed records and log files
 *
 * @param options - Clean options
 * @returns CleanResult with count of cleaned items
 */
export function clean(options?: CleanOptions): CleanResult {
  try {
    const config = readQueueConfig();
    const {
      completed_days = config.completed_retention_days,
      log_days = config.log_retention_days,
      dry_run = false,
      records_only = false,
      logs_only = false,
    } = options || {};

    const cleanedItems: string[] = [];
    const now = Date.now();

    // Clean completed records
    if (!logs_only) {
      const completedCutoff = now - completed_days * 24 * 60 * 60 * 1000;
      const completed = readCompletedItems();
      const retained = completed.filter((item) => item.completed_at >= completedCutoff);
      const removed = completed.filter((item) => item.completed_at < completedCutoff);

      if (removed.length > 0 && !dry_run) {
        writeCompletedItems(retained);
      }

      cleanedItems.push(...removed.map((item) => `record:${item.id}`));
    }

    // Clean log files
    if (!records_only) {
      const logsDir = getLogsDir();
      if (existsSync(logsDir)) {
        const logCutoff = now - log_days * 24 * 60 * 60 * 1000;
        const files = readdirSync(logsDir);

        for (const file of files) {
          if (!file.endsWith(".log")) continue;

          const filePath = join(logsDir, file);
          const stats = statSync(filePath);

          if (stats.mtimeMs < logCutoff) {
            if (!dry_run) {
              unlinkSync(filePath);
            }
            cleanedItems.push(`log:${file}`);
          }
        }
      }
    }

    return {
      success: true,
      cleaned: cleanedItems.length,
      items: cleanedItems,
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return { success: false, cleaned: 0, error };
  }
}

/**
 * Clean all completed records (regardless of age)
 *
 * @param options - Optional dry_run flag
 * @returns CleanResult
 */
export function cleanAllCompleted(options?: { dry_run?: boolean }): CleanResult {
  try {
    const completed = readCompletedItems();
    const count = completed.length;

    if (!options?.dry_run) {
      writeCompletedItems([]);
    }

    return {
      success: true,
      cleaned: count,
      items: completed.map((item) => `record:${item.id}`),
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return { success: false, cleaned: 0, error };
  }
}

/**
 * Clean all log files (regardless of age)
 *
 * @param options - Optional dry_run flag
 * @returns CleanResult
 */
export function cleanAllLogs(options?: { dry_run?: boolean }): CleanResult {
  try {
    const logsDir = getLogsDir();
    const cleanedItems: string[] = [];

    if (existsSync(logsDir)) {
      const files = readdirSync(logsDir);

      for (const file of files) {
        if (!file.endsWith(".log")) continue;

        const filePath = join(logsDir, file);
        if (!options?.dry_run) {
          unlinkSync(filePath);
        }
        cleanedItems.push(`log:${file}`);
      }
    }

    return {
      success: true,
      cleaned: cleanedItems.length,
      items: cleanedItems,
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return { success: false, cleaned: 0, error };
  }
}

/**
 * Config operation
 *
 * Reads and updates queue configuration
 */

import type { ConfigResult, QueueConfig } from "./types";
import { readConfig as readQueueConfig, writeConfig as writeQueueConfig } from "../core/persistence";

/**
 * Get current queue configuration
 *
 * @returns ConfigResult with current config
 */
export function getConfig(): ConfigResult {
  try {
    const config = readQueueConfig();
    return { success: true, config };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return { success: false, error };
  }
}

/**
 * Update queue configuration
 *
 * @param updates - Partial config updates
 * @returns ConfigResult with updated config
 */
export function updateConfig(updates: Partial<QueueConfig>): ConfigResult {
  try {
    const current = readQueueConfig();

    // Validate updates
    if (updates.max_concurrency !== undefined) {
      if (typeof updates.max_concurrency !== "number" || updates.max_concurrency < 1) {
        return { success: false, error: "max_concurrency must be a positive number" };
      }
    }

    if (updates.promoter_interval_ms !== undefined) {
      if (typeof updates.promoter_interval_ms !== "number" || updates.promoter_interval_ms < 100) {
        return { success: false, error: "promoter_interval_ms must be at least 100" };
      }
    }

    if (updates.monitor_interval_ms !== undefined) {
      if (typeof updates.monitor_interval_ms !== "number" || updates.monitor_interval_ms < 1000) {
        return { success: false, error: "monitor_interval_ms must be at least 1000" };
      }
    }

    if (updates.log_retention_days !== undefined) {
      if (typeof updates.log_retention_days !== "number" || updates.log_retention_days < 1) {
        return { success: false, error: "log_retention_days must be at least 1" };
      }
    }

    if (updates.completed_retention_days !== undefined) {
      if (typeof updates.completed_retention_days !== "number" || updates.completed_retention_days < 1) {
        return { success: false, error: "completed_retention_days must be at least 1" };
      }
    }

    if (updates.default_max_retries !== undefined) {
      if (typeof updates.default_max_retries !== "number" || updates.default_max_retries < 0) {
        return { success: false, error: "default_max_retries must be non-negative" };
      }
    }

    // Merge and save
    const updated: QueueConfig = {
      ...current,
      ...updates,
    };

    writeQueueConfig(updated);

    return { success: true, config: updated };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return { success: false, error };
  }
}

/**
 * Set max concurrency
 *
 * @param value - New max concurrency value
 * @returns ConfigResult
 */
export function setMaxConcurrency(value: number): ConfigResult {
  return updateConfig({ max_concurrency: value });
}

/**
 * Set promoter interval
 *
 * @param value - New interval in milliseconds
 * @returns ConfigResult
 */
export function setPromoterInterval(value: number): ConfigResult {
  return updateConfig({ promoter_interval_ms: value });
}

/**
 * Set monitor interval
 *
 * @param value - New interval in milliseconds
 * @returns ConfigResult
 */
export function setMonitorInterval(value: number): ConfigResult {
  return updateConfig({ monitor_interval_ms: value });
}

/**
 * Set log retention days
 *
 * @param value - Number of days to retain logs
 * @returns ConfigResult
 */
export function setLogRetention(value: number): ConfigResult {
  return updateConfig({ log_retention_days: value });
}

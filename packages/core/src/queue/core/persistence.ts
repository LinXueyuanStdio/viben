/**
 * Queue Persistence Layer
 *
 * File-based persistence for the command queue system.
 * Storage location: ~/.viben/queue/
 *
 * Directory structure:
 * ~/.viben/queue/
 * ├── pending.jsonl       # Pending items (JSONL, FIFO order)
 * ├── running/            # Running items (one file per item)
 * │   └── {id}.json
 * ├── completed/          # Completed items (one file per item)
 * │   └── {id}.json
 * ├── logs/               # Log files for each item
 * │   └── {id}.log
 * └── config.json         # Queue configuration
 */

import { join } from "node:path";
import { homedir } from "node:os";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  unlinkSync,
  appendFileSync,
} from "node:fs";
import type {
  QueueItem,
  RunningItem,
  CompletedItem,
  QueueConfig,
} from "../ops/types";
import { DEFAULT_QUEUE_CONFIG } from "../ops/types";

// =============================================================================
// Directory Helpers
// =============================================================================

/**
 * Get the queue storage root directory
 */
export function getQueueDir(): string {
  return join(homedir(), ".viben", "queue");
}

/**
 * Get the pending queue file path
 */
export function getPendingPath(): string {
  return join(getQueueDir(), "pending.jsonl");
}

/**
 * Get the running directory path
 */
export function getRunningDir(): string {
  return join(getQueueDir(), "running");
}

/**
 * Get the completed directory path
 */
export function getCompletedDir(): string {
  return join(getQueueDir(), "completed");
}

/**
 * Get the logs directory path
 */
export function getLogsDir(): string {
  return join(getQueueDir(), "logs");
}

/**
 * Get the config file path
 */
export function getConfigPath(): string {
  return join(getQueueDir(), "config.json");
}

/**
 * Get the path for a running item file
 */
export function getRunningItemPath(id: string): string {
  return join(getRunningDir(), `${id}.json`);
}

/**
 * Get the path for a completed item file
 */
export function getCompletedItemPath(id: string): string {
  return join(getCompletedDir(), `${id}.json`);
}

/**
 * Get the path for a log file
 */
export function getLogPath(id: string): string {
  return join(getLogsDir(), `${id}.log`);
}

/**
 * Alias for getLogPath (for compatibility with ops layer)
 */
export const getLogFilePath = getLogPath;

/**
 * Ensure all queue directories exist
 */
export function ensureDirectories(): void {
  const dirs = [getQueueDir(), getRunningDir(), getCompletedDir(), getLogsDir()];
  for (const dir of dirs) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}

// =============================================================================
// Pending Queue Operations (JSONL file)
// =============================================================================

/**
 * Read all items from the pending queue
 */
export function readPendingQueue(): QueueItem[] {
  const path = getPendingPath();
  if (!existsSync(path)) {
    return [];
  }

  try {
    const content = readFileSync(path, "utf-8");
    const lines = content.split("\n").filter((line) => line.trim().length > 0);
    return lines.map((line) => JSON.parse(line) as QueueItem);
  } catch {
    return [];
  }
}

/**
 * Write all items to the pending queue (overwrites)
 */
export function writePendingQueue(items: QueueItem[]): void {
  ensureDirectories();
  const path = getPendingPath();
  const content = items.map((item) => JSON.stringify(item)).join("\n");
  writeFileSync(path, content + (items.length > 0 ? "\n" : ""), "utf-8");
}

/**
 * Append a single item to the pending queue
 */
export function appendPendingItem(item: QueueItem): void {
  ensureDirectories();
  const path = getPendingPath();
  appendFileSync(path, JSON.stringify(item) + "\n", "utf-8");
}

/**
 * Remove and return the first item from the pending queue
 */
export function popFirstPending(): QueueItem | null {
  const items = readPendingQueue();
  if (items.length === 0) {
    return null;
  }

  const first = items.shift()!;
  writePendingQueue(items);
  return first;
}

/**
 * Remove a specific item from the pending queue by ID
 */
export function removePendingItem(id: string): boolean {
  const items = readPendingQueue();
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) {
    return false;
  }

  items.splice(index, 1);
  writePendingQueue(items);
  return true;
}

// =============================================================================
// Running Queue Operations (individual JSON files)
// =============================================================================

/**
 * Read all running items
 */
export function readRunningQueue(): RunningItem[] {
  const dir = getRunningDir();
  if (!existsSync(dir)) {
    return [];
  }

  try {
    const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
    return files.map((file) => {
      const content = readFileSync(join(dir, file), "utf-8");
      return JSON.parse(content) as RunningItem;
    });
  } catch {
    return [];
  }
}

/**
 * Write the entire running queue (for compatibility, writes individual files)
 */
export function writeRunningQueue(items: RunningItem[]): void {
  ensureDirectories();
  const dir = getRunningDir();

  // Remove all existing files
  if (existsSync(dir)) {
    const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      unlinkSync(join(dir, file));
    }
  }

  // Write new files
  for (const item of items) {
    writeRunningItem(item);
  }
}

/**
 * Write a single running item
 */
export function writeRunningItem(item: RunningItem): void {
  ensureDirectories();
  const path = getRunningItemPath(item.id);
  writeFileSync(path, JSON.stringify(item, null, 2), "utf-8");
}

/**
 * Read a single running item
 */
export function readRunningItem(id: string): RunningItem | null {
  const path = getRunningItemPath(id);
  if (!existsSync(path)) {
    return null;
  }

  try {
    const content = readFileSync(path, "utf-8");
    return JSON.parse(content) as RunningItem;
  } catch {
    return null;
  }
}

/**
 * Delete a running item
 */
export function deleteRunningItem(id: string): boolean {
  const path = getRunningItemPath(id);
  if (!existsSync(path)) {
    return false;
  }

  try {
    unlinkSync(path);
    return true;
  } catch {
    return false;
  }
}

// =============================================================================
// Completed Queue Operations (individual JSON files)
// =============================================================================

/**
 * Read all completed items
 */
export function readCompletedItems(): CompletedItem[] {
  const dir = getCompletedDir();
  if (!existsSync(dir)) {
    return [];
  }

  try {
    const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
    return files.map((file) => {
      const content = readFileSync(join(dir, file), "utf-8");
      return JSON.parse(content) as CompletedItem;
    });
  } catch {
    return [];
  }
}

/**
 * Write a completed item
 */
export function writeCompletedItem(item: CompletedItem): void {
  ensureDirectories();
  const path = getCompletedItemPath(item.id);
  writeFileSync(path, JSON.stringify(item, null, 2), "utf-8");
}

/**
 * Append a completed item (alias for write)
 */
export function appendCompletedItem(item: CompletedItem): void {
  writeCompletedItem(item);
}

/**
 * Read a single completed item
 */
export function readCompletedItem(id: string): CompletedItem | null {
  const path = getCompletedItemPath(id);
  if (!existsSync(path)) {
    return null;
  }

  try {
    const content = readFileSync(path, "utf-8");
    return JSON.parse(content) as CompletedItem;
  } catch {
    return null;
  }
}

/**
 * Delete a completed item
 */
export function deleteCompletedItem(id: string): boolean {
  const path = getCompletedItemPath(id);
  if (!existsSync(path)) {
    return false;
  }

  try {
    unlinkSync(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Count completed items
 */
export function countCompletedItems(): number {
  const dir = getCompletedDir();
  if (!existsSync(dir)) {
    return 0;
  }

  try {
    return readdirSync(dir).filter((f) => f.endsWith(".json")).length;
  } catch {
    return 0;
  }
}

/**
 * Write all completed items (replaces all existing)
 */
export function writeCompletedItems(items: CompletedItem[]): void {
  ensureDirectories();
  const dir = getCompletedDir();

  // Remove all existing files
  if (existsSync(dir)) {
    const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      unlinkSync(join(dir, file));
    }
  }

  // Write new files
  for (const item of items) {
    writeCompletedItem(item);
  }
}

// =============================================================================
// Log File Operations
// =============================================================================

/**
 * Create or get a log file path for an item
 */
export function createLogFile(id: string): string {
  ensureDirectories();
  const path = getLogPath(id);
  if (!existsSync(path)) {
    writeFileSync(path, "", "utf-8");
  }
  return path;
}

/**
 * Read log file content
 */
export function readLogFile(id: string): string | null {
  const path = getLogPath(id);
  if (!existsSync(path)) {
    return null;
  }

  try {
    return readFileSync(path, "utf-8");
  } catch {
    return null;
  }
}

/**
 * Read last N lines of a log file
 */
export function readLogTail(id: string, lines: number): string | null {
  const content = readLogFile(id);
  if (!content) {
    return null;
  }

  const allLines = content.split("\n");
  const tailLines = allLines.slice(-lines);
  return tailLines.join("\n");
}

/**
 * Delete a log file
 */
export function deleteLogFile(id: string): boolean {
  const path = getLogPath(id);
  if (!existsSync(path)) {
    return false;
  }

  try {
    unlinkSync(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a log file exists
 */
export function logFileExists(id: string): boolean {
  return existsSync(getLogPath(id));
}

// =============================================================================
// Configuration Operations
// =============================================================================

/**
 * Read queue configuration
 */
export function readConfig(): QueueConfig {
  const path = getConfigPath();
  if (!existsSync(path)) {
    return { ...DEFAULT_QUEUE_CONFIG };
  }

  try {
    const content = readFileSync(path, "utf-8");
    const saved = JSON.parse(content) as Partial<QueueConfig>;
    return { ...DEFAULT_QUEUE_CONFIG, ...saved };
  } catch {
    return { ...DEFAULT_QUEUE_CONFIG };
  }
}

/**
 * Read queue configuration (alias for readConfig)
 */
export const readQueueConfig = readConfig;

/**
 * Write queue configuration
 */
export function writeConfig(config: QueueConfig): void {
  ensureDirectories();
  const path = getConfigPath();
  writeFileSync(path, JSON.stringify(config, null, 2), "utf-8");
}

/**
 * Write queue configuration (alias for writeConfig)
 */
export const writeQueueConfig = writeConfig;

/**
 * Update queue configuration (partial update)
 */
export function updateConfig(updates: Partial<QueueConfig>): QueueConfig {
  const current = readConfig();
  const updated = { ...current, ...updates };
  writeConfig(updated);
  return updated;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Find an item by ID across all queues
 */
export function findItemById(
  id: string
): { item: QueueItem | RunningItem | CompletedItem; status: "pending" | "running" | "completed" } | null {
  // Check pending
  const pending = readPendingQueue();
  const pendingItem = pending.find((item) => item.id === id);
  if (pendingItem) {
    return { item: pendingItem, status: "pending" };
  }

  // Check running
  const runningItem = readRunningItem(id);
  if (runningItem) {
    return { item: runningItem, status: "running" };
  }

  // Check completed
  const completedItem = readCompletedItem(id);
  if (completedItem) {
    return { item: completedItem, status: "completed" };
  }

  return null;
}

/**
 * Clean up old completed items and logs
 */
export function cleanupOldItems(retentionDays: number): { cleaned: number; ids: string[] } {
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const cleaned: string[] = [];

  const completed = readCompletedItems();
  for (const item of completed) {
    if (item.completed_at < cutoff) {
      deleteCompletedItem(item.id);
      deleteLogFile(item.id);
      cleaned.push(item.id);
    }
  }

  return { cleaned: cleaned.length, ids: cleaned };
}

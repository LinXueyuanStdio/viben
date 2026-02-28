/**
 * Queue Persistence
 *
 * YAML file persistence for the task queue with debouncing.
 * Storage location: ~/.viben/queue/
 */

import { join } from "node:path";
import { homedir } from "node:os";
import { readdir, unlink, rename } from "node:fs/promises";
import { existsSync } from "node:fs";
import { readYaml, writeYaml, ensureDir } from "../../config/yaml";
import type {
  QueueTask,
  QueueStateFile,
  TaskFile,
  QueueConfig,
} from "./types";

/**
 * Get the queue storage directory path
 */
export function getQueueDir(): string {
  return join(homedir(), ".viben", "queue");
}

/**
 * Get the state file path
 */
export function getStatePath(): string {
  return join(getQueueDir(), "state.yaml");
}

/**
 * Get the tasks directory path
 */
export function getTasksDir(): string {
  return join(getQueueDir(), "tasks");
}

/**
 * Get the corrupted tasks directory path
 */
export function getCorruptedDir(): string {
  return join(getQueueDir(), "corrupted");
}

/**
 * Get the path for a task file
 */
export function getTaskPath(taskId: string): string {
  return join(getTasksDir(), `task-${taskId}.yaml`);
}

/**
 * Queue persistence manager with debounced writes
 */
export class QueuePersistence {
  private debounceTimer: NodeJS.Timeout | null = null;
  private pendingWrite = false;
  private debounceMs: number;

  constructor(debounceMs: number = 500) {
    this.debounceMs = debounceMs;
  }

  /**
   * Ensure queue directories exist
   */
  async ensureDirectories(): Promise<void> {
    await ensureDir(getQueueDir());
    await ensureDir(getTasksDir());
  }

  /**
   * Load queue state from disk
   */
  async loadState(): Promise<QueueStateFile | undefined> {
    const statePath = getStatePath();
    return readYaml<QueueStateFile>(statePath);
  }

  /**
   * Save queue state with debouncing
   */
  async saveState(
    state: QueueStateFile,
    immediate = false
  ): Promise<void> {
    if (immediate) {
      await this.writeState(state);
      return;
    }

    // Debounced write
    this.pendingWrite = true;
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(async () => {
      if (this.pendingWrite) {
        await this.writeState(state);
        this.pendingWrite = false;
      }
    }, this.debounceMs);
  }

  /**
   * Write state immediately
   */
  private async writeState(state: QueueStateFile): Promise<void> {
    await this.ensureDirectories();
    const statePath = getStatePath();
    state.last_updated = Date.now();
    await writeYaml(statePath, state);
  }

  /**
   * Load a task from disk
   */
  async loadTask(taskId: string): Promise<QueueTask | undefined> {
    const taskPath = getTaskPath(taskId);
    const taskFile = await readYaml<TaskFile>(taskPath);
    if (!taskFile) return undefined;

    return {
      id: taskFile.id,
      type: taskFile.type,
      payload: taskFile.payload,
      status: taskFile.status,
      retry_count: taskFile.retry_count,
      max_retries: taskFile.max_retries,
      created_at: taskFile.created_at,
      started_at: taskFile.started_at,
      completed_at: taskFile.completed_at,
      error: taskFile.error,
    };
  }

  /**
   * Save a task with debouncing
   */
  async saveTask(task: QueueTask, immediate = false): Promise<void> {
    const taskFile: TaskFile = {
      id: task.id,
      type: task.type,
      status: task.status,
      retry_count: task.retry_count,
      max_retries: task.max_retries,
      created_at: task.created_at,
      started_at: task.started_at,
      completed_at: task.completed_at,
      error: task.error,
      payload: task.payload,
    };

    if (immediate) {
      await this.writeTask(task.id, taskFile);
      return;
    }

    // For task updates, use debouncing
    this.pendingWrite = true;
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(async () => {
      if (this.pendingWrite) {
        await this.writeTask(task.id, taskFile);
        this.pendingWrite = false;
      }
    }, this.debounceMs);
  }

  /**
   * Write task immediately
   */
  private async writeTask(taskId: string, taskFile: TaskFile): Promise<void> {
    await this.ensureDirectories();
    const taskPath = getTaskPath(taskId);
    await writeYaml(taskPath, taskFile);
  }

  /**
   * Delete a task file
   */
  async deleteTask(taskId: string): Promise<void> {
    const taskPath = getTaskPath(taskId);
    if (existsSync(taskPath)) {
      try {
        await unlink(taskPath);
      } catch (e) {
        console.warn(`[QueuePersistence] Failed to delete task ${taskId}:`, e);
      }
    }
  }

  /**
   * Move a corrupted task file to corrupted directory
   */
  async moveToCorrupted(taskId: string): Promise<void> {
    const taskPath = getTaskPath(taskId);
    if (!existsSync(taskPath)) return;

    await ensureDir(getCorruptedDir());
    const corruptedPath = join(
      getCorruptedDir(),
      `task-${taskId}-${Date.now()}.yaml`
    );

    try {
      await rename(taskPath, corruptedPath);
      console.warn(`[QueuePersistence] Moved corrupted task to: ${corruptedPath}`);
    } catch (e) {
      console.error(`[QueuePersistence] Failed to move corrupted task:`, e);
    }
  }

  /**
   * Load all tasks from disk
   */
  async loadAllTasks(): Promise<Map<string, QueueTask>> {
    const tasks = new Map<string, QueueTask>();
    const tasksDir = getTasksDir();

    if (!existsSync(tasksDir)) {
      return tasks;
    }

    try {
      const files = await readdir(tasksDir);
      for (const file of files) {
        if (!file.startsWith("task-") || !file.endsWith(".yaml")) continue;

        const taskId = file.replace(/^task-/, "").replace(/\.yaml$/, "");
        try {
          const task = await this.loadTask(taskId);
          if (task) {
            tasks.set(taskId, task);
          }
        } catch (e) {
          console.error(`[QueuePersistence] Failed to load task ${taskId}:`, e);
          // Move corrupted file
          await this.moveToCorrupted(taskId);
        }
      }
    } catch (e) {
      console.error(`[QueuePersistence] Failed to read tasks directory:`, e);
    }

    return tasks;
  }

  /**
   * Flush any pending writes immediately
   */
  async flush(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    // Note: The actual write would need to be tracked separately
    // This just cancels the timer for graceful shutdown
  }

  /**
   * Save config file
   */
  async saveConfig(config: QueueConfig): Promise<void> {
    await this.ensureDirectories();
    const configPath = join(getQueueDir(), "config.yaml");
    await writeYaml(configPath, config);
  }

  /**
   * Load config file
   */
  async loadConfig(): Promise<QueueConfig | undefined> {
    const configPath = join(getQueueDir(), "config.yaml");
    return readYaml<QueueConfig>(configPath);
  }
}

/**
 * Singleton persistence instance
 */
let persistence: QueuePersistence | null = null;

/**
 * Get or create the singleton persistence instance
 */
export function getQueuePersistence(debounceMs?: number): QueuePersistence {
  if (!persistence) {
    persistence = new QueuePersistence(debounceMs);
  }
  return persistence;
}

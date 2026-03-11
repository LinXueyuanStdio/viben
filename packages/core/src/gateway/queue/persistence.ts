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
import { logger as globalLogger } from "../../telemetry";

// Module-level logger
const log = globalLogger.child({ module: "queue-persistence" });

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
 *
 * Uses separate debounce timers for state and tasks to avoid race conditions.
 */
export class QueuePersistence {
  /** Debounce timer for state writes */
  private stateDebounceTimer: NodeJS.Timeout | null = null;
  /** Pending state to write */
  private pendingState: QueueStateFile | null = null;

  /** Debounce timers for task writes (per task ID) */
  private taskDebounceTimers: Map<string, NodeJS.Timeout> = new Map();
  /** Pending tasks to write (per task ID) */
  private pendingTasks: Map<string, TaskFile> = new Map();

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

    // Debounced write using separate timer for state
    this.pendingState = state;
    if (this.stateDebounceTimer) {
      clearTimeout(this.stateDebounceTimer);
    }

    this.stateDebounceTimer = setTimeout(async () => {
      if (this.pendingState) {
        await this.writeState(this.pendingState);
        this.pendingState = null;
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
   *
   * Each task has its own debounce timer to prevent race conditions.
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
      // Clear any pending debounced write for this task
      const existingTimer = this.taskDebounceTimers.get(task.id);
      if (existingTimer) {
        clearTimeout(existingTimer);
        this.taskDebounceTimers.delete(task.id);
      }
      this.pendingTasks.delete(task.id);
      await this.writeTask(task.id, taskFile);
      return;
    }

    // Debounced write using per-task timer
    this.pendingTasks.set(task.id, taskFile);
    const existingTimer = this.taskDebounceTimers.get(task.id);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(async () => {
      const pending = this.pendingTasks.get(task.id);
      if (pending) {
        try {
          await this.writeTask(task.id, pending);
        } catch (error) {
          log.error({ err: error, taskId: task.id }, "Failed to write task");
          // Re-throw to let caller handle, but ensure cleanup happens
          throw error;
        } finally {
          // Always clean up pending state, even on failure
          this.pendingTasks.delete(task.id);
          this.taskDebounceTimers.delete(task.id);
        }
      }
    }, this.debounceMs);

    this.taskDebounceTimers.set(task.id, timer);
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
        log.warn({ err: e, taskId }, "Failed to delete task");
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
      log.warn({ taskId, corruptedPath }, "Moved corrupted task");
    } catch (e) {
      log.error({ err: e, taskId }, "Failed to move corrupted task");
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
          log.error({ err: e, taskId }, "Failed to load task");
          // Move corrupted file
          await this.moveToCorrupted(taskId);
        }
      }
    } catch (e) {
      log.error({ err: e }, "Failed to read tasks directory");
    }

    return tasks;
  }

  /**
   * Flush any pending writes immediately
   */
  async flush(): Promise<void> {
    // Flush pending state
    if (this.stateDebounceTimer) {
      clearTimeout(this.stateDebounceTimer);
      this.stateDebounceTimer = null;
    }
    if (this.pendingState) {
      await this.writeState(this.pendingState);
      this.pendingState = null;
    }

    // Flush all pending tasks
    for (const [taskId, timer] of this.taskDebounceTimers) {
      clearTimeout(timer);
    }
    this.taskDebounceTimers.clear();

    for (const [taskId, taskFile] of this.pendingTasks) {
      await this.writeTask(taskId, taskFile);
    }
    this.pendingTasks.clear();
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

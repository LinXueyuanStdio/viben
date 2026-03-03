/**
 * Auto-Fix Module
 *
 * Provides automatic issue fix capabilities:
 * - Task queue management
 * - Worktree isolation
 * - Progress tracking
 */

export {
  // Types
  type WorktreeInfo,
  type ExecResult,
  type WorktreeManagerOptions,
  // Class
  WorktreeManager,
  // Factory
  createWorktreeManager,
} from "./worktree-manager";

export {
  // Types
  type TaskQueueEvents,
  type FixPlan,
  type FixStep,
  type FileEdit,
  type FileChange,
  type CreateTaskOptions,
  // Class
  AutoFixTaskQueue,
  // Factory
  getTaskQueue,
  removeTaskQueue,
} from "./task-queue";

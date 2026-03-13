/**
 * Task operations module
 *
 * Re-exports all task-related operations for use by commands and other modules.
 *
 * Module structure:
 * - types.ts          - Type definitions (TaskJson, ContextEntry, etc.)
 * - display.ts        - CLI display formatting (status, priority colors)
 * - session.ts        - Journal and session management
 * - status.ts         - Status monitoring and log viewing
 * - context-output.ts - Context generation for AI agents
 * - lifecycle.ts      - Task status transitions (enqueue, pause, etc.)
 * - context-files.ts  - Context JSONL file management
 * - crud.ts           - Create, Read, Update, Delete operations
 * - config.ts         - Task configuration (branch, scope, agent)
 * - review.ts         - Review and PR info operations
 * - edit.ts           - Edit task in external editor
 * - create-pr.ts      - Create pull request from task
 */

// Types
export type {
  TaskJson,
  ContextEntry,
  StatusSummaryOptions,
  RunningTaskInfo,
  StoppedTaskInfo,
  RegularTaskInfo,
  ContextJson,
  SessionMarkdownParams,
  IndexUpdateParams,
  JournalFileInfo,
} from "./types";

// Display utilities
export {
  formatStatus,
  formatPriority,
  statusColor,
  getPriorityColor,
} from "./display";

// Session operations
export {
  getLatestJournalInfo,
  getSessionNumberFromIndex,
  generateSessionMarkdown,
  createNewJournalFile,
  countJournalFilesTable,
  updateIndexWithNewSession,
} from "./session";

// Status operations
export {
  getLastTool,
  getLastMessage,
  countModifiedFiles,
  tailFollow,
  cmdStatusSummary,
  cmdStatusList,
  cmdStatusDetail,
  cmdStatusWatch,
  cmdStatusLog,
  cmdStatusRegistry,
} from "./status";

// Context output
export {
  getContextJson,
  getContextText,
} from "./context-output";

// Lifecycle operations
export type { LifecycleResult } from "./lifecycle";
export {
  enqueueTask,
  dequeueTask,
  pauseTask,
  resumeTask,
  approveTask,
  rejectTask,
  retryTask,
  cancelTask,
} from "./lifecycle";

// Context file operations
export type {
  ContextInitResult,
  ContextAddResult,
  ContextRemoveResult,
  ContextListResult,
  ContextValidateResult,
} from "./context-files";
export {
  initContext,
  addContext,
  removeContext,
  listContext,
  validateContext,
} from "./context-files";

// CRUD operations
export type {
  ListTasksResult,
  ListTasksOptions,
  CreateTaskOptions,
  CreateTaskResult,
  ViewTaskResult,
  DeleteTaskResult,
  FinishTaskResult,
  ArchiveTaskResult,
  ListArchiveResult,
} from "./crud";
export {
  listTasks,
  createTask,
  viewTask,
  deleteTask,
  finishTask,
  archiveTask,
  listArchivedTasks,
} from "./crud";

// Config operations
export type { SetFieldResult } from "./config";
export {
  setTaskField,
  setTaskBranch,
  setTaskBaseBranch,
  setTaskAgent,
} from "./config";

// Review operations
export type { PRInfo, ReviewTaskResult } from "./review";
export { reviewTask } from "./review";

// Edit operations
export type { EditTaskResult, EditTaskCallbacks } from "./edit";
export { editTask } from "./edit";

// PR operations
export type { CreatePROptions, CreatePRResult } from "./create-pr";
export { createPR } from "./create-pr";

// Context prompt utilities (for phase modules)
export {
  formatContextList,
  getContextListFromJsonl,
  buildContextSection,
  hasContextEntries,
} from "./context-prompt";

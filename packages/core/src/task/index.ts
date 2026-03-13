/**
 * Task State Machine Module
 *
 * Provides XState-based task lifecycle management with:
 * - State machine for task transitions
 * - Event sequencing and validation
 * - Recovery mechanisms for stuck tasks
 *
 * @example
 * ```typescript
 * import {
 *   taskEventStore,
 *   createTaskEvent,
 *   TaskRecoveryService,
 * } from "@viben/core/task";
 *
 * // Apply an event to a task
 * const event = createTaskEvent("START", 1);
 * const result = await taskEventStore.applyEvent(taskDir, event);
 *
 * // Check if task is stuck and recover
 * const recovery = new TaskRecoveryService(taskEventStore);
 * await recovery.recoverOnStartup(workspacePath);
 * ```
 */

// =============================================================================
// Event Types
// =============================================================================

export {
  type TaskEventType,
  VALID_EVENT_TYPES,
  isValidEventType,
} from "./events/event-types";

// =============================================================================
// Task Event
// =============================================================================

export { type TaskEvent, createTaskEvent } from "./events/task-event";

// =============================================================================
// Event Store
// =============================================================================

export {
  TaskEventStore,
  taskEventStore,
  type ApplyEventResult,
} from "./events/event-store";

// =============================================================================
// State Machine
// =============================================================================

export {
  taskMachine,
  xstateToTaskStatus,
  xstateToExecutionPhase,
  getStateValue,
  getNextState,
  type XStateValue,
  type TaskMachineContext,
  type TaskMachineEvent,
} from "./machine/task-machine";

export { guards } from "./machine/guards";
export { actions } from "./machine/actions";

// =============================================================================
// Recovery
// =============================================================================

export {
  TaskRecoveryService,
  type TaskRecoveryResult,
  type RecoverySummary,
  type RecoveryConfig,
} from "./recovery/task-recovery";

// =============================================================================
// Agent Events (State Machine Integration)
// =============================================================================

export {
  AgentEventEmitter,
  agentEventEmitter,
  type AgentEventOptions,
  type AgentEventResult,
} from "./events/agent-events";

// =============================================================================
// Task Operations (CLI Operations)
// =============================================================================

export {
  // Types
  type TaskJson,
  type ContextEntry,
  type StatusSummaryOptions,
  type RunningTaskInfo,
  type StoppedTaskInfo,
  type RegularTaskInfo,
  type ContextJson,
  type SessionMarkdownParams,
  type IndexUpdateParams,
  type JournalFileInfo,
  // Display utilities
  formatStatus,
  formatPriority,
  statusColor,
  getPriorityColor,
  // Session operations
  getLatestJournalInfo,
  getSessionNumberFromIndex,
  generateSessionMarkdown,
  createNewJournalFile,
  countJournalFilesTable,
  updateIndexWithNewSession,
  // Status operations
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
  // Context output
  getContextJson,
  getContextText,
  // Lifecycle operations
  type LifecycleResult,
  enqueueTask,
  dequeueTask,
  pauseTask,
  resumeTask,
  approveTask,
  rejectTask,
  retryTask,
  cancelTask,
  // Context file operations
  type ContextInitResult,
  type ContextAddResult,
  type ContextRemoveResult,
  type ContextListResult,
  type ContextValidateResult,
  initContext,
  addContext,
  removeContext,
  listContext,
  validateContext,
  // CRUD operations
  type ListTasksResult,
  type ListTasksOptions,
  type CreateTaskOptions,
  type CreateTaskResult,
  type ViewTaskResult,
  type DeleteTaskResult,
  type FinishTaskResult,
  type ArchiveTaskResult,
  type ListArchiveResult,
  listTasks,
  createTask,
  viewTask,
  deleteTask,
  finishTask,
  archiveTask,
  listArchivedTasks,
  // Config operations
  type SetFieldResult,
  setTaskField,
  setTaskBranch,
  setTaskBaseBranch,
  setTaskAgent,
  // Review operations
  type PRInfo,
  type ReviewTaskResult,
  reviewTask,
} from "./ops";

// =============================================================================
// Phase Modules
// =============================================================================

export {
  // Plan phase
  runPlanPhase,
  type PlanPhaseOptions,
  type PlanPhaseResult,
  // Implement phase
  runImplementPhase,
  runImplementPhaseSync,
  type ImplementPhaseOptions,
  type ImplementPhaseResult,
  // Check phase
  runCheckPhase,
  type CheckPhaseOptions,
  type CheckPhaseResult,
  // Work phase (work agent - reusable by swarm start)
  runWorkPhase,
  type WorkPhaseOptions,
  type WorkPhaseResult,
  // Start phase (unified entry point)
  startTask,
  type StartTaskOptions,
  type StartTaskResult,
  // Worktree phase (create isolated worktree)
  runCreateWorktree,
  type CreateWorktreeOptions,
  type CreateWorktreeResult,
} from "./phase";

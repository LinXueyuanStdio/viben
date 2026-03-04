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
  createTaskActor,
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

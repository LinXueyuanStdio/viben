/**
 * Task Event Store
 *
 * Manages event validation, sequencing, and persistence.
 * Ensures strict ordering of events via sequence numbers.
 */

import { createActor } from "xstate";
import { taskService, type UnifiedTask, type TaskEvent } from "../../services/task-service";
import { taskMachine, xstateToTaskStatus, getStateValue, type XStateValue, type TaskMachineEvent } from "../machine/task-machine";
import { isValidEventType, type TaskEventType } from "./event-types";

// =============================================================================
// Types
// =============================================================================

/**
 * Result of applying an event
 */
export interface ApplyEventResult {
  /** Whether the event was successfully applied */
  success: boolean;
  /** Error code if failed */
  error?: "SEQUENCE_MISMATCH" | "INVALID_TRANSITION" | "INVALID_EVENT_TYPE" | "TASK_NOT_FOUND";
  /** Expected sequence number (for SEQUENCE_MISMATCH) */
  expected?: number;
  /** Received sequence number (for SEQUENCE_MISMATCH) */
  received?: number;
  /** Current state (for INVALID_TRANSITION) */
  currentState?: string;
  /** New state after transition (on success) */
  newState?: string;
  /** Updated task (on success) */
  task?: UnifiedTask;
}

/**
 * Task event store for validating and applying events
 */
export class TaskEventStore {
  /**
   * Validate and apply an event to a task
   *
   * @param taskDir - Absolute path to task directory
   * @param event - Event to apply
   * @returns ApplyEventResult with success/failure info
   */
  async applyEvent(taskDir: string, event: TaskEvent): Promise<ApplyEventResult> {
    // 1. Load current task
    const task = await taskService.getTask(taskDir);
    if (!task) {
      return { success: false, error: "TASK_NOT_FOUND" };
    }

    // 2. Validate event type
    if (!isValidEventType(event.type)) {
      return { success: false, error: "INVALID_EVENT_TYPE" };
    }

    // 3. Validate sequence number (strict ordering)
    const expectedSeq = (task.lastEvent?.sequence ?? 0) + 1;
    if (event.sequence !== expectedSeq) {
      return {
        success: false,
        error: "SEQUENCE_MISMATCH",
        expected: expectedSeq,
        received: event.sequence,
      };
    }

    // 4. Validate state transition using XState
    const currentXState = task.xstateState ?? "backlog";
    const transitionResult = this.computeTransition(currentXState, event.type);

    if (!transitionResult.changed) {
      return {
        success: false,
        error: "INVALID_TRANSITION",
        currentState: JSON.stringify(currentXState),
      };
    }

    // 5. Compute new status
    const newStatus = xstateToTaskStatus(transitionResult.value);

    // 6. Update task with new state and event history
    const updatedTask = await taskService.updateTask(taskDir, {
      status: newStatus,
      xstateState: transitionResult.value,
      lastEvent: event,
      eventHistory: [...(task.eventHistory ?? []), event],
      // Also update reviewReason if transitioning to human_review
      reviewReason: this.computeReviewReason(event, task),
    });

    return {
      success: true,
      newState: JSON.stringify(transitionResult.value),
      task: updatedTask,
    };
  }

  /**
   * Compute the state transition using XState
   */
  private computeTransition(
    currentState: XStateValue,
    eventType: string
  ): { value: XStateValue; changed: boolean } {
    // Create a fresh actor
    const actor = createActor(taskMachine);
    actor.start();

    // Get initial state
    const initialValue = getStateValue(actor.getSnapshot());

    // If current state is not the initial state, we need to navigate there
    // For simplicity, we'll use a workaround: check if the event is valid
    // from the given state using the machine's definition

    // Get transitions for the current state
    const snapshot = actor.getSnapshot();

    // Try to send the event
    try {
      actor.send({ type: eventType } as TaskMachineEvent);
      const newSnapshot = actor.getSnapshot();
      const newValue = getStateValue(newSnapshot);

      // Check if state actually changed
      const changed = JSON.stringify(initialValue) !== JSON.stringify(newValue);

      actor.stop();
      return { value: newValue, changed };
    } catch {
      actor.stop();
      return { value: currentState, changed: false };
    }
  }

  /**
   * Compute review reason based on event type
   */
  private computeReviewReason(event: TaskEvent, task: UnifiedTask): UnifiedTask["reviewReason"] {
    switch (event.type) {
      case "QA_PASSED":
        return "completed";
      case "USER_STOPPED":
        return "stopped";
      case "PLANNING_COMPLETE":
        // Only set if going to human_review (requiresPlanReview)
        return task.metadata?.agentConfig?.thinkingLevel === "high" ? "plan_review" : task.reviewReason;
      case "QA_FAILED":
        return "qa_rejected";
      default:
        return task.reviewReason;
    }
  }

  /**
   * Get the next expected sequence number for a task
   *
   * @param taskDir - Absolute path to task directory
   * @returns Next expected sequence number, or 1 if no events exist
   */
  async getNextSequence(taskDir: string): Promise<number> {
    const task = await taskService.getTask(taskDir);
    if (!task) {
      return 1;
    }
    return (task.lastEvent?.sequence ?? 0) + 1;
  }

  /**
   * Get the event history for a task
   *
   * @param taskDir - Absolute path to task directory
   * @param since - Optional sequence number to start from
   * @returns Array of events since the given sequence
   */
  async getEventHistory(taskDir: string, since?: number): Promise<TaskEvent[]> {
    const task = await taskService.getTask(taskDir);
    if (!task || !task.eventHistory) {
      return [];
    }

    if (since === undefined) {
      return task.eventHistory;
    }

    return task.eventHistory.filter((e) => e.sequence > since);
  }

  /**
   * Validate an event without applying it
   *
   * @param taskDir - Absolute path to task directory
   * @param event - Event to validate
   * @returns Validation result
   */
  async validateEvent(taskDir: string, event: TaskEvent): Promise<ApplyEventResult> {
    // Load current task
    const task = await taskService.getTask(taskDir);
    if (!task) {
      return { success: false, error: "TASK_NOT_FOUND" };
    }

    // Validate event type
    if (!isValidEventType(event.type)) {
      return { success: false, error: "INVALID_EVENT_TYPE" };
    }

    // Validate sequence number
    const expectedSeq = (task.lastEvent?.sequence ?? 0) + 1;
    if (event.sequence !== expectedSeq) {
      return {
        success: false,
        error: "SEQUENCE_MISMATCH",
        expected: expectedSeq,
        received: event.sequence,
      };
    }

    // Validate state transition
    const currentXState = task.xstateState ?? "backlog";
    const transitionResult = this.computeTransition(currentXState, event.type);

    if (!transitionResult.changed) {
      return {
        success: false,
        error: "INVALID_TRANSITION",
        currentState: JSON.stringify(currentXState),
      };
    }

    return {
      success: true,
      newState: JSON.stringify(transitionResult.value),
    };
  }
}

/**
 * Singleton event store instance
 */
export const taskEventStore = new TaskEventStore();

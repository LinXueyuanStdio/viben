/**
 * Task Event Store
 *
 * Manages event validation, sequencing, and persistence.
 * Ensures strict ordering of events via sequence numbers.
 *
 * STORAGE FORMAT (v2):
 * Events are stored in a separate `events.jsonl` file (JSON Lines format)
 * for append-only writes and efficient storage. The task.json only keeps
 * `lastEvent` for quick access to the latest state.
 *
 * Directory structure:
 * <workspace>/.viben/tasks/<date>-<slug>/
 *   ├── task.json      # Main task file (no eventHistory)
 *   ├── events.jsonl   # Event history (append-only)
 *   └── ...
 *
 * IMPORTANT: All write operations are protected by an async lock to prevent
 * race conditions in concurrent event applications. The lock is keyed by
 * task directory path, allowing concurrent operations on different tasks
 * while serializing operations on the same task.
 */

import { join } from "node:path";
import { appendFile, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { taskService } from "../service";
import type { UnifiedTask, TaskEvent } from "../ops/types";
import {
  xstateToTaskStatus,
  getNextState,
  type XStateValue,
  type TaskMachineEvent,
} from "../machine/task-machine";
import { isValidEventType, type TaskEventType } from "./event-types";
import { taskLock } from "../../utils/async-lock";

// =============================================================================
// Constants
// =============================================================================

const EVENTS_FILE = "events.jsonl";

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
   * This method is protected by an async lock to prevent race conditions
   * when multiple concurrent requests try to apply events to the same task.
   * The lock ensures that read-validate-write operations are atomic.
   *
   * @param taskDir - Absolute path to task directory
   * @param event - Event to apply
   * @returns ApplyEventResult with success/failure info
   */
  async applyEvent(taskDir: string, event: TaskEvent): Promise<ApplyEventResult> {
    // Use lock to prevent concurrent modifications to the same task
    // This ensures the read-validate-write sequence is atomic
    return taskLock.withLock(taskDir, async () => {
      return this.applyEventUnsafe(taskDir, event);
    });
  }

  /**
   * Internal method to apply event without locking
   * Should only be called from within a lock context
   */
  private async applyEventUnsafe(taskDir: string, event: TaskEvent): Promise<ApplyEventResult> {
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
    const expectedSeq = (task.last_event?.sequence ?? 0) + 1;
    if (event.sequence !== expectedSeq) {
      return {
        success: false,
        error: "SEQUENCE_MISMATCH",
        expected: expectedSeq,
        received: event.sequence,
      };
    }

    // 4. Validate state transition using XState
    // If xstate_state is not set, infer from status (for backward compatibility with tasks
    // that were created/updated without the event system)
    const currentXState = task.xstate_state ?? task.status ?? "backlog";
    const transitionResult = this.computeTransition(currentXState, event.type, task.machine_context);

    // Check if transition is valid:
    // - changed: true means state changed (normal transition)
    // - changed: false with same state could be a self-transition (like SUBTASK_COMPLETE)
    // - For self-transitions, we need to check if the event is valid for current state
    const isSelfTransition = this.isSelfTransitionEvent(event.type);
    const isValidSelfTransition = isSelfTransition && this.isValidSelfTransition(currentXState, event.type);

    if (!transitionResult.changed && !isValidSelfTransition) {
      return {
        success: false,
        error: "INVALID_TRANSITION",
        currentState: JSON.stringify(currentXState),
      };
    }

    // 5. Compute new status
    const newStatus = xstateToTaskStatus(transitionResult.value);

    // 6. Append event to events.jsonl (new storage format)
    await this.appendEvent(taskDir, event);

    // 7. Build update payload
    const updatePayload: Parameters<typeof taskService.updateTask>[1] = {
      status: newStatus,
      xstate_state: transitionResult.value,
      last_event: event,
      // Note: event_history is no longer stored in task.json
      // Events are stored in events.jsonl for append-only efficiency
      // Also update review_reason if transitioning to review
      review_reason: this.computeReviewReason(event, task),
    };

    // 8. Handle event-specific payload data
    if (event.type === "QUEUE") {
      // Set queuedAt timestamp for FIFO ordering
      updatePayload.queued_at = event.timestamp;
      // Extract agent/executor/model/priority configuration from payload
      if (event.payload) {
        const payload = event.payload as { agent?: string; executor?: string; model?: string; priority?: UnifiedTask["priority"] };
        if (payload.agent) updatePayload.agent = payload.agent;
        if (payload.executor) updatePayload.executor = payload.executor;
        if (payload.model) updatePayload.model = payload.model;
        if (payload.priority) updatePayload.priority = payload.priority;
      }
    } else if (event.type === "DEQUEUE") {
      // Clear queued_at when dequeuing back to backlog
      updatePayload.queued_at = undefined;
    } else if (event.type === "RETRY") {
      // Set queued_at when retrying (failed -> queue)
      updatePayload.queued_at = event.timestamp;
    } else if (event.type === "APPROVED") {
      // Extract merge commit info from payload
      if (event.payload) {
        const payload = event.payload as { merge_commit?: string; merged_at?: string };
        if (payload.merge_commit) updatePayload.merge_commit = payload.merge_commit;
        if (payload.merged_at) updatePayload.merged_at = payload.merged_at;
      }
    }

    // 9. Persist machine_context for pause/resume across restarts
    // @see docs/plans/2026-03-09-task-system-improvements-design.md - Section 3
    if (event.type === "PAUSE") {
      // Save context snapshot when pausing
      const currentSubtaskIndex = task.machine_context?.current_subtask_index ?? 0;
      updatePayload.machine_context = {
        current_subtask_index: currentSubtaskIndex,
        requires_plan_review: task.machine_context?.requires_plan_review ?? false,
        paused_snapshot: {
          from_state: currentXState,
          subtask_index: currentSubtaskIndex,
          paused_at: event.timestamp,
        },
      };
    } else if (event.type === "RESUME" || event.type === "ABANDON" || event.type === "CANCEL") {
      // Clear paused_snapshot on resume/abandon/cancel
      if (task.machine_context) {
        updatePayload.machine_context = {
          current_subtask_index: task.machine_context.current_subtask_index,
          requires_plan_review: task.machine_context.requires_plan_review,
          paused_snapshot: undefined,
        };
      }
    } else if (event.type === "SUBTASK_COMPLETE") {
      // Increment subtask index
      const newIndex = (task.machine_context?.current_subtask_index ?? 0) + 1;
      updatePayload.machine_context = {
        current_subtask_index: newIndex,
        requires_plan_review: task.machine_context?.requires_plan_review ?? false,
        paused_snapshot: task.machine_context?.paused_snapshot,
      };
    }

    // 10. Update task.json with new state
    const updatedTask = await taskService.updateTask(taskDir, updatePayload);

    return {
      success: true,
      newState: JSON.stringify(transitionResult.value),
      task: updatedTask,
    };
  }

  // ==========================================================================
  // Event Storage Methods (events.jsonl)
  // ==========================================================================

  /**
   * Append an event to the events.jsonl file
   *
   * This method uses append-only writes for efficiency.
   * Each line is a complete JSON object.
   *
   * @param taskDir - Absolute path to task directory
   * @param event - Event to append
   */
  private async appendEvent(taskDir: string, event: TaskEvent): Promise<void> {
    const eventsPath = join(taskDir, EVENTS_FILE);
    const eventLine = JSON.stringify(event) + "\n";
    await appendFile(eventsPath, eventLine, "utf-8");
  }

  /**
   * Pass through XState value as-is (legacy status normalization removed)
   */
  private normalizeXStateValue(value: XStateValue): XStateValue {
    return value;
  }

  /**
   * Compute the state transition using XState
   *
   * Uses the getNextState function which properly restores the machine
   * to the current state before computing the transition.
   */
  private computeTransition(
    currentState: XStateValue,
    eventType: string,
    machineContext?: UnifiedTask["machine_context"]
  ): { value: XStateValue; changed: boolean } {
    // Normalize legacy state names before computing transition
    const normalizedState = this.normalizeXStateValue(currentState);

    // Map task machine_context to XState TaskMachineContext format
    // This is needed for guards (e.g., pausedFromImplement) to work correctly
    const xstateContext: Partial<import("../machine/task-machine").TaskMachineContext> | undefined = machineContext ? {
      currentSubtaskIndex: machineContext.current_subtask_index ?? 0,
      requiresPlanReview: machineContext.requires_plan_review ?? false,
      paused_snapshot: machineContext.paused_snapshot ? {
        from_state: machineContext.paused_snapshot.from_state as XStateValue,
        subtask_index: machineContext.paused_snapshot.subtask_index,
        paused_at: machineContext.paused_snapshot.paused_at,
      } : undefined,
    } : undefined;

    // Use the corrected getNextState function that properly handles
    // state restoration before computing transitions
    return getNextState(normalizedState, { type: eventType } as TaskMachineEvent, xstateContext);
  }

  /**
   * Compute review reason based on event type
   */
  private computeReviewReason(event: TaskEvent, task: UnifiedTask): UnifiedTask["review_reason"] {
    switch (event.type) {
      case "CHECK_PASSED":
        return "completed";
      case "USER_STOPPED":
        return "stopped";
      case "PLAN_COMPLETE":
        // Only set if going to review (requiresPlanReview)
        return task.metadata?.agent_config?.thinking_level === "high" ? "plan_review" : task.review_reason;
      case "CHECK_FAILED":
        return "qa_rejected";
      default:
        return task.review_reason;
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
    return (task.last_event?.sequence ?? 0) + 1;
  }

  /**
   * Get the event history for a task
   *
   * Reads from events.jsonl file. If the file doesn't exist, falls back to
   * task.json eventHistory for backward compatibility (and migrates inline).
   *
   * @param taskDir - Absolute path to task directory
   * @param since - Optional sequence number to start from
   * @returns Array of events since the given sequence
   */
  async getEventHistory(taskDir: string, since?: number): Promise<TaskEvent[]> {
    const eventsPath = join(taskDir, EVENTS_FILE);

    // Try to read from events.jsonl first
    if (existsSync(eventsPath)) {
      const events = await this.readEventsFromJsonl(eventsPath);
      if (since === undefined) {
        return events;
      }
      return events.filter((e) => e.sequence > since);
    }

    // Fall back to task.json eventHistory for backward compatibility
    const task = await taskService.getTask(taskDir);
    if (!task || !task.event_history || task.event_history.length === 0) {
      return [];
    }

    // Migrate legacy eventHistory to events.jsonl inline
    try {
      const content = task.event_history.map((e) => JSON.stringify(e)).join("\n") + "\n";
      await writeFile(eventsPath, content, "utf-8");
      console.log(`[TaskEventStore] Migrated ${task.event_history.length} events to events.jsonl`);
    } catch (error) {
      console.error(`[TaskEventStore] Failed to migrate event history:`, error);
    }

    // Return the events (filter by since if specified)
    if (since === undefined) {
      return task.event_history;
    }
    return task.event_history.filter((e) => e.sequence > since);
  }

  /**
   * Read events from events.jsonl file
   *
   * @param eventsPath - Absolute path to events.jsonl file
   * @returns Array of events
   */
  private async readEventsFromJsonl(eventsPath: string): Promise<TaskEvent[]> {
    try {
      const content = await readFile(eventsPath, "utf-8");
      const lines = content.trim().split("\n").filter((line) => line.trim());

      const events: TaskEvent[] = [];
      for (const line of lines) {
        try {
          const event = JSON.parse(line) as TaskEvent;
          events.push(event);
        } catch {
          // Skip malformed lines
          console.warn(`[TaskEventStore] Skipping malformed event line: ${line.substring(0, 50)}...`);
        }
      }

      return events;
    } catch (error) {
      console.error(`[TaskEventStore] Error reading events.jsonl:`, error);
      return [];
    }
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
    const expectedSeq = (task.last_event?.sequence ?? 0) + 1;
    if (event.sequence !== expectedSeq) {
      return {
        success: false,
        error: "SEQUENCE_MISMATCH",
        expected: expectedSeq,
        received: event.sequence,
      };
    }

    // Validate state transition
    const currentXState = task.xstate_state ?? "backlog";
    const transitionResult = this.computeTransition(currentXState, event.type, task.machine_context);

    // Check if transition is valid (same logic as applyEvent)
    const isSelfTransition = this.isSelfTransitionEvent(event.type);
    const isValidSelfTransition = isSelfTransition && this.isValidSelfTransition(currentXState, event.type);

    if (!transitionResult.changed && !isValidSelfTransition) {
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

  // ==========================================================================
  // Self-Transition Helpers
  // ==========================================================================

  /**
   * Events that are valid self-transitions (stay in same state with actions)
   * These events have `reenter: true` in the XState machine definition
   */
  private static readonly SELF_TRANSITION_EVENTS = new Set(["SUBTASK_COMPLETE"]);

  /**
   * Valid states for each self-transition event
   * Maps event type to the XState value(s) where it's valid
   */
  private static readonly SELF_TRANSITION_VALID_STATES: Record<string, XStateValue[]> = {
    SUBTASK_COMPLETE: [{ in_progress: "implement" }],
  };

  /**
   * Check if an event type is a known self-transition event
   */
  private isSelfTransitionEvent(eventType: string): boolean {
    return TaskEventStore.SELF_TRANSITION_EVENTS.has(eventType);
  }

  /**
   * Check if a self-transition is valid for the current state
   */
  private isValidSelfTransition(currentState: XStateValue, eventType: string): boolean {
    const validStates = TaskEventStore.SELF_TRANSITION_VALID_STATES[eventType];
    if (!validStates) return false;

    // Normalize current state for comparison
    const normalizedCurrent = this.normalizeXStateValue(currentState);

    return validStates.some((validState) => {
      if (typeof validState === "string" && typeof normalizedCurrent === "string") {
        return validState === normalizedCurrent;
      }
      if (typeof validState === "object" && typeof normalizedCurrent === "object") {
        return JSON.stringify(validState) === JSON.stringify(normalizedCurrent);
      }
      return false;
    });
  }
}

/**
 * Singleton event store instance
 */
export const taskEventStore = new TaskEventStore();

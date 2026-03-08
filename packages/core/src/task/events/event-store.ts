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
import { taskService, type UnifiedTask, type TaskEvent } from "../../services/task-service";
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

    // 6. Append event to events.jsonl (new storage format)
    await this.appendEvent(taskDir, event);

    // 7. Build update payload
    const updatePayload: Parameters<typeof taskService.updateTask>[1] = {
      status: newStatus,
      xstateState: transitionResult.value,
      lastEvent: event,
      // Note: eventHistory is no longer stored in task.json
      // Events are stored in events.jsonl for append-only efficiency
      // Also update reviewReason if transitioning to human_review
      reviewReason: this.computeReviewReason(event, task),
    };

    // 8. Set queuedAt timestamp when QUEUE event is applied (for FIFO ordering)
    // @see .trellis/spec/modules/task-system.md - 调度信息
    if (event.type === "QUEUE") {
      updatePayload.queuedAt = event.timestamp;
    }

    // 9. Update task.json with new state
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
   * Normalize legacy XState values to new state names
   * Maps: done -> completed, error -> failed, pr_created -> completed
   */
  private normalizeXStateValue(value: XStateValue): XStateValue {
    if (typeof value === "string") {
      switch (value) {
        case "done":
        case "pr_created":
          return "completed";
        case "error":
          return "failed";
        default:
          return value;
      }
    }
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
    eventType: string
  ): { value: XStateValue; changed: boolean } {
    // Normalize legacy state names before computing transition
    const normalizedState = this.normalizeXStateValue(currentState);

    // Use the corrected getNextState function that properly handles
    // state restoration before computing transitions
    return getNextState(normalizedState, { type: eventType } as TaskMachineEvent);
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
    if (!task || !task.eventHistory || task.eventHistory.length === 0) {
      return [];
    }

    // Migrate legacy eventHistory to events.jsonl inline
    try {
      const content = task.eventHistory.map((e) => JSON.stringify(e)).join("\n") + "\n";
      await writeFile(eventsPath, content, "utf-8");
      console.log(`[TaskEventStore] Migrated ${task.eventHistory.length} events to events.jsonl`);
    } catch (error) {
      console.error(`[TaskEventStore] Failed to migrate event history:`, error);
    }

    // Return the events (filter by since if specified)
    if (since === undefined) {
      return task.eventHistory;
    }
    return task.eventHistory.filter((e) => e.sequence > since);
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

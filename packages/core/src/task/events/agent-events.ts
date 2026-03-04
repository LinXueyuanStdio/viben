/**
 * Agent Event Emission
 *
 * Helper functions for emitting task state machine events from agent execution.
 * These hooks are called by the queue worker and agent-run routes when
 * agent execution reaches certain milestones.
 */

import { taskService } from "../../services/task-service";
import { taskEventStore } from "./event-store";
import { createTaskEvent } from "./task-event";
import { eventService } from "../../services/events";
import type { TaskEventType } from "./event-types";

// =============================================================================
// Types
// =============================================================================

/**
 * Agent event emission options
 */
export interface AgentEventOptions {
  /** Workspace path (required to find the task) */
  workspacePath: string;
  /** Task ID to emit event for */
  taskId: string;
  /** Additional payload data */
  payload?: Record<string, unknown>;
}

/**
 * Agent event emission result
 */
export interface AgentEventResult {
  /** Whether the event was successfully emitted */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** New task state after event */
  newState?: string;
}

// =============================================================================
// Agent Event Emitter
// =============================================================================

/**
 * Service for emitting task state machine events from agent execution
 *
 * This bridges the gap between agent execution and the task state machine.
 * When an agent reaches certain milestones (planning complete, subtask done, etc.),
 * the corresponding state machine event should be emitted.
 */
export class AgentEventEmitter {
  /**
   * Emit a task state machine event
   *
   * @param eventType - The event type to emit
   * @param options - Event options (workspace, task ID, payload)
   * @returns Event emission result
   */
  async emit(
    eventType: TaskEventType,
    options: AgentEventOptions
  ): Promise<AgentEventResult> {
    const { workspacePath, taskId, payload } = options;

    try {
      // Find the task directory
      const taskDir = await taskService.findTaskById(workspacePath, taskId);
      if (!taskDir) {
        return {
          success: false,
          error: `Task not found: ${taskId}`,
        };
      }

      // Get the task to determine next sequence number
      const task = await taskService.getTask(taskDir);
      if (!task) {
        return {
          success: false,
          error: `Failed to load task: ${taskId}`,
        };
      }

      // Create and apply the event
      const nextSeq = (task.lastEvent?.sequence ?? 0) + 1;
      const event = createTaskEvent(eventType, nextSeq, payload);

      const result = await taskEventStore.applyEvent(taskDir, event);

      if (result.success) {
        // Broadcast the event via EventService
        eventService.broadcast({
          type: "task_event_applied",
          data: {
            task_id: taskId,
            workspace_path: workspacePath,
            event_id: event.eventId,
            event_type: eventType,
            sequence: nextSeq,
            new_state: result.newState || "unknown",
            timestamp: Date.now(),
          },
        });

        console.log(
          `[AgentEventEmitter] Event ${eventType} applied to task ${taskId} (seq: ${nextSeq})`
        );

        return {
          success: true,
          newState: result.newState,
        };
      }

      return {
        success: false,
        error: result.error || "Unknown error",
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[AgentEventEmitter] Failed to emit ${eventType}:`, errorMessage);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  // ===========================================================================
  // Convenience Methods for Common Events
  // ===========================================================================

  /**
   * Emit when agent starts executing (QUEUE -> START transition)
   */
  async emitAgentStarted(options: AgentEventOptions): Promise<AgentEventResult> {
    return this.emit("START", options);
  }

  /**
   * Emit when planning phase completes
   */
  async emitPlanningComplete(
    options: AgentEventOptions & { requiresReview?: boolean }
  ): Promise<AgentEventResult> {
    return this.emit("PLANNING_COMPLETE", {
      ...options,
      payload: {
        ...options.payload,
        requiresReview: options.requiresReview ?? false,
      },
    });
  }

  /**
   * Emit when planning phase fails
   */
  async emitPlanningFailed(
    options: AgentEventOptions & { errorMessage?: string }
  ): Promise<AgentEventResult> {
    return this.emit("PLANNING_FAILED", {
      ...options,
      payload: {
        ...options.payload,
        errorMessage: options.errorMessage,
      },
    });
  }

  /**
   * Emit when a subtask is completed
   */
  async emitSubtaskComplete(
    options: AgentEventOptions & { subtaskId: string; subtaskName?: string }
  ): Promise<AgentEventResult> {
    return this.emit("SUBTASK_COMPLETE", {
      ...options,
      payload: {
        ...options.payload,
        subtaskId: options.subtaskId,
        subtaskName: options.subtaskName,
      },
    });
  }

  /**
   * Emit when all subtasks are done (triggers QA review)
   */
  async emitAllSubtasksDone(options: AgentEventOptions): Promise<AgentEventResult> {
    return this.emit("ALL_SUBTASKS_DONE", options);
  }

  /**
   * Emit when coding phase fails
   */
  async emitCodingFailed(
    options: AgentEventOptions & { errorMessage?: string }
  ): Promise<AgentEventResult> {
    return this.emit("CODING_FAILED", {
      ...options,
      payload: {
        ...options.payload,
        errorMessage: options.errorMessage,
      },
    });
  }

  /**
   * Emit when QA review passes
   */
  async emitQAPassed(options: AgentEventOptions): Promise<AgentEventResult> {
    return this.emit("QA_PASSED", options);
  }

  /**
   * Emit when QA review fails (triggers QA fixing)
   */
  async emitQAFailed(
    options: AgentEventOptions & { issues?: string[] }
  ): Promise<AgentEventResult> {
    return this.emit("QA_FAILED", {
      ...options,
      payload: {
        ...options.payload,
        issues: options.issues,
      },
    });
  }

  /**
   * Emit when QA fixing completes
   */
  async emitQAFixingComplete(options: AgentEventOptions): Promise<AgentEventResult> {
    return this.emit("QA_FIXING_COMPLETE", options);
  }

  /**
   * Emit when QA fixing fails
   */
  async emitQAFixingFailed(
    options: AgentEventOptions & { errorMessage?: string }
  ): Promise<AgentEventResult> {
    return this.emit("QA_FIXING_FAILED", {
      ...options,
      payload: {
        ...options.payload,
        errorMessage: options.errorMessage,
      },
    });
  }

  /**
   * Emit when user stops the agent
   */
  async emitUserStopped(
    options: AgentEventOptions & { reason?: string }
  ): Promise<AgentEventResult> {
    return this.emit("USER_STOPPED", {
      ...options,
      payload: {
        ...options.payload,
        reason: options.reason ?? "user_requested",
      },
    });
  }

  /**
   * Emit when task is approved in human review
   */
  async emitApproved(options: AgentEventOptions): Promise<AgentEventResult> {
    return this.emit("APPROVED", options);
  }

  /**
   * Emit when task is rejected in human review
   */
  async emitRejected(
    options: AgentEventOptions & { feedback?: string }
  ): Promise<AgentEventResult> {
    return this.emit("REJECTED", {
      ...options,
      payload: {
        ...options.payload,
        feedback: options.feedback,
      },
    });
  }

  /**
   * Emit when PR is created
   */
  async emitCreatePR(
    options: AgentEventOptions & { prUrl?: string; prNumber?: number }
  ): Promise<AgentEventResult> {
    return this.emit("CREATE_PR", {
      ...options,
      payload: {
        ...options.payload,
        prUrl: options.prUrl,
        prNumber: options.prNumber,
      },
    });
  }

  /**
   * Emit when retrying after error
   */
  async emitRetry(
    options: AgentEventOptions & { retryCount?: number }
  ): Promise<AgentEventResult> {
    return this.emit("RETRY", {
      ...options,
      payload: {
        ...options.payload,
        retryCount: options.retryCount,
      },
    });
  }

  /**
   * Emit when abandoning after error
   */
  async emitAbandon(
    options: AgentEventOptions & { reason?: string }
  ): Promise<AgentEventResult> {
    return this.emit("ABANDON", {
      ...options,
      payload: {
        ...options.payload,
        reason: options.reason,
      },
    });
  }
}

/**
 * Singleton agent event emitter instance
 */
export const agentEventEmitter = new AgentEventEmitter();

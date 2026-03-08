/**
 * Task Events Gateway Routes
 *
 * API endpoints for task state machine events:
 * - POST /api/tasks/:task_id/events - Submit an event
 * - GET /api/tasks/:task_id/events/stream - SSE subscription (single task, backward compatible)
 * - GET /api/tasks/:task_id/state - Get current state
 * - GET /api/tasks/events/stream - Global or batch SSE subscription
 */

import type { FastifyInstance } from "fastify";
import { taskService } from "../../services/task-service";
import { taskEventStore } from "../../task/events/event-store";
import { taskSSEManager } from "../sse/task-sse-manager";
import type { TaskEvent } from "../../task/events/task-event";
import { isValidEventType } from "../../task/events/event-types";

// =============================================================================
// Types
// =============================================================================

interface TaskIdParams {
  task_id: string;
}

interface WorkspaceQuery {
  workspace_path?: string;
}

interface EventsQuery extends WorkspaceQuery {
  since?: string;
}

interface StreamQuery extends WorkspaceQuery {
  /** Comma-separated task IDs for batch subscription */
  task_ids?: string;
  /** Last received sequence number for event replay on reconnect */
  last_sequence?: string;
}

interface SingleTaskStreamQuery extends WorkspaceQuery {
  /** Last received sequence number for event replay on reconnect */
  last_sequence?: string;
}

// =============================================================================
// Route Registration
// =============================================================================

/**
 * Register task event routes
 */
export function registerTaskEventRoutes(fastify: FastifyInstance): void {
  // ==========================================================================
  // GET /api/tasks/events/stream - Global or batch SSE subscription
  // This must be registered BEFORE routes with :task_id to avoid conflicts
  //
  // Usage:
  // - Global subscription (all tasks in workspace):
  //   GET /api/tasks/events/stream?workspace_path=/path/to/workspace
  //
  // - Batch subscription (specific tasks):
  //   GET /api/tasks/events/stream?workspace_path=/path/to/workspace&task_ids=id1,id2,id3
  //
  // - Event replay on reconnect:
  //   GET /api/tasks/events/stream?workspace_path=/path&last_sequence=5
  //   (sends all events with sequence > 5 before starting real-time streaming)
  // ==========================================================================
  fastify.get<{
    Querystring: StreamQuery;
  }>("/api/tasks/events/stream", async (request, reply) => {
    const { workspace_path, task_ids, last_sequence } = request.query;

    // Validate workspace_path
    if (!workspace_path) {
      return reply.status(400).send({
        error: "workspace_path required",
        code: "MISSING_WORKSPACE_PATH",
      });
    }

    // Parse task IDs if provided (for batch subscription)
    const taskIdList = task_ids
      ? task_ids.split(",").map((id) => id.trim()).filter(Boolean)
      : [];

    // Determine subscription type
    const isBatchSubscription = taskIdList.length > 0;

    // Parse last_sequence for event replay
    const lastSeq = last_sequence ? parseInt(last_sequence, 10) : undefined;

    // Set SSE headers
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "X-Accel-Buffering": "no",
    });

    // Event replay: send missed events before real-time streaming
    if (lastSeq !== undefined && !isNaN(lastSeq)) {
      try {
        if (isBatchSubscription) {
          // For batch subscription, replay events from each task
          for (const taskId of taskIdList) {
            const taskDir = await taskService.findTaskById(workspace_path, taskId);
            if (taskDir) {
              const missedEvents = await taskEventStore.getEventHistory(taskDir, lastSeq);
              for (const event of missedEvents) {
                const replayEvent = {
                  type: "STATE_CHANGED" as const,
                  task_id: taskId,
                  workspace_path,
                  timestamp: new Date(event.timestamp).getTime(),
                  event,
                  replay: true, // Mark as replayed event
                };
                reply.raw.write(`event: STATE_CHANGED\ndata: ${JSON.stringify(replayEvent)}\n\n`);
              }
            }
          }
        } else {
          // For workspace subscription, replay events from all tasks
          const tasks = await taskService.listTasks(workspace_path);
          for (const task of tasks) {
            const taskDir = await taskService.findTaskById(workspace_path, task.id);
            if (taskDir) {
              const missedEvents = await taskEventStore.getEventHistory(taskDir, lastSeq);
              for (const event of missedEvents) {
                const replayEvent = {
                  type: "STATE_CHANGED" as const,
                  task_id: task.id,
                  workspace_path,
                  timestamp: new Date(event.timestamp).getTime(),
                  event,
                  replay: true, // Mark as replayed event
                };
                reply.raw.write(`event: STATE_CHANGED\ndata: ${JSON.stringify(replayEvent)}\n\n`);
              }
            }
          }
        }
      } catch (error) {
        console.error(`[SSE] Error replaying events:`, error);
        // Continue with connection even if replay fails
      }
    }

    // Send connected event (after replay)
    reply.raw.write(
      `event: connected\ndata: ${JSON.stringify({
        subscription_type: isBatchSubscription ? "batch" : "workspace",
        workspace_path,
        task_ids: isBatchSubscription ? taskIdList : undefined,
        last_sequence: lastSeq,
        timestamp: Date.now(),
      })}\n\n`
    );

    // Subscribe based on type
    let unsubscribe: () => void;

    if (isBatchSubscription) {
      // Batch subscription - specific tasks
      unsubscribe = taskSSEManager.subscribeTasks(taskIdList, (event) => {
        try {
          if (reply.raw.writableEnded || reply.raw.destroyed) {
            return false;
          }
          reply.raw.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
          return true;
        } catch {
          return false;
        }
      }, workspace_path);
    } else {
      // Workspace subscription - all tasks in workspace
      unsubscribe = taskSSEManager.subscribeWorkspace(workspace_path, (event) => {
        try {
          if (reply.raw.writableEnded || reply.raw.destroyed) {
            return false;
          }
          reply.raw.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
          return true;
        } catch {
          return false;
        }
      });
    }

    // Handle client disconnect
    request.raw.on("close", () => {
      unsubscribe();
    });

    // Keep connection open
    await new Promise<void>((resolve) => {
      request.raw.on("close", resolve);
    });
  });

  // ==========================================================================
  // POST /api/tasks/:task_id/events - Submit an event
  // ==========================================================================
  fastify.post<{
    Params: TaskIdParams;
    Querystring: WorkspaceQuery;
    Body: TaskEvent;
  }>("/api/tasks/:task_id/events", async (request, reply) => {
    const { task_id } = request.params;
    const { workspace_path } = request.query;

    // Validate workspace_path
    if (!workspace_path) {
      return reply.status(400).send({
        error: "workspace_path required",
        code: "MISSING_WORKSPACE_PATH",
      });
    }

    // Find task directory
    const taskDir = await taskService.findTaskById(workspace_path, task_id);
    if (!taskDir) {
      return reply.status(404).send({
        error: "Task not found",
        code: "TASK_NOT_FOUND",
        task_id,
      });
    }

    // Parse and validate event
    const event = request.body;

    if (!event.eventId || !event.type || event.sequence === undefined) {
      return reply.status(400).send({
        error: "Invalid event format",
        code: "INVALID_EVENT",
        required: ["eventId", "type", "sequence"],
      });
    }

    if (!isValidEventType(event.type)) {
      return reply.status(400).send({
        error: "Invalid event type",
        code: "INVALID_EVENT_TYPE",
        type: event.type,
      });
    }

    // Apply event
    const result = await taskEventStore.applyEvent(taskDir, event);

    if (!result.success) {
      // Return 409 Conflict for sequence/transition errors
      const statusCode = result.error === "TASK_NOT_FOUND" ? 404 : 409;

      return reply.status(statusCode).send({
        error: result.error,
        code: result.error,
        expected: result.expected,
        received: result.received,
        current_state: result.currentState,
      });
    }

    // Broadcast state change via SSE (with workspace_path for workspace-level subscribers)
    taskSSEManager.broadcast(
      task_id,
      {
        type: "STATE_CHANGED",
        event: event,
        new_state: result.newState,
      },
      workspace_path
    );

    return reply.status(200).send({
      success: true,
      new_state: result.newState,
      task_id,
    });
  });

  // ==========================================================================
  // GET /api/tasks/:task_id/events/stream - SSE subscription (single task)
  // Kept for backward compatibility - internally uses the same subscription mechanism
  //
  // Usage:
  // - Basic subscription:
  //   GET /api/tasks/:task_id/events/stream?workspace_path=/path
  //
  // - Event replay on reconnect:
  //   GET /api/tasks/:task_id/events/stream?workspace_path=/path&last_sequence=5
  // ==========================================================================
  fastify.get<{
    Params: TaskIdParams;
    Querystring: SingleTaskStreamQuery;
  }>("/api/tasks/:task_id/events/stream", async (request, reply) => {
    const { task_id } = request.params;
    const { workspace_path, last_sequence } = request.query;

    // Validate task exists (optional, allows subscribing before task is created)
    let taskDir: string | null = null;
    if (workspace_path) {
      taskDir = await taskService.findTaskById(workspace_path, task_id);
      if (!taskDir) {
        return reply.status(404).send({
          error: "Task not found",
          code: "TASK_NOT_FOUND",
          task_id,
        });
      }
    }

    // Parse last_sequence for event replay
    const lastSeq = last_sequence ? parseInt(last_sequence, 10) : undefined;

    // Set SSE headers
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "X-Accel-Buffering": "no",
    });

    // Event replay: send missed events before real-time streaming
    if (lastSeq !== undefined && !isNaN(lastSeq) && taskDir) {
      try {
        const missedEvents = await taskEventStore.getEventHistory(taskDir, lastSeq);
        for (const event of missedEvents) {
          const replayEvent = {
            type: "STATE_CHANGED" as const,
            task_id,
            workspace_path,
            timestamp: new Date(event.timestamp).getTime(),
            event,
            replay: true, // Mark as replayed event
          };
          reply.raw.write(`event: STATE_CHANGED\ndata: ${JSON.stringify(replayEvent)}\n\n`);
        }
      } catch (error) {
        console.error(`[SSE] Error replaying events for task ${task_id}:`, error);
        // Continue with connection even if replay fails
      }
    }

    // Send connected event (after replay)
    reply.raw.write(
      `event: connected\ndata: ${JSON.stringify({
        task_id,
        workspace_path,
        last_sequence: lastSeq,
        timestamp: Date.now(),
      })}\n\n`
    );

    // Subscribe to task events (with workspace_path for context)
    // The listener returns false when write fails, signaling dead connection
    const unsubscribe = taskSSEManager.subscribe(task_id, (event) => {
      try {
        // Check if the connection is still writable
        if (reply.raw.writableEnded || reply.raw.destroyed) {
          return false; // Signal that this subscriber is dead
        }
        reply.raw.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
        return true; // Signal successful delivery
      } catch {
        // Connection closed or write error
        return false; // Signal that this subscriber is dead
      }
    }, workspace_path);

    // Handle client disconnect
    request.raw.on("close", () => {
      unsubscribe();
    });

    // Keep connection open
    await new Promise<void>((resolve) => {
      request.raw.on("close", resolve);
    });
  });

  // ==========================================================================
  // GET /api/tasks/:task_id/state - Get current state
  // ==========================================================================
  fastify.get<{
    Params: TaskIdParams;
    Querystring: WorkspaceQuery;
  }>("/api/tasks/:task_id/state", async (request, reply) => {
    const { task_id } = request.params;
    const { workspace_path } = request.query;

    // Validate workspace_path
    if (!workspace_path) {
      return reply.status(400).send({
        error: "workspace_path required",
        code: "MISSING_WORKSPACE_PATH",
      });
    }

    // Find task
    const taskDir = await taskService.findTaskById(workspace_path, task_id);
    if (!taskDir) {
      return reply.status(404).send({
        error: "Task not found",
        code: "TASK_NOT_FOUND",
        task_id,
      });
    }

    const task = await taskService.getTask(taskDir);
    if (!task) {
      return reply.status(404).send({
        error: "Task not found",
        code: "TASK_NOT_FOUND",
        task_id,
      });
    }

    return reply.status(200).send({
      task_id,
      status: task.status,
      xstate_state: task.xstateState ?? "backlog",
      last_event: task.lastEvent,
      review_reason: task.reviewReason,
      execution_progress: task.executionProgress,
      next_sequence: (task.lastEvent?.sequence ?? 0) + 1,
    });
  });

  // ==========================================================================
  // GET /api/tasks/:task_id/events - Get event history
  // ==========================================================================
  fastify.get<{
    Params: TaskIdParams;
    Querystring: EventsQuery;
  }>("/api/tasks/:task_id/events", async (request, reply) => {
    const { task_id } = request.params;
    const { workspace_path, since } = request.query;

    // Validate workspace_path
    if (!workspace_path) {
      return reply.status(400).send({
        error: "workspace_path required",
        code: "MISSING_WORKSPACE_PATH",
      });
    }

    // Find task
    const taskDir = await taskService.findTaskById(workspace_path, task_id);
    if (!taskDir) {
      return reply.status(404).send({
        error: "Task not found",
        code: "TASK_NOT_FOUND",
        task_id,
      });
    }

    // Get event history
    const sinceSeq = since ? parseInt(since, 10) : undefined;
    const events = await taskEventStore.getEventHistory(taskDir, sinceSeq);

    return reply.status(200).send({
      task_id,
      events,
      count: events.length,
      next_sequence: await taskEventStore.getNextSequence(taskDir),
    });
  });

  // ==========================================================================
  // POST /api/tasks/:task_id/events/validate - Validate event (dry-run)
  // ==========================================================================
  fastify.post<{
    Params: TaskIdParams;
    Querystring: WorkspaceQuery;
    Body: TaskEvent;
  }>("/api/tasks/:task_id/events/validate", async (request, reply) => {
    const { task_id } = request.params;
    const { workspace_path } = request.query;

    // Validate workspace_path
    if (!workspace_path) {
      return reply.status(400).send({
        error: "workspace_path required",
        code: "MISSING_WORKSPACE_PATH",
      });
    }

    // Find task
    const taskDir = await taskService.findTaskById(workspace_path, task_id);
    if (!taskDir) {
      return reply.status(404).send({
        error: "Task not found",
        code: "TASK_NOT_FOUND",
        task_id,
      });
    }

    // Validate event
    const event = request.body;
    const result = await taskEventStore.validateEvent(taskDir, event);

    if (!result.success) {
      return reply.status(409).send({
        valid: false,
        error: result.error,
        expected: result.expected,
        received: result.received,
        current_state: result.currentState,
      });
    }

    return reply.status(200).send({
      valid: true,
      would_transition_to: result.newState,
    });
  });
}

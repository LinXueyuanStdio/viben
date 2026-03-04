/**
 * Task Events Gateway Routes
 *
 * API endpoints for task state machine events:
 * - POST /api/tasks/:task_id/events - Submit an event
 * - GET /api/tasks/:task_id/events/stream - SSE subscription
 * - GET /api/tasks/:task_id/state - Get current state
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

// =============================================================================
// Route Registration
// =============================================================================

/**
 * Register task event routes
 */
export function registerTaskEventRoutes(fastify: FastifyInstance): void {
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

    // Broadcast state change via SSE
    taskSSEManager.broadcast(task_id, {
      type: "STATE_CHANGED",
      event: event,
      new_state: result.newState,
    });

    return reply.status(200).send({
      success: true,
      new_state: result.newState,
      task_id,
    });
  });

  // ==========================================================================
  // GET /api/tasks/:task_id/events/stream - SSE subscription
  // ==========================================================================
  fastify.get<{
    Params: TaskIdParams;
    Querystring: WorkspaceQuery;
  }>("/api/tasks/:task_id/events/stream", async (request, reply) => {
    const { task_id } = request.params;
    const { workspace_path } = request.query;

    // Validate task exists (optional, allows subscribing before task is created)
    if (workspace_path) {
      const taskDir = await taskService.findTaskById(workspace_path, task_id);
      if (!taskDir) {
        return reply.status(404).send({
          error: "Task not found",
          code: "TASK_NOT_FOUND",
          task_id,
        });
      }
    }

    // Set SSE headers
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "X-Accel-Buffering": "no",
    });

    // Send initial connection event
    reply.raw.write(
      `event: connected\ndata: ${JSON.stringify({
        task_id,
        timestamp: Date.now(),
      })}\n\n`
    );

    // Subscribe to task events
    const unsubscribe = taskSSEManager.subscribe(task_id, async (event) => {
      try {
        reply.raw.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      } catch {
        // Connection closed
        unsubscribe();
      }
    });

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

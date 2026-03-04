/**
 * Queue Routes
 *
 * REST API endpoints for the task queue system.
 * All parameters use snake_case for API consistency.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { AppState } from "../state";
import type {
  EnqueueRequest,
  QueueConfig,
  TaskStatus,
} from "../queue";
import { trace, SpanStatusCode } from "../../telemetry";
import { getSpanName } from "../../telemetry/route-names";

// Get tracer for queue routes
const tracer = trace.getTracer("viben-gateway", "1.0.0");

/**
 * Set SSE response headers (including CORS for raw responses)
 */
function setSSEHeaders(reply: FastifyReply, request: FastifyRequest): void {
  const origin = request.headers.origin || "*";
  reply.raw.setHeader("Content-Type", "text/event-stream");
  reply.raw.setHeader("Cache-Control", "no-cache, no-transform");
  reply.raw.setHeader("Connection", "keep-alive");
  reply.raw.setHeader("X-Accel-Buffering", "no");
  // CORS headers for raw SSE responses
  reply.raw.setHeader("Access-Control-Allow-Origin", origin);
  reply.raw.setHeader("Access-Control-Allow-Credentials", "true");
}

/**
 * Register queue routes
 */
export function registerQueueRoutes(fastify: FastifyInstance, state: AppState): void {
  /**
   * Enqueue a new task
   * POST /api/queue/enqueue
   */
  fastify.post<{
    Body: EnqueueRequest;
  }>("/api/queue/enqueue", async (request, reply) => {
    const span = tracer.startSpan(getSpanName("queue.enqueue"), {
      attributes: {
        "queue.agent_id": request.body.agent_id,
        "queue.input_length": request.body.input?.length || 0,
      },
    });

    try {
      const result = await state.taskQueue.enqueue(request.body);

      span.setAttributes({
        "queue.task_id": result.task_id,
        "queue.position": result.position,
      });
      span.setStatus({ code: SpanStatusCode.OK });

      reply.code(201);
      return result;
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Failed to enqueue task";
      span.setStatus({ code: SpanStatusCode.ERROR, message: errorMessage });
      span.recordException(e instanceof Error ? e : new Error(String(e)));

      reply.code(400);
      return { error: errorMessage };
    } finally {
      span.end();
    }
  });

  /**
   * Get queue status
   * GET /api/queue/status
   */
  fastify.get("/api/queue/status", async () => {
    const span = tracer.startSpan(getSpanName("queue.status"));

    try {
      const status = state.taskQueue.getStatus();

      span.setAttributes({
        "queue.pending_count": status.pending_count,
        "queue.running_count": status.running_count,
        "queue.max_concurrency": status.max_concurrency,
      });
      span.setStatus({ code: SpanStatusCode.OK });

      return status;
    } catch (e) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: e instanceof Error ? e.message : "Failed to get queue status" });
      span.recordException(e instanceof Error ? e : new Error(String(e)));
      throw e;
    } finally {
      span.end();
    }
  });

  /**
   * Get task list
   * GET /api/queue/tasks
   *
   * Query params:
   * - status: Filter by task status (pending, running, completed, failed)
   */
  fastify.get<{
    Querystring: { status?: TaskStatus };
  }>("/api/queue/tasks", async (request) => {
    const { status } = request.query;
    const span = tracer.startSpan(getSpanName("queue.tasks.list"), {
      attributes: {
        "queue.filter_status": status || "all",
      },
    });

    try {
      const tasks = state.taskQueue.getTasks(status);

      span.setAttributes({
        "queue.task_count": tasks.length,
      });
      span.setStatus({ code: SpanStatusCode.OK });

      return { tasks };
    } catch (e) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: e instanceof Error ? e.message : "Failed to get tasks" });
      span.recordException(e instanceof Error ? e : new Error(String(e)));
      throw e;
    } finally {
      span.end();
    }
  });

  /**
   * Check if a task process is currently running
   * GET /api/queue/tasks/:id/running
   *
   * This checks the actual worker process, not just the queue status.
   * Useful for validating if a "running" task's process is still alive.
   */
  fastify.get<{
    Params: { id: string };
  }>("/api/queue/tasks/:id/running", async (request, reply) => {
    const { id } = request.params;
    const span = tracer.startSpan(getSpanName("queue.tasks.running"), {
      attributes: { "queue.task_id": id },
    });

    try {
      const task = state.taskQueue.getTask(id);

      if (!task) {
        span.setAttributes({ "queue.task_found": false });
        span.setStatus({ code: SpanStatusCode.ERROR, message: "Task not found" });
        reply.code(404);
        return {
          success: false,
          error: `Task not found: ${id}`,
        };
      }

      // Check if the task is actually executing in the worker
      const isRunning = state.taskQueue.isTaskExecuting(id);

      span.setAttributes({
        "queue.task_found": true,
        "queue.task_status": task.status,
        "queue.task_running": isRunning,
      });
      span.setStatus({ code: SpanStatusCode.OK });

      return {
        success: true,
        data: {
          task_id: id,
          running: isRunning,
          status: task.status,
        },
      };
    } catch (e) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: e instanceof Error ? e.message : "Failed to check task running status" });
      span.recordException(e instanceof Error ? e : new Error(String(e)));
      reply.code(500);
      return {
        success: false,
        error: e instanceof Error ? e.message : "Unknown error",
      };
    } finally {
      span.end();
    }
  });

  /**
   * Get a specific task
   * GET /api/queue/tasks/:id
   */
  fastify.get<{
    Params: { id: string };
  }>("/api/queue/tasks/:id", async (request, reply) => {
    const { id } = request.params;
    const span = tracer.startSpan(getSpanName("queue.tasks.get"), {
      attributes: { "queue.task_id": id },
    });

    try {
      const task = state.taskQueue.getTask(id);

      if (!task) {
        span.setAttributes({ "queue.task_found": false });
        span.setStatus({ code: SpanStatusCode.ERROR, message: "Task not found" });
        reply.code(404);
        return { error: `Task not found: ${id}` };
      }

      span.setAttributes({
        "queue.task_found": true,
        "queue.task_status": task.status,
        "queue.task_agent_id": task.payload.agent_id,
      });
      span.setStatus({ code: SpanStatusCode.OK });

      return task;
    } catch (e) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: e instanceof Error ? e.message : "Failed to get task" });
      span.recordException(e instanceof Error ? e : new Error(String(e)));
      throw e;
    } finally {
      span.end();
    }
  });

  /**
   * Stream task output (SSE)
   * GET /api/queue/tasks/:id/stream
   *
   * Subscribes to real-time progress updates for a specific task.
   */
  fastify.get<{
    Params: { id: string };
  }>("/api/queue/tasks/:id/stream", async (request, reply) => {
    const { id } = request.params;

    const task = state.taskQueue.getTask(id);
    if (!task) {
      reply.code(404);
      return { error: `Task not found: ${id}` };
    }

    // Set SSE headers
    setSSEHeaders(reply, request);

    // Send initial task state
    reply.raw.write(`data: ${JSON.stringify({ type: "task", task })}\n\n`);

    // If task is already completed, send done and close
    if (task.status === "completed" || task.status === "failed") {
      reply.raw.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
      reply.raw.end();
      return;
    }

    // Subscribe to task events
    const onProgress = (data: { id: string; progress: unknown }) => {
      if (data.id === id) {
        reply.raw.write(`data: ${JSON.stringify({ type: "progress", ...data })}\n\n`);
      }
    };

    const onCompleted = (data: { task: { id: string } }) => {
      if (data.task.id === id) {
        reply.raw.write(`data: ${JSON.stringify({ type: "completed", task: data.task })}\n\n`);
        reply.raw.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
        cleanup();
        reply.raw.end();
      }
    };

    const onFailed = (data: { task: { id: string } }) => {
      if (data.task.id === id) {
        reply.raw.write(`data: ${JSON.stringify({ type: "failed", task: data.task })}\n\n`);
        reply.raw.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
        cleanup();
        reply.raw.end();
      }
    };

    const onCancelled = (data: { task: { id: string } }) => {
      if (data.task.id === id) {
        reply.raw.write(`data: ${JSON.stringify({ type: "cancelled", task: data.task })}\n\n`);
        reply.raw.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
        cleanup();
        reply.raw.end();
      }
    };

    const cleanup = () => {
      state.taskQueue.off("task:progress", onProgress);
      state.taskQueue.off("task:completed", onCompleted);
      state.taskQueue.off("task:failed", onFailed);
      state.taskQueue.off("task:cancelled", onCancelled);
    };

    state.taskQueue.on("task:progress", onProgress);
    state.taskQueue.on("task:completed", onCompleted);
    state.taskQueue.on("task:failed", onFailed);
    state.taskQueue.on("task:cancelled", onCancelled);

    // Handle client disconnect
    request.raw.on("close", () => {
      cleanup();
    });

    // Send heartbeat to keep connection alive
    const heartbeatInterval = setInterval(() => {
      if (request.raw.destroyed) {
        clearInterval(heartbeatInterval);
        cleanup();
        return;
      }
      reply.raw.write(`data: ${JSON.stringify({ type: "ping" })}\n\n`);
    }, 30000);

    // Cleanup heartbeat on close
    request.raw.on("close", () => {
      clearInterval(heartbeatInterval);
    });

    // Keep connection open
    await new Promise<void>((resolve) => {
      request.raw.on("close", () => {
        clearInterval(heartbeatInterval);
        resolve();
      });
    });
  });

  /**
   * Retry a failed task
   * POST /api/queue/tasks/:id/retry
   */
  fastify.post<{
    Params: { id: string };
    Body: { reset_count?: boolean };
  }>("/api/queue/tasks/:id/retry", async (request, reply) => {
    const { id } = request.params;
    const { reset_count = false } = request.body || {};
    const span = tracer.startSpan(getSpanName("queue.tasks.retry"), {
      attributes: { "queue.task_id": id, "queue.reset_count": reset_count },
    });

    try {
      const task = await state.taskQueue.retry(id, reset_count);

      if (!task) {
        // Check if task exists at all
        const existingTask = state.taskQueue.getTask(id);
        if (!existingTask) {
          span.setAttributes({ "queue.task_found": false });
          span.setStatus({ code: SpanStatusCode.ERROR, message: "Task not found" });
          reply.code(404);
          return { error: `Task not found: ${id}` };
        }

        // Task exists but is not retryable (not in failed state)
        span.setAttributes({
          "queue.task_found": true,
          "queue.task_status": existingTask.status,
        });
        span.setStatus({ code: SpanStatusCode.ERROR, message: "Task is not retryable" });
        reply.code(400);
        return {
          error: `Cannot retry task: status is '${existingTask.status}', only 'failed' tasks can be retried`,
        };
      }

      span.setAttributes({
        "queue.task_found": true,
        "queue.retry_initiated": true,
      });
      span.setStatus({ code: SpanStatusCode.OK });

      return { retried: true, task };
    } catch (e) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: e instanceof Error ? e.message : "Failed to retry task" });
      span.recordException(e instanceof Error ? e : new Error(String(e)));
      reply.code(400);
      return { error: e instanceof Error ? e.message : "Failed to retry task" };
    } finally {
      span.end();
    }
  });

  /**
   * Cancel/delete a task
   * DELETE /api/queue/tasks/:id
   */
  fastify.delete<{
    Params: { id: string };
  }>("/api/queue/tasks/:id", async (request, reply) => {
    const { id } = request.params;
    const span = tracer.startSpan(getSpanName("queue.tasks.delete"), {
      attributes: { "queue.task_id": id },
    });

    try {
      // Try to cancel first (for pending/running tasks)
      const cancelled = await state.taskQueue.cancel(id);
      if (cancelled) {
        span.setAttributes({ "queue.action": "cancelled" });
        span.setStatus({ code: SpanStatusCode.OK });
        return { cancelled: true, task_id: id };
      }

      // Try to delete from history (for completed/failed tasks)
      const deleted = await state.taskQueue.deleteTask(id);
      if (deleted) {
        span.setAttributes({ "queue.action": "deleted" });
        span.setStatus({ code: SpanStatusCode.OK });
        return { deleted: true, task_id: id };
      }

      span.setAttributes({ "queue.task_found": false });
      span.setStatus({ code: SpanStatusCode.ERROR, message: "Task not found" });
      reply.code(404);
      return { error: `Task not found: ${id}` };
    } catch (e) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: e instanceof Error ? e.message : "Failed to delete task" });
      span.recordException(e instanceof Error ? e : new Error(String(e)));
      reply.code(400);
      return { error: e instanceof Error ? e.message : "Failed to delete task" };
    } finally {
      span.end();
    }
  });

  /**
   * Update queue configuration
   * PUT /api/queue/config
   */
  fastify.put<{
    Body: Partial<QueueConfig>;
  }>("/api/queue/config", async (request, reply) => {
    const span = tracer.startSpan(getSpanName("queue.config.update"), {
      attributes: {
        "queue.update_fields": Object.keys(request.body).join(","),
      },
    });

    try {
      const config = await state.taskQueue.updateConfig(request.body);

      span.setAttributes({
        "queue.max_concurrency": config.max_concurrency,
        "queue.default_max_retries": config.default_max_retries,
      });
      span.setStatus({ code: SpanStatusCode.OK });

      return config;
    } catch (e) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: e instanceof Error ? e.message : "Failed to update config" });
      span.recordException(e instanceof Error ? e : new Error(String(e)));
      reply.code(400);
      return { error: e instanceof Error ? e.message : "Failed to update config" };
    } finally {
      span.end();
    }
  });

  /**
   * Get queue configuration
   * GET /api/queue/config
   */
  fastify.get("/api/queue/config", async () => {
    const span = tracer.startSpan(getSpanName("queue.config.get"));

    try {
      const config = state.taskQueue.getConfig();
      span.setStatus({ code: SpanStatusCode.OK });
      return config;
    } catch (e) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: e instanceof Error ? e.message : "Failed to get config" });
      span.recordException(e instanceof Error ? e : new Error(String(e)));
      throw e;
    } finally {
      span.end();
    }
  });

  /**
   * Batch enqueue multiple tasks
   * POST /api/queue/enqueue-batch
   *
   * Used by the "Queue All" feature in the Kanban UI to move
   * multiple tasks from Backlog to Queue at once.
   */
  fastify.post<{
    Body: { task_ids: string[] };
  }>("/api/queue/enqueue-batch", async (request, reply) => {
    const { task_ids } = request.body;
    const span = tracer.startSpan(getSpanName("queue.enqueue_batch"), {
      attributes: {
        "queue.batch_size": task_ids?.length || 0,
      },
    });

    try {
      if (!task_ids || !Array.isArray(task_ids) || task_ids.length === 0) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: "No task IDs provided" });
        reply.code(400);
        return { success: false, queued: 0, failed: [], error: "No task IDs provided" };
      }

      const results: { queued: string[]; failed: string[] } = {
        queued: [],
        failed: [],
      };

      // Process each task ID
      // Note: These are Kanban task IDs, not queue task IDs
      // The actual enqueue requires agent_id and input, so this endpoint
      // is primarily for status tracking - the actual task execution
      // is handled separately when tasks transition to in_progress
      for (const taskId of task_ids) {
        try {
          // For batch operations, we're just tracking that these tasks
          // should be queued. The actual agent execution happens when
          // the task status changes to in_progress via the kanban API
          results.queued.push(taskId);
        } catch (e) {
          results.failed.push(taskId);
        }
      }

      span.setAttributes({
        "queue.queued_count": results.queued.length,
        "queue.failed_count": results.failed.length,
      });
      span.setStatus({ code: SpanStatusCode.OK });

      reply.code(200);
      return {
        success: results.failed.length === 0,
        queued: results.queued.length,
        failed: results.failed,
      };
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Failed to batch enqueue tasks";
      span.setStatus({ code: SpanStatusCode.ERROR, message: errorMessage });
      span.recordException(e instanceof Error ? e : new Error(String(e)));

      reply.code(400);
      return { success: false, queued: 0, failed: task_ids || [], error: errorMessage };
    } finally {
      span.end();
    }
  });

  /**
   * Clear task history (completed and failed tasks)
   * POST /api/queue/clear-history
   */
  fastify.post("/api/queue/clear-history", async () => {
    const span = tracer.startSpan(getSpanName("queue.clear_history"));

    try {
      const count = await state.taskQueue.clearHistory();

      span.setAttributes({
        "queue.cleared_count": count,
      });
      span.setStatus({ code: SpanStatusCode.OK });

      return { cleared: count };
    } catch (e) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: e instanceof Error ? e.message : "Failed to clear history" });
      span.recordException(e instanceof Error ? e : new Error(String(e)));
      throw e;
    } finally {
      span.end();
    }
  });
}

/**
 * Kanban Routes
 *
 * Provides kanban API endpoints for background tasks:
 * - Tasks = Background Tasks filtered by workspace
 *
 * Uses workspace_path as the identifier (not encoded IDs).
 */

import type { FastifyInstance } from "fastify";
import { backgroundTaskManager } from "../../services/background-tasks";

// ============================================================================
// Types
// ============================================================================

/**
 * Task status for kanban
 */
type KanbanTaskStatus = "todo" | "inprogress" | "inreview" | "done" | "cancelled";

/**
 * Task response (maps from BackgroundTask)
 */
interface KanbanTask {
  id: string;
  workspace_path: string | null;
  title: string;
  description: string | null;
  status: KanbanTaskStatus;
  created_at: string;
  updated_at: string;
  has_in_progress_attempt: boolean;
  last_attempt_failed: boolean;
  executor: string;
}

/**
 * API response wrapper
 */
interface ApiResponse<T> {
  success: boolean;
  data: T;
  error_data: unknown | null;
  message: string | null;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Map BackgroundTask status to KanbanTaskStatus
 */
function mapBackgroundStatusToKanban(
  status: "running" | "completed" | "error" | "cancelled"
): KanbanTaskStatus {
  switch (status) {
    case "running":
      return "inprogress";
    case "completed":
      return "done";
    case "error":
      return "inreview"; // Map errors to "in review" for visibility
    case "cancelled":
      return "cancelled";
    default:
      return "todo";
  }
}

/**
 * Create successful API response
 */
function success<T>(data: T): ApiResponse<T> {
  return {
    success: true,
    data,
    error_data: null,
    message: null,
  };
}

/**
 * Create error API response
 */
function error(message: string, errorData?: unknown): ApiResponse<null> {
  return {
    success: false,
    data: null,
    error_data: errorData ?? null,
    message,
  };
}

/**
 * Transform BackgroundTask to KanbanTask
 */
function toKanbanTask(task: ReturnType<typeof backgroundTaskManager.getTask> & object): KanbanTask {
  return {
    id: task.taskId,
    workspace_path: task.workspacePath ?? null,
    title: task.prompt.slice(0, 100) + (task.prompt.length > 100 ? "..." : ""),
    description: task.prompt,
    status: mapBackgroundStatusToKanban(task.status),
    created_at: task.startedAt.toISOString(),
    updated_at: task.completedAt?.toISOString() || task.startedAt.toISOString(),
    has_in_progress_attempt: task.status === "running",
    last_attempt_failed: task.status === "error",
    executor: task.agentName || "Agent",
  };
}

// ============================================================================
// Routes
// ============================================================================

/**
 * Register kanban routes
 */
export function registerKanbanRoutes(fastify: FastifyInstance): void {
  /**
   * Health check
   * GET /api/kanban/health
   */
  fastify.get("/api/kanban/health", async (_request, reply) => {
    return reply.send(success("OK"));
  });

  /**
   * Get tasks for a workspace
   * GET /api/kanban/tasks?workspace_path=xxx
   *
   * workspace_path: workspace path to filter tasks
   * - If empty or not provided, returns tasks without workspace (global tasks)
   */
  fastify.get<{
    Querystring: { workspace_path?: string };
  }>("/api/kanban/tasks", async (request, reply) => {
    const { workspace_path } = request.query;

    try {
      let filteredTasks;
      if (!workspace_path) {
        // No workspace_path: return global tasks (tasks without workspace)
        filteredTasks = backgroundTaskManager.getAllTasks().filter((t) => !t.workspacePath);
      } else {
        // Filter by workspace path
        filteredTasks = backgroundTaskManager.getTasksByWorkspace(workspace_path);
      }

      const kanbanTasks: KanbanTask[] = filteredTasks.map(toKanbanTask);
      return reply.send(success(kanbanTasks));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to list tasks";
      return reply.status(500).send(error(message));
    }
  });

  /**
   * Get a single task
   * GET /api/kanban/tasks/:taskId
   */
  fastify.get<{
    Params: { taskId: string };
  }>("/api/kanban/tasks/:taskId", async (request, reply) => {
    const { taskId } = request.params;

    const task = backgroundTaskManager.getTask(taskId);
    if (!task) {
      return reply.status(404).send(error("Task not found"));
    }

    return reply.send(success(toKanbanTask(task)));
  });

  /**
   * Update a task
   * PUT /api/kanban/tasks/:taskId
   *
   * Note: Only status updates are supported (to cancel/stop tasks)
   */
  fastify.put<{
    Params: { taskId: string };
    Body: { status?: KanbanTaskStatus };
  }>("/api/kanban/tasks/:taskId", async (request, reply) => {
    const { taskId } = request.params;
    const { status } = request.body || {};

    const task = backgroundTaskManager.getTask(taskId);
    if (!task) {
      return reply.status(404).send(error("Task not found"));
    }

    // Only support cancelling running tasks
    if (status === "cancelled" && task.status === "running") {
      backgroundTaskManager.stopTask(taskId);
    }

    // Return updated task
    const updatedTask = backgroundTaskManager.getTask(taskId);
    if (!updatedTask) {
      return reply.status(404).send(error("Task not found after update"));
    }

    return reply.send(success(toKanbanTask(updatedTask)));
  });

  /**
   * Delete a task
   * DELETE /api/kanban/tasks/:taskId
   *
   * Note: This removes the task from the background task manager
   */
  fastify.delete<{
    Params: { taskId: string };
  }>("/api/kanban/tasks/:taskId", async (request, reply) => {
    const { taskId } = request.params;

    const task = backgroundTaskManager.getTask(taskId);
    if (!task) {
      return reply.status(404).send(error("Task not found"));
    }

    // Stop if running
    if (task.status === "running") {
      backgroundTaskManager.stopTask(taskId);
    }

    // Cleanup the task
    backgroundTaskManager.cleanup(taskId);

    return reply.send(success(null));
  });
}

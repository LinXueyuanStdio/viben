/**
 * Unified Task API Routes
 *
 * CLI-first API design with unified POST endpoints.
 * All endpoints use POST method with task_dir/workspace_path query parameters.
 *
 * Endpoints:
 * - POST /api/task/list - List tasks
 * - POST /api/task/create - Create task
 * - POST /api/task/view - View task details
 * - POST /api/task/edit - Edit task
 * - POST /api/task/delete - Delete task
 * - POST /api/task/enqueue - backlog → queue
 * - POST /api/task/dequeue - queue → backlog
 *
 * @see docs/plans/2026-03-11-task-api-redesign.md
 */
import type { FastifyInstance } from "fastify";
import type { AppState } from "../state";
import {
  taskService,
  type UnifiedTask,
  type TaskStatus,
} from "../../services/task-service";
import { taskEventStore } from "../../task/events/event-store";
import { taskSSEManager } from "../sse/task-sse-manager";
import type { TaskEvent } from "../../task/events/task-event";
import {
  resolveTaskDirectory,
  validateStatusTransition,
} from "../../cli/lib/viben-workspace";

// =============================================================================
// Types
// =============================================================================

/**
 * Standard API response format
 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Query parameters for task_dir based operations
 */
interface TaskDirQuery {
  task_dir?: string;
}

/**
 * Query parameters for workspace based operations
 */
interface WorkspaceQuery {
  workspace_path?: string;
}

/**
 * Combined query parameters
 */
interface TaskQuery extends TaskDirQuery, WorkspaceQuery {}

/**
 * List tasks query parameters
 */
interface ListTasksQuery extends WorkspaceQuery {
  status?: string;
  assignee?: string;
}

/**
 * Create task input
 */
interface CreateTaskInput {
  title: string;
  slug?: string;
  description?: string;
  assignee?: string;
  priority?: "P0" | "P1" | "P2" | "P3";
  agent?: string;
  executor?: string;
  model?: string;
}

/**
 * Update task input
 */
interface UpdateTaskInput {
  title?: string;
  description?: string;
  assignee?: string;
  priority?: string;
  branch?: string;
  base_branch?: string;
  agent?: string;
  executor?: string;
  model?: string;
}

/**
 * Enqueue task input
 */
interface EnqueueTaskInput {
  agent?: string;
  executor?: string;
  model?: string;
  priority?: string;
}

/**
 * Delete task input
 */
interface DeleteTaskInput {
  force?: boolean;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate a UUID for events
 */
function generateEventId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Transform UnifiedTask to snake_case API response format
 */
function toSnakeCaseTask(task: UnifiedTask) {
  return {
    id: task.id,
    name: task.name,
    title: task.title || task.prompt?.slice(0, 100) || "Untitled",
    description: task.description || task.prompt || null,
    status: task.status,
    review_reason: task.reviewReason ?? null,
    current_phase: task.current_phase ?? 0,
    priority: task.priority || "P2",
    workspace_path: task.workspacePath ?? null,
    creator: task.creator ?? null,
    assignee: task.assignee ?? null,
    branch: task.branch ?? null,
    base_branch: task.base_branch ?? null,
    worktree_path: task.worktree_path ?? null,
    commit: task.commit ?? null,
    pr_url: task.pr_url ?? null,
    agent_id: task.agent ?? null,
    session_id: task.sessionId ?? null,
    task_index: task.taskIndex ?? 0,
    prompt: task.prompt ?? null,
    cost: task.cost ?? null,
    duration: task.duration ?? null,
    favorite: task.favorite ?? false,
    executor: task.executor || "Agent",
    subtasks: task.subtasks ?? [],
    subtask_details: task.subtaskDetails ?? null,
    execution_progress: task.executionProgress ?? null,
    created_at: task.createdAt,
    updated_at: task.updatedAt ?? task.createdAt,
    completed_at: task.completedAt ?? null,
    is_template: task.is_template ?? false,
    queued_at: task.queuedAt ?? null,
    last_event: task.lastEvent ?? null,
    xstate_state: task.xstateState ?? null,
  };
}

/**
 * Create error response
 */
function errorResponse(code: string, message: string): ApiResponse<never> {
  return {
    success: false,
    error: { code, message },
  };
}

/**
 * Create success response
 */
function successResponse<T>(data: T): ApiResponse<T> {
  return {
    success: true,
    data,
  };
}

/**
 * Resolve task directory from query parameters
 * Supports both task_dir (absolute path) and task name resolution
 */
async function resolveTaskDir(
  query: TaskQuery
): Promise<{ taskDir: string | null; workspacePath: string | null; error?: string }> {
  const { task_dir, workspace_path } = query;

  if (!task_dir) {
    return { taskDir: null, workspacePath: workspace_path || null, error: "task_dir is required" };
  }

  // If task_dir is an absolute path, use it directly
  if (task_dir.startsWith("/")) {
    return { taskDir: task_dir, workspacePath: workspace_path || null };
  }

  // Otherwise, try to resolve using workspace_path
  if (workspace_path) {
    const resolved = resolveTaskDirectory(task_dir, workspace_path);
    return { taskDir: resolved, workspacePath: workspace_path };
  }

  // If no workspace_path provided, try to find task by ID across all tasks
  return { taskDir: null, workspacePath: null, error: "workspace_path required when task_dir is not absolute" };
}

// =============================================================================
// Route Registration
// =============================================================================

/**
 * Register unified Task API routes
 */
export function registerUnifiedTaskRoutes(fastify: FastifyInstance, state: AppState): void {
  // ==========================================================================
  // POST /api/task/list - List tasks
  // ==========================================================================
  fastify.post<{
    Querystring: ListTasksQuery;
  }>(
    "/api/task/list",
    {
      schema: {
        description: "List all tasks in a workspace",
        tags: ["task"],
        querystring: {
          type: "object",
          properties: {
            workspace_path: { type: "string", description: "Workspace path (required)" },
            status: { type: "string", description: "Filter by status" },
            assignee: { type: "string", description: "Filter by assignee" },
          },
          required: ["workspace_path"],
        },
      },
    },
    async (request, reply) => {
      const { workspace_path, status, assignee } = request.query;

      if (!workspace_path) {
        reply.code(400);
        return errorResponse("MISSING_WORKSPACE_PATH", "workspace_path is required");
      }

      try {
        let tasks = await taskService.listTasks(workspace_path);

        // Apply filters
        if (status) {
          tasks = tasks.filter((t) => t.status === status);
        }
        if (assignee) {
          tasks = tasks.filter((t) => t.assignee === assignee);
        }

        return successResponse({
          tasks: tasks.map(toSnakeCaseTask),
          count: tasks.length,
        });
      } catch (error) {
        reply.code(500);
        return errorResponse(
          "LIST_FAILED",
          error instanceof Error ? error.message : "Failed to list tasks"
        );
      }
    }
  );

  // ==========================================================================
  // POST /api/task/create - Create task
  // ==========================================================================
  fastify.post<{
    Querystring: WorkspaceQuery;
    Body: CreateTaskInput;
  }>(
    "/api/task/create",
    {
      schema: {
        description: "Create a new task",
        tags: ["task"],
        querystring: {
          type: "object",
          properties: {
            workspace_path: { type: "string", description: "Workspace path (required)" },
          },
          required: ["workspace_path"],
        },
        body: {
          type: "object",
          properties: {
            title: { type: "string", description: "Task title (required)" },
            slug: { type: "string", description: "URL-safe slug" },
            description: { type: "string", description: "Task description" },
            assignee: { type: "string", description: "Assignee" },
            priority: { type: "string", enum: ["P0", "P1", "P2", "P3"] },
            agent: { type: "string", description: "Agent ID" },
            dev_type: { type: "string", enum: ["frontend", "backend", "fullstack"] },
            executor: { type: "string", description: "Executor type" },
            model: { type: "string", description: "Model ID" },
          },
          required: ["title"],
        },
      },
    },
    async (request, reply) => {
      const { workspace_path } = request.query;
      const input = request.body;

      if (!workspace_path) {
        reply.code(400);
        return errorResponse("MISSING_WORKSPACE_PATH", "workspace_path is required");
      }

      if (!input.title) {
        reply.code(400);
        return errorResponse("MISSING_TITLE", "title is required");
      }

      try {
        const taskInput: Partial<UnifiedTask> = {
          title: input.title,
          name: input.slug,
          description: input.description,
          assignee: input.assignee,
          priority: input.priority || "P2",
          agent: input.agent,
          executor: input.executor,
          model: input.model,
          status: "backlog",
          workspacePath: workspace_path,
        };

        const { taskDir, task } = await taskService.createTask(workspace_path, taskInput);

        // Emit task created event via state
        state.events.taskCreated({
          id: task.id,
          title: task.title,
          description: task.description,
          status: task.status,
          agentId: task.agent,
          createdAt: task.createdAt,
          updatedAt: task.updatedAt || task.createdAt,
        });

        reply.code(201);
        return successResponse({
          task: toSnakeCaseTask(task),
          task_dir: taskDir,
        });
      } catch (error) {
        reply.code(500);
        return errorResponse(
          "CREATE_FAILED",
          error instanceof Error ? error.message : "Failed to create task"
        );
      }
    }
  );

  // ==========================================================================
  // POST /api/task/view - View task details
  // ==========================================================================
  fastify.post<{
    Querystring: TaskQuery;
  }>(
    "/api/task/view",
    {
      schema: {
        description: "View task details",
        tags: ["task"],
        querystring: {
          type: "object",
          properties: {
            task_dir: { type: "string", description: "Task directory path (required)" },
            workspace_path: { type: "string", description: "Workspace path" },
          },
          required: ["task_dir"],
        },
      },
    },
    async (request, reply) => {
      const resolved = await resolveTaskDir(request.query);

      if (resolved.error || !resolved.taskDir) {
        reply.code(400);
        return errorResponse("INVALID_TASK_DIR", resolved.error || "task_dir is required");
      }

      try {
        const task = await taskService.getTask(resolved.taskDir);

        if (!task) {
          reply.code(404);
          return errorResponse("TASK_NOT_FOUND", "Task not found");
        }

        // Also get specs data (PRD, subtasks, logs)
        const specsData = await taskService.getTaskSpecsData(resolved.taskDir);

        return successResponse({
          task: toSnakeCaseTask(task),
          task_dir: resolved.taskDir,
          specs: {
            prd_content: specsData.prdContent,
            prd_path: specsData.prdPath,
            subtasks: specsData.subtasks,
            logs: specsData.logs,
          },
        });
      } catch (error) {
        reply.code(500);
        return errorResponse(
          "VIEW_FAILED",
          error instanceof Error ? error.message : "Failed to view task"
        );
      }
    }
  );

  // ==========================================================================
  // POST /api/task/edit - Edit task
  // ==========================================================================
  fastify.post<{
    Querystring: TaskQuery;
    Body: UpdateTaskInput;
  }>(
    "/api/task/edit",
    {
      schema: {
        description: "Edit task fields",
        tags: ["task"],
        querystring: {
          type: "object",
          properties: {
            task_dir: { type: "string", description: "Task directory path (required)" },
            workspace_path: { type: "string", description: "Workspace path" },
          },
          required: ["task_dir"],
        },
        body: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            assignee: { type: "string" },
            priority: { type: "string" },
            dev_type: { type: "string" },
            branch: { type: "string" },
            base_branch: { type: "string" },
            agent: { type: "string" },
            executor: { type: "string" },
            model: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const resolved = await resolveTaskDir(request.query);
      const updates = request.body;

      if (resolved.error || !resolved.taskDir) {
        reply.code(400);
        return errorResponse("INVALID_TASK_DIR", resolved.error || "task_dir is required");
      }

      try {
        // Build update object
        const taskUpdates: Partial<UnifiedTask> = {};
        if (updates.title !== undefined) taskUpdates.title = updates.title;
        if (updates.description !== undefined) taskUpdates.description = updates.description;
        if (updates.assignee !== undefined) taskUpdates.assignee = updates.assignee;
        if (updates.priority !== undefined) taskUpdates.priority = updates.priority;
        if (updates.dev_type !== undefined) taskUpdates.dev_type = updates.dev_type;
        if (updates.branch !== undefined) taskUpdates.branch = updates.branch;
        if (updates.base_branch !== undefined) taskUpdates.base_branch = updates.base_branch;
        if (updates.agent !== undefined) taskUpdates.agent = updates.agent;
        if (updates.executor !== undefined) taskUpdates.executor = updates.executor;
        if (updates.model !== undefined) taskUpdates.model = updates.model;

        const task = await taskService.updateTask(resolved.taskDir, taskUpdates);

        // Emit task updated event
        state.events.taskUpdated({
          id: task.id,
          title: task.title,
          description: task.description,
          status: task.status,
          agentId: task.agent,
          createdAt: task.createdAt,
          updatedAt: task.updatedAt || task.createdAt,
        });

        return successResponse({
          task: toSnakeCaseTask(task),
          task_dir: resolved.taskDir,
        });
      } catch (error) {
        reply.code(500);
        return errorResponse(
          "EDIT_FAILED",
          error instanceof Error ? error.message : "Failed to edit task"
        );
      }
    }
  );

  // ==========================================================================
  // POST /api/task/delete - Delete task
  // ==========================================================================
  fastify.post<{
    Querystring: TaskQuery;
    Body: DeleteTaskInput;
  }>(
    "/api/task/delete",
    {
      schema: {
        description: "Delete a task",
        tags: ["task"],
        querystring: {
          type: "object",
          properties: {
            task_dir: { type: "string", description: "Task directory path (required)" },
            workspace_path: { type: "string", description: "Workspace path" },
          },
          required: ["task_dir"],
        },
        body: {
          type: "object",
          properties: {
            force: { type: "boolean", description: "Force delete without confirmation" },
          },
        },
      },
    },
    async (request, reply) => {
      const resolved = await resolveTaskDir(request.query);
      const { force } = request.body || {};

      if (resolved.error || !resolved.taskDir) {
        reply.code(400);
        return errorResponse("INVALID_TASK_DIR", resolved.error || "task_dir is required");
      }

      try {
        // Get task info before deletion
        const task = await taskService.getTask(resolved.taskDir);
        if (!task) {
          reply.code(404);
          return errorResponse("TASK_NOT_FOUND", "Task not found");
        }

        // Check if task is in a state that allows deletion
        const nonDeletableStates: TaskStatus[] = ["in_progress", "queue"];
        if (!force && nonDeletableStates.includes(task.status)) {
          reply.code(409);
          return errorResponse(
            "CANNOT_DELETE",
            `Cannot delete task in '${task.status}' status. Use force=true to override.`
          );
        }

        // Delete the task
        const deleted = await taskService.deleteTask(resolved.taskDir);
        if (!deleted) {
          reply.code(500);
          return errorResponse("DELETE_FAILED", "Failed to delete task");
        }

        // Emit task deleted event
        state.events.taskDeleted(task.id);

        return successResponse({
          deleted_id: task.id,
          deleted_task_dir: resolved.taskDir,
        });
      } catch (error) {
        reply.code(500);
        return errorResponse(
          "DELETE_FAILED",
          error instanceof Error ? error.message : "Failed to delete task"
        );
      }
    }
  );

  // ==========================================================================
  // POST /api/task/enqueue - backlog → queue
  // ==========================================================================
  fastify.post<{
    Querystring: TaskQuery;
    Body: EnqueueTaskInput;
  }>(
    "/api/task/enqueue",
    {
      schema: {
        description: "Move task from backlog to queue",
        tags: ["task"],
        querystring: {
          type: "object",
          properties: {
            task_dir: { type: "string", description: "Task directory path (required)" },
            workspace_path: { type: "string", description: "Workspace path" },
          },
          required: ["task_dir"],
        },
        body: {
          type: "object",
          properties: {
            agent: { type: "string", description: "Agent ID to assign" },
            executor: { type: "string", description: "Executor type" },
            model: { type: "string", description: "Model ID" },
            priority: { type: "string", description: "Priority level" },
          },
        },
      },
    },
    async (request, reply) => {
      const resolved = await resolveTaskDir(request.query);
      const input = request.body || {};

      if (resolved.error || !resolved.taskDir) {
        reply.code(400);
        return errorResponse("INVALID_TASK_DIR", resolved.error || "task_dir is required");
      }

      try {
        // Get current task
        const task = await taskService.getTask(resolved.taskDir);
        if (!task) {
          reply.code(404);
          return errorResponse("TASK_NOT_FOUND", "Task not found");
        }

        // Validate transition: backlog → queue
        const validation = validateStatusTransition(task.status, "queue", "QUEUE");
        if (!validation.valid) {
          reply.code(409);
          return errorResponse("INVALID_TRANSITION", validation.error || "Invalid status transition");
        }

        // Build event
        const event: TaskEvent = {
          eventId: generateEventId(),
          sequence: (task.lastEvent?.sequence ?? 0) + 1,
          type: "QUEUE",
          timestamp: new Date().toISOString(),
          payload: {
            agent: input.agent,
            executor: input.executor,
            model: input.model,
            priority: input.priority,
          },
        };

        // Apply event using task event store
        const result = await taskEventStore.applyEvent(resolved.taskDir, event);

        if (!result.success) {
          reply.code(409);
          return errorResponse(
            "EVENT_FAILED",
            result.error || "Failed to apply QUEUE event"
          );
        }

        // Update task with optional agent/executor/model/priority
        const updates: Partial<UnifiedTask> = {
          queuedAt: new Date().toISOString(),
        };
        if (input.agent) updates.agent = input.agent;
        if (input.executor) updates.executor = input.executor;
        if (input.model) updates.model = input.model;
        if (input.priority) updates.priority = input.priority;

        const updatedTask = await taskService.updateTask(resolved.taskDir, updates);

        // Broadcast state change
        taskSSEManager.broadcast(
          task.id,
          {
            type: "STATE_CHANGED",
            event,
            new_state: result.newState,
          },
          resolved.workspacePath || undefined
        );

        // Emit status change event
        state.events.taskStatusChanged(task.id, task.status, "queue");

        return successResponse({
          task: toSnakeCaseTask(updatedTask),
          new_state: result.newState,
          event_id: event.eventId,
        });
      } catch (error) {
        reply.code(500);
        return errorResponse(
          "ENQUEUE_FAILED",
          error instanceof Error ? error.message : "Failed to enqueue task"
        );
      }
    }
  );

  // ==========================================================================
  // POST /api/task/dequeue - queue → backlog
  // ==========================================================================
  fastify.post<{
    Querystring: TaskQuery;
  }>(
    "/api/task/dequeue",
    {
      schema: {
        description: "Move task from queue back to backlog",
        tags: ["task"],
        querystring: {
          type: "object",
          properties: {
            task_dir: { type: "string", description: "Task directory path (required)" },
            workspace_path: { type: "string", description: "Workspace path" },
          },
          required: ["task_dir"],
        },
      },
    },
    async (request, reply) => {
      const resolved = await resolveTaskDir(request.query);

      if (resolved.error || !resolved.taskDir) {
        reply.code(400);
        return errorResponse("INVALID_TASK_DIR", resolved.error || "task_dir is required");
      }

      try {
        // Get current task
        const task = await taskService.getTask(resolved.taskDir);
        if (!task) {
          reply.code(404);
          return errorResponse("TASK_NOT_FOUND", "Task not found");
        }

        // Validate transition: queue → backlog
        const validation = validateStatusTransition(task.status, "backlog", "DEQUEUE");
        if (!validation.valid) {
          reply.code(409);
          return errorResponse("INVALID_TRANSITION", validation.error || "Invalid status transition");
        }

        // Build event
        const event: TaskEvent = {
          eventId: generateEventId(),
          sequence: (task.lastEvent?.sequence ?? 0) + 1,
          type: "DEQUEUE",
          timestamp: new Date().toISOString(),
        };

        // Apply event using task event store
        const result = await taskEventStore.applyEvent(resolved.taskDir, event);

        if (!result.success) {
          reply.code(409);
          return errorResponse(
            "EVENT_FAILED",
            result.error || "Failed to apply DEQUEUE event"
          );
        }

        // Clear queuedAt
        const updatedTask = await taskService.updateTask(resolved.taskDir, {
          queuedAt: undefined,
        });

        // Broadcast state change
        taskSSEManager.broadcast(
          task.id,
          {
            type: "STATE_CHANGED",
            event,
            new_state: result.newState,
          },
          resolved.workspacePath || undefined
        );

        // Emit status change event
        state.events.taskStatusChanged(task.id, task.status, "backlog");

        return successResponse({
          task: toSnakeCaseTask(updatedTask),
          new_state: result.newState,
          event_id: event.eventId,
        });
      } catch (error) {
        reply.code(500);
        return errorResponse(
          "DEQUEUE_FAILED",
          error instanceof Error ? error.message : "Failed to dequeue task"
        );
      }
    }
  );
}

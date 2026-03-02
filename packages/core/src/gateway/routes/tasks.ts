/**
 * Task routes (unified file-based system)
 *
 * Provides REST endpoints for task operations using file-system storage:
 * - GET /api/tasks - List all tasks
 * - GET /api/tasks/:id - Get task by ID
 * - POST /api/tasks - Create a new task
 * - PATCH /api/tasks/:id - Update a task
 * - DELETE /api/tasks/:id - Delete a task
 * - GET /api/agents/:agentId/tasks - Get tasks by agent
 * - GET /api/agents/:agentId/sessions/:sessionId/tasks - List tasks by session
 * - GET /api/agents/:agentId/sessions/:sessionId/tasks/:taskId/messages - Get task messages
 */
import type { FastifyInstance } from "fastify";
import { sessionStoreService, type TaskConfig, type TaskStatus } from "../../services/session-store";
import type { AppState } from "../state";
import type { Task, TaskStatus as DbTaskStatus } from "../../db/types";

/**
 * Kanban-compatible task status
 */
type KanbanTaskStatus = "todo" | "inprogress" | "inreview" | "done" | "cancelled";

/**
 * Convert session-store TaskStatus to db TaskStatus for events
 */
function toDbStatus(status: TaskStatus): DbTaskStatus {
  switch (status) {
    case "running":
    case "inprogress":
      return "inprogress";
    case "completed":
    case "done":
      return "done";
    case "error":
    case "inreview":
      return "inreview";
    case "stopped":
    case "cancelled":
      return "cancelled";
    case "todo":
    default:
      return "todo";
  }
}

/**
 * Convert TaskStatus to Kanban-compatible status
 */
function toKanbanStatus(status: TaskStatus): KanbanTaskStatus {
  switch (status) {
    case "running":
    case "inprogress":
      return "inprogress";
    case "completed":
    case "done":
      return "done";
    case "error":
    case "inreview":
      return "inreview";
    case "stopped":
    case "cancelled":
      return "cancelled";
    case "todo":
    default:
      return "todo";
  }
}

/**
 * Convert TaskConfig to db Task for events
 */
function toDbTask(config: TaskConfig): Task {
  return {
    id: config.id,
    title: config.title || config.prompt?.slice(0, 50) || "Untitled",
    description: config.description || config.prompt,
    status: toDbStatus(config.status),
    agentId: config.agentId,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
  };
}

/**
 * Transform task to snake_case response format (unified for kanban and session tasks)
 */
function toSnakeCaseTask(task: TaskConfig) {
  const kanbanStatus = toKanbanStatus(task.status);
  return {
    id: task.id,
    title: task.title || task.prompt?.slice(0, 100) || "Untitled",
    description: task.description || task.prompt || null,
    status: kanbanStatus,
    // Organization fields
    workspace_path: task.workspacePath ?? null,
    agent_id: task.agentId || null,
    session_id: task.sessionId || null,
    task_index: task.taskIndex,
    prompt: task.prompt,
    // Execution info
    cost: task.cost,
    duration: task.duration,
    favorite: task.favorite,
    // Kanban attempt status
    has_in_progress_attempt: task.hasInProgressAttempt ?? kanbanStatus === "inprogress",
    last_attempt_failed: task.lastAttemptFailed ?? kanbanStatus === "inreview",
    executor: task.executor || "Agent",
    // Timestamps
    created_at: task.createdAt,
    updated_at: task.updatedAt,
  };
}

/**
 * Input type for creating a task (supports both camelCase and snake_case)
 */
interface CreateTaskInput {
  title?: string;
  description?: string;
  prompt?: string;
  status?: string;
  sessionId?: string;
  session_id?: string;
  agentId?: string;
  agent_id?: string;
  taskIndex?: number;
  task_index?: number;
  // Kanban fields
  workspacePath?: string;
  workspace_path?: string;
  executor?: string;
  auto_start?: boolean;
  model_id?: string;
  branch?: string;
}

/**
 * Input type for updating a task
 */
interface UpdateTaskInput {
  title?: string;
  description?: string;
  prompt?: string;
  status?: string;
  cost?: number;
  duration?: number;
  favorite?: boolean;
  // Session/Agent fields
  sessionId?: string;
  session_id?: string;
  agentId?: string;
  agent_id?: string;
  // Kanban fields
  workspacePath?: string;
  workspace_path?: string;
  hasInProgressAttempt?: boolean;
  has_in_progress_attempt?: boolean;
  lastAttemptFailed?: boolean;
  last_attempt_failed?: boolean;
  executor?: string;
}

/**
 * Register task routes
 */
export function registerTaskRoutes(fastify: FastifyInstance, state: AppState): void {
  // List all tasks with optional workspace_path filter
  fastify.get<{
    Querystring: { workspace_path?: string };
  }>("/api/tasks", {
    schema: {
      description: "List all tasks with optional workspace filter",
      tags: ["tasks"],
      querystring: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Filter tasks by workspace path" },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            tasks: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  title: { type: "string" },
                  description: { type: "string" },
                  status: { type: "string", enum: ["todo", "inprogress", "inreview", "done", "cancelled"] },
                  workspace_path: { type: "string" },
                  agent_id: { type: "string" },
                  session_id: { type: "string" },
                  task_index: { type: "number" },
                  prompt: { type: "string" },
                  cost: { type: "number" },
                  duration: { type: "number" },
                  favorite: { type: "boolean" },
                  has_in_progress_attempt: { type: "boolean" },
                  last_attempt_failed: { type: "boolean" },
                  executor: { type: "string" },
                  created_at: { type: "string" },
                  updated_at: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
  }, async (request) => {
    const { workspace_path } = request.query;
    let tasks = await sessionStoreService.listAllTasks();

    // Filter by workspace_path if provided
    if (workspace_path !== undefined) {
      if (workspace_path === "" || workspace_path === null) {
        // Empty/null workspace_path: return global tasks (tasks without workspace)
        tasks = tasks.filter((t) => !t.workspacePath);
      } else {
        // Filter by specific workspace path
        tasks = tasks.filter((t) => t.workspacePath === workspace_path);
      }
    }

    return { tasks: tasks.map(toSnakeCaseTask) };
  });

  // Get a specific task
  fastify.get<{ Params: { id: string } }>("/api/tasks/:id", {
    schema: {
      description: "Get a specific task by ID",
      tags: ["tasks"],
      params: {
        type: "object",
        properties: {
          id: { type: "string", description: "Task ID" },
        },
        required: ["id"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            description: { type: "string" },
            status: { type: "string" },
            workspace_path: { type: "string" },
            agent_id: { type: "string" },
            session_id: { type: "string" },
            task_index: { type: "number" },
            prompt: { type: "string" },
            cost: { type: "number" },
            duration: { type: "number" },
            favorite: { type: "boolean" },
            has_in_progress_attempt: { type: "boolean" },
            last_attempt_failed: { type: "boolean" },
            executor: { type: "string" },
            created_at: { type: "string" },
            updated_at: { type: "string" },
          },
        },
        404: {
          type: "object",
          properties: {
            error: { type: "string" },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const task = await sessionStoreService.getTask(id);
    if (!task) {
      reply.code(404);
      return { error: `Task not found: ${id}` };
    }
    return toSnakeCaseTask(task);
  });

  // Create a new task
  fastify.post<{ Body: CreateTaskInput }>("/api/tasks", async (request, reply) => {
    const input = request.body;
    const now = new Date().toISOString();
    const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Determine initial status (default to "todo" for kanban-style tasks)
    const status = (input.status as TaskStatus) || "todo";

    const config: TaskConfig = {
      id: taskId,
      sessionId: input.sessionId || input.session_id || "",
      agentId: input.agentId || input.agent_id || "",
      taskIndex: input.taskIndex || input.task_index || 0,
      prompt: input.prompt || input.description || "",
      status,
      title: input.title,
      description: input.description,
      // Kanban fields
      workspacePath: input.workspacePath || input.workspace_path,
      executor: input.executor || "Agent",
      hasInProgressAttempt: status === "running" || status === "inprogress",
      lastAttemptFailed: false,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await sessionStoreService.createTask(config);
      state.events.taskCreated(toDbTask(config));
      reply.code(201);
      return toSnakeCaseTask(config);
    } catch (e) {
      reply.code(400);
      return { error: e instanceof Error ? e.message : "Failed to create task" };
    }
  });

  // Update a task (supports both PATCH and PUT for kanban compatibility)
  const updateTaskHandler = async (request: { params: { id: string }; body: UpdateTaskInput }, reply: { code: (code: number) => void }) => {
    const { id } = request.params;
    const updates = request.body;
    try {
      const existingTask = await sessionStoreService.getTask(id);
      if (!existingTask) {
        reply.code(404);
        return { error: `Task not found: ${id}` };
      }

      // Build update object with proper typing
      const taskUpdates: Partial<TaskConfig> = {};
      if (updates.title !== undefined) taskUpdates.title = updates.title;
      if (updates.description !== undefined) taskUpdates.description = updates.description;
      if (updates.prompt !== undefined) taskUpdates.prompt = updates.prompt;
      if (updates.status !== undefined) {
        taskUpdates.status = updates.status as TaskStatus;
        // Update attempt status based on new status
        const newStatus = updates.status as TaskStatus;
        taskUpdates.hasInProgressAttempt = newStatus === "running" || newStatus === "inprogress";
        taskUpdates.lastAttemptFailed = newStatus === "error" || newStatus === "inreview";
      }
      if (updates.cost !== undefined) taskUpdates.cost = updates.cost;
      if (updates.duration !== undefined) taskUpdates.duration = updates.duration;
      if (updates.favorite !== undefined) taskUpdates.favorite = updates.favorite;
      // Session/Agent fields
      const sessionId = updates.sessionId ?? updates.session_id;
      if (sessionId !== undefined) taskUpdates.sessionId = sessionId;
      const agentId = updates.agentId ?? updates.agent_id;
      if (agentId !== undefined) taskUpdates.agentId = agentId;
      // Kanban fields
      const workspacePath = updates.workspacePath ?? updates.workspace_path;
      if (workspacePath !== undefined) taskUpdates.workspacePath = workspacePath;
      const hasInProgressAttempt = updates.hasInProgressAttempt ?? updates.has_in_progress_attempt;
      if (hasInProgressAttempt !== undefined) taskUpdates.hasInProgressAttempt = hasInProgressAttempt;
      const lastAttemptFailed = updates.lastAttemptFailed ?? updates.last_attempt_failed;
      if (lastAttemptFailed !== undefined) taskUpdates.lastAttemptFailed = lastAttemptFailed;
      if (updates.executor !== undefined) taskUpdates.executor = updates.executor;

      await sessionStoreService.updateTask(id, taskUpdates);
      const task = await sessionStoreService.getTask(id);

      if (task) {
        state.events.taskUpdated(toDbTask(task));
        if (updates.status && existingTask.status !== updates.status) {
          state.events.taskStatusChanged(id, toDbStatus(existingTask.status), toDbStatus(updates.status as TaskStatus));
        }
      }

      return toSnakeCaseTask(task!);
    } catch (e) {
      reply.code(400);
      return { error: e instanceof Error ? e.message : "Failed to update task" };
    }
  };

  fastify.patch<{ Params: { id: string }; Body: UpdateTaskInput }>(
    "/api/tasks/:id",
    updateTaskHandler
  );

  // Also support PUT for kanban compatibility
  fastify.put<{ Params: { id: string }; Body: UpdateTaskInput }>(
    "/api/tasks/:id",
    updateTaskHandler
  );

  // Delete a task
  fastify.delete<{ Params: { id: string } }>("/api/tasks/:id", async (request, reply) => {
    const { id } = request.params;
    try {
      const task = await sessionStoreService.getTask(id);
      if (!task) {
        reply.code(404);
        return { error: `Task not found: ${id}` };
      }
      await sessionStoreService.deleteTask(id);
      state.events.taskDeleted(id);
      return { deleted: id };
    } catch (e) {
      reply.code(400);
      return { error: e instanceof Error ? e.message : "Failed to delete task" };
    }
  });

  // Get tasks by agent
  fastify.get<{ Params: { agentId: string } }>("/api/agents/:agentId/tasks", async (request) => {
    const { agentId } = request.params;
    const allTasks = await sessionStoreService.listAllTasks();
    const tasks = allTasks.filter((t) => t.agentId === agentId);
    return { tasks: tasks.map(toSnakeCaseTask) };
  });

  // List tasks by session (merged from session-tasks.ts)
  fastify.get<{
    Params: { agentId: string; sessionId: string };
  }>("/api/agents/:agentId/sessions/:sessionId/tasks", async (request, reply) => {
    const { sessionId } = request.params;
    try {
      const tasks = await sessionStoreService.listTasksBySession(sessionId);
      return { tasks: tasks.map(toSnakeCaseTask) };
    } catch (error) {
      reply.code(500);
      return { error: error instanceof Error ? error.message : "Failed to list tasks" };
    }
  });

  // Get task messages (merged from session-tasks.ts)
  fastify.get<{
    Params: { agentId: string; sessionId: string; taskId: string };
  }>("/api/agents/:agentId/sessions/:sessionId/tasks/:taskId/messages", async (request, reply) => {
    const { agentId, sessionId, taskId } = request.params;
    try {
      const messages = await sessionStoreService.readUIMessagesByTask(agentId, sessionId, taskId);
      return { messages };
    } catch (error) {
      reply.code(500);
      return { error: error instanceof Error ? error.message : "Failed to get messages" };
    }
  });
}

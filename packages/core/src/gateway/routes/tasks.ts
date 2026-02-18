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
 * Convert session-store TaskStatus to db TaskStatus for events
 */
function toDbStatus(status: TaskStatus): DbTaskStatus {
  switch (status) {
    case "running":
      return "inprogress";
    case "completed":
      return "done";
    case "error":
      return "cancelled";
    case "stopped":
      return "cancelled";
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
 * Transform task to snake_case response format (to match Rust gateway)
 */
function toSnakeCaseTask(task: TaskConfig) {
  return {
    id: task.id,
    title: task.title || task.prompt?.slice(0, 50) || "Untitled",
    description: task.description || task.prompt || "",
    status: task.status,
    agent_id: task.agentId,
    session_id: task.sessionId,
    task_index: task.taskIndex,
    prompt: task.prompt,
    cost: task.cost,
    duration: task.duration,
    favorite: task.favorite,
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
}

/**
 * Register task routes
 */
export function registerTaskRoutes(fastify: FastifyInstance, state: AppState): void {
  // List all tasks
  fastify.get("/api/tasks", async () => {
    const tasks = await sessionStoreService.listAllTasks();
    return { tasks: tasks.map(toSnakeCaseTask) };
  });

  // Get a specific task
  fastify.get<{ Params: { id: string } }>("/api/tasks/:id", async (request, reply) => {
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

    const config: TaskConfig = {
      id: taskId,
      sessionId: input.sessionId || input.session_id || "",
      agentId: input.agentId || input.agent_id || "",
      taskIndex: input.taskIndex || input.task_index || 0,
      prompt: input.prompt || input.description || "",
      status: (input.status as TaskStatus) || "running",
      title: input.title,
      description: input.description,
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

  // Update a task
  fastify.patch<{ Params: { id: string }; Body: UpdateTaskInput }>(
    "/api/tasks/:id",
    async (request, reply) => {
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
        if (updates.status !== undefined) taskUpdates.status = updates.status as TaskStatus;
        if (updates.cost !== undefined) taskUpdates.cost = updates.cost;
        if (updates.duration !== undefined) taskUpdates.duration = updates.duration;
        if (updates.favorite !== undefined) taskUpdates.favorite = updates.favorite;

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
    }
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

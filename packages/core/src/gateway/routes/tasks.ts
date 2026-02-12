/**
 * Task routes
 */
import type { FastifyInstance } from "fastify";
import { TaskModel, type Task, type CreateTask, type UpdateTask } from "../../db";
import type { AppState } from "../state";

/**
 * Transform task to snake_case response format (to match Rust gateway)
 */
function toSnakeCaseTask(task: Task) {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    agent_id: task.agentId,
    created_at: task.createdAt,
    updated_at: task.updatedAt,
  };
}

/**
 * Register task routes
 */
export function registerTaskRoutes(fastify: FastifyInstance, state: AppState): void {
  // List all tasks
  fastify.get("/api/tasks", async () => {
    const tasks = await TaskModel.findAll();
    return { tasks: tasks.map(toSnakeCaseTask) };
  });

  // Get a specific task
  fastify.get<{ Params: { id: string } }>("/api/tasks/:id", async (request, reply) => {
    const { id } = request.params;
    const task = await TaskModel.findById(id);
    if (!task) {
      reply.code(404);
      return { error: `Task not found: ${id}` };
    }
    // Return task directly (not wrapped) to match Rust gateway
    return toSnakeCaseTask(task);
  });

  // Create a new task
  fastify.post<{ Body: CreateTask }>("/api/tasks", async (request, reply) => {
    const input = request.body;
    try {
      const task = await TaskModel.create(input);
      state.events.taskCreated(task);
      reply.code(201);
      // Return task directly (not wrapped) to match Rust gateway
      return toSnakeCaseTask(task);
    } catch (e) {
      reply.code(400);
      return { error: e instanceof Error ? e.message : "Failed to create task" };
    }
  });

  // Update a task
  fastify.patch<{ Params: { id: string }; Body: UpdateTask }>("/api/tasks/:id", async (request, reply) => {
    const { id } = request.params;
    const updates = request.body;
    try {
      const existingTask = await TaskModel.findById(id);
      const task = await TaskModel.update(id, updates);
      state.events.taskUpdated(task);

      // Check for status change
      if (existingTask && updates.status && existingTask.status !== updates.status) {
        state.events.taskStatusChanged(id, existingTask.status, updates.status);
      }

      // Return task directly (not wrapped) to match Rust gateway
      return toSnakeCaseTask(task);
    } catch (e) {
      reply.code(400);
      return { error: e instanceof Error ? e.message : "Failed to update task" };
    }
  });

  // Delete a task
  fastify.delete<{ Params: { id: string } }>("/api/tasks/:id", async (request, reply) => {
    const { id } = request.params;
    try {
      const deleted = await TaskModel.delete(id);
      if (deleted) {
        state.events.taskDeleted(id);
        return { deleted: id };
      } else {
        reply.code(404);
        return { error: `Task not found: ${id}` };
      }
    } catch (e) {
      reply.code(400);
      return { error: e instanceof Error ? e.message : "Failed to delete task" };
    }
  });

  // Get tasks by agent
  fastify.get<{ Params: { agentId: string } }>("/api/agents/:agentId/tasks", async (request) => {
    const { agentId } = request.params;
    const tasks = await TaskModel.findByAgentId(agentId);
    return { tasks: tasks.map(toSnakeCaseTask) };
  });
}

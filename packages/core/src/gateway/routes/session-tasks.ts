/**
 * Session Task Routes
 *
 * REST endpoints for session-related task operations:
 * - GET /api/agents/:agentId/sessions/:sessionId/tasks - List tasks by session
 * - GET /api/agents/:agentId/sessions/:sessionId/tasks/:taskId/messages - Get task messages
 * - POST /api/session-tasks - Create a task
 * - GET /api/session-tasks/:taskId - Get task by ID
 * - PATCH /api/session-tasks/:taskId - Update task
 * - DELETE /api/session-tasks/:taskId - Delete task
 */

import type { FastifyInstance } from "fastify";
import { sessionStoreService, type TaskConfig } from "../../services/session-store";

/**
 * Register session task routes
 */
export function registerSessionTaskRoutes(fastify: FastifyInstance): void {
  /**
   * List tasks by session
   * GET /api/agents/:agentId/sessions/:sessionId/tasks
   */
  fastify.get<{
    Params: { agentId: string; sessionId: string };
  }>("/api/agents/:agentId/sessions/:sessionId/tasks", async (request, reply) => {
    const { sessionId } = request.params;
    try {
      const tasks = await sessionStoreService.listTasksBySession(sessionId);
      return { tasks };
    } catch (error) {
      reply.code(500);
      return { error: error instanceof Error ? error.message : "Failed to list tasks" };
    }
  });

  /**
   * Get task messages
   * GET /api/agents/:agentId/sessions/:sessionId/tasks/:taskId/messages
   */
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

  /**
   * Create a task
   * POST /api/session-tasks
   */
  fastify.post<{
    Body: TaskConfig;
  }>("/api/session-tasks", async (request, reply) => {
    const config = request.body;
    try {
      await sessionStoreService.createTask(config);
      reply.code(201);
      return { task: config };
    } catch (error) {
      reply.code(500);
      return { error: error instanceof Error ? error.message : "Failed to create task" };
    }
  });

  /**
   * Get task by ID
   * GET /api/session-tasks/:taskId
   */
  fastify.get<{
    Params: { taskId: string };
  }>("/api/session-tasks/:taskId", async (request, reply) => {
    const { taskId } = request.params;
    try {
      const task = await sessionStoreService.getTask(taskId);
      if (!task) {
        reply.code(404);
        return { error: `Task not found: ${taskId}` };
      }
      return { task };
    } catch (error) {
      reply.code(500);
      return { error: error instanceof Error ? error.message : "Failed to get task" };
    }
  });

  /**
   * Update task
   * PATCH /api/session-tasks/:taskId
   */
  fastify.patch<{
    Params: { taskId: string };
    Body: Partial<TaskConfig>;
  }>("/api/session-tasks/:taskId", async (request, reply) => {
    const { taskId } = request.params;
    const updates = request.body;
    try {
      await sessionStoreService.updateTask(taskId, updates);
      const task = await sessionStoreService.getTask(taskId);
      return { task };
    } catch (error) {
      const isNotFound = error instanceof Error && error.message.includes("not found");
      reply.code(isNotFound ? 404 : 500);
      return { error: error instanceof Error ? error.message : "Failed to update task" };
    }
  });

  /**
   * Delete task
   * DELETE /api/session-tasks/:taskId
   */
  fastify.delete<{
    Params: { taskId: string };
  }>("/api/session-tasks/:taskId", async (request, reply) => {
    const { taskId } = request.params;
    try {
      await sessionStoreService.deleteTask(taskId);
      return { success: true, taskId };
    } catch (error) {
      const isNotFound = error instanceof Error && error.message.includes("not found");
      reply.code(isNotFound ? 404 : 500);
      return { error: error instanceof Error ? error.message : "Failed to delete task" };
    }
  });
}

/**
 * Session routes
 */
import type { FastifyInstance } from "fastify";
import { SessionModel, type CreateSession, type UpdateSession } from "../../db";
import type { AppState } from "../state";

/**
 * Register session routes
 */
export function registerSessionRoutes(fastify: FastifyInstance, state: AppState): void {
  // List all sessions
  fastify.get("/api/sessions", async () => {
    const sessions = await SessionModel.findAll();
    return { sessions };
  });

  // Get a specific session
  fastify.get<{ Params: { id: string } }>("/api/sessions/:id", async (request, reply) => {
    const { id } = request.params;
    const session = await SessionModel.findById(id);
    if (!session) {
      reply.code(404);
      return { error: `Session not found: ${id}` };
    }
    return { session };
  });

  // Create a new session
  fastify.post<{ Body: CreateSession }>("/api/sessions", async (request, reply) => {
    const input = request.body;
    try {
      const session = await SessionModel.create(input);
      state.events.sessionCreated(session);
      reply.code(201);
      return { session };
    } catch (e) {
      reply.code(400);
      return { error: e instanceof Error ? e.message : "Failed to create session" };
    }
  });

  // Update a session
  fastify.patch<{ Params: { id: string }; Body: UpdateSession }>("/api/sessions/:id", async (request, reply) => {
    const { id } = request.params;
    const updates = request.body;
    try {
      const session = await SessionModel.update(id, updates);
      state.events.sessionUpdated(session);
      return { session };
    } catch (e) {
      reply.code(400);
      return { error: e instanceof Error ? e.message : "Failed to update session" };
    }
  });

  // Delete a session
  fastify.delete<{ Params: { id: string } }>("/api/sessions/:id", async (request, reply) => {
    const { id } = request.params;
    try {
      const deleted = await SessionModel.delete(id);
      if (deleted) {
        state.events.sessionDeleted(id);
        return { success: true };
      } else {
        reply.code(404);
        return { error: `Session not found: ${id}` };
      }
    } catch (e) {
      reply.code(400);
      return { error: e instanceof Error ? e.message : "Failed to delete session" };
    }
  });

  // Get sessions by agent
  fastify.get<{ Params: { agentId: string } }>("/api/agents/:agentId/sessions", async (request) => {
    const { agentId } = request.params;
    const sessions = await SessionModel.findByAgentId(agentId);
    return { sessions };
  });

  // Get sessions by task
  fastify.get<{ Params: { taskId: string } }>("/api/tasks/:taskId/sessions", async (request) => {
    const { taskId } = request.params;
    const sessions = await SessionModel.findByTaskId(taskId);
    return { sessions };
  });

  // Get messages for a session
  fastify.get<{ Params: { id: string } }>("/api/sessions/:id/messages", async (request, reply) => {
    const { id } = request.params;
    const session = await SessionModel.findById(id);
    if (!session) {
      reply.code(404);
      return { error: `Session not found: ${id}` };
    }

    try {
      const messages = await state.sessionStore.readMessages(session.agentId, id);
      return { messages };
    } catch (e) {
      reply.code(500);
      return { error: e instanceof Error ? e.message : "Failed to read messages" };
    }
  });

  // Get UI messages for a session
  fastify.get<{ Params: { id: string } }>("/api/sessions/:id/ui-messages", async (request, reply) => {
    const { id } = request.params;
    const session = await SessionModel.findById(id);
    if (!session) {
      reply.code(404);
      return { error: `Session not found: ${id}` };
    }

    try {
      const messages = await state.sessionStore.readUIMessages(session.agentId, id);
      return { messages };
    } catch (e) {
      reply.code(500);
      return { error: e instanceof Error ? e.message : "Failed to read UI messages" };
    }
  });
}

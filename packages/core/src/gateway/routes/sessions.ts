/**
 * Session routes
 */
import type { FastifyInstance } from "fastify";
import { SessionModel, type Session, type CreateSession, type UpdateSession } from "../../db";
import type { AppState } from "../state";

/**
 * Transform session to snake_case response format (to match Rust gateway)
 */
function toSnakeCaseSession(session: Session) {
  return {
    id: session.id,
    agent_id: session.agentId,
    task_id: session.taskId,
    status: session.status,
    prompt: session.prompt,
    session_data: session.sessionData,
    created_at: session.createdAt,
    updated_at: session.updatedAt,
  };
}

/**
 * Transform session message to snake_case response format
 */
function toSnakeCaseMessage(m: { timestamp: string; role: string; content: string; toolCalls?: unknown; toolResult?: unknown }) {
  return {
    timestamp: m.timestamp,
    role: m.role,
    content: m.content,
    tool_calls: m.toolCalls,
    tool_result: m.toolResult,
  };
}

/**
 * Transform UI message to snake_case response format
 */
function toSnakeCaseUIMessage(m: { id: string; timestamp: string; type: string; content?: string; toolUseId?: string; toolName?: string; toolInput?: unknown; toolOutput?: string; isError?: boolean; attachments?: unknown[] }) {
  return {
    id: m.id,
    timestamp: m.timestamp,
    type: m.type,
    content: m.content,
    tool_use_id: m.toolUseId,
    tool_name: m.toolName,
    tool_input: m.toolInput,
    tool_output: m.toolOutput,
    is_error: m.isError,
    attachments: m.attachments,
  };
}

/**
 * Register session routes
 */
export function registerSessionRoutes(fastify: FastifyInstance, state: AppState): void {
  // List all sessions
  fastify.get("/api/sessions", {
    schema: {
      description: "List all sessions",
      tags: ["sessions"],
      response: {
        200: {
          type: "object",
          properties: {
            sessions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  agent_id: { type: "string" },
                  task_id: { type: "string" },
                  status: { type: "string" },
                  prompt: { type: "string" },
                  session_data: { type: "object" },
                  created_at: { type: "string", format: "date-time" },
                  updated_at: { type: "string", format: "date-time" },
                },
              },
            },
          },
        },
      },
    },
  }, async () => {
    const sessions = await SessionModel.findAll();
    return { sessions: sessions.map(toSnakeCaseSession) };
  });

  // Get a specific session
  fastify.get<{ Params: { id: string } }>("/api/sessions/:id", {
    schema: {
      description: "Get a specific session by ID",
      tags: ["sessions"],
      params: {
        type: "object",
        properties: {
          id: { type: "string", description: "Session ID" },
        },
        required: ["id"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            id: { type: "string" },
            agent_id: { type: "string" },
            task_id: { type: "string" },
            status: { type: "string" },
            prompt: { type: "string" },
            session_data: { type: "object" },
            created_at: { type: "string", format: "date-time" },
            updated_at: { type: "string", format: "date-time" },
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
    const session = await SessionModel.findById(id);
    if (!session) {
      reply.code(404);
      return { error: `Session not found: ${id}` };
    }
    // Return session directly (not wrapped) to match Rust gateway
    return toSnakeCaseSession(session);
  });

  // Create a new session
  fastify.post<{ Body: CreateSession }>("/api/sessions", async (request, reply) => {
    const input = request.body;
    try {
      const session = await SessionModel.create(input);
      state.events.sessionCreated(session);
      reply.code(201);
      // Return session directly (not wrapped) to match Rust gateway
      return toSnakeCaseSession(session);
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
      // Return session directly (not wrapped) to match Rust gateway
      return toSnakeCaseSession(session);
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
        return { deleted: id };
      } else {
        reply.code(404);
        return { error: `Session not found: ${id}` };
      }
    } catch (e) {
      reply.code(400);
      return { error: e instanceof Error ? e.message : "Failed to delete session" };
    }
  });

  // Note: /api/agent/:id/sessions is handled by agents.ts (file-based sessions)

  // Get sessions by task
  fastify.get<{ Params: { taskId: string } }>("/api/tasks/:taskId/sessions", async (request) => {
    const { taskId } = request.params;
    const sessions = await SessionModel.findByTaskId(taskId);
    return { sessions: sessions.map(toSnakeCaseSession) };
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
      return { messages: messages.map(toSnakeCaseMessage) };
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
      return { messages: messages.map(toSnakeCaseUIMessage) };
    } catch (e) {
      reply.code(500);
      return { error: e instanceof Error ? e.message : "Failed to read UI messages" };
    }
  });
}

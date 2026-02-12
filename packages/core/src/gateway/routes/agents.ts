/**
 * Agent routes
 */
import type { FastifyInstance } from "fastify";
import { agentManager } from "../../agents";

/**
 * Register agent routes
 */
export function registerAgentRoutes(fastify: FastifyInstance): void {
  // List all agents
  fastify.get("/api/agents", async () => {
    const agents = await agentManager.list();
    return { agents };
  });

  // Get a specific agent
  fastify.get<{ Params: { id: string } }>("/api/agents/:id", async (request, reply) => {
    const { id } = request.params;
    const agent = await agentManager.get(id);
    if (!agent) {
      reply.code(404);
      return { error: `Agent not found: ${id}` };
    }
    return { agent };
  });

  // Create a new agent
  fastify.post<{ Body: { id: string; name?: string; model?: string; provider?: string; systemPrompt?: string } }>(
    "/api/agents",
    async (request, reply) => {
      const { id, name, model, provider, systemPrompt } = request.body;
      try {
        const agent = await agentManager.create(id, { name, model, provider, systemPrompt });
        reply.code(201);
        return { agent };
      } catch (e) {
        reply.code(400);
        return { error: e instanceof Error ? e.message : "Failed to create agent" };
      }
    }
  );

  // Update an agent
  fastify.patch<{
    Params: { id: string };
    Body: { name?: string; model?: string; provider?: string; systemPrompt?: string };
  }>("/api/agents/:id", async (request, reply) => {
    const { id } = request.params;
    const updates = request.body;
    try {
      const agent = await agentManager.update(id, updates);
      return { agent };
    } catch (e) {
      reply.code(400);
      return { error: e instanceof Error ? e.message : "Failed to update agent" };
    }
  });

  // Delete an agent
  fastify.delete<{ Params: { id: string } }>("/api/agents/:id", async (request, reply) => {
    const { id } = request.params;
    try {
      await agentManager.delete(id);
      return { success: true };
    } catch (e) {
      reply.code(400);
      return { error: e instanceof Error ? e.message : "Failed to delete agent" };
    }
  });
}

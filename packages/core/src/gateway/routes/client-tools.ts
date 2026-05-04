/**
 * Client Tools routes
 *
 * Provides the /api/client-tools/complete endpoint for the frontend to POST
 * tool execution results back to the gateway, resolving the pending promise
 * in the ClientToolCompletionRegistry.
 */
import type { FastifyInstance } from "fastify";
import { clientToolCompletionRegistry } from "../../services/client-tool-completion";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

interface CompleteBody {
  tool_use_id: string;
  session_id: string;
  result: CallToolResult;
}

export function registerClientToolRoutes(fastify: FastifyInstance): void {
  fastify.post<{ Body: CompleteBody }>("/api/client-tools/complete", async (request, reply) => {
    const { tool_use_id, session_id, result } = request.body;

    if (!tool_use_id || !session_id || !result) {
      return reply.status(400).send({ success: false, error: "Missing required fields: tool_use_id, session_id, result" });
    }

    const success = clientToolCompletionRegistry.complete(tool_use_id, session_id, result);
    if (!success) {
      return reply.status(404).send({ success: false, error: "No pending tool call found or session mismatch" });
    }
    return reply.send({ success: true });
  });
}

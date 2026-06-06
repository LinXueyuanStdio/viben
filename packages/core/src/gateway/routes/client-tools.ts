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
import { acpSessionManager } from "../../acp";

interface CompleteBody {
  tool_use_id: string;
  session_id: string;
  result: CallToolResult;
}

interface RequestBody {
  session_id: string;
  tool_call_id?: string;
  tool_use_id?: string;
  tool_name: string;
  input: unknown;
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

  fastify.post<{ Body: RequestBody }>("/api/client-tools/request", async (request, reply) => {
    const { session_id, tool_call_id, tool_use_id, tool_name, input } = request.body;

    if (!session_id || !tool_name) {
      return reply.status(400).send({ success: false, error: "Missing required fields: session_id, tool_name" });
    }

    const result = await acpSessionManager.requestClientTool(session_id, tool_name, input, tool_call_id ?? tool_use_id);
    return reply.send({ success: true, result });
  });
}

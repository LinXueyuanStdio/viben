/**
 * Client Tools routes
 *
 * Provides the /api/client-tools/complete endpoint for the frontend to POST
 * tool execution results back to the gateway, resolving the pending promise
 * in the ClientToolCompletionRegistry.
 */
import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { clientToolCompletionRegistry } from "../../services/client-tool-completion";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { acpSessionManager } from "../../acp";
import { CLIENT_SIDE_GUI_EXECUTE_TOOL_NAME } from "../../acp/ops/client-side-mcp-constants";
import type { AppState } from "../state";

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

export function registerClientToolRoutes(fastify: FastifyInstance, state?: AppState): void {
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

    // GUI_execute is handled server-side via clientStore, not dispatched to desktop
    if (tool_name === CLIENT_SIDE_GUI_EXECUTE_TOOL_NAME && state?.clientSocketServer && state?.clientStore) {
      acpSessionManager.consumePendingBridgeToolCall(session_id, tool_name);
      const result = await executeGuiActionServerSide(state, session_id, input);
      return reply.send({ success: true, result });
    }

    const result = await acpSessionManager.requestClientTool(session_id, tool_name, input, tool_call_id ?? tool_use_id);
    return reply.send({ success: true, result });
  });
}


async function executeGuiActionServerSide(
  state: AppState,
  sessionId: string,
  rawInput: unknown
): Promise<CallToolResult> {
  const input = (rawInput && typeof rawInput === "object" ? rawInput : {}) as {
    action?: string;
    payload?: Record<string, unknown>;
  };

  if (!input.action) {
    return { content: [{ type: "text", text: "Error: action field is required." }], isError: true };
  }

  const clientStore = state.clientStore;

  if (input.action === "list_actions") {
    const allActions = clientStore.getAllActions();
    const clients = clientStore.getAllClients();
    // Primary client (first registered) doesn't need clientId prefix;
    // remote clients get clientId prefix for disambiguation.
    const primaryClientId = clients[0];
    const actionInfos: Array<{ name: string; description: string }> = [
      { name: "list_actions", description: "列出所有可用的 action" },
      { name: "get_action_detail", description: "获取指定 action 的详细信息和参数定义" },
      ...allActions.map(a => ({
        name: a.clientId === primaryClientId
          ? `${a.namespace}.${a.name}`
          : `${a.clientId}.${a.namespace}.${a.name}`,
        description: a.description,
      })),
    ];
    return { content: [{ type: "text", text: JSON.stringify(actionInfos, null, 2) }] };
  }

  if (input.action === "get_action_detail") {
    const targetAction = input.payload?.action as string | undefined;
    if (!targetAction) {
      return { content: [{ type: "text", text: "Error: payload.action is required for get_action_detail" }], isError: true };
    }
    const found = clientStore.resolveAction(targetAction);
    if (!found) {
      return { content: [{ type: "text", text: `Action not found: ${targetAction}` }], isError: true };
    }
    return { content: [{ type: "text", text: JSON.stringify(found, null, 2) }] };
  }

  // Resolve the action: store knows which client owns it
  const found = clientStore.resolveAction(input.action);
  if (!found) {
    return {
      content: [{ type: "text", text: `Action not found: ${input.action}` }],
      isError: true,
    };
  }

  try {
    const result = await state.clientSocketServer!.executeAction(
      found.clientId,
      found.namespace,
      found.name,
      input.payload ?? {},
      {
        sessionId,
        toolUseId: `gui-${randomUUID()}`,
        callerClientId: found.clientId,
        source: "mcp",
      }
    );
    return result as CallToolResult;
  } catch (error) {
    return {
      content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
      isError: true,
    };
  }
}

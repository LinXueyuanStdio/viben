/**
 * Client Tool Executor for ACP Desktop Client
 *
 * Handles execution of client-side tools called by the ACP backend.
 * Integrates with the desktop app's action-system for GUI_execute.
 */

import { useActionStore } from "@/stores/action-store";
import { createExecutionContext } from "@/lib/action-system/execution-context";
import { executeBuiltin } from "@/lib/action-system/builtins";
import {
  createClientSideBash,
  isClientSideBashTool,
  type GUIExecuteInput,
} from "@/lib/action-system/client-side-bash";
import type { ClientToolResult } from "@/lib/client-side-tool/types";
import type { CallToolResult } from "./acp-client";

/**
 * Client tool execution request from ACP backend
 */
export interface ClientToolExecutionRequest {
  sessionId: string;
  toolCallId: string;
  toolName: string;
  input: unknown;
}

/**
 * Check if a tool name is a GUI_execute tool
 */
export function isGuiExecuteTool(toolName: string): boolean {
  return toolName === "GUI_execute"
    || toolName === "mcp__client_side__GUI_execute"
    || isClientSideBashTool(toolName);
}

/**
 * Helper to check if a value is a plain object
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Create an error result for CallToolResult
 */
function errorResult(text: string, meta?: Record<string, unknown>): CallToolResult {
  return {
    content: [{ type: "text", text }],
    isError: true,
    _meta: meta,
  };
}

/**
 * Convert ClientToolResult (from action-store) to CallToolResult (MCP format)
 */
function toCallToolResult(result: ClientToolResult): CallToolResult {
  return {
    content: result.content.map((item) => {
      if (item.type === "text") {
        return { type: "text" as const, text: item.text };
      }
      if (item.type === "image") {
        return { type: "image" as const, data: item.data, mimeType: item.mimeType };
      }
      return item;
    }),
    isError: result.isError,
    _meta: result.structuredContent,
  };
}

async function executeGUIAction(input: GUIExecuteInput, ctx: ReturnType<typeof createExecutionContext>): Promise<ClientToolResult> {
  const actionStore = useActionStore.getState();
  const actionName = typeof input.action === "string" ? input.action : "";
  const payload = normalizeBuiltinPayload(actionName, input.payload);

  if (!actionName) {
    return {
      content: [{ type: "text", text: "GUI_execute error: input.action is required." }],
      isError: true,
    };
  }

  const builtinResult = await executeBuiltin(actionName, payload, ctx);
  if (builtinResult !== null) {
    return builtinResult;
  }

  return await actionStore.execute(actionName, payload, ctx);
}

function normalizeBuiltinPayload(actionName: string, payload: unknown): unknown {
  if (actionName !== "get_action_detail" || !isRecord(payload) || typeof payload.action === "string") {
    return isRecord(payload) ? payload : {};
  }

  return typeof payload.name === "string" ? { ...payload, action: payload.name } : payload;
}

/**
 * Execute a GUI action based on the request.
 * Builtin actions are resolved before provider actions.
 */
export async function executeGuiAction(
  request: ClientToolExecutionRequest
): Promise<CallToolResult> {
  const input = isRecord(request.input) ? request.input : {};
  const actionName = typeof input.action === "string" ? input.action : "";
  const payload = isRecord(input.payload) ? input.payload : {};
  const ctx = createExecutionContext(request.sessionId, request.toolCallId);

  try {
    const result = await executeGUIAction({ action: actionName, payload }, ctx);
    return toCallToolResult(result);
  } catch (err) {
    return errorResult(
      `Action ${actionName} failed: ${err instanceof Error ? err.message : String(err)}`,
      { action: actionName, payload }
    );
  }
}

async function executeClientSideBash(request: ClientToolExecutionRequest): Promise<CallToolResult> {
  const input = isRecord(request.input) ? request.input : {};
  const script = typeof input.script === "string" ? input.script : "";
  const ctx = createExecutionContext(request.sessionId, request.toolCallId);
  const runtime = createClientSideBash({ executeGUIAction });
  const result = await runtime.execute({ script }, ctx);
  return toCallToolResult(result);
}

/**
 * Main entry point for executing client tools
 * Returns a Promise for async execution (action handlers may be async)
 */
export async function executeClientTool(
  request: ClientToolExecutionRequest
): Promise<CallToolResult> {
  if (isClientSideBashTool(request.toolName)) {
    return executeClientSideBash(request);
  }

  if (!isGuiExecuteTool(request.toolName)) {
    return errorResult(`Desktop client has no handler for tool: ${request.toolName}`, {
      toolName: request.toolName,
      supportedTools: ["GUI_execute", "mcp__client_side__GUI_execute", "ClientSideBash", "mcp__client_side__ClientSideBash"],
    });
  }

  return executeGuiAction(request);
}

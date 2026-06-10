/**
 * Client Tool Executor for ACP Desktop Client
 *
 * Handles execution of client-side tools called by the ACP backend.
 * Integrates with the desktop app's action-system for GUI_execute.
 */

import { useActionStore } from "@/stores/action-store";
import { createExecutionContext } from "@/lib/action-system/execution-context";
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
  return toolName === "GUI_execute" || toolName === "mcp__client_side__GUI_execute";
}

/**
 * Helper to check if a value is a plain object
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Create a text result for CallToolResult
 */
function textResult(text: string, meta?: Record<string, unknown>): CallToolResult {
  return {
    content: [{ type: "text", text }],
    _meta: meta,
  };
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

/**
 * Execute a GUI action based on the request
 * Uses the action-store to resolve and execute registered actions
 */
export async function executeGuiAction(
  request: ClientToolExecutionRequest
): Promise<CallToolResult> {
  const actionStore = useActionStore.getState();
  const input = isRecord(request.input) ? request.input : {};
  const actionName = typeof input.action === "string" ? input.action : "";
  const payload = isRecord(input.payload) ? input.payload : {};

  if (!actionName) {
    return errorResult("GUI_execute error: input.action is required.");
  }

  // Handle list_actions meta-action
  if (actionName === "list_actions") {
    const actions = actionStore.listActions();
    return textResult(JSON.stringify(actions, null, 2), { actions });
  }

  // Handle get_action_detail meta-action
  if (actionName === "get_action_detail") {
    const requestedAction =
      typeof payload.action === "string"
        ? payload.action
        : typeof payload.name === "string"
          ? payload.name
          : "";
    if (!requestedAction) {
      return errorResult("get_action_detail error: payload.action is required.");
    }
    const detail = actionStore.getActionDetail(requestedAction);
    if (!detail) {
      const available = actionStore.listActions().map((a) => a.name);
      return errorResult(`Action not found: ${requestedAction}`, {
        availableActions: available,
      });
    }
    return textResult(JSON.stringify(detail, null, 2), { action: detail });
  }

  // Execute the action through action-store
  // Use createExecutionContext to get proper requireApproval integration with the approval dialog
  const ctx = createExecutionContext(request.sessionId, request.toolCallId);

  try {
    const result = await actionStore.execute(actionName, payload, ctx);
    return toCallToolResult(result);
  } catch (err) {
    return errorResult(
      `Action ${actionName} failed: ${err instanceof Error ? err.message : String(err)}`,
      { action: actionName, payload }
    );
  }
}

/**
 * Main entry point for executing client tools
 * Returns a Promise for async execution (action handlers may be async)
 */
export async function executeClientTool(
  request: ClientToolExecutionRequest
): Promise<CallToolResult> {
  if (!isGuiExecuteTool(request.toolName)) {
    return errorResult(`Desktop client has no handler for tool: ${request.toolName}`, {
      toolName: request.toolName,
      supportedTools: ["GUI_execute", "mcp__client_side__GUI_execute"],
    });
  }

  return executeGuiAction(request);
}

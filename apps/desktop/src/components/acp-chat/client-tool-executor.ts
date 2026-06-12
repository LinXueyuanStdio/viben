/**
 * Client Tool Executor for ACP Desktop Client
 *
 * Handles execution of client-side tools called by the ACP backend.
 * GUI_execute is now handled via socket.io (GatewayActionSocket).
 * This module only handles ClientSideBash.
 */

import { createExecutionContext } from "@/lib/action-system/execution-context";
import { executeGUIAction } from "@/lib/action-system/action-executor";
import {
  createClientSideBash,
  isClientSideBashTool,
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

  return errorResult(`Desktop client has no handler for tool: ${request.toolName}`, {
    toolName: request.toolName,
    supportedTools: ["ClientSideBash", "mcp__client_side__ClientSideBash"],
  });
}

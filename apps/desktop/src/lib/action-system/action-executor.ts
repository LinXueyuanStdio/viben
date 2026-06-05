import type { ClientToolResult } from "../client-side-tool/types";
import { completeClientSideToolOnce } from "../client-side-tool/complete";
import { useActionStore } from "@/stores/action-store";
import { createExecutionContext } from "./execution-context";
import { executeBuiltin } from "./builtins";
import { UserCancelledException } from "./errors";
import {
  CLIENT_SIDE_BASH_TOOL_NAME,
  createClientSideBash,
  isClientSideBashTool,
  type GUIExecuteInput,
} from "./client-side-bash";

async function executeGUIAction(
  input: GUIExecuteInput,
  ctx: ReturnType<typeof createExecutionContext>
): Promise<ClientToolResult> {
  // Try built-in actions first
  const builtinResult = await executeBuiltin(input.action, input.payload ?? {}, ctx);
  if (builtinResult !== null) {
    return builtinResult;
  }

  // Delegate to action store
  const store = useActionStore.getState();
  return await store.execute(input.action, input.payload ?? {}, ctx);
}

/**
 * Handle a GUI_execute tool_use event from SSE.
 * Executes the action and posts the result back to the gateway.
 */
export async function handleGUIExecute(
  toolUseId: string,
  sessionId: string,
  input: { action: string; payload?: unknown }
): Promise<void> {
  const ctx = createExecutionContext(sessionId, toolUseId);
  let result: ClientToolResult;

  try {
    result = await executeGUIAction(input, ctx);
  } catch (err) {
    if (err instanceof UserCancelledException) {
      result = { content: [{ type: "text", text: "user_cancelled" }], isError: true };
    } else {
      result = { content: [{ type: "text", text: `execution_error: ${String(err)}` }], isError: true };
    }
  }

  // Post result back to gateway
  await completeClientSideToolOnce(toolUseId, sessionId, result);
}

/**
 * Handle a ClientSideBash tool_use event from SSE.
 * Runs a just-bash script in the desktop client and posts the result back.
 */
export async function handleClientSideBash(
  toolUseId: string,
  sessionId: string,
  input: { script: string }
): Promise<void> {
  const ctx = createExecutionContext(sessionId, toolUseId);
  const runtime = createClientSideBash({ executeGUIAction });
  const result = await runtime.execute(input, ctx);

  await completeClientSideToolOnce(toolUseId, sessionId, result);
}

/** Tool name constant for identification */
export const GUI_EXECUTE_TOOL_NAME = "GUI_execute";
export { CLIENT_SIDE_BASH_TOOL_NAME, isClientSideBashTool };

/**
 * Check if a tool name is the built-in GUI_execute tool.
 * Keep this exact to avoid a third-party MCP server triggering local GUI actions
 * by exposing a tool with the same suffix.
 */
export function isGUIExecuteTool(toolName: string): boolean {
  return toolName === GUI_EXECUTE_TOOL_NAME || toolName === `mcp__gui_action__${GUI_EXECUTE_TOOL_NAME}`;
}

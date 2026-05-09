import type { ClientToolResult } from "../client-side-tool/types";
import { completeClientSideToolOnce } from "../client-side-tool/complete";
import { useActionStore } from "@/stores/action-store";
import { createExecutionContext } from "./execution-context";
import { executeBuiltin } from "./builtins";
import { UserCancelledException } from "./errors";

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
    // Try built-in actions first
    const builtinResult = await executeBuiltin(input.action, input.payload ?? {}, ctx);
    if (builtinResult !== null) {
      result = builtinResult;
    } else {
      // Delegate to action store
      const store = useActionStore.getState();
      result = await store.execute(input.action, input.payload ?? {}, ctx);
    }
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

/** Tool name constant for identification */
export const GUI_EXECUTE_TOOL_NAME = "GUI_execute";

/**
 * Check if a tool name is the built-in GUI_execute tool.
 * Keep this exact to avoid a third-party MCP server triggering local GUI actions
 * by exposing a tool with the same suffix.
 */
export function isGUIExecuteTool(toolName: string): boolean {
  return toolName === GUI_EXECUTE_TOOL_NAME || toolName === `mcp__gui_action__${GUI_EXECUTE_TOOL_NAME}`;
}

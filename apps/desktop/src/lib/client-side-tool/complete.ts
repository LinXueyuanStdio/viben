import { completeClientTool } from "@/lib/gateway/modules/client-tools";
import type { ClientToolResult } from "./types";

const completedToolUseIds = new Set<string>();

export async function completeClientSideToolOnce(
  toolUseId: string,
  sessionId: string,
  result: ClientToolResult
): Promise<boolean> {
  if (!toolUseId || !sessionId || completedToolUseIds.has(toolUseId)) {
    return false;
  }

  completedToolUseIds.add(toolUseId);
  try {
    await completeClientTool({
      tool_use_id: toolUseId,
      session_id: sessionId,
      result,
    });
    return true;
  } catch (err) {
    completedToolUseIds.delete(toolUseId);
    throw err;
  }
}

export function hasCompletedClientSideTool(toolUseId: string): boolean {
  return completedToolUseIds.has(toolUseId);
}

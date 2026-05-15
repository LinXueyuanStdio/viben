import type { AgentMessage } from "../types";
import type { ToolPair } from "./types";

/**
 * Stage 2: Pair each tool_use with its matching tool_result.
 *
 * @param normalizedMessages - Messages after normalization (no tool_result present)
 * @param allMessages - Original full message array (includes tool_result for lookup)
 * @returns Array of ToolPair objects for tool_use messages only
 */
export function groupToolPairs(
  normalizedMessages: AgentMessage[],
  allMessages: AgentMessage[]
): ToolPair[] {
  // Build result lookup from the full message array
  const resultMap = new Map<string, AgentMessage>();
  for (const msg of allMessages) {
    if (msg.type === "tool_result" && msg.toolUseId) {
      resultMap.set(msg.toolUseId, msg);
    }
  }

  const pairs: ToolPair[] = [];
  for (let i = 0; i < normalizedMessages.length; i++) {
    const msg = normalizedMessages[i];
    if (msg.type !== "tool_use" || !msg.toolUseId) continue;

    pairs.push({
      toolUse: msg,
      toolResult: resultMap.get(msg.toolUseId),
      originalIndex: i,
    });
  }

  return pairs;
}

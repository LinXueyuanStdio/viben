import type { AgentMessage } from "../types";
import type { PipelineLookups, ProcessedItem } from "./types";

/**
 * Stage 4: Build O(1) lookup maps from the processed items.
 *
 * Maps:
 * - toolUseId → tool_result message (for checking completion state)
 * - toolUseId → tool_use message (for resolving tool call info)
 * - message id → index in processedItems (for scroll-to-message)
 */
export function buildPipelineLookups(
  allMessages: AgentMessage[],
  processedItems: ProcessedItem[]
): PipelineLookups {
  const resultByToolUseId = new Map<string, AgentMessage>();
  const toolUseById = new Map<string, AgentMessage>();

  for (const msg of allMessages) {
    if (msg.type === "tool_result" && msg.toolUseId) {
      resultByToolUseId.set(msg.toolUseId, msg);
    }
    if (msg.type === "tool_use" && msg.toolUseId) {
      toolUseById.set(msg.toolUseId, msg);
    }
  }

  const indexById = new Map<string, number>();
  for (let i = 0; i < processedItems.length; i++) {
    const item = processedItems[i];
    if (item.type === "message" && item.message.id) {
      indexById.set(item.message.id, i);
    }
  }

  return { resultByToolUseId, toolUseById, indexById };
}

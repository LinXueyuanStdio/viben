import type { AgentMessage } from "../types";

/**
 * Stage 1: Normalize raw messages.
 * - Merge consecutive streaming text (keep last)
 * - Remove duplicate plan messages (keep last)
 * - Filter out raw plan JSON text
 * - Remove tool_result messages (they are paired via lookups)
 *
 * Returns a new array (no mutation).
 */
export function normalizeMessages(messages: AgentMessage[]): AgentMessage[] {
  // Find last plan index
  let lastPlanIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].type === "plan") {
      lastPlanIdx = i;
      break;
    }
  }

  const result: AgentMessage[] = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    // Skip tool_result — they are consumed via lookup
    if (msg.type === "tool_result") continue;

    // Skip duplicate plan messages (keep only last)
    if (msg.type === "plan" && i !== lastPlanIdx) continue;

    // Skip text that looks like raw plan JSON
    if (msg.type === "text" && msg.content) {
      const trimmed = msg.content.trim();
      if (
        trimmed.startsWith("{") &&
        trimmed.includes('"type"') &&
        trimmed.includes('"plan"')
      ) {
        continue;
      }
    }

    // Merge consecutive text messages (keep last in a run)
    if (msg.type === "text" && msg.content) {
      const next = messages[i + 1];
      if (next && next.type === "text" && next.content) {
        // Skip this one — next is a more complete streaming update
        continue;
      }
    }

    result.push(msg);
  }

  return result;
}

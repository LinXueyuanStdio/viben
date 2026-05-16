import type { AgentMessage } from "../types";

/**
 * Determines whether a message is "static" — i.e., its content will not change.
 *
 * A message is static when:
 * 1. It is NOT the currently streaming message
 * 2. If it is a `tool_use` message, it has a matching `tool_result` (output is defined)
 * 3. All other message types (user, text, result, error, thinking, plan) are always static
 *    once they exist in the array
 *
 * Reference: Claude Code's `shouldRenderStatically` in Messages.tsx (lines 1054-1114)
 * checks streaming/inProgress/resolved status. Our simplified version checks:
 * - tool_use with no output = not static (still executing)
 * - everything else = static
 */
export function isMessageStatic(
  message: AgentMessage,
  isStreamingMessage: boolean,
): boolean {
  // A message that is actively being streamed is never static
  if (isStreamingMessage) {
    return false;
  }

  // tool_use without output means the tool is still executing (no tool_result received yet)
  if (message.type === "tool_use" && message.output === undefined) {
    return false;
  }

  // All other messages are static once they exist
  return true;
}

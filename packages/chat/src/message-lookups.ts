import type { AgentMessage } from "./types";

/**
 * Pre-computed lookup maps for O(1) access to tool result data.
 *
 * Built in a single O(n) pass over messages by `buildMessageLookups()`.
 * Avoids the O(n) per-render scan + mutation pattern of the old `groupMessages()`.
 *
 * Reference: Claude Code's `MessageLookups` in `infra/claude-code/src/utils/messages.ts`
 */
export interface MessageLookups {
  /** Maps tool_use_id -> the tool_result AgentMessage */
  toolResultByUseId: Map<string, AgentMessage>;
  /** Set of tool_use_ids that have a corresponding tool_result */
  resolvedIds: Set<string>;
  /** Set of tool_use_ids whose tool_result has isError=true */
  errorIds: Set<string>;
  /** Set of tool_use_ids that have NO corresponding tool_result (still executing) */
  inProgressIds: Set<string>;
}

/** Empty lookups singleton for contexts that don't need real lookups. */
export const EMPTY_LOOKUPS: MessageLookups = {
  toolResultByUseId: new Map(),
  resolvedIds: new Set(),
  errorIds: new Set(),
  inProgressIds: new Set(),
};

/**
 * Build pre-computed lookups for O(1) access to tool resolution state.
 *
 * Single O(n) pass: collects all tool_use IDs, then all tool_result messages,
 * then derives in-progress = tool_use IDs without a matching tool_result.
 *
 * This is a pure function — no mutation of the input messages array.
 */
export function buildMessageLookups(messages: AgentMessage[]): MessageLookups {
  const toolResultByUseId = new Map<string, AgentMessage>();
  const resolvedIds = new Set<string>();
  const errorIds = new Set<string>();
  const toolUseIds = new Set<string>();

  for (const msg of messages) {
    if (msg.type === "tool_use" && msg.toolUseId) {
      toolUseIds.add(msg.toolUseId);
    } else if (msg.type === "tool_result" && msg.toolUseId) {
      toolResultByUseId.set(msg.toolUseId, msg);
      resolvedIds.add(msg.toolUseId);
      if (msg.isError) {
        errorIds.add(msg.toolUseId);
      }
    }
  }

  // In-progress = tool_use IDs that have no matching tool_result
  const inProgressIds = new Set<string>();
  for (const id of toolUseIds) {
    if (!resolvedIds.has(id)) {
      inProgressIds.add(id);
    }
  }

  return { toolResultByUseId, resolvedIds, errorIds, inProgressIds };
}

/**
 * Incrementally update lookups by processing only newly appended messages.
 *
 * Returns the mutated lookups object if the update succeeded (append-only case),
 * or null if a full rebuild is needed (messages were removed or reordered).
 */
export function updateMessageLookupsIncremental(
  existing: MessageLookups,
  previousCount: number,
  messages: AgentMessage[],
): MessageLookups | null {
  // Safety: only handle append-only
  if (messages.length < previousCount) {
    return null;
  }

  // No new messages
  if (messages.length === previousCount) {
    return existing;
  }

  // Process only new messages (from previousCount onward)
  for (let i = previousCount; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.type === "tool_use" && msg.toolUseId) {
      existing.inProgressIds.add(msg.toolUseId);
    } else if (msg.type === "tool_result" && msg.toolUseId) {
      existing.toolResultByUseId.set(msg.toolUseId, msg);
      existing.resolvedIds.add(msg.toolUseId);
      existing.inProgressIds.delete(msg.toolUseId);
      if (msg.isError) {
        existing.errorIds.add(msg.toolUseId);
      }
    }
  }

  return existing;
}

import type { AgentMessage } from "../types";
import type { ProcessedItem, ProcessedMessages } from "./types";
import { normalizeMessages } from "./normalize";
import { collapseConsecutiveTools } from "./collapse-read-search";
import { buildPipelineLookups } from "./build-lookups";

/**
 * Full message preprocessing pipeline.
 *
 * Stages:
 * 1. normalizeMessages() — merge streaming text, deduplicate plans, remove tool_result
 * 2. Convert to ProcessedItem[] (flat list of {type: "message"} wrappers)
 * 3. collapseConsecutiveTools() — merge consecutive read/search/bash into CollapsedGroup
 * 4. buildPipelineLookups() — O(1) lookup tables
 *
 * @param messages - Raw message array from the chat hook
 * @param simpleMode - Skip grouping/collapsing (for read-only executor views)
 * @returns ProcessedMessages with items + lookups
 */
export function preprocessMessages(
  messages: AgentMessage[],
  simpleMode: boolean
): ProcessedMessages {
  // Simple mode: no transformation, just wrap each message
  if (simpleMode) {
    const items: ProcessedItem[] = messages.map((msg, i) => ({
      type: "message" as const,
      message: msg,
      originalIndex: i,
    }));
    const lookups = buildPipelineLookups(messages, items);
    return { items, lookups, hasActiveGroup: false };
  }

  // Stage 1: Normalize
  const normalized = normalizeMessages(messages);

  // Stage 2: Convert to ProcessedItem[]
  const items: ProcessedItem[] = normalized.map((msg, i) => ({
    type: "message" as const,
    message: msg,
    originalIndex: i,
  }));

  // Stage 3: Collapse consecutive read/search/bash
  const collapsed = collapseConsecutiveTools(items, messages);

  // Stage 4: Build lookups
  const lookups = buildPipelineLookups(messages, collapsed);

  // Determine if there's an active (unresolved) tool group
  const hasActiveGroup = determineHasActiveGroup(messages);

  return { items: collapsed, lookups, hasActiveGroup };
}

/**
 * Check if any tool_use message lacks a matching tool_result.
 * Scans backwards for efficiency (latest unresolved is most relevant).
 */
function determineHasActiveGroup(messages: AgentMessage[]): boolean {
  const resolvedIds = new Set<string>();
  for (const msg of messages) {
    if (msg.type === "tool_result" && msg.toolUseId) {
      resolvedIds.add(msg.toolUseId);
    }
  }
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.type === "tool_use" && msg.toolUseId) {
      if (!resolvedIds.has(msg.toolUseId)) return true;
    }
  }
  return false;
}

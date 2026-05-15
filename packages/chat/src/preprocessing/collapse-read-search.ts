import type { AgentMessage } from "../types";
import type { CollapsedCounts, CollapsedGroup, ProcessedItem, ToolPair } from "./types";
import { getDisplayPath } from "../utils";

/** Tool names that are collapsible (read-only operations) */
const COLLAPSIBLE_TOOLS = new Set(["Read", "Glob", "Grep", "Bash"]);

/** Check if a tool_use message is collapsible */
function isCollapsibleTool(msg: AgentMessage): boolean {
  return msg.type === "tool_use" && COLLAPSIBLE_TOOLS.has(msg.name || "");
}

/** Categorize a tool name into a count bucket */
function categorize(name: string): keyof CollapsedCounts {
  switch (name) {
    case "Read": return "read";
    case "Glob":
    case "Grep": return "search";
    case "Bash": return "bash";
    case "Write": return "write";
    case "Edit":
    case "MultiEdit": return "edit";
    default: return "other";
  }
}

/** Extract a display hint from a tool input */
function extractHint(name: string, input: Record<string, unknown> | undefined): string {
  if (!input) return "";
  switch (name) {
    case "Read":
    case "Write":
    case "Edit":
    case "MultiEdit":
      return input.file_path ? getDisplayPath(String(input.file_path)) : "";
    case "Grep":
      return input.pattern ? `"${String(input.pattern).slice(0, 30)}"` : "";
    case "Glob":
      return input.pattern ? String(input.pattern).slice(0, 40) : "";
    case "Bash":
      return input.command ? `$ ${String(input.command).slice(0, 50)}` : "";
    default:
      return "";
  }
}

/** Build a CollapsedGroup from a run of collapsible tool messages */
function buildCollapsedGroup(
  run: { item: ProcessedItem; msg: AgentMessage }[],
  allMessages: AgentMessage[]
): CollapsedGroup {
  // Build result lookup
  const resultMap = new Map<string, AgentMessage>();
  for (const msg of allMessages) {
    if (msg.type === "tool_result" && msg.toolUseId) {
      resultMap.set(msg.toolUseId, msg);
    }
  }

  const counts: CollapsedCounts = { read: 0, search: 0, bash: 0, write: 0, edit: 0, other: 0 };
  const pairs: ToolPair[] = [];
  let latestHint = "";

  for (const { item, msg } of run) {
    const category = categorize(msg.name || "");
    counts[category]++;
    const hint = extractHint(msg.name || "", msg.input);
    if (hint) latestHint = hint;
    pairs.push({
      toolUse: msg,
      toolResult: msg.toolUseId ? resultMap.get(msg.toolUseId) : undefined,
      originalIndex: item.type === "message" ? item.originalIndex : 0,
    });
  }

  return {
    type: "collapsed_group",
    pairs,
    counts,
    latestHint,
    timestamp: run[0]?.msg.timestamp,
  };
}

/**
 * Stage 3: Collapse consecutive collapsible tool_use messages into CollapsedGroup items.
 *
 * Rules:
 * - Groups 2+ consecutive collapsible tools (Read, Glob, Grep, Bash)
 * - Breaks on: text messages, non-collapsible tools (Write, Edit), user messages
 * - A single collapsible tool is left as-is (not collapsed)
 */
export function collapseConsecutiveTools(
  items: ProcessedItem[],
  allMessages: AgentMessage[]
): ProcessedItem[] {
  const result: ProcessedItem[] = [];
  let currentRun: { item: ProcessedItem; msg: AgentMessage }[] = [];

  function flushRun() {
    if (currentRun.length >= 2) {
      result.push({
        type: "collapsed_group",
        group: buildCollapsedGroup(currentRun, allMessages),
      });
    } else if (currentRun.length === 1) {
      result.push(currentRun[0].item);
    }
    currentRun = [];
  }

  for (const item of items) {
    if (item.type === "message" && isCollapsibleTool(item.message)) {
      currentRun.push({ item, msg: item.message });
    } else {
      flushRun();
      result.push(item);
    }
  }

  flushRun();
  return result;
}

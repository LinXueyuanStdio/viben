import type { AgentMessage } from "../types";

/** A tool_use message paired with its matching tool_result */
export interface ToolPair {
  toolUse: AgentMessage;
  toolResult: AgentMessage | undefined;
  /** Original index in the normalized message array */
  originalIndex: number;
}

/** A group of same-response tool_use messages (same API response) */
export interface ToolPairGroup {
  type: "tool_pair_group";
  pairs: ToolPair[];
  /** First tool_use timestamp for ordering */
  timestamp: number | undefined;
}

/** A run of consecutive collapsible tools (Read/Glob/Grep/Bash) collapsed into one line */
export interface CollapsedGroup {
  type: "collapsed_group";
  pairs: ToolPair[];
  counts: CollapsedCounts;
  /** Display hint from last tool (e.g. file path or pattern) */
  latestHint: string;
  /** Timestamp of the first pair */
  timestamp: number | undefined;
}

/** Counts for collapsed group summary text */
export interface CollapsedCounts {
  read: number;
  search: number;
  bash: number;
  write: number;
  edit: number;
  other: number;
}

/** A renderable item in the processed message list */
export type ProcessedItem =
  | { type: "message"; message: AgentMessage; originalIndex: number }
  | { type: "collapsed_group"; group: CollapsedGroup }
  | { type: "task_group"; title: string; description: string; pairs: ToolPair[]; isCompleted: boolean };

/** O(1) lookup tables built from messages */
export interface PipelineLookups {
  /** toolUseId → matching tool_result message */
  resultByToolUseId: Map<string, AgentMessage>;
  /** toolUseId → tool_use message */
  toolUseById: Map<string, AgentMessage>;
  /** message id → index in processedItems */
  indexById: Map<string, number>;
}

/** Final output of the preprocessing pipeline */
export interface ProcessedMessages {
  items: ProcessedItem[];
  lookups: PipelineLookups;
  /** Whether the last group is still in progress (no result yet) */
  hasActiveGroup: boolean;
}

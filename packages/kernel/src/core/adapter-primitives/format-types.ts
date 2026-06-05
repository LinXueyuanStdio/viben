// src/adapters/shared/format-types.ts
//
// Shared type definitions for message formatting, tool display, and
// output verbosity across all adapters.

/**
 * Controls how much detail is shown in agent output.
 * - `"low"` — minimal: hides thoughts, usage, noisy tool calls
 * - `"medium"` — balanced: shows tool summaries, hides noise
 * - `"high"` — full: shows everything including tool output and thoughts
 */
export type OutputMode = "low" | "medium" | "high";
/** @deprecated Use OutputMode instead */
export type DisplayVerbosity = OutputMode;

/**
 * Action to take for a tool call classified as noise.
 * - `"hide"` — suppress entirely (not shown at any verbosity except high)
 * - `"collapse"` — show minimally (hidden only at low verbosity)
 */
export type NoiseAction = "hide" | "collapse";

/** Rule that classifies a tool call as noise based on its name, kind, and input. */
export interface NoiseRule {
  match: (name: string, kind: string, rawInput: unknown) => boolean;
  action: NoiseAction;
}

/** Visual style category for rendering a formatted message. */
export type MessageStyle =
  | "text"
  | "thought"
  | "tool"
  | "plan"
  | "usage"
  | "system"
  | "error"
  | "attachment";

/** Structured metadata attached to a formatted message for rendering decisions. */
export interface MessageMetadata {
  toolName?: string;
  toolStatus?: string;
  toolKind?: string;
  filePath?: string;
  command?: string;
  planEntries?: { content: string; status: string }[];
  tokens?: number;
  contextSize?: number;
  cost?: number;
  viewerLinks?: ViewerLinks;
  viewerFilePath?: string;
}

/**
 * Platform-agnostic formatted message ready for rendering.
 * Summary and detail are always plain text — renderers handle
 * escaping for their target format (HTML, markdown, etc.).
 */
export interface FormattedMessage {
  summary: string;
  detail?: string;
  viewerLinks?: ViewerLinks;
  icon: string;
  originalType: string;
  style: MessageStyle;
  metadata?: MessageMetadata;
}

/** Maps tool call status strings to emoji icons for display. */
export const STATUS_ICONS: Record<string, string> = {
  pending: "⏳",
  in_progress: "🔄",
  completed: "✅",
  failed: "❌",
  cancelled: "🚫",
  running: "🔄",
  done: "✅",
  error: "❌",
};

/** Maps tool kind strings to emoji icons for display. */
export const KIND_ICONS: Record<string, string> = {
  read: "📖",
  edit: "✏️",
  write: "✏️",
  delete: "🗑️",
  execute: "▶️",
  command: "▶️",
  bash: "▶️",
  terminal: "▶️",
  search: "🔍",
  web: "🌐",
  fetch: "🌐",
  agent: "🧠",
  think: "🧠",
  install: "📦",
  move: "📦",
  other: "🛠️",
};

/** Maps tool kind strings to human-readable labels for UI display. */
export const KIND_LABELS: Record<string, string> = {
  read: "Read",
  edit: "Edit",
  write: "Write",
  delete: "Delete",
  execute: "Run",
  bash: "Bash",
  command: "Run",
  terminal: "Terminal",
  search: "Search",
  web: "Web",
  fetch: "Fetch",
  agent: "Agent",
  think: "Agent",
  install: "Install",
  move: "Move",
};

/** Links to the web viewer for file contents or diffs. */
export interface ViewerLinks {
  file?: string;
  diff?: string;
}

/**
 * Metadata extracted from a tool_call agent event.
 * Carried on OutgoingMessage.metadata for rendering by adapters.
 */
export interface ToolCallMeta {
  id: string;
  name: string;
  /** Semantic kind (read, edit, execute, search, etc.) used for icon/label selection. */
  kind?: string;
  status?: string;
  content?: unknown;
  rawInput?: unknown;
  viewerLinks?: ViewerLinks;
  viewerFilePath?: string;
  /** Agent-provided summary override (takes precedence over auto-generated summary). */
  displaySummary?: string;
  /** Agent-provided title override (takes precedence over auto-generated title). */
  displayTitle?: string;
  /** Agent-provided kind override (takes precedence over inferred kind). */
  displayKind?: string;
}

/** Metadata for a tool_update event — same as ToolCallMeta but status is required. */
export interface ToolUpdateMeta extends ToolCallMeta {
  status: string;
}

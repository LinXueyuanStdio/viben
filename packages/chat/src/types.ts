/**
 * Chat and Agent types for @viben/chat package
 */

// ============================================================================
// Message Attachment Types
// ============================================================================

/** Message attachment (image or file) */
export interface MessageAttachment {
  id: string;
  type: "image" | "file";
  name: string;
  data?: string; // Base64 data URL for images (for UI preview)
  path?: string; // Local file path (for sending to agent)
  mimeType?: string;
  isLoading?: boolean;
}

// ============================================================================
// Agent Message Types
// ============================================================================

/** Agent message types */
export type AgentMessageType =
  | "user"
  | "text"
  | "thinking"
  | "tool_use"
  | "tool_result"
  | "plan"
  | "result"
  | "error"
  | "ask_question"  // AskUserQuestion tool call
  | "plan_mode";    // EnterPlanMode/ExitPlanMode tool calls

/** Task plan step */
export interface TaskPlanStep {
  id: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "failed" | "cancelled";
}

/** Task plan */
export interface TaskPlan {
  id?: string;
  goal: string;
  steps: TaskPlanStep[];
  notes?: string;
  approvalStatus?: "pending" | "approved" | "rejected";
}

/** Question option in interactive question */
export interface QuestionOption {
  label: string;
  description?: string;
}

/** Interactive question from agent */
export interface AgentQuestion {
  header: string;
  question: string;
  options: QuestionOption[];
  multiSelect: boolean;
}

/** Pending question waiting for user response */
export interface PendingQuestion {
  id: string;
  questions: AgentQuestion[];
}

/** Content block in tool output (text or image) */
export interface TextContentBlock {
  type: "text";
  text: string;
}

export interface ImageContentBlock {
  type: "image";
  source: {
    type: "base64";
    media_type: string;
    data: string;
  };
}

export type ContentBlock = TextContentBlock | ImageContentBlock;

/** Agent message */
export interface AgentMessage {
  id?: string;
  type: AgentMessageType;
  content?: string;
  name?: string; // Tool name for tool_use
  input?: Record<string, unknown>; // Tool input for tool_use
  output?: string | ContentBlock[]; // Tool output for tool_result (string or content blocks with images)
  toolUseId?: string; // For matching tool_result to tool_use
  isError?: boolean;
  message?: string; // Error message
  plan?: TaskPlan; // For plan type
  attachments?: MessageAttachment[]; // For user messages with attachments
  questions?: AgentQuestion[]; // For ask_question type (AskUserQuestion tool)
  planModeAction?: "enter" | "exit"; // For plan_mode type
  subagentId?: string; // For Agent/Task tool, the subagent ID
  subagentMessages?: AgentMessage[]; // For Agent/Task tool, recursively loaded subagent messages
  timestamp?: number; // Unix timestamp (ms) for turn separator display
}

/** Context passed when opening a Task/Agent subagent transcript. */
export interface SubagentOpenContext {
  subagentId?: string;
  toolUseId?: string;
  parentMessage?: AgentMessage;
  messages?: AgentMessage[];
}

export type ExpandSubagentHandler = (
  title: string,
  subagentType: string | undefined,
  messages: AgentMessage[],
  context?: SubagentOpenContext
) => void;

// ============================================================================
// Streaming Text Types
// ============================================================================

/**
 * Streaming text state for the MessageList component.
 * When non-null, the streaming block is shown as a separate sibling
 * after the message list — avoiding full list reconciliation.
 *
 * Parent contract (atomic transition):
 * 1. During streaming: set `streamingText` to current accumulated text
 * 2. On stream end: in ONE setState batch, set `streamingText = null`
 *    AND append the final assistant message to the messages array
 */
export type StreamingTextState = string | null;

// ============================================================================
// Slash Command Types
// ============================================================================

/** Slash command definition */
export interface SlashCommand {
  id: string;
  name: string;
  description: string;
  icon?: React.ReactNode;
}

// ============================================================================
// Config Types
// ============================================================================

/** Tool configuration for tools popover */
export interface ToolConfig {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
}

/** Skill configuration for skills popover */
export interface SkillConfig {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
}

/** Context token breakdown for details popover */
export interface ContextTokenBreakdown {
  /** Tokens used by assistant profile/persona */
  assistantProfile: number;
  /** Tokens used by skill settings */
  skillSettings: number;
  /** Tokens used by history summary */
  historySummary: number;
  /** Tokens used by conversation messages */
  conversationMessages: number;
  /** Total context window size */
  totalContext: number;
}

// ============================================================================
// Selector Option Types (Generic)
// ============================================================================

/** Generic selector option for dropdowns */
export interface SelectorOption {
  id: string;
  name: string;
  description?: string;
  icon?: string;
}

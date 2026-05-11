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
  goal: string;
  steps: TaskPlanStep[];
  notes?: string;
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

/** Agent message */
export interface AgentMessage {
  id?: string;
  type: AgentMessageType;
  content?: string;
  name?: string; // Tool name for tool_use
  input?: Record<string, unknown>; // Tool input for tool_use
  output?: string; // Tool output for tool_result
  toolUseId?: string; // For matching tool_result to tool_use
  isError?: boolean;
  message?: string; // Error message
  plan?: TaskPlan; // For plan type
  attachments?: MessageAttachment[]; // For user messages with attachments
  questions?: AgentQuestion[]; // For ask_question type (AskUserQuestion tool)
  planModeAction?: "enter" | "exit"; // For plan_mode type
  subagentId?: string; // For Task tool, the subagent ID
  subagentMessages?: AgentMessage[]; // For Task tool, recursively loaded subagent messages
  timestamp?: number; // Unix timestamp (ms) for turn separator display
}

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

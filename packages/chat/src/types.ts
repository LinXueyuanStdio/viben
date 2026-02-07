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
  data?: string; // Base64 data URL for images
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
  | "tool_use"
  | "tool_result"
  | "plan"
  | "result"
  | "error";

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
// Agent/Executor Types
// ============================================================================

/** Base coding agent type identifier */
export type BaseCodingAgent =
  | "CLAUDE_CODE"
  | "AMP"
  | "GEMINI"
  | "CODEX"
  | "OPENCODE"
  | "CURSOR_AGENT"
  | "QWEN_CODE"
  | "COPILOT"
  | "DROID";

/** Agent type metadata for UI display */
export interface AgentTypeInfo {
  id: BaseCodingAgent;
  name: string;
  description: string;
  icon?: string;
  docsUrl?: string;
}

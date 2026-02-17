/**
 * Chat and Agent types for workspace chat integration
 */

/** Message attachment (image or file) */
export interface MessageAttachment {
  id: string;
  type: "image" | "file";
  name: string;
  data?: string; // Base64 data URL for images
  mimeType?: string;
  isLoading?: boolean;
}

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
}

/** Agent phase */
export type AgentPhase =
  | "idle"
  | "running"
  | "awaiting_approval"
  | "awaiting_input"
  | "completed"
  | "error";

/** Artifact types for preview */
export type ArtifactType =
  | "html"
  | "jsx"
  | "css"
  | "json"
  | "markdown"
  | "csv"
  | "pdf"
  | "document"
  | "spreadsheet"
  | "presentation"
  | "image"
  | "audio"
  | "video"
  | "font"
  | "code"
  | "text"
  | "websearch";

/** Artifact for sidebar display */
export interface Artifact {
  id: string;
  name: string;
  type: ArtifactType;
  content?: string;
  path?: string;
  fileSize?: number;
  fileTooLarge?: boolean;
  /** ID of the message that created this artifact (for message-artifact linking) */
  sourceMessageId?: string;
  /** Tool name that created this artifact (e.g., "Write", "Edit", "WebSearch") */
  toolName?: string;
  /** Timestamp when the artifact was created */
  createdAt?: number;
}

/** Working file in file tree */
export interface WorkingFile {
  name: string;
  path: string;
  isDir: boolean;
  children?: WorkingFile[];
  isExpanded?: boolean;
}

/** Tool usage info for sidebar */
export interface ToolUsage {
  id: string;
  /** Claude's tool_use_id for matching with tool_result */
  toolUseId?: string;
  name: string;
  displayName: string;
  input: unknown;
  output?: string;
  isError?: boolean;
  timestamp: number;
  completedAt?: number;
}

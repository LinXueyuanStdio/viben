/**
 * Database types for chat sessions, tasks, and messages persistence
 *
 * These types define the structure for persisting chat conversations
 * in the desktop application. Supports both SQLite (via Tauri plugin)
 * and IndexedDB (browser fallback).
 */

import type { MessageAttachment, AgentMessageType } from "@/types/chat";

// ============ Task Status ============

/** Status of a task/conversation */
export type TaskStatus = "running" | "completed" | "error" | "stopped";

// ============ Session ============

/**
 * Session represents a conversation context that can contain multiple tasks.
 * Each session groups related tasks together.
 */
export interface Session {
  /** Unique identifier (format: YYYYMMDDHHmmss_slug) */
  id: string;
  /** Original prompt that started the session */
  prompt: string;
  /** Workspace ID this session belongs to */
  workspace_id: string;
  /** Number of tasks in this session */
  task_count: number;
  /** ISO timestamp of creation */
  created_at: string;
  /** ISO timestamp of last update */
  updated_at: string;
}

/** Input for creating a new session */
export interface CreateSessionInput {
  /** Unique identifier */
  id: string;
  /** Initial prompt */
  prompt: string;
  /** Workspace ID */
  workspace_id: string;
}

// ============ Task ============

/**
 * Task represents a single conversation exchange within a session.
 * A session may contain multiple tasks (follow-up questions).
 */
export interface Task {
  /** Unique identifier */
  id: string;
  /** Parent session ID */
  session_id: string;
  /** Workspace ID this task belongs to */
  workspace_id: string;
  /** Index within the session (1, 2, 3...) */
  task_index: number;
  /** User prompt for this task */
  prompt: string;
  /** Current status */
  status: TaskStatus;
  /** API cost in USD (if available) */
  cost: number | null;
  /** Duration in milliseconds */
  duration: number | null;
  /** Whether task is favorited */
  favorite?: boolean;
  /** ISO timestamp of creation */
  created_at: string;
  /** ISO timestamp of last update */
  updated_at: string;
}

/** Input for creating a new task */
export interface CreateTaskInput {
  /** Unique identifier */
  id: string;
  /** Parent session ID */
  session_id: string;
  /** Workspace ID */
  workspace_id: string;
  /** Index within session */
  task_index: number;
  /** User prompt */
  prompt: string;
}

/** Input for updating an existing task */
export interface UpdateTaskInput {
  status?: TaskStatus;
  cost?: number;
  duration?: number;
  prompt?: string;
  favorite?: boolean;
}

// ============ Message ============

/**
 * Message represents a single message in a task conversation.
 * Messages can be user input, AI text, tool calls, or results.
 */
export interface Message {
  /** Auto-increment ID */
  id: number;
  /** Parent task ID */
  task_id: string;
  /** Message type */
  type: AgentMessageType;
  /** Text content (for text/user/result/error types) */
  content: string | null;
  /** Tool name (for tool_use type) */
  tool_name: string | null;
  /** JSON string of tool input (for tool_use type) */
  tool_input: string | null;
  /** Tool output (for tool_result type) */
  tool_output: string | null;
  /** Links tool_result to tool_use */
  tool_use_id: string | null;
  /** Subtype (e.g., 'success', 'error_max_turns' for result type) */
  subtype: string | null;
  /** Error message (for error type) */
  error_message: string | null;
  /** JSON string of MessageAttachment[] (for user type) */
  attachments: string | null;
  /** JSON string of plan data (for plan type) */
  plan: string | null;
  /** ISO timestamp of creation */
  created_at: string;
}

/** Input for creating a new message */
export interface CreateMessageInput {
  task_id: string;
  type: AgentMessageType;
  content?: string;
  tool_name?: string;
  tool_input?: string;
  tool_output?: string;
  tool_use_id?: string;
  subtype?: string;
  error_message?: string;
  attachments?: string;
  plan?: string;
}

// ============ Library File ============

/**
 * File types for library/artifacts
 */
export type FileType =
  | "image"
  | "text"
  | "code"
  | "document"
  | "website"
  | "presentation"
  | "spreadsheet"
  | "audio"
  | "video";

/**
 * LibraryFile represents a generated artifact/file from a task.
 */
export interface LibraryFile {
  /** Auto-increment ID */
  id: number;
  /** Parent task ID */
  task_id: string;
  /** File name */
  name: string;
  /** File type category */
  type: FileType;
  /** Full file path */
  path: string;
  /** Preview content or data URL */
  preview: string | null;
  /** Thumbnail for images */
  thumbnail: string | null;
  /** Whether file is favorited */
  is_favorite: boolean;
  /** ISO timestamp of creation */
  created_at: string;
}

/** Input for creating a new library file */
export interface CreateFileInput {
  task_id: string;
  name: string;
  type: FileType;
  path: string;
  preview?: string;
  thumbnail?: string;
}

// ============ Utility Types ============

/**
 * Result type for grouped files by task
 */
export interface TaskWithFiles {
  task: Task;
  files: LibraryFile[];
}

/**
 * Helper to parse attachments JSON
 */
export function parseAttachments(json: string | null): MessageAttachment[] {
  if (!json) return [];
  try {
    return JSON.parse(json) as MessageAttachment[];
  } catch {
    return [];
  }
}

/**
 * Helper to serialize attachments to JSON
 */
export function serializeAttachments(
  attachments: MessageAttachment[] | undefined
): string | undefined {
  if (!attachments || attachments.length === 0) return undefined;
  return JSON.stringify(attachments);
}

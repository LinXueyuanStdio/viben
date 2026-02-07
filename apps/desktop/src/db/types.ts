/**
 * Database types for chat sessions, tasks, and messages
 * Desktop-only (SQLite via Tauri SQL plugin)
 */

// ============ Task Status ============

export type TaskStatus = "running" | "completed" | "error" | "stopped";

// ============ Message Types ============

export type MessageType =
  | "text"
  | "tool_use"
  | "tool_result"
  | "result"
  | "error"
  | "user"
  | "plan";

// ============ File Types ============

export type FileType =
  | "image"
  | "text"
  | "code"
  | "document"
  | "website"
  | "presentation"
  | "spreadsheet";

// ============ Core Entities ============

/**
 * Session represents a conversation context that can contain multiple tasks
 */
export interface Session {
  id: string; // Format: YYYYMMDDHHmmss_slug
  prompt: string; // Original prompt that started the session
  task_count: number; // Number of tasks in this session
  created_at: string;
  updated_at: string;
}

/**
 * Task represents an individual conversation task within a session
 */
export interface Task {
  id: string;
  session_id: string; // Reference to session
  task_index: number; // Index within session (1, 2, 3...)
  prompt: string;
  status: TaskStatus;
  cost: number | null;
  duration: number | null;
  favorite: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Message represents a single message in a task conversation
 */
export interface Message {
  id: number;
  task_id: string;
  type: MessageType;
  content: string | null;
  tool_name: string | null;
  tool_input: string | null;
  tool_output: string | null;
  tool_use_id: string | null;
  subtype: string | null;
  error_message: string | null;
  attachments: string | null; // JSON string of MessageAttachment[]
  created_at: string;
}

/**
 * LibraryFile represents a generated file/artifact from a task
 */
export interface LibraryFile {
  id: number;
  task_id: string;
  name: string;
  type: FileType;
  path: string;
  preview: string | null;
  thumbnail: string | null;
  is_favorite: boolean;
  created_at: string;
}

// ============ Input Types for Creating Records ============

export interface CreateSessionInput {
  id: string;
  prompt: string;
}

export interface CreateTaskInput {
  id: string;
  session_id: string;
  task_index: number;
  prompt: string;
}

export interface CreateMessageInput {
  task_id: string;
  type: MessageType;
  content?: string;
  tool_name?: string;
  tool_input?: string;
  tool_output?: string;
  tool_use_id?: string;
  subtype?: string;
  error_message?: string;
  attachments?: string; // JSON string of MessageAttachment[]
}

export interface UpdateTaskInput {
  status?: TaskStatus;
  cost?: number;
  duration?: number;
  prompt?: string;
  favorite?: boolean;
}

export interface CreateFileInput {
  task_id: string;
  name: string;
  type: FileType;
  path: string;
  preview?: string;
  thumbnail?: string;
}

// ============ Query Result Types ============

export interface TaskWithMessages {
  task: Task;
  messages: Message[];
}

export interface TaskWithFiles {
  task: Task;
  files: LibraryFile[];
}

export interface SessionWithTasks {
  session: Session;
  tasks: Task[];
}

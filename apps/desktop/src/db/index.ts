/**
 * Database module for chat persistence
 * Desktop-only (SQLite via Tauri SQL plugin)
 */

// Re-export all types
export type {
  // Core entities
  Session,
  Task,
  Message,
  LibraryFile,
  // Enums
  TaskStatus,
  MessageType,
  FileType,
  // Input types
  CreateSessionInput,
  CreateTaskInput,
  CreateMessageInput,
  UpdateTaskInput,
  CreateFileInput,
  // Query result types
  TaskWithMessages,
  TaskWithFiles,
  SessionWithTasks,
} from "./types";

// Re-export all database operations
export {
  // Utility
  isDatabaseAvailable,
  generateSessionId,
  generateTaskId,
  closeDatabase,
  // Session operations
  createSession,
  getSession,
  getAllSessions,
  updateSessionTaskCount,
  deleteSession,
  // Task operations
  createTask,
  getTask,
  getAllTasks,
  getTasksBySessionId,
  updateTask,
  deleteTask,
  updateTaskFromMessage,
  // Message operations
  createMessage,
  getMessagesByTaskId,
  deleteMessagesByTaskId,
  // File operations
  createFile,
  getFilesByTaskId,
  getAllFiles,
  toggleFileFavorite,
  deleteFile,
  getFilesGroupedByTask,
} from "./database";

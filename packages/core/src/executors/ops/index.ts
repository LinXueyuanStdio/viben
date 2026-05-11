/**
 * Executor Operations Module
 *
 * Unified interface for AI executor operations.
 *
 * Phase 1: types.ts, registry.ts, utils.ts
 * Phase 2 (future): spawn.ts, chat.ts, session.ts, availability.ts, command.ts
 */

// =============================================================================
// Types
// =============================================================================

export type {
  // Re-exported from types/index.ts
  ExecutorType,
  AvailabilityStatus,
  AvailabilityInfo,
  // Capability types
  ExecutorCapability,
  // Spawn types
  SpawnOptions,
  SpawnResult,
  // Chat types
  ChatFormat,
  ChatOptions,
  ChatResult,
  // SSE types
  SSETextMessage,
  SSEToolUseMessage,
  SSEToolResultMessage,
  SSEResultMessage,
  SSEErrorMessage,
  SSEQuestionMessage,
  SSESdkSessionMessage,
  SSEAssistantMessage,
  SSEStreamEventMessage,
  SSEMessage,
  // Result types
  ExecutionResult,
  ExecutorErrorType,
  // Command types
  CommandParts,
  // Config types
  RunCommandOptions,
  ExecutorConfig,
  // Main interface
  Executor,
} from "./types";

// =============================================================================
// Registry Operations
// =============================================================================

export {
  registerExecutor,
  getExecutor,
  hasExecutor,
  getRegisteredTypes,
  getAvailableExecutors,
} from "./registry";

// =============================================================================
// Utilities
// =============================================================================

export {
  which,
  whichSync,
  getHomeDir,
  getDataDir,
  fileExists,
  joinPath,
} from "./utils";

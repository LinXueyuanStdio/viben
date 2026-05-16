/**
 * Executors module - AI coding agent executors
 *
 * Unified API: engines (implementations) + ops (registry/operations) + chat (proxy pattern)
 */

// =============================================================================
// Engines (executor implementations, self-registering)
// =============================================================================

// Import engines to ensure they self-register
import "./engines";

export {
  AmpExecutor,
  ClaudeExecutor,
  CodexExecutor,
  CopilotExecutor,
  CursorAgentExecutor,
  DroidExecutor,
  GeminiExecutor,
  OpencodeExecutor,
  OpenClawExecutor,
  QwenCodeExecutor,
  BaseExecutor,
} from "./engines";
export type {
  AmpExecutorConfig,
  ClaudeExecutorConfig,
  CodexExecutorConfig,
  CopilotExecutorConfig,
  CursorAgentExecutorConfig,
  DroidExecutorConfig,
  OpencodeExecutorConfig,
  OpenClawExecutorConfig,
  QwenCodeExecutorConfig,
} from "./engines";

// =============================================================================
// Ops (registry + types)
// =============================================================================

export {
  registerExecutor,
  getExecutor,
  hasExecutor,
  getRegisteredTypes,
  getAvailableExecutors,
} from "./ops";

export type {
  Executor,
  ExecutorCapability,
  ExecutorConfig,
  SpawnOptions,
  SpawnResult,
  ChatFormat,
  ChatOptions,
  ChatResult,
  ExecutionResult,
  ExecutorErrorType,
  RunCommandOptions,
  SSEMessage,
  SSETextMessage,
  SSEToolUseMessage,
  SSEToolResultMessage,
  SSEResultMessage,
  SSEErrorMessage,
  SSEQuestionMessage,
  SSESdkSessionMessage,
  SSEAssistantMessage,
  SSEStreamEventMessage,
} from "./ops";

// Re-export types from main types
export type {
  ExecutorType,
  AgentCapability,
  AvailabilityInfo,
} from "../types";

// =============================================================================
// Chat Proxy Module
// =============================================================================

export type {
  ChatProxy,
  ChatProxyType,
  ChatResult as ChatProxyResult,
  ChatProxyOptions,
  ChatProxyFactoryInterface,
} from "./chat";
export {
  SpawnChatProxy,
  createSpawnChatProxy,
  SdkChatProxy,
  createSdkChatProxy,
  isSdkAvailable,
  ChatProxyFactory,
  chatProxyFactory,
  createChatProxy,
  createChatProxyAsync,
} from "./chat";

// =============================================================================
// Command Builder
// =============================================================================

export { CommandBuilder, CommandBuildError, createCommandParts } from "./command";
export type { CommandParts } from "./command";

// =============================================================================
// Utilities
// =============================================================================

export { which, whichSync, getConfigDir, getDataDir } from "./utils";

// =============================================================================
// Type Guard
// =============================================================================

import { hasExecutor } from "./ops";
import type { ExecutorType } from "../types";

/**
 * Check if a string is a valid registered executor type
 */
export function isExecutorType(type: string): type is ExecutorType {
  return hasExecutor(type as ExecutorType);
}

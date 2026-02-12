/**
 * Executors module - AI coding agent executors
 */

// Types
export type {
  RepoContext,
  ExecutionEnv,
  CommandParts,
  ExecutorExitResult,
  SpawnedChild,
  ProcessRunStatus,
  ProcessState,
  ExecutorConfig,
  ExecutorApprovalService,
  StandardCodingAgentExecutor,
  // Chat types
  ChatFormat,
  ChatOptions,
  ChatSpawnResult,
} from "./types";

// Re-export types from main types
export type {
  ExecutorType,
  AgentCapability,
  AvailabilityInfo,
} from "../types";

// Utilities
export { createExecutionEnv, applyEnvToSpawnOptions } from "./types";
export { CommandBuilder, CommandBuildError, createCommandParts } from "./command";
export { which, whichSync, getConfigDir, getDataDir } from "./utils";

// Executor implementations
export {
  ClaudeCode,
  createClaudeCode,
  type ClaudeCodeConfig,
  Amp,
  createAmp,
  type AmpConfig,
  Gemini,
  createGemini,
  type GeminiConfig,
  Codex,
  createCodex,
  type CodexConfig,
  Opencode,
  createOpencode,
  type OpencodeConfig,
  CursorAgent,
  createCursorAgent,
  type CursorAgentConfig,
  QwenCode,
  createQwenCode,
  type QwenCodeConfig,
  Copilot,
  createCopilot,
  type CopilotConfig,
  Droid,
  createDroid,
  type DroidConfig,
} from "./executors";

import type { ExecutorType, ExecutorConfig, StandardCodingAgentExecutor, ChatOptions, ChatSpawnResult } from "./types";
import {
  ClaudeCode,
  Amp,
  Gemini,
  Codex,
  Opencode,
  CursorAgent,
  QwenCode,
  Copilot,
  Droid,
} from "./executors";
import { ExecutorError } from "../error";

/**
 * Create an executor by type
 */
export function createExecutor(
  executorType: ExecutorType,
  config: ExecutorConfig = {}
): StandardCodingAgentExecutor {
  switch (executorType) {
    case "CLAUDE_CODE":
      return new ClaudeCode(config);
    case "AMP":
      return new Amp(config);
    case "GEMINI":
      return new Gemini(config);
    case "CODEX":
      return new Codex(config);
    case "OPENCODE":
      return new Opencode(config);
    case "CURSOR_AGENT":
      return new CursorAgent(config);
    case "QWEN_CODE":
      return new QwenCode(config);
    case "COPILOT":
      return new Copilot(config);
    case "DROID":
      return new Droid(config);
    default:
      throw ExecutorError.unknownType(executorType);
  }
}

/**
 * All available executor types
 */
export const EXECUTOR_TYPES: ExecutorType[] = [
  "CLAUDE_CODE",
  "AMP",
  "GEMINI",
  "CODEX",
  "OPENCODE",
  "CURSOR_AGENT",
  "QWEN_CODE",
  "COPILOT",
  "DROID",
];

/**
 * Check if a type is a valid executor type
 */
export function isExecutorType(type: string): type is ExecutorType {
  return EXECUTOR_TYPES.includes(type as ExecutorType);
}

/**
 * Get all executors with their availability info
 */
export function getAllExecutorsAvailability(): Record<ExecutorType, { available: boolean; executor: StandardCodingAgentExecutor }> {
  const result: Record<string, { available: boolean; executor: StandardCodingAgentExecutor }> = {};

  for (const type of EXECUTOR_TYPES) {
    const executor = createExecutor(type);
    const info = executor.getAvailabilityInfo();
    result[type] = {
      available: info.status === "LOGIN_DETECTED" || info.status === "INSTALLATION_FOUND",
      executor,
    };
  }

  return result as Record<ExecutorType, { available: boolean; executor: StandardCodingAgentExecutor }>;
}

/**
 * Executor types that support non-interactive chat mode
 */
export const CHAT_SUPPORTED_EXECUTORS: ExecutorType[] = [
  "CLAUDE_CODE",
  "GEMINI",
  "CODEX",
];

/**
 * Check if an executor type supports non-interactive chat mode
 */
export function executorSupportsChat(executorType: ExecutorType): boolean {
  return CHAT_SUPPORTED_EXECUTORS.includes(executorType);
}

/**
 * Spawn a non-interactive chat process for an executor type.
 * This is a convenience function that creates an executor and calls spawnChat.
 *
 * @param executorType - The executor type (e.g., "CLAUDE_CODE", "GEMINI")
 * @param options - Chat options including prompt, cwd, format, etc.
 * @returns ChatSpawnResult with the spawned process and exit promise
 * @throws ExecutorError if the executor type doesn't support chat
 */
export async function spawnChat(
  executorType: ExecutorType,
  options: ChatOptions
): Promise<ChatSpawnResult> {
  const executor = createExecutor(executorType);

  if (!executor.supportsChat?.() || !executor.spawnChat) {
    throw ExecutorError.chatNotSupported(executorType);
  }

  return executor.spawnChat(options);
}

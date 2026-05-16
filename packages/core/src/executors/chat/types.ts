/**
 * Chat Proxy Types
 *
 * Defines the interface for chat proxy implementations that abstract
 * different execution strategies for AI agent chat interactions.
 */

import type { ChatOptions, ChatFormat } from "../ops/types";
import type { ExecutorType } from "../../types";

/**
 * Proxy type identifier
 */
export type ChatProxyType = "spawn" | "sdk" | "gateway";

/**
 * Result from a chat execution
 */
export interface ChatResult {
  /** Process exit code (0 = success) */
  exitCode: number;
  /** Session ID if available */
  sessionId?: string;
  /** Error message if failed */
  error?: string;
}

/**
 * Options for creating a chat proxy
 */
export interface ChatProxyOptions extends ChatOptions {
  /** Executor type to use */
  executorType: ExecutorType;
}

/**
 * Chat proxy interface
 *
 * Abstracts the execution strategy for AI agent chat interactions.
 * Implementations can use different methods (spawn subprocess, SDK, etc.)
 * to execute chat commands.
 */
export interface ChatProxy {
  /**
   * The proxy type identifier
   */
  readonly proxyType: ChatProxyType;

  /**
   * Execute a non-interactive chat
   *
   * @param options - Chat options including prompt, cwd, format, etc.
   * @returns Promise resolving to chat result with exit code
   */
  execute(options: ChatOptions): Promise<ChatResult>;
}

/**
 * Factory interface for creating chat proxies
 */
export interface ChatProxyFactoryInterface {
  /**
   * Create a chat proxy for the given executor type
   *
   * @param executorType - The executor type (e.g., "CLAUDE_CODE", "GEMINI")
   * @param preferSdk - Whether to prefer SDK mode (default: true)
   * @returns A ChatProxy instance
   */
  createProxy(executorType: ExecutorType, preferSdk?: boolean): ChatProxy;

  /**
   * Check if SDK mode is available for an executor type
   *
   * @param executorType - The executor type to check
   * @returns true if SDK mode is supported
   */
  isSdkAvailable(executorType: ExecutorType): boolean;
}

// Re-export chat types from parent for convenience
export type { ChatOptions, ChatFormat };

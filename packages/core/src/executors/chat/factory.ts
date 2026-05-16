/**
 * Chat Proxy Factory
 *
 * Factory for creating chat proxy instances based on executor type
 * and user preferences.
 */

import type { ChatProxy, ChatProxyFactoryInterface, ChatResult } from "./types";
import type { ExecutorType } from "../../types";
import type { ChatOptions } from "../ops/types";
import { SpawnChatProxy } from "./spawn-proxy";
import { SdkChatProxy, isSdkAvailable } from "./sdk-proxy";
import { getExecutor, hasExecutor } from "../ops";
import { ExecutorError } from "../../error";

/**
 * OpenClaw Chat Proxy adapter for the legacy ChatProxy interface.
 *
 * Uses the unified executor module's OpenClawExecutor internally.
 * @openclaw/sdk is loaded lazily (optional dependency).
 */
class OpenClawLegacyChatProxy implements ChatProxy {
  readonly proxyType = "gateway" as const;

  async execute(options: ChatOptions): Promise<ChatResult> {
    try {
      if (!options.prompt) {
        return { exitCode: 1, error: "prompt is required" };
      }

      // Lazy-load the unified executor to avoid top-level @openclaw/sdk import
      const { getExecutor } = await import("../ops");
      const executor = getExecutor("OPENCLAW");

      // Use streaming to output text in real-time
      const stream = executor.chatStreaming({
        prompt: options.prompt,
        cwd: options.cwd,
        sessionId: options.sessionId,
        resume: options.resume,
        model: options.model,
      });

      let sessionId: string | undefined;
      const isStreamJson = options.outputFormat === "stream-json";

      for await (const msg of stream) {
        if (isStreamJson) {
          process.stdout.write(JSON.stringify(msg) + "\n");
        } else {
          if (msg.type === "text" && "content" in msg) {
            process.stdout.write((msg as { content: string }).content);
          } else if (msg.type === "error" && "message" in msg) {
            process.stderr.write((msg as { message: string }).message + "\n");
          }
        }
        if (msg.type === "sdk_session" && "sdk_session_id" in msg) {
          sessionId = (msg as { sdk_session_id: string }).sdk_session_id;
        }
      }

      if (!isStreamJson) {
        process.stdout.write("\n");
      }
      return { exitCode: 0, sessionId };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      process.stderr.write(msg + "\n");
      return { exitCode: 1, error: msg };
    }
  }
}

/**
 * Executor types that support SDK mode
 */
const SDK_SUPPORTED_EXECUTORS: ExecutorType[] = ["CLAUDE_CODE"];

/**
 * ChatProxyFactory - Creates appropriate chat proxy for executor type
 *
 * The factory selects the best proxy implementation based on:
 * 1. Executor type (only CLAUDE_CODE supports SDK mode)
 * 2. User preference (--use-sdk / --no-sdk)
 * 3. SDK availability (graceful fallback to spawn if SDK not installed)
 */
export class ChatProxyFactory implements ChatProxyFactoryInterface {
  private sdkAvailableCache: boolean | null = null;

  /**
   * Create a chat proxy for the given executor type
   *
   * @param executorType - The executor type (e.g., "CLAUDE_CODE", "GEMINI")
   * @param preferSdk - Whether to prefer SDK mode (default: true)
   * @returns A ChatProxy instance
   */
  createProxy(executorType: ExecutorType, preferSdk = true): ChatProxy {
    // Validate executor supports chat
    if (!hasExecutor(executorType) || !getExecutor(executorType).supports("CHAT")) {
      throw ExecutorError.chatNotSupported(executorType);
    }

    // OpenClaw uses its own proxy (WebSocket SDK, not CLI spawn)
    if (executorType === "OPENCLAW") {
      return new OpenClawLegacyChatProxy();
    }

    // Use SDK if available, supported, and preferred
    if (preferSdk && this.isSdkAvailable(executorType)) {
      return new SdkChatProxy();
    }

    // Default to spawn proxy
    return new SpawnChatProxy(executorType);
  }

  /**
   * Create a chat proxy asynchronously with SDK availability check
   *
   * This method properly checks if the SDK is installed before
   * attempting to use it.
   *
   * @param executorType - The executor type
   * @param preferSdk - Whether to prefer SDK mode
   * @returns Promise resolving to a ChatProxy instance
   */
  async createProxyAsync(
    executorType: ExecutorType,
    preferSdk = true
  ): Promise<ChatProxy> {
    // Validate executor supports chat
    if (!hasExecutor(executorType) || !getExecutor(executorType).supports("CHAT")) {
      throw ExecutorError.chatNotSupported(executorType);
    }

    // OpenClaw uses its own proxy (WebSocket SDK, not CLI spawn)
    if (executorType === "OPENCLAW") {
      return new OpenClawLegacyChatProxy();
    }

    // Check SDK availability for supported executors
    if (preferSdk && SDK_SUPPORTED_EXECUTORS.includes(executorType)) {
      const available = await isSdkAvailable();
      if (available) {
        return new SdkChatProxy();
      }
    }

    // Default to spawn proxy
    return new SpawnChatProxy(executorType);
  }

  /**
   * Check if SDK mode is available for an executor type
   *
   * This is a synchronous check that only verifies if the executor
   * type supports SDK mode. Use `isSdkInstalledAsync` to check if
   * the SDK package is actually installed.
   *
   * @param executorType - The executor type to check
   * @returns true if SDK mode is supported for this executor type
   */
  isSdkAvailable(executorType: ExecutorType): boolean {
    return SDK_SUPPORTED_EXECUTORS.includes(executorType);
  }

  /**
   * Async check if SDK is installed and available
   */
  async isSdkInstalledAsync(): Promise<boolean> {
    if (this.sdkAvailableCache !== null) {
      return this.sdkAvailableCache;
    }
    this.sdkAvailableCache = await isSdkAvailable();
    return this.sdkAvailableCache;
  }
}

/**
 * Default factory instance
 */
export const chatProxyFactory = new ChatProxyFactory();

/**
 * Convenience function to create a chat proxy
 */
export function createChatProxy(
  executorType: ExecutorType,
  preferSdk = true
): ChatProxy {
  return chatProxyFactory.createProxy(executorType, preferSdk);
}

/**
 * Convenience async function to create a chat proxy with SDK check
 */
export async function createChatProxyAsync(
  executorType: ExecutorType,
  preferSdk = true
): Promise<ChatProxy> {
  return chatProxyFactory.createProxyAsync(executorType, preferSdk);
}

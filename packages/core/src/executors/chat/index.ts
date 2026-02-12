/**
 * Chat Proxy Module
 *
 * Provides proxy pattern implementations for AI agent chat execution.
 * Supports multiple execution strategies:
 * - SpawnChatProxy: Original subprocess spawning method
 * - SdkChatProxy: Native SDK integration (CLAUDE_CODE only)
 */

// Types
export type {
  ChatProxy,
  ChatProxyType,
  ChatResult,
  ChatProxyOptions,
  ChatProxyFactoryInterface,
  ChatOptions,
  ChatFormat,
} from "./types";

// Implementations
export { SpawnChatProxy, createSpawnChatProxy } from "./spawn-proxy";
export { SdkChatProxy, createSdkChatProxy, isSdkAvailable } from "./sdk-proxy";

// Factory
export {
  ChatProxyFactory,
  chatProxyFactory,
  createChatProxy,
  createChatProxyAsync,
} from "./factory";

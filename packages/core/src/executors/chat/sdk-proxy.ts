/**
 * SDK Chat Proxy
 *
 * Executes AI agent chat using the Claude Agent SDK.
 * This proxy provides a native TypeScript integration for CLAUDE_CODE executor.
 */

import type { ChatProxy, ChatResult } from "./types";
import type { ChatOptions } from "../types";

// Dynamic import for optional SDK dependency
let claudeSdk: typeof import("@anthropic-ai/claude-agent-sdk") | null = null;

/**
 * Lazy load the Claude Agent SDK
 * Returns null if the SDK is not installed
 */
async function loadClaudeSdk(): Promise<typeof import("@anthropic-ai/claude-agent-sdk") | null> {
  if (claudeSdk !== null) {
    return claudeSdk;
  }

  try {
    claudeSdk = await import("@anthropic-ai/claude-agent-sdk");
    return claudeSdk;
  } catch {
    // SDK not installed
    return null;
  }
}

/**
 * Check if the Claude Agent SDK is available
 */
export async function isSdkAvailable(): Promise<boolean> {
  const sdk = await loadClaudeSdk();
  return sdk !== null;
}

/**
 * SdkChatProxy - Uses Claude Agent SDK for chat execution
 *
 * This proxy uses the @anthropic-ai/claude-agent-sdk package to execute
 * chat interactions. It provides a native TypeScript experience without
 * subprocess spawning, with full type safety and streaming support.
 *
 * Only available for CLAUDE_CODE executor.
 */
export class SdkChatProxy implements ChatProxy {
  readonly proxyType = "sdk" as const;

  /**
   * Execute chat using the Claude Agent SDK
   */
  async execute(options: ChatOptions): Promise<ChatResult> {
    const sdk = await loadClaudeSdk();
    if (!sdk) {
      throw new Error(
        "Claude Agent SDK not installed. Install with: pnpm add @anthropic-ai/claude-agent-sdk"
      );
    }

    const {
      prompt,
      cwd = process.cwd(),
      model,
      sessionId,
      resume,
      verbose = false,
      dangerouslySkipPermissions = false,
    } = options;

    if (!prompt) {
      throw new Error("Prompt is required for SDK chat execution");
    }

    try {
      // Build query options
      const queryOptions: Parameters<typeof sdk.query>[0]["options"] = {
        cwd,
        // Use Claude Code preset for system prompt and tools
        systemPrompt: { type: "preset", preset: "claude_code" },
        tools: { type: "preset", preset: "claude_code" },
      };

      // Add optional parameters
      if (model) {
        queryOptions.model = model;
      }
      if (sessionId) {
        queryOptions.sessionId = sessionId;
      }
      if (resume) {
        // Resume takes a session ID string
        queryOptions.resume = resume;
      }
      if (dangerouslySkipPermissions) {
        queryOptions.permissionMode = "bypassPermissions";
        queryOptions.allowDangerouslySkipPermissions = true;
      }

      // Execute the query
      const queryResult = sdk.query({
        prompt,
        options: queryOptions,
      });

      // Stream messages to stdout
      for await (const message of queryResult) {
        if (verbose) {
          // In verbose mode, log all message types
          this.logVerboseMessage(message);
        } else {
          // Normal mode: only output assistant text content
          this.outputMessage(message);
        }
      }

      return { exitCode: 0 };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      // Always show errors to stderr
      console.error(`SDK Error: ${errorMessage}`);
      if (verbose && error instanceof Error && error.stack) {
        console.error(error.stack);
      }
      return {
        exitCode: 1,
        error: errorMessage,
      };
    }
  }

  /**
   * Output message content in normal mode
   */
  private outputMessage(message: unknown): void {
    // Type guard for message structure
    if (!message || typeof message !== "object") return;

    const msg = message as Record<string, unknown>;

    // Handle assistant messages
    if (msg.type === "assistant" && typeof msg.content === "string") {
      process.stdout.write(msg.content);
    }

    // Handle text content blocks
    if (msg.type === "text" && typeof msg.text === "string") {
      process.stdout.write(msg.text);
    }
  }

  /**
   * Log message in verbose mode
   */
  private logVerboseMessage(message: unknown): void {
    // Type guard for message structure
    if (!message || typeof message !== "object") return;

    const msg = message as Record<string, unknown>;

    // Log all messages with their type
    console.log(`[${msg.type || "unknown"}]`, JSON.stringify(message, null, 2));
  }
}

/**
 * Create a SdkChatProxy instance
 */
export function createSdkChatProxy(): SdkChatProxy {
  return new SdkChatProxy();
}

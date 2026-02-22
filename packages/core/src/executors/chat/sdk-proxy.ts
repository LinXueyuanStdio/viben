/**
 * SDK Chat Proxy
 *
 * Executes AI agent chat using the Claude Agent SDK.
 * This proxy provides a native TypeScript integration for CLAUDE_CODE executor.
 */

import type { ChatProxy, ChatResult } from "./types";
import type { ChatOptions } from "../types";

// ============================================================================
// SSE Message Types for Streaming
// ============================================================================

/**
 * SSE text message - Agent generated text content
 */
export interface SSETextMessage {
  type: "text";
  content: string;
}

/**
 * SSE tool use message - Agent calling a tool
 */
export interface SSEToolUseMessage {
  type: "tool_use";
  id: string;
  name: string;
  input: unknown;
}

/**
 * SSE tool result message - Result from tool execution
 */
export interface SSEToolResultMessage {
  type: "tool_result";
  toolUseId: string;
  output: string;
  isError?: boolean;
}

/**
 * SSE result message - Task completion status
 */
export interface SSEResultMessage {
  type: "result";
  subtype?: "success" | "error";
  cost?: number;
  duration?: number;
}

/**
 * SSE error message - Error occurred during execution
 */
export interface SSEErrorMessage {
  type: "error";
  message: string;
}

/**
 * Union type for all SSE messages from streaming execution
 */
export type SSEMessage =
  | SSETextMessage
  | SSEToolUseMessage
  | SSEToolResultMessage
  | SSEResultMessage
  | SSEErrorMessage;

import { execSync } from "node:child_process";

/**
 * Environment variables that interfere with SDK execution.
 * These are set when running inside Claude Code CLI and cause the SDK to fail.
 */
const INTERFERING_ENV_VARS = [
  "CLAUDE_CODE_ENTRYPOINT",
  "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC",
  "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS",
  "CLAUDE_CODE_ATTRIBUTION_HEADER",
  "CLAUDECODE",
];

/**
 * Clear environment variables that interfere with SDK execution
 */
function clearInterferingEnvVars(): void {
  for (const varName of INTERFERING_ENV_VARS) {
    delete process.env[varName];
  }
}

/**
 * Find the path to Claude Code executable
 */
function findClaudeCodeExecutable(): string | undefined {
  try {
    const path = execSync("which claude", { encoding: "utf-8" }).trim();
    return path || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Default max turns for agent execution
 */
const DEFAULT_MAX_TURNS = 200;

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
      // Agent-specific options
      systemPrompt,
      appendPrompt,
      allowedTools,
      disallowedTools,
      mcpServers,
      skills,
      permissionMode,
    } = options;

    if (!prompt) {
      throw new Error("Prompt is required for SDK chat execution");
    }

    // Clear environment variables that interfere with SDK execution
    // These are set when running inside Claude Code CLI
    clearInterferingEnvVars();

    try {
      // Build query options based on official SDK documentation
      // See: https://platform.claude.com/docs/en/agent-sdk/typescript
      const queryOptions: Record<string, unknown> = {
        cwd,
        // Load user settings from ~/.claude/settings.json
        // This includes env vars (auth), permissions, and other config
        settingSources: ["user"],
      };

      // System prompt configuration
      // If agent has custom systemPrompt, use it; otherwise use Claude Code preset
      if (systemPrompt) {
        // Agent has custom system prompt
        if (appendPrompt) {
          // Combine custom system prompt with append prompt
          queryOptions.systemPrompt = systemPrompt + "\n\n" + appendPrompt;
        } else {
          queryOptions.systemPrompt = systemPrompt;
        }
      } else if (appendPrompt) {
        // Use Claude Code preset and append custom text
        queryOptions.systemPrompt = {
          type: "preset",
          preset: "claude_code",
          append: appendPrompt,
        };
      } else {
        // Use Claude Code preset as default
        queryOptions.systemPrompt = { type: "preset", preset: "claude_code" };
      }

      // Tools configuration
      // Use Claude Code preset as base, then apply allowed/disallowed filters
      queryOptions.tools = { type: "preset", preset: "claude_code" };
      if (allowedTools && allowedTools.length > 0) {
        queryOptions.allowedTools = allowedTools;
      }
      if (disallowedTools && disallowedTools.length > 0) {
        queryOptions.disallowedTools = disallowedTools;
      }

      // Add optional parameters
      if (model) {
        queryOptions.model = model;
      }
      if (sessionId) {
        queryOptions.sessionId = sessionId;
      }
      if (resume) {
        queryOptions.resume = resume;
      }
      if (permissionMode) {
        queryOptions.permissionMode = permissionMode;
      } else if (dangerouslySkipPermissions) {
        queryOptions.permissionMode = "bypassPermissions";
      }

      // MCP servers (if agent has custom MCP config)
      // Note: This needs proper MCP server config format
      // For now, we log it in verbose mode
      if (mcpServers && mcpServers.length > 0 && verbose) {
        console.log(`Agent MCP servers: ${mcpServers.join(", ")}`);
      }

      // Skills (if agent has custom skills)
      // Note: Skills are typically loaded from project config
      if (skills && skills.length > 0 && verbose) {
        console.log(`Agent skills: ${skills.join(", ")}`);
      }

      // Execute the query - returns AsyncGenerator<SDKMessage>
      const queryResult = sdk.query({
        prompt,
        options: queryOptions as Parameters<typeof sdk.query>[0]["options"],
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

      // Check for common issues and provide helpful hints
      if (errorMessage.includes("exited with code 1")) {
        console.error(`\nHint: This may happen when Claude Code runs in background mode.`);
        console.error(`Try using --no-sdk to use spawn proxy instead:`);
        console.error(`  viben agent chat -n <agent> -p "..." --no-sdk`);
      }

      if (error instanceof Error) {
        // Check for cause (nested error)
        const cause = (error as Error & { cause?: Error }).cause;
        if (cause) {
          console.error(`Cause: ${cause.message}`);
        }
        // Show stack in verbose mode
        if (verbose && error.stack) {
          console.error(error.stack);
        }
      }
      return {
        exitCode: 1,
        error: errorMessage,
      };
    }
  }

  // Track if we've already output content from assistant messages
  private hasOutputContent = false;

  /**
   * Output message content in normal mode
   *
   * Message flow:
   * 1. [system] init - skip
   * 2. [assistant] { message: { content: [...] } } - output text blocks
   * 3. [result] { result: "..." } - only output if no assistant content was output
   */
  private outputMessage(message: unknown): void {
    // Type guard for message structure
    if (!message || typeof message !== "object") return;

    const msg = message as Record<string, unknown>;

    // Handle assistant messages with nested message object
    // SDK returns: { type: "assistant", message: { content: [...] } }
    if (msg.type === "assistant" && msg.message && typeof msg.message === "object") {
      const innerMsg = msg.message as Record<string, unknown>;
      if (Array.isArray(innerMsg.content)) {
        for (const block of innerMsg.content) {
          if (block && typeof block === "object") {
            const contentBlock = block as Record<string, unknown>;
            if (contentBlock.type === "text" && typeof contentBlock.text === "string") {
              process.stdout.write(contentBlock.text);
              this.hasOutputContent = true;
            }
          }
        }
      }
      return;
    }

    // Handle assistant messages with string content
    if (msg.type === "assistant" && typeof msg.content === "string") {
      process.stdout.write(msg.content);
      this.hasOutputContent = true;
      return;
    }

    // Handle assistant messages with array content (content blocks)
    if (msg.type === "assistant" && Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block && typeof block === "object") {
          const contentBlock = block as Record<string, unknown>;
          if (contentBlock.type === "text" && typeof contentBlock.text === "string") {
            process.stdout.write(contentBlock.text);
            this.hasOutputContent = true;
          }
        }
      }
      return;
    }

    // Handle text content blocks directly
    if (msg.type === "text" && typeof msg.text === "string") {
      process.stdout.write(msg.text);
      this.hasOutputContent = true;
      return;
    }

    // Handle content_block_delta for streaming
    if (msg.type === "content_block_delta") {
      const delta = msg.delta as Record<string, unknown> | undefined;
      if (delta && delta.type === "text_delta" && typeof delta.text === "string") {
        process.stdout.write(delta.text);
        this.hasOutputContent = true;
      }
      return;
    }

    // Handle result message - only output if no assistant content was output
    // This prevents duplicate output
    if (msg.type === "result" && typeof msg.result === "string") {
      if (!this.hasOutputContent) {
        process.stdout.write(msg.result);
      }
      // Always add final newline
      process.stdout.write("\n");
      return;
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

  /**
   * Execute chat with streaming - returns AsyncGenerator of SSE messages
   *
   * This method streams messages as they are generated by the SDK,
   * converting them to SSE message format for real-time frontend updates.
   */
  async *executeStreaming(
    options: ChatOptions
  ): AsyncGenerator<SSEMessage, void, unknown> {
    const sdk = await loadClaudeSdk();
    if (!sdk) {
      yield { type: "error", message: "Claude Agent SDK not installed" };
      return;
    }

    const {
      prompt,
      cwd = process.cwd(),
      model,
      sessionId,
      resume,
      dangerouslySkipPermissions = false,
      systemPrompt,
      appendPrompt,
      allowedTools,
      disallowedTools,
      permissionMode,
    } = options;

    if (!prompt) {
      yield { type: "error", message: "Prompt is required" };
      return;
    }

    clearInterferingEnvVars();
    console.log('[SdkChatProxy] After clearInterferingEnvVars - CLAUDECODE:', process.env.CLAUDECODE);

    const startTime = Date.now();

    try {
      // Find Claude Code executable path
      const claudePath = findClaudeCodeExecutable();

      // Build query options following WorkAny patterns
      const queryOptions: Record<string, unknown> = {
        cwd,
        // Load user settings (includes API key from ~/.claude/settings.json)
        settingSources: ["user", "project"],
        // Use Claude Code preset tools
        tools: { type: "preset", preset: "claude_code" },
        // Limit max turns to prevent runaway execution
        maxTurns: DEFAULT_MAX_TURNS,
      };

      // Add Claude Code executable path if found
      if (claudePath) {
        queryOptions.pathToClaudeCodeExecutable = claudePath;
      }

      // System prompt configuration
      if (systemPrompt) {
        queryOptions.systemPrompt = appendPrompt
          ? systemPrompt + "\n\n" + appendPrompt
          : systemPrompt;
      } else if (appendPrompt) {
        queryOptions.systemPrompt = {
          type: "preset",
          preset: "claude_code",
          append: appendPrompt,
        };
      } else {
        queryOptions.systemPrompt = { type: "preset", preset: "claude_code" };
      }

      // Tools configuration
      if (allowedTools?.length) {
        queryOptions.allowedTools = allowedTools;
      }
      if (disallowedTools?.length) {
        queryOptions.disallowedTools = disallowedTools;
      }

      // Optional parameters
      if (model) queryOptions.model = model;
      if (sessionId) queryOptions.sessionId = sessionId;
      if (resume) queryOptions.resume = resume;

      // Permission mode - use bypassPermissions by default for gateway usage
      if (permissionMode) {
        queryOptions.permissionMode = permissionMode;
      } else if (dangerouslySkipPermissions) {
        queryOptions.permissionMode = "bypassPermissions";
      } else {
        // Default to bypassPermissions for server-side execution
        queryOptions.permissionMode = "bypassPermissions";
      }

      // Reset deduplication state for new streaming session
      this.sentTextHashes.clear();
      this.sentToolIds.clear();

      // Execute query
      const queryResult = sdk.query({
        prompt,
        options: queryOptions as Parameters<typeof sdk.query>[0]["options"],
      });

      // Stream messages - yield all SSE messages from each SDK message
      for await (const message of queryResult) {
        for (const sseMessage of this.convertToSSEMessages(message)) {
          yield sseMessage;
        }
      }

      const duration = Date.now() - startTime;

      // Yield success result at the end
      yield { type: "result", subtype: "success", duration };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Log the full error for debugging
      console.error('[SdkChatProxy] Execution error:', errorMessage);
      if (error instanceof Error && error.stack) {
        console.error('[SdkChatProxy] Stack:', error.stack);
      }
      const cause = (error as Error & { cause?: Error }).cause;
      if (cause) {
        console.error('[SdkChatProxy] Cause:', cause.message);
      }

      // Handle specific error types following WorkAny patterns
      if (errorMessage.includes("exited with code")) {
        // Claude Code process crashed - include the actual error for debugging
        console.error('[SdkChatProxy] Process exit error:', errorMessage);
        yield {
          type: "error",
          message: `Agent process terminated unexpectedly: ${errorMessage}`,
        };
      } else if (
        errorMessage.includes("API key") ||
        errorMessage.includes("authentication")
      ) {
        yield {
          type: "error",
          message: "API authentication failed. Please check your API key configuration.",
        };
      } else if (errorMessage.includes("not found") || errorMessage.includes("ENOENT")) {
        yield {
          type: "error",
          message: "Claude Code executable not found. Please ensure Claude Code is installed.",
        };
      } else {
        yield {
          type: "error",
          message: errorMessage,
        };
      }
    }
  }

  // Track seen text hashes and tool IDs to prevent duplicates (like WorkAny)
  private sentTextHashes = new Set<string>();
  private sentToolIds = new Set<string>();

  /**
   * Convert SDK message to SSE messages
   *
   * Returns an array of SSE messages because one SDK message can contain
   * multiple content blocks (text + tool_use in same assistant message).
   *
   * Handles various message types from the Claude Agent SDK:
   * - assistant messages with text content and tool_use
   * - user messages with tool_result
   * - content_block_delta for streaming text
   * - result messages
   */
  private *convertToSSEMessages(message: unknown): Generator<SSEMessage> {
    if (!message || typeof message !== "object") return;

    const msg = message as Record<string, unknown>;

    // Handle assistant messages with nested message object structure:
    // { type: "assistant", message: { content: [...] } }
    // Content can include both text blocks and tool_use blocks
    if (msg.type === "assistant" && msg.message && typeof msg.message === "object") {
      const innerMsg = msg.message as Record<string, unknown>;
      if (Array.isArray(innerMsg.content)) {
        for (const block of innerMsg.content as Record<string, unknown>[]) {
          if (!block || typeof block !== "object") continue;

          // Handle text content - with deduplication
          if ("text" in block && typeof block.text === "string") {
            const textHash = (block.text as string).slice(0, 100);
            if (!this.sentTextHashes.has(textHash)) {
              this.sentTextHashes.add(textHash);
              yield { type: "text", content: block.text as string };
            }
          }
          // Handle tool_use within assistant message - with deduplication
          else if ("name" in block && "id" in block) {
            const toolId = block.id as string;
            if (!this.sentToolIds.has(toolId)) {
              this.sentToolIds.add(toolId);
              yield {
                type: "tool_use",
                id: toolId,
                name: block.name as string,
                input: block.input,
              };
            }
          }
        }
      }
      return;
    }

    // Handle user messages with tool_result
    // { type: "user", message: { content: [{ type: "tool_result", ... }] } }
    if (msg.type === "user" && msg.message && typeof msg.message === "object") {
      const innerMsg = msg.message as Record<string, unknown>;
      if (Array.isArray(innerMsg.content)) {
        for (const block of innerMsg.content as Record<string, unknown>[]) {
          if (!block || typeof block !== "object") continue;

          if (block.type === "tool_result") {
            const toolUseId = (block.tool_use_id ?? block.toolUseId) as string;
            const isError = (block.is_error ?? block.isError ?? false) as boolean;
            yield {
              type: "tool_result",
              toolUseId: toolUseId || "",
              output:
                typeof block.content === "string"
                  ? block.content
                  : JSON.stringify(block.content),
              isError,
            };
          }
        }
      }
      return;
    }

    // Handle direct assistant messages with string content
    if (msg.type === "assistant" && typeof msg.content === "string") {
      const textHash = msg.content.slice(0, 100);
      if (!this.sentTextHashes.has(textHash)) {
        this.sentTextHashes.add(textHash);
        yield { type: "text", content: msg.content };
      }
      return;
    }

    // Handle assistant messages with array content (content blocks)
    if (msg.type === "assistant" && Array.isArray(msg.content)) {
      for (const block of msg.content as Record<string, unknown>[]) {
        if (!block || typeof block !== "object") continue;

        if ("text" in block && typeof block.text === "string") {
          const textHash = (block.text as string).slice(0, 100);
          if (!this.sentTextHashes.has(textHash)) {
            this.sentTextHashes.add(textHash);
            yield { type: "text", content: block.text as string };
          }
        } else if ("name" in block && "id" in block) {
          const toolId = block.id as string;
          if (!this.sentToolIds.has(toolId)) {
            this.sentToolIds.add(toolId);
            yield {
              type: "tool_use",
              id: toolId,
              name: block.name as string,
              input: block.input,
            };
          }
        }
      }
      return;
    }

    // Handle top-level tool_use (legacy format)
    if (msg.type === "tool_use") {
      const toolId = msg.id as string;
      if (!this.sentToolIds.has(toolId)) {
        this.sentToolIds.add(toolId);
        yield {
          type: "tool_use",
          id: toolId,
          name: msg.name as string,
          input: msg.input,
        };
      }
      return;
    }

    // Handle top-level tool_result (legacy format)
    if (msg.type === "tool_result") {
      yield {
        type: "tool_result",
        toolUseId: (msg.tool_use_id ?? msg.toolUseId) as string,
        output:
          typeof msg.content === "string"
            ? msg.content
            : JSON.stringify(msg.content),
        isError: (msg.is_error ?? msg.isError) as boolean | undefined,
      };
      return;
    }

    // Handle streaming deltas (content_block_delta)
    if (msg.type === "content_block_delta") {
      const delta = msg.delta as Record<string, unknown> | undefined;
      if (
        delta &&
        delta.type === "text_delta" &&
        typeof delta.text === "string"
      ) {
        yield { type: "text", content: delta.text };
      }
      return;
    }

    // Handle text content blocks directly
    if (msg.type === "text" && typeof msg.text === "string") {
      yield { type: "text", content: msg.text };
      return;
    }

    // Handle result message
    if (msg.type === "result") {
      yield {
        type: "result",
        subtype: msg.subtype as "success" | "error" | undefined,
        cost: msg.total_cost_usd as number | undefined,
        duration: msg.duration_ms as number | undefined,
      };
      return;
    }
  }

  /**
   * Convert SDK message to SSE message format (backward compatibility wrapper)
   */
  private convertToSSEMessage(message: unknown): SSEMessage | null {
    const messages = [...this.convertToSSEMessages(message)];
    return messages.length > 0 ? messages[0] : null;

    return null;
  }
}

/**
 * Create a SdkChatProxy instance
 */
export function createSdkChatProxy(): SdkChatProxy {
  return new SdkChatProxy();
}

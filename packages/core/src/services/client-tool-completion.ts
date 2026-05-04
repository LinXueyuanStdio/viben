/**
 * Client Tool Completion Registry
 *
 * Manages the async handshake between MCP tool handlers (which await a result)
 * and the frontend client (which POSTs the result back after executing the tool).
 *
 * Flow:
 * 1. Gateway stream loop calls `enqueue(sessionId, toolUseId, toolName)` when it
 *    encounters a client-side tool_use block.
 * 2. The MCP handler calls `waitForClient(sessionId)` which dequeues the next
 *    pending toolUseId, creates a promise, and returns the awaited result (or
 *    times out).
 * 3. The frontend POSTs the completion and gateway calls
 *    `complete(toolUseId, sessionId, result)` to resolve the waiting promise.
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { logger } from "../telemetry";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Safety-net maximum timeout. No tool can wait longer than this. */
export const GLOBAL_MAX_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClientSideToolOptions {
  /** Per-tool timeout in ms. 0 means use GLOBAL_MAX_TIMEOUT_MS. */
  timeoutMs?: number;
  /** Optional callback invoked when a tool times out. Returns a fallback CallToolResult. */
  onTimeout?: (context: { toolName: string; toolUseId: string; elapsedMs: number }) => CallToolResult;
}

/** @deprecated Use ClientSideToolOptions instead */
export type ClientToolOptions = ClientSideToolOptions;

interface PendingEntry {
  toolUseId: string;
  toolName: string;
  sessionId: string;
  createdAt: number;
  resolve: (result: CallToolResult) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout> | null;
}

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class ClientToolCancelledError extends Error {
  constructor(toolUseId: string, sessionId: string) {
    super(`Client tool cancelled: toolUseId=${toolUseId}, sessionId=${sessionId}`);
    this.name = "ClientToolCancelledError";
  }
}

export class ClientToolTimeoutError extends Error {
  constructor(toolUseId: string, timeoutMs: number) {
    super(`Client tool timed out after ${timeoutMs}ms: toolUseId=${toolUseId}`);
    this.name = "ClientToolTimeoutError";
  }
}

// ---------------------------------------------------------------------------
// Default timeout result
// ---------------------------------------------------------------------------

/**
 * Generates a default CallToolResult for timed-out client-side tools.
 * This allows the LLM to retry or skip rather than crashing the handler.
 */
export function defaultTimeoutResult(ctx: { toolName: string; toolUseId: string; elapsedMs: number }): CallToolResult {
  return {
    content: [{
      type: "text",
      text: `Client-side tool "${ctx.toolName}" timed out after ${Math.round(ctx.elapsedMs / 1000)}s. The client may be unresponsive. You may retry or skip this step.`,
    }],
    isError: true,
  };
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export class ClientToolCompletionRegistry {
  /** Registered tool configs (toolName -> options) */
  private toolOptions = new Map<string, ClientSideToolOptions>();

  /** Pending promises keyed by toolUseId */
  private pending = new Map<string, PendingEntry>();

  /** Per-session FIFO queues of toolUseIds awaiting pickup by waitForClient */
  private sessionQueues = new Map<string, string[]>();

  // -------------------------------------------------------------------------
  // Registration
  // -------------------------------------------------------------------------

  /**
   * Register a tool as client-side with optional timeout config.
   */
  registerToolOptions(toolName: string, options: ClientSideToolOptions = {}): void {
    this.toolOptions.set(toolName, options);
    logger.debug({ toolName, options }, "Registered client tool options");
  }

  /**
   * Check whether a tool name is registered as a client-side tool.
   * Handles the `mcp__<server>__<tool>` prefix convention by checking
   * both the full name and the suffix after the last `__`.
   */
  isClientSideTool(toolName: string): boolean {
    if (this.toolOptions.has(toolName)) return true;

    // Handle mcp__<server>__<tool> → check if <tool> is registered
    const lastSep = toolName.lastIndexOf("__");
    if (lastSep !== -1) {
      const suffix = toolName.slice(lastSep + 2);
      return this.toolOptions.has(suffix);
    }

    return false;
  }

  // -------------------------------------------------------------------------
  // Queue Management
  // -------------------------------------------------------------------------

  /**
   * Enqueue a tool use for a session. Called by the gateway stream loop when
   * a client-side tool_use block is encountered.
   */
  enqueue(sessionId: string, toolUseId: string, toolName: string): void {
    let queue = this.sessionQueues.get(sessionId);
    if (!queue) {
      queue = [];
      this.sessionQueues.set(sessionId, queue);
    }
    queue.push(toolUseId);

    // Pre-create the pending entry (without promise yet — that's set in waitForClient)
    // Actually we need to store toolName/sessionId for later lookup.
    // We'll store a "queued" entry that gets its promise set when waitForClient picks it up.
    // For simplicity, store metadata in a separate lightweight structure and create the
    // full PendingEntry in waitForClient.
    // Use a temporary entry with dummy resolve/reject — they'll be replaced.
    this.pending.set(toolUseId, {
      toolUseId,
      toolName,
      sessionId,
      createdAt: Date.now(),
      resolve: () => {},
      reject: () => {},
      timer: null,
    });

    logger.debug({ sessionId, toolUseId, toolName }, "Enqueued client tool");
  }

  /**
   * Dequeue the next pending tool for a session, create a promise, arm the
   * timeout, and return the result.
   *
   * Returns a CallToolResult with isError: true if the queue is empty or entry not found.
   * On timeout, resolves with a fallback CallToolResult (does not reject).
   */
  async waitForClient(sessionId: string): Promise<CallToolResult> {
    const queue = this.sessionQueues.get(sessionId);
    if (!queue || queue.length === 0) {
      return {
        content: [{ type: "text", text: "No pending client tool call found." }],
        isError: true,
      };
    }

    const toolUseId = queue.shift()!;
    // Clean up empty queue
    if (queue.length === 0) {
      this.sessionQueues.delete(sessionId);
    }

    const entry = this.pending.get(toolUseId);
    if (!entry) {
      // Shouldn't happen, but be defensive
      logger.warn({ sessionId, toolUseId }, "waitForClient: no pending entry found");
      return {
        content: [{ type: "text", text: "No pending client tool call found." }],
        isError: true,
      };
    }

    // Determine timeout
    const options = this.getToolOptions(entry.toolName);
    const effectiveTimeout = options?.timeoutMs && options.timeoutMs > 0
      ? Math.min(options.timeoutMs, GLOBAL_MAX_TIMEOUT_MS)
      : GLOBAL_MAX_TIMEOUT_MS;

    const toolName = entry.toolName;

    // Create the actual promise
    const promise = new Promise<CallToolResult>((resolve, reject) => {
      entry.resolve = resolve;
      entry.reject = reject;

      entry.timer = setTimeout(() => {
        this.pending.delete(toolUseId);
        const fallback = (options?.onTimeout ?? defaultTimeoutResult)({
          toolName,
          toolUseId,
          elapsedMs: effectiveTimeout,
        });
        resolve(fallback);
      }, effectiveTimeout);
    });

    logger.debug({ sessionId, toolUseId, toolName: entry.toolName, timeoutMs: effectiveTimeout }, "Waiting for client tool completion");

    return promise;
  }

  // -------------------------------------------------------------------------
  // Completion
  // -------------------------------------------------------------------------

  /**
   * Complete a pending tool call with a result. Called when the frontend POSTs
   * the tool result back.
   *
   * @returns true if the completion was accepted, false if not found or sessionId mismatch
   */
  complete(toolUseId: string, sessionId: string, result: CallToolResult): boolean {
    const entry = this.pending.get(toolUseId);
    if (!entry) {
      logger.warn({ toolUseId, sessionId }, "complete: no pending entry found");
      return false;
    }

    if (entry.sessionId !== sessionId) {
      logger.warn(
        { toolUseId, expectedSession: entry.sessionId, actualSession: sessionId },
        "complete: sessionId mismatch"
      );
      return false;
    }

    // Clear timeout
    if (entry.timer) {
      clearTimeout(entry.timer);
    }

    // Resolve the promise
    entry.resolve(result);
    this.pending.delete(toolUseId);

    logger.debug({ toolUseId, sessionId }, "Client tool completed");
    return true;
  }

  // -------------------------------------------------------------------------
  // Cancellation
  // -------------------------------------------------------------------------

  /**
   * Cancel all pending tool calls for a session. Rejects their promises with
   * ClientToolCancelledError.
   */
  cancelSession(sessionId: string): void {
    // Clear the queue
    this.sessionQueues.delete(sessionId);

    // Reject all pending entries for this session
    for (const [toolUseId, entry] of this.pending) {
      if (entry.sessionId === sessionId) {
        if (entry.timer) {
          clearTimeout(entry.timer);
        }
        entry.reject(new ClientToolCancelledError(toolUseId, sessionId));
        this.pending.delete(toolUseId);
      }
    }

    logger.debug({ sessionId }, "Cancelled all pending client tools for session");
  }

  // -------------------------------------------------------------------------
  // Garbage Collection
  // -------------------------------------------------------------------------

  /**
   * Clean up orphaned entries older than maxAgeMs.
   * Should be called periodically (e.g., from gateway lifecycle).
   *
   * @returns number of entries cleaned up
   */
  gc(maxAgeMs: number = GLOBAL_MAX_TIMEOUT_MS): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [toolUseId, entry] of this.pending) {
      if (now - entry.createdAt > maxAgeMs) {
        if (entry.timer) {
          clearTimeout(entry.timer);
        }
        entry.reject(new ClientToolTimeoutError(toolUseId, maxAgeMs));
        this.pending.delete(toolUseId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug({ cleaned, maxAgeMs }, "GC cleaned orphan client tool entries");
    }

    return cleaned;
  }

  // -------------------------------------------------------------------------
  // Helpers (for testing)
  // -------------------------------------------------------------------------

  /** Get the number of pending entries (for testing/monitoring) */
  get pendingCount(): number {
    return this.pending.size;
  }

  /** Get the queue length for a session (for testing/monitoring) */
  getQueueLength(sessionId: string): number {
    return this.sessionQueues.get(sessionId)?.length ?? 0;
  }

  /** Check if a specific toolUseId is pending */
  isPending(toolUseId: string): boolean {
    return this.pending.has(toolUseId);
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  private getToolOptions(toolName: string): ClientSideToolOptions | undefined {
    const direct = this.toolOptions.get(toolName);
    if (direct) return direct;

    // Handle mcp__ prefix
    const lastSep = toolName.lastIndexOf("__");
    if (lastSep !== -1) {
      const suffix = toolName.slice(lastSep + 2);
      return this.toolOptions.get(suffix);
    }

    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const clientToolCompletionRegistry = new ClientToolCompletionRegistry();

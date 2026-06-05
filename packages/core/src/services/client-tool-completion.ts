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
  promise: Promise<CallToolResult>;
  resolve: (result: CallToolResult) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout> | null;
  completedResult?: CallToolResult;
}

interface WaitingConsumer {
  sessionId: string;
  toolName?: string;
  timeoutToolName: string;
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

  /** Per-session consumers waiting for the next toolUseId to be enqueued */
  private sessionWaiters = new Map<string, WaitingConsumer[]>();

  /** GC interval handle */
  private gcInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.gcInterval = setInterval(() => this.gc(), 60_000);
    // Allow the process to exit even if the interval is still active
    if (this.gcInterval && typeof this.gcInterval === "object" && "unref" in this.gcInterval) {
      this.gcInterval.unref();
    }
  }

  /**
   * Stop the periodic GC interval. Call this for clean shutdown.
   */
  destroy(): void {
    if (this.gcInterval) {
      clearInterval(this.gcInterval);
      this.gcInterval = null;
    }
  }

  // -------------------------------------------------------------------------
  // Registration
  // -------------------------------------------------------------------------

  /**
   * Register a tool as client-side with optional timeout config.
   */
  registerToolOptions(toolName: string, options: ClientSideToolOptions = {}): void {
    const canonicalToolName = this.canonicalizeToolName(toolName);
    this.toolOptions.set(canonicalToolName, options);
    logger.debug({ toolName: canonicalToolName, registeredAs: toolName, options }, "Registered client tool options");
  }

  /**
   * Check whether a tool name is registered as a client-side tool.
   * Handles only trusted built-in MCP server prefixes. Do not match arbitrary
   * suffixes, otherwise a third-party MCP server can trigger local client tools
   * by exposing a tool with the same name.
   */
  isClientSideTool(toolName: string): boolean {
    const canonicalToolName = this.canonicalizeToolName(toolName);
    return this.toolOptions.has(canonicalToolName);
  }

  // -------------------------------------------------------------------------
  // Queue Management
  // -------------------------------------------------------------------------

  /**
   * Enqueue a tool use for a session. Called by the gateway stream loop when
   * a client-side tool_use block is encountered.
   */
  enqueue(sessionId: string, toolUseId: string, toolName: string): void {
    const canonicalToolName = this.canonicalizeToolName(toolName);
    let queue = this.sessionQueues.get(sessionId);
    if (!queue) {
      queue = [];
      this.sessionQueues.set(sessionId, queue);
    }
    queue.push(toolUseId);

    // If waitForClient already created the entry (called before enqueue), skip.
    if (this.pending.has(toolUseId)) {
      // Update toolName in case waitForClient created the entry without it
      const existing = this.pending.get(toolUseId)!;
      if (!existing.toolName) {
        existing.toolName = canonicalToolName;
      }
      logger.debug({ sessionId, toolUseId, toolName: canonicalToolName, originalToolName: toolName }, "Enqueued client tool (entry already exists)");
      return;
    }

    // Create the entry with a real promise from the start so that
    // cancelSession can properly reject it even before waitForClient is called.
    this.createPendingEntry(sessionId, toolUseId, canonicalToolName);

    this.resolveNextSessionWaiter(sessionId);

    logger.debug({ sessionId, toolUseId, toolName: canonicalToolName, originalToolName: toolName }, "Enqueued client tool");
  }

  /**
   * Dequeue the next pending tool for a session, arm the timeout, and return
   * the result.
   *
   * If called before `enqueue` for a given toolUseId, creates the entry
   * eagerly so ordering between enqueue and waitForClient is irrelevant.
   *
   * Returns a CallToolResult with isError: true if the queue is empty or entry not found.
   * On timeout, resolves with a fallback CallToolResult (does not reject).
   */
  async waitForClient(sessionId: string, toolUseId?: string, toolName?: string): Promise<CallToolResult> {
    const canonicalToolName = toolName ? this.canonicalizeToolName(toolName) : undefined;
    let resolvedToolUseId: string | undefined;

    const queue = this.sessionQueues.get(sessionId);
    if (queue && queue.length > 0) {
      resolvedToolUseId = this.takeNextQueuedToolUseId(sessionId, canonicalToolName);
      if (queue.length === 0) {
        this.sessionQueues.delete(sessionId);
      }
    }

    if (!resolvedToolUseId && toolUseId) {
      // Called before enqueue — create the entry eagerly so the caller can await it.
      resolvedToolUseId = toolUseId;
      if (!this.pending.has(toolUseId)) {
        this.createPendingEntry(sessionId, toolUseId, canonicalToolName ?? "");
      }
    } else if (!resolvedToolUseId) {
      return await this.waitForNextClientTool(sessionId, canonicalToolName);
    }

    const entry = this.pending.get(resolvedToolUseId!);
    if (!entry) {
      logger.warn({ sessionId, toolUseId: resolvedToolUseId }, "waitForClient: no pending entry found");
      return {
        content: [{ type: "text", text: "No pending client tool call found." }],
        isError: true,
      };
    }

    if (entry.completedResult) {
      const result = entry.completedResult;
      this.pending.delete(entry.toolUseId);
      return result;
    }

    // Arm timeout if not already armed
    if (!entry.timer) {
      const options = this.getToolOptions(entry.toolName);
      const effectiveTimeout = options?.timeoutMs && options.timeoutMs > 0
        ? Math.min(options.timeoutMs, GLOBAL_MAX_TIMEOUT_MS)
        : GLOBAL_MAX_TIMEOUT_MS;

      entry.timer = setTimeout(() => {
        this.pending.delete(entry.toolUseId);
        const fallback = (options?.onTimeout ?? defaultTimeoutResult)({
          toolName: entry.toolName,
          toolUseId: entry.toolUseId,
          elapsedMs: effectiveTimeout,
        });
        entry.resolve(fallback);
      }, effectiveTimeout);

      logger.debug({ sessionId, toolUseId: entry.toolUseId, toolName: entry.toolName, timeoutMs: effectiveTimeout }, "Waiting for client tool completion");
    }

    return entry.promise;
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

    // Resolve active waiters immediately. If the tool was completed before its
    // MCP handler consumed the queue item, retain the result until waitForClient
    // picks it up.
    if (entry.timer) {
      entry.resolve(result);
      this.pending.delete(toolUseId);
    } else {
      entry.completedResult = result;
    }

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

    const waiters = this.sessionWaiters.get(sessionId) ?? [];
    for (const waiter of waiters) {
      if (waiter.timer) {
        clearTimeout(waiter.timer);
      }
      waiter.reject(new ClientToolCancelledError("pending", sessionId));
    }
    this.sessionWaiters.delete(sessionId);

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

    for (const [sessionId, waiters] of this.sessionWaiters) {
      const retained = waiters.filter((waiter) => {
        if (now - waiter.createdAt <= maxAgeMs) return true;
        if (waiter.timer) {
          clearTimeout(waiter.timer);
        }
        waiter.reject(new ClientToolTimeoutError("pending", maxAgeMs));
        cleaned++;
        return false;
      });
      if (retained.length > 0) {
        this.sessionWaiters.set(sessionId, retained);
      } else {
        this.sessionWaiters.delete(sessionId);
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

  /** Get the number of waiters for a session awaiting the next toolUseId */
  getWaiterCount(sessionId: string): number {
    return this.sessionWaiters.get(sessionId)?.length ?? 0;
  }

  /** Check if a specific toolUseId is pending */
  isPending(toolUseId: string): boolean {
    return this.pending.has(toolUseId);
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  /**
   * Create a PendingEntry with a real Promise from the start.
   * Used by both `enqueue` and `waitForClient` (whichever runs first).
   */
  private createPendingEntry(sessionId: string, toolUseId: string, toolName: string): PendingEntry {
    let resolve: (result: CallToolResult) => void;
    let reject: (err: Error) => void;
    const promise = new Promise<CallToolResult>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    // Prevent unhandled rejection if the promise is rejected before anyone awaits it
    // (e.g., cancelSession called before waitForClient picks it up).
    promise.catch(() => {});

    const entry: PendingEntry = {
      toolUseId,
      toolName,
      sessionId,
      createdAt: Date.now(),
      promise,
      resolve: resolve!,
      reject: reject!,
      timer: null,
    };

    this.pending.set(toolUseId, entry);
    return entry;
  }

  private async waitForNextClientTool(sessionId: string, toolName?: string): Promise<CallToolResult> {
    const effectiveToolName = toolName ?? "client_tool";
    const options = this.getToolOptions(effectiveToolName);
    const effectiveTimeout = options?.timeoutMs && options.timeoutMs > 0
      ? Math.min(options.timeoutMs, GLOBAL_MAX_TIMEOUT_MS)
      : GLOBAL_MAX_TIMEOUT_MS;

    return new Promise<CallToolResult>((resolve, reject) => {
      const waiter: WaitingConsumer = {
        sessionId,
        toolName,
        timeoutToolName: effectiveToolName,
        createdAt: Date.now(),
        resolve,
        reject,
        timer: null,
      };

      waiter.timer = setTimeout(() => {
        this.removeSessionWaiter(sessionId, waiter);
        const fallback = (options?.onTimeout ?? defaultTimeoutResult)({
          toolName: effectiveToolName,
          toolUseId: "pending",
          elapsedMs: effectiveTimeout,
        });
        resolve(fallback);
      }, effectiveTimeout);

      let waiters = this.sessionWaiters.get(sessionId);
      if (!waiters) {
        waiters = [];
        this.sessionWaiters.set(sessionId, waiters);
      }
      waiters.push(waiter);

      logger.debug({ sessionId, toolName: effectiveToolName, timeoutMs: effectiveTimeout }, "Waiting for next client tool enqueue");
      this.resolveNextSessionWaiter(sessionId);
    });
  }

  private resolveNextSessionWaiter(sessionId: string): void {
    const queue = this.sessionQueues.get(sessionId);
    const waiters = this.sessionWaiters.get(sessionId);
    if (!queue?.length || !waiters?.length) return;

    const waiterIndex = waiters.findIndex((item) => this.hasQueuedToolUseForName(sessionId, item.toolName));
    if (waiterIndex === -1) return;

    const [waiter] = waiters.splice(waiterIndex, 1);
    if (waiters.length === 0) {
      this.sessionWaiters.delete(sessionId);
    }
    if (waiter.timer) {
      clearTimeout(waiter.timer);
      waiter.timer = null;
    }

    void this.waitForClient(sessionId, undefined, waiter.toolName)
      .then(waiter.resolve)
      .catch(waiter.reject);
  }

  private takeNextQueuedToolUseId(sessionId: string, toolName?: string): string | undefined {
    const queue = this.sessionQueues.get(sessionId);
    if (!queue?.length) return undefined;

    const index = toolName
      ? queue.findIndex((toolUseId) => this.pending.get(toolUseId)?.toolName === toolName)
      : 0;
    if (index === -1) return undefined;

    const [toolUseId] = queue.splice(index, 1);
    return toolUseId;
  }

  private hasQueuedToolUseForName(sessionId: string, toolName?: string): boolean {
    const queue = this.sessionQueues.get(sessionId);
    if (!queue?.length) return false;
    if (!toolName) return true;
    return queue.some((toolUseId) => this.pending.get(toolUseId)?.toolName === toolName);
  }

  private removeSessionWaiter(sessionId: string, waiter: WaitingConsumer): void {
    const waiters = this.sessionWaiters.get(sessionId);
    if (!waiters) return;
    const next = waiters.filter((item) => item !== waiter);
    if (next.length > 0) {
      this.sessionWaiters.set(sessionId, next);
    } else {
      this.sessionWaiters.delete(sessionId);
    }
  }

  private getToolOptions(toolName: string): ClientSideToolOptions | undefined {
    return this.toolOptions.get(this.canonicalizeToolName(toolName));
  }

  private canonicalizeToolName(toolName: string): string {
    if (toolName.startsWith("mcp__gui_action__")) {
      return toolName.slice("mcp__gui_action__".length);
    }
    if (toolName.startsWith("mcp__client_side_bash__")) {
      return toolName.slice("mcp__client_side_bash__".length);
    }

    return toolName;
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const clientToolCompletionRegistry = new ClientToolCompletionRegistry();

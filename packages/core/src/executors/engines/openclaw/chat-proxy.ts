/**
 * OpenClaw Chat Proxy
 *
 * Provides streaming chat via direct WebSocket to OpenClaw gateway,
 * converting protocol events to SSEMessage format.
 *
 * Key design (aligned with AionUi approach):
 * - Uses class-based OpenClawEventMapper (instance-scoped state, no module-level pollution)
 * - Supports session resume via `resume` option (resolves existing session by key)
 * - Multi-layer fallback for text delivery:
 *   - Layer 1: chat:delta cumulative events
 *   - Layer 2: agent.stream="assistant" fallback (handled inside mapper)
 *   - Layer 3: chat.history fetch when chat:final arrives but no text was received
 * - Tracks turnActive state to prevent late events from causing duplicate messages
 * - Emits SSEMessage[] from mapper (yields each message individually to the generator)
 */

import { randomUUID } from "node:crypto";
import type { OpenClawClient } from "./connection";
import type { SSEMessage } from "../../ops/types";
import { OpenClawEventMapper } from "./event-mapper";

export interface OpenClawChatOptions {
  prompt: string;
  sessionId?: string;
  /** Session key to resume an existing session (skips reset, uses sessions.resolve) */
  resume?: string;
}

/**
 * OpenClaw Chat Proxy
 *
 * Wraps an OpenClawClient to provide a high-level streaming chat interface.
 * Each call to `stream()` manages session lifecycle, event subscription, and
 * multi-layer fallback text recovery.
 */
export class OpenClawChatProxy {
  private client: OpenClawClient;
  private currentSessionKey: string | null = null;
  private aborted = false;
  private turnActive = false;

  constructor(client: OpenClawClient) {
    this.client = client;
  }

  /**
   * Stream a chat interaction, yielding SSEMessage events.
   *
   * Flow (following AionUi's sendMessage pattern):
   * 1. Resolve or create session
   * 2. Emit sdk_session message
   * 3. Subscribe to events (before sending, to avoid missing any)
   * 4. Send the chat message
   * 5. Iterate events, mapping through OpenClawEventMapper
   * 6. On terminal state: apply Layer 3 fallback if needed, then stop
   */
  async *stream(options: OpenClawChatOptions): AsyncGenerator<SSEMessage> {
    const { prompt, sessionId, resume } = options;
    this.aborted = false;
    this.turnActive = true;

    // Create or resolve session
    const session = await this.resolveSession(sessionId, resume);
    this.currentSessionKey = session.key;

    // Yield session info
    yield { type: "sdk_session", sdk_session_id: session.key };

    // Create per-turn event mapper instance (instance-scoped state)
    const mapper = new OpenClawEventMapper();

    // Register connection-lost handler to abort if reconnect fails
    let connectionLost = false;
    const unregisterLost = this.client.onConnectionLost(() => {
      this.aborted = true;
      this.turnActive = false;
      connectionLost = true;
    });

    // Subscribe to relevant events before sending (to not miss any)
    const events = this.client.events((frame) => {
      return frame.event === "chat" ||
             frame.event === "chat.event" ||
             frame.event === "agent" ||
             frame.event === "agent.event" ||
             frame.event === "exec.approval.request" ||
             frame.event === "exec.approval.requested" ||
             frame.event === "shutdown";
    });

    // Send message
    await this.client.chat.send({
      sessionKey: session.key,
      message: prompt,
      idempotencyKey: randomUUID(),
    });

    // Track whether we received any text content during this turn
    let receivedText = false;
    let lastRunId: string | undefined;

    // Stream events
    for await (const frame of events) {
      if (this.aborted) break;
      if (!this.turnActive) break;

      // Handle shutdown event - terminate gracefully
      if (frame.event === "shutdown") {
        const payload = frame.payload as { reason?: string } | undefined;
        yield {
          type: "error",
          message: `Gateway shutdown: ${payload?.reason ?? "unknown reason"}`,
        };
        break;
      }

      // Handle exec.approval.request - auto-approve (YOLO mode)
      if (mapper.isExecApprovalRequest(frame)) {
        const approvalId = mapper.getApprovalRequestId(frame);
        if (approvalId) {
          // Emit tool_use for visibility
          const result = mapper.mapEvent(frame);
          if (result !== null) {
            const messages = Array.isArray(result) ? result : [result];
            for (const msg of messages) {
              yield msg;
            }
          }
          // Auto-approve the execution
          this.autoApproveExec(approvalId);
        }
        continue;
      }

      // Map frame to SSEMessage(s)
      const result = mapper.mapEvent(frame);

      // Yield all messages produced by the mapper
      if (result !== null) {
        const messages = Array.isArray(result) ? result : [result];
        for (const msg of messages) {
          if (msg.type === "text") {
            receivedText = true;
          }
          yield msg;
        }
      }

      // Check for terminal state
      if (mapper.isTerminalState(frame)) {
        // Extract runId for potential history fallback
        const payload = frame.payload as { runId?: string } | undefined;
        lastRunId = payload?.runId;

        // Layer 3 fallback: if chat:final arrives but no text was received,
        // fetch last assistant message from chat.history
        if (!receivedText && this.currentSessionKey) {
          const fallbackMessages = await this.fetchHistoryFallback(lastRunId);
          for (const msg of fallbackMessages) {
            yield msg;
          }
        }

        break;
      }
    }

    unregisterLost();
    this.turnActive = false;
    this.currentSessionKey = null;

    // Emit error if stream ended due to connection loss
    if (connectionLost) {
      yield { type: "error", message: "OpenClaw gateway connection lost. Please retry." };
    }
  }

  /**
   * Abort the current run
   */
  async abort(): Promise<void> {
    this.aborted = true;
    this.turnActive = false;
    if (this.currentSessionKey) {
      try {
        await this.client.chat.abort({ sessionKey: this.currentSessionKey });
      } catch {
        // Ignore abort errors
      }
    }
  }

  /**
   * Get the current session key
   */
  getSessionKey(): string | null {
    return this.currentSessionKey;
  }

  // ===========================================================================
  // Permission Handling
  // ===========================================================================

  /**
   * Auto-approve an exec.approval.request (YOLO mode).
   * Sends exec.approval.resolve with decision "allow_once".
   * Fire-and-forget: errors are logged but don't break the stream.
   */
  private autoApproveExec(approvalId: string): void {
    this.client.execApproval
      .resolve({ id: approvalId, decision: "allow_once" })
      .catch((err) => {
        console.warn("[OpenClawChatProxy] Failed to auto-approve exec:", err?.message ?? err);
      });
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  /**
   * Resolve session following AionUi's pattern:
   * - If `resume` is provided, resolve existing session by key
   * - If `sessionId` is provided, reset (create/clear) session with that key
   * - Otherwise, generate a new session key and reset
   *
   * Fallback: if reset fails, try resolve (handles race conditions).
   */
  private async resolveSession(
    sessionId?: string,
    resume?: string,
  ): Promise<{ key: string }> {
    // Resume path: resolve existing session without resetting
    if (resume) {
      try {
        return await this.client.sessions.resolve({ key: resume });
      } catch {
        // If resolve fails, fall through to reset with the resume key
        // (session may have been garbage-collected)
        return await this.client.sessions.reset({ key: resume, reason: "new" });
      }
    }

    // New session path: reset creates/clears the session
    const key = sessionId ?? `viben-${Date.now()}`;
    try {
      return await this.client.sessions.reset({ key, reason: "new" });
    } catch {
      // Fallback: try plain resolve (handles race conditions where session already exists)
      return await this.client.sessions.resolve({ key });
    }
  }

  /**
   * Layer 3 fallback: fetch last assistant message from chat.history.
   *
   * When the gateway suppresses all content events (e.g., isSilentReplyText filter),
   * chat:final arrives with no message and no delta was received. Pull from
   * chat.history as last resort (inspired by AionUi's fetchAndEmitHistoryFallback).
   */
  private async fetchHistoryFallback(runId?: string): Promise<SSEMessage[]> {
    const sessionKey = this.currentSessionKey;
    if (!sessionKey) return [];

    try {
      const messages = await this.client.chat.history({ sessionKey, limit: 5 });

      // Find the last assistant message for this run
      // (fall back to any last assistant message if runId is unavailable)
      const lastAssistant = [...messages].reverse().find((m: unknown) => {
        const msg = m as { role?: string; runId?: string };
        return msg?.role === "assistant" && (!runId || !msg.runId || msg.runId === runId);
      });

      const text = this.extractTextFromMessage(lastAssistant);
      if (text) {
        return [{ type: "text", content: text }];
      }
    } catch {
      // History fetch failed, no fallback available
    }

    return [];
  }

  /**
   * Extract text content from a chat message payload.
   * Gateway sends content as string, array of blocks, or top-level text field.
   */
  private extractTextFromMessage(message: unknown): string | null {
    if (!message || typeof message !== "object") return null;
    const m = message as Record<string, unknown>;

    // Try content field
    const content = m.content;
    if (typeof content === "string") return content || null;
    if (Array.isArray(content)) {
      const text = content
        .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
        .filter((item) => item.type === "text")
        .map((item) => (typeof item.text === "string" ? item.text : ""))
        .join("");
      return text || null;
    }

    // Fallback: top-level text field
    if (typeof m.text === "string") return m.text || null;

    return null;
  }
}

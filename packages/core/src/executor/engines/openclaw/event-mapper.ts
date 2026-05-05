/**
 * OpenClaw Event Mapper
 *
 * Maps raw OpenClaw gateway WebSocket event frames to Viben SSEMessage format.
 *
 * Multi-layer fallback system (inspired by AionUi):
 * - Layer 1: chat:delta events (cumulative → incremental)
 * - Layer 2: agent.stream="assistant" events buffered as fallback text
 * - Layer 3: chat:final message content as last resort
 *
 * Protocol events:
 * - "chat" / "chat.event": Chat streaming (delta, final, aborted, error)
 * - "agent" / "agent.event": Agent events (tool calls, assistant text, thinking)
 */

import type { SSEMessage } from "../../ops/types";

// =============================================================================
// Types
// =============================================================================

export interface EventFrame {
  type: "event";
  event: string;
  payload?: unknown;
  seq?: number;
  stateVersion?: unknown;
}

interface ChatPayload {
  runId?: string;
  sessionKey?: string;
  seq?: number;
  state: "delta" | "final" | "aborted" | "error";
  message?: {
    content: string | Array<{ type: string; text: string }>;
  };
  errorMessage?: string;
  usage?: { inputTokens?: number; outputTokens?: number; costUsd?: number };
  stopReason?: string;
}

interface AgentPayload {
  stream: "tool" | "tool_call" | "assistant" | "thinking" | "thought" | "lifecycle";
  data: Record<string, unknown>;
  runId?: string;
  sessionKey?: string;
}

// =============================================================================
// Tool Kind Inference (from AionUi patterns)
// =============================================================================

const TOOL_KIND_PATTERNS: Array<{ pattern: RegExp; kind: "read" | "edit" | "execute" }> = [
  { pattern: /read|view|list|search|grep|glob|find|get|fetch|cat|head|tail|ls/, kind: "read" },
  { pattern: /write|edit|create|delete|patch|update|insert|remove|mkdir|mv|cp|rename/, kind: "edit" },
  { pattern: /exec|run|bash|shell|terminal|spawn|command/, kind: "execute" },
];

function inferToolKind(name: string): "read" | "edit" | "execute" | undefined {
  const n = name.toLowerCase();
  for (const { pattern, kind } of TOOL_KIND_PATTERNS) {
    if (pattern.test(n)) return kind;
  }
  return undefined;
}

// =============================================================================
// OpenClawEventMapper Class
// =============================================================================

/**
 * Class-based event mapper that maintains per-instance state.
 *
 * This avoids the module-level state problem where multiple concurrent streams
 * would conflict with each other.
 */
export class OpenClawEventMapper {
  /**
   * Layer 1: Accumulated text from chat:delta events.
   * chat:delta sends cumulative snapshots; we track what we've already yielded
   * and emit only the new (incremental) portion.
   */
  private accumulatedAssistantText = "";

  /**
   * Layer 2: Fallback text buffered from agent.stream="assistant" events.
   * Used when chat:delta is dropped (e.g., dropIfSlow on the gateway) and
   * chat:final arrives without inline message content.
   */
  private agentAssistantFallbackText = "";

  /**
   * Guard flag to prevent late-arriving chat events from creating duplicate
   * messages after the turn has already ended (e.g., delta after final, or
   * double final).
   */
  private turnActive = false;

  constructor() {
    this.reset();
  }

  /**
   * Reset all internal state for a new turn / conversation.
   */
  reset(): void {
    this.accumulatedAssistantText = "";
    this.agentAssistantFallbackText = "";
    this.turnActive = true;
  }

  /**
   * Map an OpenClaw gateway event frame to one or more Viben SSEMessages.
   * Returns null for events that should be skipped, a single message,
   * or an array of messages when multiple need to be emitted.
   */
  mapEvent(frame: EventFrame): SSEMessage | SSEMessage[] | null {
    const { event, payload } = frame;

    if (event === "chat" || event === "chat.event") {
      return this.mapChatEvent(payload as ChatPayload);
    }

    if (event === "agent" || event === "agent.event") {
      return this.mapAgentEvent(payload as AgentPayload);
    }

    if (event === "exec.approval.request" || event === "exec.approval.requested") {
      return this.mapExecApprovalEvent(payload);
    }

    return null;
  }

  /**
   * Check if an event frame represents a terminal state (final/aborted/error).
   * Useful for callers that need to know when to stop iterating.
   */
  isTerminalState(frame: EventFrame): boolean {
    if (frame.event !== "chat" && frame.event !== "chat.event") return false;
    const payload = frame.payload as ChatPayload | undefined;
    if (!payload) return false;
    return payload.state === "final" || payload.state === "aborted" || payload.state === "error";
  }

  // ===========================================================================
  // Chat Event Mapping
  // ===========================================================================

  private mapChatEvent(payload: ChatPayload): SSEMessage | SSEMessage[] | null {
    if (!payload) return null;

    // Ignore late chat events after turn has ended to prevent duplicate messages
    if (!this.turnActive && payload.state === "delta") return null;

    switch (payload.state) {
      case "delta":
        return this.handleChatDelta(payload);

      case "final":
        return this.handleChatFinal(payload);

      case "aborted":
        this.endTurn();
        return { type: "result", subtype: "error" };

      case "error":
        this.endTurn();
        return {
          type: "error",
          message: payload.errorMessage ?? "OpenClaw run failed",
        };

      default:
        return null;
    }
  }

  private handleChatDelta(payload: ChatPayload): SSEMessage | null {
    const cumulative = extractTextContent(payload.message?.content);
    if (!cumulative) return null;

    // chat:delta is working -- clear the fallback buffer so it won't be reused
    this.agentAssistantFallbackText = "";

    // Compute incremental delta from cumulative snapshot
    if (cumulative.length > this.accumulatedAssistantText.length &&
        cumulative.startsWith(this.accumulatedAssistantText)) {
      const delta = cumulative.slice(this.accumulatedAssistantText.length);
      this.accumulatedAssistantText = cumulative;
      return { type: "text", content: delta };
    }

    // Not a proper cumulative extension -- treat as incremental (non-standard but safe)
    if (cumulative !== this.accumulatedAssistantText) {
      this.accumulatedAssistantText = cumulative;
      return { type: "text", content: cumulative };
    }

    return null;
  }

  private handleChatFinal(payload: ChatPayload): SSEMessage | SSEMessage[] | null {
    const messages: SSEMessage[] = [];

    // Layer 1: Extract any remaining text from the final message itself
    const finalText = extractTextContent(payload.message?.content);
    if (finalText && finalText.length > this.accumulatedAssistantText.length) {
      const delta = finalText.slice(this.accumulatedAssistantText.length);
      this.accumulatedAssistantText = finalText;
      messages.push({ type: "text", content: delta });
    }

    // Layer 2 fallback: If no text was delivered via chat:delta, use agent assistant buffer
    if (this.accumulatedAssistantText.length === 0 && this.agentAssistantFallbackText) {
      messages.push({ type: "text", content: this.agentAssistantFallbackText });
      this.accumulatedAssistantText = this.agentAssistantFallbackText;
    }

    // Always emit a result message at the end
    messages.push({
      type: "result" as const,
      subtype: "success" as const,
      cost: payload.usage?.costUsd,
    });

    this.endTurn();

    return messages.length === 1 ? messages[0] : messages;
  }

  // ===========================================================================
  // Exec Approval Event Mapping
  // ===========================================================================

  /**
   * Check if an event frame is an exec.approval.request that needs a response.
   */
  isExecApprovalRequest(frame: EventFrame): boolean {
    return frame.event === "exec.approval.request" || frame.event === "exec.approval.requested";
  }

  /**
   * Extract the approval request ID from an exec.approval event.
   */
  getApprovalRequestId(frame: EventFrame): string | null {
    if (!this.isExecApprovalRequest(frame)) return null;
    const payload = frame.payload as { id?: string; request?: { id?: string } } | undefined;
    return payload?.id ?? payload?.request?.id ?? null;
  }

  private mapExecApprovalEvent(payload: unknown): SSEMessage | null {
    if (!payload || typeof payload !== "object") return null;
    const p = payload as {
      id?: string;
      request?: {
        command?: string;
        commandPreview?: string;
        cwd?: string;
        host?: string;
      };
    };

    const command = p.request?.command ?? p.request?.commandPreview ?? "exec approval";
    return {
      type: "tool_use",
      id: p.id ?? "",
      name: "exec_approval",
      input: {
        command,
        cwd: p.request?.cwd ?? undefined,
        host: p.request?.host ?? undefined,
        _kind: "execute" as const,
      },
    };
  }

  // ===========================================================================
  // Agent Event Mapping
  // ===========================================================================

  private mapAgentEvent(payload: AgentPayload): SSEMessage | null {
    if (!payload) return null;

    switch (payload.stream) {
      case "tool":
      case "tool_call":
        return this.handleToolEvent(payload.data);

      case "assistant":
        return this.handleAssistantStream(payload.data);

      case "thinking":
      case "thought":
      case "lifecycle":
        // Thinking and lifecycle events are not mapped to SSEMessage
        return null;

      default:
        return null;
    }
  }

  private handleToolEvent(data: Record<string, unknown>): SSEMessage | null {
    if (!data) return null;

    const phase = data.phase as string | undefined;
    const toolName = (data.name as string) ?? "unknown";
    const toolCallId = (data.toolCallId as string) ?? "";

    if (phase === "start") {
      const kind = inferToolKind(toolName);
      const input = data.args ?? {};
      const msg: SSEMessage = {
        type: "tool_use",
        id: toolCallId,
        name: toolName,
        input: kind ? { ...((typeof input === "object" && input !== null) ? input : {}), _kind: kind } : input,
      };
      return msg;
    }

    if (phase === "result" || phase === "partialResult") {
      return {
        type: "tool_result",
        tool_use_id: toolCallId,
        output: typeof data.result === "string"
          ? data.result
          : JSON.stringify(data.result ?? data.meta ?? ""),
        is_error: (data.isError as boolean) ?? false,
      };
    }

    return null;
  }

  private handleAssistantStream(data: Record<string, unknown>): SSEMessage | null {
    if (!data) return null;

    const text = data.text as string | undefined;
    if (!text) return null;

    // Buffer the assistant text as Layer 2 fallback.
    // Agent assistant events are cumulative, so always overwrite with latest.
    this.agentAssistantFallbackText = text;

    // If the turn has chat:delta flowing, we don't emit from here (Layer 1 takes priority).
    // But if chat:delta has NOT produced any text yet, this could be the only source.
    // We do NOT emit text here -- it will be used as fallback in handleChatFinal.
    return null;
  }

  // ===========================================================================
  // Internal Helpers
  // ===========================================================================

  private endTurn(): void {
    this.turnActive = false;
    this.accumulatedAssistantText = "";
    this.agentAssistantFallbackText = "";
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

function extractTextContent(content: string | Array<{ type: string; text: string }> | undefined): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  return content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
}

// =============================================================================
// Backward-Compatible Module-Level API
// =============================================================================

/**
 * Default instance for backward-compatible usage.
 * Note: This shares state across all callers using the module-level functions.
 * For concurrent streams, prefer creating separate OpenClawEventMapper instances.
 */
const defaultMapper = new OpenClawEventMapper();

/**
 * Reset the default event mapper instance (call at start of each new conversation).
 * Backward-compatible with existing callers.
 */
export function resetEventMapper(): void {
  defaultMapper.reset();
}

/**
 * Map an OpenClaw gateway event frame to a Viben SSEMessage using the default instance.
 * Returns null for events that should be skipped.
 *
 * Note: For backward compatibility, this flattens arrays to return only the first message.
 * Callers that need all messages from a single event should use OpenClawEventMapper directly.
 */
export function mapOpenClawEvent(frame: EventFrame): SSEMessage | null {
  const result = defaultMapper.mapEvent(frame);
  if (result === null) return null;
  if (Array.isArray(result)) return result[0] ?? null;
  return result;
}

/**
 * Gateway Utility Functions
 * 网关工具函数
 */

import type {
  SSEMessageEvent,
  SSETextEvent,
  SSEToolUseEvent,
  SSEToolResultEvent,
  SSEPlanEvent,
  SSEResultEvent,
  SSEErrorEvent,
  SSEQuestionEvent,
  SSESdkSessionEvent,
  AgentMessage,
  AvailabilityInfo,
} from "./types";

// ============================================================================
// SSE to AgentMessage Conversion
// ============================================================================

/**
 * Convert SSE event to AgentMessage
 *
 * SSE events from backend use flat structure (properties directly on event).
 */
export function sseEventToAgentMessage(
  event: SSEMessageEvent
): AgentMessage | null {
  const id = crypto.randomUUID();

  switch (event.type) {
    case "sdk_session": {
      const sdkSessionEvent = event as SSESdkSessionEvent;
      return {
        id,
        type: "sdk_session",
        sdkSessionId: sdkSessionEvent.sdkSessionId,
      };
    }
    case "text": {
      const textEvent = event as SSETextEvent;
      return {
        id,
        type: "text",
        content: textEvent.content,
      };
    }
    case "tool_use": {
      const toolEvent = event as SSEToolUseEvent;
      return {
        id: toolEvent.id || id,
        type: "tool_use",
        name: toolEvent.name,
        input: toolEvent.input as Record<string, unknown>,
      };
    }
    case "tool_result": {
      const resultEvent = event as SSEToolResultEvent;
      return {
        id,
        type: "tool_result",
        toolUseId: resultEvent.toolUseId,
        output: resultEvent.output,
        isError: resultEvent.isError,
      };
    }
    case "plan": {
      const planEvent = event as SSEPlanEvent;
      return {
        id,
        type: "plan",
        plan: {
          goal: planEvent.plan.goal,
          steps: planEvent.plan.steps.map((s) => ({
            id: s.id,
            description: s.description,
            status: s.status as "pending" | "in_progress" | "completed" | "failed" | "cancelled",
          })),
          notes: planEvent.plan.notes,
        },
      };
    }
    case "question": {
      const questionEvent = event as SSEQuestionEvent;
      return {
        id: questionEvent.id || id,
        type: "text",
        content: questionEvent.questions
          .map((q) => `**${q.header}**: ${q.question}`)
          .join("\n"),
      };
    }
    case "result": {
      const resultEvent = event as SSEResultEvent;
      // Backend sends cost/duration/subtype instead of content
      // Generate a summary message for UI display
      const parts: string[] = [];
      if (resultEvent.subtype) {
        parts.push(`Status: ${resultEvent.subtype}`);
      }
      if (resultEvent.duration !== undefined) {
        parts.push(`Duration: ${(resultEvent.duration / 1000).toFixed(2)}s`);
      }
      if (resultEvent.cost !== undefined) {
        parts.push(`Cost: $${resultEvent.cost.toFixed(4)}`);
      }
      return {
        id,
        type: "result",
        content: parts.length > 0 ? parts.join(" | ") : "Completed",
      };
    }
    case "error": {
      const errorEvent = event as SSEErrorEvent;
      return {
        id,
        type: "error",
        message: errorEvent.message,
        isError: true,
      };
    }
    case "session":
    case "done":
      return null;
    default:
      return null;
  }
}

// ============================================================================
// Availability Helpers
// ============================================================================

/**
 * Check if an availability status indicates the agent is available
 */
export function isAgentAvailable(availability: AvailabilityInfo): boolean {
  return (
    availability.type === "LOGIN_DETECTED" ||
    availability.type === "INSTALLATION_FOUND"
  );
}

/**
 * Get human-readable availability status
 */
export function getAvailabilityStatus(
  availability: AvailabilityInfo
): {
  label: string;
  variant: "success" | "warning" | "error";
} {
  switch (availability.type) {
    case "LOGIN_DETECTED":
      return { label: "Logged In", variant: "success" };
    case "INSTALLATION_FOUND":
      return { label: "Installed", variant: "success" };
    case "NOT_FOUND":
      return { label: "Not Found", variant: "error" };
    default:
      return { label: "Unknown", variant: "warning" };
  }
}

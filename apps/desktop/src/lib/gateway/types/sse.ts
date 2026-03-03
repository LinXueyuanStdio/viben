/**
 * SSE (Server-Sent Events) Types
 * SSE 事件类型定义
 *
 * These types match the backend's flat SSE message format.
 * Backend sends properties directly on the event, not nested in a `data` object.
 */

// ============================================================================
// SSE Event Types
// ============================================================================

/** SSE event types from agent stream */
export type SSEEventType =
  | "session"
  | "sdk_session"
  | "text"
  | "tool_use"
  | "tool_result"
  | "plan"
  | "question"
  | "result"
  | "error"
  | "done";

// ============================================================================
// SSE Event Interfaces (Flat structure matching backend)
// ============================================================================

/** Session created event - first event from agent run */
export interface SSESessionEvent {
  type: "session";
  sessionId: string;
  /** Trace ID for observability correlation */
  traceId?: string;
}

/** SDK Session event - contains SDK session ID for resume */
export interface SSESdkSessionEvent {
  type: "sdk_session";
  sdkSessionId: string;
}

/** Text message event */
export interface SSETextEvent {
  type: "text";
  content: string;
}

/** Tool use event */
export interface SSEToolUseEvent {
  type: "tool_use";
  id: string;
  name: string;
  input: unknown;
}

/** Tool result event */
export interface SSEToolResultEvent {
  type: "tool_result";
  toolUseId: string;
  output: string;
  isError?: boolean;
}

/** Plan event */
export interface SSEPlanEvent {
  type: "plan";
  plan: {
    id: string;
    goal: string;
    steps: Array<{
      id: string;
      description: string;
      status: "pending" | "in_progress" | "completed" | "failed";
    }>;
    notes?: string;
  };
}

/** Question event - interactive question from agent */
export interface SSEQuestionEvent {
  type: "question";
  id: string;
  questions: Array<{
    header: string;
    question: string;
    options: Array<{ label: string; description?: string }>;
    multiSelect: boolean;
  }>;
}

/** Result event */
export interface SSEResultEvent {
  type: "result";
  cost?: number;
  duration?: number;
  subtype?: "success" | "error" | "error_max_turns";
}

/** Error event */
export interface SSEErrorEvent {
  type: "error";
  message: string;
}

/** Done event */
export interface SSEDoneEvent {
  type: "done";
}

/** Union type of all SSE message events */
export type SSEMessageEvent =
  | SSESessionEvent
  | SSESdkSessionEvent
  | SSETextEvent
  | SSEToolUseEvent
  | SSEToolResultEvent
  | SSEPlanEvent
  | SSEQuestionEvent
  | SSEResultEvent
  | SSEErrorEvent
  | SSEDoneEvent;

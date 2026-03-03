/**
 * SSE (Server-Sent Events) Types
 * SSE 事件类型定义
 */

// ============================================================================
// SSE Event Types
// ============================================================================

/** SSE event types from agent stream */
export type SSEEventType =
  | "session"
  | "text"
  | "tool_use"
  | "tool_result"
  | "plan"
  | "question"
  | "result"
  | "error"
  | "done";

/** Base SSE event */
export interface SSEEvent {
  type: SSEEventType;
  data: unknown;
}

/** Session created event - first event from agent run */
export interface SSESessionEvent {
  type: "session";
  sessionId: string;
  /** Trace ID for observability correlation */
  traceId?: string;
}

/** Text message event */
export interface SSETextEvent extends SSEEvent {
  type: "text";
  data: {
    content: string;
    partial?: boolean;
  };
}

/** Tool use event */
export interface SSEToolUseEvent extends SSEEvent {
  type: "tool_use";
  data: {
    id: string;
    name: string;
    input: Record<string, unknown>;
  };
}

/** Tool result event */
export interface SSEToolResultEvent extends SSEEvent {
  type: "tool_result";
  data: {
    tool_use_id: string;
    output: string;
    is_error?: boolean;
  };
}

/** Plan event */
export interface SSEPlanEvent extends SSEEvent {
  type: "plan";
  data: {
    goal: string;
    steps: Array<{
      id: string;
      description: string;
      status: string;
    }>;
    notes?: string;
  };
}

/** Result event */
export interface SSEResultEvent extends SSEEvent {
  type: "result";
  data: {
    content: string;
    success: boolean;
  };
}

/** Error event */
export interface SSEErrorEvent extends SSEEvent {
  type: "error";
  data: {
    message: string;
    code?: string;
  };
}

/** Done event */
export interface SSEDoneEvent extends SSEEvent {
  type: "done";
  data: {
    session_id: string;
  };
}

/** Question event - interactive question from agent */
export interface SSEQuestionEvent extends SSEEvent {
  type: "question";
  data: {
    id: string;
    questions: Array<{
      header: string;
      question: string;
      options: Array<{ label: string; description?: string }>;
      multiSelect: boolean;
    }>;
  };
}

/** Union type of all SSE message events */
export type SSEMessageEvent =
  | SSESessionEvent
  | SSETextEvent
  | SSEToolUseEvent
  | SSEToolResultEvent
  | SSEPlanEvent
  | SSEQuestionEvent
  | SSEResultEvent
  | SSEErrorEvent
  | SSEDoneEvent;

/**
 * WebSocket types for vibe-kanban real-time streaming
 * Uses JSON Patch (RFC 6902) for incremental updates
 */

import type { Operation } from "fast-json-patch";

/**
 * WebSocket connection states
 */
export type WebSocketState =
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

/**
 * JSON Patch message from server
 * Each message contains an array of JSON Patch operations
 */
export interface JsonPatchMessage {
  patch: Operation[];
}

/**
 * Stream finished message
 * Sent when initial snapshot is complete or stream ends
 */
export interface StreamFinishedMessage {
  finished: true;
}

/**
 * Union type for all WebSocket messages
 */
export type WebSocketMessage = JsonPatchMessage | StreamFinishedMessage;

/**
 * Type guard for JSON Patch messages
 */
export function isJsonPatchMessage(
  message: unknown
): message is JsonPatchMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    "patch" in message &&
    Array.isArray((message as JsonPatchMessage).patch)
  );
}

/**
 * Type guard for stream finished messages
 */
export function isStreamFinishedMessage(
  message: unknown
): message is StreamFinishedMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    "finished" in message &&
    (message as StreamFinishedMessage).finished === true
  );
}

/**
 * Options for WebSocket connection
 */
export interface WebSocketOptions {
  /** Project ID to stream tasks for */
  projectId: string;
  /** Callback when connection state changes */
  onStateChange?: (state: WebSocketState) => void;
  /** Callback for errors */
  onError?: (error: Error) => void;
  /** Enable automatic reconnection (default: true) */
  autoReconnect?: boolean;
  /** Maximum reconnection attempts (default: 10) */
  maxReconnectAttempts?: number;
  /** Base delay for exponential backoff in ms (default: 1000) */
  baseReconnectDelay?: number;
  /** Maximum reconnection delay in ms (default: 8000) */
  maxReconnectDelay?: number;
}

/**
 * Return type for WebSocket hook
 */
export interface UseWebSocketReturn<T> {
  /** Current data state */
  data: T | null;
  /** WebSocket connection state */
  connectionState: WebSocketState;
  /** Whether initial snapshot has been received */
  isInitialized: boolean;
  /** Current error if any */
  error: Error | null;
  /** Manual reconnect function */
  reconnect: () => void;
  /** Disconnect function */
  disconnect: () => void;
}

/**
 * Build WebSocket URL for task streaming
 */
export function buildTasksWebSocketUrl(projectId: string): string {
  const isDev = import.meta.env.DEV;

  if (isDev) {
    // In development, use Vite proxy with ws protocol on same port
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    return `${protocol}//${host}/vibe-kanban-api/tasks/stream/ws?project_id=${encodeURIComponent(projectId)}`;
  }

  // In production (Tauri), connect directly to vibe-kanban backend
  const baseUrl = import.meta.env.VITE_VIBE_KANBAN_API_URL || "http://127.0.0.1:60964";
  const wsUrl = baseUrl.replace(/^http/, "ws");
  return `${wsUrl}/api/tasks/stream/ws?project_id=${encodeURIComponent(projectId)}`;
}

/**
 * Known WebSocket close codes
 * https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent/code
 */
const KNOWN_WS_CLOSE_CODES = [
  1000, 1001, 1002, 1003, 1005, 1006, 1007, 1008,
  1009, 1010, 1011, 1012, 1013, 1014, 1015, 4000,
];

/**
 * Get human-readable reason for WebSocket close code
 * @param code - WebSocket close code
 * @param t - Translation function (from useTranslation)
 * @param serverReason - Optional reason provided by server
 */
export function getWebSocketCloseReason(
  code: number,
  t: (key: string, options?: Record<string, unknown>) => string,
  serverReason?: string
): string {
  const codeKey = `websocket.closeCodes.${code}`;
  const hasKnownCode = KNOWN_WS_CLOSE_CODES.includes(code);

  if (serverReason) {
    // If server provided a reason, use it with the code description
    const codeDesc = hasKnownCode ? t(codeKey) : `Code ${code}`;
    return `${codeDesc} - ${serverReason}`;
  }

  if (hasKnownCode) {
    return t(codeKey);
  }

  return t("websocket.closedWithCode", { code });
}

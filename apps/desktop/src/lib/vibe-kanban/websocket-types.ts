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
 * WebSocket close codes and their descriptions
 * https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent/code
 */
const WS_CLOSE_CODES: Record<number, { en: string; zh: string }> = {
  1000: { en: "Normal closure", zh: "正常关闭" },
  1001: { en: "Going away", zh: "端点离开" },
  1002: { en: "Protocol error", zh: "协议错误" },
  1003: { en: "Unsupported data", zh: "不支持的数据类型" },
  1005: { en: "No status received", zh: "未收到状态码" },
  1006: { en: "Abnormal closure - server may be unavailable", zh: "连接异常关闭，服务器可能不可用" },
  1007: { en: "Invalid frame payload data", zh: "无效的数据帧" },
  1008: { en: "Policy violation", zh: "策略违规" },
  1009: { en: "Message too big", zh: "消息过大" },
  1010: { en: "Mandatory extension missing", zh: "缺少必要扩展" },
  1011: { en: "Internal server error", zh: "服务器内部错误" },
  1012: { en: "Service restart", zh: "服务重启" },
  1013: { en: "Try again later", zh: "请稍后重试" },
  1014: { en: "Bad gateway", zh: "网关错误" },
  1015: { en: "TLS handshake failure", zh: "TLS 握手失败" },
  4000: { en: "Heartbeat timeout", zh: "心跳超时" },
};

/**
 * Get human-readable reason for WebSocket close code
 * Returns Chinese description if browser language is Chinese
 */
export function getWebSocketCloseReason(code: number, serverReason?: string): string {
  const isZh = navigator.language.startsWith("zh");
  const codeInfo = WS_CLOSE_CODES[code];

  if (serverReason) {
    // If server provided a reason, use it with the code description
    const codeDesc = codeInfo ? (isZh ? codeInfo.zh : codeInfo.en) : `Code ${code}`;
    return `${codeDesc}${serverReason ? ` - ${serverReason}` : ""}`;
  }

  if (codeInfo) {
    return isZh ? codeInfo.zh : codeInfo.en;
  }

  return isZh ? `WebSocket 关闭 (错误码: ${code})` : `WebSocket closed (code: ${code})`;
}

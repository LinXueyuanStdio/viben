/**
 * MCP WebSocket Event Types
 *
 * Types for MCP-related events received via WebSocket.
 * These events are broadcast by the Gateway when MCP server status changes.
 */

// ============================================================================
// MCP WebSocket Event Types
// ============================================================================

/** MCP process status */
export type McpProcessStatus = "running" | "stopped" | "error";

/** MCP process status changed event data */
export interface McpProcessStatusChangedData {
  server_id: string;
  server_name: string;
  old_status: McpProcessStatus;
  new_status: McpProcessStatus;
  pid?: number;
  error?: string;
}

/** MCP server started/stopped event data */
export interface McpServerEventData {
  server_id: string;
  server_name: string;
  pid?: number;
  port?: number;
  error?: string;
}

/** MCP config changed event data */
export interface McpConfigChangedData {
  config_path: string;
  change_type: "created" | "modified" | "deleted";
  timestamp: number;
}

// ============================================================================
// MCP WebSocket Event Union
// ============================================================================

/** All possible MCP WebSocket event types (PascalCase as received from WebSocket) */
export type McpWebSocketEventType =
  | "McpProcessStatusChanged"
  | "McpServerStarted"
  | "McpServerStopped"
  | "McpConfigChanged";

/** MCP WebSocket event payload */
export type McpWebSocketEvent =
  | { type: "McpProcessStatusChanged"; data: McpProcessStatusChangedData }
  | { type: "McpServerStarted"; data: McpServerEventData }
  | { type: "McpServerStopped"; data: McpServerEventData }
  | { type: "McpConfigChanged"; data: McpConfigChangedData };

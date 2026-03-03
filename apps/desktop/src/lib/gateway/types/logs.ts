/**
 * Log Types
 * 日志类型定义
 */

// ============================================================================
// Session Log Types
// ============================================================================

/** Log level */
export type LogLevel = "info" | "warning" | "error" | "debug";

/** Log entry */
export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  source?: string;
}

/** Log session */
export interface LogSession {
  run_id: string;
  id: string;
  server_id: string;
  server_name: string;
  pid: number | null;
  created_at: string;
  updated_at: string;
  ended_at: string | null;
  log_file: string;
  log_count: number;
  error_count: number;
  started_at?: string;
}

/** Log session summary */
export interface LogSessionSummary {
  sessions: LogSession[];
  total_sessions: number;
}

// ============================================================================
// API Log Types
// ============================================================================

/** API log entry */
export interface ApiLogEntry {
  timestamp: string;
  run_id: string;
  api_key_hash: string | null;
  provider: string;
  source: string;
  method: "search" | "download" | "read";
  request: Record<string, unknown>;
  response: Record<string, unknown>;
  latency_ms: number;
  status: "success" | "error";
  error: string | null;
}

/** API log summary */
export interface ApiLogSummary {
  run_id: string;
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  by_source: Record<string, number>;
  by_method: Record<string, number>;
  avg_latency_ms: number;
}

/** API log session */
export interface ApiLogSession {
  run_id: string;
  log_file: string;
  entry_count: number;
  created_at: string | null;
  last_entry_at: string | null;
}

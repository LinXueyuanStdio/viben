// Python types
export interface PythonInfo {
  path: string;
  version: string | null;
  is_valid: boolean;
}

export interface PackageInfo {
  name: string;
  version: string | null;
  installed: boolean;
}

// Provider types - data sources configuration
export interface Provider {
  id: string;
  name: string;
  category: "free" | "api_key" | "institutional";
  requiresApiKey: boolean;
  hasApiKey?: boolean; // Whether API key is configured
  description?: string;
}

// Service API Key - for authenticating external clients
export interface ServiceApiKey {
  id: string;
  name: string;
  keyPrefix: string; // Masked key for display
  createdAt: string;
  lastUsed?: string;
  usageCount?: number; // Number of requests made with this key
}

// MCP Server Instance - a configured server with selected sources
export interface McpServerInstance {
  id: string;
  name: string;
  transport: "stdio" | "sse" | "http";
  port?: number;
  downloadPath: string;
  enabledSources: string[]; // Provider IDs
  apiKeys: ServiceApiKey[];
  // Runtime state
  status: "stopped" | "running";
  pid?: number;
}

// MCP Config for starting a server (internal use)
export interface McpStartConfig {
  python_path: string;
  transport: "stdio" | "sse" | "http";
  port?: number;
  download_path?: string;
  enabled_sources?: string[];
  api_keys?: Record<string, string>; // Provider API keys
  server_id?: string; // For logging
  server_name?: string; // For logging
}

// MCP Status from backend
export interface McpStatus {
  running: boolean;
  pid: number | null;
  transport: string | null;
  port: number | null;
  session_id?: string | null;
}

// Agent types
export interface AgentInfo {
  id: string;
  name: string;
  installed: boolean;
  configured: boolean;
  config_path: string | null;
  app_path: string | null;
}

// Agent MCP Configuration - which server and key to use
export interface AgentMcpAssignment {
  agentId: string;
  serverId: string;
  apiKeyId?: string; // Optional, for SSE/HTTP
}

// MCP config format for agent config files
export interface McpServerJsonConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export interface AgentMcpConfig {
  mcpServers: Record<string, McpServerJsonConfig>;
}

// Marketplace types - hierarchical provider/source structure

/** Source info from a provider in the marketplace index */
export interface MarketplaceSource {
  name: string;
  description: string;
  apiKey: "none" | "optional" | "required";
  documentation?: string;
}

/** Provider info in the marketplace index */
export interface MarketplaceProvider {
  name: string;
  description: string;
  author: string;
  homepage?: string;
  sources: Record<string, MarketplaceSource>;
}

/** Full provider index from provider.index.json */
export interface ProviderIndex {
  version: string;
  updated_at?: string;
  providers: Record<string, MarketplaceProvider>;
}

/** Flattened source for UI display */
export interface FlatSource {
  /** Hierarchical ID: provider/source */
  id: string;
  /** Flat source name */
  source_name: string;
  /** Provider ID */
  provider_id: string;
  /** Display name */
  name: string;
  /** Description */
  description: string;
  /** API key requirement */
  api_key_type: "none" | "optional" | "required";
  /** Documentation URL */
  documentation?: string;
  /** Provider display name */
  provider_name: string;
}

// API Log types

/** API log entry from JSONL files */
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

/** API log session info */
export interface ApiLogSession {
  run_id: string;
  log_file: string;
  entry_count: number;
  created_at: string | null;
  last_entry_at: string | null;
}

/** API log summary statistics */
export interface ApiLogSummary {
  run_id: string;
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  by_source: Record<string, number>;
  by_method: Record<string, number>;
  avg_latency_ms: number;
}

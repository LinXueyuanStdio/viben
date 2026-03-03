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

// MCP Server Status - runtime status of a server
export type McpServerStatus = "stopped" | "running" | "error";

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
  status: McpServerStatus;
  pid?: number;
}

// MCP Server Status Info - cached status with metadata
export interface McpServerStatusInfo {
  status: McpServerStatus;
  lastChecked: number; // timestamp
  error?: string;
  pid?: number; // Process ID for matching with log sessions
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

// Marketplace types - plugin-centric structure (v2 schema)

/** Category definition in the marketplace index */
export interface MarketplaceCategory {
  id: string;
  name: string;
  description: string;
  icon?: string;
  plugin_count: number;
  source_count: number;
}

/** Source info from a plugin in the marketplace index */
export interface MarketplaceSource {
  name: string;
  description: string;
  category?: string;
  apiKey: "none" | "optional" | "required";
  documentation?: string;
}

/** Plugin info in the marketplace index (v2 schema) */
export interface MarketplacePlugin {
  id: string;
  name: string;
  description: string;
  version?: string;
  author_name: string;
  author_email?: string;
  author_url?: string;
  homepage?: string;
  repository?: string;
  license?: string;
  categories: string[];
  builtin: boolean;
  package?: string;
  source_count: number;
  sources: string[];
}

/** Full provider index response from backend (v2 schema) */
export interface ProviderIndex {
  version: string;
  updated_at?: string;
  categories: MarketplaceCategory[];
  plugins: MarketplacePlugin[];
}

/** Flattened source for UI display */
export interface FlatSource {
  /** Hierarchical ID: plugin/source */
  id: string;
  /** Flat source name */
  source_name: string;
  /** Plugin ID */
  plugin_id: string;
  /** Display name */
  name: string;
  /** Description */
  description: string;
  /** Category ID */
  category?: string;
  /** API key requirement */
  api_key_type: "none" | "optional" | "required";
  /** Documentation URL */
  documentation?: string;
  /** Plugin display name */
  plugin_name: string;
}

// Inspector types

/** Connection status for MCP inspector */
export type InspectorConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

/** Notification entry in inspector */
export interface InspectorNotification {
  id: string;
  method: string;
  params?: Record<string, unknown>;
  timestamp: Date;
  type: "notification" | "stderr";
}

/** Tool definition from MCP server */
export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

/** Resource definition from MCP server */
export interface McpResource {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
}

/** Resource template definition from MCP server */
export interface McpResourceTemplate {
  uriTemplate: string;
  name?: string;
  description?: string;
  mimeType?: string;
}

/** Prompt definition from MCP server */
export interface McpPrompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

/** Server capabilities from MCP */
export interface McpServerCapabilities {
  tools?: Record<string, unknown>;
  resources?: Record<string, unknown>;
  prompts?: Record<string, unknown>;
  roots?: Record<string, unknown>;
  sampling?: Record<string, unknown>;
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

// Workspace Management types

/** Workspace type - global (non-deletable) or custom (user-added) */
export type WorkspaceType = "global" | "custom";

/** Workspace represents a folder that can contain agent configurations */
export interface Workspace {
  id: string;
  name: string;
  path: string;
  type: WorkspaceType;
  created_at: string;
  last_accessed: string;
}

/**
 * Executor type identifier (auto-discovered backend)
 * Re-exported from @viben/core/shared with additional "UNKNOWN" fallback
 * Note: Using /shared subpath to avoid Node.js-only dependencies like undici
 */
import type { ExecutorType as CoreExecutorType } from "@viben/core/shared";
export type ExecutorType = CoreExecutorType | "UNKNOWN";

/** @deprecated Use ExecutorType instead */
export type WorkspaceAgentType = ExecutorType;

/** Executor detected within a workspace (auto-discovered backend) */
export interface Executor {
  id: string;
  workspace_id: string;
  name: string;
  type: ExecutorType;
  config_path: string;
  mcp_config_file: string | null;
  skills_config_file: string | null;
}

/** @deprecated Use Executor instead */
export type WorkspaceAgent = Executor;

/** MCP Server configuration from workspace agent config */
export interface WorkspaceMcpServer {
  name: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  transport?: string;
  headers?: Record<string, string>;
  disabled?: boolean;
}

/** Skill installed for an agent in workspace */
export interface WorkspaceSkill {
  id: string;
  name: string;
  version: string;
  source: "marketplace" | "local" | string;
  path?: string; // For local skills
  description?: string; // Skill description from SKILL.md
}

/** File entry for skill folder tree */
export interface SkillFileEntry {
  name: string;
  path: string;
  is_directory: boolean;
  children?: SkillFileEntry[];
}

/** Agent config file (.claude/agents/*.md) */
export interface WorkspaceAgentConfig {
  id: string;              // filename without extension
  name: string;            // from frontmatter
  description: string;     // from frontmatter
  tools: string[];         // parsed from comma-separated
  model: string;           // from frontmatter
  path: string;            // full file path
  content: string;         // markdown content after frontmatter
}

/** Command file (.claude/commands/ folder) */
export interface WorkspaceCommand {
  id: string;              // namespace/command format
  namespace: string;       // folder name (e.g., "trellis")
  name: string;            // filename without extension
  path: string;            // full file path
  content: string;         // full markdown content
}

// Filesystem types

/** File entry for file browser */
export interface FileEntry {
  name: string;
  path: string;
  is_directory: boolean;
  size?: number;
  modified?: string;
  created?: string;
}

/** File information with detailed metadata */
export interface FileInfo {
  name: string;
  path: string;
  is_directory: boolean;
  size: number;
  modified: string;
  created: string;
  extension?: string;
}

/** View mode for file browser */
export type FileBrowserViewMode = "list" | "icon" | "column" | "gallery";

// Re-export official registry types
export * from "./official-registry";

// Re-export chat types
export * from "./chat";

// Re-export agent/executor types
export * from "./agent";

// Re-export channel types
export * from "./channel";

// Re-export chat config types
export * from "./chat-config";

// Re-export unified agent types
export * from "./unified-agent";

// Re-export group chat types
export * from "./group-chat";

// Re-export notification types
export * from "./notification";

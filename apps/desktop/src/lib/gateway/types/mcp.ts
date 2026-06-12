/**
 * MCP (Model Context Protocol) Server Types
 * MCP 服务器类型定义
 */

// ============================================================================
// MCP Server Config Types
// ============================================================================

/** MCP Server configuration */
export interface WorkspaceMcpServerConfig {
  name: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  transport?: string;
  headers?: Record<string, string>;
  disabled?: boolean;
}

/** Response for listing MCP servers */
export interface WorkspaceMcpServersResponse {
  servers: WorkspaceMcpServerConfig[];
  total: number;
}

// ============================================================================
// Browse-MCP Types
// ============================================================================

/** Browse-MCP server status */
export interface McpStatus {
  running: boolean;
  pid: number | null;
  transport: string | null;
  port: number | null;
  /** Command that was executed */
  command?: string;
  /** Full command line arguments */
  args?: string[];
  /** Startup timestamp */
  startedAt?: string;
  /** Endpoint URL for connecting */
  endpointUrl?: string;
  /** Exit code if process terminated */
  exitCode?: number | null;
  /** Exit signal if process was killed */
  exitSignal?: string | null;
  /** Stderr output from the process */
  stderr?: string;
  /** Stdout output from the process */
  stdout?: string;
  /** Error message if startup failed */
  error?: string;
}

/** Configuration for starting browse-mcp server */
export interface McpStartConfig {
  python_path: string;
  transport: "stdio" | "sse" | "http" | string;
  port?: number;
  download_path?: string;
  enabled_sources?: string[];
  api_keys?: Record<string, string>;
  server_id?: string;
  server_name?: string;
}

/** Port status */
export interface PortStatus {
  in_use: boolean;
  pid: number | null;
  process_name: string | null;
}

// ============================================================================
// MCP Proxy Types
// ============================================================================

/** MCP Proxy status */
export interface McpProxyStatus {
  running: boolean;
  pid: number | null;
  host: string | null;
  port: number | null;
  auth_token: string | null;
  url: string | null;
}

/** MCP Proxy config */
export interface McpProxyConfig {
  python_path: string;
  host: string;
  port: number;
  auth_token?: string;
}

/** Port process info */
export interface PortProcess {
  pid: number;
  name: string | null;
  is_mcp_proxy: boolean;
}

/** MCP Server port status */
export interface McpServerPortStatus {
  status: "running" | "stopped" | "conflict";
  pid: number | null;
  process_name: string | null;
  is_mcp_server: boolean;
}

// ============================================================================
// MCP Inspector Types
// ============================================================================

/** MCP Inspector health response */
export interface McpInspectorHealth {
  status: string;
  sessions: number;
}

/** MCP Inspector token response */
export interface McpInspectorToken {
  token: string | null;
  authDisabled: boolean;
}

/** MCP Inspector config response */
export interface McpInspectorConfig {
  defaultEnvironment: Record<string, string>;
  defaultCommand: string;
  defaultArgs: string;
  defaultTransport: string;
  defaultServerUrl: string;
  authRequired: boolean;
}

/** MCP Inspector session info */
export interface McpInspectorSession {
  sessionId: string;
  transportType: string;
  createdAt: string;
  serverConnected: boolean;
}

// ============================================================================
// Service API Key Types
// ============================================================================

/** Service API Key */
export interface ServiceApiKey {
  id: string;
  name: string;
  key: string;
  key_prefix: string;
  enabled_sources: string[];
  created_at: string;
  last_used: string | null;
}

/** Updates for a service API key */
export interface ServiceApiKeyUpdate {
  name?: string;
  enabled_sources?: string[];
}

// ============================================================================
// Skill Types
// ============================================================================

/** Workspace Skill configuration */
export interface WorkspaceSkillConfig {
  id: string;
  name: string;
  version: string;
  source: string;
  path?: string;
  description?: string;
}

/** Response for listing skills */
export interface WorkspaceSkillsResponse {
  skills: WorkspaceSkillConfig[];
  total: number;
}

// ============================================================================
// Agent Config Types (prompts from .claude/agents/*.md)
// ============================================================================

/** Agent config data from .claude/agents/*.md */
export interface WorkspaceAgentConfigData {
  id: string;
  name: string;
  description: string;
  tools: string[];
  model: string;
  path: string;
  content: string;
}

/** Response for listing agent configs */
export interface WorkspaceAgentConfigsResponse {
  configs: WorkspaceAgentConfigData[];
}

// ============================================================================
// Command Types (slash commands from .claude/commands/)
// ============================================================================

/** Command data from .claude/commands/ */
export interface WorkspaceCommandData {
  id: string;
  namespace: string;
  name: string;
  path: string;
  content: string;
}

/** Response for listing commands */
export interface WorkspaceCommandsResponse {
  commands: WorkspaceCommandData[];
}

// ============================================================================
// Prompt Types (.claude/prompts/ or similar)
// ============================================================================

/** Prompt data from .claude/prompts/ */
export interface WorkspacePromptData {
  id: string;
  name: string;
  description: string;
  path: string;
  content: string;
}

/** Response for listing prompts */
export interface WorkspacePromptsResponse {
  prompts: WorkspacePromptData[];
}

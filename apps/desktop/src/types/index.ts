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

// Agent types
export interface AgentInfo {
  id: string;
  name: string;
  installed: boolean;
  configured: boolean;
  config_path: string | null;
  app_path: string | null;
}

export interface McpServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export interface AgentMcpConfig {
  mcpServers: Record<string, McpServerConfig>;
}

// MCP types
export interface McpConfig {
  python_path: string;
  transport: "stdio" | "sse" | "http";
  port?: number;
  download_path?: string;
  enabled_sources?: string[];
  disabled_sources?: string[];
}

export interface McpStatus {
  running: boolean;
  pid: number | null;
  transport: string | null;
  port: number | null;
}

// Provider types
export interface Provider {
  id: string;
  name: string;
  category: "free" | "api_key" | "institutional";
  enabled: boolean;
  requiresApiKey: boolean;
  hasApiKey?: boolean;
}

/**
 * MCP-specific types (re-exports from main types for convenience)
 */
export type { McpServer, InstalledMcp } from "../types";

/**
 * MCP servers config file structure (per agent)
 */
export interface McpServersFile {
  mcpServers: Record<string, McpServerEntry>;
}

/**
 * MCP server entry in config
 */
export interface McpServerEntry {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled?: boolean;
}

/**
 * Installed MCP tracking file
 */
export interface InstalledMcpFile {
  installed: InstalledMcpEntry[];
}

/**
 * Installed MCP entry
 */
export interface InstalledMcpEntry {
  name: string;
  version: string;
  path: string;
  installedAt: string;
}

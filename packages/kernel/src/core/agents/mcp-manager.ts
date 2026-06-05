import type { McpServerConfig } from "../types.js";

/**
 * Resolves MCP server configuration for agent sessions.
 * Centralizes the logic for providing MCP servers to newSession/resumeSession/loadSession/forkSession.
 */
export class McpManager {
  /**
   * Resolve the MCP server config to pass to ACP session methods.
   * Returns the provided config array or an empty array if none given.
   */
  resolve(sessionConfig?: McpServerConfig[]): McpServerConfig[] {
    return sessionConfig ?? [];
  }
}

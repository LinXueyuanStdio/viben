/**
 * MCP management for Viben
 */
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import {
  getSharedMcpDir,
  getAgentDir,
  getAgentMcpServersPath,
} from "../config/paths";
import { readJson, writeJson, readYaml, fileExists, ensureDir } from "../config/yaml";
import type { McpServer, InstalledMcp } from "../types";
import type { McpServersFile, McpServerEntry, InstalledMcpFile } from "./types";

export * from "./types";

/**
 * McpManager handles MCP server configuration
 */
export class McpManager {
  /**
   * Initialize MCP directories
   */
  async initialize(): Promise<void> {
    await ensureDir(getSharedMcpDir());
  }

  /**
   * Get MCP servers for an agent
   */
  async getAgentServers(agentId: string): Promise<McpServer[]> {
    const configPath = getAgentMcpServersPath(agentId);
    if (!fileExists(configPath)) {
      return [];
    }

    const config = await readJson<McpServersFile>(configPath);
    if (!config?.mcpServers) {
      return [];
    }

    return Object.entries(config.mcpServers).map(([name, entry]) => ({
      name,
      command: entry.command,
      args: entry.args,
      env: entry.env,
      enabled: entry.enabled ?? true,
    }));
  }

  /**
   * Add or update an MCP server for an agent
   */
  async setAgentServer(agentId: string, server: McpServer): Promise<void> {
    const configPath = getAgentMcpServersPath(agentId);
    const agentDir = getAgentDir(agentId);

    await ensureDir(agentDir);

    let config: McpServersFile = { mcpServers: {} };
    if (fileExists(configPath)) {
      config = (await readJson<McpServersFile>(configPath)) || config;
    }

    config.mcpServers[server.name] = {
      command: server.command,
      args: server.args,
      env: server.env,
      enabled: server.enabled,
    };

    await writeJson(configPath, config);
  }

  /**
   * Remove an MCP server from an agent
   */
  async removeAgentServer(agentId: string, serverName: string): Promise<void> {
    const configPath = getAgentMcpServersPath(agentId);
    if (!fileExists(configPath)) {
      return;
    }

    const config = await readJson<McpServersFile>(configPath);
    if (!config?.mcpServers) {
      return;
    }

    delete config.mcpServers[serverName];
    await writeJson(configPath, config);
  }

  /**
   * List installed shared MCPs
   */
  async listInstalled(): Promise<InstalledMcp[]> {
    const mcpDir = getSharedMcpDir();
    const installedPath = join(mcpDir, "installed.yaml");

    if (!fileExists(installedPath)) {
      return [];
    }

    const file = await readYaml<InstalledMcpFile>(installedPath);
    return (file?.installed || []).map((entry) => ({
      name: entry.name,
      version: entry.version,
      path: entry.path,
      installedAt: entry.installedAt,
    }));
  }

  /**
   * Get path to a shared MCP
   */
  getSharedMcpPath(name: string): string {
    return join(getSharedMcpDir(), name);
  }
}

// Export singleton instance
export const mcpManager = new McpManager();

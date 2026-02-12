/**
 * MCP (Model Context Protocol) routes
 *
 * Provides HTTP API for:
 * - Global MCP server installation management
 * - Agent-specific MCP server configuration
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { mcpManager } from "../../mcp";
import type { McpServer } from "../../types";

// ============================================================================
// Types
// ============================================================================

interface McpServerResponse {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled: boolean;
}

interface InstalledMcpResponse {
  name: string;
  version?: string;
  path?: string;
  installedAt?: string;
}

// ============================================================================
// Route Registration
// ============================================================================

/**
 * Register MCP routes
 */
export function registerMcpRoutes(fastify: FastifyInstance): void {
  // ========================================================================
  // Global Installed MCPs
  // ========================================================================

  /**
   * List globally installed MCP servers
   * GET /api/mcp/installed
   */
  fastify.get("/api/mcp/installed", async () => {
    const installed = await mcpManager.listInstalled();
    return {
      installed: installed.map((m) => ({
        name: m.name,
        version: m.version,
        path: m.path,
        installedAt: m.installedAt,
      })),
      total: installed.length,
    };
  });

  // ========================================================================
  // Agent MCP Server Configuration
  // ========================================================================

  /**
   * List MCP servers for an agent
   * GET /api/mcp/agents/:agentId/servers
   */
  fastify.get<{ Params: { agentId: string } }>(
    "/api/mcp/agents/:agentId/servers",
    async (request) => {
      const { agentId } = request.params;
      const servers = await mcpManager.getAgentServers(agentId);
      return {
        agentId,
        servers: servers.map((s) => ({
          name: s.name,
          command: s.command,
          args: s.args,
          env: s.env,
          enabled: s.enabled,
        })),
        total: servers.length,
      };
    }
  );

  /**
   * Add or update an MCP server for an agent
   * POST /api/mcp/agents/:agentId/servers
   */
  fastify.post<{
    Params: { agentId: string };
    Body: {
      name: string;
      command: string;
      args?: string[];
      env?: Record<string, string>;
      enabled?: boolean;
    };
  }>("/api/mcp/agents/:agentId/servers", async (request, reply) => {
    const { agentId } = request.params;
    const body = request.body;

    if (!body.name || !body.command) {
      reply.code(400);
      return { error: "name and command are required" };
    }

    const server: McpServer = {
      name: body.name,
      command: body.command,
      args: body.args,
      env: body.env,
      enabled: body.enabled ?? true,
    };

    try {
      await mcpManager.setAgentServer(agentId, server);
      reply.code(201);
      return {
        agentId,
        server: {
          name: server.name,
          command: server.command,
          args: server.args,
          env: server.env,
          enabled: server.enabled,
        },
      };
    } catch (e) {
      reply.code(500);
      return { error: e instanceof Error ? e.message : "Failed to add MCP server" };
    }
  });

  /**
   * Get a specific MCP server for an agent
   * GET /api/mcp/agents/:agentId/servers/:name
   */
  fastify.get<{ Params: { agentId: string; name: string } }>(
    "/api/mcp/agents/:agentId/servers/:name",
    async (request, reply) => {
      const { agentId, name } = request.params;
      const servers = await mcpManager.getAgentServers(agentId);
      const server = servers.find((s) => s.name === name);

      if (!server) {
        reply.code(404);
        return { error: `MCP server '${name}' not found for agent '${agentId}'` };
      }

      return {
        agentId,
        server: {
          name: server.name,
          command: server.command,
          args: server.args,
          env: server.env,
          enabled: server.enabled,
        },
      };
    }
  );

  /**
   * Update an MCP server for an agent
   * PATCH /api/mcp/agents/:agentId/servers/:name
   */
  fastify.patch<{
    Params: { agentId: string; name: string };
    Body: {
      command?: string;
      args?: string[];
      env?: Record<string, string>;
      enabled?: boolean;
    };
  }>("/api/mcp/agents/:agentId/servers/:name", async (request, reply) => {
    const { agentId, name } = request.params;
    const updates = request.body;

    // Get existing server
    const servers = await mcpManager.getAgentServers(agentId);
    const existing = servers.find((s) => s.name === name);

    if (!existing) {
      reply.code(404);
      return { error: `MCP server '${name}' not found for agent '${agentId}'` };
    }

    // Merge updates
    const updated: McpServer = {
      name,
      command: updates.command ?? existing.command,
      args: updates.args ?? existing.args,
      env: updates.env ?? existing.env,
      enabled: updates.enabled ?? existing.enabled,
    };

    try {
      await mcpManager.setAgentServer(agentId, updated);
      return {
        agentId,
        server: {
          name: updated.name,
          command: updated.command,
          args: updated.args,
          env: updated.env,
          enabled: updated.enabled,
        },
      };
    } catch (e) {
      reply.code(500);
      return { error: e instanceof Error ? e.message : "Failed to update MCP server" };
    }
  });

  /**
   * Remove an MCP server from an agent
   * DELETE /api/mcp/agents/:agentId/servers/:name
   */
  fastify.delete<{ Params: { agentId: string; name: string } }>(
    "/api/mcp/agents/:agentId/servers/:name",
    async (request, reply) => {
      const { agentId, name } = request.params;

      try {
        await mcpManager.removeAgentServer(agentId, name);
        return { deleted: name, agentId };
      } catch (e) {
        reply.code(500);
        return { error: e instanceof Error ? e.message : "Failed to remove MCP server" };
      }
    }
  );

  // ========================================================================
  // MCP Server Enable/Disable
  // ========================================================================

  /**
   * Enable an MCP server for an agent
   * POST /api/mcp/agents/:agentId/servers/:name/enable
   */
  fastify.post<{ Params: { agentId: string; name: string } }>(
    "/api/mcp/agents/:agentId/servers/:name/enable",
    async (request, reply) => {
      const { agentId, name } = request.params;

      const servers = await mcpManager.getAgentServers(agentId);
      const existing = servers.find((s) => s.name === name);

      if (!existing) {
        reply.code(404);
        return { error: `MCP server '${name}' not found for agent '${agentId}'` };
      }

      try {
        await mcpManager.setAgentServer(agentId, { ...existing, enabled: true });
        return { agentId, name, enabled: true };
      } catch (e) {
        reply.code(500);
        return { error: e instanceof Error ? e.message : "Failed to enable MCP server" };
      }
    }
  );

  /**
   * Disable an MCP server for an agent
   * POST /api/mcp/agents/:agentId/servers/:name/disable
   */
  fastify.post<{ Params: { agentId: string; name: string } }>(
    "/api/mcp/agents/:agentId/servers/:name/disable",
    async (request, reply) => {
      const { agentId, name } = request.params;

      const servers = await mcpManager.getAgentServers(agentId);
      const existing = servers.find((s) => s.name === name);

      if (!existing) {
        reply.code(404);
        return { error: `MCP server '${name}' not found for agent '${agentId}'` };
      }

      try {
        await mcpManager.setAgentServer(agentId, { ...existing, enabled: false });
        return { agentId, name, enabled: false };
      } catch (e) {
        reply.code(500);
        return { error: e instanceof Error ? e.message : "Failed to disable MCP server" };
      }
    }
  );
}

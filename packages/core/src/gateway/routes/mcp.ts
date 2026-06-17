/**
 * MCP (Model Context Protocol) routes
 *
 * Provides HTTP API for:
 * - MCP package management (install, uninstall, list, search)
 * - Agent-specific MCP server configuration
 *
 * All endpoints share the same src/mcp/ops implementation with CLI commands.
 */
import type { FastifyInstance } from "fastify";
import { mcpManager } from "../../mcp";
import type { McpServer } from "../../types";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { logger as globalLogger } from "../../telemetry";

// Import from mcp/ops module - shared with CLI
import {
  // CRUD operations
  installMcp,
  uninstallMcp,
  listMcps,
  getMcp,
  // Registry operations
  searchMarketplace,
  getFromMarketplace,
  downloadFromMarketplace,
} from "../../mcp/ops";
import type { McpTarget } from "../../mcp/ops/types";

// Module-level logger for MCP routes
const log = globalLogger.child({ module: "mcp" });

const execAsync = promisify(exec);

// ============================================================================
// Types
// ============================================================================

interface PortStatus {
  in_use: boolean;
  pid: number | null;
  process_name: string | null;
}

// ============================================================================
// Route Registration
// ============================================================================

/**
 * Register MCP routes
 */
export function registerMcpRoutes(fastify: FastifyInstance): void {
  // ========================================================================
  // MCP Package Management (shared with CLI: viben mcp xxx)
  // ========================================================================

  /**
   * List installed MCP packages
   * GET /api/mcp/list
   * CLI: viben mcp list
   *
   * Query params:
   * - target: "project" | "global" (optional)
   * - all: "true" to list from all targets
   */
  fastify.get<{
    Querystring: {
      target?: McpTarget;
      all?: string;
    };
  }>("/api/mcp/list", {
    schema: {
      description: "List installed MCP packages",
      tags: ["mcp"],
      querystring: {
        type: "object",
        properties: {
          target: {
            type: "string",
            enum: ["project", "global"],
            description: "Filter by installation target",
          },
          all: {
            type: "string",
            description: "Set to 'true' to list from all targets",
          },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            mcps: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  version: { type: "string" },
                  path: { type: "string" },
                  installed_at: { type: "string" },
                  source: { type: "string" },
                  target: { type: "string" },
                },
              },
            },
            count: { type: "number" },
          },
        },
        400: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            error: { type: "string" },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { target, all } = request.query;

    try {
      const result = await listMcps({
        target,
        all: all === "true",
      });

      if (!result.success) {
        reply.code(400);
        return { success: false, error: result.error };
      }

      return {
        success: true,
        mcps: result.mcps,
        count: result.count,
      };
    } catch (error) {
      log.error({ err: error }, "Failed to list MCP packages");
      reply.code(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to list packages",
      };
    }
  });

  /**
   * Get MCP package details
   * GET /api/mcp/show/:name
   * CLI: viben mcp show <name>
   */
  fastify.get<{
    Params: { name: string };
    Querystring: { target?: McpTarget };
  }>("/api/mcp/show/:name", {
    schema: {
      description: "Get MCP package details",
      tags: ["mcp"],
      params: {
        type: "object",
        properties: {
          name: { type: "string", description: "Package name" },
        },
        required: ["name"],
      },
      querystring: {
        type: "object",
        properties: {
          target: {
            type: "string",
            enum: ["project", "global"],
          },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            mcp: {
              type: "object",
              properties: {
                name: { type: "string" },
                version: { type: "string" },
                description: { type: "string" },
                path: { type: "string" },
                source: { type: "string" },
                target: { type: "string" },
              },
            },
          },
        },
        404: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            error: { type: "string" },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { name } = request.params;
    const { target } = request.query;

    try {
      const result = await getMcp(name, { target });

      if (!result.success || !result.mcp) {
        reply.code(404);
        return { success: false, error: result.error || `Package not found: ${name}` };
      }

      return {
        success: true,
        mcp: result.mcp,
      };
    } catch (error) {
      log.error({ err: error }, "Failed to get MCP package");
      reply.code(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get package",
      };
    }
  });

  /**
   * Install MCP package
   * POST /api/mcp/install
   * CLI: viben mcp install <spec>
   */
  fastify.post<{
    Body: {
      spec: string;
      target?: McpTarget;
      force?: boolean;
    };
  }>("/api/mcp/install", {
    schema: {
      description: "Install an MCP package (supports name, name@version, gh:user/repo, ./path)",
      tags: ["mcp"],
      body: {
        type: "object",
        properties: {
          spec: { type: "string", description: "Install spec (name, name@version, gh:user/repo, ./path)" },
          target: {
            type: "string",
            enum: ["project", "global"],
            default: "project",
          },
          force: { type: "boolean", default: false, description: "Force reinstall" },
        },
        required: ["spec"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            name: { type: "string" },
            version: { type: "string" },
            path: { type: "string" },
            target: { type: "string" },
            source: { type: "string" },
            message: { type: "string" },
          },
        },
        400: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            error: { type: "string" },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { spec, target = "project", force = false } = request.body;

    if (!spec) {
      reply.code(400);
      return { success: false, error: "spec is required" };
    }

    log.info({ spec, target, force }, "Installing MCP package");

    try {
      const result = await installMcp({
        spec,
        target,
        force,
      });

      if (!result.success) {
        reply.code(400);
        return {
          success: false,
          error: result.error || result.message,
        };
      }

      return result;
    } catch (error) {
      log.error({ err: error }, "Failed to install MCP package");
      reply.code(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to install package",
      };
    }
  });

  /**
   * Uninstall MCP package
   * POST /api/mcp/uninstall
   * CLI: viben mcp uninstall <name>
   */
  fastify.post<{
    Body: {
      name: string;
      target?: McpTarget;
    };
  }>("/api/mcp/uninstall", {
    schema: {
      description: "Uninstall an MCP package",
      tags: ["mcp"],
      body: {
        type: "object",
        properties: {
          name: { type: "string", description: "Package name" },
          target: {
            type: "string",
            enum: ["project", "global"],
            default: "project",
          },
        },
        required: ["name"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            name: { type: "string" },
            message: { type: "string" },
          },
        },
        404: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            error: { type: "string" },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { name, target = "project" } = request.body;

    if (!name) {
      reply.code(400);
      return { success: false, error: "name is required" };
    }

    log.info({ name, target }, "Uninstalling MCP package");

    try {
      const result = await uninstallMcp({ name, target });

      if (!result.success) {
        const isNotFound = result.error?.includes("not found");
        reply.code(isNotFound ? 404 : 400);
        return {
          success: false,
          error: result.error || result.message,
        };
      }

      return result;
    } catch (error) {
      log.error({ err: error }, "Failed to uninstall MCP package");
      reply.code(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to uninstall package",
      };
    }
  });

  /**
   * Search MCP packages in marketplace
   * GET /api/mcp/search
   * CLI: viben mcp search <query>
   */
  fastify.get<{
    Querystring: {
      query: string;
      limit?: string;
      page?: string;
    };
  }>("/api/mcp/search", {
    schema: {
      description: "Search MCP packages in marketplace",
      tags: ["mcp"],
      querystring: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query (required)" },
          limit: { type: "string", description: "Maximum results" },
          page: { type: "string", description: "Page number" },
        },
        required: ["query"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            mcps: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  name: { type: "string" },
                  slug: { type: "string" },
                  version: { type: "string" },
                  description: { type: "string" },
                  downloads_count: { type: "number" },
                  favorites_count: { type: "number" },
                },
              },
            },
            total: { type: "number" },
            page: { type: "number" },
            total_pages: { type: "number" },
          },
        },
        400: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            error: { type: "string" },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { query, limit, page } = request.query;

    if (!query) {
      reply.code(400);
      return { success: false, error: "query is required" };
    }

    try {
      const result = await searchMarketplace({
        query,
        limit: limit ? parseInt(limit, 10) : undefined,
        page: page ? parseInt(page, 10) : undefined,
      });

      if (!result.success) {
        reply.code(400);
        return { success: false, error: result.error };
      }

      return {
        success: true,
        mcps: result.mcps,
        total: result.total,
        page: result.page,
        total_pages: result.total_pages,
      };
    } catch (error) {
      log.error({ err: error }, "Failed to search marketplace");
      reply.code(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to search marketplace",
      };
    }
  });

  /**
   * Get MCP package from marketplace
   * GET /api/mcp/info/:idOrSlug
   * (No direct CLI equivalent, but useful for showing marketplace package details)
   */
  fastify.get<{
    Params: { idOrSlug: string };
  }>("/api/mcp/info/:idOrSlug", {
    schema: {
      description: "Get MCP package details from marketplace",
      tags: ["mcp"],
      params: {
        type: "object",
        properties: {
          idOrSlug: { type: "string", description: "Package ID or slug" },
        },
        required: ["idOrSlug"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            mcp: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                slug: { type: "string" },
                version: { type: "string" },
                description: { type: "string" },
                downloads_count: { type: "number" },
                favorites_count: { type: "number" },
              },
            },
          },
        },
        404: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            error: { type: "string" },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { idOrSlug } = request.params;

    try {
      const result = await getFromMarketplace(idOrSlug);

      if (!result.success || !result.mcp) {
        reply.code(404);
        return { success: false, error: result.error || `Package not found: ${idOrSlug}` };
      }

      return {
        success: true,
        mcp: result.mcp,
      };
    } catch (error) {
      log.error({ err: error }, "Failed to get package from marketplace");
      reply.code(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get package",
      };
    }
  });

  /**
   * Download MCP package from marketplace (without installing)
   * POST /api/mcp/download
   * CLI: viben mcp download <name> [version]
   */
  fastify.post<{
    Body: {
      name: string;
      version?: string;
      target_dir: string;
    };
  }>("/api/mcp/download", {
    schema: {
      description: "Download MCP package to a directory",
      tags: ["mcp"],
      body: {
        type: "object",
        properties: {
          name: { type: "string", description: "Package name or ID" },
          version: { type: "string", description: "Version to download" },
          target_dir: { type: "string", description: "Target directory" },
        },
        required: ["name", "target_dir"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            path: { type: "string" },
          },
        },
        400: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            error: { type: "string" },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { name, version, target_dir } = request.body;

    if (!name) {
      reply.code(400);
      return { success: false, error: "name is required" };
    }

    if (!target_dir) {
      reply.code(400);
      return { success: false, error: "target_dir is required" };
    }

    log.info({ name, version, target_dir }, "Downloading MCP package");

    try {
      const result = await downloadFromMarketplace(name, version, target_dir);

      if (!result.success) {
        reply.code(400);
        return { success: false, error: result.error };
      }

      return {
        success: true,
        path: target_dir,
      };
    } catch (error) {
      log.error({ err: error }, "Failed to download MCP package");
      reply.code(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to download package",
      };
    }
  });

  // ========================================================================
  // Legacy: Global Installed MCPs (deprecated, use /api/mcp/list instead)
  // ========================================================================

  /**
   * List globally installed MCP servers
   * GET /api/mcp/installed
   * @deprecated Use GET /api/mcp/list?target=global instead
   */
  fastify.get("/api/mcp/installed", {
    schema: {
      description: "List globally installed MCP servers",
      tags: ["mcp"],
      response: {
        200: {
          type: "object",
          properties: {
            installed: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  version: { type: "string" },
                  path: { type: "string" },
                  installed_at: { type: "string" },
                },
              },
            },
            total: { type: "number" },
          },
        },
      },
    },
  }, async () => {
    const installed = await mcpManager.listInstalled();
    return {
      installed: installed.map((m) => ({
        name: m.name,
        version: m.version,
        path: m.path,
        installed_at: m.installed_at,
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

  // ========================================================================
  // MCP Process Utilities
  // ========================================================================

  /**
   * Check port status
   * POST /api/mcp/port/status
   */
  fastify.post<{
    Body: { port: number };
  }>("/api/mcp/port/status", async (request) => {
    const { port } = request.body;
    return checkPortStatus(port);
  });

  /**
   * Kill a process by PID
   * POST /api/mcp/process/kill
   */
  fastify.post<{
    Body: { pid: number };
  }>("/api/mcp/process/kill", async (request) => {
    const { pid } = request.body;
    const success = await killProcess(pid);
    return { success };
  });

  /**
   * Check if a process is alive
   * POST /api/mcp/process/alive
   */
  fastify.post<{
    Body: { pid: number };
  }>("/api/mcp/process/alive", async (request) => {
    const { pid } = request.body;
    return { alive: isProcessAlive(pid) };
  });

}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a process is alive by PID
 */
function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Kill a process by PID
 */
async function killProcess(pid: number): Promise<boolean> {
  try {
    process.kill(pid, "SIGTERM");

    // Wait for process to terminate
    await new Promise<void>((resolve) => {
      let attempts = 0;
      const check = () => {
        if (!isProcessAlive(pid) || attempts >= 10) {
          resolve();
          return;
        }
        attempts++;
        setTimeout(check, 200);
      };
      check();
    });

    // Force kill if still running
    if (isProcessAlive(pid)) {
      process.kill(pid, "SIGKILL");
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a port is in use
 */
async function checkPortStatus(port: number): Promise<PortStatus> {
  try {
    const platform = process.platform;
    let command: string;

    if (platform === "darwin" || platform === "linux") {
      command = `lsof -i :${port} -t`;
    } else if (platform === "win32") {
      command = `netstat -ano | findstr :${port} | findstr LISTENING`;
    } else {
      return { in_use: false, pid: null, process_name: null };
    }

    try {
      const { stdout } = await execAsync(command, { timeout: 5000 });
      const firstLine = stdout.trim().split("\n")[0];
      let pid: number;

      if (platform === "win32") {
        const parts = firstLine.trim().split(/\s+/);
        pid = parseInt(parts[parts.length - 1], 10);
      } else {
        pid = parseInt(firstLine, 10);
      }

      if (isNaN(pid)) {
        return { in_use: false, pid: null, process_name: null };
      }

      let processName: string | null = null;
      try {
        if (platform === "darwin" || platform === "linux") {
          const { stdout: psOutput } = await execAsync(`ps -p ${pid} -o comm=`);
          processName = psOutput.trim();
        } else if (platform === "win32") {
          const { stdout: taskOutput } = await execAsync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`);
          const match = taskOutput.match(/"([^"]+)"/);
          if (match) {
            processName = match[1];
          }
        }
      } catch {
        // Ignore process name lookup failures
      }

      return { in_use: true, pid, process_name: processName };
    } catch {
      return { in_use: false, pid: null, process_name: null };
    }
  } catch {
    return { in_use: false, pid: null, process_name: null };
  }
}


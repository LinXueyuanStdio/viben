/**
 * MCP (Model Context Protocol) routes
 *
 * Provides HTTP API for:
 * - Global MCP server installation management
 * - Agent-specific MCP server configuration
 * - Browse-MCP process management
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { mcpManager } from "../../mcp";
import type { McpServer } from "../../types";
import { exec, spawn, type ChildProcess } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

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

interface McpStatus {
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

interface PortStatus {
  in_use: boolean;
  pid: number | null;
  process_name: string | null;
}

interface McpStartConfig {
  python_path: string;
  transport: string;
  port: number;
}

// Browse-MCP process state (singleton for the gateway)
let browseMcpProcess: ChildProcess | null = null;
let browseMcpStatus: McpStatus = {
  running: false,
  pid: null,
  transport: null,
  port: null,
};
// Buffer for collecting process output
let browseMcpStdout = "";
let browseMcpStderr = "";

// MCP Proxy types and state
interface McpProxyConfig {
  python_path: string;
  host: string;
  port: number;
  auth_token?: string;
}

interface McpProxyStatus {
  running: boolean;
  pid: number | null;
  host: string | null;
  port: number | null;
  auth_token: string | null;
  url: string | null;
}

interface PortProcess {
  pid: number;
  name: string | null;
  is_mcp_proxy: boolean;
}

let mcpProxyProcess: ChildProcess | null = null;
let mcpProxyStatus: McpProxyStatus = {
  running: false,
  pid: null,
  host: null,
  port: null,
  auth_token: null,
  url: null,
};

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
                  installedAt: { type: "string" },
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

  // ========================================================================
  // Browse-MCP Process Management
  // ========================================================================

  /**
   * Get browse-mcp server status
   * GET /api/mcp/browse/status
   */
  fastify.get("/api/mcp/browse/status", async () => {
    // Check if process is still alive
    if (browseMcpStatus.running && browseMcpStatus.pid) {
      const alive = isProcessAlive(browseMcpStatus.pid);
      if (!alive) {
        browseMcpStatus = {
          running: false,
          pid: null,
          transport: null,
          port: null,
        };
        browseMcpProcess = null;
      }
    }
    return browseMcpStatus;
  });

  /**
   * Start browse-mcp server
   * POST /api/mcp/browse/start
   */
  fastify.post<{
    Body: McpStartConfig;
  }>("/api/mcp/browse/start", async (request, reply) => {
    const { python_path, transport, port } = request.body;

    // Check if already running
    if (browseMcpStatus.running && browseMcpStatus.pid) {
      const alive = isProcessAlive(browseMcpStatus.pid);
      if (alive) {
        return browseMcpStatus;
      }
    }

    // Check if port is in use
    const portStatus = await checkPortStatus(port);
    if (portStatus.in_use) {
      reply.code(400);
      return {
        error: `Port ${port} is already in use${portStatus.process_name ? ` by ${portStatus.process_name}` : ""}`,
      };
    }

    try {
      // Start browse-mcp process
      // Both SSE and HTTP transports need port argument
      // SSE uses /sse endpoint, HTTP uses /mcp endpoint
      // Normalize transport: "http" -> "streamable-http" for MCP SDK compatibility
      const normalizedTransport = transport === "http" ? "streamable-http" : transport;
      const args = ["-m", "browse_mcp", "--transport", normalizedTransport, "--port", String(port)];

      // Reset output buffers
      browseMcpStdout = "";
      browseMcpStderr = "";

      const child = spawn(python_path, args, {
        detached: true,
        stdio: ["ignore", "pipe", "pipe"], // Capture stdout and stderr
      });

      // Collect stdout
      if (child.stdout) {
        child.stdout.on("data", (data: Buffer) => {
          const text = data.toString();
          browseMcpStdout += text;
          // Keep only last 10KB
          if (browseMcpStdout.length > 10240) {
            browseMcpStdout = browseMcpStdout.slice(-10240);
          }
          console.log(`[browse-mcp stdout] ${text.trim()}`);
        });
      }

      // Collect stderr
      if (child.stderr) {
        child.stderr.on("data", (data: Buffer) => {
          const text = data.toString();
          browseMcpStderr += text;
          // Keep only last 10KB
          if (browseMcpStderr.length > 10240) {
            browseMcpStderr = browseMcpStderr.slice(-10240);
          }
          console.error(`[browse-mcp stderr] ${text.trim()}`);
        });
      }

      // Handle process exit
      child.on("exit", (code, signal) => {
        console.log(`[browse-mcp] Process exited with code=${code}, signal=${signal}`);
        browseMcpStatus = {
          ...browseMcpStatus,
          running: false,
          exitCode: code,
          exitSignal: signal ?? undefined,
          stdout: browseMcpStdout,
          stderr: browseMcpStderr,
          error: code !== 0
            ? `Process exited with code ${code}${browseMcpStderr ? `: ${browseMcpStderr.trim().slice(-500)}` : ""}`
            : undefined,
        };
      });

      // Handle process error
      child.on("error", (err) => {
        console.error(`[browse-mcp] Process error:`, err);
        browseMcpStatus = {
          ...browseMcpStatus,
          running: false,
          error: err.message,
          stderr: browseMcpStderr,
        };
      });

      child.unref();

      if (!child.pid) {
        throw new Error("Failed to start browse-mcp: no PID");
      }

      // Build endpoint URL based on transport
      const endpointUrl = transport === "sse"
        ? `http://localhost:${port}/sse`
        : `http://localhost:${port}/mcp`;

      browseMcpProcess = child;
      browseMcpStatus = {
        running: true,
        pid: child.pid,
        transport,
        port,
        command: python_path,
        args,
        startedAt: new Date().toISOString(),
        endpointUrl,
      };

      return browseMcpStatus;
    } catch (e) {
      reply.code(500);
      return { error: e instanceof Error ? e.message : "Failed to start browse-mcp" };
    }
  });

  /**
   * Stop browse-mcp server
   * POST /api/mcp/browse/stop
   */
  fastify.post("/api/mcp/browse/stop", async (_request, reply) => {
    if (!browseMcpStatus.running || !browseMcpStatus.pid) {
      return { success: true, message: "Server not running" };
    }

    try {
      const killed = await killProcess(browseMcpStatus.pid);
      if (killed) {
        browseMcpStatus = {
          running: false,
          pid: null,
          transport: null,
          port: null,
        };
        browseMcpProcess = null;
        return { success: true };
      }
      reply.code(500);
      return { error: "Failed to stop browse-mcp" };
    } catch (e) {
      reply.code(500);
      return { error: e instanceof Error ? e.message : "Failed to stop browse-mcp" };
    }
  });

  /**
   * Test browse-mcp connection
   * POST /api/mcp/browse/test
   */
  fastify.post<{
    Body: { python_path: string };
  }>("/api/mcp/browse/test", async (request) => {
    const { python_path } = request.body;

    try {
      // Check if browse-mcp is installed
      const { stdout } = await execAsync(`"${python_path}" -c "import browse_mcp; print('ok')"`, {
        timeout: 5000,
      });
      return { connected: stdout.trim() === "ok" };
    } catch {
      return { connected: false };
    }
  });

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

  // ========================================================================
  // MCP Proxy Management
  // ========================================================================

  /**
   * Get MCP proxy status
   * GET /api/mcp/proxy/status
   */
  fastify.get("/api/mcp/proxy/status", async () => {
    // Check if process is still alive
    if (mcpProxyStatus.running && mcpProxyStatus.pid) {
      const alive = isProcessAlive(mcpProxyStatus.pid);
      if (!alive) {
        mcpProxyStatus = {
          running: false,
          pid: null,
          host: null,
          port: null,
          auth_token: null,
          url: null,
        };
        mcpProxyProcess = null;
      }
    }
    return mcpProxyStatus;
  });

  /**
   * Check if MCP proxy is installed
   * POST /api/mcp/proxy/check-installed
   */
  fastify.post<{
    Body: { python_path: string };
  }>("/api/mcp/proxy/check-installed", async (request) => {
    const { python_path } = request.body;

    try {
      const { stdout } = await execAsync(
        `"${python_path}" -c "import browse_mcp_proxy; print('ok')"`,
        { timeout: 5000 }
      );
      return { installed: stdout.trim() === "ok" };
    } catch {
      return { installed: false };
    }
  });

  /**
   * Start MCP proxy
   * POST /api/mcp/proxy/start
   */
  fastify.post<{
    Body: McpProxyConfig;
  }>("/api/mcp/proxy/start", async (request, reply) => {
    const { python_path, host, port } = request.body;

    // Check if already running
    if (mcpProxyStatus.running && mcpProxyStatus.pid) {
      const alive = isProcessAlive(mcpProxyStatus.pid);
      if (alive) {
        return mcpProxyStatus;
      }
    }

    // Check if port is in use
    const portProcess = await getPortProcess(port);
    if (portProcess) {
      if (portProcess.is_mcp_proxy) {
        reply.code(400);
        return {
          error: `PROXY_ALREADY_RUNNING:${portProcess.pid}`,
        };
      }
      reply.code(400);
      return {
        error: `PORT_IN_USE:${port}`,
      };
    }

    try {
      // Generate auth token
      const authToken = generateAuthToken();

      // Start proxy process
      const child = spawn(
        python_path,
        ["-m", "browse_mcp_proxy", "--host", host, "--port", String(port)],
        {
          detached: true,
          stdio: "ignore",
          env: {
            ...process.env,
            MCP_PROXY_AUTH_TOKEN: authToken,
          },
        }
      );

      child.unref();

      if (!child.pid) {
        throw new Error("Failed to start MCP proxy: no PID");
      }

      mcpProxyProcess = child;
      mcpProxyStatus = {
        running: true,
        pid: child.pid,
        host,
        port,
        auth_token: authToken,
        url: `http://${host}:${port}`,
      };

      return mcpProxyStatus;
    } catch (e) {
      reply.code(500);
      return { error: e instanceof Error ? e.message : "Failed to start MCP proxy" };
    }
  });

  /**
   * Stop MCP proxy
   * POST /api/mcp/proxy/stop
   */
  fastify.post("/api/mcp/proxy/stop", async (_request, reply) => {
    if (!mcpProxyStatus.running || !mcpProxyStatus.pid) {
      return { success: true, message: "Proxy not running" };
    }

    try {
      const killed = await killProcess(mcpProxyStatus.pid);
      if (killed) {
        mcpProxyStatus = {
          running: false,
          pid: null,
          host: null,
          port: null,
          auth_token: null,
          url: null,
        };
        mcpProxyProcess = null;
        return { success: true };
      }
      reply.code(500);
      return { error: "Failed to stop MCP proxy" };
    } catch (e) {
      reply.code(500);
      return { error: e instanceof Error ? e.message : "Failed to stop MCP proxy" };
    }
  });

  /**
   * Install MCP proxy
   * POST /api/mcp/proxy/install
   */
  fastify.post<{
    Body: { python_path: string };
  }>("/api/mcp/proxy/install", async (request, reply) => {
    const { python_path } = request.body;

    try {
      await execAsync(`"${python_path}" -m pip install browse-mcp-proxy`, {
        timeout: 60000, // 1 minute timeout for installation
      });
      return { success: true };
    } catch (e) {
      reply.code(500);
      return { error: e instanceof Error ? e.message : "Failed to install MCP proxy" };
    }
  });

  /**
   * Get process using a port
   * POST /api/mcp/proxy/port-process
   */
  fastify.post<{
    Body: { port: number };
  }>("/api/mcp/proxy/port-process", async (request) => {
    const { port } = request.body;
    const portProcess = await getPortProcess(port);
    return { process: portProcess };
  });

  /**
   * Kill process using a port
   * POST /api/mcp/proxy/kill-port-process
   */
  fastify.post<{
    Body: { port: number };
  }>("/api/mcp/proxy/kill-port-process", async (request, reply) => {
    const { port } = request.body;

    const portProcess = await getPortProcess(port);
    if (!portProcess) {
      return { success: true, message: "No process found on port" };
    }

    try {
      const killed = await killProcess(portProcess.pid);
      if (killed) {
        // If it was our proxy, clear the status
        if (mcpProxyStatus.pid === portProcess.pid) {
          mcpProxyStatus = {
            running: false,
            pid: null,
            host: null,
            port: null,
            auth_token: null,
            url: null,
          };
          mcpProxyProcess = null;
        }
        return { success: true };
      }
      reply.code(500);
      return { error: "Failed to kill process" };
    } catch (e) {
      reply.code(500);
      return { error: e instanceof Error ? e.message : "Failed to kill process" };
    }
  });

  // ========================================================================
  // MCP Server Status Checking
  // ========================================================================

  /**
   * Check MCP server status on a port
   * POST /api/mcp/server/check-port
   */
  fastify.post<{
    Body: { port: number };
  }>("/api/mcp/server/check-port", async (request) => {
    const { port } = request.body;
    return checkMcpServerOnPort(port);
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
      const pidStr = stdout.trim().split("\n")[0];
      const pid = parseInt(pidStr, 10);

      if (isNaN(pid)) {
        return { in_use: false, pid: null, process_name: null };
      }

      // Get process name
      let processName: string | null = null;
      try {
        if (platform === "darwin" || platform === "linux") {
          const { stdout: psOutput } = await execAsync(`ps -p ${pid} -o comm=`);
          processName = psOutput.trim();
        }
      } catch {
        // Ignore process name lookup failures
      }

      return { in_use: true, pid, process_name: processName };
    } catch {
      // Command failed = port not in use
      return { in_use: false, pid: null, process_name: null };
    }
  } catch {
    return { in_use: false, pid: null, process_name: null };
  }
}

/**
 * Get process using a port with proxy detection
 */
async function getPortProcess(port: number): Promise<PortProcess | null> {
  const status = await checkPortStatus(port);
  if (!status.in_use || !status.pid) {
    return null;
  }

  const isMcpProxy = status.process_name?.includes("browse_mcp_proxy") ||
                     status.process_name?.includes("python") ||
                     false;

  return {
    pid: status.pid,
    name: status.process_name,
    is_mcp_proxy: isMcpProxy,
  };
}

/**
 * Generate a random auth token
 */
function generateAuthToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

/**
 * Check if a process on a port is an MCP server
 */
async function checkMcpServerOnPort(port: number): Promise<{
  status: "running" | "stopped" | "conflict";
  pid: number | null;
  process_name: string | null;
  is_mcp_server: boolean;
}> {
  const portStatus = await checkPortStatus(port);

  if (!portStatus.in_use) {
    return {
      status: "stopped",
      pid: null,
      process_name: null,
      is_mcp_server: false,
    };
  }

  // Check if it looks like an MCP server
  const isMcpServer = portStatus.process_name?.includes("browse") ||
                      portStatus.process_name?.includes("mcp") ||
                      portStatus.process_name?.includes("python") ||
                      false;

  if (isMcpServer) {
    return {
      status: "running",
      pid: portStatus.pid,
      process_name: portStatus.process_name,
      is_mcp_server: true,
    };
  }

  return {
    status: "conflict",
    pid: portStatus.pid,
    process_name: portStatus.process_name,
    is_mcp_server: false,
  };
}

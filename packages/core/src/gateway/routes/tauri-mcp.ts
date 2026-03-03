/**
 * Tauri Plugin MCP Bridge Routes
 *
 * Bridges HTTP/SSE requests to tauri-plugin-mcp-server via stdio subprocess.
 * This allows AI tools to connect to the desktop app via HTTP instead of requiring
 * a separate MCP server process.
 *
 * Architecture:
 *   AI Tool (Claude Code, Cursor) → HTTP/SSE → Gateway → stdio → tauri-plugin-mcp-server → IPC Socket → Tauri App
 *
 * The tauri-plugin-mcp socket uses a custom protocol (command/payload), not standard MCP JSON-RPC.
 * The tauri-plugin-mcp-server npm package translates between MCP JSON-RPC and the custom protocol.
 * We spawn it as a subprocess and proxy stdio to/from SSE.
 *
 * Endpoints:
 *   GET  /api/mcp/tauri/sse      - SSE endpoint for MCP communication
 *   POST /api/mcp/tauri/message  - Send messages to MCP server
 *   GET  /api/mcp/tauri/status   - Check tauri-plugin-mcp status
 */
import type { FastifyInstance, FastifyReply } from "fastify";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Default socket path for tauri-plugin-mcp
const DEFAULT_SOCKET_PATH = "/tmp/viben-mcp.sock";

// Find the tauri-plugin-mcp-server package
function findMcpServerPath(): string | null {
  // Try different possible locations
  const possiblePaths = [
    // From node_modules relative to this file
    resolve(dirname(fileURLToPath(import.meta.url)), "../../../../node_modules/tauri-plugin-mcp-server/build/index.js"),
    // From workspace root node_modules
    resolve(process.cwd(), "node_modules/tauri-plugin-mcp-server/build/index.js"),
    // From pnpm structure
    resolve(process.cwd(), "node_modules/.pnpm/tauri-plugin-mcp-server@0.1.0_hono@4.11.8/node_modules/tauri-plugin-mcp-server/build/index.js"),
  ];

  for (const p of possiblePaths) {
    if (existsSync(p)) {
      return p;
    }
  }

  return null;
}

// ============================================================================
// Types
// ============================================================================

interface TauriMcpStatus {
  available: boolean;
  socketPath: string;
  connected: boolean;
  mcpServerPath?: string;
  error?: string;
}

interface McpMessage {
  jsonrpc: "2.0";
  id?: string | number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

// ============================================================================
// MCP Server Process Manager
// ============================================================================

interface McpSession {
  id: string;
  process: ChildProcess;
  reply: FastifyReply;
  pendingRequests: Map<
    string | number,
    {
      resolve: (value: McpMessage) => void;
      reject: (error: Error) => void;
      timeout: NodeJS.Timeout;
    }
  >;
  buffer: string;
  initialized: boolean;
}

const mcpSessions = new Map<string, McpSession>();

function generateSessionId(): string {
  return `tauri-mcp-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Spawn MCP server subprocess for a session
 */
function spawnMcpServer(sessionId: string, reply: FastifyReply): McpSession | null {
  const mcpServerPath = findMcpServerPath();
  if (!mcpServerPath) {
    console.error("[tauri-mcp] tauri-plugin-mcp-server not found");
    return null;
  }

  console.log(`[tauri-mcp] Starting MCP server for session ${sessionId}`);
  console.log(`[tauri-mcp] Using: node ${mcpServerPath}`);

  const proc = spawn("node", [mcpServerPath], {
    env: {
      ...process.env,
      TAURI_MCP_IPC_PATH: DEFAULT_SOCKET_PATH,
    },
    stdio: ["pipe", "pipe", "pipe"],
  });

  const session: McpSession = {
    id: sessionId,
    process: proc,
    reply,
    pendingRequests: new Map(),
    buffer: "",
    initialized: false,
  };

  // Handle stdout (MCP responses)
  const rl = createInterface({ input: proc.stdout! });
  rl.on("line", (line) => {
    if (!line.trim()) return;

    try {
      const message = JSON.parse(line) as McpMessage;
      console.log(`[tauri-mcp] Received from MCP server:`, JSON.stringify(message).slice(0, 200));

      // Handle response to a pending request
      if (message.id !== undefined) {
        const pending = session.pendingRequests.get(message.id);
        if (pending) {
          clearTimeout(pending.timeout);
          session.pendingRequests.delete(message.id);
          pending.resolve(message);
        }
      }

      // Forward to SSE
      if (reply.raw.writable) {
        reply.raw.write(`event: message\n`);
        reply.raw.write(`data: ${JSON.stringify(message)}\n\n`);
      }
    } catch (err) {
      console.error(`[tauri-mcp] Failed to parse stdout:`, line.slice(0, 100));
    }
  });

  // Handle stderr (debug logs from MCP server)
  proc.stderr?.on("data", (data) => {
    console.log(`[tauri-mcp] MCP server stderr:`, data.toString().trim());
  });

  // Handle process exit
  proc.on("exit", (code, signal) => {
    console.log(`[tauri-mcp] MCP server exited: code=${code}, signal=${signal}`);
    // Reject all pending requests
    for (const [, pending] of session.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("MCP server process exited"));
    }
    session.pendingRequests.clear();
    mcpSessions.delete(sessionId);
  });

  proc.on("error", (err) => {
    console.error(`[tauri-mcp] MCP server error:`, err);
    reply.raw.write(`event: error\n`);
    reply.raw.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
  });

  return session;
}

/**
 * Send a message to the MCP server process
 */
async function sendToMcpServer(
  session: McpSession,
  message: McpMessage,
  timeout = 30000
): Promise<McpMessage> {
  return new Promise((resolve, reject) => {
    const timeoutHandle = setTimeout(() => {
      if (message.id !== undefined) {
        session.pendingRequests.delete(message.id);
      }
      reject(new Error(`Request timeout: ${message.method}`));
    }, timeout);

    if (message.id !== undefined) {
      session.pendingRequests.set(message.id, {
        resolve,
        reject,
        timeout: timeoutHandle,
      });
    }

    const data = JSON.stringify(message) + "\n";
    console.log(`[tauri-mcp] Sending to MCP server:`, data.trim().slice(0, 200));

    session.process.stdin?.write(data, (err) => {
      if (err) {
        clearTimeout(timeoutHandle);
        if (message.id !== undefined) {
          session.pendingRequests.delete(message.id);
        }
        reject(err);
      } else if (message.id === undefined) {
        // No response expected for notifications
        clearTimeout(timeoutHandle);
        resolve({ jsonrpc: "2.0" });
      }
    });
  });
}

// ============================================================================
// Route Registration
// ============================================================================

/**
 * Register Tauri MCP bridge routes
 */
export function registerTauriMcpRoutes(fastify: FastifyInstance): void {
  // ========================================================================
  // Status Endpoint
  // ========================================================================

  /**
   * Check tauri-plugin-mcp status
   * GET /api/mcp/tauri/status
   */
  fastify.get("/api/mcp/tauri/status", {
    schema: {
      description: "Check tauri-plugin-mcp connection status",
      tags: ["mcp", "tauri"],
      response: {
        200: {
          type: "object",
          properties: {
            available: { type: "boolean" },
            socketPath: { type: "string" },
            connected: { type: "boolean" },
            mcpServerPath: { type: "string" },
            error: { type: "string" },
          },
        },
      },
    },
  }, async (): Promise<TauriMcpStatus> => {
    const socketExists = existsSync(DEFAULT_SOCKET_PATH);
    const mcpServerPath = findMcpServerPath();

    if (!socketExists) {
      return {
        available: false,
        socketPath: DEFAULT_SOCKET_PATH,
        connected: false,
        mcpServerPath: mcpServerPath || undefined,
        error: "Socket file not found. Is the Tauri app running in dev mode?",
      };
    }

    if (!mcpServerPath) {
      return {
        available: true,
        socketPath: DEFAULT_SOCKET_PATH,
        connected: false,
        error: "tauri-plugin-mcp-server not found. Run: pnpm add tauri-plugin-mcp-server",
      };
    }

    return {
      available: true,
      socketPath: DEFAULT_SOCKET_PATH,
      connected: true,
      mcpServerPath,
    };
  });

  // ========================================================================
  // SSE Endpoint
  // ========================================================================

  /**
   * SSE endpoint for MCP communication
   * GET /api/mcp/tauri/sse
   *
   * This implements the MCP SSE transport protocol:
   * - GET establishes SSE connection for receiving server events
   * - Sends 'endpoint' event with URL for posting messages
   */
  fastify.get("/api/mcp/tauri/sse", async (request, reply) => {
    // Set SSE headers
    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache, no-transform");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.setHeader("X-Accel-Buffering", "no");

    // CORS headers
    reply.raw.setHeader("Access-Control-Allow-Origin", "*");
    reply.raw.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    reply.raw.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, Accept, Mcp-Session-Id, Last-Event-Id"
    );
    reply.raw.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");

    // Generate session ID
    const sessionId = generateSessionId();
    reply.raw.setHeader("Mcp-Session-Id", sessionId);

    // Check if socket is available
    if (!existsSync(DEFAULT_SOCKET_PATH)) {
      reply.raw.write(`event: error\n`);
      reply.raw.write(`data: ${JSON.stringify({ error: "Tauri app not running. Socket not found: " + DEFAULT_SOCKET_PATH })}\n\n`);
      reply.raw.end();
      return;
    }

    // Check if MCP server is available
    const mcpServerPath = findMcpServerPath();
    if (!mcpServerPath) {
      reply.raw.write(`event: error\n`);
      reply.raw.write(`data: ${JSON.stringify({ error: "tauri-plugin-mcp-server not found" })}\n\n`);
      reply.raw.end();
      return;
    }

    // Spawn MCP server process
    const session = spawnMcpServer(sessionId, reply);
    if (!session) {
      reply.raw.write(`event: error\n`);
      reply.raw.write(`data: ${JSON.stringify({ error: "Failed to start MCP server" })}\n\n`);
      reply.raw.end();
      return;
    }

    // Store session
    mcpSessions.set(sessionId, session);

    // Send 'endpoint' event with the URL for posting messages (MCP SSE protocol)
    const messagesEndpoint = `/api/mcp/tauri/message?sessionId=${sessionId}`;
    reply.raw.write(`event: endpoint\n`);
    reply.raw.write(`data: ${messagesEndpoint}\n\n`);

    // Handle client disconnect
    request.raw.on("close", () => {
      console.log(`[tauri-mcp] SSE session ${sessionId} closed, killing MCP server`);
      session.process.kill();
      mcpSessions.delete(sessionId);
    });

    // Keep connection alive
    const keepAlive = setInterval(() => {
      if (reply.raw.writable) {
        reply.raw.write(`: keepalive\n\n`);
      } else {
        clearInterval(keepAlive);
      }
    }, 30000);

    // Don't call reply.send() - we're streaming
    return reply;
  });

  // ========================================================================
  // Message Endpoint (for SSE transport)
  // ========================================================================

  /**
   * SSE Message endpoint - receives messages from SSE clients
   * POST /api/mcp/tauri/message
   *
   * This is the endpoint that SSE clients POST to (as specified in the 'endpoint' event).
   * The sessionId is passed as a query parameter.
   */
  fastify.post<{
    Querystring: { sessionId?: string };
    Body: McpMessage;
  }>("/api/mcp/tauri/message", async (request, reply) => {
    // CORS headers
    reply.header("Access-Control-Allow-Origin", "*");
    reply.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    reply.header(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, Accept, Mcp-Session-Id"
    );

    const sessionId = request.query.sessionId || request.headers["mcp-session-id"] as string;
    const message = request.body;

    console.log(`[tauri-mcp] POST /message sessionId=${sessionId}, message=${JSON.stringify(message).slice(0, 100)}`);

    if (!sessionId) {
      reply.code(400);
      return { error: "sessionId query parameter required" };
    }

    if (!message || !message.jsonrpc) {
      reply.code(400);
      return { error: "Invalid JSON-RPC message" };
    }

    const session = mcpSessions.get(sessionId);
    if (!session) {
      reply.code(404);
      return { error: `Session ${sessionId} not found` };
    }

    try {
      // Send message to MCP server and get response
      const response = await sendToMcpServer(session, message);

      // Return accepted status (response is sent via SSE)
      reply.code(202);
      return { accepted: true };
    } catch (err) {
      console.error(`[tauri-mcp] Error handling message:`, err);
      reply.code(500);
      return {
        jsonrpc: "2.0",
        id: message.id,
        error: {
          code: -32000,
          message: err instanceof Error ? err.message : "Internal error",
        },
      };
    }
  });

  /**
   * SSE POST endpoint for sending messages (alternative endpoint)
   * POST /api/mcp/tauri/sse
   */
  fastify.post<{
    Querystring: { sessionId?: string };
    Body: McpMessage;
  }>("/api/mcp/tauri/sse", async (request, reply) => {
    // CORS headers
    reply.header("Access-Control-Allow-Origin", "*");
    reply.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    reply.header(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, Accept, Mcp-Session-Id"
    );

    const sessionId = request.query.sessionId || request.headers["mcp-session-id"] as string;
    const message = request.body;

    if (!sessionId) {
      reply.code(400);
      return { error: "sessionId query parameter or Mcp-Session-Id header required" };
    }

    if (!message || !message.jsonrpc) {
      reply.code(400);
      return { error: "Invalid JSON-RPC message" };
    }

    const session = mcpSessions.get(sessionId);
    if (!session) {
      reply.code(404);
      return { error: "Session not found" };
    }

    try {
      const response = await sendToMcpServer(session, message);
      reply.code(202);
      return { accepted: true };
    } catch (err) {
      reply.code(500);
      return {
        jsonrpc: "2.0",
        id: message.id,
        error: {
          code: -32000,
          message: err instanceof Error ? err.message : "Internal error",
        },
      };
    }
  });

  // ========================================================================
  // CORS Preflight
  // ========================================================================

  fastify.options("/api/mcp/tauri/*", async (_request, reply) => {
    reply.header("Access-Control-Allow-Origin", "*");
    reply.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    reply.header(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, Accept, Mcp-Session-Id, Last-Event-Id"
    );
    reply.header("Access-Control-Max-Age", "86400");
    reply.code(204).send();
  });
}

// ============================================================================
// Exports
// ============================================================================

export { DEFAULT_SOCKET_PATH };

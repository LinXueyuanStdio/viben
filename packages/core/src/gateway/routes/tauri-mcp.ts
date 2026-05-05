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
 * We spawn it as a subprocess and proxy stdio to/from SSE or Streamable HTTP.
 *
 * Endpoints:
 *   GET  /api/mcp/tauri/mcp      - Streamable HTTP SSE stream for existing session
 *   POST /api/mcp/tauri/mcp      - Streamable HTTP endpoint (initialize or send message)
 *   DELETE /api/mcp/tauri/mcp    - Streamable HTTP session termination
 *   GET  /api/mcp/tauri/sse      - SSE endpoint for MCP communication (legacy)
 *   POST /api/mcp/tauri/message  - Send messages to MCP server (for SSE transport)
 *   GET  /api/mcp/tauri/status   - Check tauri-plugin-mcp status
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { createInterface } from "node:readline";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { logger as globalLogger } from "../../telemetry";

// Module-level logger
const log = globalLogger.child({ module: "tauri-mcp" });
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";

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

/** Streamable HTTP session for Tauri MCP */
interface StreamableHttpSession {
  id: string;
  process: ChildProcess;
  transport: StreamableHTTPServerTransport;
  pendingRequests: Map<
    string | number,
    {
      resolve: (value: McpMessage) => void;
      reject: (error: Error) => void;
      timeout: NodeJS.Timeout;
    }
  >;
}

// SSE sessions (legacy)
const mcpSessions = new Map<string, McpSession>();

// Streamable HTTP sessions
const streamableHttpSessions = new Map<string, StreamableHttpSession>();

function generateSessionId(): string {
  return `tauri-mcp-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Spawn MCP server subprocess for a session
 */
function spawnMcpServer(sessionId: string, reply: FastifyReply): McpSession | null {
  const mcpServerPath = findMcpServerPath();
  if (!mcpServerPath) {
    log.error("tauri-plugin-mcp-server not found");
    return null;
  }

  log.info({ sessionId, mcpServerPath }, "Starting MCP server for session");

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
      log.debug({ message: JSON.stringify(message).slice(0, 200) }, "Received from MCP server");

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
      log.error({ line: line.slice(0, 100) }, "Failed to parse stdout");
    }
  });

  // Handle stderr (debug logs from MCP server)
  proc.stderr?.on("data", (data) => {
    log.debug({ stderr: data.toString().trim() }, "MCP server stderr");
  });

  // Handle process exit
  proc.on("exit", (code, signal) => {
    log.info({ code, signal }, "MCP server exited");
    // Reject all pending requests
    for (const [, pending] of session.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("MCP server process exited"));
    }
    session.pendingRequests.clear();
    mcpSessions.delete(sessionId);
  });

  proc.on("error", (err) => {
    log.error({ err }, "MCP server error");
    reply.raw.write(`event: error\n`);
    reply.raw.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
  });

  return session;
}

/**
 * Set CORS headers on raw response
 */
function setCorsHeaders(request: FastifyRequest, reply: FastifyReply): void {
  const origin = request.headers.origin || "*";
  reply.raw.setHeader("Access-Control-Allow-Origin", origin);
  reply.raw.setHeader("Access-Control-Allow-Credentials", "true");
  reply.raw.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Accept, Mcp-Session-Id, Last-Event-Id, mcp-protocol-version"
  );
  reply.raw.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id, mcp-protocol-version");
  reply.raw.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, DELETE, OPTIONS"
  );
}

/**
 * Spawn MCP server subprocess for Streamable HTTP session
 */
function spawnMcpServerForStreamableHttp(
  sessionId: string,
  transport: StreamableHTTPServerTransport
): StreamableHttpSession | null {
  const mcpServerPath = findMcpServerPath();
  if (!mcpServerPath) {
    log.error("tauri-plugin-mcp-server not found");
    return null;
  }

  log.info({ sessionId, mcpServerPath }, "Starting MCP server for Streamable HTTP session");

  const proc = spawn("node", [mcpServerPath], {
    env: {
      ...process.env,
      TAURI_MCP_IPC_PATH: DEFAULT_SOCKET_PATH,
    },
    stdio: ["pipe", "pipe", "pipe"],
  });

  const session: StreamableHttpSession = {
    id: sessionId,
    process: proc,
    transport,
    pendingRequests: new Map(),
  };

  // Handle stdout (MCP responses from tauri-plugin-mcp-server)
  const rl = createInterface({ input: proc.stdout! });
  rl.on("line", (line) => {
    if (!line.trim()) return;

    try {
      const message = JSON.parse(line) as McpMessage;
      log.debug({ message: JSON.stringify(message).slice(0, 200) }, "StreamableHTTP received from MCP server");

      // Handle response to a pending request
      if (message.id !== undefined) {
        const pending = session.pendingRequests.get(message.id);
        if (pending) {
          clearTimeout(pending.timeout);
          session.pendingRequests.delete(message.id);
          pending.resolve(message);
        }
      }

      // Forward notifications to transport
      if (message.method && !message.id) {
        // This is a notification from the MCP server
        transport.send(message as unknown as JSONRPCMessage).catch((err) => {
          log.error({ err }, "Error forwarding notification");
        });
      }
    } catch (err) {
      log.error({ line: line.slice(0, 100) }, "Failed to parse stdout");
    }
  });

  // Handle stderr (debug logs from MCP server)
  proc.stderr?.on("data", (data) => {
    log.debug({ stderr: data.toString().trim() }, "MCP server stderr");
  });

  // Handle process exit
  proc.on("exit", (code, signal) => {
    log.info({ code, signal }, "MCP server exited");
    // Reject all pending requests
    for (const [, pending] of session.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("MCP server process exited"));
    }
    session.pendingRequests.clear();
    streamableHttpSessions.delete(sessionId);
  });

  proc.on("error", (err) => {
    log.error({ err }, "MCP server error");
  });

  return session;
}

/**
 * Send a message to the MCP server process (for Streamable HTTP)
 */
async function sendToMcpServerStreamable(
  session: StreamableHttpSession,
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
    log.debug({ data: data.trim().slice(0, 200) }, "StreamableHTTP sending to MCP server");

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

/**
 * Send a message to the MCP server process (for SSE - legacy)
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
    log.debug({ data: data.trim().slice(0, 200) }, "Sending to MCP server");

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
  // Streamable HTTP Transport Endpoint (/mcp)
  // ========================================================================

  /**
   * Streamable HTTP GET - Handle SSE stream for existing session
   * GET /api/mcp/tauri/mcp
   */
  fastify.get("/api/mcp/tauri/mcp", async (request, reply) => {
    setCorsHeaders(request, reply);

    const sessionId = request.headers["mcp-session-id"] as string;
    log.debug({ sessionId }, "Received GET /mcp");

    if (!sessionId) {
      reply.code(400);
      return { error: "Mcp-Session-Id header required" };
    }

    try {
      const session = streamableHttpSessions.get(sessionId);
      if (!session) {
        reply.code(404);
        return { error: "Session not found" };
      }

      // Handle as raw HTTP for SSE streaming
      await session.transport.handleRequest(request.raw, reply.raw);
    } catch (error) {
      log.error({ err: error }, "Error in GET /mcp route");
      reply.code(500);
      return { error: error instanceof Error ? error.message : "Internal error" };
    }
  });

  /**
   * Streamable HTTP POST - Initialize new session or send message to existing
   * POST /api/mcp/tauri/mcp
   */
  fastify.post<{
    Body: McpMessage | McpMessage[];
  }>("/api/mcp/tauri/mcp", async (request, reply) => {
    setCorsHeaders(request, reply);

    const sessionId = request.headers["mcp-session-id"] as string | undefined;

    if (sessionId) {
      // Existing session - forward message
      log.debug({ sessionId }, "Received POST /mcp for existing session");

      const session = streamableHttpSessions.get(sessionId);
      if (!session) {
        reply.code(404);
        return { error: "Session not found" };
      }

      try {
        // Handle request through transport
        await session.transport.handleRequest(request.raw, reply.raw, request.body);
      } catch (error) {
        log.error({ err: error }, "Error in POST /mcp route");
        reply.code(500);
        return { error: error instanceof Error ? error.message : "Internal error" };
      }
    } else {
      // New connection - create session
      log.info("New Streamable HTTP connection request");

      // Check if socket is available
      if (!existsSync(DEFAULT_SOCKET_PATH)) {
        reply.code(503);
        return { error: "Tauri app not running. Socket not found: " + DEFAULT_SOCKET_PATH };
      }

      // Check if MCP server is available
      const mcpServerPath = findMcpServerPath();
      if (!mcpServerPath) {
        reply.code(503);
        return { error: "tauri-plugin-mcp-server not found" };
      }

      try {
        // Create StreamableHTTP transport for client communication
        const webAppTransport = new StreamableHTTPServerTransport({
          sessionIdGenerator: randomUUID,
          onsessioninitialized: (newSessionId) => {
            log.info({ sessionId: newSessionId }, "StreamableHTTP session initialized");

            // Spawn MCP server process for this session
            const session = spawnMcpServerForStreamableHttp(newSessionId, webAppTransport);
            if (session) {
              streamableHttpSessions.set(newSessionId, session);

              // Set up message forwarding from client to MCP server
              webAppTransport.onmessage = async (message) => {
                log.debug({ message: JSON.stringify(message).slice(0, 200) }, "Client -> MCP server");
                const mcpMsg = message as unknown as McpMessage;
                try {
                  const response = await sendToMcpServerStreamable(session, mcpMsg);
                  // Response is automatically handled via pending requests
                  // For requests with id, we need to send the response back
                  if (mcpMsg.id !== undefined) {
                    await webAppTransport.send(response as unknown as JSONRPCMessage);
                  }
                } catch (err) {
                  log.error({ err }, "Error forwarding message");
                  if (mcpMsg.id !== undefined) {
                    await webAppTransport.send({
                      jsonrpc: "2.0",
                      id: mcpMsg.id,
                      error: {
                        code: -32000,
                        message: err instanceof Error ? err.message : "Internal error",
                      },
                    } as unknown as JSONRPCMessage);
                  }
                }
              };
            } else {
              log.error({ sessionId: newSessionId }, "Failed to spawn MCP server for session");
            }
          },
          onsessionclosed: (closedSessionId) => {
            log.info({ sessionId: closedSessionId }, "StreamableHTTP session closed");
            const session = streamableHttpSessions.get(closedSessionId);
            if (session) {
              session.process.kill();
              streamableHttpSessions.delete(closedSessionId);
            }
          },
        });

        await webAppTransport.start();

        // Handle the initial request
        await webAppTransport.handleRequest(request.raw, reply.raw, request.body);
      } catch (error) {
        log.error({ err: error }, "Error in POST /mcp route");
        reply.code(500);
        return { error: error instanceof Error ? error.message : "Internal error" };
      }
    }
  });

  /**
   * Streamable HTTP DELETE - Terminate session
   * DELETE /api/mcp/tauri/mcp
   */
  fastify.delete("/api/mcp/tauri/mcp", async (request, reply) => {
    setCorsHeaders(request, reply);

    const sessionId = request.headers["mcp-session-id"] as string | undefined;
    log.debug({ sessionId }, "Received DELETE /mcp");

    if (!sessionId) {
      reply.code(400);
      return { error: "Mcp-Session-Id header required" };
    }

    const session = streamableHttpSessions.get(sessionId);
    if (!session) {
      reply.code(404);
      return { error: "Session not found" };
    }

    try {
      // Kill the MCP server process
      session.process.kill();

      // Clean up
      streamableHttpSessions.delete(sessionId);

      reply.code(200);
      return { deleted: sessionId };
    } catch (error) {
      log.error({ err: error }, "Error in DELETE /mcp route");
      reply.code(500);
      return { error: error instanceof Error ? error.message : "Internal error" };
    }
  });

  // ========================================================================
  // SSE Endpoint (Legacy)
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
      log.info({ sessionId }, "SSE session closed, killing MCP server");
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
    Querystring: { session_id?: string };
    Body: McpMessage;
  }>("/api/mcp/tauri/message", async (request, reply) => {
    // CORS headers
    reply.header("Access-Control-Allow-Origin", "*");
    reply.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    reply.header(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, Accept, Mcp-Session-Id"
    );

    const sessionId = request.query.session_id || request.headers["mcp-session-id"] as string;
    const message = request.body;

    log.debug({ sessionId, message: JSON.stringify(message).slice(0, 100) }, "POST /message received");

    if (!sessionId) {
      reply.code(400);
      return { error: "session_id query parameter required" };
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
      log.error({ err }, "Error handling message");
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
    Querystring: { session_id?: string };
    Body: McpMessage;
  }>("/api/mcp/tauri/sse", async (request, reply) => {
    // CORS headers
    reply.header("Access-Control-Allow-Origin", "*");
    reply.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    reply.header(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, Accept, Mcp-Session-Id"
    );

    const sessionId = request.query.session_id || request.headers["mcp-session-id"] as string;
    const message = request.body;

    if (!sessionId) {
      reply.code(400);
      return { error: "session_id query parameter or Mcp-Session-Id header required" };
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
    reply.header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    reply.header(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, Accept, Mcp-Session-Id, Last-Event-Id, mcp-protocol-version"
    );
    reply.header("Access-Control-Expose-Headers", "Mcp-Session-Id, mcp-protocol-version");
    reply.header("Access-Control-Max-Age", "86400");
    reply.code(204).send();
  });
}

// ============================================================================
// Exports
// ============================================================================

export { DEFAULT_SOCKET_PATH };

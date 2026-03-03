/**
 * Tauri Plugin MCP Bridge Routes
 *
 * Bridges HTTP/SSE requests to tauri-plugin-mcp's IPC socket.
 * This allows AI tools to connect to the desktop app via HTTP instead of requiring
 * a separate MCP server process.
 *
 * Architecture:
 *   AI Tool (Claude Code, Cursor) → HTTP/SSE → Gateway → IPC Socket → Tauri App
 *
 * Endpoints:
 *   GET  /api/mcp/tauri/sse      - SSE endpoint for MCP communication
 *   POST /api/mcp/tauri/messages - Send messages to MCP server
 *   GET  /api/mcp/tauri/status   - Check tauri-plugin-mcp status
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { createConnection, type Socket } from "node:net";
import { existsSync } from "node:fs";
import { EventEmitter } from "node:events";

// Default socket path for tauri-plugin-mcp
const DEFAULT_SOCKET_PATH = "/tmp/viben-mcp.sock";

// ============================================================================
// Types
// ============================================================================

interface TauriMcpStatus {
  available: boolean;
  socketPath: string;
  connected: boolean;
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
// Socket Client Manager
// ============================================================================

class TauriMcpClient extends EventEmitter {
  private socket: Socket | null = null;
  private socketPath: string;
  private connected = false;
  private buffer = "";
  private pendingRequests = new Map<
    string | number,
    {
      resolve: (value: McpMessage) => void;
      reject: (error: Error) => void;
      timeout: NodeJS.Timeout;
    }
  >();
  private requestId = 0;

  constructor(socketPath: string = DEFAULT_SOCKET_PATH) {
    super();
    this.socketPath = socketPath;
  }

  async connect(): Promise<void> {
    if (this.connected && this.socket) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.socket = createConnection(this.socketPath, () => {
        this.connected = true;
        console.log(`[tauri-mcp] Connected to ${this.socketPath}`);
        resolve();
      });

      this.socket.on("data", (data) => {
        this.handleData(data.toString());
      });

      this.socket.on("error", (err) => {
        console.error(`[tauri-mcp] Socket error:`, err.message);
        this.connected = false;
        reject(err);
      });

      this.socket.on("close", () => {
        console.log(`[tauri-mcp] Socket closed`);
        this.connected = false;
        this.socket = null;
        // Reject all pending requests
        for (const [id, pending] of this.pendingRequests) {
          clearTimeout(pending.timeout);
          pending.reject(new Error("Socket closed"));
        }
        this.pendingRequests.clear();
      });
    });
  }

  private handleData(data: string): void {
    this.buffer += data;

    // Try to parse complete JSON messages (newline-delimited)
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const message = JSON.parse(line) as McpMessage;
        this.handleMessage(message);
      } catch (err) {
        console.error(`[tauri-mcp] Failed to parse message:`, line);
      }
    }
  }

  private handleMessage(message: McpMessage): void {
    // Handle response to a request
    if (message.id !== undefined) {
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(message.id);
        pending.resolve(message);
        return;
      }
    }

    // Handle notification (no id)
    this.emit("notification", message);
  }

  async send(message: McpMessage, timeout = 30000): Promise<McpMessage> {
    if (!this.connected || !this.socket) {
      throw new Error("Not connected to tauri-mcp socket");
    }

    // Assign request ID if not present
    if (message.id === undefined && message.method) {
      message.id = ++this.requestId;
    }

    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        if (message.id !== undefined) {
          this.pendingRequests.delete(message.id);
        }
        reject(new Error(`Request timeout: ${message.method}`));
      }, timeout);

      if (message.id !== undefined) {
        this.pendingRequests.set(message.id, {
          resolve,
          reject,
          timeout: timeoutHandle,
        });
      }

      const data = JSON.stringify(message) + "\n";
      this.socket!.write(data, (err) => {
        if (err) {
          clearTimeout(timeoutHandle);
          if (message.id !== undefined) {
            this.pendingRequests.delete(message.id);
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

  disconnect(): void {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }
}

// Singleton client instance
let tauriMcpClient: TauriMcpClient | null = null;

async function getClient(): Promise<TauriMcpClient> {
  if (!tauriMcpClient) {
    tauriMcpClient = new TauriMcpClient(DEFAULT_SOCKET_PATH);
  }

  if (!tauriMcpClient.isConnected()) {
    await tauriMcpClient.connect();
  }

  return tauriMcpClient;
}

// ============================================================================
// SSE Session Manager
// ============================================================================

interface SSESession {
  id: string;
  reply: FastifyReply;
  client: TauriMcpClient;
}

const sseSessions = new Map<string, SSESession>();

function generateSessionId(): string {
  return `tauri-mcp-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
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
            error: { type: "string" },
          },
        },
      },
    },
  }, async (): Promise<TauriMcpStatus> => {
    const socketExists = existsSync(DEFAULT_SOCKET_PATH);

    if (!socketExists) {
      return {
        available: false,
        socketPath: DEFAULT_SOCKET_PATH,
        connected: false,
        error: "Socket file not found. Is the Tauri app running in dev mode?",
      };
    }

    try {
      const client = await getClient();
      return {
        available: true,
        socketPath: DEFAULT_SOCKET_PATH,
        connected: client.isConnected(),
      };
    } catch (err) {
      return {
        available: true,
        socketPath: DEFAULT_SOCKET_PATH,
        connected: false,
        error: err instanceof Error ? err.message : "Connection failed",
      };
    }
  });

  // ========================================================================
  // SSE Endpoint
  // ========================================================================

  /**
   * SSE endpoint for MCP communication
   * GET /api/mcp/tauri/sse
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
      reply.raw.write(`data: ${JSON.stringify({ error: "Tauri app not running" })}\n\n`);
      reply.raw.end();
      return;
    }

    try {
      // Connect to tauri-mcp
      const client = new TauriMcpClient(DEFAULT_SOCKET_PATH);
      await client.connect();

      // Store session
      sseSessions.set(sessionId, { id: sessionId, reply, client });

      // Send connected event
      reply.raw.write(`event: open\n`);
      reply.raw.write(`data: ${JSON.stringify({ sessionId })}\n\n`);

      // Forward notifications from tauri-mcp to SSE
      client.on("notification", (message: McpMessage) => {
        reply.raw.write(`event: message\n`);
        reply.raw.write(`data: ${JSON.stringify(message)}\n\n`);
      });

      // Handle client disconnect
      request.raw.on("close", () => {
        console.log(`[tauri-mcp] SSE session ${sessionId} closed`);
        client.disconnect();
        sseSessions.delete(sessionId);
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
    } catch (err) {
      reply.raw.write(`event: error\n`);
      reply.raw.write(`data: ${JSON.stringify({
        error: err instanceof Error ? err.message : "Connection failed",
      })}\n\n`);
      reply.raw.end();
      return;
    }
  });

  // ========================================================================
  // Message Endpoint
  // ========================================================================

  /**
   * Send message to MCP server
   * POST /api/mcp/tauri/messages
   */
  fastify.post<{
    Body: McpMessage;
    Headers: { "mcp-session-id"?: string };
  }>("/api/mcp/tauri/messages", {
    schema: {
      description: "Send a message to tauri-plugin-mcp",
      tags: ["mcp", "tauri"],
    },
  }, async (request, reply) => {
    // CORS headers
    reply.header("Access-Control-Allow-Origin", "*");
    reply.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    reply.header(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, Accept, Mcp-Session-Id"
    );

    const sessionId = request.headers["mcp-session-id"];
    const message = request.body;

    if (!message || !message.jsonrpc) {
      reply.code(400);
      return { error: "Invalid JSON-RPC message" };
    }

    try {
      let client: TauriMcpClient;

      // Use session client if available
      if (sessionId && sseSessions.has(sessionId)) {
        client = sseSessions.get(sessionId)!.client;
      } else {
        // Create a new connection
        client = await getClient();
      }

      const response = await client.send(message);
      return response;
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
  // HTTP Streaming Endpoint (Alternative to SSE)
  // ========================================================================

  /**
   * HTTP Streaming endpoint for MCP
   * POST /api/mcp/tauri/mcp
   *
   * This is the "streamable-http" transport that some clients prefer.
   */
  fastify.post<{
    Body: McpMessage;
  }>("/api/mcp/tauri/mcp", {
    schema: {
      description: "Streamable HTTP endpoint for MCP",
      tags: ["mcp", "tauri"],
    },
  }, async (request, reply) => {
    // CORS headers
    reply.header("Access-Control-Allow-Origin", "*");
    reply.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    reply.header(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, Accept, Mcp-Session-Id"
    );

    const message = request.body;

    if (!message || !message.jsonrpc) {
      reply.code(400);
      return { error: "Invalid JSON-RPC message" };
    }

    try {
      const client = await getClient();
      const response = await client.send(message);
      return response;
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

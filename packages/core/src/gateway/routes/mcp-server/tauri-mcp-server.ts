/**
 * Tauri MCP Server Routes
 *
 * Exposes @hypothesi/tauri-mcp-server tools via Streamable HTTP transport.
 * Registers tool handlers from the package's TOOLS registry on a low-level MCP Server,
 * then serves it via StreamableHTTPServerTransport.
 *
 * Architecture:
 *   AI Tool → HTTP (Streamable HTTP) → Gateway → MCP Server → tool handlers → WebSocket (9223) → Tauri App
 *
 * Endpoints:
 *   GET    /api/mcp-server/tauri        - Streamable HTTP SSE stream for existing session
 *   POST   /api/mcp-server/tauri        - Streamable HTTP endpoint (initialize or send message)
 *   DELETE /api/mcp-server/tauri        - Streamable HTTP session termination
 *   GET    /api/mcp-server/tauri/status - Check tauri-plugin-mcp-bridge status
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { TOOLS } from "@hypothesi/tauri-mcp-server";
import { zodToJsonSchema } from "zod-to-json-schema";
import { logger as globalLogger } from "../../../telemetry";

const log = globalLogger.child({ module: "tauri-mcp-server" });

export const TAURI_MCP_PATH = "/api/mcp-server/tauri";
export const DEFAULT_WS_PORT = 9223;

// ============================================================================
// Types
// ============================================================================

interface TauriMcpTransport extends Transport {
  handleRequest(req: IncomingMessage, res: ServerResponse, parsedBody?: unknown): Promise<void>;
}

interface TauriMcpSession {
  id: string;
  server: Server;
  transport: TauriMcpTransport;
}

export interface TauriMcpRoutesOptions {
  port?: number;
  createServer?: () => Server;
  createTransport?: (pendingSessionId: string) => TauriMcpTransport;
}

// ============================================================================
// Session Management
// ============================================================================

const sessions = new Map<string, TauriMcpSession>();

function setCorsHeaders(request: FastifyRequest, reply: FastifyReply): void {
  const origin = request.headers.origin || "*";
  reply.raw.setHeader("Access-Control-Allow-Origin", origin);
  reply.raw.setHeader("Access-Control-Allow-Credentials", "true");
  reply.raw.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Accept, Mcp-Session-Id, Last-Event-Id, mcp-protocol-version",
  );
  reply.raw.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id, mcp-protocol-version");
  reply.raw.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
}

function getSessionIdFromHeader(request: FastifyRequest): string | undefined {
  const value = request.headers["mcp-session-id"];
  return Array.isArray(value) ? value.at(-1) : value;
}

// Pre-compute tool definitions for ListTools response
const TOOL_DEFINITIONS = TOOLS.map((tool) => ({
  name: tool.name,
  description: tool.description,
  inputSchema: zodToJsonSchema(tool.schema) as Record<string, unknown>,
  annotations: tool.annotations,
}));

const TOOL_MAP = new Map(TOOLS.map((tool) => [tool.name, tool]));

/**
 * Create an MCP Server with all tauri-mcp-server tools registered
 */
function createTauriMcpServer(): Server {
  const server = new Server(
    { name: "tauri-mcp", version: "1.0.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOL_DEFINITIONS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = TOOL_MAP.get(request.params.name);
    if (!tool) {
      return {
        content: [{ type: "text", text: `Error: Unknown tool: ${request.params.name}` }],
        isError: true,
      };
    }

    try {
      const result = await tool.handler(request.params.arguments);

      if (typeof result === "string") {
        return { content: [{ type: "text", text: result }] };
      }
      if (Array.isArray(result)) {
        return { content: result.map((item) => item.type === "text" ? { type: "text" as const, text: item.text } : { type: "image" as const, data: item.data, mimeType: item.mimeType }) };
      }
      if (result.type === "text") {
        return { content: [{ type: "text", text: result.text }] };
      }
      return { content: [{ type: "image", data: result.data, mimeType: result.mimeType }] };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
    }
  });

  return server;
}

// ============================================================================
// Exports
// ============================================================================

export function closeAllTauriMcpSessions(): void {
  for (const session of sessions.values()) {
    session.transport.close?.().catch((error) => {
      log.warn({ err: error, sessionId: session.id }, "Failed to close tauri MCP transport");
    });
  }
  sessions.clear();
}

export function getActiveTauriMcpSessionCount(): number {
  return sessions.size;
}

// ============================================================================
// Route Registration
// ============================================================================

export function registerTauriMcpServerRoutes(
  fastify: FastifyInstance,
  options: TauriMcpRoutesOptions = {},
): void {
  const port = options.port ?? DEFAULT_WS_PORT;

  const createServer = options.createServer ?? (() => createTauriMcpServer());
  const createTransport = options.createTransport ?? ((pendingSessionId: string) =>
    new StreamableHTTPServerTransport({
      sessionIdGenerator: randomUUID,
      onsessioninitialized: (mcpSessionId) => {
        const pending = sessions.get(pendingSessionId);
        if (!pending) return;
        sessions.delete(pendingSessionId);
        sessions.set(mcpSessionId, { ...pending, id: mcpSessionId });
        log.info({ sessionId: mcpSessionId }, "Tauri MCP session initialized");
      },
      onsessionclosed: (mcpSessionId) => {
        const session = sessions.get(mcpSessionId);
        if (!session) return;
        log.info({ sessionId: mcpSessionId }, "Tauri MCP session closed");
        sessions.delete(mcpSessionId);
      },
    }) as TauriMcpTransport);

  // ========================================================================
  // Status Endpoint
  // ========================================================================

  fastify.get(`${TAURI_MCP_PATH}/status`, {
    schema: {
      description: "Check tauri-plugin-mcp-bridge connection status",
      tags: ["mcp", "tauri"],
      response: {
        200: {
          type: "object",
          properties: {
            available: { type: "boolean" },
            port: { type: "number" },
            connected: { type: "boolean" },
            error: { type: "string" },
          },
        },
      },
    },
  }, async () => {
    const { default: WebSocket } = await import("ws");
    return new Promise<{ available: boolean; port: number; connected: boolean; error?: string }>((resolve) => {
      let settled = false;
      const ws = new WebSocket(`ws://127.0.0.1:${port}`);

      const settle = (result: { available: boolean; port: number; connected: boolean; error?: string }) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        ws.close();
        resolve(result);
      };

      const timeout = setTimeout(() => {
        settle({ available: false, port, connected: false, error: "Connection timeout. Is the Tauri app running?" });
      }, 2000);

      ws.once("open", () => {
        settle({ available: true, port, connected: true });
      });

      ws.once("error", (err) => {
        settle({ available: false, port, connected: false, error: `Cannot connect: ${err.message}` });
      });
    });
  });

  // ========================================================================
  // Streamable HTTP Transport
  // ========================================================================

  fastify.get(TAURI_MCP_PATH, async (request, reply) => {
    setCorsHeaders(request, reply);

    const mcpSessionId = getSessionIdFromHeader(request);
    if (!mcpSessionId) {
      reply.code(400);
      return { error: "Mcp-Session-Id header required" };
    }

    const session = sessions.get(mcpSessionId);
    if (!session) {
      reply.code(404);
      return { error: "Session not found" };
    }

    await session.transport.handleRequest(request.raw, reply.raw);
  });

  fastify.post(TAURI_MCP_PATH, async (request, reply) => {
    setCorsHeaders(request, reply);

    const mcpSessionId = getSessionIdFromHeader(request);
    if (mcpSessionId) {
      const session = sessions.get(mcpSessionId);
      if (!session) {
        reply.code(404);
        return { error: "Session not found" };
      }

      await session.transport.handleRequest(request.raw, reply.raw, request.body);
      return;
    }

    // New session
    const pendingSessionId = `pending-${randomUUID()}`;
    const transport = createTransport(pendingSessionId);
    const server = createServer();
    const sessionId = (transport as StreamableHTTPServerTransport).sessionId ?? pendingSessionId;
    sessions.set(sessionId, { id: sessionId, server, transport });

    transport.onclose = () => {
      sessions.delete(sessionId);
      if ((transport as StreamableHTTPServerTransport).sessionId) {
        sessions.delete((transport as StreamableHTTPServerTransport).sessionId!);
      }
    };

    await server.connect(transport);
    await transport.handleRequest(request.raw, reply.raw, request.body);
  });

  fastify.delete(TAURI_MCP_PATH, async (request, reply) => {
    setCorsHeaders(request, reply);

    const mcpSessionId = getSessionIdFromHeader(request);
    if (!mcpSessionId) {
      reply.code(400);
      return { error: "Mcp-Session-Id header required" };
    }

    const session = sessions.get(mcpSessionId);
    if (!session) {
      reply.code(404);
      return { error: "Session not found" };
    }

    await session.transport.handleRequest(request.raw, reply.raw);
    sessions.delete(mcpSessionId);
  });

  // ========================================================================
  // CORS Preflight
  // ========================================================================

  fastify.options(`${TAURI_MCP_PATH}/*`, { schema: { hide: true } }, async (_request, reply) => {
    reply.header("Access-Control-Allow-Origin", "*");
    reply.header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    reply.header("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept, Mcp-Session-Id, Last-Event-Id, mcp-protocol-version");
    reply.header("Access-Control-Expose-Headers", "Mcp-Session-Id, mcp-protocol-version");
    reply.header("Access-Control-Max-Age", "86400");
    reply.code(204).send();
  });
}

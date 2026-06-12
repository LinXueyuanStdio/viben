import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createBrowseMcpServer, type BrowseMcpServerOptions } from "../../../mcp/server/browse-mcp/mcp-server";
import { logger as globalLogger } from "../../../telemetry";
import { getBrowsePluginsDir } from "../browse-plugins";

const log = globalLogger.child({ module: "browse-mcp-server" });
const BROWSE_MCP_PATH = "/api/mcp-server/browse";

interface BrowseMcpTransport extends Transport {
  handleRequest(req: IncomingMessage, res: ServerResponse, parsedBody?: unknown): Promise<void>;
}

interface BrowseMcpSession {
  id: string;
  server: Pick<McpServer, "connect">;
  transport: BrowseMcpTransport;
}

export interface BrowseMcpRoutesOptions {
  createServer?: () => Pick<McpServer, "connect">;
  createTransport?: (pendingSessionId: string) => BrowseMcpTransport;
  browseMcpServerOptions?: BrowseMcpServerOptions;
}

const sessions = new Map<string, BrowseMcpSession>();

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

export function closeAllBrowseMcpServerSessions(): void {
  for (const session of sessions.values()) {
    session.transport.close().catch((error) => {
      log.warn({ err: error, sessionId: session.id }, "Failed to close browse MCP transport");
    });
  }
  sessions.clear();
}

export function getActiveBrowseMcpServerSessionCount(): number {
  return sessions.size;
}

export function registerBrowseMcpServerRoutes(
  fastify: FastifyInstance,
  options: BrowseMcpRoutesOptions = {},
): void {
  // Ensure browse-sdk plugin discovery includes user-installed plugins
  const pluginsDir = getBrowsePluginsDir();
  if (!process.env.BROWSE_MCP_PLUGIN_DIRS) {
    process.env.BROWSE_MCP_PLUGIN_DIRS = pluginsDir;
  } else if (!process.env.BROWSE_MCP_PLUGIN_DIRS.includes(pluginsDir)) {
    const sep = process.platform === "win32" ? ";" : ":";
    process.env.BROWSE_MCP_PLUGIN_DIRS = `${process.env.BROWSE_MCP_PLUGIN_DIRS}${sep}${pluginsDir}`;
  }

  const createServer = options.createServer ?? (() => createBrowseMcpServer(options.browseMcpServerOptions));
  const createTransport = options.createTransport ?? ((pendingSessionId: string) =>
    new StreamableHTTPServerTransport({
      sessionIdGenerator: randomUUID,
      onsessioninitialized: (mcpSessionId) => {
        const pending = sessions.get(pendingSessionId);
        if (!pending) {
          return;
        }
        sessions.delete(pendingSessionId);
        sessions.set(mcpSessionId, { ...pending, id: mcpSessionId });
        log.info({ sessionId: mcpSessionId }, "Browse MCP session initialized");
      },
      onsessionclosed: (mcpSessionId) => {
        const session = sessions.get(mcpSessionId);
        if (!session) {
          return;
        }
        log.info({ sessionId: mcpSessionId }, "Browse MCP session closed");
        sessions.delete(mcpSessionId);
      },
    }));

  fastify.get(BROWSE_MCP_PATH, async (request, reply) => {
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

  fastify.post(BROWSE_MCP_PATH, async (request, reply) => {
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

    const pendingMcpSessionId = `pending-${randomUUID()}`;
    const transport = createTransport(pendingMcpSessionId);
    const server = createServer();
    const sessionId = transport.sessionId ?? pendingMcpSessionId;
    sessions.set(sessionId, { id: sessionId, server, transport });

    transport.onclose = () => {
      sessions.delete(sessionId);
      if (transport.sessionId) {
        sessions.delete(transport.sessionId);
      }
    };

    await server.connect(transport);
    await transport.handleRequest(request.raw, reply.raw, request.body);
  });

  fastify.delete(BROWSE_MCP_PATH, async (request, reply) => {
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
}

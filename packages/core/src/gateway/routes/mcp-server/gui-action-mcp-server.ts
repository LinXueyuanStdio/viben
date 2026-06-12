import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { createClientSideMcpServer } from "../../../acp/ops/client-side-mcp-server";
import { acpSessionManager } from "../../../acp";
import { logger as globalLogger } from "../../../telemetry";
import type { AppState } from "../../state";

const log = globalLogger.child({ module: "gui-action-mcp-server" });
const GUI_ACTION_MCP_PATH = "/api/mcp-server/gui-action";

interface GuiActionMcpTransport extends Transport {
  handleRequest(req: IncomingMessage, res: ServerResponse, parsedBody?: unknown): Promise<void>;
}

interface GuiActionMcpSession {
  id: string;
  server: Pick<McpServer, "connect">;
  transport: GuiActionMcpTransport;
}

interface GuiActionMcpRoutesOptions {
  createServer?: (sessionId: string, callerClientId?: string) => Pick<McpServer, "connect">;
  createTransport?: (pendingSessionId: string) => GuiActionMcpTransport;
}

const sessions = new Map<string, GuiActionMcpSession>();

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

function getAcpSessionId(request: FastifyRequest): string | undefined {
  const query = request.query as { session_id?: unknown };
  return typeof query.session_id === "string" && query.session_id.length > 0
    ? query.session_id
    : undefined;
}

export function closeAllGuiActionMcpServerSessions(): void {
  for (const session of sessions.values()) {
    session.transport.close().catch((error) => {
      log.warn({ err: error, sessionId: session.id }, "Failed to close GUI action MCP transport");
    });
  }
  sessions.clear();
}

export function getActiveGuiActionMcpServerSessionCount(): number {
  return sessions.size;
}

export function registerGuiActionMcpServerRoutes(
  fastify: FastifyInstance,
  state?: AppState,
  options: GuiActionMcpRoutesOptions = {},
): void {
  const createServer = options.createServer ?? ((sessionId: string, callerClientId?: string) =>
    createClientSideMcpServer({
      sessionId,
      callerClientId,
      clientStoreExecutor: state?.clientSocketServer ? {
        executeAction: (targetClientId, namespace, name, payload, context) =>
          state.clientSocketServer!.executeAction(targetClientId, namespace, name, payload, context) as Promise<CallToolResult>,
        getAllActions: () => state.clientStore.getAllActions(),
        findActionByName: (name) => state.clientStore.findActionByName(name),
        findActionByFullName: (fullName) => state.clientStore.findActionByFullName(fullName),
      } : undefined,
      requestClientTool: ({ sessionId: sid, toolName, input, toolCallId }) =>
        acpSessionManager.requestClientTool(sid, toolName, input, toolCallId),
    }));
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
        log.info({ sessionId: mcpSessionId }, "GUI action MCP session initialized");
      },
      onsessionclosed: (mcpSessionId) => {
        const session = sessions.get(mcpSessionId);
        if (!session) {
          return;
        }
        log.info({ sessionId: mcpSessionId }, "GUI action MCP session closed");
        sessions.delete(mcpSessionId);
      },
    }));

  fastify.get(GUI_ACTION_MCP_PATH, async (request, reply) => {
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

  fastify.post<{
    Querystring: { session_id?: string };
    Body: unknown;
  }>(GUI_ACTION_MCP_PATH, async (request, reply) => {
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

    const acpSessionId = getAcpSessionId(request);
    if (!acpSessionId) {
      reply.code(400);
      return { error: "session_id query parameter is required" };
    }

    const callerClientId = request.headers["x-viben-client-id"] as string | undefined;
    const pendingMcpSessionId = `pending-${randomUUID()}`;
    const transport = createTransport(pendingMcpSessionId);
    const server = createServer(acpSessionId, callerClientId);
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

  fastify.delete(GUI_ACTION_MCP_PATH, async (request, reply) => {
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

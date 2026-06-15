import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { homedir } from "node:os";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { createPythonMcpServer } from "../../../mcp/server/python-mcp/mcp-server";
import { JupyterClient } from "../../../mcp/server/python-mcp/jupyter-client";
import { SessionManager } from "../../../mcp/server/python-mcp/session-manager";
import { SkillRegistry } from "../../../mcp/server/python-mcp/skill-registry";
import type { PythonMcpConfig } from "../../../mcp/server/python-mcp/types";
import { logger as globalLogger } from "../../../telemetry";

const log = globalLogger.child({ module: "python-mcp-server" });
const PYTHON_MCP_PATH = "/api/mcp-server/python";
const MANAGEMENT_PREFIX = "/api/python-mcp";

const BASE_DIR = join(homedir(), ".viben", "python-mcp");
const CONFIG_PATH = join(BASE_DIR, "config.yaml");
const SESSIONS_DIR = join(BASE_DIR, "sessions");
const SKILLS_DIR = join(BASE_DIR, "skills");

interface PythonMcpTransport extends Transport {
  handleRequest(req: IncomingMessage, res: ServerResponse, parsedBody?: unknown): Promise<void>;
}

interface PythonMcpSession {
  id: string;
  server: Pick<McpServer, "connect">;
  transport: PythonMcpTransport;
  acpSessionId: string;
}

const sessions = new Map<string, PythonMcpSession>();
const sessionManager = new SessionManager(SESSIONS_DIR);
const skillRegistry = new SkillRegistry(SKILLS_DIR);

async function loadConfig(): Promise<PythonMcpConfig> {
  try {
    const raw = await readFile(CONFIG_PATH, "utf-8");
    return parseYaml(raw) as PythonMcpConfig;
  } catch {
    return { jupyter_url: "http://localhost:8888", jupyter_token: "" };
  }
}

async function saveConfig(config: PythonMcpConfig): Promise<void> {
  await mkdir(BASE_DIR, { recursive: true });
  await writeFile(CONFIG_PATH, stringifyYaml(config), "utf-8");
}

function setCorsHeaders(request: FastifyRequest, reply: FastifyReply): void {
  const origin = request.headers.origin || "*";
  reply.raw.setHeader("Access-Control-Allow-Origin", origin);
  reply.raw.setHeader("Access-Control-Allow-Credentials", "true");
  reply.raw.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Accept, Mcp-Session-Id, Last-Event-Id, mcp-protocol-version, X-Viben-Session-Id, X-Jupyter-Url, X-Jupyter-Token",
  );
  reply.raw.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id, mcp-protocol-version");
  reply.raw.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
}

function getSessionIdFromHeader(request: FastifyRequest): string | undefined {
  const value = request.headers["mcp-session-id"];
  return Array.isArray(value) ? value.at(-1) : value;
}

function getAcpSessionIdFromRequest(request: FastifyRequest): string | undefined {
  const queryParam = (request.query as Record<string, string>)?.session_id;
  if (queryParam) return queryParam;
  const header = request.headers["x-viben-session-id"];
  return Array.isArray(header) ? header.at(-1) : header;
}

export function closeAllPythonMcpServerSessions(): void {
  for (const session of sessions.values()) {
    session.transport.close().catch((error) => {
      log.warn({ err: error, sessionId: session.id }, "Failed to close python MCP transport");
    });
  }
  sessions.clear();
}

export function getActivePythonMcpServerSessionCount(): number {
  return sessions.size;
}

export function registerPythonMcpServerRoutes(fastify: FastifyInstance): void {
  // --- MCP Protocol Endpoints ---

  fastify.get(PYTHON_MCP_PATH, async (request, reply) => {
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

  fastify.post(PYTHON_MCP_PATH, async (request, reply) => {
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

    const acpSessionId = getAcpSessionIdFromRequest(request);
    if (!acpSessionId) {
      reply.code(400);
      return { error: "X-Viben-Session-Id header or session_id query param required" };
    }

    const config = await loadConfig();
    const jupyterUrl = (request.headers["x-jupyter-url"] as string) || config.jupyter_url;
    const jupyterToken = (request.headers["x-jupyter-token"] as string) || config.jupyter_token;
    const jupyterClient = new JupyterClient(jupyterUrl, jupyterToken);

    const pendingMcpSessionId = `pending-${randomUUID()}`;
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: randomUUID,
      onsessioninitialized: (newMcpSessionId) => {
        const pending = sessions.get(pendingMcpSessionId);
        if (!pending) return;
        sessions.delete(pendingMcpSessionId);
        sessions.set(newMcpSessionId, { ...pending, id: newMcpSessionId });
        log.info({ sessionId: newMcpSessionId, acpSessionId }, "Python MCP session initialized");
      },
      onsessionclosed: (closedId) => {
        sessions.delete(closedId);
        log.info({ sessionId: closedId }, "Python MCP session closed");
      },
    }) as unknown as PythonMcpTransport;

    const server = createPythonMcpServer({
      sessionManager,
      skillRegistry,
      getJupyterClient: () => jupyterClient,
      getAcpSessionId: () => acpSessionId,
    });

    const sessionId = (transport as unknown as { sessionId?: string }).sessionId ?? pendingMcpSessionId;
    sessions.set(sessionId, { id: sessionId, server, transport, acpSessionId });

    transport.onclose = () => {
      sessions.delete(sessionId);
      const realId = (transport as unknown as { sessionId?: string }).sessionId;
      if (realId) sessions.delete(realId);
    };

    await server.connect(transport);
    await transport.handleRequest(request.raw, reply.raw, request.body);
  });

  fastify.delete(PYTHON_MCP_PATH, async (request, reply) => {
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

  // --- Management APIs ---

  fastify.get(`${MANAGEMENT_PREFIX}/config`, async () => {
    return await loadConfig();
  });

  fastify.put(`${MANAGEMENT_PREFIX}/config`, async (request) => {
    const body = request.body as Partial<PythonMcpConfig>;
    const current = await loadConfig();
    const updated = { ...current, ...body };
    await saveConfig(updated);
    return updated;
  });

  fastify.get(`${MANAGEMENT_PREFIX}/sessions`, async () => {
    return await sessionManager.getAllSessions();
  });

  fastify.get(`${MANAGEMENT_PREFIX}/sessions/:id/history`, async (request) => {
    const { id } = request.params as { id: string };
    return await sessionManager.getHistory(id);
  });

  fastify.post(`${MANAGEMENT_PREFIX}/execute`, async (request) => {
    const { kernel_id, code } = request.body as {
      kernel_id: string;
      code: string;
      description?: string;
    };
    const config = await loadConfig();
    const jupyterUrl = (request.headers["x-jupyter-url"] as string) || config.jupyter_url;
    const jupyterToken = (request.headers["x-jupyter-token"] as string) || config.jupyter_token;
    const client = new JupyterClient(jupyterUrl, jupyterToken);
    const result = await client.executeCode(kernel_id, code);
    return result;
  });

  fastify.get(`${MANAGEMENT_PREFIX}/skills`, async () => {
    return await skillRegistry.listSkills();
  });

  fastify.post(`${MANAGEMENT_PREFIX}/skills`, async (request) => {
    const body = request.body as { name: string; description: string; code_for_interpreter?: string; code_for_agent?: string };
    await skillRegistry.createSkill(body);
    return { status: "created", name: body.name };
  });

  fastify.put(`${MANAGEMENT_PREFIX}/skills/:name`, async (request) => {
    const { name } = request.params as { name: string };
    const body = request.body as { description?: string; code_for_interpreter?: string; code_for_agent?: string };
    await skillRegistry.updateSkill(name, body);
    return { status: "updated", name };
  });

  fastify.delete(`${MANAGEMENT_PREFIX}/skills/:name`, async (request) => {
    const { name } = request.params as { name: string };
    await skillRegistry.deleteSkill(name);
    return { status: "deleted", name };
  });
}

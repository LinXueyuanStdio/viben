/**
 * Agent ACP WebSocket Route
 *
 * Exposes Viben's backend agent executor as an ACP-compatible JSON-RPC server
 * over WebSocket. The route keeps wire handling here and delegates session
 * lifecycle/execution to packages/core/src/acp.
 */
import type { FastifyInstance } from "fastify";
import type { WebsocketHandler } from "@fastify/websocket";
import type { WebSocket } from "ws";
import {
  ACP_PROTOCOL_VERSION,
  acpSessionManager,
  type AcpCancelNotification,
  type AcpConnection,
  type AcpInitializeRequest,
  type AcpInitializeResponse,
  type AcpLoadSessionRequest,
  type AcpNewSessionRequest,
  type AcpPromptRequest,
  type AcpSessionContext,
  type JsonRpcErrorObject,
  type JsonRpcId,
  type JsonRpcRequest,
} from "../../acp";
import { logger as globalLogger } from "../../telemetry";

const log = globalLogger.child({ module: "agent-acp" });

const JSONRPC_PARSE_ERROR = -32700;
const JSONRPC_INVALID_REQUEST = -32600;
const JSONRPC_METHOD_NOT_FOUND = -32601;
const JSONRPC_INTERNAL_ERROR = -32603;

interface AgentAcpQuery {
  cwd?: string;
  agent_config_path?: string;
  agent_dir?: string;
  session_id?: string;
  task_id?: string;
}

interface PendingClientRequest {
  method: string;
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export function registerAgentAcpRoutes(fastify: FastifyInstance): void {
  if (!fastify.hasDecorator("websocketServer")) {
    log.warn("@fastify/websocket not registered, agent ACP WebSocket routes disabled");
    return;
  }

  const handler: WebsocketHandler = (socket: WebSocket, req) => {
    const query = req.query as AgentAcpQuery;
    const connection = new AcpWebSocketConnection(socket);
    const context: AcpSessionContext = {
      cwd: query.cwd,
      agent_config_path: query.agent_config_path,
      agent_dir: query.agent_dir,
      session_id: query.session_id,
      task_id: query.task_id,
    };
    const ownedSessionIds = new Set<string>();
    let buffer = "";
    let processing = Promise.resolve();

    log.info({ cwd: context.cwd, agentConfigPath: context.agent_config_path }, "ACP WebSocket connected");

    socket.on("message", (data: Buffer | ArrayBuffer | Buffer[]) => {
      buffer = handleIncomingData(webSocketDataToString(data), buffer, (line) => {
        processing = processing
          .then(() => handleJsonRpcLine(line, connection, context, ownedSessionIds))
          .catch((error) => {
            log.error({ err: error }, "Failed to process ACP JSON-RPC line");
          });
      });
    });

    socket.on("close", () => {
      for (const sessionId of ownedSessionIds) {
        acpSessionManager.closeSession(sessionId);
      }
      connection.close();
      log.info({ sessions: ownedSessionIds.size }, "ACP WebSocket disconnected");
    });

    socket.on("error", (error) => {
      for (const sessionId of ownedSessionIds) {
        acpSessionManager.closeSession(sessionId);
      }
      connection.close();
      log.error({ err: error }, "ACP WebSocket error");
    });
  };

  fastify.get<{ Querystring: AgentAcpQuery }>("/ws/agent/acp", { websocket: true }, handler);

  log.info("Agent ACP WebSocket route registered at /ws/agent/acp");
}

export function closeAllAcpSessions(): void {
  acpSessionManager.closeAll();
}

export function getActiveAcpSessionCount(): number {
  return acpSessionManager.listSessions().length;
}

async function handleJsonRpcLine(
  line: string,
  connection: AcpWebSocketConnection,
  context: AcpSessionContext,
  ownedSessionIds: Set<string>
): Promise<void> {
  let message: unknown;
  try {
    message = JSON.parse(line);
  } catch {
    connection.sendError(null, {
      code: JSONRPC_PARSE_ERROR,
      message: "Parse error",
    });
    return;
  }

  if (isJsonRpcResponseLike(message)) {
    const handled = connection.handleResponse(message.id, message.result, message.error);
    if (!handled) {
      log.debug({ id: message.id }, "Ignored ACP response with no pending request");
    }
    return;
  }

  if (!isJsonRpcRequestLike(message)) {
    connection.sendError(null, {
      code: JSONRPC_INVALID_REQUEST,
      message: "Invalid Request",
    });
    return;
  }

  if (!("id" in message)) {
    await handleNotification(message.method, message.params, ownedSessionIds);
    return;
  }

  await handleRequest(message as JsonRpcRequest, connection, context, ownedSessionIds);
}

async function handleRequest(
  request: JsonRpcRequest,
  connection: AcpWebSocketConnection,
  context: AcpSessionContext,
  ownedSessionIds: Set<string>
): Promise<void> {
  try {
    switch (request.method) {
      case "initialize": {
        const response = createInitializeResponse(request.params as AcpInitializeRequest | undefined);
        connection.sendResult(request.id, response);
        return;
      }
      case "session/new": {
        const response = await acpSessionManager.createSession(
          (request.params ?? {}) as AcpNewSessionRequest,
          connection,
          context
        );
        ownedSessionIds.add(response.sessionId);
        connection.sendResult(request.id, response);
        return;
      }
      case "session/load": {
        const params = request.params as AcpLoadSessionRequest;
        if (!params?.sessionId) {
          connection.sendError(request.id, {
            code: JSONRPC_INVALID_REQUEST,
            message: "session/load requires sessionId",
          });
          return;
        }
        const response = await acpSessionManager.loadSession(params, connection, context);
        ownedSessionIds.add(response.sessionId);
        connection.sendResult(request.id, response);
        return;
      }
      case "session/prompt": {
        const params = request.params as AcpPromptRequest;
        if (!params?.sessionId || !Array.isArray(params.prompt)) {
          connection.sendError(request.id, {
            code: JSONRPC_INVALID_REQUEST,
            message: "session/prompt requires sessionId and prompt",
          });
          return;
        }
        const response = await acpSessionManager.prompt(params);
        connection.sendResult(request.id, response);
        return;
      }
      case "session/cancel": {
        const params = request.params as AcpCancelNotification;
        if (params?.sessionId) {
          await acpSessionManager.cancelSession(params.sessionId);
        }
        connection.sendResult(request.id, {});
        return;
      }
      default:
        connection.sendError(request.id, {
          code: JSONRPC_METHOD_NOT_FOUND,
          message: `Method not found: ${request.method}`,
        });
    }
  } catch (error) {
    connection.sendError(request.id, {
      code: JSONRPC_INTERNAL_ERROR,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

async function handleNotification(
  method: string,
  params: unknown,
  ownedSessionIds: Set<string>
): Promise<void> {
  if (method === "$/ping") return;

  if (method === "session/cancel") {
    const sessionId = (params as AcpCancelNotification | undefined)?.sessionId;
    if (sessionId) {
      await acpSessionManager.cancelSession(sessionId);
    }
    return;
  }

  log.debug({ method, ownedSessionCount: ownedSessionIds.size }, "Ignored ACP notification");
}

function createInitializeResponse(_request?: AcpInitializeRequest): AcpInitializeResponse {
  return {
    protocolVersion: ACP_PROTOCOL_VERSION,
    agentInfo: {
      name: "viben",
      title: "Viben Gateway",
      version: "1.0.0",
    },
    agentCapabilities: {
      loadSession: false,
      modes: false,
      sessionCapabilities: {
        list: true,
        loadSession: false,
      },
      _vibenClientTools: true,
    },
    authMethods: [],
  };
}

function handleIncomingData(
  data: string,
  previousBuffer: string,
  onLine: (line: string) => void
): string {
  let buffer = previousBuffer + data;
  if (buffer.indexOf("\n") === -1) {
    const trimmed = buffer.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      void onLine(trimmed);
      return "";
    }
    return buffer;
  }

  const lines = buffer.split("\n");
  buffer = lines.pop() ?? "";
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 0) {
      void onLine(trimmed);
    }
  }
  return buffer;
}

function webSocketDataToString(data: Buffer | ArrayBuffer | Buffer[]): string {
  if (Array.isArray(data)) {
    return Buffer.concat(data).toString("utf-8");
  }
  if (Buffer.isBuffer(data)) {
    return data.toString("utf-8");
  }
  return Buffer.from(data).toString("utf-8");
}

function isJsonRpcRequestLike(value: unknown): value is { jsonrpc: "2.0"; method: string; params?: unknown; id?: JsonRpcId } {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { jsonrpc?: unknown }).jsonrpc === "2.0" &&
    typeof (value as { method?: unknown }).method === "string"
  );
}

function isJsonRpcResponseLike(value: unknown): value is { jsonrpc: "2.0"; id: JsonRpcId; result?: unknown; error?: JsonRpcErrorObject } {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { jsonrpc?: unknown }).jsonrpc === "2.0" &&
    "id" in value &&
    !("method" in value) &&
    ("result" in value || "error" in value)
  );
}

class AcpWebSocketConnection implements AcpConnection {
  private nextRequestId = 1;
  private pending = new Map<JsonRpcId, PendingClientRequest>();
  private closed = false;

  constructor(private socket: WebSocket) {}

  sendNotification(method: string, params?: unknown): void {
    this.sendFrame({
      jsonrpc: "2.0",
      method,
      params: params ?? {},
    });
  }

  async requestClient(method: string, params?: unknown): Promise<unknown> {
    if (this.closed) {
      throw new Error("ACP WebSocket is closed");
    }

    const id = this.nextRequestId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`ACP client request timed out: ${method}`));
      }, 60_000);
      this.pending.set(id, { method, resolve, reject, timer });
      this.sendFrame({
        jsonrpc: "2.0",
        id,
        method,
        params: params ?? {},
      });
    });
  }

  handleResponse(id: JsonRpcId, result: unknown, error?: JsonRpcErrorObject): boolean {
    const pending = this.pending.get(id);
    if (!pending) return false;

    clearTimeout(pending.timer);
    this.pending.delete(id);
    if (error) {
      pending.reject(new Error(error.message));
    } else {
      pending.resolve(result);
    }
    return true;
  }

  sendResult(id: JsonRpcId, result: unknown): void {
    this.sendFrame({
      jsonrpc: "2.0",
      id,
      result,
    });
  }

  sendError(id: JsonRpcId, error: JsonRpcErrorObject): void {
    this.sendFrame({
      jsonrpc: "2.0",
      id,
      error,
    });
  }

  close(): void {
    this.closed = true;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error(`ACP WebSocket closed before ${pending.method} completed`));
    }
    this.pending.clear();
  }

  private sendFrame(frame: unknown): void {
    if (this.closed) return;
    try {
      this.socket.send(`${JSON.stringify(frame)}\n`);
    } catch (error) {
      log.error({ err: error }, "Failed to send ACP WebSocket frame");
    }
  }
}

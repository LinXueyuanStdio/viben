/**
 * Agent ACP WebSocket Route
 *
 * Exposes Viben's backend agent executor as an ACP-compatible Agent over
 * WebSocket. The wire protocol is handled by @agentclientprotocol/sdk; this
 * file only adapts Fastify WebSocket connections into an ACP Stream and binds
 * Viben's session manager to the SDK Agent interface.
 */
import { AgentSideConnection, RequestError } from "@agentclientprotocol/sdk";
import type {
  Agent,
  AnyMessage,
  CloseSessionRequest,
  InitializeRequest,
  InitializeResponse,
  ListSessionsRequest,
  ListSessionsResponse,
  PromptResponse,
  SessionNotification,
  RequestPermissionRequest,
  RequestPermissionResponse,
} from "@agentclientprotocol/sdk";
import type { FastifyInstance } from "fastify";
import type { WebsocketHandler } from "@fastify/websocket";
import type { WebSocket } from "ws";
import {
  ACP_PROTOCOL_VERSION,
  acpSessionManager,
  getAcpErrorDetail,
  type AcpConnection,
  type AcpLoadSessionRequest,
  type AcpNewSessionRequest,
  type AcpPromptRequest,
  type AcpSessionContext,
  type AcpSessionNotification,
} from "../../acp";
import { logger as globalLogger } from "../../telemetry";

const log = globalLogger.child({ module: "agent-acp" });

interface AgentAcpQuery {
  cwd?: string;
  agent_config_path?: string;
  agent_dir?: string;
  session_id?: string;
  task_id?: string;
  gateway_url?: string;
}

export function registerAgentAcpRoutes(fastify: FastifyInstance): void {
  if (!fastify.hasDecorator("websocketServer")) {
    log.warn("@fastify/websocket not registered, agent ACP WebSocket routes disabled");
    return;
  }

  const handler: WebsocketHandler = (socket: WebSocket, req) => {
    const query = req.query as AgentAcpQuery;
    const context: AcpSessionContext = {
      cwd: query.cwd,
      agent_config_path: query.agent_config_path,
      agent_dir: query.agent_dir,
      session_id: query.session_id,
      task_id: query.task_id,
      gateway_url: query.gateway_url,
    };
    const ownedSessionIds = new Set<string>();
    const stream = createWebSocketAcpStream(socket);
    let connection: AgentSideConnection | undefined;

    log.info({ cwd: context.cwd, agentConfigPath: context.agent_config_path }, "ACP WebSocket connected");

    connection = new AgentSideConnection(
      (clientConnection) =>
        createVibenAcpAgent(new SdkAcpConnection(clientConnection), context, ownedSessionIds),
      stream
    );

    const cleanup = () => {
      for (const sessionId of ownedSessionIds) {
        acpSessionManager.closeSession(sessionId);
      }
      log.info({ sessions: ownedSessionIds.size }, "ACP WebSocket disconnected");
    };

    socket.once("close", cleanup);
    socket.once("error", (error) => {
      log.error({ err: error }, "ACP WebSocket error");
    });

    connection.closed.catch((error: unknown) => {
      log.debug({ err: error }, "ACP SDK connection closed with error");
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

function createVibenAcpAgent(
  connection: AcpConnection,
  context: AcpSessionContext,
  ownedSessionIds: Set<string>
): Agent {
  return {
    async initialize(request: InitializeRequest): Promise<InitializeResponse> {
      return createInitializeResponse(request);
    },

    async newSession(request: AcpNewSessionRequest) {
      const response = await acpSessionManager.createSession(request, connection, context);
      ownedSessionIds.add(response.sessionId);
      return response;
    },

    async loadSession(request: AcpLoadSessionRequest) {
      if (!request.sessionId) {
        throw RequestError.invalidParams({ request }, "session/load requires sessionId");
      }
      const response = await acpSessionManager.loadSession(request, connection, context);
      ownedSessionIds.add(request.sessionId);
      return response;
    },

    async prompt(request: AcpPromptRequest) {
      if (!request.sessionId || !Array.isArray(request.prompt)) {
        throw RequestError.invalidParams({ request }, "session/prompt requires sessionId and prompt");
      }
      try {
        return await acpSessionManager.prompt(request) as unknown as PromptResponse;
      } catch (error) {
        const detail = getAcpErrorDetail(error);
        throw new Error(JSON.stringify(detail));
      }
    },

    async cancel(request) {
      if (request.sessionId) {
        await acpSessionManager.cancelSession(request.sessionId);
      }
    },

    async listSessions(_request: ListSessionsRequest): Promise<ListSessionsResponse> {
      return {
        sessions: acpSessionManager.listSessions().map((session) => ({
          sessionId: session.id,
          cwd: session.cwd,
          title: session.agentCapabilities._meta?.title as string | undefined,
          updatedAt: session.lastActiveAt,
        })),
      };
    },

    async unstable_closeSession(request: CloseSessionRequest) {
      if (request.sessionId) {
        acpSessionManager.closeSession(request.sessionId);
        ownedSessionIds.delete(request.sessionId);
      }
      return {};
    },

    async authenticate() {
      return {};
    },
  };
}

function createInitializeResponse(_request: InitializeRequest): InitializeResponse {
  return {
    protocolVersion: ACP_PROTOCOL_VERSION,
    agentInfo: {
      name: "viben",
      title: "Viben Gateway",
      version: "1.0.0",
    },
    agentCapabilities: {
      loadSession: true,
      sessionCapabilities: {
        list: {},
        close: {},
      },
      promptCapabilities: {
        embeddedContext: false,
        image: false,
        audio: false,
      },
      _meta: {
        _vibenClientTools: true,
      },
    },
    authMethods: [],
  };
}

class SdkAcpConnection implements AcpConnection {
  constructor(private readonly sdkConnection: AgentSideConnection) {}

  async sessionUpdate(params: AcpSessionNotification): Promise<void> {
    await this.sdkConnection.sessionUpdate(params as unknown as SessionNotification);
  }

  async requestPermission(params: RequestPermissionRequest): Promise<RequestPermissionResponse> {
    return await this.sdkConnection.requestPermission(params);
  }

  async requestClient(method: string, params?: Record<string, unknown>): Promise<unknown> {
    return this.sdkConnection.extMethod(method, params ?? {});
  }
}

function createWebSocketAcpStream(socket: WebSocket) {
  let readableController: ReadableStreamDefaultController<AnyMessage> | undefined;
  let bufferedText = "";

  const readable = new ReadableStream<AnyMessage>({
    start(controller) {
      readableController = controller;

      socket.on("message", (data: Buffer | ArrayBuffer | Buffer[]) => {
        bufferedText = splitFrames(bufferedText + webSocketDataToString(data), (frame) => {
          controller.enqueue(frame);
        });
      });

      socket.once("close", () => {
        readableController = undefined;
        controller.close();
      });

      socket.once("error", (error) => {
        readableController = undefined;
        controller.error(error);
      });
    },
    cancel() {
      readableController = undefined;
      if (socket.readyState === socket.OPEN) {
        socket.close(1000, "ACP stream cancelled");
      }
    },
  });

  const writable = new WritableStream<AnyMessage>({
    async write(frame) {
      if (socket.readyState !== socket.OPEN) {
        return;
      }
      await new Promise<void>((resolve, reject) => {
        socket.send(`${JSON.stringify(frame)}\n`, (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    },
    close() {
      if (socket.readyState === socket.OPEN) {
        socket.close(1000, "ACP stream closed");
      }
    },
    abort(reason) {
      log.debug({ reason }, "ACP WebSocket stream aborted");
      if (socket.readyState === socket.OPEN) {
        socket.close(1011, "ACP stream aborted");
      }
    },
  });

  return { readable, writable };

  function splitFrames(buffer: string, onFrame: (frame: AnyMessage) => void): string {
    if (buffer.indexOf("\n") === -1) {
      const trimmed = buffer.trim();
      if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
        parseFrame(trimmed, onFrame);
        return "";
      }
      return buffer;
    }

    const lines = buffer.split("\n");
    const rest = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) {
        parseFrame(trimmed, onFrame);
      }
    }
    return rest;
  }

  function parseFrame(line: string, onFrame: (frame: AnyMessage) => void): void {
    try {
      onFrame(JSON.parse(line) as AnyMessage);
    } catch (error) {
      const errorResponse = RequestError.parseError(
        { line },
        error instanceof Error ? error.message : String(error)
      ).toErrorResponse();
      if (socket.readyState === socket.OPEN) {
        socket.send(`${JSON.stringify({ jsonrpc: "2.0", id: null, error: errorResponse })}\n`);
      }
    }
  }
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

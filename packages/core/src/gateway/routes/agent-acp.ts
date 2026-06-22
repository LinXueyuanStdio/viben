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
  type AcpCancelSteerPromptRequest,
  type AcpInterruptSessionRequest,
  type AcpLoadSessionRequest,
  type AcpNewSessionRequest,
  type AcpPromptRequest,
  type AcpSessionContext,
  type AcpSessionNotification,
  type AcpSteerPromptRequest,
  type AcpViewSteerPromptRequest,
} from "../../acp";
import type { AcpSessionEventIdentity } from "../../acp/ops/session-event-store";
import { sessionKey } from "../../acp/ops/session-manager";
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
    const ownedSessionIdentities = new Map<string, AcpSessionEventIdentity>();
    const stream = createWebSocketAcpStream(socket);
    let connection: AgentSideConnection | undefined;
    let acpConnection: SdkAcpConnection | undefined;

    log.info({ cwd: context.cwd, agentConfigPath: context.agent_config_path }, "ACP WebSocket connected");

    connection = new AgentSideConnection(
      (clientConnection) => {
        acpConnection = new SdkAcpConnection(clientConnection);
        return createVibenAcpAgent(acpConnection, context, ownedSessionIdentities);
      },
      stream
    );

    const cleanup = async () => {
      const closingConnection = acpConnection;
      if (!closingConnection) {
        log.info({ sessions: ownedSessionIdentities.size }, "ACP WebSocket disconnected before agent connection opened");
        return;
      }

      let parkedCount = 0;
      for (const identity of ownedSessionIdentities.values()) {
        try {
          const parked = await acpSessionManager.parkSession(identity, closingConnection);
          if (parked) parkedCount += 1;
        } catch (error) {
          log.warn({ err: error, identity }, "ACP session cleanup park failed");
        }
      }
      log.info({ sessions: ownedSessionIdentities.size, parkedCount }, "ACP WebSocket disconnected, sessions parked");
    };

    socket.once("close", () => {
      void cleanup().catch((error) => {
        log.warn({ err: error }, "ACP WebSocket cleanup failed");
      });
    });
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

export async function getActiveAcpSessionCount(): Promise<number> {
  return (await acpSessionManager.listSessions()).length;
}

function createVibenAcpAgent(
  connection: AcpConnection,
  context: AcpSessionContext,
  ownedSessionIdentities: Map<string, AcpSessionEventIdentity>
): Agent {
  return {
    async initialize(request: InitializeRequest): Promise<InitializeResponse> {
      return createInitializeResponse(request);
    },

    async newSession(request: AcpNewSessionRequest) {
      const response = await acpSessionManager.createSession(request, connection, context);
      const identity = await acpSessionManager.resolveSessionIdentity(response.sessionId, {
        ...context,
        agent_config: request.agent_config ?? request.agentConfig ?? context.agent_config,
      });
      ownedSessionIdentities.set(sessionKey(identity), identity);
      return response;
    },

    async loadSession(request: AcpLoadSessionRequest) {
      if (!request.sessionId) {
        throw RequestError.invalidParams({ request }, "session/load requires sessionId");
      }
      const response = await acpSessionManager.loadSession(request, connection, context);
      const identity = await resolveRequestSessionIdentity(
        ownedSessionIdentities,
        response.sessionId ?? request.sessionId,
        request as unknown as Record<string, unknown>,
        context
      );
      ownedSessionIdentities.set(sessionKey(identity), identity);
      return response;
    },

    async prompt(request: AcpPromptRequest) {
      if (!request.sessionId || !Array.isArray(request.prompt)) {
        throw RequestError.invalidParams({ request }, "session/prompt requires sessionId and prompt");
      }
      try {
        return await acpSessionManager.prompt(
          request,
          await resolveRequestSessionIdentity(ownedSessionIdentities, request.sessionId, request, context)
        ) as unknown as PromptResponse;
      } catch (error) {
        const detail = getAcpErrorDetail(error);
        throw RequestError.internalError(detail, detail.message);
      }
    },

    async cancel(request) {
      if (request.sessionId) {
        await acpSessionManager.cancelSession(
          request.sessionId,
          await resolveRequestSessionIdentity(ownedSessionIdentities, request.sessionId, request as Record<string, unknown>, context)
        );
      }
    },

    async listSessions(_request: ListSessionsRequest): Promise<ListSessionsResponse> {
      const sessions = await acpSessionManager.listSessions();
      return {
        sessions: sessions.map((session) => ({
          sessionId: session.id,
          _meta: {
            executor_type: session.agentExecutorType,
            agent_name: session.agentName,
            agent_config_path: session.agentConfigPath,
            agent_dir: session.agentDir,
          },
          executor_type: session.agentExecutorType,
          cwd: session.cwd,
          title: session.agentCapabilities._meta?.title as string | undefined,
          status: session.status,
          agent: session.agentName,
          agent_name: session.agentName,
          agent_executor_type: session.agentExecutorType,
          agent_config_path: session.agentConfigPath,
          agent_dir: session.agentDir,
          initial_prompt: session.initialPrompt,
          prompt_running: session.promptRunning,
          queue_depth: session.queueDepth,
          updatedAt: session.lastActiveAt,
          updated_at: session.lastActiveAt,
        })),
      };
    },

    async unstable_closeSession(request: CloseSessionRequest) {
      if (request.sessionId) {
        const identity = await resolveRequestSessionIdentity(
          ownedSessionIdentities,
          request.sessionId,
          request as unknown as Record<string, unknown>,
          context
        );
        await acpSessionManager.closeSession(identity.session_id, identity);
        ownedSessionIdentities.delete(sessionKey(identity));
      }
      return {};
    },

    async extMethod(method: string, params: Record<string, unknown>) {
      try {
        switch (method) {
          case "session/prompt/steer":
            return await acpSessionManager.steerPrompt(
              params as unknown as AcpSteerPromptRequest,
              await resolveOwnedSessionIdentityFromParams(ownedSessionIdentities, params, context)
            ) as unknown as Record<string, unknown>;
          case "session/prompt/cancel":
            return await acpSessionManager.cancelSteerPrompt(
              params as unknown as AcpCancelSteerPromptRequest,
              await resolveOwnedSessionIdentityFromParams(ownedSessionIdentities, params, context)
            ) as unknown as Record<string, unknown>;
          case "session/prompt/view":
            return await acpSessionManager.viewSteerPrompt(
              params as unknown as AcpViewSteerPromptRequest,
              await resolveOwnedSessionIdentityFromParams(ownedSessionIdentities, params, context)
            ) as unknown as Record<string, unknown>;
          case "session/interrupt":
            return await acpSessionManager.interruptSession(
              params as unknown as AcpInterruptSessionRequest,
              await resolveOwnedSessionIdentityFromParams(ownedSessionIdentities, params, context)
            ) as unknown as Record<string, unknown>;
          default:
            throw RequestError.methodNotFound(method);
        }
      } catch (error) {
        throw mapAcpExtensionError(error);
      }
    },

    async extNotification(method: string, params: Record<string, unknown>) {
      switch (method) {
        case "session/interrupt":
          await acpSessionManager.interruptSession(
            params as unknown as AcpInterruptSessionRequest,
            await resolveOwnedSessionIdentityFromParams(ownedSessionIdentities, params, context)
          );
          return;
        default:
          throw RequestError.methodNotFound(method);
      }
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

function resolveOwnedSessionIdentity(
  identities: Map<string, AcpSessionEventIdentity>,
  sessionId: string | undefined,
  executorType?: string
): AcpSessionEventIdentity | undefined {
  if (!sessionId) return undefined;
  if (executorType) {
    return identities.get(sessionKey({ executor_type: executorType, session_id: sessionId }));
  }
  const matches = Array.from(identities.values()).filter((identity) => identity.session_id === sessionId);
  return matches.length === 1 ? matches[0] : undefined;
}

async function resolveRequestSessionIdentity(
  identities: Map<string, AcpSessionEventIdentity>,
  sessionId: string,
  params: Record<string, unknown>,
  context: AcpSessionContext
): Promise<AcpSessionEventIdentity> {
  const agentConfig = readAgentConfigFromParams(params) ?? context.agent_config;
  const executorType = agentConfig?.executor_type;
  const owned = resolveOwnedSessionIdentity(identities, sessionId, executorType);
  if (owned) return owned;
  return await acpSessionManager.resolveSessionIdentity(sessionId, {
    ...context,
    agent_config: agentConfig,
  });
}

async function resolveOwnedSessionIdentityFromParams(
  identities: Map<string, AcpSessionEventIdentity>,
  params: Record<string, unknown>,
  context: AcpSessionContext
): Promise<AcpSessionEventIdentity | undefined> {
  const sessionId = typeof params.sessionId === "string" ? params.sessionId : undefined;
  if (!sessionId) return undefined;
  return await resolveRequestSessionIdentity(identities, sessionId, params, context);
}

function readAgentConfigFromParams(params: Record<string, unknown>): AcpSessionContext["agent_config"] | undefined {
  const value = params.agent_config ?? params.agentConfig;
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as AcpSessionContext["agent_config"]
    : undefined;
}

function mapAcpExtensionError(error: unknown): RequestError {
  if (error instanceof RequestError) return error;
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("not found")) {
    return RequestError.resourceNotFound(message);
  }
  return RequestError.internalError(
    error instanceof Error ? { message: error.message, name: error.name } : { message },
    message
  );
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

  async notifyClient(method: string, params?: Record<string, unknown>): Promise<void> {
    await this.sdkConnection.extNotification(method, params ?? {});
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

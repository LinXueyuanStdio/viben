import type { Server as HttpServer } from "node:http";
import { Server as SocketIOServer, type Socket } from "socket.io";
import { randomUUID } from "node:crypto";
import type { JSONSchema7 } from "json-schema";
import { ClientStore, type SocketSource, type ClientStoreConfig } from "./client-store";
import { logger as globalLogger } from "../telemetry";

const log = globalLogger.child({ module: "client-socket-server" });

const SOCKET_IO_PATH = "/socket.io/client";
const DEFAULT_EXECUTE_TIMEOUT_MS = 30000;
const REQUEST_ID_TTL_MS = 60000;
const MAX_PAYLOAD_SIZE = 1024 * 1024;
const RATE_LIMIT_WINDOW_MS = 1000;
const RATE_LIMIT_MAX_EVENTS = 100;

export type ExecuteSource = SocketSource | "mcp";

interface ClientConnectData {
  clientId: string;
  source: SocketSource;
  pageSlug?: string;
  publicKey: string;
  signature: string;
  timestamp: number;
}

interface RateLimitInfo {
  count: number;
  windowStart: number;
}

interface ActionRegisterData {
  namespace: string;
  actions: Record<string, {
    description: string;
    inputSchema?: JSONSchema7;
    outputSchema?: JSONSchema7;
    timeout?: number;
  }>;
}

interface ActionUnregisterData {
  namespace?: string;
}

interface ActionResultData {
  requestId: string;
  result: {
    content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
    structuredContent?: Record<string, unknown>;
    isError?: boolean;
  };
}

export interface ExecuteContext {
  sessionId: string;
  toolUseId: string;
  callerClientId?: string;
  source: ExecuteSource;
}

interface PendingExecute {
  requestId: string;
  clientId: string;
  socketId: string;
  resolve: (result: ActionResultData["result"]) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

export class ClientSocketServer {
  private io: SocketIOServer;
  private clientStore: ClientStore;
  private pendingExecutes = new Map<string, PendingExecute>();
  private seenRequestIds = new Map<string, number>();
  private rateLimits = new Map<string, RateLimitInfo>();
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(httpServer: HttpServer, clientStore: ClientStore) {
    this.clientStore = clientStore;
    this.io = new SocketIOServer(httpServer, {
      path: SOCKET_IO_PATH,
      cors: { origin: "*" },
      maxHttpBufferSize: MAX_PAYLOAD_SIZE,
    });

    this.setupEventHandlers();
    this.startCleanup();
    log.info({ path: SOCKET_IO_PATH }, "ClientSocketServer initialized");
  }

  private checkRateLimit(socketId: string): boolean {
    const now = Date.now();
    let info = this.rateLimits.get(socketId);

    if (!info || now - info.windowStart > RATE_LIMIT_WINDOW_MS) {
      info = { count: 1, windowStart: now };
      this.rateLimits.set(socketId, info);
      return true;
    }

    if (info.count >= RATE_LIMIT_MAX_EVENTS) {
      log.warn({ socketId, count: info.count }, "Rate limit exceeded");
      return false;
    }

    info.count++;
    return true;
  }

  private validatePayloadSize(payload: unknown): { valid: boolean; error?: string } {
    try {
      const payloadStr = JSON.stringify(payload);
      if (payloadStr.length > MAX_PAYLOAD_SIZE) {
        return { valid: false, error: `Payload too large: ${payloadStr.length} bytes (max: ${MAX_PAYLOAD_SIZE})` };
      }
      return { valid: true };
    } catch {
      return { valid: false, error: "Invalid payload (not serializable)" };
    }
  }

  private setupEventHandlers(): void {
    this.io.on("connection", (socket) => {
      log.debug({ socketId: socket.id }, "Socket connected");

      socket.on("client:connect", async (data: ClientConnectData, ack) => {
        if (!this.checkRateLimit(socket.id)) {
          ack?.({ success: false, error: "Rate limit exceeded" });
          return;
        }
        await this.handleClientConnect(socket, data, ack);
      });

      socket.on("action:register", (data: ActionRegisterData) => {
        if (!this.checkRateLimit(socket.id)) return;
        this.handleActionRegister(socket, data);
      });

      socket.on("action:unregister", (data: ActionUnregisterData) => {
        if (!this.checkRateLimit(socket.id)) return;
        this.handleActionUnregister(socket, data);
      });

      socket.on("action:result", (data: ActionResultData) => {
        if (!this.checkRateLimit(socket.id)) return;
        this.handleActionResult(data);
      });

      socket.on("disconnect", () => {
        this.handleDisconnect(socket);
        this.rateLimits.delete(socket.id);
      });
    });
  }

  private async handleClientConnect(
    socket: Socket,
    data: ClientConnectData,
    ack?: (response: { success: boolean; error?: string }) => void
  ): Promise<void> {
    if (!data.clientId || typeof data.clientId !== "string") {
      ack?.({ success: false, error: "clientId is required" });
      return;
    }

    if (!data.source) {
      ack?.({ success: false, error: "source is required" });
      return;
    }

    if (!data.publicKey || !data.signature || !data.timestamp) {
      ack?.({ success: false, error: "publicKey, signature, and timestamp are required" });
      return;
    }

    try {
      const client = await this.clientStore.registerClient(data.clientId, {
        source: data.source,
        socketId: socket.id,
        pageSlug: data.pageSlug,
        publicKey: data.publicKey,
        signature: data.signature,
        timestamp: data.timestamp,
      });

      (socket as Socket & { clientId?: string }).clientId = data.clientId;

      socket.join(`client:${data.clientId}`);

      const initData: { theme: string; workspacePath?: string } = {
        theme: client.metadata.theme,
      };
      if (data.source === "main_window") {
        initData.workspacePath = client.metadata.workspacePath;
      }
      socket.emit("client:init", initData);

      ack?.({ success: true });
      log.info({ clientId: data.clientId, socketId: socket.id, source: data.source }, "Client connected");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      log.warn({ clientId: data.clientId, error: message }, "Client connect failed");
      ack?.({ success: false, error: message });
    }
  }

  private handleActionRegister(socket: Socket, data: ActionRegisterData): void {
    const clientId = (socket as Socket & { clientId?: string }).clientId;
    if (!clientId) {
      log.warn({ socketId: socket.id }, "Action register without client connect");
      socket.emit("action:register:result", {
        namespace: data.namespace,
        accepted: [],
        rejected: [{ action: "*", reason: "Not connected as client" }],
      });
      return;
    }

    if (!data.namespace || typeof data.namespace !== "string") {
      log.warn({ clientId, socketId: socket.id }, "Invalid namespace");
      return;
    }

    const accepted: string[] = [];
    const rejected: Array<{ action: string; reason: string }> = [];

    for (const [name, actionDef] of Object.entries(data.actions || {})) {
      const result = this.clientStore.registerAction(clientId, socket.id, {
        namespace: data.namespace,
        name,
        description: actionDef.description,
        inputSchema: actionDef.inputSchema,
        outputSchema: actionDef.outputSchema,
        timeout: actionDef.timeout,
      });

      if (result.error) {
        rejected.push({ action: name, reason: result.error });
      } else {
        accepted.push(name);
      }
    }

    socket.emit("action:register:result", {
      namespace: data.namespace,
      accepted,
      rejected,
    });
  }

  private handleActionUnregister(socket: Socket, data: ActionUnregisterData): void {
    const clientId = (socket as Socket & { clientId?: string }).clientId;
    if (!clientId) return;

    this.clientStore.unregisterAction(clientId, data.namespace, socket.id);
  }

  private handleActionResult(data: ActionResultData): void {
    const pending = this.pendingExecutes.get(data.requestId);
    if (!pending) {
      log.debug({ requestId: data.requestId }, "Result for unknown request (possibly timed out)");
      return;
    }

    clearTimeout(pending.timer);
    this.pendingExecutes.delete(data.requestId);
    pending.resolve(data.result);
  }

  private handleDisconnect(socket: Socket): void {
    const clientId = (socket as Socket & { clientId?: string }).clientId;
    if (!clientId) return;

    for (const [requestId, pending] of this.pendingExecutes) {
      if (pending.socketId === socket.id) {
        clearTimeout(pending.timer);
        this.pendingExecutes.delete(requestId);
        pending.resolve({
          content: [{ type: "text", text: "Socket disconnected during execution" }],
          isError: true,
        });
      }
    }

    this.clientStore.removeSocket(clientId, socket.id);
    log.info({ clientId, socketId: socket.id }, "Socket disconnected");
  }

  async executeAction(
    targetClientId: string,
    namespace: string,
    actionName: string,
    payload: unknown,
    context: ExecuteContext
  ): Promise<ActionResultData["result"]> {
    const action = this.clientStore.findAction(targetClientId, namespace, actionName);
    if (!action) {
      return {
        content: [{ type: "text", text: `Action not found: ${namespace}.${actionName}` }],
        isError: true,
      };
    }

    const validation = this.validatePayloadSize(payload);
    if (!validation.valid) {
      return {
        content: [{ type: "text", text: `Invalid payload: ${validation.error}` }],
        isError: true,
      };
    }

    const client = this.clientStore.getClient(targetClientId);
    if (!client || client.sockets.size === 0) {
      return {
        content: [{ type: "text", text: `Client offline: ${targetClientId}` }],
        isError: true,
      };
    }

    const socketInfo = client.sockets.get(action.socketId);
    if (!socketInfo) {
      return {
        content: [{ type: "text", text: "Action socket disconnected" }],
        isError: true,
      };
    }

    const socket = this.io.sockets.sockets.get(action.socketId);
    if (!socket) {
      return {
        content: [{ type: "text", text: "Socket not found" }],
        isError: true,
      };
    }

    const requestId = randomUUID();

    if (this.seenRequestIds.has(requestId)) {
      return {
        content: [{ type: "text", text: "Duplicate request" }],
        isError: true,
      };
    }
    this.seenRequestIds.set(requestId, Date.now());

    const timeoutMs = action.timeout ?? DEFAULT_EXECUTE_TIMEOUT_MS;

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pendingExecutes.delete(requestId);
        resolve({
          content: [{ type: "text", text: `Execution timeout after ${timeoutMs}ms` }],
          isError: true,
        });
      }, timeoutMs);

      this.pendingExecutes.set(requestId, {
        requestId,
        clientId: targetClientId,
        socketId: action.socketId,
        resolve,
        reject: () => {},
        timer,
      });

      socket.emit("action:execute", {
        requestId,
        namespace,
        action: actionName,
        payload,
        context,
      });
    });
  }

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();

      for (const [requestId, timestamp] of this.seenRequestIds) {
        if (now - timestamp > REQUEST_ID_TTL_MS) {
          this.seenRequestIds.delete(requestId);
        }
      }

      for (const [socketId, info] of this.rateLimits) {
        if (now - info.windowStart > RATE_LIMIT_WINDOW_MS * 10) {
          this.rateLimits.delete(socketId);
        }
      }
    }, 60000);
  }

  shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    for (const pending of this.pendingExecutes.values()) {
      clearTimeout(pending.timer);
      pending.resolve({
        content: [{ type: "text", text: "Server shutdown" }],
        isError: true,
      });
    }
    this.pendingExecutes.clear();
    this.rateLimits.clear();

    this.io.close();
    log.info("ClientSocketServer shut down");
  }
}

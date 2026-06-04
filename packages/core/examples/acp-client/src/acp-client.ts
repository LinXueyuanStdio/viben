export type JsonRpcId = string | number | null;

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: JsonRpcId;
  method: string;
  params?: unknown;
}

export interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
}

export interface JsonRpcSuccess {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result: unknown;
}

export interface JsonRpcFailure {
  jsonrpc: "2.0";
  id: JsonRpcId;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export type JsonRpcFrame =
  | JsonRpcRequest
  | JsonRpcNotification
  | JsonRpcSuccess
  | JsonRpcFailure;

export interface TrafficEntry {
  id: string;
  at: string;
  direction: "in" | "out";
  type: "request" | "response" | "notification" | "unknown";
  method?: string;
  requestId?: JsonRpcId;
  payload: unknown;
  error?: boolean;
}

export interface ClientToolCall {
  id: string;
  at: string;
  toolName: string;
  toolUseId: string;
  action?: string;
  input: unknown;
  result: unknown;
}

export interface AcpSessionUpdate {
  sessionId: string;
  update: {
    sessionUpdate?: string;
    content?: { type: string; text?: string };
    toolCallId?: string;
    title?: string;
    status?: string;
    [key: string]: unknown;
  };
}

export interface AcpClientCallbacks {
  onTraffic: (entry: TrafficEntry) => void;
  onSessionUpdate: (update: AcpSessionUpdate) => void;
  onClientToolCall: (call: ClientToolCall) => void;
  executeClientTool?: (request: ClientToolExecutionRequest) => Promise<CallToolResult> | CallToolResult;
  onStatus: (status: ConnectionStatus) => void;
  onError: (message: string) => void;
}

export type ConnectionStatus = "idle" | "connecting" | "connected" | "closed" | "error";

export interface ClientToolExecutionRequest {
  sessionId: string;
  toolUseId: string;
  toolName: string;
  input: unknown;
}

export interface CallToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
  _meta?: Record<string, unknown>;
}

interface PendingRequest {
  method: string;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const DEFAULT_REQUEST_TIMEOUT_MS = 60_000;

export class AcpWebSocketClient {
  private ws: WebSocket | null = null;
  private nextId = 1;
  private pending = new Map<JsonRpcId, PendingRequest>();
  private pendingMethods = new Map<JsonRpcId, string>();
  private buffer = "";
  private status: ConnectionStatus = "idle";

  constructor(private callbacks: AcpClientCallbacks) {}

  get currentStatus(): ConnectionStatus {
    return this.status;
  }

  async connect(url: string): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    this.setStatus("connecting");

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(url, ["acp.v1"]);
      this.ws = ws;

      const timer = setTimeout(() => {
        reject(new Error(`WebSocket connect timed out: ${url}`));
        try {
          ws.close();
        } catch {
          // ignore close races
        }
      }, 15_000);

      ws.addEventListener("open", () => {
        clearTimeout(timer);
        this.setStatus("connected");
        resolve();
      });

      ws.addEventListener("message", (event) => {
        this.handleMessage(String(event.data));
      });

      ws.addEventListener("close", (event) => {
        clearTimeout(timer);
        this.rejectAll(new Error(`WebSocket closed (${event.code} ${event.reason || "no reason"})`));
        this.ws = null;
        this.setStatus(this.status === "error" ? "error" : "closed");
      });

      ws.addEventListener("error", () => {
        clearTimeout(timer);
        const error = new Error("WebSocket connection failed");
        this.rejectAll(error);
        this.callbacks.onError(error.message);
        this.setStatus("error");
        reject(error);
      });
    });
  }

  disconnect(): void {
    this.rejectAll(new Error("Client disconnected"));
    this.ws?.close(1000, "client disconnected");
    this.ws = null;
    this.setStatus("closed");
  }

  initialize(): Promise<unknown> {
    return this.request("initialize", {
      protocolVersion: 1,
      clientCapabilities: {
        fs: {
          readTextFile: false,
          writeTextFile: false,
        },
        terminal: false,
        _vibenClientTools: {
          enabled: true,
          tools: ["GUI_execute", "mcp__gui_action__GUI_execute"],
          actionRegistry: "editable",
        },
      },
      clientInfo: {
        name: "viben-core-acp-client-example",
        title: "Viben Core ACP Client Example",
        version: "0.1.0",
      },
    });
  }

  newSession(params: { cwd: string; agent_config_path?: string; agent_dir?: string }): Promise<unknown> {
    return this.request("session/new", {
      cwd: params.cwd,
      mcpServers: [],
      agent_config_path: params.agent_config_path || undefined,
      agent_dir: params.agent_dir || undefined,
    });
  }

  prompt(sessionId: string, text: string): Promise<unknown> {
    return this.request("session/prompt", {
      sessionId,
      prompt: [{ type: "text", text }],
    });
  }

  cancel(sessionId: string): void {
    this.notify("session/cancel", { sessionId });
  }

  private request(method: string, params?: unknown): Promise<unknown> {
    this.assertOpen();
    const id = this.nextId++;
    const frame: JsonRpcRequest = {
      jsonrpc: "2.0",
      id,
      method,
      params: params ?? {},
    };

    this.pendingMethods.set(id, method);
    this.recordTraffic("out", frame);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        this.pendingMethods.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, DEFAULT_REQUEST_TIMEOUT_MS);

      this.pending.set(id, { method, resolve, reject, timer });
      this.send(frame);
    });
  }

  private notify(method: string, params?: unknown): void {
    this.assertOpen();
    const frame: JsonRpcNotification = {
      jsonrpc: "2.0",
      method,
      params: params ?? {},
    };
    this.recordTraffic("out", frame);
    this.send(frame);
  }

  private send(frame: JsonRpcFrame): void {
    this.ws?.send(`${JSON.stringify(frame)}\n`);
  }

  private handleMessage(chunk: string): void {
    this.buffer = splitFrames(this.buffer + chunk, (frame) => this.handleFrame(frame));
  }

  private handleFrame(frame: JsonRpcFrame): void {
    this.recordTraffic("in", frame);

    if (isResponse(frame)) {
      const pending = this.pending.get(frame.id);
      this.pendingMethods.delete(frame.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(frame.id);
      if ("error" in frame) {
        pending.reject(new Error(frame.error.message));
      } else {
        pending.resolve(frame.result);
      }
      return;
    }

    if (isRequest(frame)) {
      void this.handleServerRequest(frame).catch((error) => {
        const response: JsonRpcFailure = {
          jsonrpc: "2.0",
          id: frame.id,
          error: {
            code: -32603,
            message: error instanceof Error ? error.message : String(error),
          },
        };
        this.recordTraffic("out", response, frame.method);
        this.send(response);
      });
      return;
    }

    if (isNotification(frame) && frame.method === "session/update") {
      this.callbacks.onSessionUpdate(frame.params as AcpSessionUpdate);
    }
  }

  private async handleServerRequest(frame: JsonRpcRequest): Promise<void> {
    if (frame.method === "_viben/client_tool_call") {
      const params = frame.params as {
        sessionId?: string;
        toolName?: string;
        toolUseId?: string;
        input?: unknown;
      };
      const toolName = params?.toolName ?? "client tool";
      const toolUseId = params?.toolUseId ?? "unknown id";
      const sessionId = params?.sessionId ?? "unknown session";
      const input = params?.input ?? null;
      const result = await this.executeClientTool({
        sessionId,
        toolName,
        toolUseId,
        input,
      });
      const response: JsonRpcSuccess = { jsonrpc: "2.0", id: frame.id, result };
      this.recordTraffic("out", response, frame.method);
      this.send(response);
      this.callbacks.onClientToolCall({
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        at: new Date().toISOString(),
        toolName,
        toolUseId,
        action: readGuiAction(input),
        input,
        result,
      });
      return;
    }

    const response: JsonRpcFailure = {
      jsonrpc: "2.0",
      id: frame.id,
      error: {
        code: -32601,
        message: `Method not found: ${frame.method}`,
      },
    };
    this.recordTraffic("out", response, frame.method);
    this.send(response);
  }

  private async executeClientTool(request: ClientToolExecutionRequest): Promise<CallToolResult> {
    if (this.callbacks.executeClientTool) {
      try {
        return await this.callbacks.executeClientTool(request);
      } catch (error) {
        return {
          content: [{ type: "text", text: `execution_error: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }

    return {
      content: [
        {
          type: "text",
          text: `Example client handled ${request.toolName} (${request.toolUseId}).`,
        },
      ],
      _meta: {
        echoedInput: request.input,
      },
    };
  }

  private assertOpen(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("ACP WebSocket is not connected");
    }
  }

  private rejectAll(error: Error): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
    this.pendingMethods.clear();
  }

  private recordTraffic(direction: TrafficEntry["direction"], frame: JsonRpcFrame, fallbackMethod?: string): void {
    this.callbacks.onTraffic({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      at: new Date().toISOString(),
      direction,
      type: classifyFrame(frame),
      method: getFrameMethod(frame, this.pendingMethods) ?? fallbackMethod,
      requestId: "id" in frame ? frame.id : undefined,
      payload: frame,
      error: "error" in frame,
    });
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    this.callbacks.onStatus(status);
  }
}

function splitFrames(buffer: string, onFrame: (frame: JsonRpcFrame) => void): string {
  if (!buffer.includes("\n")) {
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
    if (trimmed) parseFrame(trimmed, onFrame);
  }
  return rest;
}

function parseFrame(text: string, onFrame: (frame: JsonRpcFrame) => void): void {
  try {
    onFrame(JSON.parse(text) as JsonRpcFrame);
  } catch (error) {
    console.error("Failed to parse ACP frame", error, text);
  }
}

function isResponse(frame: JsonRpcFrame): frame is JsonRpcSuccess | JsonRpcFailure {
  return "id" in frame && !("method" in frame) && ("result" in frame || "error" in frame);
}

function isRequest(frame: JsonRpcFrame): frame is JsonRpcRequest {
  return "id" in frame && "method" in frame;
}

function isNotification(frame: JsonRpcFrame): frame is JsonRpcNotification {
  return !("id" in frame) && "method" in frame;
}

function classifyFrame(frame: JsonRpcFrame): TrafficEntry["type"] {
  if (isResponse(frame)) return "response";
  if (isRequest(frame)) return "request";
  if (isNotification(frame)) return "notification";
  return "unknown";
}

function getFrameMethod(frame: JsonRpcFrame, pendingMethods: Map<JsonRpcId, string>): string | undefined {
  if ("method" in frame) return frame.method;
  if ("id" in frame) return pendingMethods.get(frame.id);
  return undefined;
}

function readGuiAction(input: unknown): string | undefined {
  if (typeof input !== "object" || input === null) return undefined;
  const action = (input as { action?: unknown }).action;
  return typeof action === "string" ? action : undefined;
}

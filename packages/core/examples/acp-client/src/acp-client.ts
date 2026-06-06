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
  sessionId?: string;
  durationMs?: number;
  payloadSize: number;
  summary: string;
  payload: unknown;
  error?: boolean;
}

export interface ClientToolCall {
  id: string;
  at: string;
  sessionId: string;
  toolName: string;
  toolCallId: string;
  action?: string;
  input: unknown;
  result: unknown;
}

export interface PermissionRequestLog {
  id: string;
  at: string;
  sessionId: string;
  toolCallId: string;
  title: string;
  selectedOptionId: string;
  options: unknown[];
  rawInput: unknown;
}

export interface ElicitationRequestLog {
  id: string;
  at: string;
  sessionId: string;
  message: string;
  action: unknown;
  rawInput: unknown;
}

export interface AcpSessionUpdate {
  sessionId: string;
  update: {
    sessionUpdate?: string;
    content?: { type: string; text?: string };
    error?: unknown;
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
  onPermissionRequest: (request: PermissionRequestLog) => void;
  onElicitationRequest: (request: ElicitationRequestLog) => void;
  onSteerPromptConsumed: (result: ConsumedSteerPromptResult) => void;
  executeClientTool?: (request: ClientToolExecutionRequest) => Promise<CallToolResult> | CallToolResult;
  requestClientToolResult?: (request: ClientToolExecutionRequest, draft: CallToolResult) => Promise<CallToolResult>;
  requestPermissionDecision?: (request: PermissionDecisionRequest) => Promise<PermissionDecisionResult>;
  requestElicitationResponse?: (request: ElicitationRequest) => Promise<ElicitationResponse>;
  onStatus: (status: ConnectionStatus) => void;
  onError: (message: string) => void;
}

export type ConnectionStatus = "idle" | "connecting" | "connected" | "closed" | "error";

export interface ClientToolExecutionRequest {
  sessionId: string;
  toolCallId: string;
  toolName: string;
  input: unknown;
}

export interface PermissionDecisionRequest {
  sessionId: string;
  toolCallId: string;
  title: string;
  options: PermissionOption[];
  rawInput: unknown;
}

export interface PermissionOption {
  optionId?: string;
  kind?: string;
  name?: string;
  [key: string]: unknown;
}

export type PermissionDecisionResult =
  | { outcome: "selected"; optionId: string }
  | { outcome: "cancelled" };

export interface ElicitationRequest {
  sessionId: string;
  message: string;
  mode: "form" | "url";
  requestedSchema?: ElicitationSchema;
  elicitationId?: string;
  url?: string;
  rawInput: unknown;
}

export interface ElicitationSchema {
  title?: string | null;
  description?: string | null;
  type?: "object";
  properties?: Record<string, ElicitationPropertySchema>;
  required?: string[] | null;
}

export interface ElicitationPropertySchema {
  type?: "string" | "number" | "integer" | "boolean" | "array";
  title?: string | null;
  description?: string | null;
  default?: string | number | boolean | string[] | null;
  enum?: string[] | null;
  oneOf?: Array<{ const: string; title: string }> | null;
  items?: {
    enum?: string[];
    anyOf?: Array<{ const: string; title: string }>;
  };
}

export type ElicitationContentValue = string | number | boolean | string[];

export type ElicitationResponse =
  | { action: { action: "accept"; content?: Record<string, ElicitationContentValue> | null } }
  | { action: { action: "decline" } }
  | { action: { action: "cancel" } };

export type CallToolContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

export interface CallToolResult {
  content: CallToolContentBlock[];
  isError?: boolean;
  _meta?: Record<string, unknown>;
}

export interface AgentConfigPayload {
  executor_type?: string;
  model?: string;
  permission_mode?: string;
  append_prompt?: string;
  mcp_servers?: unknown[];
  executor_config?: Record<string, unknown>;
}

export interface SessionCreateParams {
  cwd: string;
  agent_config_path?: string;
  agent_dir?: string;
  agent_config?: AgentConfigPayload;
  mcpServers?: unknown[];
}

export interface SessionLoadParams {
  session_id: string;
  cwd?: string;
  agent_config?: AgentConfigPayload;
  mcpServers?: unknown[];
}

export interface SteerPromptParams {
  sessionId: string;
  text: string;
  agentId?: string;
  userId?: string;
  meta?: Record<string, unknown>;
}

export interface SteerPromptResult {
  promptId: string;
  sessionId: string;
  agentId: string;
  userId: string;
  status: string;
  createdAt: string;
}

export interface CancelSteerPromptResult {
  promptId: string;
  cancelled: boolean;
  status: string;
  consumedAt?: string;
  cancelledAt?: string;
}

export interface ConsumedSteerPromptResult {
  sessionId: string;
  promptId: string;
  status: string;
  consumedAt?: string;
}

export interface InterruptSessionResult {
  interrupted: boolean;
  resumed: boolean;
  promptIds: string[];
}

export interface SteerPromptView {
  promptId: string;
  sessionId: string;
  agentId: string;
  userId: string;
  prompt: unknown[];
  status: string;
  createdAt: string;
  consumedAt?: string;
  cancelledAt?: string;
  completedAt?: string;
  error?: string;
  meta?: Record<string, unknown>;
}

export type ViewSteerPromptResult =
  | { prompt: SteerPromptView }
  | { prompts: SteerPromptView[]; nextCursor: string | null };

interface PendingRequest {
  method: string;
  startedAt: number;
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
        elicitation: {
          form: {},
          url: {},
        },
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

  newSession(params: SessionCreateParams): Promise<unknown> {
    return this.request("session/new", {
      cwd: params.cwd,
      mcpServers: params.mcpServers ?? [],
      agent_config_path: params.agent_config_path || undefined,
      agent_dir: params.agent_dir || undefined,
      agent_config: params.agent_config,
    });
  }

  loadSession(params: SessionLoadParams): Promise<unknown> {
    return this.request("session/load", {
      sessionId: params.session_id,
      cwd: params.cwd || undefined,
      mcpServers: params.mcpServers ?? [],
      agent_config: params.agent_config,
    });
  }

  prompt(sessionId: string, text: string): Promise<unknown> {
    return this.request("session/prompt", {
      sessionId,
      prompt: [{ type: "text", text }],
    });
  }

  async steerPrompt(params: SteerPromptParams): Promise<SteerPromptResult> {
    return await this.request("session/prompt/steer", {
      sessionId: params.sessionId,
      agentId: params.agentId || undefined,
      userId: params.userId || undefined,
      prompt: [{ type: "text", text: params.text }],
      meta: params.meta,
    }) as SteerPromptResult;
  }

  async cancelSteerPrompt(sessionId: string, promptId: string): Promise<CancelSteerPromptResult> {
    return await this.request("session/prompt/cancel", { sessionId, promptId }) as CancelSteerPromptResult;
  }

  async viewSteerPrompt(sessionId: string, promptId?: string): Promise<ViewSteerPromptResult> {
    return await this.request("session/prompt/view", {
      sessionId,
      promptId: promptId || undefined,
    }) as ViewSteerPromptResult;
  }

  listSessions(): Promise<unknown> {
    return this.request("session/list", {});
  }

  closeSession(sessionId: string): Promise<unknown> {
    return this.request("session/close", { sessionId });
  }

  cancel(sessionId: string): void {
    this.notify("session/cancel", { sessionId });
  }

  async interrupt(sessionId: string): Promise<InterruptSessionResult> {
    return await this.request("session/interrupt", { sessionId }) as InterruptSessionResult;
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

      this.pending.set(id, { method, startedAt: Date.now(), resolve, reject, timer });
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
        pending.reject(new Error(formatJsonRpcError(frame.error)));
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
      const params = frame.params as AcpSessionUpdate;
      this.callbacks.onSessionUpdate(params);
      const consumed = steerConsumedFromSessionUpdate(params);
      if (consumed) this.callbacks.onSteerPromptConsumed(consumed);
      return;
    }

    if (isNotification(frame) && frame.method === "session/prompt/consumed") {
      const consumed = steerConsumedFromParams(frame.params);
      if (consumed) this.callbacks.onSteerPromptConsumed(consumed);
    }
  }

  private async handleServerRequest(frame: JsonRpcRequest): Promise<void> {
    if (frame.method === "_viben/client_tool_call") {
      const params = frame.params as {
        sessionId?: string;
        toolName?: string;
        toolCallId?: string;
        input?: unknown;
      };
      const toolName = params?.toolName ?? "client tool";
      const toolCallId = params?.toolCallId ?? "unknown id";
      const sessionId = params?.sessionId ?? "unknown session";
      const input = params?.input ?? null;
      const request = {
        sessionId,
        toolName,
        toolCallId,
        input,
      };
      this.callbacks.onClientToolCall({
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        at: new Date().toISOString(),
        sessionId,
        toolName,
        toolCallId,
        action: readGuiAction(input),
        input,
        result: { pending: true },
      });
      const draft = await this.executeClientTool(request);
      const result = this.callbacks.requestClientToolResult
        ? await this.callbacks.requestClientToolResult(request, draft)
        : draft;
      const response: JsonRpcSuccess = {
        jsonrpc: "2.0",
        id: frame.id,
        result: {
          sessionId,
          toolCallId,
          result,
        },
      };
      this.recordTraffic("out", response, frame.method);
      this.send(response);
      this.callbacks.onClientToolCall({
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        at: new Date().toISOString(),
        sessionId,
        toolName,
        toolCallId,
        action: readGuiAction(input),
        input,
        result,
      });
      return;
    }

    if (frame.method === "session/request_permission") {
      const params = frame.params as {
        sessionId?: string;
        toolCall?: {
          toolCallId?: string;
          title?: string;
          rawInput?: unknown;
        };
        options?: PermissionOption[];
      };
      const request: PermissionDecisionRequest = {
        sessionId: params.sessionId ?? "unknown session",
        toolCallId: params.toolCall?.toolCallId ?? "unknown tool call",
        title: params.toolCall?.title ?? "Permission request",
        options: params.options ?? [],
        rawInput: params.toolCall?.rawInput ?? null,
      };
      const decision = this.callbacks.requestPermissionDecision
        ? await this.callbacks.requestPermissionDecision(request)
        : selectPermissionOption(request.options);
      const response: JsonRpcSuccess = {
        jsonrpc: "2.0",
        id: frame.id,
        result: {
          outcome: decision.outcome === "cancelled"
            ? { outcome: "cancelled" }
            : { outcome: "selected", optionId: decision.optionId },
        },
      };
      this.recordTraffic("out", response, frame.method);
      this.send(response);
      this.callbacks.onPermissionRequest({
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        at: new Date().toISOString(),
        sessionId: request.sessionId,
        toolCallId: request.toolCallId,
        title: request.title,
        selectedOptionId: decision.outcome === "selected" ? decision.optionId : "cancelled",
        options: request.options,
        rawInput: request.rawInput,
      });
      return;
    }

    if (frame.method === "session/elicitation") {
      const params = frame.params as {
        sessionId?: string;
        message?: string;
        mode?: "form" | "url";
        requestedSchema?: ElicitationSchema;
        elicitationId?: string;
        url?: string;
      };
      const request: ElicitationRequest = {
        sessionId: params.sessionId ?? "unknown session",
        message: params.message ?? "Agent needs input",
        mode: params.mode === "url" ? "url" : "form",
        requestedSchema: params.requestedSchema,
        elicitationId: params.elicitationId,
        url: params.url,
        rawInput: frame.params ?? null,
      };
      const result = this.callbacks.requestElicitationResponse
        ? await this.callbacks.requestElicitationResponse(request)
        : { action: { action: "cancel" as const } };
      const response: JsonRpcSuccess = { jsonrpc: "2.0", id: frame.id, result };
      this.recordTraffic("out", response, frame.method);
      this.send(response);
      this.callbacks.onElicitationRequest({
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        at: new Date().toISOString(),
        sessionId: request.sessionId,
        message: request.message,
        action: result.action,
        rawInput: request.rawInput,
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
          text: `Example client handled ${request.toolName} (${request.toolCallId}).`,
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
    const payloadText = safeJson(frame);
    const pending = "id" in frame ? this.pending.get(frame.id) : undefined;
    this.callbacks.onTraffic({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      at: new Date().toISOString(),
      direction,
      type: classifyFrame(frame),
      method: getFrameMethod(frame, this.pendingMethods) ?? fallbackMethod,
      requestId: "id" in frame ? frame.id : undefined,
      sessionId: readFrameSessionId(frame),
      durationMs: isResponse(frame) && pending ? Date.now() - pending.startedAt : undefined,
      payloadSize: payloadText.length,
      summary: summarizeFrame(frame),
      payload: frame,
      error: "error" in frame,
    });
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    this.callbacks.onStatus(status);
  }
}

function formatJsonRpcError(error: JsonRpcFailure["error"]): string {
  if (error.data === undefined) return error.message;
  return `${error.message}\n${JSON.stringify(error.data, null, 2)}`;
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

function readFrameSessionId(frame: JsonRpcFrame): string | undefined {
  if (!("params" in frame) || typeof frame.params !== "object" || frame.params === null) return undefined;
  const params = frame.params as { sessionId?: unknown; session_id?: unknown };
  if (typeof params.sessionId === "string") return params.sessionId;
  if (typeof params.session_id === "string") return params.session_id;
  return undefined;
}

function summarizeFrame(frame: JsonRpcFrame): string {
  if (isRequest(frame)) return frame.method;
  if (isNotification(frame)) {
    const update = typeof frame.params === "object" && frame.params !== null
      ? (frame.params as { update?: { sessionUpdate?: unknown } }).update
      : undefined;
    return typeof update?.sessionUpdate === "string" ? `${frame.method}: ${update.sessionUpdate}` : frame.method;
  }
  if ("error" in frame) return frame.error.message;
  if ("result" in frame && typeof frame.result === "object" && frame.result !== null) {
    const result = frame.result as { stopReason?: unknown; sessionId?: unknown };
    if (typeof result.stopReason === "string") return `stopReason: ${result.stopReason}`;
    if (typeof result.sessionId === "string") return `sessionId: ${result.sessionId}`;
  }
  return "response";
}

function steerConsumedFromSessionUpdate(notification: AcpSessionUpdate): ConsumedSteerPromptResult | null {
  const update = notification.update;
  if (update.sessionUpdate !== "steer_consumed") return null;
  const promptId = typeof update.promptId === "string" ? update.promptId : undefined;
  if (!promptId) return null;
  const status = typeof update.status === "string" ? update.status : "consumed";
  return {
    sessionId: notification.sessionId,
    promptId,
    status,
    consumedAt: typeof update.consumedAt === "string" ? update.consumedAt : undefined,
  };
}

function steerConsumedFromParams(params: unknown): ConsumedSteerPromptResult | null {
  if (typeof params !== "object" || params === null) return null;
  const value = params as Record<string, unknown>;
  const sessionId = typeof value.sessionId === "string"
    ? value.sessionId
    : typeof value.session_id === "string"
      ? value.session_id
      : undefined;
  const promptId = typeof value.promptId === "string"
    ? value.promptId
    : typeof value.prompt_id === "string"
      ? value.prompt_id
      : undefined;
  if (!sessionId || !promptId) return null;
  const status = typeof value.status === "string" ? value.status : "consumed";
  return {
    sessionId,
    promptId,
    status,
    consumedAt: typeof value.consumedAt === "string"
      ? value.consumedAt
      : typeof value.consumed_at === "string"
        ? value.consumed_at
        : undefined,
  };
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function readGuiAction(input: unknown): string | undefined {
  if (typeof input !== "object" || input === null) return undefined;
  const action = (input as { action?: unknown }).action;
  return typeof action === "string" ? action : undefined;
}

function selectPermissionOption(options: PermissionOption[]): PermissionDecisionResult {
  const selected = options.find((option) => option.kind === "allow_always")
    ?? options.find((option) => option.kind === "allow_once")
    ?? options.find((option) => String(option.optionId ?? option.name ?? "").toLowerCase().includes("allow"))
    ?? options[0];
  return { outcome: "selected", optionId: selected?.optionId ?? selected?.name ?? "allow" };
}

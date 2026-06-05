import { randomUUID } from "node:crypto";
import * as os from "node:os";
import * as path from "node:path";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { readMarkdownConfig } from "../../config/markdown";
import type { AgentConfigFile } from "../../agents";
import { clientToolCompletionRegistry } from "../../services/client-tool-completion";
import { sessionStoreService } from "../../services/session-store";
import { logger as globalLogger } from "../../telemetry";
import type {
  AcpAgentCapabilities,
  AcpClientToolCallResponse,
  AcpConfigOption,
  AcpConnection,
  AcpContentBlock,
  AcpErrorDetail,
  AcpLoadSessionRequest,
  AcpLoadSessionResponse,
  AcpMcpServer,
  AcpNewSessionRequest,
  AcpNewSessionResponse,
  AcpCancelSteerPromptRequest,
  AcpCancelSteerPromptResponse,
  AcpPromptRequest,
  AcpPromptResponse,
  AcpSandboxConfig,
  AcpSessionContext,
  AcpSessionStatus,
  AcpSessionSummary,
  AcpSteerPromptRecord,
  AcpSteerPromptConsumedNotification,
  AcpSteerPromptRequest,
  AcpSteerPromptResponse,
  AcpSteerPromptView,
  AcpViewSteerPromptRequest,
  AcpViewSteerPromptResponse,
  AgentConfigPayload,
} from "../types";
import { AcpPromptError, createAcpErrorDetail, getAcpErrorDetail } from "./errors";
import {
  createDefaultAcpBackendAdapter,
  type AcpBackendAdapter,
  type AcpBackendSession,
} from "./backend-adapter";
import {
  createDefaultAcpSteerPromptStore,
  type AcpSteerPromptStore,
} from "./steer-prompt-store";

const log = globalLogger.child({ module: "acp-session-manager" });

const DEFAULT_AGENT_CAPABILITIES: AcpAgentCapabilities = {
  loadSession: true,
  modes: false,
  sessionCapabilities: {
    list: {},
  },
};

interface AcpPromptQueueItem {
  request: AcpPromptRequest;
  resolve: (response: AcpPromptResponse) => void;
  reject: (error: Error) => void;
}

interface AcpSession {
  id: string;
  status: AcpSessionStatus;
  cwd: string;
  created_at: Date;
  last_active_at: Date;
  agent_config_path?: string;
  agent_dir?: string;
  persist_session_id?: string;
  persist_task_id?: string;
  agent_config?: AgentConfigPayload;
  sandbox_config?: AcpSandboxConfig;
  mcp_servers: AcpMcpServer[];
  connection: AcpConnection;
  gateway_url?: string;
  backend?: AcpBackendSession;
  backend_load_session_id?: string;
  prompt_running: boolean;
  prompt_queue: AcpPromptQueueItem[];
  sdk_session_id?: string;
  last_error?: AcpErrorDetail;
  config_options?: AcpConfigOption[];
  agent_capabilities: AcpAgentCapabilities;
}

export class AcpSessionManager {
  private sessions = new Map<string, AcpSession>();
  private backendAdapter: AcpBackendAdapter;
  private steerPromptStore: AcpSteerPromptStore;

  constructor(
    backendAdapter: AcpBackendAdapter = createDefaultAcpBackendAdapter(),
    steerPromptStore: AcpSteerPromptStore = createDefaultAcpSteerPromptStore()
  ) {
    this.backendAdapter = backendAdapter;
    this.steerPromptStore = steerPromptStore;
  }

  getSession(sessionId: string): AcpSessionSummary | undefined {
    const session = this.sessions.get(sessionId);
    return session ? toSummary(session) : undefined;
  }

  listSessions(): AcpSessionSummary[] {
    return Array.from(this.sessions.values()).map((session) => toSummary(session));
  }

  async createSession(
    request: AcpNewSessionRequest,
    connection: AcpConnection,
    context: AcpSessionContext = {}
  ): Promise<AcpNewSessionResponse> {
    const sessionId = randomUUID();
    const session = await this.createSessionRecord(sessionId, request, connection, context);
    this.sessions.set(sessionId, session);
    log.info({ sessionId, cwd: session.cwd, agentConfigPath: session.agent_config_path }, "ACP session created");

    return {
      sessionId,
      configOptions: session.config_options,
    };
  }

  private async createSessionRecord(
    sessionId: string,
    request: AcpNewSessionRequest,
    connection: AcpConnection,
    context: AcpSessionContext
  ): Promise<AcpSession> {
    const agentConfigPath = request.agent_config_path ?? request.agentConfigPath ?? context.agent_config_path;
    const inlineConfig = request.agent_config ?? request.agentConfig ?? context.agent_config;
    const agentConfig = await resolveAgentConfig(agentConfigPath, inlineConfig);
    const cwd = resolveCwd(request.cwd ?? context.cwd ?? process.cwd());

    const session: AcpSession = {
      id: sessionId,
      status: "initializing",
      cwd,
      created_at: new Date(),
      last_active_at: new Date(),
      agent_config_path: agentConfigPath,
      agent_dir: request.agent_dir ?? request.agentDir ?? context.agent_dir,
      persist_session_id:
        request.persist_session_id ??
        request.persistSessionId ??
        context.session_id,
      persist_task_id:
        request.persist_task_id ??
        request.persistTaskId ??
        context.task_id,
      agent_config: agentConfig ?? undefined,
      sandbox_config:
        request.sandbox_config ??
        request.sandboxConfig ??
        context.sandbox_config,
      mcp_servers: request.mcpServers ?? [],
      connection,
      gateway_url: request.gateway_url ?? request.gatewayUrl ?? context.gateway_url,
      prompt_running: false,
      prompt_queue: [],
      agent_capabilities: DEFAULT_AGENT_CAPABILITIES,
    };
    return session;
  }

  async requestClientTool(
    sessionId: string,
    toolName: string,
    input: unknown,
    toolUseId: string = randomUUID()
  ): Promise<CallToolResult> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return {
        content: [{ type: "text", text: `ACP session not found: ${sessionId}` }],
        isError: true,
      };
    }

    clientToolCompletionRegistry.registerToolOptions("GUI_execute", { timeoutMs: 60_000 });
    clientToolCompletionRegistry.enqueue(session.id, toolUseId, toolName);
    const result = clientToolCompletionRegistry.waitForClient(session.id, toolUseId, toolName);
    await this.dispatchClientToolRequest(session, toolUseId, toolName, input);
    return await result;
  }

  async loadSession(
    request: AcpLoadSessionRequest,
    connection: AcpConnection,
    context: AcpSessionContext = {}
  ): Promise<AcpLoadSessionResponse> {
    const existing = this.sessions.get(request.sessionId);
    if (existing) {
      existing.connection = connection;
      existing.last_active_at = new Date();
      if (!existing.backend) {
        existing.backend_load_session_id = request.sessionId;
      }
      return {
        sessionId: existing.id,
        configOptions: existing.config_options,
      };
    }

    const session = await this.createSessionRecord(
      request.sessionId,
      {
        cwd: request.cwd,
        mcpServers: request.mcpServers ?? [],
        agent_config_path: request.agent_config_path ?? request.agentConfigPath ?? context.agent_config_path,
        agent_dir: request.agent_dir ?? request.agentDir ?? context.agent_dir,
        agent_config: request.agent_config ?? request.agentConfig ?? context.agent_config,
        persist_session_id: request.persist_session_id ?? request.persistSessionId ?? context.session_id,
        persist_task_id: request.persist_task_id ?? request.persistTaskId ?? context.task_id,
        sandbox_config: request.sandbox_config ?? request.sandboxConfig ?? context.sandbox_config,
      },
      connection,
      context
    );
    session.backend_load_session_id = request.sessionId;
    this.sessions.set(request.sessionId, session);
    log.info({ sessionId: request.sessionId, cwd: session.cwd }, "ACP session loaded as new live session");

    return {
      sessionId: request.sessionId,
      configOptions: session.config_options,
    };
  }

  async prompt(request: AcpPromptRequest): Promise<AcpPromptResponse> {
    const session = this.sessions.get(request.sessionId);
    if (!session) {
      throw new Error(`ACP session not found: ${request.sessionId}`);
    }

    return new Promise<AcpPromptResponse>((resolve, reject) => {
      const item: AcpPromptQueueItem = { request, resolve, reject };
      if (session.prompt_running) {
        session.prompt_queue.push(item);
        log.debug({ sessionId: session.id, queueDepth: session.prompt_queue.length }, "ACP prompt queued");
        return;
      }
      this.runPromptItem(session, item).catch(reject);
    });
  }

  async steerPrompt(request: AcpSteerPromptRequest): Promise<AcpSteerPromptResponse> {
    const session = this.requireSession(request.sessionId);
    if (!Array.isArray(request.prompt) || request.prompt.length === 0) {
      throw new Error("session/prompt/steer requires prompt");
    }

    const record = await this.steerPromptStore.create({
      session_id: session.id,
      agent_id: request.agent_id ?? request.agentId ?? resolveAgentId(session.agent_config_path, session.agent_config),
      user_id: request.user_id ?? request.userId ?? "default",
      prompt_json: request.prompt,
      meta_json: request.meta ?? request._meta,
    });
    session.last_active_at = new Date();
    log.debug({ sessionId: session.id, promptId: record.id }, "ACP steer prompt queued");
    return steerRecordToResponse(record);
  }

  async cancelSteerPrompt(request: AcpCancelSteerPromptRequest): Promise<AcpCancelSteerPromptResponse> {
    this.requireSession(request.sessionId);
    const record = await this.steerPromptStore.cancel(request.sessionId, request.promptId);
    if (!record) {
      throw new Error(`ACP steer prompt not found: ${request.promptId}`);
    }
    return {
      promptId: record.id,
      cancelled: record.status === "cancelled",
      status: record.status,
      consumedAt: record.consumed_at,
      cancelledAt: record.cancelled_at,
    };
  }

  async viewSteerPrompt(request: AcpViewSteerPromptRequest): Promise<AcpViewSteerPromptResponse> {
    this.requireSession(request.sessionId);
    if (request.promptId) {
      const record = await this.steerPromptStore.get(request.sessionId, request.promptId);
      if (!record) {
        throw new Error(`ACP steer prompt not found: ${request.promptId}`);
      }
      return { prompt: steerRecordToView(record) };
    }

    const limit = normalizeSteerLimit(request.limit);
    const cursorOffset = parseSteerCursor(request.cursor);
    const records = await this.steerPromptStore.list({
      session_id: request.sessionId,
      agent_id: request.agent_id ?? request.agentId,
      user_id: request.user_id ?? request.userId,
      status: request.status,
      limit,
      cursor: request.cursor,
    });
    const total = this.steerPromptStore.count
      ? await this.steerPromptStore.count({
        session_id: request.sessionId,
        agent_id: request.agent_id ?? request.agentId,
        user_id: request.user_id ?? request.userId,
        status: request.status,
      })
      : records.length;
    const nextOffset = cursorOffset + records.length;
    return {
      prompts: records.map((record) => steerRecordToView(record)),
      nextCursor: nextOffset < total ? String(nextOffset) : null,
    };
  }

  async consumeNextSteerPrompt(sessionId: string): Promise<AcpSteerPromptView | undefined> {
    const session = this.requireSession(sessionId);
    const record = await this.steerPromptStore.consumeNext(sessionId);
    if (!record) return undefined;
    await this.dispatchSteerConsumed(session, record);
    return steerRecordToView(record);
  }

  async consumeQueuedSteerPrompts(sessionId: string): Promise<AcpSteerPromptView[]> {
    const session = this.requireSession(sessionId);
    const records = await this.steerPromptStore.consumeQueued(sessionId);
    for (const record of records) {
      await this.dispatchSteerConsumed(session, record);
    }
    return records.map((record) => steerRecordToView(record));
  }

  async markSteerPromptCompleted(sessionId: string, promptId: string): Promise<AcpSteerPromptView | undefined> {
    const session = this.requireSession(sessionId);
    const record = await this.steerPromptStore.markCompleted(sessionId, promptId);
    if (!record) return undefined;
    await this.dispatchSteerUpdate(session, record, "steer_completed");
    return steerRecordToView(record);
  }

  async markSteerPromptFailed(sessionId: string, promptId: string, error: string): Promise<AcpSteerPromptView | undefined> {
    const session = this.requireSession(sessionId);
    const record = await this.steerPromptStore.markFailed(sessionId, promptId, error);
    if (!record) return undefined;
    await this.dispatchSteerUpdate(session, record, "steer_failed");
    return steerRecordToView(record);
  }

  async cancelSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.status = "cancelled";
    for (const item of session.prompt_queue.splice(0)) {
      item.resolve({ stopReason: "cancelled" });
    }

    clientToolCompletionRegistry.cancelSession(sessionId);
    if (session.backend) {
      try {
        await session.backend.cancel();
      } catch {
        // The backend may already be ending its current prompt.
      }
    }
    log.info({ sessionId }, "ACP session cancelled");
    return true;
  }

  closeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    if (session.prompt_running) {
      clientToolCompletionRegistry.cancelSession(sessionId);
    }
    void session.backend?.close().catch((error) => {
      log.debug({ err: error, sessionId }, "ACP backend close failed");
    });
    for (const item of session.prompt_queue.splice(0)) {
      item.resolve({ stopReason: "cancelled" });
    }
    this.sessions.delete(sessionId);
    log.info({ sessionId }, "ACP session closed");
  }

  closeAll(): void {
    for (const sessionId of this.sessions.keys()) {
      this.closeSession(sessionId);
    }
  }

  private async runPromptItem(session: AcpSession, item: AcpPromptQueueItem): Promise<void> {
    session.prompt_running = true;
    session.status = "active";
    session.last_active_at = new Date();
    session.last_error = undefined;

    try {
      const response = await this.executePrompt(session, item.request);
      item.resolve(response);
    } catch (error) {
      session.status = "error";
      const detail = getAcpErrorDetail(error);
      session.last_error = detail;
      await this.dispatchErrorUpdate(session, detail);
      await this.persistUiMessage(session, {
        type: "error",
        content: detail.message,
        isError: true,
      });
      item.reject(new AcpPromptError(detail));
    } finally {
      session.prompt_running = false;

      const next = session.prompt_queue.shift();
      if (next) {
        this.runPromptItem(session, next).catch((error) => next.reject(error));
      } else if (session.status === "active") {
        session.status = "finished";
      }
    }
  }

  private async executePrompt(
    session: AcpSession,
    request: AcpPromptRequest
  ): Promise<AcpPromptResponse> {
    const prompt = promptBlocksToText(request.prompt);
    if (!prompt.trim()) {
      throw new Error("Prompt is required");
    }
    await this.persistUiMessage(session, {
      type: "user",
      content: prompt,
    });

    const backend = await this.ensureBackend(session, request);
    const response = await backend.prompt({
      ...request,
      sessionId: backend.backendSessionId,
    });

    if (session.status === "cancelled") {
      return { stopReason: "cancelled" };
    }
    return response as AcpPromptResponse;
  }

  private async ensureBackend(
    session: AcpSession,
    request: AcpPromptRequest
  ): Promise<AcpBackendSession> {
    if (session.backend) return session.backend;

    const startRequest: AcpNewSessionRequest | AcpLoadSessionRequest = {
      cwd: session.cwd,
      mcpServers: session.mcp_servers,
      ...(session.backend_load_session_id ? { sessionId: session.backend_load_session_id } : {}),
      agent_config: session.agent_config,
      persist_session_id: session.persist_session_id,
      persist_task_id: session.persist_task_id,
      gateway_url: session.gateway_url,
    };

    const backend = await this.backendAdapter.start({
      outerSessionId: session.id,
      cwd: session.cwd,
      request: startRequest,
      connection: session.connection,
      agentConfig: session.agent_config,
      onSessionUpdate: (notification) => {
        this.handleBackendSessionUpdate(session, notification).catch((error) => {
          log.warn({ err: error, sessionId: session.id }, "ACP backend session/update hook failed");
        });
      },
    });

    session.backend = backend;
    session.sdk_session_id = backend.backendSessionId;
    session.agent_capabilities = backend.agentCapabilities ?? DEFAULT_AGENT_CAPABILITIES;
    session.config_options = backend.configOptions;
    return backend;
  }

  private async handleBackendSessionUpdate(
    session: AcpSession,
    notification: { update: { sessionUpdate?: string; toolCallId?: string; title?: string | null; rawInput?: unknown } }
  ): Promise<void> {
    await this.persistSessionUpdate(session, notification);

    const update = notification.update;
    if (update.sessionUpdate !== "tool_call") return;
    const toolName = update.title ?? "";
    const toolUseId = update.toolCallId;
    if (toolName === "mcp__gui_action__GUI_execute") return;
    if (!toolUseId || !clientToolCompletionRegistry.isClientSideTool(toolName)) return;

    clientToolCompletionRegistry.enqueue(session.id, toolUseId, toolName);
    this.dispatchClientToolRequest(session, toolUseId, toolName, update.rawInput).catch((error) => {
      log.warn({ err: error, sessionId: session.id, toolUseId }, "ACP client tool request failed");
      clientToolCompletionRegistry.complete(toolUseId, session.id, {
        content: [{ type: "text", text: `Client tool failed: ${error.message}` }],
        isError: true,
      });
    });
  }

  private async dispatchClientToolRequest(
    session: AcpSession,
    toolUseId: string,
    toolName: string,
    input: unknown
  ): Promise<void> {
    const response = await session.connection.requestClient("_viben/client_tool_call", {
      sessionId: session.id,
      toolUseId,
      toolName,
      input,
    });
    const result = normalizeClientToolResponse(response);
    await this.consumeQueuedSteerPrompts(session.id);
    const accepted = clientToolCompletionRegistry.complete(toolUseId, session.id, result);
    if (!accepted) {
      log.warn({ sessionId: session.id, toolUseId }, "ACP client tool completion was not accepted");
    }
  }

  private async dispatchErrorUpdate(session: AcpSession, detail: AcpErrorDetail): Promise<void> {
    try {
      await session.connection.sessionUpdate({
        sessionId: session.id,
        update: {
          sessionUpdate: "error",
          error: detail,
        },
      });
    } catch (error) {
      log.warn({ err: error, sessionId: session.id }, "Failed to dispatch ACP error update");
    }
  }

  private async dispatchSteerUpdate(
    session: AcpSession,
    record: AcpSteerPromptRecord,
    sessionUpdate: "steer_consumed" | "steer_completed" | "steer_failed"
  ): Promise<void> {
    try {
      await session.connection.sessionUpdate({
        sessionId: session.id,
        update: {
          sessionUpdate,
          promptId: record.id,
          status: record.status,
          consumedAt: record.consumed_at,
          completedAt: record.completed_at,
          error: record.error,
        },
      });
    } catch (error) {
      log.warn({ err: error, sessionId: session.id, promptId: record.id }, "Failed to dispatch ACP steer update");
    }
  }

  private async dispatchSteerConsumed(
    session: AcpSession,
    record: AcpSteerPromptRecord
  ): Promise<void> {
    const params: AcpSteerPromptConsumedNotification & { sessionId: string } = {
      sessionId: session.id,
      promptId: record.id,
      status: record.status,
      consumedAt: record.consumed_at,
    };
    try {
      await session.connection.notifyClient("session/prompt/consumed", { ...params });
    } catch (error) {
      log.warn({ err: error, sessionId: session.id, promptId: record.id }, "Failed to dispatch ACP steer consumed notification");
    }
  }

  private async persistSessionUpdate(
    session: AcpSession,
    notification: { update: Record<string, unknown> }
  ): Promise<void> {
    const uiMessage = acpUpdateToUiMessage(notification.update);
    if (uiMessage) {
      await this.persistUiMessage(session, uiMessage);
    }
    await this.persistRawAgentMessage(session, notification);
  }

  private async persistUiMessage(session: AcpSession, message: PersistableUiMessage): Promise<void> {
    if (!session.persist_session_id || !session.persist_task_id) return;
    try {
      const agentId = resolveAgentId(session.agent_config_path, session.agent_config);
      await sessionStoreService.appendUIMessage(
        agentId,
        session.persist_session_id,
        {
          id: generateMessageId(),
          taskId: session.persist_task_id,
          timestamp: new Date().toISOString(),
          ...message,
        },
        session.agent_dir
      );
    } catch (error) {
      log.warn({ err: error, sessionId: session.id }, "Failed to persist ACP UI message");
    }
  }

  private async persistRawAgentMessage(session: AcpSession, raw: unknown): Promise<void> {
    if (!session.persist_session_id) return;
    try {
      const agentId = resolveAgentId(session.agent_config_path, session.agent_config);
      await sessionStoreService.appendAgentMessage(
        agentId,
        session.persist_session_id,
        {
          timestamp: new Date().toISOString(),
          raw,
          source: "acp",
        },
        session.agent_dir
      );
    } catch (error) {
      log.warn({ err: error, sessionId: session.id }, "Failed to persist ACP raw agent message");
    }
  }

  private requireSession(sessionId: string): AcpSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`ACP session not found: ${sessionId}`);
    }
    return session;
  }
}

export const acpSessionManager = new AcpSessionManager();

async function resolveAgentConfig(
  agentConfigPath?: string,
  inlineConfig?: AgentConfigPayload
): Promise<AgentConfigPayload | null> {
  if (!agentConfigPath) return inlineConfig ?? null;

  const loaded = await loadAgentConfigFromPath(agentConfigPath);
  return loaded ?? inlineConfig ?? null;
}

async function loadAgentConfigFromPath(configPath: string): Promise<AgentConfigPayload | null> {
  try {
    const result = await readMarkdownConfig<AgentConfigFile>(configPath);
    if (!result) return null;

    const { frontmatter: config, body: systemPrompt } = result;
    return {
      name: config.name,
      model: config.model,
      provider: config.provider,
      system_prompt: systemPrompt || undefined,
      append_prompt: config.appendPrompt,
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      executor_type: config.executorType,
      mcp_servers: config.mcpServers,
      skills: config.skills,
      plan_mode: config.planMode,
      approvals: config.approvals,
    };
  } catch (error) {
    log.error({ err: error, configPath }, "Failed to load ACP agent config");
    return null;
  }
}

function promptBlocksToText(blocks: AcpContentBlock[]): string {
  return blocks
    .map((block) => {
      if (block.type === "text" && typeof block.text === "string") {
        return block.text;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function normalizeClientToolResponse(response: unknown): AcpClientToolCallResponse {
  if (isCallToolResult(response)) return response;
  return {
    content: [{ type: "text", text: typeof response === "string" ? response : JSON.stringify(response) }],
  };
}

interface PersistableUiMessage {
  type: string;
  content?: string;
  toolUseId?: string;
  toolName?: string;
  toolInput?: unknown;
  toolOutput?: string;
  isError?: boolean;
  sdkSessionId?: string;
}

function acpUpdateToUiMessage(update: Record<string, unknown>): PersistableUiMessage | null {
  switch (update.sessionUpdate) {
    case "agent_message_chunk":
      return {
        type: "text",
        content: contentBlockToText(update.content),
      };
    case "agent_thought_chunk":
      return {
        type: "thinking",
        content: contentBlockToText(update.content),
      };
    case "tool_call":
      return {
        type: "tool_use",
        content: typeof update.title === "string" ? update.title : undefined,
        toolUseId: typeof update.toolCallId === "string" ? update.toolCallId : undefined,
        toolName: typeof update.title === "string" ? update.title : undefined,
        toolInput: update.rawInput,
      };
    case "tool_call_update":
      return {
        type: "tool_result",
        toolUseId: typeof update.toolCallId === "string" ? update.toolCallId : undefined,
        toolOutput: toolOutputToText(update),
        isError: update.status === "failed",
      };
    case "plan":
      return {
        type: "plan",
        content: planEntriesToText(update.entries),
      };
    case "session_info_update":
      return sessionInfoToUiMessage(update);
    case "usage_update":
      return {
        type: "context_usage",
        content: JSON.stringify({
          used: update.used,
          size: update.size,
          cost: update.cost,
        }),
      };
    default:
      return null;
  }
}

function contentBlockToText(content: unknown): string {
  if (isRecord(content) && content.type === "text" && typeof content.text === "string") {
    return content.text;
  }
  if (content === undefined || content === null) return "";
  return JSON.stringify(content);
}

function toolOutputToText(update: Record<string, unknown>): string {
  if (typeof update.rawOutput === "string") return update.rawOutput;
  if (update.rawOutput !== undefined) return JSON.stringify(update.rawOutput);
  if (Array.isArray(update.content)) return JSON.stringify(update.content);
  if (typeof update.status === "string") return update.status;
  return "";
}

function planEntriesToText(entries: unknown): string {
  if (!Array.isArray(entries)) return "";
  return entries
    .map((entry) => {
      if (!isRecord(entry)) return "";
      const content = typeof entry.content === "string" ? entry.content : "";
      const status = typeof entry.status === "string" ? entry.status : "pending";
      return content ? `[${status}] ${content}` : "";
    })
    .filter(Boolean)
    .join("\n");
}

function sessionInfoToUiMessage(update: Record<string, unknown>): PersistableUiMessage | null {
  const sessionId = typeof update.sessionId === "string"
    ? update.sessionId
    : isRecord(update._meta) && typeof update._meta.sessionId === "string"
      ? update._meta.sessionId
      : undefined;
  if (!sessionId) return null;
  return {
    type: "sdk_session",
    sdkSessionId: sessionId,
  };
}

function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function resolveAgentId(agentConfigPath?: string, agentConfig?: AgentConfigPayload | null): string {
  if (agentConfigPath) {
    const match = agentConfigPath.match(/agents\/([^/]+)\/AGENTS\.md$/);
    if (match) return match[1];
  }
  if (agentConfig?.name) return agentConfig.name;
  return "default";
}

function isCallToolResult(value: unknown): value is AcpClientToolCallResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as { content?: unknown }).content)
  );
}

function steerRecordToResponse(record: AcpSteerPromptRecord): AcpSteerPromptResponse {
  return {
    promptId: record.id,
    sessionId: record.session_id,
    agentId: record.agent_id,
    userId: record.user_id,
    status: record.status,
    createdAt: record.created_at,
  };
}

function steerRecordToView(record: AcpSteerPromptRecord): AcpSteerPromptView {
  return {
    promptId: record.id,
    sessionId: record.session_id,
    agentId: record.agent_id,
    userId: record.user_id,
    prompt: record.prompt_json,
    status: record.status,
    createdAt: record.created_at,
    consumedAt: record.consumed_at,
    cancelledAt: record.cancelled_at,
    completedAt: record.completed_at,
    error: record.error,
    meta: record.meta_json,
  };
}

function normalizeSteerLimit(limit: number | undefined): number {
  if (limit === undefined) return 20;
  if (!Number.isFinite(limit)) return 20;
  return Math.max(1, Math.min(Math.trunc(limit), 100));
}

function parseSteerCursor(cursor: string | undefined): number {
  if (!cursor) return 0;
  const offset = Number.parseInt(cursor, 10);
  return Number.isFinite(offset) && offset > 0 ? offset : 0;
}

function toSummary(session: AcpSession): AcpSessionSummary {
  return {
    id: session.id,
    status: session.status,
    cwd: session.cwd,
    createdAt: session.created_at.toISOString(),
    lastActiveAt: session.last_active_at.toISOString(),
    queueDepth: session.prompt_queue.length,
    promptRunning: session.prompt_running,
    sdkSessionId: session.sdk_session_id,
    agentCapabilities: session.agent_capabilities,
    configOptions: session.config_options,
    lastError: session.last_error,
  };
}

function resolveCwd(cwd: string): string {
  return path.resolve(expandHomePath(cwd));
}

function expandHomePath(filePath: string): string {
  if (filePath === "~") {
    return os.homedir();
  }
  if (filePath.startsWith("~/") || filePath.startsWith("~\\")) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  return filePath;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

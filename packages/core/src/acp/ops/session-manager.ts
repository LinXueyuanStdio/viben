import { randomUUID } from "node:crypto";
import * as os from "node:os";
import * as path from "node:path";
import { CallToolResultSchema, type CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { readMarkdownConfig } from "../../config/markdown";
import type { AgentConfigFile } from "../../agents";
import { clientToolCompletionRegistry } from "../../services/client-tool-completion";
import {
  createInputHistoryEntry,
  inputHistoryService,
  type InputHistoryService,
} from "../../services/input-history";
import { sessionStoreService } from "../../services/session-store";
import { logger as globalLogger } from "../../telemetry";
import type {
  AcpAgentCapabilities,
  AcpClientToolCallResponse,
  AcpConfigOption,
  AcpConnection,
  AcpContentBlock,
  AcpErrorDetail,
  AcpInterruptSessionRequest,
  AcpInterruptSessionResponse,
  AcpLoadSessionRequest,
  AcpLoadSessionResponse,
  AcpMcpServer,
  AcpPermissionMode,
  AcpNewSessionRequest,
  AcpNewSessionResponse,
  AcpRequestPermissionRequest,
  AcpRequestPermissionResponse,
  AcpCancelSteerPromptRequest,
  AcpCancelSteerPromptResponse,
  AcpPromptRequest,
  AcpPromptResponse,
  AcpSandboxConfig,
  AcpSessionContext,
  AcpSessionEventStatus,
  AcpSessionNotification,
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
import { DetachedConnection } from "./detached-connection";
import { AcpSessionEventRecorder } from "./session-event-recorder";
import {
  createDefaultPermissionHandler,
  type PermissionHandler,
} from "./permission-handler";
import {
  createDefaultAcpSessionStorage,
  type AcpSessionStorageAdapter,
} from "./session-storage";
import type { AcpSessionEventIdentity } from "./session-event-store";
import type {
  AcpSessionRecord,
  AcpSessionRecordStatus,
} from "./session-index-store";
import { isAcpClientSideBridgeTool } from "./client-side-mcp-constants";

const log = globalLogger.child({ module: "acp-session-manager" });

const DEFAULT_AGENT_CAPABILITIES: AcpAgentCapabilities = {
  loadSession: true,
  modes: false,
  sessionCapabilities: {
    list: {},
  },
};

class RecordingAcpConnection implements AcpConnection {
  private readonly permissionHandler: PermissionHandler;
  private readonly pendingSeqs = new Set<number>();

  constructor(
    private readonly sessionId: string,
    private rawConnection: AcpConnection,
    private readonly recorder: AcpSessionEventRecorder,
    private readonly permissionMode: AcpPermissionMode = "default",
    permissionHandler: PermissionHandler = createDefaultPermissionHandler()
  ) {
    this.permissionHandler = permissionHandler;
  }

  setRawConnection(connection: AcpConnection): void {
    this.rawConnection = connection;
  }

  getRawConnection(): AcpConnection {
    return this.rawConnection;
  }

  hasRawConnection(connection: AcpConnection): boolean {
    return this.rawConnection === connection;
  }

  async sessionUpdate(params: AcpSessionNotification): Promise<void> {
    await this.tryAppend({
      type: "session_update",
      ts: nowIso(),
      data: params,
    }, "Failed to record ACP active session update");
    await this.rawConnection.sessionUpdate(params);
  }

  async requestPermission(params: AcpRequestPermissionRequest): Promise<AcpRequestPermissionResponse> {
    const autoResponse = await this.evaluatePermission(params);
    if (autoResponse) {
      await this.tryAppend({
        type: "permission_response",
        ts: nowIso(),
        data: autoResponse,
      }, "Failed to record ACP active permission response");
      return autoResponse;
    }

    const seq = await this.tryAppend({
      type: "permission_request",
      ts: nowIso(),
      status: "pending",
      request_id: params.toolCall.toolCallId,
      data: params,
    }, "Failed to record ACP active permission request");

    this.trackPending(seq);
    try {
      const response = await this.rawConnection.requestPermission(params);
      if (this.untrackPending(seq)) {
        await this.tryUpdateStatus(
          seq,
          permissionResponseStatus(response),
          "Failed to mark ACP active permission request resolved"
        );
      }
      return response;
    } catch (error) {
      if (this.untrackPending(seq)) {
        await this.tryUpdateStatus(seq, classifyRequestError(error), "Failed to mark ACP active permission request cancelled");
      }
      throw error;
    }
  }

  async requestClient(method: string, params?: Record<string, unknown>): Promise<unknown> {
    const seq = await this.tryAppend({
      type: "client_tool_call",
      ts: nowIso(),
      status: "pending",
      data: { method, params },
    }, "Failed to record ACP active client tool call");

    this.trackPending(seq);
    try {
      const response = await this.rawConnection.requestClient(method, params);
      if (this.untrackPending(seq)) {
        await this.tryUpdateStatus(seq, "resolved", "Failed to mark ACP active client tool call resolved");
      }
      return response;
    } catch (error) {
      if (this.untrackPending(seq)) {
        await this.tryUpdateStatus(seq, classifyRequestError(error), "Failed to mark ACP active client tool call cancelled");
      }
      throw error;
    }
  }

  async notifyClient(method: string, params?: Record<string, unknown>): Promise<void> {
    await this.tryAppend({
      type: "notification",
      ts: nowIso(),
      data: { method, params },
    }, "Failed to record ACP active client notification");
    await this.rawConnection.notifyClient(method, params);
  }

  private async evaluatePermission(
    params: AcpRequestPermissionRequest
  ): Promise<AcpRequestPermissionResponse | null> {
    const decision = await this.permissionHandler.evaluate(params, this.permissionMode);
    return decision.auto ? decision.response : null;
  }

  private async tryAppend(
    event: Parameters<AcpSessionEventRecorder["append"]>[0],
    message: string
  ): Promise<number | undefined> {
    try {
      return await this.recorder.append(event);
    } catch (error) {
      log.warn({ err: error, sessionId: this.sessionId }, message);
      return undefined;
    }
  }

  private async tryUpdateStatus(
    seq: number | undefined,
    status: AcpSessionEventStatus,
    message: string
  ): Promise<void> {
    if (seq === undefined) return;
    try {
      await this.recorder.updateStatus(seq, status);
    } catch (error) {
      log.warn({ err: error, sessionId: this.sessionId, seq, status }, message);
    }
  }

  async abandonPending(): Promise<void> {
    const pending = [...this.pendingSeqs];
    this.pendingSeqs.clear();
    await Promise.all(
      pending.map((seq) =>
        this.tryUpdateStatus(seq, "abandoned", "Failed to abandon ACP active pending request")
      )
    );
  }

  private trackPending(seq: number | undefined): void {
    if (seq !== undefined) {
      this.pendingSeqs.add(seq);
    }
  }

  private untrackPending(seq: number | undefined): boolean {
    return seq !== undefined ? this.pendingSeqs.delete(seq) : false;
  }
}

interface AcpNormalPromptQueueItem {
  kind: "prompt";
  request: AcpPromptRequest;
  resolve: (response: AcpPromptResponse) => void;
  reject: (error: Error) => void;
}

interface AcpSteerResumeQueueItem {
  kind: "steer_resume";
  promptIds: string[];
  resolve: (response: AcpPromptResponse) => void;
  reject: (error: Error) => void;
}

type AcpPromptQueueItem = AcpNormalPromptQueueItem | AcpSteerResumeQueueItem;

interface AcpSession {
  id: string;
  executor_type: string;
  session_id: string;
  backend_id?: string;
  status: AcpSessionStatus;
  cwd: string;
  workspace_path?: string;
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
  recorder: AcpSessionEventRecorder;
  gateway_url?: string;
  backend?: AcpBackendSession;
  backend_load_session_id?: string;
  prompt_running: boolean;
  prompt_queue: AcpPromptQueueItem[];
  pending_client_side_bridge_tool_calls: PendingClientSideBridgeToolCall[];
  sdk_session_id?: string;
  initial_prompt?: string;
  last_error?: AcpErrorDetail;
  config_options?: AcpConfigOption[];
  agent_capabilities: AcpAgentCapabilities;
}

interface PendingClientSideBridgeToolCall {
  toolCallId: string;
  toolName: string;
}

export class AcpSessionManager {
  private sessions = new Map<string, AcpSession>();
  private backendAdapter: AcpBackendAdapter;
  private steerPromptStore: AcpSteerPromptStore;
  private inputHistory: InputHistoryService;
  readonly storage: AcpSessionStorageAdapter;

  constructor(
    backendAdapter: AcpBackendAdapter = createDefaultAcpBackendAdapter(),
    steerPromptStore: AcpSteerPromptStore = createDefaultAcpSteerPromptStore(),
    inputHistory: InputHistoryService = inputHistoryService,
    storage: AcpSessionStorageAdapter = createDefaultAcpSessionStorage()
  ) {
    this.backendAdapter = backendAdapter;
    this.steerPromptStore = steerPromptStore;
    this.inputHistory = inputHistory;
    this.storage = storage;
  }

  getSession(sessionId: string): AcpSessionSummary | undefined {
    const session = this.findUniqueLiveSession(sessionId);
    return session ? toSummary(session) : undefined;
  }

  async listSessions(): Promise<AcpSessionSummary[]> {
    for (const session of this.sessions.values()) {
      if (session.status === "active" || session.status === "parked" || session.status === "initializing") {
        await this.upsertSessionIndex(session, indexStatusForSession(session));
      }
    }

    const records = await this.storage.index.listRecords();
    return records.map((record) => {
      const live = this.sessions.get(sessionKey(record));
      return live ? toSummary(live) : recordToSummary(record);
    });
  }

  async createSession(
    request: AcpNewSessionRequest,
    connection: AcpConnection,
    context: AcpSessionContext = {}
  ): Promise<AcpNewSessionResponse> {
    const gatewaySessionId = randomUUID();
    const session = await this.createSessionRecord(gatewaySessionId, request, connection, context);
    this.sessions.set(sessionKey(session), session);
    try {
      await this.ensureBackend(session, {
        sessionId: gatewaySessionId,
        prompt: [],
      });
    } catch (error) {
      this.sessions.delete(sessionKey(session));
      throw error;
    }
    log.info(sessionLogFields(session, { source: "session/new" }), "ACP session created");

    return {
      sessionId: session.id,
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
    const executorType = resolveExecutorType(agentConfig);
    const identity = { executor_type: executorType, session_id: sessionId };
    const recorder = new AcpSessionEventRecorder(this.storage.events, identity, this.storage.index);

    const session: AcpSession = {
      id: sessionId,
      executor_type: executorType,
      session_id: sessionId,
      status: "initializing",
      cwd,
      workspace_path: context.cwd,
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
      connection: this.createRecordingConnection(sessionId, connection, recorder, agentConfig?.permission_mode),
      recorder,
      gateway_url: request.gateway_url ?? request.gatewayUrl ?? context.gateway_url,
      prompt_running: false,
      prompt_queue: [],
      pending_client_side_bridge_tool_calls: [],
      agent_capabilities: DEFAULT_AGENT_CAPABILITIES,
    };
    return session;
  }

  async requestClientTool(
    sessionId: string,
    toolName: string,
    input: unknown,
    toolCallId: string = randomUUID()
  ): Promise<CallToolResult> {
    const session = this.findUniqueLiveSession(sessionId);
    if (!session) {
      return {
        content: [{ type: "text", text: `ACP session not found: ${sessionId}` }],
        isError: true,
      };
    }

    const resolvedToolCallId = this.resolveClientToolCallId(session, toolName, toolCallId);
    clientToolCompletionRegistry.registerToolOptions(toolName, { timeoutMs: 60_000 });
    clientToolCompletionRegistry.enqueue(session.id, resolvedToolCallId, toolName);
    const result = clientToolCompletionRegistry.waitForClient(session.id, resolvedToolCallId, toolName);
    await this.dispatchClientToolRequest(session, resolvedToolCallId, toolName, input);
    return await result;
  }

  async loadSession(
    request: AcpLoadSessionRequest,
    connection: AcpConnection,
    context: AcpSessionContext = {}
  ): Promise<AcpLoadSessionResponse> {
    const executorContext = await this.resolveExecutorContext(request, context);
    const existing = this.findLiveSession(request.sessionId, executorContext);
    if (existing) {
      let history;
      if (existing.connection instanceof DetachedConnection) {
        history = await existing.connection.resume(connection);
        await existing.backend?.resume?.();
        existing.connection = this.createRecordingConnection(
          existing.id,
          connection,
          existing.recorder,
          existing.agent_config?.permission_mode
        );
      } else if (existing.connection instanceof RecordingAcpConnection) {
        existing.connection.setRawConnection(connection);
      } else {
        existing.connection = this.createRecordingConnection(
          existing.id,
          connection,
          existing.recorder,
          existing.agent_config?.permission_mode
        );
      }
      existing.status = "active";
      existing.last_active_at = new Date();
      await this.upsertSessionIndex(existing, "active");
      if (!existing.backend) {
        existing.backend_load_session_id = request.sessionId;
      }
      log.info(sessionLogFields(existing, {
        source: "session/load",
        requestedSessionId: request.sessionId,
        reusedLiveSession: true,
      }), "ACP session load reused live session");
      return {
        sessionId: existing.id,
        configOptions: existing.config_options,
        history,
      };
    }

    const indexRecord = await this.resolveLoadSessionRecord(request, context, executorContext);
    if (indexRecord) {
      const session = await this.createSessionRecordFromIndex(indexRecord, request, connection, context);
      const history = await session.recorder.abandonPending();
      session.status = "active";
      session.last_active_at = new Date();
      this.sessions.set(sessionKey(session), session);
      try {
        await this.ensureBackend(session, {
          sessionId: session.backend_load_session_id ?? session.session_id,
          prompt: [],
        });
      } catch (error) {
        this.sessions.delete(sessionKey(session));
        throw error;
      }
      await this.upsertSessionIndex(session, "active");
      log.info(sessionLogFields(session, {
        source: "session/load",
        requestedSessionId: request.sessionId,
        reusedLiveSession: false,
        loadedFromIndex: true,
      }), "ACP session loaded from index");

      return {
        sessionId: session.id,
        configOptions: session.config_options,
        history,
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
    this.sessions.set(sessionKey(session), session);
    try {
      await this.ensureBackend(session, {
        sessionId: request.sessionId,
        prompt: [],
      });
    } catch (error) {
      this.sessions.delete(sessionKey(session));
      throw error;
    }
    log.info(sessionLogFields(session, {
      source: "session/load",
      requestedSessionId: request.sessionId,
      reusedLiveSession: false,
    }), "ACP session loaded as new live session");

    return {
      sessionId: session.id,
      configOptions: session.config_options,
    };
  }

  async resolveSessionIdentity(
    sessionId: string,
    context: AcpSessionContext = {}
  ): Promise<AcpSessionEventIdentity> {
    const executorType = await this.resolveExecutorContext(
      { sessionId, cwd: context.cwd ?? process.cwd(), mcpServers: [] },
      context
    );
    if (executorType) {
      const live = this.findLiveSession(sessionId, executorType);
      if (live) return getStorageIdentity(live);

      const record = await this.storage.index.getRecord(executorType, sessionId);
      if (record) {
        return {
          executor_type: record.executor_type,
          session_id: record.session_id,
        };
      }
    }

    const live = this.findUniqueLiveSession(sessionId);
    if (live) return getStorageIdentity(live);

    const record = await this.resolveUniqueIndexRecordBySessionId(sessionId);
    if (!record) {
      throw new Error(`ACP session not found: ${sessionId}`);
    }
    return {
      executor_type: record.executor_type,
      session_id: record.session_id,
    };
  }

  async prompt(request: AcpPromptRequest, identity?: AcpSessionEventIdentity): Promise<AcpPromptResponse> {
    const session = this.findLiveSessionByInput(request.sessionId, identity);
    if (!session) {
      throw new Error(`ACP session not found: ${request.sessionId}`);
    }

    return new Promise<AcpPromptResponse>((resolve, reject) => {
      const item: AcpPromptQueueItem = { kind: "prompt", request, resolve, reject };
      this.enqueuePromptItem(session, item, "back");
    });
  }

  async steerPrompt(request: AcpSteerPromptRequest, identity?: AcpSessionEventIdentity): Promise<AcpSteerPromptResponse> {
    const session = this.requireSession(request.sessionId, identity);
    if (!Array.isArray(request.prompt) || request.prompt.length === 0) {
      throw new Error("session/prompt/steer requires prompt");
    }
    const prompt = promptBlocksToText(request.prompt);
    if (!prompt.trim()) {
      throw new Error("session/prompt/steer requires prompt");
    }
    await this.inputHistory.addEntry(createInputHistoryEntry(prompt, {
      source: "desktop_acp_chat",
      session_id: session.id,
    }));
    const steerSessionId = compositeSessionId(getStorageIdentity(session));

    const record = await this.steerPromptStore.create({
      session_id: steerSessionId,
      agent_id: request.agent_id ?? request.agentId ?? resolveAgentId(session.agent_config_path, session.agent_config),
      user_id: request.user_id ?? request.userId ?? "default",
      prompt_json: request.prompt,
      meta_json: request.meta ?? request._meta,
    });
    session.last_active_at = new Date();
    log.debug({ sessionId: session.id, promptId: record.id }, "ACP steer prompt queued");
    return steerRecordToResponse(record);
  }

  async cancelSteerPrompt(request: AcpCancelSteerPromptRequest, identity?: AcpSessionEventIdentity): Promise<AcpCancelSteerPromptResponse> {
    const session = this.requireSession(request.sessionId, identity);
    const record = await this.steerPromptStore.cancel(compositeSessionId(getStorageIdentity(session)), request.promptId);
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

  async viewSteerPrompt(request: AcpViewSteerPromptRequest, identity?: AcpSessionEventIdentity): Promise<AcpViewSteerPromptResponse> {
    const session = this.requireSession(request.sessionId, identity);
    const steerSessionId = compositeSessionId(getStorageIdentity(session));
    if (request.promptId) {
      const record = await this.steerPromptStore.get(steerSessionId, request.promptId);
      if (!record) {
        throw new Error(`ACP steer prompt not found: ${request.promptId}`);
      }
      return { prompt: steerRecordToView(record) };
    }

    const limit = normalizeSteerLimit(request.limit);
    const cursorOffset = parseSteerCursor(request.cursor);
    const records = await this.steerPromptStore.list({
      session_id: steerSessionId,
      agent_id: request.agent_id ?? request.agentId,
      user_id: request.user_id ?? request.userId,
      status: request.status,
      limit,
      cursor: request.cursor,
    });
    const total = this.steerPromptStore.count
      ? await this.steerPromptStore.count({
        session_id: steerSessionId,
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

  async consumeNextSteerPrompt(sessionId: string, identity?: AcpSessionEventIdentity): Promise<AcpSteerPromptView | undefined> {
    const session = this.requireSession(sessionId, identity);
    const record = await this.steerPromptStore.consumeNext(compositeSessionId(getStorageIdentity(session)));
    if (!record) return undefined;
    await this.dispatchSteerConsumed(session, record);
    return steerRecordToView(record);
  }

  async consumeQueuedSteerPrompts(sessionId: string, identity?: AcpSessionEventIdentity): Promise<AcpSteerPromptView[]> {
    const session = this.requireSession(sessionId, identity);
    const records = await this.steerPromptStore.consumeQueued(compositeSessionId(getStorageIdentity(session)));
    for (const record of records) {
      await this.dispatchSteerConsumed(session, record);
    }
    return records.map((record) => steerRecordToView(record));
  }

  async markSteerPromptCompleted(sessionId: string, promptId: string, identity?: AcpSessionEventIdentity): Promise<AcpSteerPromptView | undefined> {
    const session = this.requireSession(sessionId, identity);
    const record = await this.steerPromptStore.markCompleted(compositeSessionId(getStorageIdentity(session)), promptId);
    if (!record) return undefined;
    await this.dispatchSteerUpdate(session, record, "steer_completed");
    return steerRecordToView(record);
  }

  async markSteerPromptFailed(sessionId: string, promptId: string, error: string, identity?: AcpSessionEventIdentity): Promise<AcpSteerPromptView | undefined> {
    const session = this.requireSession(sessionId, identity);
    const record = await this.steerPromptStore.markFailed(compositeSessionId(getStorageIdentity(session)), promptId, error);
    if (!record) return undefined;
    await this.dispatchSteerUpdate(session, record, "steer_failed");
    return steerRecordToView(record);
  }

  async interruptSession(
    request: AcpInterruptSessionRequest,
    identity?: AcpSessionEventIdentity
  ): Promise<AcpInterruptSessionResponse> {
    const session = this.requireSession(request.sessionId, identity);
    const promptIds = await this.enqueueQueuedSteerResume(session);
    if (promptIds.length === 0) {
      this.interruptCurrentExecution(session);
      return {
        interrupted: true,
        resumed: false,
        promptIds: [],
      };
    }

    this.interruptCurrentExecution(session);

    return {
      interrupted: true,
      resumed: true,
      promptIds,
    };
  }

  private async listQueuedSteerPrompts(session: AcpSession): Promise<AcpSteerPromptView[]> {
    const records: AcpSteerPromptRecord[] = [];
    let cursor = "0";
    while (true) {
      const page = await this.steerPromptStore.list({
        session_id: compositeSessionId(getStorageIdentity(session)),
        status: "queued",
        limit: 100,
        cursor,
      });
      records.push(...page);
      if (page.length < 100) break;
      cursor = String(records.length);
    }
    return records.map((record) => steerRecordToView(record));
  }

  private async enqueueQueuedSteerResume(session: AcpSession): Promise<string[]> {
    const steerPrompts = await this.listQueuedSteerPrompts(session);
    const promptIds = steerPrompts.map((item) => item.promptId);
    if (promptIds.length === 0) return [];

    if (!session.prompt_queue.some((item) => item.kind === "steer_resume")) {
      const resumeItem: AcpPromptQueueItem = {
        kind: "steer_resume",
        promptIds,
        resolve: () => {},
        reject: (error) => {
          log.warn({ err: error, sessionId: session.id, promptIds }, "ACP steer resume prompt failed");
        },
      };
      this.enqueuePromptItem(session, resumeItem, session.prompt_running ? "front" : "back");
    }

    return promptIds;
  }

  async cancelSession(sessionId: string, identity?: AcpSessionEventIdentity): Promise<boolean> {
    const session = this.findLiveSessionByInput(sessionId, identity);
    if (!session) return false;

    session.status = "cancelled";
    session.last_active_at = new Date();
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
    await this.upsertSessionIndex(session, "active");
    log.info({ sessionId }, "ACP session cancelled");
    return true;
  }

  private interruptCurrentExecution(session: AcpSession): void {
    clientToolCompletionRegistry.cancelSession(session.id);
    if (session.prompt_running) {
      session.status = "cancelled";
    }
    if (!session.backend) return;
    void session.backend.cancel().catch((error) => {
      log.debug({ err: error, sessionId: session.id }, "ACP backend interrupt cancel failed");
    });
  }

  async closeSession(sessionId: string, identity?: AcpSessionEventIdentity): Promise<void> {
    const session = this.findLiveSessionByInput(sessionId, identity);
    if (!session) {
      const record = identity
        ? await this.storage.index.getRecord(identity.executor_type, identity.session_id)
        : await this.resolveUniqueIndexRecordBySessionId(sessionId);
      if (!record) return;
      const finishedAt = new Date().toISOString();
      await this.storage.index.updateStatus(record.executor_type, record.session_id, "finished", {
        last_active_at: finishedAt,
        finished_at: finishedAt,
      });
      log.info({ sessionId, executorType: record.executor_type }, "ACP indexed session closed");
      return;
    }
    if (session.prompt_running) {
      clientToolCompletionRegistry.cancelSession(sessionId);
    }
    try {
      await session.backend?.close();
    } catch (error) {
      log.debug({ err: error, sessionId }, "ACP backend close failed");
    }
    for (const item of session.prompt_queue.splice(0)) {
      item.resolve({ stopReason: "cancelled" });
    }
    if (session.connection instanceof DetachedConnection) {
      await session.connection.close();
    }
    session.status = "finished";
    session.last_active_at = new Date();
    await this.upsertSessionIndex(session, "finished");
    this.sessions.delete(sessionKey(session));
    log.info({ sessionId }, "ACP session closed");
  }

  closeAll(): void {
    for (const session of Array.from(this.sessions.values())) {
      void this.closeSession(session.id).catch((error) => {
        log.warn({ err: error, sessionId: session.id }, "ACP session close failed");
      });
    }
  }

  async parkSession(
    identity: AcpSessionEventIdentity,
    closingConnection?: AcpConnection
  ): Promise<boolean> {
    const session = this.sessions.get(sessionKey(identity));
    if (!session) return false;
    if (session.connection instanceof DetachedConnection) {
      return true;
    }
    if (closingConnection && !isConnectionRawTarget(session.connection, closingConnection)) {
      return false;
    }
    if (session.connection instanceof RecordingAcpConnection) {
      await session.connection.abandonPending();
      if (closingConnection && !isConnectionRawTarget(session.connection, closingConnection)) {
        return false;
      }
    }
    session.connection = new DetachedConnection(
      session.recorder,
      session.id,
      session.agent_config?.permission_mode ?? "default"
    );
    session.status = "parked";
    session.last_active_at = new Date();
    await this.upsertSessionIndex(session, "parked");
    log.info(sessionLogFields(session, { source: "session/park" }), "ACP session parked");
    return true;
  }

  private enqueuePromptItem(
    session: AcpSession,
    item: AcpPromptQueueItem,
    position: "front" | "back"
  ): void {
    if (session.prompt_running) {
      if (position === "front") {
        session.prompt_queue.unshift(item);
      } else {
        session.prompt_queue.push(item);
      }
      log.debug({ sessionId: session.id, queueDepth: session.prompt_queue.length }, "ACP prompt queued");
      return;
    }
    this.runPromptItem(session, item).catch((error) => item.reject(error));
  }

  private async runPromptItem(session: AcpSession, item: AcpPromptQueueItem): Promise<void> {
    session.prompt_running = true;
    session.status = "active";
    session.last_active_at = new Date();
    session.last_error = undefined;

    try {
      const response = await this.executePromptItem(session, item);
      item.resolve(response);
    } catch (error) {
      if (getSessionStatus(session) === "cancelled") {
        item.resolve({ stopReason: "cancelled" });
        return;
      }
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

  private async executePromptItem(
    session: AcpSession,
    item: AcpPromptQueueItem
  ): Promise<AcpPromptResponse> {
    if (item.kind === "prompt") {
      return await this.executePrompt(session, item.request);
    }
    return await this.executeSteerResumePrompt(session);
  }

  private async executePrompt(
    session: AcpSession,
    request: AcpPromptRequest
  ): Promise<AcpPromptResponse> {
    const prompt = promptBlocksToText(request.prompt);
    if (!prompt.trim()) {
      throw new Error("Prompt is required");
    }
    session.initial_prompt ??= prompt;
    await this.inputHistory.addEntry(createInputHistoryEntry(prompt, {
      source: "desktop_acp_chat",
      session_id: session.id,
    }));
    await this.persistUiMessage(session, {
      type: "user",
      content: prompt,
    });

    const backend = await this.ensureBackend(session, request);
    const steerPrompts = await this.consumeQueuedSteerPrompts(session.id, getStorageIdentity(session));
    const promptWithSteer = mergePromptWithSteerBlocks(request.prompt, steerPrompts);
    const response = await backend.prompt({
      ...request,
      sessionId: backend.backendSessionId,
      prompt: promptWithSteer,
    });

    if (session.status === "cancelled") {
      return { stopReason: "cancelled" };
    }
    return response as AcpPromptResponse;
  }

  private async executeSteerResumePrompt(session: AcpSession): Promise<AcpPromptResponse> {
    const steerPrompts = await this.consumeQueuedSteerPrompts(session.id, getStorageIdentity(session));
    const prompt = mergeSteerPromptBlocks(steerPrompts);
    if (prompt.length === 0) {
      return { stopReason: "cancelled" };
    }

    const promptText = promptBlocksToText(prompt);
    await this.persistUiMessage(session, {
      type: "user",
      content: promptText,
    });

    const backend = await this.ensureBackend(session, {
      sessionId: session.id,
      prompt,
    });
    const response = await backend.prompt({
      sessionId: backend.backendSessionId,
      prompt,
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
      sandbox_config: session.sandbox_config,
      persist_session_id: session.persist_session_id,
      persist_task_id: session.persist_task_id,
      gateway_url: session.gateway_url,
    };

    log.info(sessionLogFields(session, {
      source: session.backend_load_session_id ? "backend/load" : "backend/new",
      backendLoadSessionId: session.backend_load_session_id,
    }), "ACP backend session starting");

    const previousIdentity = getStorageIdentity(session);
    const previousKey = sessionKey(previousIdentity);
    const backend = await this.backendAdapter.start({
      outerSessionId: session.id,
      resolveOuterSessionId: () => session.id,
      cwd: session.cwd,
      request: startRequest,
      connection: this.createBackendConnection(session),
      agentConfig: session.agent_config,
      sandboxConfig: session.sandbox_config,
      onSessionUpdate: (notification) => {
        this.handleBackendSessionUpdate(session, notification).catch((error) => {
          log.warn({ err: error, sessionId: session.id }, "ACP backend session/update hook failed");
        });
      },
    });

    session.backend = backend;
    session.backend_id = this.backendAdapter.id;
    session.sdk_session_id = backend.backendSessionId;
    if (session.session_id !== backend.backendSessionId) {
      await this.migrateSessionIdentity(session, previousIdentity, backend.backendSessionId);
    } else if (!this.sessions.has(previousKey)) {
      this.sessions.set(sessionKey(session), session);
    }
    session.agent_capabilities = backend.agentCapabilities ?? DEFAULT_AGENT_CAPABILITIES;
    session.config_options = backend.configOptions;
    await this.upsertSessionIndex(session, indexStatusForSession(session));
    log.info({
      ...sessionLogFields(session, {
        source: session.backend_load_session_id ? "backend/load" : "backend/new",
        backendLoadSessionId: session.backend_load_session_id,
      }),
      backendSessionId: backend.backendSessionId,
      backendCapabilities: summarizeBackendCapabilities(backend.agentCapabilities),
    }, "ACP backend session ready");
    return backend;
  }

  private async migrateSessionIdentity(
    session: AcpSession,
    previousIdentity: AcpSessionEventIdentity,
    backendSessionId: string
  ): Promise<void> {
    const oldKey = sessionKey(previousIdentity);
    const oldRecord = await this.storage.index.getRecord(previousIdentity.executor_type, previousIdentity.session_id);
    session.id = backendSessionId;
    session.session_id = backendSessionId;
    session.backend_load_session_id = backendSessionId;
    session.recorder = new AcpSessionEventRecorder(this.storage.events, getStorageIdentity(session), this.storage.index);
    session.connection = this.createRecordingConnection(
      session.id,
      unwrapRecordingConnection(session.connection) ?? session.connection,
      session.recorder,
      session.agent_config?.permission_mode
    );
    this.sessions.delete(oldKey);
    this.sessions.set(sessionKey(session), session);
    if (oldRecord) {
      await this.storage.index.hardDeleteRecord(previousIdentity.executor_type, previousIdentity.session_id);
    }
  }

  private createBackendConnection(session: AcpSession): AcpConnection {
    return {
      sessionUpdate: async (params) => {
        await session.connection.sessionUpdate(params);
      },
      requestPermission: async (params) => {
        return await session.connection.requestPermission(params);
      },
      requestClient: async (method, params) => {
        return await session.connection.requestClient(method, params);
      },
      notifyClient: async (method, params) => {
        await session.connection.notifyClient(method, params);
      },
    };
  }

  private createRecordingConnection(
    sessionId: string,
    connection: AcpConnection,
    recorder: AcpSessionEventRecorder,
    permissionMode: AcpPermissionMode = "default"
  ): RecordingAcpConnection {
    return new RecordingAcpConnection(sessionId, connection, recorder, permissionMode);
  }

  private async handleBackendSessionUpdate(
    session: AcpSession,
    notification: { update: { sessionUpdate?: string; toolCallId?: string; title?: string | null; rawInput?: unknown; status?: string | null } }
  ): Promise<void> {
    await this.persistSessionUpdate(session, notification);

    const update = notification.update;
    if (update.sessionUpdate === "tool_call_update" && isFinishedToolStatus(update.status)) {
      const promptIds = await this.enqueueQueuedSteerResume(session);
      if (promptIds.length > 0) {
        this.interruptCurrentExecution(session);
      }
      return;
    }

    if (update.sessionUpdate !== "tool_call") return;
    const toolName = update.title ?? "";
    const toolCallId = update.toolCallId;
    if (isAcpClientSideBridgeTool(toolName)) {
      if (toolCallId) {
        session.pending_client_side_bridge_tool_calls.push({ toolCallId, toolName });
        log.debug({ sessionId: session.id, toolCallId, toolName }, "Queued ACP client-side tool call id for MCP bridge");
      }
      return;
    }
    if (!toolCallId || !clientToolCompletionRegistry.isClientSideTool(toolName)) return;

    clientToolCompletionRegistry.enqueue(session.id, toolCallId, toolName);
    this.dispatchClientToolRequest(session, toolCallId, toolName, update.rawInput).catch((error) => {
      log.warn({ err: error, sessionId: session.id, toolCallId }, "ACP client tool request failed");
      clientToolCompletionRegistry.complete(toolCallId, session.id, {
        content: [{ type: "text", text: `Client tool failed: ${error.message}` }],
        isError: true,
      });
    });
  }

  private async dispatchClientToolRequest(
    session: AcpSession,
    toolCallId: string,
    toolName: string,
    input: unknown
  ): Promise<void> {
    const response = await session.connection.requestClient("_viben/client_tool_call", {
      sessionId: session.id,
      toolCallId,
      toolName,
      input,
    });
    const result = normalizeClientToolResponse(response, session.id, toolCallId);
    const steerPrompts = await this.consumeQueuedSteerPrompts(session.id, getStorageIdentity(session));
    const accepted = clientToolCompletionRegistry.complete(
      toolCallId,
      session.id,
      mergeToolResultWithSteerPrompts(result, steerPrompts)
    );
    if (!accepted) {
      log.warn({ sessionId: session.id, toolCallId }, "ACP client tool completion was not accepted");
    }
  }

  consumePendingBridgeToolCall(sessionId: string, toolName: string): void {
    const session = this.findUniqueLiveSession(sessionId);
    if (!session) return;
    const index = session.pending_client_side_bridge_tool_calls.findIndex((p) => p.toolName === toolName);
    if (index >= 0) {
      session.pending_client_side_bridge_tool_calls.splice(index, 1);
    }
  }

  private resolveClientToolCallId(session: AcpSession, toolName: string, fallbackToolCallId: string): string {
    if (!isAcpClientSideBridgeTool(toolName)) return fallbackToolCallId;
    const index = session.pending_client_side_bridge_tool_calls.findIndex((pending) => pending.toolName === toolName);
    if (index < 0) return fallbackToolCallId;
    const pending = session.pending_client_side_bridge_tool_calls.splice(index, 1)[0];
    if (pending.toolCallId !== fallbackToolCallId) {
      log.debug({
        sessionId: session.id,
        backendToolCallId: pending.toolCallId,
        bridgeToolCallId: fallbackToolCallId,
        toolName,
      }, "Mapped client-side MCP bridge tool call to ACP backend tool call id");
    }
    return pending.toolCallId;
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
    const params: AcpSteerPromptConsumedNotification = {
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

  private requireSession(sessionId: string, identity?: AcpSessionEventIdentity): AcpSession {
    const session = this.findLiveSessionByInput(sessionId, identity);
    if (!session) {
      throw new Error(`ACP session not found: ${sessionId}`);
    }
    return session;
  }

  private findUniqueLiveSession(sessionId: string): AcpSession | undefined {
    const direct = this.sessions.get(sessionId) ?? this.sessions.get(compositeSessionIdFromString(sessionId));
    if (direct) return direct;

    const matches = Array.from(this.sessions.values()).filter((session) => session.session_id === sessionId);
    return matches.length === 1 ? matches[0] : undefined;
  }

  private findLiveSessionByInput(
    sessionId: string,
    identity?: AcpSessionEventIdentity
  ): AcpSession | undefined {
    if (identity) {
      return this.sessions.get(sessionKey(identity));
    }
    return this.findUniqueLiveSession(sessionId);
  }

  private findLiveSession(
    sessionId: string,
    executorType?: string
  ): AcpSession | undefined {
    if (executorType) {
      return this.sessions.get(sessionKey({ executor_type: executorType, session_id: sessionId }));
    }
    return this.findUniqueLiveSession(sessionId);
  }

  private async upsertSessionIndex(session: AcpSession, status: AcpSessionRecordStatus): Promise<void> {
    const existing = await this.storage.index.getRecord(session.executor_type, session.session_id);
    await this.storage.index.upsertRecord(this.buildSessionRecord(session, status, existing));
  }

  private async resolveLoadSessionRecord(
    request: AcpLoadSessionRequest,
    context: AcpSessionContext,
    executorContext?: string
  ): Promise<AcpSessionRecord | null> {
    const executorType = executorContext ?? await this.resolveExecutorContext(request, context);
    if (executorType) {
      return await this.storage.index.getRecord(executorType, request.sessionId);
    }

    const matches = await this.storage.index.findBySessionId(request.sessionId);
    if (matches.length > 1) {
      throw new Error("ACP session_id is ambiguous across executor_type; provide executor context");
    }
    return matches[0] ?? null;
  }

  private async resolveExecutorContext(
    request: AcpLoadSessionRequest,
    context: AcpSessionContext
  ): Promise<string | undefined> {
    const agentConfigPath = request.agent_config_path ?? request.agentConfigPath ?? context.agent_config_path;
    const inlineConfig = request.agent_config ?? request.agentConfig ?? context.agent_config;
    const agentConfig = await resolveAgentConfig(agentConfigPath, inlineConfig);
    if (!agentConfig?.executor_type) return undefined;
    return resolveExecutorType(agentConfig);
  }

  private async createSessionRecordFromIndex(
    record: AcpSessionRecord,
    request: AcpLoadSessionRequest,
    connection: AcpConnection,
    context: AcpSessionContext
  ): Promise<AcpSession> {
    const requestAgentConfigPath = request.agent_config_path ?? request.agentConfigPath ?? context.agent_config_path;
    const requestAgentConfig = request.agent_config ?? request.agentConfig ?? context.agent_config;
    const loadedAgentConfig = await resolveAgentConfig(requestAgentConfigPath ?? record.agent_config_path, requestAgentConfig);
    const agentConfig = mergeRecordAgentConfig(record, loadedAgentConfig);
    const identity = { executor_type: record.executor_type, session_id: record.session_id };
    const recorder = new AcpSessionEventRecorder(this.storage.events, identity, this.storage.index);

    return {
      id: record.session_id,
      executor_type: record.executor_type,
      session_id: record.session_id,
      backend_id: record.backend_id,
      status: record.status === "finished" ? "finished" : "active",
      cwd: record.cwd,
      workspace_path: record.workspace_path,
      created_at: parseRecordDate(record.created_at),
      last_active_at: parseRecordDate(record.last_active_at),
      agent_config_path: record.agent_config_path,
      agent_dir: record.agent_dir,
      persist_session_id: record.persist_session_id,
      persist_task_id: record.persist_task_id,
      agent_config: agentConfig,
      sandbox_config: request.sandbox_config ?? request.sandboxConfig ?? context.sandbox_config,
      mcp_servers: request.mcpServers ?? [],
      connection: this.createRecordingConnection(
        record.session_id,
        connection,
        recorder,
        agentConfig?.permission_mode
      ),
      recorder,
      gateway_url: record.gateway_url,
      backend_load_session_id: restoreBackendLoadSessionId(record),
      prompt_running: false,
      prompt_queue: [],
      pending_client_side_bridge_tool_calls: [],
      sdk_session_id: readRecordString(record.acp_record, "sdkSessionId") ?? readRecordString(record.acp_record, "sdk_session_id"),
      initial_prompt: readRecordString(record.acp_record, "initialPrompt") ?? readRecordString(record.acp_record, "initial_prompt"),
      last_error: record.last_error,
      config_options: readConfigOptions(record.acp_record),
      agent_capabilities: DEFAULT_AGENT_CAPABILITIES,
    };
  }

  private async resolveUniqueIndexRecordBySessionId(sessionId: string): Promise<AcpSessionRecord | null> {
    const matches = await this.storage.index.findBySessionId(sessionId);
    if (matches.length > 1) {
      throw new Error("ACP session_id is ambiguous across executor_type; provide executor context");
    }
    return matches[0] ?? null;
  }

  private buildSessionRecord(
    session: AcpSession,
    status: AcpSessionRecordStatus,
    existing?: AcpSessionRecord | null
  ): AcpSessionRecord {
    return {
      executor_type: session.executor_type,
      session_id: session.session_id,
      status,
      cwd: session.cwd,
      workspace_path: session.workspace_path,
      agent_dir: session.agent_dir,
      agent_config_path: session.agent_config_path,
      backend_id: session.backend_id,
      title: session.agent_config?.name,
      permission_mode: session.agent_config?.permission_mode,
      acp_record: {
        sessionId: session.id,
        executor_type: session.executor_type,
        sdk_session_id: session.sdk_session_id,
        sdkSessionId: session.sdk_session_id,
        backend_load_session_id: session.backend_load_session_id,
        initialPrompt: session.initial_prompt,
        initial_prompt: session.initial_prompt,
        configOptions: session.config_options,
      },
      persist_session_id: session.persist_session_id,
      persist_task_id: session.persist_task_id,
      gateway_url: session.gateway_url,
      event_store_type: "jsonl",
      event_store_uri: this.storage.events.getEventStoreUri(getStorageIdentity(session)),
      event_last_seq: existing?.event_last_seq ?? -1,
      created_at: session.created_at.toISOString(),
      last_active_at: session.last_active_at.toISOString(),
      parked_at: status === "parked" ? session.last_active_at.toISOString() : undefined,
      finished_at: status === "finished" ? session.last_active_at.toISOString() : undefined,
      last_error: session.last_error,
    };
  }
}

export const acpSessionManager = new AcpSessionManager();

export function sessionKey(identity: AcpSessionEventIdentity): string {
  return `${identity.executor_type}:${identity.session_id}`;
}

export function getStorageIdentity(session: AcpSessionEventIdentity): AcpSessionEventIdentity {
  return {
    executor_type: session.executor_type,
    session_id: session.session_id,
  };
}

function isConnectionRawTarget(connection: AcpConnection, target: AcpConnection): boolean {
  if (connection === target) return true;
  return connection instanceof RecordingAcpConnection && connection.hasRawConnection(target);
}

function unwrapRecordingConnection(connection: AcpConnection): AcpConnection | undefined {
  return connection instanceof RecordingAcpConnection ? connection.getRawConnection() : undefined;
}

function compositeSessionId(identity: AcpSessionEventIdentity): string {
  return `${identity.executor_type}:${identity.session_id}`;
}

function compositeSessionIdFromString(sessionId: string): string {
  return sessionId;
}

function classifyRequestError(error: unknown): AcpSessionEventStatus {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes("cancel") || message.includes("abort") ? "cancelled" : "abandoned";
}

function permissionResponseStatus(response: AcpRequestPermissionResponse): AcpSessionEventStatus {
  return response.outcome.outcome === "cancelled" ? "cancelled" : "resolved";
}

function nowIso(): string {
  return new Date().toISOString();
}

export function resolveExecutorType(agentConfig?: AgentConfigPayload | null): string {
  const raw = agentConfig?.executor_type;
  if (typeof raw !== "string" || !raw.trim()) {
    return "CLAUDE_CODE";
  }
  return raw.trim().replace(/[-\s]+/g, "_").toUpperCase();
}

async function resolveAgentConfig(
  agentConfigPath?: string,
  inlineConfig?: AgentConfigPayload
): Promise<AgentConfigPayload | null> {
  if (!agentConfigPath) return inlineConfig ?? null;

  const loaded = await loadAgentConfigFromPath(agentConfigPath);
  if (!loaded) return inlineConfig ?? null;
  if (!inlineConfig) return loaded;
  return mergeAgentConfig(loaded, inlineConfig);
}

function mergeAgentConfig(
  base: AgentConfigPayload,
  override: AgentConfigPayload
): AgentConfigPayload {
  const merged: AgentConfigPayload = { ...base };
  for (const [key, value] of Object.entries(override) as Array<[keyof AgentConfigPayload, unknown]>) {
    if (value !== undefined) {
      (merged as Record<string, unknown>)[key] = value;
    }
  }

  if (isRecord(base.executor_config) || isRecord(override.executor_config)) {
    merged.executor_config = {
      ...(isRecord(base.executor_config) ? base.executor_config : {}),
      ...(isRecord(override.executor_config) ? definedRecord(override.executor_config) : {}),
    };
    if (shouldDropStaleCodexProviderConfig(base, override)) {
      for (const key of CODEX_PROVIDER_CONFIG_KEYS) {
        delete merged.executor_config[key];
      }
    }
  }

  return merged;
}

const CODEX_PROVIDER_CONFIG_KEYS = [
  "provider_id",
  "base_url",
  "provider_name",
  "wire_api",
  "env_key",
  "experimental_bearer_token",
];

function shouldDropStaleCodexProviderConfig(base: AgentConfigPayload, override: AgentConfigPayload): boolean {
  if (!override.provider_id || override.provider_id === base.provider_id) return false;
  const executorType = override.executor_type ?? base.executor_type;
  return executorType === "CODEX" || executorType === "CODEX_APP_SERVER";
}

function definedRecord(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined)
  );
}

async function loadAgentConfigFromPath(configPath: string): Promise<AgentConfigPayload | null> {
  try {
    const result = await readMarkdownConfig<AgentConfigFile>(configPath);
    if (!result) return null;

    const { frontmatter: config, body: systemPrompt } = result;
    return {
      name: config.name,
      model: config.model,
      provider_id: config.provider_id,
      system_prompt: systemPrompt || undefined,
      append_prompt: config.append_prompt,
      temperature: config.temperature,
      max_tokens: config.max_tokens,
      executor_type: config.executor_type,
      executor_config: config.executor_config,
      mcp_servers: config.mcp_servers,
      skills: config.skills,
      dangerously_skip_permissions: config.dangerously_skip_permissions,
      permission_mode: config.permission_mode,
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

function mergeSteerPromptBlocks(prompts: AcpSteerPromptView[]): AcpContentBlock[] {
  const text = prompts
    .flatMap((prompt) => prompt.prompt)
    .map((block) => blockToPromptText(block))
    .filter((content) => content.length > 0)
    .join("\n\n");
  return text ? [{ type: "text", text }] : [];
}

function mergePromptWithSteerBlocks(
  prompt: AcpContentBlock[],
  steerPrompts: AcpSteerPromptView[]
): AcpContentBlock[] {
  const steerPrompt = mergeSteerPromptBlocks(steerPrompts);
  if (steerPrompt.length === 0) return prompt;

  const promptText = promptBlocksToText(prompt).trim();
  const steerText = promptBlocksToText(steerPrompt).trim();
  if (!promptText) return steerPrompt;
  if (!steerText) return prompt;
  return [{ type: "text", text: `${promptText}\n\n${steerText}` }];
}

function mergeToolResultWithSteerPrompts(
  result: CallToolResult,
  steerPrompts: AcpSteerPromptView[]
): CallToolResult {
  const steerPrompt = mergeSteerPromptBlocks(steerPrompts);
  if (steerPrompt.length === 0) return result;
  const steerText = promptBlocksToText(steerPrompt).trim();
  if (!steerText) return result;
  return {
    ...result,
    content: [
      ...result.content,
      { type: "text", text: steerText },
    ],
  };
}

function blockToPromptText(block: AcpContentBlock): string {
  if (block.type === "text" && typeof block.text === "string") {
    return block.text.trim();
  }
  try {
    return JSON.stringify(block);
  } catch {
    return "";
  }
}

function normalizeClientToolResponse(response: unknown, sessionId: string, toolCallId: string): CallToolResult {
  if (isClientToolCallResponse(response)) {
    if (response.sessionId !== sessionId || response.toolCallId !== toolCallId) {
      return {
        content: [{
          type: "text",
          text: `Client tool response mismatch: expected ${sessionId}/${toolCallId}, got ${response.sessionId}/${response.toolCallId}`,
        }],
        isError: true,
      };
    }
    const result = CallToolResultSchema.safeParse(response.result);
    if (!result.success) {
      return {
        content: [{
          type: "text",
          text: `Invalid client tool result: ${result.error.message}`,
        }],
        isError: true,
      };
    }
    return result.data;
  }
  return {
    content: [{ type: "text", text: `Invalid client tool response envelope: ${typeof response === "string" ? response : JSON.stringify(response)}` }],
    isError: true,
  };
}

function isClientToolCallResponse(response: unknown): response is AcpClientToolCallResponse {
  if (!isRecord(response)) return false;
  return typeof response.sessionId === "string" &&
    typeof response.toolCallId === "string" &&
    isCallToolResult(response.result);
}

function sessionLogFields(
  session: AcpSession,
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    ...extra,
    sessionId: session.id,
    cwd: session.cwd,
    agentConfigPath: session.agent_config_path,
    agentDir: session.agent_dir,
    persistSessionId: session.persist_session_id,
    persistTaskId: session.persist_task_id,
    gatewayUrl: session.gateway_url,
    sandbox: session.sandbox_config,
    mcpServerCount: session.mcp_servers.length,
    agentConfig: summarizeAgentConfig(session.agent_config),
  };
}

function summarizeAgentConfig(config: AgentConfigPayload | undefined): Record<string, unknown> | null {
  if (!config) return null;
  return {
    name: config.name,
    executorType: config.executor_type,
    provider_id: config.provider_id,
    model: config.model,
    permissionMode: config.permission_mode,
    dangerouslySkipPermissions: config.dangerously_skip_permissions,
    mcpServerCount: Array.isArray(config.mcp_servers) ? config.mcp_servers.length : 0,
    skillCount: Array.isArray(config.skills) ? config.skills.length : 0,
    hasSystemPrompt: Boolean(config.system_prompt),
    hasAppendPrompt: Boolean(config.append_prompt),
    executorConfig: summarizeExecutorConfig(config.executor_config),
  };
}

function summarizeExecutorConfig(config: Record<string, unknown> | undefined): Record<string, unknown> | null {
  if (!config) return null;
  return {
    id: readConfigString(config, "id"),
    command: readConfigString(config, "command"),
    argsCount: Array.isArray(config.args) ? config.args.length : undefined,
    providerId: readConfigString(config, "provider_id"),
    baseUrl: readConfigString(config, "base_url"),
    approvalPolicy: readConfigString(config, "approval_policy"),
    sandbox: readConfigString(config, "sandbox"),
    hasSandboxPolicy: typeof config.sandbox_policy === "object" && config.sandbox_policy !== null,
    reasoningEffort: readConfigString(config, "reasoning_effort"),
    personality: readConfigString(config, "personality"),
    initTimeoutMs: typeof config.init_timeout_ms === "number" ? config.init_timeout_ms : undefined,
  };
}

function summarizeBackendCapabilities(capabilities: AcpAgentCapabilities | undefined): Record<string, unknown> | null {
  if (!capabilities) return null;
  return {
    loadSession: capabilities.loadSession,
    hasSessionCapabilities: Boolean(capabilities.sessionCapabilities),
    modes: capabilities.modes,
  };
}

function readConfigString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
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

function isCallToolResult(value: unknown): value is CallToolResult {
  return CallToolResultSchema.safeParse(value).success;
}

function steerRecordToResponse(record: AcpSteerPromptRecord): AcpSteerPromptResponse {
  return {
    promptId: record.id,
    sessionId: publicSteerSessionId(record.session_id),
    agentId: record.agent_id,
    userId: record.user_id,
    status: record.status,
    createdAt: record.created_at,
  };
}

function steerRecordToView(record: AcpSteerPromptRecord): AcpSteerPromptView {
  return {
    promptId: record.id,
    sessionId: publicSteerSessionId(record.session_id),
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

function publicSteerSessionId(sessionId: string): string {
  const separatorIndex = sessionId.indexOf(":");
  return separatorIndex >= 0 ? sessionId.slice(separatorIndex + 1) : sessionId;
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

function isFinishedToolStatus(status: string | null | undefined): boolean {
  return status === "completed" || status === "failed";
}

function getSessionStatus(session: AcpSession): AcpSessionStatus {
  return session.status;
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
    agentName: session.agent_config?.name,
    agentExecutorType: session.agent_config?.executor_type,
    agentConfigPath: session.agent_config_path,
    agentDir: session.agent_dir,
    initialPrompt: session.initial_prompt,
    agentCapabilities: session.agent_capabilities,
    configOptions: session.config_options,
    lastError: session.last_error,
  };
}

function recordToSummary(record: AcpSessionRecord): AcpSessionSummary {
  return {
    id: readRecordString(record.acp_record, "sessionId") ?? record.session_id,
    status: recordStatusToSessionStatus(record.status),
    cwd: record.cwd,
    createdAt: record.created_at,
    lastActiveAt: record.last_active_at,
    queueDepth: readRecordNumber(record.acp_record, "queueDepth") ?? 0,
    promptRunning: readRecordBoolean(record.acp_record, "promptRunning") ?? false,
    sdkSessionId: readRecordString(record.acp_record, "sdkSessionId") ?? readRecordString(record.acp_record, "sdk_session_id"),
    agentName: record.title,
    agentExecutorType: record.executor_type,
    agentConfigPath: record.agent_config_path,
    agentDir: record.agent_dir,
    initialPrompt: readRecordString(record.acp_record, "initialPrompt") ?? readRecordString(record.acp_record, "initial_prompt"),
    agentCapabilities: DEFAULT_AGENT_CAPABILITIES,
    configOptions: readConfigOptions(record.acp_record),
    lastError: record.last_error,
  };
}

function recordStatusToSessionStatus(status: AcpSessionRecordStatus): AcpSessionStatus {
  return status;
}

function indexStatusForSession(session: AcpSession): AcpSessionRecordStatus {
  if (session.status === "parked" || session.status === "finished" || session.status === "error") {
    return session.status;
  }
  return "active";
}

function mergeRecordAgentConfig(
  record: AcpSessionRecord,
  loadedConfig: AgentConfigPayload | null
): AgentConfigPayload {
  return {
    ...(loadedConfig ?? {}),
    name: loadedConfig?.name ?? record.title,
    executor_type: record.executor_type,
    permission_mode: loadedConfig?.permission_mode ?? record.permission_mode,
  };
}

function restoreBackendLoadSessionId(record: AcpSessionRecord): string {
  return readRecordString(record.acp_record, "backend_load_session_id") ??
    readRecordString(record.acp_record, "backendLoadSessionId") ??
    readRecordString(record.acp_record, "sdkSessionId") ??
    readRecordString(record.acp_record, "sdk_session_id") ??
    record.session_id;
}

function parseRecordDate(value: string): Date {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function readRecordString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function readRecordNumber(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readRecordBoolean(record: Record<string, unknown>, key: string): boolean | undefined {
  const value = record[key];
  return typeof value === "boolean" ? value : undefined;
}

function readConfigOptions(record: Record<string, unknown>): AcpConfigOption[] | undefined {
  const value = record.configOptions ?? record.config_options;
  return Array.isArray(value) ? value as AcpConfigOption[] : undefined;
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

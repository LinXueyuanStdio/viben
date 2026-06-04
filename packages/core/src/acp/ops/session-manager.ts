import { randomUUID } from "node:crypto";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { readMarkdownConfig } from "../../config/markdown";
import type { AgentConfigFile } from "../../agents";
import { clientToolCompletionRegistry } from "../../services/client-tool-completion";
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
  AcpNewSessionRequest,
  AcpNewSessionResponse,
  AcpPromptRequest,
  AcpPromptResponse,
  AcpSandboxConfig,
  AcpSessionContext,
  AcpSessionStatus,
  AcpSessionSummary,
  AgentConfigPayload,
} from "../types";
import { AcpPromptError, createAcpErrorDetail, getAcpErrorDetail } from "./errors";
import {
  createDefaultAcpBackendAdapter,
  type AcpBackendAdapter,
  type AcpBackendSession,
} from "./backend-adapter";

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
  connection: AcpConnection;
  gateway_url?: string;
  backend?: AcpBackendSession;
  prompt_running: boolean;
  prompt_queue: AcpPromptQueueItem[];
  sdk_session_id?: string;
  last_error?: AcpErrorDetail;
  config_options?: AcpConfigOption[];
  agent_capabilities: AcpAgentCapabilities;
}

export class AcpSessionManager {
  private sessions = new Map<string, AcpSession>();
  private backendAdapter: AcpBackendAdapter = createDefaultAcpBackendAdapter();

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
    const cwd = request.cwd ?? context.cwd ?? process.cwd();

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
      connection,
      gateway_url: context.gateway_url,
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
        agent_config_path: context.agent_config_path,
        agent_dir: context.agent_dir,
        agent_config: context.agent_config,
        persist_session_id: context.session_id,
        persist_task_id: context.task_id,
        sandbox_config: context.sandbox_config,
      },
      connection,
      context
    );
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
      item.reject(new AcpPromptError(getAcpErrorDetail(error)));
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

    const startRequest: AcpNewSessionRequest = {
      cwd: session.cwd,
      mcpServers: [],
      agent_config: session.agent_config,
      persist_session_id: session.persist_session_id,
      persist_task_id: session.persist_task_id,
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
    const accepted = clientToolCompletionRegistry.complete(toolUseId, session.id, result);
    if (!accepted) {
      log.warn({ sessionId: session.id, toolUseId }, "ACP client tool completion was not accepted");
    }
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

function isCallToolResult(value: unknown): value is AcpClientToolCallResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as { content?: unknown }).content)
  );
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
  };
}

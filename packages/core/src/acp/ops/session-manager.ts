import { randomUUID } from "node:crypto";
import { readMarkdownConfig } from "../../config/markdown";
import type { AgentConfigFile } from "../../agents";
import { SdkChatProxy } from "../../executors/chat/sdk-proxy";
import type { SSEMessage } from "../../executors/ops/types";
import { agentService } from "../../services/agent";
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

const log = globalLogger.child({ module: "acp-session-manager" });

const DEFAULT_AGENT_CAPABILITIES: AcpAgentCapabilities = {
  loadSession: true,
  modes: false,
  sessionCapabilities: {
    list: true,
    loadSession: true,
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
  active_proxy?: SdkChatProxy;
  prompt_running: boolean;
  prompt_queue: AcpPromptQueueItem[];
  sdk_session_id?: string;
  last_error?: AcpErrorDetail;
  config_options?: AcpConfigOption[];
  agent_capabilities: AcpAgentCapabilities;
}

export class AcpSessionManager {
  private sessions = new Map<string, AcpSession>();

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

    return {
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
      prompt_running: false,
      prompt_queue: [],
      agent_capabilities: DEFAULT_AGENT_CAPABILITIES,
    };
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

    agentService.stopSession(sessionId);
    clientToolCompletionRegistry.cancelSession(sessionId);
    if (session.active_proxy) {
      try {
        await session.active_proxy.steer("The user cancelled the current turn. Stop as soon as possible.");
      } catch {
        // The SDK proxy may not be steerable once the stream is already ending.
      }
    }
    log.info({ sessionId }, "ACP session cancelled");
    return true;
  }

  closeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    if (session.prompt_running) {
      agentService.stopSession(sessionId);
      clientToolCompletionRegistry.cancelSession(sessionId);
    }
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
      session.active_proxy = undefined;
      agentService.unregisterSession(session.id);

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

    agentService.registerSession(session.id);
    const proxy = new SdkChatProxy();
    session.active_proxy = proxy;
    agentService.registerProxy(session.id, proxy);

    const stream = proxy.executeStreaming({
      prompt,
      cwd: session.cwd,
      sessionId: session.id,
      resume: session.sdk_session_id,
      model: session.agent_config?.model,
      systemPrompt: session.agent_config?.system_prompt,
      appendPrompt: session.agent_config?.append_prompt,
      mcpServers: session.agent_config?.mcp_servers,
      skills: session.agent_config?.skills,
      dangerouslySkipPermissions: true,
      sandboxConfig: session.sandbox_config?.enabled
        ? {
            enabled: true,
            provider: session.sandbox_config.provider,
          }
        : undefined,
    });

    let stopReason: AcpPromptResponse["stopReason"] = "end_turn";

    for await (const message of stream) {
      if (agentService.isSessionAborted(session.id) || session.status === "cancelled") {
        stopReason = "cancelled";
        break;
      }

      const maybeStopReason = await this.handleStreamMessage(session, message);
      if (maybeStopReason) {
        stopReason = maybeStopReason;
      }
    }

    const response: AcpPromptResponse = { stopReason };
    if (stopReason === "error" && session.last_error) {
      response.error = session.last_error;
    }
    return response;
  }

  private async handleStreamMessage(
    session: AcpSession,
    message: SSEMessage
  ): Promise<AcpPromptResponse["stopReason"] | undefined> {
    switch (message.type) {
      case "sdk_session": {
        session.sdk_session_id = message.sdk_session_id;
        return undefined;
      }
      case "text": {
        session.connection.sendNotification("session/update", {
          sessionId: session.id,
          update: {
            sessionUpdate: "agent_message_chunk",
            content: { type: "text", text: message.content },
          },
        });
        return undefined;
      }
      case "thinking": {
        session.connection.sendNotification("session/update", {
          sessionId: session.id,
          update: {
            sessionUpdate: "agent_thought_chunk",
            content: { type: "text", text: message.content },
          },
        });
        return undefined;
      }
      case "tool_use": {
        session.connection.sendNotification("session/update", {
          sessionId: session.id,
          update: {
            sessionUpdate: "tool_call",
            toolCallId: message.id,
            title: message.name,
            kind: "other",
            status: "in_progress",
          },
        });

        if (clientToolCompletionRegistry.isClientSideTool(message.name)) {
          clientToolCompletionRegistry.enqueue(session.id, message.id, message.name);
          this.requestClientTool(session, message.id, message.name, message.input).catch((error) => {
            log.warn({ err: error, sessionId: session.id, toolUseId: message.id }, "ACP client tool request failed");
            clientToolCompletionRegistry.complete(message.id, session.id, {
              content: [{ type: "text", text: `Client tool failed: ${error.message}` }],
              isError: true,
            });
          });
        }
        return undefined;
      }
      case "tool_result": {
        session.connection.sendNotification("session/update", {
          sessionId: session.id,
          update: {
            sessionUpdate: "tool_call_update",
            toolCallId: message.tool_use_id,
            status: message.is_error ? "failed" : "completed",
          },
        });
        return undefined;
      }
      case "question": {
        const text = message.questions
          .map((question) => `${question.header}: ${question.question}`)
          .join("\n");
        session.connection.sendNotification("session/update", {
          sessionId: session.id,
          update: {
            sessionUpdate: "agent_message_chunk",
            content: { type: "text", text: `\n${text}\n` },
          },
        });
        return undefined;
      }
      case "error": {
        const errorDetail = createAcpErrorDetail(message.message, {
          source: "sdk_stream",
          details: message.details,
          stderr: message.stderr,
          stdout: message.stdout,
          exitCode: message.exitCode,
          signal: message.signal,
          claudePath: message.claudePath,
          code: message.code,
          cause: message.cause,
        });
        session.last_error = errorDetail;
        log.error({ sessionId: session.id, error: errorDetail }, "ACP agent stream error");
        session.connection.sendNotification("session/update", {
          sessionId: session.id,
          update: {
            sessionUpdate: "error",
            error: errorDetail,
            _meta: {
              source: "sdk_stream",
            },
          },
        });
        session.connection.sendNotification("session/update", {
          sessionId: session.id,
          update: {
            sessionUpdate: "agent_message_chunk",
            content: { type: "text", text: `\nError: ${message.message}\n` },
            _meta: {
              error: errorDetail,
            },
          },
        });
        return "error";
      }
      case "result": {
        return message.subtype === "error" ? "error" : "end_turn";
      }
      default:
        return undefined;
    }
  }

  private async requestClientTool(
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

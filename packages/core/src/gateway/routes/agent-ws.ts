/**
 * Agent WebSocket Route
 *
 * Provides WebSocket endpoint for bidirectional agent communication.
 * Supports interactive features like AskUserQuestion and EnterPlanMode
 * that require real-time client responses during agent execution.
 *
 * Protocol:
 * - Client sends: start, answer, approve, reject, cancel, steer, ping, exec_approve
 * - Server sends: session, text, thinking, tool_use, tool_result, question, plan, result, error, done, pong, exec_approval
 */
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { WebSocket } from "ws";
import { randomUUID } from "node:crypto";
import { agentService } from "../../services/agent";
import { sessionStoreService } from "../../services/session-store";
import { SdkChatProxy } from "../../executors/chat/sdk-proxy";
import { OpenClawChatProxy } from "../../executors/engines/openclaw/chat-proxy";
import { OpenClawConnectionManager, OpenClawClient } from "../../executors/engines/openclaw/connection";
import { OpenClawProcessManager } from "../../executors/engines/openclaw/process-manager";
import { loadGatewayConfig } from "../../executors/engines/openclaw/config";
import { resetEventMapper } from "../../executors/engines/openclaw/event-mapper";
import { trace, SpanKind, SpanStatusCode } from "@opentelemetry/api";
import { readMarkdownConfig } from "../../config/markdown";
import type { AgentConfigFile } from "../../agents";
import type { AgentMcpServerEntry } from "../../types";
import { logger as globalLogger } from "../../telemetry";
import { clientToolCompletionRegistry } from "../../services/client-tool-completion";

// Module-level logger
const log = globalLogger.child({ module: "agent-ws" });

// ============================================================================
// Types
// ============================================================================

/**
 * Query parameters for agent WebSocket connection
 * Supports both camelCase and snake_case
 */
interface AgentWsQuery {
  cwd?: string;
  agent_config_path?: string;
  agent_dir?: string;
  session_id?: string;
  task_id?: string;
}

/**
 * Agent configuration payload (inline config)
 */
interface AgentConfigPayload {
  name?: string;
  model?: string;
  provider?: string;
  system_prompt?: string;
  append_prompt?: string;
  temperature?: number;
  max_tokens?: number;
  executor_type?: string;
  executor_config?: Record<string, unknown>;
  mcp_servers?: (string | AgentMcpServerEntry)[];
  skills?: string[];
  plan_mode?: boolean;
  approvals?: boolean;
}

/**
 * Client to Server message types
 */
interface ClientMessage {
  type: "start" | "answer" | "approve" | "reject" | "cancel" | "steer" | "ping" | "exec_approve";
  // For "start" - begin agent execution
  prompt?: string;
  agent_config?: AgentConfigPayload;
  /** Resume from existing SDK session for multi-turn */
  resume?: string;
  // For "answer" - respond to AskUserQuestion
  question_id?: string;
  answers?: Record<string, string>;
  // For "approve" / "reject" - plan approval
  plan_id?: string;
  // For "steer" - inject message during agent execution
  message?: string;
  // For "exec_approve" - respond to exec approval request
  approval_id?: string;
  decision?: string; // "allow_once" | "allow_always" | "reject"
}

/**
 * Server to Client message types
 * Reuses the same format as SSE messages for compatibility (snake_case)
 */
interface ServerMessage {
  type: "session" | "sdk_session" | "status" | "text" | "thinking" | "tool_use" | "tool_result" | "question" | "plan" | "result" | "error" | "done" | "pong" | "exec_approval" | "context_usage";
  // session
  session_id?: string;
  trace_id?: string;
  // text / thinking
  content?: string;
  // tool_use
  id?: string;
  name?: string;
  input?: unknown;
  // tool_result
  tool_use_id?: string;
  output?: string;
  is_error?: boolean;
  // question
  questions?: Array<{
    question: string;
    header: string;
    options: Array<{ label: string; description?: string }>;
    multiSelect: boolean;
  }>;
  // plan
  plan?: {
    id: string;
    goal: string;
    steps: Array<{ id: string; description: string; status: string }>;
    notes?: string;
  };
  // result
  cost?: number;
  duration?: number;
  subtype?: "success" | "error" | "error_max_turns";
  // error
  message?: string;
  // sdk_session
  sdk_session_id?: string;
  // status
  status?: string;
  status_message?: string;
  // exec_approval
  approval_id?: string;
  tool_call?: {
    title?: string;
    kind?: "read" | "edit" | "execute";
    command?: string;
    cwd?: string;
  };
  options?: Array<{ id: string; label: string }>;
  // context_usage
  used?: number;
  total?: number;
}

/**
 * WebSocket session state
 */
interface WsSession {
  id: string;
  socket: WebSocket;
  agent_config_path?: string;
  agent_dir?: string;
  cwd: string;
  persist_session_id?: string;
  persist_task_id?: string;
  agent_config?: AgentConfigPayload;
  is_running: boolean;
  pending_question_resolver?: (answers: Record<string, string>) => void;
  pending_plan_resolver?: (approved: boolean) => void;
  pending_exec_approval_resolver?: (decision: string) => void;
  active_proxy?: import("../../executors/chat/sdk-proxy").SdkChatProxy;
  active_openclaw_proxy?: OpenClawChatProxy;
  active_openclaw_client?: OpenClawClient;
  active_openclaw_session_key?: string;
}

// ============================================================================
// Session Management
// ============================================================================

/** Active WebSocket sessions */
const wsSessions = new Map<string, WsSession>();

// WebSocket tracer
const tracer = trace.getTracer("viben-gateway-agent-ws", "1.0.0");

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a unique message ID
 */
function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Resolve agent ID from request parameters
 */
function resolveAgentId(agentConfigPath?: string, agentConfig?: AgentConfigPayload | null): string {
  if (agentConfigPath) {
    const match = agentConfigPath.match(/agents\/([^/]+)\/AGENTS\.md$/);
    if (match) return match[1];
  }
  if (agentConfig?.name) return agentConfig.name;
  return "default";
}

/**
 * Load agent config from an AGENTS.md file path
 */
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
    log.error({ err: error, configPath }, "Failed to load agent config");
    return null;
  }
}

/**
 * Send a message to the WebSocket client
 */
function sendMessage(socket: WebSocket, message: ServerMessage): void {
  try {
    socket.send(JSON.stringify(message));
  } catch (error) {
    log.error({ err: error }, "Failed to send message");
  }
}

// ============================================================================
// Agent Execution
// ============================================================================

/**
 * Format user answers as readable text for continuing conversation
 *
 * @param questions - Original questions
 * @param answers - User's answers (key = question index, value = selected option)
 * @returns Formatted answer text
 */
function formatAnswersAsText(
  questions: Array<{
    question: string;
    header: string;
    options: Array<{ label: string; description?: string }>;
    multiSelect: boolean;
  }>,
  answers: Record<string, string>
): string {
  const parts: string[] = [];

  for (const [key, value] of Object.entries(answers)) {
    const idx = parseInt(key, 10);
    const question = questions[idx];
    if (question) {
      parts.push(`${question.header}: ${value}`);
    } else {
      parts.push(`Answer: ${value}`);
    }
  }

  return parts.join("\n");
}

/**
 * Execute agent via OpenClaw gateway WebSocket
 *
 * When executor_type is "OPENCLAW", uses OpenClawChatProxy instead of SdkChatProxy.
 */
async function executeOpenClawAgent(session: WsSession, prompt: string, resume?: string): Promise<void> {
  const { socket, persist_session_id: persistSessionId, persist_task_id: persistTaskId, agent_config_path: agentConfigPath, agent_dir: agentDir, agent_config: agentConfig } = session;

  // Register session for abort control
  agentService.registerSession(session.id);
  session.is_running = true;

  sendMessage(socket, {
    type: "session",
    session_id: session.id,
  });

  log.info({ sessionId: session.id, resume: resume ?? null }, "OpenClaw session started");

  // Persist user message
  if (persistSessionId && persistTaskId && prompt) {
    try {
      const agentId = resolveAgentId(agentConfigPath, agentConfig);
      await sessionStoreService.appendUIMessage(agentId, persistSessionId, {
        id: generateMessageId(),
        taskId: persistTaskId,
        timestamp: new Date().toISOString(),
        type: "user",
        content: prompt,
      }, agentDir);
    } catch (e) {
      log.warn({ err: e }, "Failed to persist user message");
    }
  }

  try {
    // Initialize OpenClaw connection with executor_config overrides
    resetEventMapper();
    const executorConfig = agentConfig?.executor_config as {
      gateway?: {
        host?: string;
        port?: number;
        token?: string;
        password?: string;
      };
      cliPath?: string;
      autoStart?: boolean;
    } | undefined;
    const gwConfig = loadGatewayConfig({
      host: executorConfig?.gateway?.host,
      port: executorConfig?.gateway?.port,
      token: executorConfig?.gateway?.token,
      password: executorConfig?.gateway?.password,
      cliPath: executorConfig?.cliPath,
      autoStart: executorConfig?.autoStart,
    });

    // Reuse existing client if still connected
    let client: OpenClawClient;
    if (session.active_openclaw_client?.isConnected()) {
      client = session.active_openclaw_client;
      sendMessage(socket, { type: "status", status: "connected", status_message: "Reusing existing connection" });
    } else {
      // Status: connecting
      sendMessage(socket, { type: "status", status: "connecting", status_message: "Starting OpenClaw gateway..." });

      const processManager = new OpenClawProcessManager(gwConfig);
      await processManager.ensureRunning();

      const connectionManager = new OpenClawConnectionManager(gwConfig);
      await connectionManager.connect();

      // Status: connected
      sendMessage(socket, { type: "status", status: "connected", status_message: "Connected to OpenClaw gateway" });

      client = connectionManager.getClient();
      session.active_openclaw_client = client;
    }

    // Check if agent has approvals enabled (non-YOLO)
    const approvalMode = agentConfig?.approvals ? "interactive" : "yolo";
    const proxy = new OpenClawChatProxy(client, { approvalMode: approvalMode as "yolo" | "interactive" });
    session.active_openclaw_proxy = proxy;

    // Stream via OpenClaw (pass resume for multi-turn session continuity)
    const stream = proxy.stream({ prompt, sessionId: session.id, resume });

    // Status: session_active
    sendMessage(socket, { type: "status", status: "session_active", status_message: "Agent is processing..." });

    for await (const message of stream) {
      // Check cancellation
      if (agentService.isSessionAborted(session.id)) {
        await proxy.abort();
        sendMessage(socket, { type: "error", message: "Session cancelled by user" });
        break;
      }

      // Handle question messages
      if (message.type === "question") {
        const questionMsg = message as {
          type: "question";
          id: string;
          questions: Array<{
            question: string;
            header: string;
            options: Array<{ label: string; description?: string }>;
            multiSelect: boolean;
          }>;
        };

        agentService.storeQuestion(
          session.id,
          questionMsg.id,
          questionMsg.questions,
          { agent_config_path: agentConfigPath, workspace_path: session.cwd }
        );

        sendMessage(socket, message as ServerMessage);

        // Wait for user answer
        const answers = await new Promise<Record<string, string>>((resolve) => {
          session.pending_question_resolver = resolve;
        });

        agentService.answerQuestion(questionMsg.id, answers);

        // Send the answer back to OpenClaw session as a follow-up message
        if (session.active_openclaw_session_key) {
          const answerText = Object.entries(answers)
            .map(([q, a]) => `${q}: ${a}`)
            .join("\n");
          try {
            await client.chat.send({
              sessionKey: session.active_openclaw_session_key,
              message: answerText,
              idempotencyKey: randomUUID(),
            });
            log.info({ sessionId: session.id }, "Sent question answer back to OpenClaw session");
          } catch (err) {
            log.warn({ err }, "Failed to send answer back to OpenClaw session");
          }
        }
        continue;
      }

      // Handle exec_approval messages - forward with proper field mapping
      if (message.type === "exec_approval") {
        const approvalMsg = message as { type: "exec_approval"; id: string; tool_call: { title?: string; kind?: "read" | "edit" | "execute"; command?: string; cwd?: string }; options: Array<{ id: string; label: string }> };
        sendMessage(socket, {
          type: "exec_approval",
          approval_id: approvalMsg.id,
          id: approvalMsg.id,
          tool_call: approvalMsg.tool_call,
          options: approvalMsg.options,
        } as ServerMessage);
        continue;
      }

      // Track session key for steer/follow-up support
      if (message.type === "sdk_session") {
        session.active_openclaw_session_key = (message as { sdk_session_id?: string }).sdk_session_id;
      }

      // Persist sdk_session message for resume support
      if (message.type === "sdk_session" && persistSessionId && persistTaskId) {
        try {
          const agentId = resolveAgentId(agentConfigPath, agentConfig);
          await sessionStoreService.appendUIMessage(agentId, persistSessionId, {
            id: generateMessageId(),
            taskId: persistTaskId,
            timestamp: new Date().toISOString(),
            type: "sdk_session",
            sdkSessionId: (message as { sdk_session_id?: string }).sdk_session_id,
          }, agentDir);
        } catch (e) {
          log.warn({ err: e }, "Failed to persist sdk_session message");
        }
      }

      // Persist assistant text messages
      if (message.type === "text" && persistSessionId && persistTaskId) {
        try {
          const agentId = resolveAgentId(agentConfigPath, agentConfig);
          await sessionStoreService.appendUIMessage(agentId, persistSessionId, {
            id: generateMessageId(),
            taskId: persistTaskId,
            timestamp: new Date().toISOString(),
            type: "text",
            content: (message as { content?: string }).content ?? "",
          }, agentDir);
        } catch (e) {
          log.warn({ err: e }, "Failed to persist text message");
        }
      }

      // Persist tool_use messages
      if (message.type === "tool_use" && persistSessionId && persistTaskId) {
        try {
          const agentId = resolveAgentId(agentConfigPath, agentConfig);
          const toolMsg = message as { id?: string; name?: string; input?: unknown };
          await sessionStoreService.appendUIMessage(agentId, persistSessionId, {
            id: generateMessageId(),
            taskId: persistTaskId,
            timestamp: new Date().toISOString(),
            type: "tool_use",
            toolUseId: toolMsg.id,
            toolName: toolMsg.name,
            toolInput: toolMsg.input,
          }, agentDir);
        } catch (e) {
          log.warn({ err: e }, "Failed to persist tool_use message");
        }
      }

      // Persist tool_result messages
      if (message.type === "tool_result" && persistSessionId && persistTaskId) {
        try {
          const agentId = resolveAgentId(agentConfigPath, agentConfig);
          const resultMsg = message as { tool_use_id?: string; output?: string; is_error?: boolean };
          await sessionStoreService.appendUIMessage(agentId, persistSessionId, {
            id: generateMessageId(),
            taskId: persistTaskId,
            timestamp: new Date().toISOString(),
            type: "tool_result",
            toolUseId: resultMsg.tool_use_id,
            toolOutput: resultMsg.output,
            isError: resultMsg.is_error,
          }, agentDir);
        } catch (e) {
          log.warn({ err: e }, "Failed to persist tool_result message");
        }
      }

      // Send message to client
      sendMessage(socket, message as ServerMessage);
    }

    log.info({ sessionId: session.id }, "OpenClaw stream completed");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error({ err: error }, "OpenClaw execution error");
    sendMessage(socket, { type: "error", message: errorMessage });
  } finally {
    session.is_running = false;
    session.active_openclaw_proxy = undefined;
    // Keep active_openclaw_client and active_openclaw_session_key alive for follow-up steer
    agentService.unregisterSession(session.id);
    sendMessage(socket, { type: "done" });
    log.info({ sessionId: session.id }, "OpenClaw session completed");
  }
}

/**
 * Execute agent with WebSocket streaming
 *
 * This function runs the agent and streams messages back through the WebSocket.
 * When the agent needs user input (AskUserQuestion), it:
 * 1. Sends the question to the client
 * 2. Waits for user answer
 * 3. Formats the answer as text and continues with a new agent execution
 *
 * This approach follows the workany pattern: since Claude Agent SDK's query()
 * terminates when AskUserQuestion is called, we continue by sending the user's
 * answer as a new message to the agent.
 */
async function executeAgent(session: WsSession, prompt: string, isFollowUp = false, resume?: string): Promise<void> {
  const { socket, cwd, agent_config_path: agentConfigPath, agent_dir: agentDir, persist_session_id: persistSessionId, persist_task_id: persistTaskId, agent_config: agentConfig } = session;
  const perfT0 = Date.now();

  // Create trace span
  const span = tracer.startSpan("agent-ws.execute", {
    kind: SpanKind.SERVER,
    attributes: {
      "agent.config_path": agentConfigPath || "inline",
      "agent.cwd": cwd,
      "prompt.length": prompt.length,
      "is_follow_up": isFollowUp,
    },
  });
  const traceId = span.spanContext().traceId;

  // Register session for abort control (only on first execution)
  if (!isFollowUp) {
    agentService.registerSession(session.id);
    session.is_running = true;

    // Send session message
    sendMessage(socket, {
      type: "session",
      session_id: session.id,
      trace_id: traceId,
    });

    log.info({ sessionId: session.id }, "Session started");
  } else {
    log.info({ sessionId: session.id }, "Continuing session");
  }

  // Persist user message if persistence is enabled
  if (persistSessionId && persistTaskId && prompt) {
    try {
      const agentId = resolveAgentId(agentConfigPath, agentConfig);
      await sessionStoreService.appendUIMessage(agentId, persistSessionId, {
        id: generateMessageId(),
        taskId: persistTaskId,
        timestamp: new Date().toISOString(),
        type: "user",
        content: prompt,
      }, agentDir);
    } catch (e) {
      log.warn({ err: e }, "Failed to persist user message");
    }
  }

  try {
    // Create SDK proxy
    const proxy = new SdkChatProxy();
    session.active_proxy = proxy;

    // Execute streaming
    log.info({ sessionId: session.id, resume: resume || null, elapsed: Date.now() - perfT0 }, "[perf] Starting executeStreaming");
    const stream = proxy.executeStreaming({
      prompt,
      cwd,
      sessionId: session.id,
      resume,
      model: agentConfig?.model,
      systemPrompt: agentConfig?.system_prompt,
      appendPrompt: agentConfig?.append_prompt,
      mcpServers: agentConfig?.mcp_servers,
      skills: agentConfig?.skills,
      dangerouslySkipPermissions: true,
    });

    // Stream messages to client
    let msgCount = 0;
    let perfFirstMsgTime = 0;
    for await (const message of stream) {
      msgCount++;
      if (msgCount === 1) {
        perfFirstMsgTime = Date.now() - perfT0;
        log.info({ sessionId: session.id, firstMsgMs: perfFirstMsgTime, type: message.type }, "[perf] First SDK message");
      }

      // Check if session was cancelled
      if (agentService.isSessionAborted(session.id)) {
        log.info({ sessionId: session.id }, "Session cancelled");
        sendMessage(socket, { type: "error", message: "Session cancelled by user" });
        break;
      }

      // Handle question messages - need to wait for user response
      if (message.type === "question") {
        const questionMsg = message as {
          type: "question";
          id: string;
          questions: Array<{
            question: string;
            header: string;
            options: Array<{ label: string; description?: string }>;
            multiSelect: boolean;
          }>;
        };

        // Store question for tracking
        agentService.storeQuestion(
          session.id,
          questionMsg.id,
          questionMsg.questions,
          { agent_config_path: agentConfigPath, workspace_path: cwd }
        );

        // Send question to client
        sendMessage(socket, message as ServerMessage);

        // Wait for user answer
        log.info({ questionId: questionMsg.id }, "Waiting for answer to question");

        const answers = await new Promise<Record<string, string>>((resolve) => {
          session.pending_question_resolver = resolve;
        });

        log.info({ questionId: questionMsg.id }, "Received answer for question");

        // Mark question as answered
        agentService.answerQuestion(questionMsg.id, answers);

        // Format answers as text for continuing conversation
        const answerText = formatAnswersAsText(questionMsg.questions, answers);

        // Add user's answer as a message to UI
        const userAnswerMsg: ServerMessage = {
          type: "text",
          content: `User response:\n${answerText}`,
        };
        sendMessage(socket, userAnswerMsg);

        // Persist user answer
        if (persistSessionId && persistTaskId) {
          try {
            const agentId = resolveAgentId(agentConfigPath, agentConfig);
            await sessionStoreService.appendUIMessage(agentId, persistSessionId, {
              id: generateMessageId(),
              taskId: persistTaskId,
              timestamp: new Date().toISOString(),
              type: "user",
              content: answerText,
            }, agentDir);
          } catch (e) {
            log.warn({ err: e }, "Failed to persist user answer");
          }
        }

        // End current span before recursion
        span.setStatus({ code: SpanStatusCode.OK });
        span.end();

        // Continue execution by calling executeAgent recursively with the answer
        // This follows the workany pattern: restart conversation with user's answer
        await executeAgent(session, answerText, true);
        return; // Exit current execution, continuation handles the rest
      }

      // Client-side tool detection: enqueue for frontend execution
      if (message.type === "tool_use") {
        const toolMsg = message as { type: "tool_use"; id: string; name: string; input: unknown };
        if (clientToolCompletionRegistry.isClientSideTool(toolMsg.name)) {
          clientToolCompletionRegistry.enqueue(session.id, toolMsg.id, toolMsg.name);
        }
      }

      // Send other messages directly
      sendMessage(socket, message as ServerMessage);

      // Persist message if enabled
      if (persistSessionId && persistTaskId) {
        try {
          const agentId = resolveAgentId(agentConfigPath, agentConfig);
          await sessionStoreService.appendUIMessage(agentId, persistSessionId, {
            id: generateMessageId(),
            taskId: persistTaskId,
            timestamp: new Date().toISOString(),
            type: message.type,
            content: "content" in message ? (message as { content: string }).content : undefined,
            toolUseId:
              message.type === "tool_use"
                ? (message as { id: string }).id
                : message.type === "tool_result"
                  ? (message as { tool_use_id: string }).tool_use_id
                  : undefined,
            toolName: message.type === "tool_use" ? (message as { name: string }).name : undefined,
            toolInput: message.type === "tool_use" ? (message as { input: unknown }).input : undefined,
            toolOutput:
              message.type === "tool_result" ? (message as { output: string }).output : undefined,
            isError:
              message.type === "tool_result" ? (message as { is_error?: boolean }).is_error : undefined,
          }, agentDir);
        } catch (e) {
          log.warn({ err: e }, "Failed to persist message");
        }
      }
    }

    log.info({ sessionId: session.id, totalMs: Date.now() - perfT0, msgCount, firstMsgMs: perfFirstMsgTime }, "[perf] Stream completed");
    span.setStatus({ code: SpanStatusCode.OK });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error({ err: error, errorMessage }, "Execution error");

    span.setStatus({ code: SpanStatusCode.ERROR, message: errorMessage });
    span.recordException(error instanceof Error ? error : new Error(errorMessage));

    sendMessage(socket, { type: "error", message: errorMessage });
  } finally {
    // Only cleanup on the outermost call (not follow-ups that returned early)
    if (!isFollowUp || !session.is_running) {
      session.is_running = false;
      session.active_proxy = undefined;
      agentService.unregisterSession(session.id);

      // Send done message
      sendMessage(socket, { type: "done" });

      log.info({ sessionId: session.id }, "Session completed");
    }
    span.end();
  }
}

// ============================================================================
// WebSocket Route Registration
// ============================================================================

/**
 * Register agent WebSocket routes
 *
 * Note: @fastify/websocket plugin must be registered at the gateway level before calling this function.
 * This prevents ERR_HTTP_SOCKET_ASSIGNED errors from multiple registrations.
 */
export function registerAgentWsRoutes(fastify: FastifyInstance): void {
  // Check if websocket plugin is registered by looking for the decorator
  if (!fastify.hasDecorator("websocketServer")) {
    log.warn("@fastify/websocket not registered, agent WebSocket routes disabled");
    return;
  }

  fastify.get<{
    Querystring: AgentWsQuery;
  }>("/ws/agent/run", { websocket: true }, (socket: WebSocket, req: FastifyRequest) => {
        const query = req.query as AgentWsQuery;
        const sessionId = randomUUID();

        const session: WsSession = {
          id: sessionId,
          socket,
          agent_config_path: query.agent_config_path,
          agent_dir: query.agent_dir,
          cwd: query.cwd || process.cwd(),
          persist_session_id: query.session_id,
          persist_task_id: query.task_id,
          is_running: false,
        };

        wsSessions.set(sessionId, session);
        log.info({ sessionId }, "WebSocket connected");

        // Handle incoming messages
        socket.on("message", async (data: Buffer) => {
          try {
            const msg = JSON.parse(data.toString()) as ClientMessage;
            log.debug({ messageType: msg.type }, "Received message");

            switch (msg.type) {
              case "start": {
                if (session.is_running) {
                  sendMessage(socket, {
                    type: "error",
                    message: "Agent is already running. Send 'cancel' first to stop.",
                  });
                  return;
                }

                if (!msg.prompt) {
                  sendMessage(socket, { type: "error", message: "Prompt is required" });
                  return;
                }

                // Load agent config from path
                let agentConfig = msg.agent_config;
                const configPath = query.agent_config_path;
                if (configPath) {
                  const loadedConfig = await loadAgentConfigFromPath(configPath);
                  if (loadedConfig) {
                    agentConfig = loadedConfig;
                  }
                }
                session.agent_config = agentConfig;

                // Route to appropriate executor based on type
                const executorType = agentConfig?.executor_type?.toUpperCase();
                if (executorType === "OPENCLAW") {
                  executeOpenClawAgent(session, msg.prompt, msg.resume).catch((err) => {
                    log.error({ err }, "Unhandled OpenClaw execution error");
                  });
                } else {
                  executeAgent(session, msg.prompt, false, msg.resume).catch((err) => {
                    log.error({ err }, "Unhandled execution error");
                  });
                }
                break;
              }

              case "answer": {
                if (!msg.question_id || !msg.answers) {
                  sendMessage(socket, {
                    type: "error",
                    message: "question_id and answers are required",
                  });
                  return;
                }

                // Resolve pending question
                if (session.pending_question_resolver) {
                  session.pending_question_resolver(msg.answers);
                  session.pending_question_resolver = undefined;
                } else {
                  agentService.answerQuestion(msg.question_id, msg.answers);
                }
                break;
              }

              case "approve": {
                if (!msg.plan_id) {
                  sendMessage(socket, { type: "error", message: "plan_id is required" });
                  return;
                }

                const approved = agentService.approvePlan(msg.plan_id);
                if (!approved) {
                  sendMessage(socket, {
                    type: "error",
                    message: `Plan not found or already processed: ${msg.plan_id}`,
                  });
                  return;
                }

                if (session.pending_plan_resolver) {
                  session.pending_plan_resolver(true);
                  session.pending_plan_resolver = undefined;
                }
                break;
              }

              case "reject": {
                if (!msg.plan_id) {
                  sendMessage(socket, { type: "error", message: "plan_id is required" });
                  return;
                }

                const rejected = agentService.rejectPlan(msg.plan_id);
                if (!rejected) {
                  sendMessage(socket, {
                    type: "error",
                    message: `Plan not found or already processed: ${msg.plan_id}`,
                  });
                  return;
                }

                if (session.pending_plan_resolver) {
                  session.pending_plan_resolver(false);
                  session.pending_plan_resolver = undefined;
                }
                break;
              }

              case "exec_approve": {
                if (!msg.approval_id || !msg.decision) {
                  sendMessage(socket, {
                    type: "error",
                    message: "approval_id and decision are required",
                  });
                  return;
                }

                // Resolve pending exec approval via the proxy
                if (session.active_openclaw_proxy) {
                  session.active_openclaw_proxy.resolveApproval(msg.decision);
                }
                break;
              }

              case "cancel": {
                if (!session.is_running) {
                  sendMessage(socket, { type: "error", message: "No agent is running" });
                  return;
                }

                // Abort the session
                agentService.stopSession(session.id);

                // Abort OpenClaw proxy if active
                if (session.active_openclaw_proxy) {
                  session.active_openclaw_proxy.abort().catch(() => {});
                }

                // Reject any pending promises
                if (session.pending_question_resolver) {
                  session.pending_question_resolver({});
                  session.pending_question_resolver = undefined;
                }
                if (session.pending_plan_resolver) {
                  session.pending_plan_resolver(false);
                  session.pending_plan_resolver = undefined;
                }
                if (session.pending_exec_approval_resolver) {
                  session.pending_exec_approval_resolver("reject");
                  session.pending_exec_approval_resolver = undefined;
                }
                break;
              }

              case "steer": {
                if (!msg.message) {
                  sendMessage(socket, { type: "error", message: "message is required for steer" });
                  return;
                }

                // OpenClaw follow-up: works both mid-stream and post-stream
                if (session.active_openclaw_client && session.active_openclaw_session_key) {
                  if (session.is_running) {
                    // Mid-stream: can't send follow-up while agent is active
                    log.info({ sessionId: session.id }, "Steer received mid-stream for OpenClaw");
                    sendMessage(socket, { type: "error", message: "Please wait for the current response to complete before sending follow-up messages" });
                  } else {
                    // Post-stream: send as a new turn in the same session
                    try {
                      log.info({ sessionId: session.id, msgLength: msg.message.length }, "Sending OpenClaw follow-up message");
                      await executeOpenClawAgent(session, msg.message, session.active_openclaw_session_key);
                    } catch (err) {
                      const errMsg = err instanceof Error ? err.message : String(err);
                      log.warn({ err }, "Failed to send OpenClaw follow-up");
                      sendMessage(socket, { type: "error", message: `Follow-up failed: ${errMsg}` });
                    }
                  }
                  break;
                }

                // Standard SDK proxy steer
                if (!session.is_running) {
                  sendMessage(socket, { type: "error", message: "No agent is running to steer" });
                  return;
                }
                if (session.active_proxy) {
                  try {
                    await session.active_proxy.steer(msg.message);
                    log.info({ sessionId: session.id, msgLength: msg.message.length }, "Steering message injected");
                  } catch (err) {
                    const errMsg = err instanceof Error ? err.message : String(err);
                    log.warn({ err }, "Failed to inject steering message");
                    sendMessage(socket, { type: "error", message: `Steering failed: ${errMsg}` });
                  }
                } else {
                  sendMessage(socket, { type: "error", message: "No active proxy to steer" });
                }
                break;
              }

              case "ping": {
                // Respond to heartbeat ping with pong
                sendMessage(socket, { type: "pong" } as ServerMessage);
                break;
              }

              default:
                sendMessage(socket, {
                  type: "error",
                  message: `Unknown message type: ${(msg as { type: string }).type}`,
                });
            }
          } catch (error) {
            log.error({ err: error }, "Failed to parse message");
            sendMessage(socket, { type: "error", message: "Failed to parse message" });
          }
        });

        // Handle WebSocket close
        socket.on("close", () => {
          log.info({ sessionId }, "WebSocket disconnected");

          // Abort any running session
          if (session.is_running) {
            agentService.stopSession(session.id);
          }

          // Cleanup
          wsSessions.delete(sessionId);
        });

        // Handle WebSocket error
        socket.on("error", (err) => {
          log.error({ err, sessionId }, "WebSocket error");

          // Abort any running session
          if (session.is_running) {
            agentService.stopSession(session.id);
          }

          // Cleanup
          wsSessions.delete(sessionId);
        });
      });

  log.info("Agent WebSocket routes registered at /ws/agent/run");
}

/**
 * Get active WebSocket session count
 */
export function getActiveWsSessionCount(): number {
  return wsSessions.size;
}

/**
 * Close all WebSocket sessions
 */
export function closeAllWsSessions(): void {
  for (const [sessionId, session] of wsSessions) {
    try {
      if (session.is_running) {
        agentService.stopSession(session.id);
      }
      session.socket.close();
    } catch {
      // Ignore errors
    }
    wsSessions.delete(sessionId);
  }
}

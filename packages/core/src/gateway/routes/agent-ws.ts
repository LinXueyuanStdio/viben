/**
 * Agent WebSocket Route
 *
 * Provides WebSocket endpoint for bidirectional agent communication.
 * Supports interactive features like AskUserQuestion and EnterPlanMode
 * that require real-time client responses during agent execution.
 *
 * Protocol:
 * - Client sends: start, answer, approve, reject, cancel
 * - Server sends: session, text, tool_use, tool_result, question, plan, result, error, done
 */
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { WebSocket } from "ws";
import { randomUUID } from "node:crypto";
import { agentService } from "../../services/agent";
import { sessionStoreService } from "../../services/session-store";
import { SdkChatProxy } from "../../executors/chat/sdk-proxy";
import { trace, SpanKind, SpanStatusCode } from "@opentelemetry/api";
import { readMarkdownConfig } from "../../config/markdown";
import type { AgentConfigFile } from "../../agents";
import { logger as globalLogger } from "../../telemetry";

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
  /** Working directory for the agent */
  cwd?: string;
  /** Path to agent AGENTS.md config file - camelCase */
  agentConfigPath?: string;
  /** Path to agent AGENTS.md config file - snake_case */
  agent_config_path?: string;
  /** Session ID for persistence - camelCase */
  sessionId?: string;
  /** Session ID for persistence - snake_case */
  session_id?: string;
  /** Task ID for persistence - camelCase */
  taskId?: string;
  /** Task ID for persistence - snake_case */
  task_id?: string;
}

/**
 * Agent configuration payload (inline config)
 */
interface AgentConfigPayload {
  name?: string;
  model?: string;
  provider?: string;
  systemPrompt?: string;
  appendPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  executorType?: string;
  mcpServers?: string[];
  skills?: string[];
  planMode?: boolean;
  approvals?: boolean;
}

/**
 * Client to Server message types
 */
interface ClientMessage {
  type: "start" | "answer" | "approve" | "reject" | "cancel" | "steer" | "ping";
  // For "start" - begin agent execution
  prompt?: string;
  agentConfig?: AgentConfigPayload;
  // For "answer" - respond to AskUserQuestion
  questionId?: string;
  answers?: Record<string, string>;
  // For "approve" / "reject" - plan approval
  planId?: string;
  // For "steer" - inject message during agent execution
  message?: string;
}

/**
 * Server to Client message types
 * Reuses the same format as SSE messages for compatibility (snake_case)
 */
interface ServerMessage {
  type: "session" | "text" | "tool_use" | "tool_result" | "question" | "plan" | "result" | "error" | "done" | "pong";
  // session
  session_id?: string;
  trace_id?: string;
  // text
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
}

/**
 * WebSocket session state
 */
interface WsSession {
  id: string;
  socket: WebSocket;
  /** Path to agent AGENTS.md config file */
  agent_config_path?: string;
  cwd: string;
  persist_session_id?: string;
  persist_task_id?: string;
  agent_config?: AgentConfigPayload;
  is_running: boolean;
  // Promise resolver for waiting on user input
  pending_question_resolver?: (answers: Record<string, string>) => void;
  pending_plan_resolver?: (approved: boolean) => void;
  // Active proxy for steering
  active_proxy?: import("../../executors/chat/sdk-proxy").SdkChatProxy;
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
      systemPrompt: systemPrompt || undefined,
      appendPrompt: config.appendPrompt,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      executorType: config.executorType,
      mcpServers: config.mcpServers,
      skills: config.skills,
      planMode: config.planMode,
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
async function executeAgent(session: WsSession, prompt: string, isFollowUp = false): Promise<void> {
  const { socket, cwd, agent_config_path: agentConfigPath, persist_session_id: persistSessionId, persist_task_id: persistTaskId, agent_config: agentConfig } = session;

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
      }, agentConfigPath);
    } catch (e) {
      log.warn({ err: e }, "Failed to persist user message");
    }
  }

  try {
    // Create SDK proxy
    const proxy = new SdkChatProxy();
    session.active_proxy = proxy;

    // Execute streaming
    const stream = proxy.executeStreaming({
      prompt,
      cwd,
      sessionId: session.id,
      model: agentConfig?.model,
      systemPrompt: agentConfig?.systemPrompt,
      appendPrompt: agentConfig?.appendPrompt,
      mcpServers: agentConfig?.mcpServers,
      skills: agentConfig?.skills,
      dangerouslySkipPermissions: true,
    });

    // Stream messages to client
    for await (const message of stream) {
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
            }, agentConfigPath);
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
          }, agentConfigPath);
        } catch (e) {
          log.warn({ err: e }, "Failed to persist message");
        }
      }
    }

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

        // Create session with agent config path (support both camelCase and snake_case)
        const session: WsSession = {
          id: sessionId,
          socket,
          agent_config_path: query.agentConfigPath || query.agent_config_path,
          cwd: query.cwd || process.cwd(),
          persist_session_id: query.sessionId || query.session_id,
          persist_task_id: query.taskId || query.task_id,
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

                // Load agent config from path (support both camelCase and snake_case)
                let agentConfig = msg.agentConfig;
                const configPath = query.agentConfigPath || query.agent_config_path;
                if (configPath) {
                  const loadedConfig = await loadAgentConfigFromPath(configPath);
                  if (loadedConfig) {
                    agentConfig = loadedConfig;
                  }
                }
                session.agent_config = agentConfig;

                // Start agent execution (non-blocking)
                executeAgent(session, msg.prompt).catch((err) => {
                  log.error({ err }, "Unhandled execution error");
                });
                break;
              }

              case "answer": {
                if (!msg.questionId || !msg.answers) {
                  sendMessage(socket, {
                    type: "error",
                    message: "questionId and answers are required",
                  });
                  return;
                }

                // Resolve pending question
                if (session.pending_question_resolver) {
                  session.pending_question_resolver(msg.answers);
                  session.pending_question_resolver = undefined;
                } else {
                  // Store answer for later use (if not waiting synchronously)
                  agentService.answerQuestion(msg.questionId, msg.answers);
                }
                break;
              }

              case "approve": {
                if (!msg.planId) {
                  sendMessage(socket, { type: "error", message: "planId is required" });
                  return;
                }

                const approved = agentService.approvePlan(msg.planId);
                if (!approved) {
                  sendMessage(socket, {
                    type: "error",
                    message: `Plan not found or already processed: ${msg.planId}`,
                  });
                  return;
                }

                // Resolve pending plan approval
                if (session.pending_plan_resolver) {
                  session.pending_plan_resolver(true);
                  session.pending_plan_resolver = undefined;
                }
                break;
              }

              case "reject": {
                if (!msg.planId) {
                  sendMessage(socket, { type: "error", message: "planId is required" });
                  return;
                }

                const rejected = agentService.rejectPlan(msg.planId);
                if (!rejected) {
                  sendMessage(socket, {
                    type: "error",
                    message: `Plan not found or already processed: ${msg.planId}`,
                  });
                  return;
                }

                // Resolve pending plan approval
                if (session.pending_plan_resolver) {
                  session.pending_plan_resolver(false);
                  session.pending_plan_resolver = undefined;
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

                // Reject any pending promises
                if (session.pending_question_resolver) {
                  session.pending_question_resolver({});
                  session.pending_question_resolver = undefined;
                }
                if (session.pending_plan_resolver) {
                  session.pending_plan_resolver(false);
                  session.pending_plan_resolver = undefined;
                }
                break;
              }

              case "steer": {
                if (!session.is_running) {
                  sendMessage(socket, { type: "error", message: "No agent is running to steer" });
                  return;
                }
                if (!msg.message) {
                  sendMessage(socket, { type: "error", message: "message is required for steer" });
                  return;
                }
                if (!session.active_proxy) {
                  sendMessage(socket, { type: "error", message: "No active proxy to steer" });
                  return;
                }
                try {
                  await session.active_proxy.steer(msg.message);
                  log.info({ sessionId: session.id, msgLength: msg.message.length }, "Steering message injected");
                } catch (err) {
                  const errMsg = err instanceof Error ? err.message : String(err);
                  log.warn({ err }, "Failed to inject steering message");
                  sendMessage(socket, { type: "error", message: `Steering failed: ${errMsg}` });
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

/**
 * Agent Run Routes
 *
 * SSE endpoints for agent streaming execution:
 * - POST /api/agent/run - Start agent task with SSE streaming
 * - POST /api/agent/stop/:sessionId - Stop a running session
 * - POST /api/agent/approve/:planId - Approve a plan
 * - POST /api/agent/reject/:planId - Reject a plan
 * - GET /api/agent/tasks/subscribe - Subscribe to background task updates (SSE)
 * - POST /api/agent/tasks/:taskId/stop - Stop a background task
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import { agentService } from "../../services/agent";
import { backgroundTaskManager } from "../../services/background-tasks";
import { sessionStoreService } from "../../services/session-store";
import { SdkChatProxy } from "../../executors/chat/sdk-proxy";
import { trace, context, SpanStatusCode } from "../../telemetry";
import type { Span } from "../../telemetry";
import { getSpanName } from "../../telemetry/route-names";
import { readYaml } from "../../config/yaml";
import type { AgentConfigFile } from "../../agents";

// ============================================================================
// Structured Logger for Agent Run
// ============================================================================

/**
 * Log levels for agent-run logging
 */
type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Structured log entry for agent-run operations
 */
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  sessionId?: string;
  traceId?: string;
  phase: string;
  event: string;
  duration?: number;
  details?: Record<string, unknown>;
}

/**
 * Create a structured logger for a specific session
 */
function createSessionLogger(sessionId: string, traceId?: string) {
  const startTime = Date.now();

  const log = (level: LogLevel, phase: string, event: string, details?: Record<string, unknown>) => {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      sessionId,
      traceId,
      phase,
      event,
      duration: Date.now() - startTime,
      details,
    };

    // Format: [agent-run] [sessionId] [phase] event - details
    const prefix = `[agent-run] [${sessionId}]`;
    const message = `${prefix} [${phase}] ${event}`;

    switch (level) {
      case "debug":
        if (process.env.DEBUG || process.env.VIBEN_DEBUG) {
          console.debug(message, details ? JSON.stringify(details) : "");
        }
        break;
      case "info":
        console.log(message, details ? JSON.stringify(details) : "");
        break;
      case "warn":
        console.warn(message, details ? JSON.stringify(details) : "");
        break;
      case "error":
        console.error(message, details ? JSON.stringify(details) : "");
        break;
    }

    return entry;
  };

  return {
    debug: (phase: string, event: string, details?: Record<string, unknown>) =>
      log("debug", phase, event, details),
    info: (phase: string, event: string, details?: Record<string, unknown>) =>
      log("info", phase, event, details),
    warn: (phase: string, event: string, details?: Record<string, unknown>) =>
      log("warn", phase, event, details),
    error: (phase: string, event: string, details?: Record<string, unknown>) =>
      log("error", phase, event, details),
    /** Get elapsed time since session start */
    elapsed: () => Date.now() - startTime,
  };
}

/**
 * Agent configuration passed from frontend (inline config)
 */
export interface AgentConfigPayload {
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
 * Resolve agent ID from request parameters
 *
 * Priority:
 * 1. Extract from agentPath (e.g., .../agents/<agent-id>/config.yaml)
 * 2. Use agentConfig.name if provided
 * 3. Default to 'default'
 */
function resolveAgentId(agentPath?: string, agentConfig?: AgentConfigPayload | null): string {
  // 1. From agentPath: extract agent-id from path like .../agents/<agent-id>/config.yaml
  if (agentPath) {
    const match = agentPath.match(/agents\/([^/]+)\/config\.yaml$/);
    if (match) return match[1];
  }
  // 2. From agentConfig.name
  if (agentConfig?.name) return agentConfig.name;
  // 3. Default
  return "default";
}

/**
 * Generate a unique message ID
 */
function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Generate a unique internal session ID for abort control
 * Uses UUID v4 format for compatibility with Claude Agent SDK
 */
function generateInternalSessionId(): string {
  return randomUUID();
}

/**
 * Load agent config from a YAML file path
 * @param configPath - Path to the agent config.yaml file
 * @returns AgentConfigPayload or null if not found
 */
async function loadAgentConfigFromPath(configPath: string): Promise<AgentConfigPayload | null> {
  try {
    const config = await readYaml<AgentConfigFile>(configPath);
    if (!config) return null;

    return {
      name: config.name,
      model: config.model,
      provider: config.provider,
      systemPrompt: config.systemPrompt,
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
    console.error(`[agent-run] Failed to load agent config from ${configPath}:`, error);
    return null;
  }
}

// ============================================================================
// SSE Message Types
// ============================================================================

/**
 * SSE event types for agent streaming
 */
export type SSEEventType =
  | "session"
  | "text"
  | "tool_use"
  | "tool_result"
  | "plan"
  | "question"
  | "result"
  | "error"
  | "done";

/**
 * Session created message
 */
export interface SSESessionMessage {
  type: "session";
  sessionId: string;
  /** Trace ID for observability correlation */
  traceId?: string;
}

/**
 * Text content message
 */
export interface SSETextMessage {
  type: "text";
  content: string;
}

/**
 * Tool use message
 */
export interface SSEToolUseMessage {
  type: "tool_use";
  id: string;
  name: string;
  input: unknown;
}

/**
 * Tool result message
 */
export interface SSEToolResultMessage {
  type: "tool_result";
  toolUseId: string;
  output: string;
  isError?: boolean;
}

/**
 * Execution plan message
 */
export interface SSEPlanMessage {
  type: "plan";
  plan: {
    id: string;
    goal: string;
    steps: Array<{
      id: string;
      description: string;
      status: "pending" | "in_progress" | "completed" | "failed";
    }>;
    notes?: string;
  };
}

/**
 * Interactive question message
 */
export interface SSEQuestionMessage {
  type: "question";
  id: string;
  questions: Array<{
    header: string;
    question: string;
    options: Array<{ label: string; description?: string }>;
    multiSelect: boolean;
  }>;
}

/**
 * Task result message
 */
export interface SSEResultMessage {
  type: "result";
  cost?: number;
  duration?: number;
  subtype?: "success" | "error" | "error_max_turns";
}

/**
 * Error message
 */
export interface SSEErrorMessage {
  type: "error";
  message: string;
}

/**
 * Stream end message
 */
export interface SSEDoneMessage {
  type: "done";
}

/**
 * Union type for all SSE messages
 */
export type SSEMessage =
  | SSESessionMessage
  | SSETextMessage
  | SSEToolUseMessage
  | SSEToolResultMessage
  | SSEPlanMessage
  | SSEQuestionMessage
  | SSEResultMessage
  | SSEErrorMessage
  | SSEDoneMessage;

// ============================================================================
// SSE Helper Functions
// ============================================================================

/**
 * Send SSE message to client
 */
function sendSSE(reply: FastifyReply, message: SSEMessage): void {
  reply.raw.write(`data: ${JSON.stringify(message)}\n\n`);
}

/**
 * Set SSE response headers (including CORS for raw responses)
 */
function setSSEHeaders(reply: FastifyReply, request: FastifyRequest): void {
  const origin = request.headers.origin || "*";
  reply.raw.setHeader("Content-Type", "text/event-stream");
  reply.raw.setHeader("Cache-Control", "no-cache, no-transform");
  reply.raw.setHeader("Connection", "keep-alive");
  reply.raw.setHeader("X-Accel-Buffering", "no");
  // CORS headers for raw SSE responses (bypasses Fastify CORS plugin)
  reply.raw.setHeader("Access-Control-Allow-Origin", origin);
  reply.raw.setHeader("Access-Control-Allow-Credentials", "true");
}

// ============================================================================
// Route Registration
// ============================================================================

// Get tracer for agent-run routes
const tracer = trace.getTracer("viben-gateway", "1.0.0");

/**
 * Register agent run routes (SSE endpoints)
 */
export function registerAgentRunRoutes(fastify: FastifyInstance): void {
  /**
   * Run agent with SSE streaming
   * POST /api/agent/run
   *
   * Supports two ways to specify agent configuration:
   * 1. agentPath - Path to agent config.yaml file (backend reads from disk)
   * 2. agentConfig - Inline agent configuration object
   *
   * If both are provided, agentPath takes precedence.
   */
  fastify.post<{
    Body: {
      prompt: string;
      cwd?: string;
      attachments?: Array<{ type: string; data: string; name?: string }>;
      /** Path to agent config.yaml file (preferred) */
      agentPath?: string;
      /** Inline agent configuration (fallback) */
      agentConfig?: AgentConfigPayload;
      /** File system session ID for persistence (optional) */
      sessionId?: string;
      /** File system task ID for persistence (optional) */
      taskId?: string;
    };
  }>("/api/agent/run", async (request, reply) => {
    // Generate session ID early for logging
    const sessionId = generateInternalSessionId();
    const parentSpan = trace.getActiveSpan();
    const traceId = parentSpan?.spanContext().traceId;

    // Create session-scoped logger
    const log = createSessionLogger(sessionId, traceId);

    log.info("init", "request_received", {
      method: request.method,
      url: request.url,
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });

    // Early validation - check request body exists
    if (!request.body) {
      log.warn("validation", "missing_body");
      reply.code(400);
      return { error: "Request body is required" };
    }

    const {
      prompt,
      cwd,
      agentPath,
      agentConfig: inlineConfig,
      sessionId: persistSessionId,
      taskId: persistTaskId,
    } = request.body;

    // Validate required fields
    if (!prompt || typeof prompt !== "string") {
      log.warn("validation", "invalid_prompt", { type: typeof prompt });
      reply.code(400);
      return { error: "Prompt is required and must be a string" };
    }

    if (prompt.trim().length === 0) {
      log.warn("validation", "empty_prompt");
      reply.code(400);
      return { error: "Prompt cannot be empty" };
    }

    log.info("validation", "passed", {
      promptLength: prompt.length,
      hasCwd: !!cwd,
      hasAgentPath: !!agentPath,
      hasInlineConfig: !!inlineConfig,
      hasPersistSession: !!persistSessionId,
    });

    // Load agent config: prefer agentPath, fallback to inline config
    let agentConfig: AgentConfigPayload | null = null;
    if (agentPath) {
      log.debug("config", "loading_from_path", { agentPath });
      agentConfig = await loadAgentConfigFromPath(agentPath);
      if (!agentConfig) {
        log.warn("config", "path_load_failed", { agentPath, fallbackToInline: !!inlineConfig });
        agentConfig = inlineConfig || null;
      } else {
        log.info("config", "loaded_from_path", {
          agentName: agentConfig.name,
          model: agentConfig.model,
          provider: agentConfig.provider,
        });
      }
    } else {
      agentConfig = inlineConfig || null;
      if (agentConfig) {
        log.info("config", "using_inline", {
          agentName: agentConfig.name,
          model: agentConfig.model,
          provider: agentConfig.provider,
        });
      } else {
        log.info("config", "using_defaults");
      }
    }

    // Set SSE headers (with CORS for raw response)
    setSSEHeaders(reply, request);
    log.debug("sse", "headers_set");

    // Prepare request body for logging (sanitized)
    const requestBody = {
      prompt: prompt?.slice(0, 500) + (prompt && prompt.length > 500 ? "..." : ""),
      prompt_full_length: prompt?.length || 0,
      cwd: cwd || process.cwd(),
      agentPath: agentPath || null,
      agentConfig: agentConfig ? {
        name: agentConfig.name,
        model: agentConfig.model,
        provider: agentConfig.provider,
        executorType: agentConfig.executorType,
        mcpServers: agentConfig.mcpServers,
        skills: agentConfig.skills,
        planMode: agentConfig.planMode,
        approvals: agentConfig.approvals,
        // Don't log full system prompt, just indicate if present
        hasSystemPrompt: !!agentConfig.systemPrompt,
        hasAppendPrompt: !!agentConfig.appendPrompt,
      } : null,
    };

    log.debug("telemetry", "creating_span", { traceId });

    // Create main agent run span as child of HTTP span
    const agentRunSpan = tracer.startSpan(getSpanName("agent.run"), {
      attributes: {
        "agent.name": agentConfig?.name || "default",
        "agent.model": agentConfig?.model || "unknown",
        "agent.prompt_length": prompt?.length || 0,
        "agent.cwd": cwd || process.cwd(),
        // Store request body as JSON for detailed inspection
        "http.request.body": JSON.stringify(requestBody),
      },
    });

    // Create context with agent run span as parent
    const agentRunContext = trace.setSpan(context.active(), agentRunSpan);

    try {
      log.info("session", "creating", { agentName: agentConfig?.name || "default" });

      // Create session span as child of agentRunSpan
      const sessionSpan = tracer.startSpan(
        getSpanName("agent.run.session_create"),
        {
          attributes: {
            "session.agent_name": agentConfig?.name || "default",
          },
        },
        agentRunContext
      );

      // Register session for abort control
      agentService.registerSession(sessionId);
      log.debug("session", "registered_for_abort_control");

      sessionSpan.setAttribute("session.id", sessionId);
      sessionSpan.setStatus({ code: SpanStatusCode.OK });
      sessionSpan.end();

      // Send session message with trace ID for frontend correlation
      sendSSE(reply, {
        type: "session",
        sessionId,
        traceId,
      });
      log.info("session", "created", { sessionId, traceId });

      // Persist user message to UI messages file BEFORE streaming
      // This ensures user messages appear when loading the session
      if (persistSessionId && persistTaskId && prompt) {
        log.debug("persistence", "saving_user_message", {
          persistSessionId,
          persistTaskId,
          agentPath,
        });
        try {
          const persistAgentId = resolveAgentId(agentPath, agentConfig);
          // Pass agentPath for workspace-level agents to find the correct session directory
          await sessionStoreService.appendUIMessage(persistAgentId, persistSessionId, {
            id: generateMessageId(),
            taskId: persistTaskId,
            timestamp: new Date().toISOString(),
            type: "user",
            content: prompt,
          }, agentPath);
          log.debug("persistence", "user_message_saved");
        } catch (e) {
          // Non-fatal: log but continue
          log.warn("persistence", "user_message_save_failed", {
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }

      // SDK initialization span
      log.info("sdk", "initializing", {
        model: agentConfig?.model,
        cwd: cwd || process.cwd(),
        hasMcpServers: !!(agentConfig?.mcpServers?.length),
        hasSkills: !!(agentConfig?.skills?.length),
      });

      const sdkInitSpan = tracer.startSpan(
        getSpanName("agent.run.sdk_init"),
        {},
        agentRunContext
      );

      // Execute agent using SDK proxy with config from frontend
      const proxy = new SdkChatProxy();
      const stream = proxy.executeStreaming({
        prompt,
        cwd: cwd || process.cwd(),
        sessionId,
        model: agentConfig?.model,
        systemPrompt: agentConfig?.systemPrompt,
        appendPrompt: agentConfig?.appendPrompt,
        mcpServers: agentConfig?.mcpServers,
        skills: agentConfig?.skills,
        dangerouslySkipPermissions: true,
      });

      sdkInitSpan.setStatus({ code: SpanStatusCode.OK });
      sdkInitSpan.end();
      log.info("sdk", "initialized", { elapsed: log.elapsed() });

      // Streaming span
      log.info("stream", "starting");

      const streamSpan = tracer.startSpan(
        getSpanName("agent.run.stream"),
        {
          attributes: {
            "stream.session_id": sessionId,
          },
        },
        agentRunContext
      );

      // Create stream context for child spans (tool uses)
      const streamContext = trace.setSpan(context.active(), streamSpan);

      let messageCount = 0;
      let textLength = 0;
      let toolUseCount = 0;
      let toolResultCount = 0;
      let errorCount = 0;
      const textParts: string[] = [];
      const toolNames: string[] = [];
      // Map to track pending tool spans (tool_use -> tool_result pairing)
      const pendingToolSpans = new Map<string, Span>();

      // Stream messages to client
      for await (const message of stream) {
        messageCount++;

        // Record every SSE event to the stream span for telemetry
        // This allows viewing all events in the trace tree
        streamSpan.addEvent(`sse.${message.type}`, {
          "sse.message_index": messageCount,
          "sse.type": message.type,
          "sse.payload": JSON.stringify(message).slice(0, 4000), // Truncate large payloads
        });

        // Track message statistics and log by type
        if (message.type === "text" && "content" in message) {
          const textContent = (message as SSETextMessage).content;
          textLength += textContent.length;
          textParts.push(textContent);
          log.debug("stream", "text_chunk", {
            chunkLength: textContent.length,
            totalTextLength: textLength,
          });
        } else if (message.type === "tool_use") {
          toolUseCount++;
          const toolMsg = message as SSEToolUseMessage;
          toolNames.push(toolMsg.name);
          log.info("stream", "tool_use", {
            toolId: toolMsg.id,
            toolName: toolMsg.name,
            toolUseCount,
            inputPreview: JSON.stringify(toolMsg.input).slice(0, 200),
          });
          // Create a span for each tool use as child of stream span
          // Use getSpanName to get Chinese display name if available
          const toolSpanName = `tool.${toolMsg.name}`;
          const toolSpan = tracer.startSpan(
            getSpanName(toolSpanName),
            {
              attributes: {
                "tool.id": toolMsg.id,
                "tool.name": toolMsg.name,
                "tool.span_name": toolSpanName,
                // Store tool input as JSON for detailed inspection
                "tool.input": JSON.stringify(toolMsg.input),
              },
            },
            streamContext
          );
          // Store the span for later when we receive the result
          pendingToolSpans.set(toolMsg.id, toolSpan);
        } else if (message.type === "tool_result") {
          toolResultCount++;
          const resultMsg = message as SSEToolResultMessage;
          log.info("stream", "tool_result", {
            toolUseId: resultMsg.toolUseId,
            isError: resultMsg.isError || false,
            outputLength: resultMsg.output?.length || 0,
            toolResultCount,
          });

          // Find and end the corresponding tool span
          const toolSpan = pendingToolSpans.get(resultMsg.toolUseId);
          if (toolSpan) {
            // Add result attributes to the tool span
            toolSpan.setAttributes({
              "tool_result.is_error": resultMsg.isError || false,
              // Store output (truncated if too long)
              "tool_result.output": resultMsg.output?.slice(0, 2000) +
                (resultMsg.output && resultMsg.output.length > 2000 ? "...[truncated]" : ""),
              "tool_result.output_length": resultMsg.output?.length || 0,
            });
            if (resultMsg.isError) {
              toolSpan.setStatus({ code: SpanStatusCode.ERROR, message: "Tool execution failed" });
            } else {
              toolSpan.setStatus({ code: SpanStatusCode.OK });
            }
            toolSpan.end();
            pendingToolSpans.delete(resultMsg.toolUseId);
          } else {
            // No matching tool span, create a standalone result span
            const resultSpan = tracer.startSpan(
              getSpanName("tool_result"),
              {
                attributes: {
                  "tool_result.tool_use_id": resultMsg.toolUseId,
                  "tool_result.is_error": resultMsg.isError || false,
                  "tool_result.output": resultMsg.output?.slice(0, 2000) +
                    (resultMsg.output && resultMsg.output.length > 2000 ? "...[truncated]" : ""),
                  "tool_result.output_length": resultMsg.output?.length || 0,
                },
              },
              streamContext
            );
            if (resultMsg.isError) {
              resultSpan.setStatus({ code: SpanStatusCode.ERROR, message: "Tool execution failed" });
            } else {
              resultSpan.setStatus({ code: SpanStatusCode.OK });
            }
            resultSpan.end();
          }
        } else if (message.type === "error") {
          errorCount++;
          const errMsg = message as SSEErrorMessage;
          log.error("stream", "error_message", {
            errorMessage: errMsg.message,
            errorCount,
          });
        } else if (message.type === "result") {
          const resultMsg = message as SSEResultMessage;
          log.info("stream", "result", {
            subtype: resultMsg.subtype,
            cost: resultMsg.cost,
            duration: resultMsg.duration,
          });
        } else if (message.type === "question") {
          // Store the question in AgentService for the /api/agent/answer endpoint
          const questionMsg = message as SSEQuestionMessage;
          agentService.storeQuestion(
            sessionId,
            questionMsg.id, // toolUseId
            questionMsg.questions,
            { agentPath, workspacePath: cwd }
          );
          log.info("stream", "question_received", {
            questionId: questionMsg.id,
            questionCount: questionMsg.questions.length,
          });
        }
        // Note: plan message type is defined but not currently emitted by SdkChatProxy.

        sendSSE(reply, message);

        // Persist message to file system if sessionId and taskId provided
        if (persistSessionId && persistTaskId) {
          try {
            const persistAgentId = resolveAgentId(agentPath, agentConfig);
            // Pass agentPath for workspace-level agents to find the correct session directory
            await sessionStoreService.appendUIMessage(persistAgentId, persistSessionId, {
              id: generateMessageId(),
              taskId: persistTaskId,
              timestamp: new Date().toISOString(),
              type: message.type,
              content: "content" in message ? (message as SSETextMessage).content : undefined,
              toolUseId:
                message.type === "tool_use"
                  ? (message as SSEToolUseMessage).id
                  : message.type === "tool_result"
                    ? (message as SSEToolResultMessage).toolUseId
                    : undefined,
              toolName: message.type === "tool_use" ? (message as SSEToolUseMessage).name : undefined,
              toolInput: message.type === "tool_use" ? (message as SSEToolUseMessage).input : undefined,
              toolOutput:
                message.type === "tool_result" ? (message as SSEToolResultMessage).output : undefined,
              isError:
                message.type === "tool_result" ? (message as SSEToolResultMessage).isError : undefined,
            }, agentPath);
          } catch (persistError) {
            log.warn("persistence", "message_save_failed", {
              messageType: message.type,
              error: persistError instanceof Error ? persistError.message : String(persistError),
            });
            // Don't fail the request, just log the error
          }
        }

        // Check if session was cancelled (via abort controller)
        if (agentService.isSessionAborted(sessionId)) {
          log.warn("stream", "cancelled_by_user", { messageCount });
          streamSpan.setStatus({
            code: SpanStatusCode.ERROR,
            message: "Session cancelled by user",
          });
          sendSSE(reply, { type: "error", message: "Session cancelled by user" });
          break;
        }
      }

      // End any pending tool spans that didn't get results
      for (const [toolId, span] of pendingToolSpans) {
        log.warn("stream", "tool_span_orphaned", { toolId });
        span.setStatus({ code: SpanStatusCode.ERROR, message: "No result received" });
        span.end();
      }
      pendingToolSpans.clear();

      // Log stream completion summary
      log.info("stream", "completed", {
        messageCount,
        textLength,
        toolUseCount,
        toolResultCount,
        errorCount,
        toolNames: [...new Set(toolNames)], // unique tool names
        elapsed: log.elapsed(),
      });

      // Combine all text parts for response body
      const fullResponse = textParts.join("");
      const responseBody = {
        text: fullResponse.slice(0, 2000) + (fullResponse.length > 2000 ? "...[truncated]" : ""),
        text_full_length: fullResponse.length,
        message_count: messageCount,
        tool_use_count: toolUseCount,
        tool_result_count: toolResultCount,
        error_count: errorCount,
      };

      // Update stream span with statistics
      streamSpan.setAttributes({
        "stream.message_count": messageCount,
        "stream.text_length": textLength,
        "stream.tool_use_count": toolUseCount,
        "stream.tool_result_count": toolResultCount,
        "stream.error_count": errorCount,
        // Store response body as JSON for detailed inspection
        "http.response.body": JSON.stringify(responseBody),
      });
      streamSpan.setStatus({ code: SpanStatusCode.OK });
      streamSpan.end();

      // Update agent run span with final statistics
      agentRunSpan.setAttributes({
        "agent.status": "completed",
        "agent.message_count": messageCount,
        "agent.text_length": textLength,
        "agent.tool_use_count": toolUseCount,
        "agent.tool_result_count": toolResultCount,
        "agent.error_count": errorCount,
        // Store full response body for main span too
        "http.response.body": JSON.stringify(responseBody),
      });
      agentRunSpan.setStatus({ code: SpanStatusCode.OK });

      log.info("execution", "success", {
        messageCount,
        textLength,
        toolUseCount,
        toolResultCount,
        errorCount,
        elapsed: log.elapsed(),
      });
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      const cause = (error as Error & { cause?: Error }).cause;

      // Categorize errors for better user feedback
      let userMessage: string;
      let errorCategory: string;

      if (rawMessage.includes("API key") || rawMessage.includes("authentication") || rawMessage.includes("401")) {
        errorCategory = "auth";
        userMessage = "Authentication failed. Please check your API key configuration in ~/.claude/settings.json";
      } else if (rawMessage.includes("rate limit") || rawMessage.includes("429")) {
        errorCategory = "rate_limit";
        userMessage = "Rate limit exceeded. Please wait a moment and try again.";
      } else if (rawMessage.includes("not found") || rawMessage.includes("ENOENT")) {
        errorCategory = "not_found";
        userMessage = "Claude Code executable not found. Please ensure Claude Code is installed.";
      } else if (rawMessage.includes("exited with code") || rawMessage.includes("spawn")) {
        errorCategory = "process";
        userMessage = `Agent process error: ${rawMessage}`;
      } else if (rawMessage.includes("timeout") || rawMessage.includes("ETIMEDOUT")) {
        errorCategory = "timeout";
        userMessage = "Request timed out. The agent may be under heavy load.";
      } else if (rawMessage.includes("network") || rawMessage.includes("ECONNREFUSED") || rawMessage.includes("ENOTFOUND")) {
        errorCategory = "network";
        userMessage = "Network error. Please check your internet connection.";
      } else if (rawMessage.includes("SDK") || rawMessage.includes("sdk")) {
        errorCategory = "sdk";
        userMessage = `SDK error: ${rawMessage}`;
      } else {
        errorCategory = "unknown";
        userMessage = rawMessage;
      }

      // Structured error logging
      log.error("execution", "failed", {
        category: errorCategory,
        rawMessage,
        userMessage,
        stack: stack?.split("\n").slice(0, 10).join("\n"), // First 10 lines of stack
        cause: cause?.message,
        elapsed: log.elapsed(),
      });

      agentRunSpan.setStatus({
        code: SpanStatusCode.ERROR,
        message: rawMessage,
      });
      agentRunSpan.setAttribute("error.category", errorCategory);
      agentRunSpan.recordException(error instanceof Error ? error : new Error(rawMessage));

      sendSSE(reply, { type: "error", message: userMessage });
    } finally {
      // Cleanup: unregister the session
      agentService.unregisterSession(sessionId);
      log.debug("cleanup", "session_unregistered");

      agentRunSpan.end();
      log.debug("cleanup", "span_ended");

      sendSSE(reply, { type: "done" });
      reply.raw.end();

      log.info("cleanup", "request_completed", {
        totalElapsed: log.elapsed(),
      });
    }
  });

  /**
   * Stop a running session
   * POST /api/agent/stop/:sessionId
   */
  fastify.post<{ Params: { sessionId: string } }>(
    "/api/agent/stop/:sessionId",
    async (request, reply) => {
      const { sessionId } = request.params;
      const success = agentService.stopSession(sessionId);
      if (!success) {
        reply.code(404);
        return { error: `Session not found: ${sessionId}` };
      }
      return { success: true, sessionId };
    }
  );

  /**
   * Approve a plan
   * POST /api/agent/approve/:planId
   */
  fastify.post<{ Params: { planId: string } }>(
    "/api/agent/approve/:planId",
    async (request, reply) => {
      const { planId } = request.params;
      const success = agentService.approvePlan(planId);
      if (!success) {
        reply.code(404);
        return { error: `Plan not found or already processed: ${planId}` };
      }
      return { success: true, planId };
    }
  );

  /**
   * Reject a plan
   * POST /api/agent/reject/:planId
   */
  fastify.post<{ Params: { planId: string } }>(
    "/api/agent/reject/:planId",
    async (request, reply) => {
      const { planId } = request.params;
      const success = agentService.rejectPlan(planId);
      if (!success) {
        reply.code(404);
        return { error: `Plan not found or already processed: ${planId}` };
      }
      return { success: true, planId };
    }
  );

  /**
   * Answer a question (elicitation response)
   * POST /api/agent/answer/:questionId
   *
   * Used to respond to AskUserQuestion tool calls from the agent.
   * The answers are stored and can be used to continue the conversation.
   */
  fastify.post<{
    Params: { questionId: string };
    Body: {
      answers: Record<string, string>;
      /** Agent path for workspace-level agents */
      agentPath?: string;
      /** Workspace path */
      workspacePath?: string;
    };
  }>(
    "/api/agent/answer/:questionId",
    async (request, reply) => {
      const { questionId } = request.params;
      const { answers, agentPath, workspacePath } = request.body;

      if (!answers || typeof answers !== "object") {
        reply.code(400);
        return { error: "Answers object is required" };
      }

      // Store the answer for the question
      const success = agentService.answerQuestion(questionId, answers);
      if (!success) {
        reply.code(404);
        return { error: `Question not found or already answered: ${questionId}` };
      }

      return {
        success: true,
        questionId,
        agentPath,
        workspacePath,
      };
    }
  );

  /**
   * Subscribe to background tasks (SSE)
   * GET /api/agent/tasks/subscribe
   */
  fastify.get("/api/agent/tasks/subscribe", async (request, reply) => {
    // Set SSE headers (with CORS for raw response)
    setSSEHeaders(reply, request);

    // Send current tasks
    reply.raw.write(
      `data: ${JSON.stringify({
        type: "tasks",
        tasks: backgroundTaskManager.getAllTasks(),
      })}\n\n`
    );

    // Subscribe to updates
    const unsubscribe = backgroundTaskManager.subscribe((tasks) => {
      reply.raw.write(`data: ${JSON.stringify({ type: "tasks", tasks })}\n\n`);
    });

    // Handle client disconnect
    request.raw.on("close", () => {
      unsubscribe();
    });

    // Send heartbeat to keep connection alive
    const heartbeatInterval = setInterval(() => {
      if (request.raw.destroyed) {
        clearInterval(heartbeatInterval);
        unsubscribe();
        return;
      }
      reply.raw.write(`data: ${JSON.stringify({ type: "ping" })}\n\n`);
    }, 30000);

    // Keep connection open
    await new Promise<void>((resolve) => {
      request.raw.on("close", () => {
        clearInterval(heartbeatInterval);
        resolve();
      });
    });
  });

  /**
   * Stop a background task
   * POST /api/agent/tasks/:taskId/stop
   */
  fastify.post<{ Params: { taskId: string } }>(
    "/api/agent/tasks/:taskId/stop",
    async (request, reply) => {
      const { taskId } = request.params;
      backgroundTaskManager.stopTask(taskId);
      return { success: true, taskId };
    }
  );

  /**
   * Get session info (runtime status only)
   * GET /api/agent/session/:sessionId
   *
   * Note: This only returns runtime abort status.
   * For full session data, use SessionStoreService.
   */
  fastify.get<{ Params: { sessionId: string } }>(
    "/api/agent/session/:sessionId",
    async (request, reply) => {
      const { sessionId } = request.params;
      const hasController = agentService.getAbortSignal(sessionId) !== undefined;

      if (!hasController) {
        reply.code(404);
        return { error: `Session not found: ${sessionId}` };
      }

      const isAborted = agentService.isSessionAborted(sessionId);
      return {
        sessionId,
        status: isAborted ? "cancelled" : "active",
      };
    }
  );

  /**
   * Get plan info
   * GET /api/agent/plan/:planId
   */
  fastify.get<{ Params: { planId: string } }>(
    "/api/agent/plan/:planId",
    async (request, reply) => {
      const { planId } = request.params;
      const plan = agentService.getPlan(planId);
      if (!plan) {
        reply.code(404);
        return { error: `Plan not found: ${planId}` };
      }
      return {
        id: plan.id,
        sessionId: plan.sessionId,
        goal: plan.goal,
        steps: plan.steps,
        notes: plan.notes,
        status: plan.status,
        createdAt: plan.createdAt.toISOString(),
      };
    }
  );
}

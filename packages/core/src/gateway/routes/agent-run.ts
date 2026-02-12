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
import { agentService } from "../../services/agent";
import { backgroundTaskManager } from "../../services/background-tasks";
import { SdkChatProxy } from "../../executors/chat/sdk-proxy";
import { trace, context, SpanStatusCode } from "../../telemetry";
import { getSpanName } from "../../telemetry/route-names";
import { readYaml } from "../../config/yaml";
import type { AgentConfigFile } from "../../agents";

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
    };
  }>("/api/agent/run", async (request, reply) => {
    const { prompt, cwd, agentPath, agentConfig: inlineConfig } = request.body;

    // Load agent config: prefer agentPath, fallback to inline config
    let agentConfig: AgentConfigPayload | null = null;
    if (agentPath) {
      agentConfig = await loadAgentConfigFromPath(agentPath);
      if (!agentConfig) {
        console.warn(`[agent-run] Failed to load config from ${agentPath}, using inline config`);
        agentConfig = inlineConfig || null;
      }
    } else {
      agentConfig = inlineConfig || null;
    }

    // Get parent span from HTTP instrumentation (auto-created by FastifyInstrumentation)
    const parentSpan = trace.getActiveSpan();
    const traceId = parentSpan?.spanContext().traceId;

    // Set SSE headers (with CORS for raw response)
    setSSEHeaders(reply, request);

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

    let sessionId: string | null = null;

    try {
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

      // Create session with agent name (if provided)
      const session = agentService.createSession(agentConfig?.name || "default", prompt);
      sessionId = session.sessionId;

      sessionSpan.setAttribute("session.id", sessionId);
      sessionSpan.setStatus({ code: SpanStatusCode.OK });
      sessionSpan.end();

      // Send session message with trace ID for frontend correlation
      sendSSE(reply, {
        type: "session",
        sessionId,
        traceId,
      });

      // SDK initialization span
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

      // Streaming span
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
      const textParts: string[] = [];

      // Stream messages to client
      for await (const message of stream) {
        messageCount++;

        // Track message statistics
        if (message.type === "text" && "content" in message) {
          const textContent = (message as SSETextMessage).content;
          textLength += textContent.length;
          textParts.push(textContent);
        } else if (message.type === "tool_use") {
          toolUseCount++;
          const toolMsg = message as SSEToolUseMessage;
          // Create a span for each tool use as child of stream span
          const toolSpan = tracer.startSpan(
            `tool.${toolMsg.name}`,
            {
              attributes: {
                "tool.id": toolMsg.id,
                "tool.name": toolMsg.name,
                // Store tool input as JSON for detailed inspection
                "tool.input": JSON.stringify(toolMsg.input),
              },
            },
            streamContext
          );
          toolSpan.end();
        } else if (message.type === "tool_result") {
          const resultMsg = message as SSEToolResultMessage;
          // Create a span for tool result
          const resultSpan = tracer.startSpan(
            `tool_result.${resultMsg.toolUseId}`,
            {
              attributes: {
                "tool_result.tool_use_id": resultMsg.toolUseId,
                "tool_result.is_error": resultMsg.isError || false,
                // Store output (truncated if too long)
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

        sendSSE(reply, message);

        // Check if session was cancelled
        const currentSession = agentService.getSession(sessionId);
        if (currentSession?.status === "cancelled") {
          streamSpan.setStatus({
            code: SpanStatusCode.ERROR,
            message: "Session cancelled by user",
          });
          sendSSE(reply, { type: "error", message: "Session cancelled by user" });
          break;
        }
      }

      // Combine all text parts for response body
      const fullResponse = textParts.join("");
      const responseBody = {
        text: fullResponse.slice(0, 2000) + (fullResponse.length > 2000 ? "...[truncated]" : ""),
        text_full_length: fullResponse.length,
        message_count: messageCount,
        tool_use_count: toolUseCount,
      };

      // Update stream span with statistics
      streamSpan.setAttributes({
        "stream.message_count": messageCount,
        "stream.text_length": textLength,
        "stream.tool_use_count": toolUseCount,
        // Store response body as JSON for detailed inspection
        "http.response.body": JSON.stringify(responseBody),
      });
      streamSpan.setStatus({ code: SpanStatusCode.OK });
      streamSpan.end();

      // Mark completed
      agentService.updateSessionStatus(sessionId, "completed", new Date());

      // Update agent run span with final statistics
      agentRunSpan.setAttributes({
        "agent.status": "completed",
        "agent.message_count": messageCount,
        "agent.text_length": textLength,
        "agent.tool_use_count": toolUseCount,
        // Store full response body for main span too
        "http.response.body": JSON.stringify(responseBody),
      });
      agentRunSpan.setStatus({ code: SpanStatusCode.OK });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (sessionId) {
        agentService.updateSessionStatus(sessionId, "error", new Date());
      }

      agentRunSpan.setStatus({
        code: SpanStatusCode.ERROR,
        message: errorMessage,
      });
      agentRunSpan.recordException(error instanceof Error ? error : new Error(errorMessage));

      sendSSE(reply, { type: "error", message: errorMessage });
    } finally {
      agentRunSpan.end();
      sendSSE(reply, { type: "done" });
      reply.raw.end();
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
   * Get session info
   * GET /api/agent/session/:sessionId
   */
  fastify.get<{ Params: { sessionId: string } }>(
    "/api/agent/session/:sessionId",
    async (request, reply) => {
      const { sessionId } = request.params;
      const session = agentService.getSession(sessionId);
      if (!session) {
        reply.code(404);
        return { error: `Session not found: ${sessionId}` };
      }
      return {
        sessionId: session.sessionId,
        agentId: session.agentId,
        prompt: session.prompt,
        status: session.status,
        startedAt: session.startedAt.toISOString(),
        completedAt: session.completedAt?.toISOString(),
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

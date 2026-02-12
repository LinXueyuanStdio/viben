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
 * Set SSE response headers
 */
function setSSEHeaders(reply: FastifyReply): void {
  reply.raw.setHeader("Content-Type", "text/event-stream");
  reply.raw.setHeader("Cache-Control", "no-cache, no-transform");
  reply.raw.setHeader("Connection", "keep-alive");
  reply.raw.setHeader("X-Accel-Buffering", "no");
}

// ============================================================================
// Route Registration
// ============================================================================

/**
 * Register agent run routes (SSE endpoints)
 */
export function registerAgentRunRoutes(fastify: FastifyInstance): void {
  /**
   * Run agent with SSE streaming
   * POST /api/agent/run
   */
  fastify.post<{
    Body: {
      agentId: string;
      prompt: string;
      cwd?: string;
      model?: string;
      attachments?: Array<{ type: string; data: string; name?: string }>;
    };
  }>("/api/agent/run", async (request, reply) => {
    const { agentId, prompt, cwd, model } = request.body;

    // Set SSE headers
    setSSEHeaders(reply);

    // Create session
    const session = agentService.createSession(agentId, prompt);

    // Send session message
    sendSSE(reply, { type: "session", sessionId: session.sessionId });

    try {
      // TODO: Phase B will implement actual agent execution with streaming
      // For now, send a placeholder response
      sendSSE(reply, {
        type: "text",
        content: `Agent execution started for agent: ${agentId}`,
      });
      sendSSE(reply, {
        type: "text",
        content: `\nPrompt: ${prompt}`,
      });
      if (cwd) {
        sendSSE(reply, { type: "text", content: `\nWorking directory: ${cwd}` });
      }
      if (model) {
        sendSSE(reply, { type: "text", content: `\nModel: ${model}` });
      }

      // Mark completed
      agentService.updateSessionStatus(session.sessionId, "completed", new Date());
      sendSSE(reply, { type: "result", subtype: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      agentService.updateSessionStatus(session.sessionId, "error", new Date());
      sendSSE(reply, { type: "error", message });
    } finally {
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
    // Set SSE headers
    setSSEHeaders(reply);

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

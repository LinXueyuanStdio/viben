# WorkAny Core Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 WorkAny 的智能体对话核心功能迁移到 Viben，实现 SSE 流式通信、Agent 服务层、后台任务管理

**Architecture:**
- Gateway 层使用 Fastify SSE 实现流式响应
- Agent Service 管理会话生命周期和计划审批
- SDK Chat Proxy 扩展 AsyncGenerator 流式方法
- Background Task Manager 使用观察者模式管理后台任务

**Tech Stack:** Fastify, @anthropic-ai/claude-agent-sdk, TypeScript, SSE

---

## Phase A: Gateway Agent API + Agent Service

### Task 1: Create SSE Types

**Files:**
- Create: `packages/core/src/gateway/routes/agent-run.ts`

**Step 1: Create SSE message type definitions**

```typescript
// packages/core/src/gateway/routes/agent-run.ts

/**
 * SSE message types for agent streaming
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

export interface SSESessionMessage {
  type: "session";
  sessionId: string;
}

export interface SSETextMessage {
  type: "text";
  content: string;
}

export interface SSEToolUseMessage {
  type: "tool_use";
  id: string;
  name: string;
  input: unknown;
}

export interface SSEToolResultMessage {
  type: "tool_result";
  toolUseId: string;
  output: string;
  isError?: boolean;
}

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

export interface SSEResultMessage {
  type: "result";
  cost?: number;
  duration?: number;
  subtype?: "success" | "error" | "error_max_turns";
}

export interface SSEErrorMessage {
  type: "error";
  message: string;
}

export interface SSEDoneMessage {
  type: "done";
}

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
```

**Step 2: Commit**

```bash
git add packages/core/src/gateway/routes/agent-run.ts
git commit -m "feat(gateway): add SSE message type definitions for agent streaming"
```

---

### Task 2: Create Agent Service

**Files:**
- Create: `packages/core/src/services/agent.ts`

**Step 1: Create AgentService class with session management**

```typescript
// packages/core/src/services/agent.ts

import { randomUUID } from "node:crypto";

/**
 * Agent session state
 */
export interface AgentSession {
  sessionId: string;
  agentId: string;
  prompt: string;
  status: "running" | "paused" | "completed" | "error" | "cancelled";
  startedAt: Date;
  completedAt?: Date;
  abortController: AbortController;
}

/**
 * Agent plan for approval
 */
export interface AgentPlan {
  id: string;
  sessionId: string;
  goal: string;
  steps: Array<{
    id: string;
    description: string;
    status: "pending" | "in_progress" | "completed" | "failed";
  }>;
  notes?: string;
  status: "pending" | "approved" | "rejected";
  createdAt: Date;
}

type SessionListener = (session: AgentSession) => void;

/**
 * AgentService - Manages agent session lifecycle and plan approvals
 */
export class AgentService {
  private sessions = new Map<string, AgentSession>();
  private plans = new Map<string, AgentPlan>();
  private sessionListeners = new Map<string, Set<SessionListener>>();

  /**
   * Create a new session
   */
  createSession(agentId: string, prompt: string): AgentSession {
    const sessionId = randomUUID();
    const session: AgentSession = {
      sessionId,
      agentId,
      prompt,
      status: "running",
      startedAt: new Date(),
      abortController: new AbortController(),
    };
    this.sessions.set(sessionId, session);
    console.log(`[AgentService] Created session: ${sessionId}`);
    return session;
  }

  /**
   * Get a session
   */
  getSession(sessionId: string): AgentSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Update session status
   */
  updateSessionStatus(
    sessionId: string,
    status: AgentSession["status"],
    completedAt?: Date
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.status = status;
    if (completedAt) session.completedAt = completedAt;

    // Notify listeners
    const listeners = this.sessionListeners.get(sessionId);
    if (listeners) {
      for (const listener of listeners) {
        listener(session);
      }
    }

    console.log(`[AgentService] Session ${sessionId} status: ${status}`);
  }

  /**
   * Stop a session
   */
  stopSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.abortController.abort();
    this.updateSessionStatus(sessionId, "cancelled", new Date());
    return true;
  }

  /**
   * Get abort signal for a session
   */
  getAbortSignal(sessionId: string): AbortSignal | undefined {
    return this.sessions.get(sessionId)?.abortController.signal;
  }

  /**
   * Subscribe to session updates
   */
  subscribeSession(sessionId: string, listener: SessionListener): () => void {
    if (!this.sessionListeners.has(sessionId)) {
      this.sessionListeners.set(sessionId, new Set());
    }
    this.sessionListeners.get(sessionId)!.add(listener);
    return () => {
      this.sessionListeners.get(sessionId)?.delete(listener);
    };
  }

  /**
   * Store a plan for approval
   */
  storePlan(
    sessionId: string,
    plan: Omit<AgentPlan, "id" | "sessionId" | "status" | "createdAt">
  ): AgentPlan {
    const fullPlan: AgentPlan = {
      ...plan,
      id: randomUUID(),
      sessionId,
      status: "pending",
      createdAt: new Date(),
    };
    this.plans.set(fullPlan.id, fullPlan);
    console.log(`[AgentService] Stored plan: ${fullPlan.id}`);
    return fullPlan;
  }

  /**
   * Get a plan
   */
  getPlan(planId: string): AgentPlan | undefined {
    return this.plans.get(planId);
  }

  /**
   * Approve a plan
   */
  approvePlan(planId: string): boolean {
    const plan = this.plans.get(planId);
    if (!plan || plan.status !== "pending") return false;

    plan.status = "approved";
    console.log(`[AgentService] Plan approved: ${planId}`);
    return true;
  }

  /**
   * Reject a plan
   */
  rejectPlan(planId: string): boolean {
    const plan = this.plans.get(planId);
    if (!plan || plan.status !== "pending") return false;

    plan.status = "rejected";
    // Also cancel the associated session
    this.stopSession(plan.sessionId);
    console.log(`[AgentService] Plan rejected: ${planId}`);
    return true;
  }

  /**
   * Cleanup completed sessions (older than given ms)
   */
  cleanup(maxAgeMs: number = 3600000): void {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (
        session.status !== "running" &&
        session.completedAt &&
        now - session.completedAt.getTime() > maxAgeMs
      ) {
        this.sessions.delete(id);
        this.sessionListeners.delete(id);
        // Also cleanup associated plans
        for (const [planId, plan] of this.plans) {
          if (plan.sessionId === id) {
            this.plans.delete(planId);
          }
        }
      }
    }
  }
}

// Singleton export
export const agentService = new AgentService();
```

**Step 2: Export from services index**

Add to `packages/core/src/services/index.ts`:

```typescript
// Agent service
export {
  AgentService,
  agentService,
  type AgentSession,
  type AgentPlan,
} from "./agent";
```

**Step 3: Commit**

```bash
git add packages/core/src/services/agent.ts packages/core/src/services/index.ts
git commit -m "feat(services): add AgentService for session and plan management"
```

---

### Task 3: Implement Gateway SSE Routes

**Files:**
- Modify: `packages/core/src/gateway/routes/agent-run.ts`
- Modify: `packages/core/src/gateway/routes/index.ts`

**Step 1: Implement SSE route handlers**

Append to `packages/core/src/gateway/routes/agent-run.ts`:

```typescript
import type { FastifyInstance, FastifyReply } from "fastify";
import { agentService } from "../../services/agent";

/**
 * Send SSE message
 */
function sendSSE(reply: FastifyReply, message: SSEMessage): void {
  reply.raw.write(`data: ${JSON.stringify(message)}\n\n`);
}

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
    };
  }>("/api/agent/run", async (request, reply) => {
    const { agentId, prompt, cwd, model } = request.body;

    // Set SSE headers
    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache, no-transform");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.setHeader("X-Accel-Buffering", "no");

    // Create session
    const session = agentService.createSession(agentId, prompt);

    // Send session message
    sendSSE(reply, { type: "session", sessionId: session.sessionId });

    try {
      // Execute agent with streaming (to be implemented in Phase B)
      // For now, send a placeholder
      sendSSE(reply, { type: "text", content: "Agent execution started..." });

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
}
```

**Step 2: Register routes in index.ts**

Add to `packages/core/src/gateway/routes/index.ts`:

```typescript
import { registerAgentRunRoutes } from "./agent-run";

// In registerRoutes function:
registerAgentRunRoutes(fastify);

// Add export:
export { registerAgentRunRoutes } from "./agent-run";
```

**Step 3: Commit**

```bash
git add packages/core/src/gateway/routes/agent-run.ts packages/core/src/gateway/routes/index.ts
git commit -m "feat(gateway): add SSE routes for agent run, stop, approve, reject"
```

---

## Phase B: SDK Chat Proxy Streaming Extension

### Task 4: Add executeStreaming method to SdkChatProxy

**Files:**
- Modify: `packages/core/src/executors/chat/sdk-proxy.ts`

**Step 1: Add streaming execution method**

Add to `SdkChatProxy` class in `packages/core/src/executors/chat/sdk-proxy.ts`:

```typescript
  /**
   * Execute chat with streaming - returns AsyncGenerator of SSE messages
   */
  async *executeStreaming(
    options: ChatOptions
  ): AsyncGenerator<SSEMessage, void, unknown> {
    const sdk = await loadClaudeSdk();
    if (!sdk) {
      yield { type: "error", message: "Claude Agent SDK not installed" };
      return;
    }

    const {
      prompt,
      cwd = process.cwd(),
      model,
      sessionId,
      resume,
      dangerouslySkipPermissions = false,
      systemPrompt,
      appendPrompt,
      allowedTools,
      disallowedTools,
      permissionMode,
    } = options;

    if (!prompt) {
      yield { type: "error", message: "Prompt is required" };
      return;
    }

    clearInterferingEnvVars();

    try {
      const queryOptions: Record<string, unknown> = {
        cwd,
        settingSources: ["user"],
      };

      // System prompt configuration
      if (systemPrompt) {
        queryOptions.systemPrompt = appendPrompt
          ? systemPrompt + "\n\n" + appendPrompt
          : systemPrompt;
      } else if (appendPrompt) {
        queryOptions.systemPrompt = {
          type: "preset",
          preset: "claude_code",
          append: appendPrompt,
        };
      } else {
        queryOptions.systemPrompt = { type: "preset", preset: "claude_code" };
      }

      queryOptions.tools = { type: "preset", preset: "claude_code" };
      if (allowedTools?.length) queryOptions.allowedTools = allowedTools;
      if (disallowedTools?.length) queryOptions.disallowedTools = disallowedTools;
      if (model) queryOptions.model = model;
      if (sessionId) queryOptions.sessionId = sessionId;
      if (resume) queryOptions.resume = resume;
      if (permissionMode) {
        queryOptions.permissionMode = permissionMode;
      } else if (dangerouslySkipPermissions) {
        queryOptions.permissionMode = "bypassPermissions";
      }

      const queryResult = sdk.query({
        prompt,
        options: queryOptions as Parameters<typeof sdk.query>[0]["options"],
      });

      for await (const message of queryResult) {
        const sseMessage = this.convertToSSEMessage(message);
        if (sseMessage) {
          yield sseMessage;
        }
      }

      yield { type: "result", subtype: "success" };
    } catch (error) {
      yield {
        type: "error",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Convert SDK message to SSE message
   */
  private convertToSSEMessage(message: unknown): SSEMessage | null {
    if (!message || typeof message !== "object") return null;

    const msg = message as Record<string, unknown>;

    // Handle assistant text messages
    if (msg.type === "assistant") {
      if (msg.message && typeof msg.message === "object") {
        const innerMsg = msg.message as Record<string, unknown>;
        if (Array.isArray(innerMsg.content)) {
          const textParts: string[] = [];
          for (const block of innerMsg.content) {
            if (
              block &&
              typeof block === "object" &&
              (block as Record<string, unknown>).type === "text"
            ) {
              textParts.push((block as Record<string, unknown>).text as string);
            }
          }
          if (textParts.length > 0) {
            return { type: "text", content: textParts.join("") };
          }
        }
      }
      if (typeof msg.content === "string") {
        return { type: "text", content: msg.content };
      }
    }

    // Handle tool use
    if (msg.type === "tool_use") {
      return {
        type: "tool_use",
        id: msg.id as string,
        name: msg.name as string,
        input: msg.input,
      };
    }

    // Handle tool result
    if (msg.type === "tool_result") {
      return {
        type: "tool_result",
        toolUseId: msg.tool_use_id as string,
        output: msg.content as string,
        isError: msg.is_error as boolean | undefined,
      };
    }

    // Handle streaming deltas
    if (msg.type === "content_block_delta") {
      const delta = msg.delta as Record<string, unknown> | undefined;
      if (delta && delta.type === "text_delta" && typeof delta.text === "string") {
        return { type: "text", content: delta.text };
      }
    }

    return null;
  }
```

**Step 2: Import SSE types**

Add import at top of file:

```typescript
import type { SSEMessage } from "../gateway/routes/agent-run";
```

**Step 3: Commit**

```bash
git add packages/core/src/executors/chat/sdk-proxy.ts
git commit -m "feat(executor): add executeStreaming method to SdkChatProxy"
```

---

## Phase C: Background Tasks Service

### Task 5: Create BackgroundTaskManager

**Files:**
- Create: `packages/core/src/services/background-tasks.ts`

**Step 1: Implement BackgroundTaskManager**

```typescript
// packages/core/src/services/background-tasks.ts

/**
 * Background task state
 */
export interface BackgroundTask {
  taskId: string;
  sessionId: string;
  prompt: string;
  status: "running" | "completed" | "error" | "cancelled";
  startedAt: Date;
  completedAt?: Date;
  errorMessage?: string;
  cost?: number;
  duration?: number;
}

type TaskListener = (tasks: BackgroundTask[]) => void;

/**
 * BackgroundTaskManager - Manages background agent tasks
 *
 * Uses observer pattern for real-time updates to subscribers.
 */
export class BackgroundTaskManager {
  private tasks = new Map<string, BackgroundTask>();
  private listeners = new Set<TaskListener>();
  private abortControllers = new Map<string, AbortController>();

  /**
   * Add a new task
   */
  addTask(task: {
    taskId: string;
    sessionId: string;
    prompt: string;
  }): BackgroundTask {
    const abortController = new AbortController();
    this.abortControllers.set(task.taskId, abortController);

    const fullTask: BackgroundTask = {
      ...task,
      status: "running",
      startedAt: new Date(),
    };

    this.tasks.set(task.taskId, fullTask);
    this.notifyListeners();

    console.log(`[BackgroundTasks] Added task: ${task.taskId}`);
    return fullTask;
  }

  /**
   * Update task status
   */
  updateStatus(
    taskId: string,
    update: {
      status: BackgroundTask["status"];
      errorMessage?: string;
      cost?: number;
      duration?: number;
    }
  ): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    Object.assign(task, update);

    if (update.status !== "running") {
      task.completedAt = new Date();
    }

    this.notifyListeners();
    console.log(`[BackgroundTasks] Updated task ${taskId}: ${update.status}`);
  }

  /**
   * Stop a task
   */
  stopTask(taskId: string): void {
    const controller = this.abortControllers.get(taskId);
    if (controller) {
      controller.abort();
      console.log(`[BackgroundTasks] Aborted task: ${taskId}`);
    }
    this.updateStatus(taskId, { status: "cancelled" });
  }

  /**
   * Get a task
   */
  getTask(taskId: string): BackgroundTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get all tasks
   */
  getAllTasks(): BackgroundTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get running task count
   */
  getRunningCount(): number {
    return Array.from(this.tasks.values()).filter(
      (t) => t.status === "running"
    ).length;
  }

  /**
   * Get abort signal for a task
   */
  getAbortSignal(taskId: string): AbortSignal | undefined {
    return this.abortControllers.get(taskId)?.signal;
  }

  /**
   * Subscribe to task updates
   */
  subscribe(listener: TaskListener): () => void {
    this.listeners.add(listener);
    // Immediately call with current state
    listener(this.getAllTasks());
    return () => this.listeners.delete(listener);
  }

  /**
   * Cleanup a task
   */
  cleanup(taskId: string): void {
    this.tasks.delete(taskId);
    this.abortControllers.delete(taskId);
    this.notifyListeners();
  }

  /**
   * Clear all tasks
   */
  clearAll(): void {
    // Stop all running tasks
    for (const controller of this.abortControllers.values()) {
      controller.abort();
    }
    this.tasks.clear();
    this.abortControllers.clear();
    this.notifyListeners();
  }

  private notifyListeners(): void {
    const tasks = this.getAllTasks();
    for (const listener of this.listeners) {
      listener(tasks);
    }
  }
}

// Singleton export
export const backgroundTaskManager = new BackgroundTaskManager();
```

**Step 2: Export from services index**

Add to `packages/core/src/services/index.ts`:

```typescript
// Background tasks
export {
  BackgroundTaskManager,
  backgroundTaskManager,
  type BackgroundTask,
} from "./background-tasks";
```

**Step 3: Commit**

```bash
git add packages/core/src/services/background-tasks.ts packages/core/src/services/index.ts
git commit -m "feat(services): add BackgroundTaskManager with observer pattern"
```

---

### Task 6: Add SSE endpoint for task subscription

**Files:**
- Modify: `packages/core/src/gateway/routes/agent-run.ts`

**Step 1: Add tasks subscription endpoint**

Add to `registerAgentRunRoutes` in `packages/core/src/gateway/routes/agent-run.ts`:

```typescript
import { backgroundTaskManager, type BackgroundTask } from "../../services/background-tasks";

  /**
   * Subscribe to background tasks (SSE)
   * GET /api/agent/tasks/subscribe
   */
  fastify.get("/api/agent/tasks/subscribe", async (request, reply) => {
    // Set SSE headers
    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache, no-transform");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.setHeader("X-Accel-Buffering", "no");

    // Send current tasks
    reply.raw.write(
      `data: ${JSON.stringify({
        type: "tasks",
        tasks: backgroundTaskManager.getAllTasks(),
      })}\n\n`
    );

    // Subscribe to updates
    const unsubscribe = backgroundTaskManager.subscribe((tasks) => {
      reply.raw.write(
        `data: ${JSON.stringify({ type: "tasks", tasks })}\n\n`
      );
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
```

**Step 2: Commit**

```bash
git add packages/core/src/gateway/routes/agent-run.ts
git commit -m "feat(gateway): add SSE endpoint for background task subscription"
```

---

## Verification

### Task 7: Run TypeScript compilation

**Step 1: Run typecheck**

```bash
cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm typecheck
```

Expected: No errors in packages/core

**Step 2: Run tests (if any)**

```bash
cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core && pnpm test
```

---

## Summary

| Phase | Tasks | Files |
|-------|-------|-------|
| A | Tasks 1-3 | agent-run.ts, agent.ts, index.ts |
| B | Task 4 | sdk-proxy.ts |
| C | Tasks 5-6 | background-tasks.ts, agent-run.ts |

**Parallel Execution:**
- Phase A and B can run in parallel (no dependencies)
- Phase C depends on Phase A (uses agent-run.ts)

**后续 Phase (Desktop 前端):**
- Phase D: useAgent Hook (depends on A, B)
- Phase E: UI Components (depends on C)

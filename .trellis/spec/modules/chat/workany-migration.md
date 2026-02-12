# WorkAny 核心功能迁移规范

> 将 WorkAny 的智能体对话功能迁移到 Viben Desktop 的工作空间对话页面

---

## 概述

### 迁移目标

将 `/Users/lxy/Documents/GitHub/others/workany` 的核心对话功能集成到 Viben，在 `packages/core` 实现核心逻辑，在 `apps/desktop` 实现 UI。

### 参考文档

- 架构分析: `docs/work/` (已完成)
- 组件参考: `.trellis/spec/modules/workspace/desktop-chat-workany.md`
- Agent Hooks: `.trellis/spec/modules/chat/agent-hooks-spec.md`

---

## 架构对比

### WorkAny 架构

```
Frontend (React)              Backend (Hono)                 Agent (Claude SDK)
     │                             │                              │
     │  SSE POST /agent/run        │                              │
     ├────────────────────────────►│                              │
     │                             │  query({ prompt, options })  │
     │                             ├─────────────────────────────►│
     │                             │                              │
     │  event: { type, data }      │◄─────────────────────────────┤
     │◄────────────────────────────┤  AsyncGenerator<Message>     │
     │                             │                              │
```

### Viben 目标架构

```
Desktop (React)               packages/core                   Agent (Claude SDK)
     │                             │                              │
     │  Gateway API                │                              │
     │  /api/agent/run (SSE)       │                              │
     ├────────────────────────────►│                              │
     │                             │  SdkChatProxy.execute()      │
     │                             │  or SpawnChatProxy.execute() │
     │                             ├─────────────────────────────►│
     │                             │                              │
     │  SSE events                 │◄─────────────────────────────┤
     │◄────────────────────────────┤                              │
     │                             │                              │
```

---

## 实现位置

### packages/core (核心实现)

| 模块 | 路径 | 职责 |
|------|------|------|
| Agent Service | `src/services/agent.ts` | Agent 会话管理、SSE 流控制 |
| Chat Proxy | `src/executors/chat/` | Claude SDK/CLI 执行代理 |
| Gateway Routes | `src/gateway/routes/agent.ts` | HTTP/SSE API 端点 |
| Background Tasks | `src/services/background-tasks.ts` | 后台任务管理 |
| Database Models | `src/db/models/` | Session, Task, Message 模型 |

### apps/desktop (UI 实现)

| 组件 | 路径 | 职责 |
|------|------|------|
| useAgent Hook | `src/hooks/use-agent.ts` | SSE 连接、状态管理 |
| PlanApproval | `src/components/chat/plan-approval.tsx` | 计划审批 UI |
| QuestionInput | `src/components/chat/question-input.tsx` | 问题回答 UI |
| ArtifactPreview | `src/components/chat/artifact-preview.tsx` | 文件预览 |
| RightSidebar | `src/components/chat/right-sidebar.tsx` | 产物/工具侧边栏 |

---

## Phase 1: Gateway Agent API

### 新增端点

在 `packages/core/src/gateway/routes/agent.ts` 添加：

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/agent/run` | POST | 启动新任务 (SSE) |
| `/api/agent/continue` | POST | 继续对话 (SSE) |
| `/api/agent/stop/:sessionId` | POST | 停止任务 |
| `/api/agent/plan/:planId` | GET | 获取计划详情 |
| `/api/agent/approve/:planId` | POST | 批准计划 |
| `/api/agent/reject/:planId` | POST | 拒绝计划 |
| `/api/agent/answer/:questionId` | POST | 回答问题 |

### 请求/响应格式

#### POST /api/agent/run

```typescript
// Request
interface AgentRunRequest {
  prompt: string;
  agentId?: string;           // 使用指定 Agent
  workDir?: string;           // 工作目录
  sessionId?: string;         // 继续现有会话
  taskId?: string;            // 任务 ID
  conversation?: ConversationMessage[];  // 历史对话
  attachments?: Attachment[]; // 附件 (图片等)
  modelConfig?: {
    model?: string;
    apiKey?: string;
    baseUrl?: string;
  };
  sandboxConfig?: {
    enabled: boolean;
    provider?: string;
  };
}

// Response: SSE Stream
// Content-Type: text/event-stream
```

### SSE 事件类型

```typescript
type SSEEventType =
  | 'session'        // 会话创建: { sessionId: string }
  | 'text'           // 文本块: { content: string }
  | 'tool_use'       // 工具调用: { id, name, input }
  | 'tool_result'    // 工具结果: { toolUseId, output, isError }
  | 'plan'           // 执行计划: { plan: TaskPlan }
  | 'question'       // 交互问题: { id, questions }
  | 'result'         // 完成: { cost, duration, subtype }
  | 'error'          // 错误: { message }
  | 'done';          // 结束标记

interface SSEMessage {
  type: SSEEventType;
  [key: string]: unknown;
}
```

### 实现参考

从 WorkAny 迁移核心逻辑：

```typescript
// packages/core/src/gateway/routes/agent.ts

import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { getAgentService } from "../../services/agent";

const agent = new Hono();

agent.post("/run", async (c) => {
  const body = await c.req.json<AgentRunRequest>();
  const agentService = getAgentService();

  return streamSSE(c, async (stream) => {
    const session = agentService.createSession();

    await stream.writeSSE({
      data: JSON.stringify({ type: "session", sessionId: session.id }),
    });

    for await (const message of agentService.run(body, session)) {
      await stream.writeSSE({
        data: JSON.stringify(message),
      });
    }
  });
});

export default agent;
```

---

## Phase 2: Agent Service

### 服务层设计

在 `packages/core/src/services/agent.ts` 实现：

```typescript
// packages/core/src/services/agent.ts

import type { ChatOptions } from "../executors/types";
import { createSdkChatProxy } from "../executors/chat/sdk-proxy";

export interface AgentSession {
  id: string;
  createdAt: Date;
  phase: "planning" | "executing" | "idle";
  isAborted: boolean;
  abortController: AbortController;
}

export interface AgentMessage {
  type: string;
  [key: string]: unknown;
}

export class AgentService {
  private sessions = new Map<string, AgentSession>();
  private plans = new Map<string, TaskPlan>();

  createSession(): AgentSession {
    const session: AgentSession = {
      id: Date.now().toString(),
      createdAt: new Date(),
      phase: "idle",
      isAborted: false,
      abortController: new AbortController(),
    };
    this.sessions.set(session.id, session);
    return session;
  }

  async *run(
    request: AgentRunRequest,
    session: AgentSession
  ): AsyncGenerator<AgentMessage> {
    const proxy = createSdkChatProxy();

    // 构建执行选项
    const options: ChatOptions = {
      prompt: request.prompt,
      cwd: request.workDir,
      model: request.modelConfig?.model,
      sessionId: session.id,
      // ... 其他选项
    };

    session.phase = "executing";

    try {
      // 使用现有的 SdkChatProxy 执行
      // 需要修改 SdkChatProxy 支持 AsyncGenerator 返回
      for await (const message of this.executeWithStreaming(options, session)) {
        yield message;
      }
    } finally {
      session.phase = "idle";
    }

    yield { type: "done" };
  }

  stopSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.abortController.abort();
      session.isAborted = true;
      return true;
    }
    return false;
  }

  // ... 其他方法
}

let agentService: AgentService | null = null;

export function getAgentService(): AgentService {
  if (!agentService) {
    agentService = new AgentService();
  }
  return agentService;
}
```

### SdkChatProxy 扩展

修改 `packages/core/src/executors/chat/sdk-proxy.ts` 支持流式返回：

```typescript
// 新增流式执行方法
async *executeStreaming(options: ChatOptions): AsyncGenerator<AgentMessage> {
  const sdk = await loadClaudeSdk();
  if (!sdk) {
    yield { type: "error", message: "Claude Agent SDK not installed" };
    return;
  }

  const queryOptions = this.buildQueryOptions(options);
  const queryResult = sdk.query({
    prompt: options.prompt!,
    options: queryOptions,
  });

  for await (const message of queryResult) {
    yield this.convertSdkMessage(message);
  }
}

private convertSdkMessage(message: unknown): AgentMessage {
  const msg = message as Record<string, unknown>;

  switch (msg.type) {
    case "assistant":
      return { type: "text", content: this.extractTextContent(msg) };
    case "tool_use":
      return {
        type: "tool_use",
        id: msg.id,
        name: msg.name,
        input: msg.input,
      };
    case "tool_result":
      return {
        type: "tool_result",
        toolUseId: msg.tool_use_id,
        output: msg.output,
        isError: msg.is_error,
      };
    case "result":
      return {
        type: "result",
        cost: msg.cost,
        duration: msg.duration,
      };
    default:
      return msg as AgentMessage;
  }
}
```

---

## Phase 3: Desktop Hook

### useAgent Hook

在 `apps/desktop/src/hooks/use-agent.ts` 实现：

```typescript
// apps/desktop/src/hooks/use-agent.ts

import { useState, useCallback, useRef } from "react";
import type { AgentMessage } from "@/types";
import { getGatewayClient } from "@/lib/gateway";

export type AgentPhase = "idle" | "planning" | "awaiting_approval" | "executing";

export interface TaskPlan {
  id: string;
  goal: string;
  steps: PlanStep[];
  notes?: string;
}

export interface PlanStep {
  id: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "failed" | "cancelled";
}

export interface PendingQuestion {
  id: string;
  questions: Array<{
    header: string;
    question: string;
    options: Array<{ label: string; description?: string }>;
    multiSelect: boolean;
  }>;
}

export interface UseAgentOptions {
  workDir?: string;
  agentId?: string;
  onMessage?: (message: AgentMessage) => void;
  onComplete?: (cost: number, duration: number) => void;
  onError?: (error: string) => void;
}

export interface UseAgentReturn {
  // State
  messages: AgentMessage[];
  phase: AgentPhase;
  isRunning: boolean;
  plan: TaskPlan | null;
  pendingQuestion: PendingQuestion | null;
  sessionId: string | null;
  error: string | null;

  // Actions
  runAgent: (prompt: string, attachments?: Attachment[]) => Promise<void>;
  continueConversation: (message: string, attachments?: Attachment[]) => Promise<void>;
  stopAgent: () => void;
  approvePlan: () => Promise<void>;
  rejectPlan: () => Promise<void>;
  respondToQuestion: (answers: Record<string, string>) => Promise<void>;
  clearMessages: () => void;
}

export function useAgent(options: UseAgentOptions = {}): UseAgentReturn {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [phase, setPhase] = useState<AgentPhase>("idle");
  const [plan, setPlan] = useState<TaskPlan | null>(null);
  const [pendingQuestion, setPendingQuestion] = useState<PendingQuestion | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const runAgent = useCallback(async (prompt: string, attachments?: Attachment[]) => {
    const gateway = getGatewayClient();
    abortControllerRef.current = new AbortController();

    setPhase("executing");
    setError(null);

    // 添加用户消息
    const userMessage: AgentMessage = {
      id: Date.now().toString(),
      type: "user",
      content: prompt,
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const response = await fetch(`${gateway.baseUrl}/api/agent/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          workDir: options.workDir,
          agentId: options.agentId,
          attachments,
        }),
        signal: abortControllerRef.current.signal,
      });

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = JSON.parse(line.slice(6)) as AgentMessage;
            handleSSEMessage(data);
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        // 用户取消
      } else {
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(errorMessage);
        options.onError?.(errorMessage);
      }
    } finally {
      setPhase("idle");
    }
  }, [options]);

  const handleSSEMessage = useCallback((message: AgentMessage) => {
    switch (message.type) {
      case "session":
        setSessionId(message.sessionId as string);
        break;

      case "text":
        setMessages((prev) => [...prev, message]);
        break;

      case "tool_use":
      case "tool_result":
        setMessages((prev) => [...prev, message]);
        break;

      case "plan":
        setPlan(message.plan as TaskPlan);
        setPhase("awaiting_approval");
        break;

      case "question":
        setPendingQuestion({
          id: message.id as string,
          questions: message.questions as PendingQuestion["questions"],
        });
        break;

      case "result":
        options.onComplete?.(
          message.cost as number,
          message.duration as number
        );
        break;

      case "error":
        setError(message.message as string);
        options.onError?.(message.message as string);
        break;

      case "done":
        setPhase("idle");
        break;
    }

    options.onMessage?.(message);
  }, [options]);

  const stopAgent = useCallback(() => {
    abortControllerRef.current?.abort();
    if (sessionId) {
      const gateway = getGatewayClient();
      fetch(`${gateway.baseUrl}/api/agent/stop/${sessionId}`, {
        method: "POST",
      });
    }
    setPhase("idle");
  }, [sessionId]);

  const approvePlan = useCallback(async () => {
    if (!plan) return;
    const gateway = getGatewayClient();
    await fetch(`${gateway.baseUrl}/api/agent/approve/${plan.id}`, {
      method: "POST",
    });
    setPhase("executing");
  }, [plan]);

  const rejectPlan = useCallback(async () => {
    if (!plan) return;
    const gateway = getGatewayClient();
    await fetch(`${gateway.baseUrl}/api/agent/reject/${plan.id}`, {
      method: "POST",
    });
    setPlan(null);
    setPhase("idle");
  }, [plan]);

  const respondToQuestion = useCallback(async (answers: Record<string, string>) => {
    if (!pendingQuestion) return;
    const gateway = getGatewayClient();
    await fetch(`${gateway.baseUrl}/api/agent/answer/${pendingQuestion.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    });
    setPendingQuestion(null);
  }, [pendingQuestion]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setPlan(null);
    setPendingQuestion(null);
    setError(null);
  }, []);

  return {
    messages,
    phase,
    isRunning: phase !== "idle",
    plan,
    pendingQuestion,
    sessionId,
    error,
    runAgent,
    continueConversation: runAgent, // 简化实现，复用 runAgent
    stopAgent,
    approvePlan,
    rejectPlan,
    respondToQuestion,
    clearMessages,
  };
}
```

---

## Phase 4: 后台任务管理

### Background Tasks Service

在 `packages/core/src/services/background-tasks.ts` 实现：

```typescript
// packages/core/src/services/background-tasks.ts

export interface BackgroundTask {
  taskId: string;
  sessionId: string;
  prompt: string;
  status: "running" | "completed" | "error" | "cancelled";
  startedAt: Date;
  completedAt?: Date;
}

type TaskListener = (tasks: BackgroundTask[]) => void;

class BackgroundTaskManager {
  private tasks = new Map<string, BackgroundTask>();
  private listeners = new Set<TaskListener>();
  private abortControllers = new Map<string, AbortController>();

  addTask(task: Omit<BackgroundTask, "startedAt" | "status">): BackgroundTask {
    const fullTask: BackgroundTask = {
      ...task,
      status: "running",
      startedAt: new Date(),
    };
    this.tasks.set(task.taskId, fullTask);
    this.abortControllers.set(task.taskId, new AbortController());
    this.notifyListeners();
    return fullTask;
  }

  updateStatus(taskId: string, status: BackgroundTask["status"]): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = status;
      if (status !== "running") {
        task.completedAt = new Date();
      }
      this.notifyListeners();
    }
  }

  stopTask(taskId: string): void {
    const controller = this.abortControllers.get(taskId);
    if (controller) {
      controller.abort();
    }
    this.updateStatus(taskId, "cancelled");
  }

  getTask(taskId: string): BackgroundTask | undefined {
    return this.tasks.get(taskId);
  }

  getAllTasks(): BackgroundTask[] {
    return Array.from(this.tasks.values());
  }

  getAbortSignal(taskId: string): AbortSignal | undefined {
    return this.abortControllers.get(taskId)?.signal;
  }

  subscribe(listener: TaskListener): () => void {
    this.listeners.add(listener);
    listener(this.getAllTasks());
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const tasks = this.getAllTasks();
    this.listeners.forEach((listener) => listener(tasks));
  }

  cleanup(taskId: string): void {
    this.tasks.delete(taskId);
    this.abortControllers.delete(taskId);
    this.notifyListeners();
  }
}

export const backgroundTaskManager = new BackgroundTaskManager();
```

### Desktop Hook

在 `apps/desktop/src/hooks/use-background-tasks.ts`:

```typescript
// apps/desktop/src/hooks/use-background-tasks.ts

import { useState, useEffect, useCallback } from "react";
import { getGatewayClient } from "@/lib/gateway";

export interface BackgroundTask {
  taskId: string;
  sessionId: string;
  prompt: string;
  status: "running" | "completed" | "error" | "cancelled";
  startedAt: string;
}

export function useBackgroundTasks() {
  const [tasks, setTasks] = useState<BackgroundTask[]>([]);

  useEffect(() => {
    const gateway = getGatewayClient();
    // 使用 SSE 订阅后台任务状态
    const eventSource = new EventSource(
      `${gateway.baseUrl}/api/agent/tasks/subscribe`
    );

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setTasks(data.tasks);
    };

    return () => eventSource.close();
  }, []);

  const stopTask = useCallback(async (taskId: string) => {
    const gateway = getGatewayClient();
    await fetch(`${gateway.baseUrl}/api/agent/tasks/${taskId}/stop`, {
      method: "POST",
    });
  }, []);

  const runningCount = tasks.filter((t) => t.status === "running").length;

  return { tasks, runningCount, stopTask };
}
```

---

## Phase 5: UI 组件

### PlanApproval 组件

```typescript
// apps/desktop/src/components/chat/plan-approval.tsx

import { Check, X, Play, ListTodo, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TaskPlan, PlanStep } from "@/hooks/use-agent";

interface PlanApprovalProps {
  plan: TaskPlan;
  isWaitingApproval: boolean;
  onApprove?: () => void;
  onReject?: () => void;
}

export function PlanApproval({
  plan,
  isWaitingApproval,
  onApprove,
  onReject,
}: PlanApprovalProps) {
  const isAllCompleted = plan.steps.every((step) => step.status === "completed");
  const isCancelled = plan.steps.some((step) => step.status === "cancelled");

  return (
    <div
      className={cn(
        "space-y-4 rounded-xl border p-4",
        isCancelled && !isWaitingApproval
          ? "border-muted-foreground/30 bg-muted/30"
          : isAllCompleted && !isWaitingApproval
            ? "border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-950/20"
            : "border-primary/30 bg-accent/30"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-foreground flex items-center gap-2 text-sm font-medium">
          {isCancelled && !isWaitingApproval ? (
            <Ban className="text-muted-foreground size-4" />
          ) : isAllCompleted && !isWaitingApproval ? (
            <Check className="size-4 text-emerald-500" />
          ) : (
            <ListTodo className="text-primary size-4" />
          )}
          执行计划
          {isWaitingApproval && (
            <span className="bg-primary/20 text-primary rounded-full px-2 py-0.5 text-xs">
              等待批准
            </span>
          )}
        </div>
      </div>

      {/* Goal */}
      <div className="space-y-1">
        <p className="text-muted-foreground text-xs">目标</p>
        <p className="text-foreground text-sm">{plan.goal}</p>
      </div>

      {/* Steps */}
      <div className="space-y-2">
        {plan.steps.map((step, index) => (
          <PlanStepItem key={step.id} step={step} index={index} />
        ))}
      </div>

      {/* Actions */}
      {isWaitingApproval && onApprove && onReject && (
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={onReject}>
            <X className="size-4 mr-1" />
            拒绝
          </Button>
          <Button size="sm" onClick={onApprove}>
            <Play className="size-4 mr-1" />
            开始执行
          </Button>
        </div>
      )}
    </div>
  );
}

function PlanStepItem({ step, index }: { step: PlanStep; index: number }) {
  return (
    <div className="flex items-start gap-2.5">
      <div
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border text-xs font-medium",
          step.status === "completed"
            ? "bg-primary border-primary text-primary-foreground"
            : step.status === "in_progress"
              ? "border-primary bg-primary/10 text-primary"
              : "border-muted-foreground/30 bg-background text-muted-foreground"
        )}
      >
        {step.status === "completed" ? (
          <Check className="size-3" />
        ) : step.status === "in_progress" ? (
          <div className="bg-primary size-1.5 animate-pulse rounded-full" />
        ) : (
          index + 1
        )}
      </div>
      <span
        className={cn(
          "min-w-0 flex-1 text-sm leading-snug",
          step.status === "completed"
            ? "text-muted-foreground"
            : step.status === "in_progress"
              ? "text-foreground font-medium"
              : "text-foreground"
        )}
      >
        {step.description}
      </span>
    </div>
  );
}
```

---

## 迁移检查清单

### Phase 1: Gateway API ✅
- [ ] 创建 `packages/core/src/gateway/routes/agent.ts`
- [ ] 实现 `/api/agent/run` SSE 端点
- [ ] 实现 `/api/agent/stop/:sessionId` 端点
- [ ] 实现 `/api/agent/approve/:planId` 端点
- [ ] 实现 `/api/agent/reject/:planId` 端点
- [ ] 在 `packages/core/src/gateway/index.ts` 注册路由
- [ ] 编写单元测试

### Phase 2: Agent Service ✅
- [ ] 创建 `packages/core/src/services/agent.ts`
- [ ] 实现 `AgentService` 类
- [ ] 扩展 `SdkChatProxy` 支持流式返回
- [ ] 实现会话管理
- [ ] 实现计划存储/批准/拒绝
- [ ] 编写单元测试

### Phase 3: Desktop Hook ✅
- [ ] 创建/更新 `apps/desktop/src/hooks/use-agent.ts`
- [ ] 实现 SSE 连接管理
- [ ] 实现状态管理 (messages, phase, plan)
- [ ] 实现 stopAgent, approvePlan, rejectPlan
- [ ] 更新 `workspace-chat.tsx` 使用新 Hook

### Phase 4: 后台任务 ✅
- [ ] 创建 `packages/core/src/services/background-tasks.ts`
- [ ] 创建 `apps/desktop/src/hooks/use-background-tasks.ts`
- [ ] 实现任务订阅 SSE 端点
- [ ] 实现任务状态 UI 通知

### Phase 5: UI 组件 ✅
- [ ] 创建 `apps/desktop/src/components/chat/plan-approval.tsx`
- [ ] 创建 `apps/desktop/src/components/chat/question-input.tsx`
- [ ] 更新 `DesktopMessageList` 支持新消息类型
- [ ] 添加国际化翻译

---

## 验收标准

- [ ] 用户可以通过对话页面与 Agent 交互
- [ ] SSE 流式响应正常工作
- [ ] 执行计划显示且可批准/拒绝
- [ ] 后台任务在切换页面时继续运行
- [ ] 错误处理和用户反馈正常
- [ ] TypeScript 编译通过
- [ ] 所有测试通过

---

## 原始文件引用

### WorkAny 源码

| 功能 | 文件路径 | 行数 |
|------|----------|------|
| API 服务器 | `workany/src-api/src/index.ts` | 129 |
| Agent 路由 | `workany/src-api/src/app/api/agent.ts` | 241 |
| Agent 服务 | `workany/src-api/src/shared/services/agent.ts` | ~300 |
| Claude Agent | `workany/src-api/src/extensions/agent/claude/index.ts` | 1913 |
| 后台任务 | `workany/src/shared/lib/background-tasks.ts` | 141 |
| useAgent Hook | `workany/src/shared/hooks/useAgent.ts` | ~1200 |
| PlanApproval | `workany/src/components/task/PlanApproval.tsx` | 157 |

### Viben 目标文件

| 功能 | 文件路径 |
|------|----------|
| Gateway 路由 | `packages/core/src/gateway/routes/agent.ts` |
| Agent 服务 | `packages/core/src/services/agent.ts` |
| SDK 代理 | `packages/core/src/executors/chat/sdk-proxy.ts` |
| 后台任务 | `packages/core/src/services/background-tasks.ts` |
| useAgent Hook | `apps/desktop/src/hooks/use-agent.ts` |
| PlanApproval | `apps/desktop/src/components/chat/plan-approval.tsx` |

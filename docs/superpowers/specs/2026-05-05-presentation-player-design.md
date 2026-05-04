# Presentation Player + 端侧工具完成机制 设计文档

## 概述

为 Presentation Mode 添加播放器进度条 UI，支持用户手动控制演示步骤播放。同时重构后端 MCP tool handler，使工具调用等待前端执行完毕并收集截图后才返回结果。

设计将 Presentation Tool 视为通用**端侧工具（Client-Side Tool）**的一个实例，完成机制对所有端侧工具通用。

---

## 目标

1. Presentation overlay 底部居中显示播放器控制条（回到开头、后退、播放/暂停、前进、回到末尾、进度条、步数、详情按钮）
2. 播放器粒度为 **单条 command**，每个 command 有入场动画（~150ms），暂停时动画立即完成
3. 暂停后允许拖动进度条跳转到任意步骤
4. 步骤详情面板：展开后显示所有步骤卡片列表（截图缩略图 + command 描述 + 完整参数），高亮当前步骤
5. MCP presentation 工具调用等待前端执行完毕后才算完成，tool_result 包含每步截图

---

## 架构概览

```
┌─────────────────────────────────────────────────────────────────┐
│ Claude SDK                                                       │
│   LLM → tool_use(presentation_walkthrough) → MCP handler 挂起   │
└─────────────────┬───────────────────────────────────────────────┘
                  │ SDK iterator yields assistant message
┌─────────────────▼───────────────────────────────────────────────┐
│ Gateway (agent-run.ts)                                           │
│   检测端侧工具 → enqueue(sessionId, toolUseId) → sendSSE        │
└─────────────────┬───────────────────────────────────────────────┘
                  │ SSE: tool_use
┌─────────────────▼───────────────────────────────────────────────┐
│ Frontend (use-agent-conversation.ts)                              │
│   拦截 tool_use → compilePresentationCommands → addSteps         │
└─────────────────┬───────────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────────┐
│ PresentationLayer                                                │
│   逐步执行 command 动画 → 隐藏overlay → 截图 → 恢复overlay       │
│   → completePresentationStep                                     │
│   所有 commands done → POST /api/client-tools/complete           │
└─────────────────┬───────────────────────────────────────────────┘
                  │ HTTP POST
┌─────────────────▼───────────────────────────────────────────────┐
│ Gateway (client-tools/complete endpoint)                          │
│   clientToolCompletionRegistry.complete(toolUseId, result)       │
│   → resolve handler promise                                      │
└─────────────────┬───────────────────────────────────────────────┘
                  │ handler returns CallToolResult
┌─────────────────▼───────────────────────────────────────────────┐
│ Claude SDK                                                       │
│   tool_result(含截图) → 喂给 LLM → agent 继续                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part 1：后端 — 通用端侧工具完成机制

### 1.1 新文件：`packages/core/src/services/client-tool-completion.ts`

```typescript
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

// ============================================================================
// Types
// ============================================================================

interface TimeoutContext {
  toolName: string;
  toolUseId: string;
  elapsedMs: number;
}

/**
 * 全局安全网超时（10 分钟）
 * 即使 timeoutMs=0（声明永不超时），也不会真的无限等待。
 * 防止前端崩溃/断连导致 handler 永远挂起。
 */
const GLOBAL_MAX_TIMEOUT_MS = 10 * 60 * 1000;

interface ClientSideToolOptions {
  /**
   * 超时时间（毫秒）
   * 0 = 使用全局安全网超时（GLOBAL_MAX_TIMEOUT_MS）
   * undefined = 使用全局安全网超时
   * 正整数 = 使用该值（但仍受 GLOBAL_MAX_TIMEOUT_MS 上限约束）
   */
  timeoutMs?: number;

  /**
   * 超时时的 fallback 结果生成器
   * 未提供则使用默认话术
   */
  onTimeout?: (context: TimeoutContext) => CallToolResult;
}

interface PendingEntry {
  resolve: (result: CallToolResult) => void;
  reject: (error: Error) => void;
  timeout?: NodeJS.Timeout;
  sessionId: string;
  toolName: string;
  toolUseId: string;
  createdAt: number;
}

// ============================================================================
// Error
// ============================================================================

class ClientToolCancelledError extends Error {
  constructor(public sessionId: string, public toolUseId: string) {
    super(`Session ${sessionId} cancelled while waiting for client tool ${toolUseId}`);
    this.name = "ClientToolCancelledError";
  }
}

// ============================================================================
// Registry
// ============================================================================

class ClientToolCompletionRegistry {
  /** tool name → options（注册时设定） */
  private toolOptions = new Map<string, ClientSideToolOptions>();
  /** sessionId → [toolUseId] 队列 */
  private sessionQueues = new Map<string, string[]>();
  /** toolUseId → pending entry */
  private pending = new Map<string, PendingEntry>();

  // ---- 工具注册 ----

  /**
   * 注册端侧工具配置（MCP server 创建时调用）
   */
  registerToolOptions(toolName: string, options: ClientSideToolOptions): void {
    this.toolOptions.set(toolName, options);
  }

  /**
   * 判断是否为已注册的端侧工具
   * 自动处理 mcp__ 前缀
   */
  isClientSideTool(toolName: string): boolean {
    const bare = toolName.replace(/^mcp__\w+__/, "");
    return this.toolOptions.has(bare);
  }

  // ---- Gateway stream loop 调用 ----

  /**
   * 将即将执行的端侧工具 toolUseId 推入 session 队列
   */
  enqueue(sessionId: string, toolUseId: string, toolName: string): void {
    const bare = toolName.replace(/^mcp__\w+__/, "");
    if (!this.sessionQueues.has(sessionId)) {
      this.sessionQueues.set(sessionId, []);
    }
    this.sessionQueues.get(sessionId)!.push(toolUseId);
    // 同时记录 toolName → toolUseId 映射（dequeue 时需要）
    this.pending.set(toolUseId, {
      resolve: () => {},
      reject: () => {},
      sessionId,
      toolName: bare,
      toolUseId,
      createdAt: Date.now(),
    });
  }

  // ---- MCP handler 调用 ----

  /**
   * 从 session 队列 dequeue，注册 promise 并等待客户端完成
   * 超时策略由 registerToolOptions 时设定
   */
  async waitForClient(sessionId: string): Promise<CallToolResult> {
    const queue = this.sessionQueues.get(sessionId);
    if (!queue || queue.length === 0) {
      return { content: [{ type: "text", text: "No pending client tool call found." }], isError: true };
    }

    const toolUseId = queue.shift()!;
    const entry = this.pending.get(toolUseId);
    if (!entry) {
      return { content: [{ type: "text", text: "Pending entry not found." }], isError: true };
    }

    const toolName = entry.toolName;
    const options = this.toolOptions.get(toolName) ?? {};

    return new Promise((resolve, reject) => {
      entry.resolve = resolve;
      entry.reject = reject;

      // 计算有效超时：取 clientSideTools 配置值与全局安全网的较小者
      // timeoutMs=0 意为"尽量不超时"，但仍受全局安全网保护
      const configTimeout = options.timeoutMs && options.timeoutMs > 0
        ? options.timeoutMs
        : GLOBAL_MAX_TIMEOUT_MS;
      const effectiveTimeout = Math.min(configTimeout, GLOBAL_MAX_TIMEOUT_MS);

      entry.timeout = setTimeout(() => {
        this.pending.delete(toolUseId);
        const fallback = (options.onTimeout ?? defaultTimeoutResult)({
          toolName,
          toolUseId,
          elapsedMs: effectiveTimeout,
        });
        resolve(fallback);
      }, effectiveTimeout);

      this.pending.set(toolUseId, entry);
    });
  }

  // ---- Frontend 回调 ----

  /**
   * 客户端完成执行后调用，resolve 对应的 pending promise
   */
  complete(toolUseId: string, result: CallToolResult): boolean {
    const entry = this.pending.get(toolUseId);
    if (!entry) return false;
    if (entry.timeout) clearTimeout(entry.timeout);
    this.pending.delete(toolUseId);
    entry.resolve(result);
    return true;
  }

  // ---- Session 生命周期 ----

  /**
   * 取消 session 所有挂起的端侧工具调用
   * reject → handler 抛异常 → SDK abort 流程捕获
   */
  cancelSession(sessionId: string): void {
    for (const [toolUseId, entry] of this.pending) {
      if (entry.sessionId !== sessionId) continue;
      if (entry.timeout) clearTimeout(entry.timeout);
      this.pending.delete(toolUseId);
      entry.reject(new ClientToolCancelledError(sessionId, toolUseId));
    }
    this.sessionQueues.delete(sessionId);
  }
}

// ---- Default fallback ----

function defaultTimeoutResult(ctx: TimeoutContext): CallToolResult {
  return {
    content: [{
      type: "text",
      text: `Client-side tool "${ctx.toolName}" timed out after ${Math.round(ctx.elapsedMs / 1000)}s. The client may be unresponsive. You may retry or skip this step.`,
    }],
    isError: true,
  };
}

export { ClientToolCompletionRegistry, ClientToolCancelledError };
export type { ClientSideToolOptions, TimeoutContext };
export const clientToolCompletionRegistry = new ClientToolCompletionRegistry();
```

### 1.2 SdkMcpServerOptions 扩展

`packages/core/src/executors/chat/sdk-mcp-registry.ts` 中：

```typescript
interface SdkMcpServerConfig {
  name: string;
  version: string;
  tools: ToolDefinition[];
  /**
   * 声明端侧工具及其等待策略
   * key = bare tool name (不含 mcp__ 前缀)
   * 注册时自动调用 clientToolCompletionRegistry.registerToolOptions()
   */
  clientSideTools?: Record<string, ClientSideToolOptions>;
}
```

`createSdkMcpServer()` 内部在创建 server 时自动注册：

```typescript
if (config.clientSideTools) {
  for (const [toolName, options] of Object.entries(config.clientSideTools)) {
    clientToolCompletionRegistry.registerToolOptions(toolName, options);
  }
}
```

### 1.3 MCP Server Factory 签名扩展

```typescript
type McpServerFactory = (sdk: ClaudeAgentSdk, context?: { sessionId?: string }) => McpServer;
```

`SdkChatProxy.executeStreaming()` 在 `resolveSdkMcpServers()` 时传入 `{ sessionId }`。

### 1.4 Presentation MCP Server 改造

`packages/core/src/executors/chat/sdk-mcp-servers/presentation.ts`：

```typescript
registerSdkMcpServer("presentation", (sdk, context) => {
  const { createSdkMcpServer, tool } = sdk;
  const sessionId = context?.sessionId!;
  const z = require("zod");

  // ... schema 定义不变 ...

  return createSdkMcpServer({
    name: "presentation",
    version: "2.0.0",
    tools: [
      tool("presentation_draw", "...", schema, async (args) => {
        if (!args.commands?.length) return error("commands is empty");
        return await clientToolCompletionRegistry.waitForClient(sessionId);
      }),
      tool("presentation_spotlight", "...", schema, async (args) => {
        if (!args.title && !args.description) return error("provide title or description");
        return await clientToolCompletionRegistry.waitForClient(sessionId);
      }),
      tool("presentation_callout", "...", schema, async (args) => {
        if (!args.label?.trim()) return error("label must not be empty");
        return await clientToolCompletionRegistry.waitForClient(sessionId);
      }),
      tool("presentation_walkthrough", "...", schema, async (args) => {
        if (!args.steps?.length) return error("steps is empty");
        return await clientToolCompletionRegistry.waitForClient(sessionId);
      }),
      tool("presentation_compare", "...", schema, async (args) => {
        if (!args.left?.label?.trim() || !args.right?.label?.trim()) return error("labels required");
        return await clientToolCompletionRegistry.waitForClient(sessionId);
      }),
      // clear 和 stop 不是端侧工具，立即返回
      tool("presentation_clear", "...", {}, async () => ok("Canvas cleared.")),
      tool("presentation_stop", "...", {}, async () => ok("Presentation stopped.")),
    ],
    clientSideTools: {
      presentation_draw:        { timeoutMs: 30_000 },
      presentation_spotlight:   { timeoutMs: 30_000 },
      presentation_callout:     { timeoutMs: 30_000 },
      presentation_compare:     { timeoutMs: 30_000 },
      presentation_walkthrough: { timeoutMs: 0 },  // 使用全局安全网超时（10min）
    },
  });
});
```

### 1.5 Gateway Stream Loop 改造

`packages/core/src/gateway/routes/agent-run.ts` 的 streaming loop 中：

```typescript
for await (const message of stream) {
  // 检测端侧工具，推入完成队列
  if (message.type === "tool_use") {
    const toolUseMsg = message as SSEToolUseMessage;
    if (clientToolCompletionRegistry.isClientSideTool(toolUseMsg.name)) {
      clientToolCompletionRegistry.enqueue(sessionId, toolUseMsg.id, toolUseMsg.name);
    }
  }

  sendSSE(reply, message);
  // ... 其余逻辑不变
}
```

同样修改 `agent-ws.ts` 的 WebSocket 路由。

### 1.6 新 Gateway 端点

`packages/core/src/gateway/routes/client-tools.ts`（新文件）：

```typescript
import type { FastifyInstance } from "fastify";
import { clientToolCompletionRegistry } from "../../services/client-tool-completion";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

interface CompleteBody {
  tool_use_id: string;
  session_id: string;  // 用于安全校验
  result: CallToolResult;
}

export async function registerClientToolRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: CompleteBody }>("/api/client-tools/complete", async (request, reply) => {
    const { tool_use_id, session_id, result } = request.body;

    // 安全校验：验证 tool_use_id 所属 session 与请求声明的 session_id 一致
    const success = clientToolCompletionRegistry.complete(tool_use_id, session_id, result);
    if (!success) {
      return reply.status(404).send({ success: false, error: "No pending tool call found or session mismatch" });
    }
    return reply.send({ success: true });
  });
}
```

Registry 的 `complete` 方法增加 sessionId 校验：

```typescript
complete(toolUseId: string, sessionId: string, result: CallToolResult): boolean {
  const entry = this.pending.get(toolUseId);
  if (!entry) return false;
  // 安全校验：防止伪造 tool_use_id 完成其他 session 的工具调用
  if (entry.sessionId !== sessionId) return false;
  if (entry.timeout) clearTimeout(entry.timeout);
  this.pending.delete(toolUseId);
  entry.resolve(result);
  return true;
}
```

### 1.7 Session Abort 集成

在 `agentService.abortSession()` **和** `agentService.stopSession()` 中都调用：

```typescript
clientToolCompletionRegistry.cancelSession(sessionId);
```

**关键**: `stopSession()` 设置 `abortController.abort()` 但 stream loop 只在收到下一条消息时检查 abort 状态。如果 handler 正在 `waitForClient()` 挂起，stream loop 会被阻塞无法检查。因此 `cancelSession()` 必须在 stop 时立即调用，通过 reject handler 的 promise 来解除 stream 阻塞。handler reject 后 SDK 的错误处理会让 iterator 抛出异常，stream loop 进入 catch 块正常结束。

### 1.8 时序安全性说明

**enqueue/dequeue 顺序保证**：

```
时序: gateway yield tool_use SSE → enqueue() → [stream blocked] → SDK 调用 handler → handler waitForClient() → dequeue()
```

这依赖以下保障条件：
1. SDK iterator yields `assistant` 消息（含所有 tool_use blocks）**先于**调用任何 MCP handler
2. Gateway stream loop 在同一次迭代中同步执行 enqueue + sendSSE
3. Handler 的 `waitForClient()` 在 dequeue 时，entry 已存在于 `pending` map

**同一 turn 多个 tool_use 的并发安全**：

即使 SDK 对同一 assistant message 中的多个 tool_use 并行调用 handler，Node.js 单线程模型保证 `queue.shift()` 不会真正并发。两个 handler 的 `waitForClient()` 调用会在 event loop 中交替执行，第一个到达的 handler dequeue 第一个 entry。由于 gateway 按 content blocks 顺序 enqueue，且 SDK 按相同顺序初始化 handler 调用，顺序是一致的。

### 1.9 Orphan Entry 清理

定期清理因异常退出而残留的 pending entries：

```typescript
class ClientToolCompletionRegistry {
  // ...

  /**
   * 清理超过 maxAge 的 orphan entries（由定时器周期调用）
   */
  gc(maxAgeMs: number = GLOBAL_MAX_TIMEOUT_MS * 2): void {
    const now = Date.now();
    for (const [toolUseId, entry] of this.pending) {
      if (now - entry.createdAt > maxAgeMs) {
        if (entry.timeout) clearTimeout(entry.timeout);
        this.pending.delete(toolUseId);
        entry.reject(new ClientToolCancelledError(entry.sessionId, toolUseId));
      }
    }
  }
}

// Gateway 启动时注册 GC 定时器
setInterval(() => clientToolCompletionRegistry.gc(), 5 * 60 * 1000); // 5 分钟一次
```

---

## Part 2：前端 — 步骤模型 + 播放器状态

### 2.1 Types

`apps/desktop/src/lib/presentation/types.ts` 扩展：

```typescript
// 已有 PresentationCommand 定义不变

export interface PresentationStep {
  /** 步骤唯一 ID: `${toolUseId}-${index}` */
  id: string;
  /** 所属 tool_use */
  toolUseId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  /** 该步对应的单条 command */
  command: PresentationCommand;
  /** command 人可读描述 */
  description: string;
  /** 执行后截图 (data URL) */
  screenshot?: string;
  /** 执行状态 */
  status: "pending" | "executing" | "done";
}

export type PlayerState = "idle" | "playing" | "paused";
```

### 2.2 Overlay Store 重构

`apps/desktop/src/stores/overlay-store.ts` Presentation 部分：

**State**（替换原有 `presentationCommands`）：

```typescript
// Presentation
presentationActive: boolean;
presentationSteps: PresentationStep[];
presentationCurrentStep: number;        // 当前步骤 index (0-based)
presentationPlayerState: PlayerState;
presentationDetailsOpen: boolean;
```

**Actions**（替换原有 presentation actions）：

```typescript
// Presentation
startPresentation: () => void;
stopPresentation: () => void;

/** 添加步骤（一个 tool_use 产生多个 command steps） */
addPresentationSteps: (params: {
  toolUseId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  commands: PresentationCommand[];
}) => void;

/** 更新步骤状态 */
updateStepStatus: (stepId: string, status: PresentationStep["status"]) => void;

/** 标记步骤完成 + 存截图 */
completePresentationStep: (stepId: string, screenshot: string) => void;

/** 播放器控制 */
playerPlay: () => void;
playerPause: () => void;
playerGoTo: (stepIndex: number) => void;
playerNext: () => void;
playerPrev: () => void;
playerGoToStart: () => void;
playerGoToEnd: () => void;

/** 步骤详情面板开关 */
togglePresentationDetails: () => void;
```

**描述生成辅助函数**：

```typescript
function describeCommand(cmd: PresentationCommand): string {
  switch (cmd.type) {
    case "highlight":
      return `高亮区域 (${cmd.region.x}, ${cmd.region.y}) ${cmd.region.width}×${cmd.region.height}`;
    case "arrow":
      return `箭头 (${cmd.from.x},${cmd.from.y}) → (${cmd.to.x},${cmd.to.y})`;
    case "circle":
      return `圆圈 (${cmd.center.x},${cmd.center.y}) r=${cmd.radius}`;
    case "text":
      return `文字 "${cmd.content.slice(0, 30)}"`;
    case "line":
      return `线条 ${cmd.points.length} 个点`;
    case "clear":
      return "清空画布";
    case "wait":
      return `等待 ${cmd.ms}ms`;
  }
}
```

**Action 实现要点**：

```typescript
addPresentationSteps: ({ toolUseId, toolName, toolInput, commands }) => {
  const newSteps: PresentationStep[] = commands.map((cmd, i) => ({
    id: `${toolUseId}-${i}`,
    toolUseId,
    toolName,
    toolInput,
    command: cmd,
    description: describeCommand(cmd),
    status: "pending",
  }));
  set(s => ({
    presentationSteps: [...s.presentationSteps, ...newSteps],
  }));
},

completePresentationStep: (stepId, screenshot) => {
  set(s => ({
    presentationSteps: s.presentationSteps.map(step =>
      step.id === stepId ? { ...step, status: "done", screenshot } : step
    ),
  }));
  // 注意：回调由 PresentationLayer 检查并触发
},

playerGoTo: (stepIndex) => {
  set({ presentationCurrentStep: stepIndex, presentationPlayerState: "paused" });
},

playerPlay: () => set({ presentationPlayerState: "playing" }),
playerPause: () => set({ presentationPlayerState: "paused" }),
playerNext: () => set(s => ({
  presentationCurrentStep: Math.min(s.presentationCurrentStep + 1, s.presentationSteps.length - 1),
})),
playerPrev: () => set(s => ({
  presentationCurrentStep: Math.max(s.presentationCurrentStep - 1, 0),
})),
playerGoToStart: () => set({ presentationCurrentStep: 0, presentationPlayerState: "paused" }),
playerGoToEnd: () => set(s => ({
  presentationCurrentStep: s.presentationSteps.length - 1,
  presentationPlayerState: "paused",
})),
```

### 2.3 前端拦截逻辑重构

`apps/desktop/src/pages/conversation/hooks/use-agent-conversation.ts`：

```typescript
// tool_use case 中：
if (isClientSidePresentationTool(toolName)) {
  const store = useOverlayStore.getState();
  if (!store.presentationActive) {
    store.actions.startPresentation();
  }
  const commands = compilePresentationCommands(toolName, toolInput);
  store.actions.addPresentationSteps({
    toolUseId: data.id,
    toolName,
    toolInput,
    commands,
  });
}
```

### 2.4 后端回调触发

当某个 tool_use 的所有 steps 完成后，POST 截图给后端。

**前端类型**：前端不直接依赖 `@modelcontextprotocol/sdk`，定义轻量级等效类型：

```typescript
// apps/desktop/src/lib/presentation/types.ts

/** MCP CallToolResult 的前端等效类型（避免依赖后端 MCP SDK 包） */
export type ClientToolResultContent =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string };

export interface ClientToolCompletePayload {
  tool_use_id: string;
  session_id: string;
  result: {
    content: ClientToolResultContent[];
    isError?: boolean;
  };
}
```

回调逻辑：

```typescript
// PresentationLayer 中或 store middleware
function checkAndPostCompletion(steps: PresentationStep[], completedStepId: string) {
  const step = steps.find(s => s.id === completedStepId);
  if (!step) return;

  const toolSteps = steps.filter(s => s.toolUseId === step.toolUseId);
  if (!toolSteps.every(s => s.status === "done")) return;

  // 所有 command 已完成，POST 给后端
  const content: ClientToolResultContent[] = [
    { type: "text", text: `Executed ${step.toolName} with ${toolSteps.length} command(s).` },
    ...toolSteps
      .filter(s => s.screenshot)
      .map(s => ({
        type: "image" as const,
        data: s.screenshot!.replace(/^data:image\/\w+;base64,/, ""),
        mimeType: "image/png",
      })),
  ];

  gatewayClient.completeClientTool({
    tool_use_id: step.toolUseId,
    session_id: currentSessionId,  // 从 conversation hook context 获取
    result: { content },
  });
}
```

---

## Part 3：前端 — Command 动画系统

### 3.1 新文件：`apps/desktop/src/lib/presentation/command-animator.ts`

```typescript
import type { Editor } from "tldraw";
import type { PresentationCommand } from "./types";
import { executeCommand } from "./command-executor";

const ANIM_DURATION = 150; // ms

export interface AnimationHandle {
  /** 立即完成动画，跳到最终状态 */
  finish: () => void;
  /** 动画完成的 Promise */
  done: Promise<void>;
}

/**
 * 执行单条 command 并播放入场动画
 * 绘制类 command: opacity 0 → 1 (150ms)
 * wait command: 等待 ms
 * clear command: 瞬时清空
 */
export function animateCommand(editor: Editor, cmd: PresentationCommand): AnimationHandle {
  // clear: 瞬时
  if (cmd.type === "clear") {
    const shapes = editor.getCurrentPageShapes();
    if (shapes.length > 0) {
      editor.deleteShapes(shapes.map(s => s.id));
    }
    return { finish: () => {}, done: Promise.resolve() };
  }

  // wait: 延迟
  if (cmd.type === "wait") {
    let timer: ReturnType<typeof setTimeout>;
    let resolvePromise!: () => void;
    const done = new Promise<void>(r => { resolvePromise = r; });
    timer = setTimeout(resolvePromise, cmd.ms);
    return {
      finish: () => { clearTimeout(timer); resolvePromise(); },
      done,
    };
  }

  // 绘制类 command: 创建 shape → 动画 opacity
  const shapeIds = executeCommand(editor, cmd); // 修改 executeCommand 返回创建的 shape ids

  // 设置初始 opacity 为 0
  for (const id of shapeIds) {
    editor.updateShape({ id, type: editor.getShape(id)!.type, opacity: 0 });
  }

  let finished = false;
  let resolvePromise!: () => void;
  const done = new Promise<void>(r => { resolvePromise = r; });

  const startTime = performance.now();
  let rafId: number;

  const tick = () => {
    if (finished) return;
    const elapsed = performance.now() - startTime;
    const progress = Math.min(elapsed / ANIM_DURATION, 1);

    for (const id of shapeIds) {
      const shape = editor.getShape(id);
      if (shape) {
        editor.updateShape({ id, type: shape.type, opacity: progress });
      }
    }

    if (progress < 1) {
      rafId = requestAnimationFrame(tick);
    } else {
      resolvePromise();
    }
  };
  rafId = requestAnimationFrame(tick);

  return {
    finish: () => {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(rafId);
      for (const id of shapeIds) {
        const shape = editor.getShape(id);
        if (shape) {
          editor.updateShape({ id, type: shape.type, opacity: 1 });
        }
      }
      resolvePromise();
    },
    done,
  };
}
```

### 3.2 executeCommand 返回值修改

当前 `command-executor.ts` 中 `executeCommand` 无返回值。需修改为返回创建的 shape id(s)：

```typescript
export function executeCommand(editor: Editor, cmd: PresentationCommand): string[] {
  // 现有逻辑 + return [createdShapeId]
  // 对于 arrow/highlight/circle/text/line，返回 editor.createShape() 的 id
}
```

### 3.3 Canvas Replay（跳转时快速重绘）

```typescript
export function replayToStep(editor: Editor, steps: PresentationStep[], targetIndex: number): void {
  // 清空画布
  const allShapes = editor.getCurrentPageShapes();
  if (allShapes.length > 0) {
    editor.deleteShapes(allShapes.map(s => s.id));
  }

  // 瞬时重绘 0..targetIndex（跳过 wait，处理 clear）
  for (let i = 0; i <= targetIndex; i++) {
    const cmd = steps[i].command;
    if (cmd.type === "wait") continue;
    if (cmd.type === "clear") {
      const shapes = editor.getCurrentPageShapes();
      if (shapes.length > 0) {
        editor.deleteShapes(shapes.map(s => s.id));
      }
      continue;
    }
    executeCommand(editor, cmd);
  }
}
```

---

## Part 4：前端 — PresentationLayer 执行引擎重构

### 4.1 步骤执行循环

使用 `processedIndexRef` 追踪已执行到的步骤 index，避免 `steps` array reference 变化导致 useEffect 循环触发。

```typescript
export function PresentationLayer() {
  const steps = useOverlayStore(s => s.presentationSteps);
  const currentStep = useOverlayStore(s => s.presentationCurrentStep);
  const playerState = useOverlayStore(s => s.presentationPlayerState);
  const presentationActive = useOverlayStore(s => s.presentationActive);
  const actions = useOverlayStore(s => s.actions);
  const editorRef = useRef<Editor | null>(null);
  const currentAnimRef = useRef<AnimationHandle | null>(null);
  /** 追踪已执行完毕的最大 step index，防止重复触发 */
  const processedIndexRef = useRef(-1);
  /** 追踪 steps 数量变化（新 tool_use 到来）作为执行触发条件 */
  const stepsCountRef = useRef(0);

  // 执行引擎：监听 stepsCount 和 playerState 变化
  // 不直接依赖 steps array（避免每次 status 更新触发循环）
  const stepsCount = steps.length;

  useEffect(() => {
    if (!presentationActive || playerState !== "playing" || !editorRef.current) return;

    // 从 store 直接读取最新 steps（避免闭包过期）
    const getSteps = () => useOverlayStore.getState().presentationSteps;

    let cancelled = false;

    const runLoop = async () => {
      while (!cancelled) {
        const currentSteps = getSteps();
        const nextIndex = processedIndexRef.current + 1;

        if (nextIndex >= currentSteps.length) break;  // 没有更多步骤
        const step = currentSteps[nextIndex];
        if (step.status !== "pending") break;  // 已被处理

        // 标记 executing
        actions.updateStepStatus(step.id, "executing");
        actions.playerGoTo(nextIndex);  // 这不会改变 playerState（内部只改 currentStep）

        // 临时隐藏 overlay 进行截图的准备（标记）
        // 播放动画
        const anim = animateCommand(editorRef.current!, step.command);
        currentAnimRef.current = anim;
        await anim.done;
        currentAnimRef.current = null;

        if (cancelled) return;

        // 截图：隐藏 overlay → 截图 → 恢复 overlay
        const overlayEl = document.getElementById("presentation-overlay-root");
        if (overlayEl) overlayEl.style.visibility = "hidden";
        const result = await invoke<ScreenshotResult>("take_screenshot", { hideWindow: false });
        if (overlayEl) overlayEl.style.visibility = "visible";

        if (cancelled) return;

        // 标记完成
        actions.completePresentationStep(step.id, result.data);
        processedIndexRef.current = nextIndex;

        // 检查该 toolUseId 是否全部完成，触发后端回调
        checkAndPostCompletion(getSteps(), step.id);
      }
    };

    runLoop();
    return () => { cancelled = true; };
  }, [stepsCount, playerState, presentationActive]);

  // 暂停时立即完成当前动画
  useEffect(() => {
    if (playerState === "paused" && currentAnimRef.current) {
      currentAnimRef.current.finish();
    }
  }, [playerState]);

  // 跳转时 replay canvas（仅在 paused 状态由用户触发 playerGoTo 时）
  const prevCurrentStepRef = useRef(currentStep);
  useEffect(() => {
    if (playerState === "paused" && editorRef.current && currentStep !== prevCurrentStepRef.current) {
      const currentSteps = useOverlayStore.getState().presentationSteps;
      // 只 replay 到已完成的步骤（不越过 processedIndexRef）
      const safeTarget = Math.min(currentStep, processedIndexRef.current);
      replayToStep(editorRef.current, currentSteps, safeTarget);
    }
    prevCurrentStepRef.current = currentStep;
  }, [currentStep, playerState]);

  // Reset on presentation stop
  useEffect(() => {
    if (!presentationActive) {
      processedIndexRef.current = -1;
      stepsCountRef.current = 0;
    }
  }, [presentationActive]);

  // ... render
}
```

**关键设计**：
- 执行循环使用 `while (!cancelled)` 而非 useEffect 递归，避免 state 变化触发的无限循环
- 通过 `processedIndexRef` 追踪进度，effect 仅由 `stepsCount`（新步骤到来）或 `playerState`（恢复播放）触发
- 从 `useOverlayStore.getState()` 直接读取最新数据，避免闭包过期问题

---

## Part 5：前端 — 播放器 UI 组件

### 5.1 新文件：`apps/desktop/src/components/overlay/layers/presentation-player.tsx`

**位置**：PresentationLayer 内部，与"退出演示"按钮同级，底部居中，离底部 24px。

**布局**：

```
┌───────────────────────────────────────────────────────────┐
│  ⏮  ◀  ▶⏸  ▶  ⏭  │  ━━━━━●━━━━━━━━  │  3/7  │  📋   │
│  回到  后退 播放 前进  回到 │    进度条     │ 步数  │ 详情  │
│  开头       暂停      末尾 │              │       │ 按钮  │
└───────────────────────────────────────────────────────────┘
```

**样式**：与退出按钮一致（半透明黑底 + blur + 白色文字 + 圆角胶囊）。

```typescript
export function PresentationPlayer() {
  const steps = useOverlayStore(s => s.presentationSteps);
  const currentStep = useOverlayStore(s => s.presentationCurrentStep);
  const playerState = useOverlayStore(s => s.presentationPlayerState);
  const detailsOpen = useOverlayStore(s => s.presentationDetailsOpen);
  const actions = useOverlayStore(s => s.actions);
  const total = steps.length;

  if (total === 0) return null;

  return (
    <div style={{
      position: "absolute",
      bottom: 24,
      left: "50%",
      transform: "translateX(-50%)",
      pointerEvents: "auto",
      zIndex: 1,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
    }}>
      {/* 详情面板（在控制条上方） */}
      {detailsOpen && <StepDetailsPanel steps={steps} currentStep={currentStep} />}

      {/* 控制条 */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 16px",
        borderRadius: 24,
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.15)",
        color: "#fff",
        fontSize: 13,
      }}>
        <PlayerButton icon="⏮" onClick={actions.playerGoToStart} title="回到开头" />
        <PlayerButton icon="◀" onClick={actions.playerPrev} title="后退" />
        <PlayerButton
          icon={playerState === "playing" ? "⏸" : "▶"}
          onClick={playerState === "playing" ? actions.playerPause : actions.playerPlay}
          primary
          title={playerState === "playing" ? "暂停" : "播放"}
        />
        <PlayerButton icon="▶" onClick={actions.playerNext} title="前进" />
        <PlayerButton icon="⏭" onClick={actions.playerGoToEnd} title="回到末尾" />

        <Divider />

        <input
          type="range"
          min={0}
          max={Math.max(total - 1, 0)}
          value={currentStep}
          onChange={e => actions.playerGoTo(Number(e.target.value))}
          style={{ width: 160, accentColor: "#fff" }}
        />

        <span style={{ fontVariantNumeric: "tabular-nums", minWidth: 44, textAlign: "center" }}>
          {currentStep + 1}/{total}
        </span>

        <Divider />

        <PlayerButton
          icon="📋"
          onClick={actions.togglePresentationDetails}
          active={detailsOpen}
          title="步骤详情"
        />
      </div>
    </div>
  );
}
```

### 5.2 步骤详情面板

展开在控制条上方，最大高度 360px 可滚动，宽度 420px。

同一 tool_use 的 commands 视觉分组（首条显示 tool_use 标题，后续缩进）：

```typescript
function StepDetailsPanel({ steps, currentStep }) {
  // 按 toolUseId 分组展示
  let lastToolUseId = "";

  return (
    <div style={{ /* 容器样式 */ }}>
      {steps.map((step, i) => {
        const showGroupHeader = step.toolUseId !== lastToolUseId;
        lastToolUseId = step.toolUseId;
        return (
          <Fragment key={step.id}>
            {showGroupHeader && (
              <div style={{ /* 分组标题样式 */ }}>
                {step.toolName.replace("presentation_", "")}
              </div>
            )}
            <StepCard step={step} index={i} isCurrent={i === currentStep} />
          </Fragment>
        );
      })}
    </div>
  );
}
```

### 5.3 步骤卡片

```typescript
function StepCard({ step, index, isCurrent, onClick }) {
  return (
    <div onClick={onClick} style={{
      display: "flex", gap: 10, padding: 8, borderRadius: 10, cursor: "pointer",
      background: isCurrent ? "rgba(255,255,255,0.12)" : "transparent",
      border: isCurrent ? "1px solid rgba(255,255,255,0.3)" : "1px solid transparent",
    }}>
      {/* 截图缩略图 (80×50) */}
      <div style={{ width: 80, height: 50, borderRadius: 6, overflow: "hidden", flexShrink: 0 }}>
        {step.screenshot
          ? <img src={step.screenshot} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <div style={{ background: "rgba(255,255,255,0.05)", width: "100%", height: "100%" }} />
        }
      </div>

      {/* 信息 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: "#fff", fontSize: 12, fontWeight: 600 }}>
          {index + 1}. {step.description}
        </div>
        <pre style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {JSON.stringify(step.command, null, 0)}
        </pre>
      </div>

      {/* 状态 */}
      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
        {step.status === "executing" ? "⏳" : step.status === "done" ? "✓" : "·"}
      </span>
    </div>
  );
}
```

### 5.4 PresentationLayer 最终 JSX

```tsx
return (
  <div style={{ position: "fixed", inset: 0, zIndex: DOMZIndex.PresentationLayer, pointerEvents: "auto" }}>
    {/* 半透明背景 */}
    <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.15)" }} />

    {/* tldraw canvas */}
    <div className="presentation-tldraw-container" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <Tldraw hideUi onMount={handleMount} options={{ maxPages: 1 }} />
    </div>

    {/* 退出按钮（右上） */}
    <button onClick={handleExit} style={{ /* 不变 */ }}>
      <span>✕</span> 退出演示
    </button>

    {/* 播放器控制条（底部居中） */}
    <PresentationPlayer />
  </div>
);
```

---

## Part 6：Gateway Client 扩展

`apps/desktop/src/lib/gateway/client.ts` 新增方法：

```typescript
import type { ClientToolCompletePayload } from "@/lib/presentation/types";

async completeClientTool(params: ClientToolCompletePayload): Promise<{ success: boolean }> {
  const url = `${getGatewayUrl()}/api/client-tools/complete`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return res.json();
}
```

---

## 影响范围

| 层 | 文件 | 变更类型 |
|----|------|----------|
| Core | `services/client-tool-completion.ts` | 新建 |
| Core | `gateway/routes/client-tools.ts` | 新建 |
| Core | `executors/chat/sdk-mcp-registry.ts` | 修改（factory context + clientSideTools 注册） |
| Core | `executors/chat/sdk-mcp-servers/presentation.ts` | 重写（handler await） |
| Core | `executors/chat/sdk-proxy.ts` | 修改（传 sessionId context） |
| Core | `gateway/routes/agent-run.ts` | 修改（enqueue 逻辑） |
| Core | `gateway/routes/agent-ws.ts` | 修改（同上） |
| Core | `services/agent.ts` | 修改（abort 时 cancelSession） |
| Desktop | `stores/overlay-store.ts` | 重写 Presentation 部分 |
| Desktop | `lib/presentation/types.ts` | 新增 PresentationStep, PlayerState |
| Desktop | `lib/presentation/command-animator.ts` | 新建 |
| Desktop | `lib/presentation/command-executor.ts` | 修改（返回 shape ids） |
| Desktop | `components/overlay/layers/presentation-layer.tsx` | 重写执行引擎 |
| Desktop | `components/overlay/layers/presentation-player.tsx` | 新建 |
| Desktop | `pages/conversation/hooks/use-agent-conversation.ts` | 修改（拦截逻辑） |
| Desktop | `lib/gateway/client.ts` | 新增 completeClientTool |

---

## 边界情况

| 场景 | 处理 |
|------|------|
| 前端未响应（超时） | 按 clientSideTools 配置超时后 resolve fallback，agent 继续。全局安全网 10 分钟兜底 |
| 前端崩溃/刷新 | 全局安全网超时触发 resolve fallback；GC 定时器周期清理 orphan entries |
| Session 被取消（用户 stop） | `stopSession()` 同时调用 `cancelSession()` → reject → handler 抛异常 → SDK abort 捕获 → stream 解除阻塞 |
| 多个 tool_use 同一 turn | 队列按顺序处理。Node.js 单线程模型保证 `queue.shift()` 不会真正并发 |
| 用户点"退出演示"时有未完成 steps | stopPresentation → 将所有 pending steps 标记为 done（无截图）→ 对每个未完成 toolUseId POST 回调（isError: true） |
| 暂停中收到新 tool_use | 新 steps 加入队列但不执行，直到用户点播放 |
| 进度条拖动到未执行的 step（无截图） | 详情面板显示空缩略图，canvas replay 到最后一个 done step（`Math.min(target, processedIndexRef)`）|
| Gateway 重启 | 所有 pending entries 丢失（singleton 无状态）。SDK handler 因超时 resolve fallback |

---

## 设计决策记录

### D1: 截图策略 — 截底层 UI，不包括 overlay

截图时临时隐藏整个 presentation overlay（`visibility: hidden`），截取纯净的底层 UI 状态，截完后恢复。这确保 LLM 看到的截图是"被演示的 UI"本身，而非被 overlay 遮挡的样子。

实现：给 overlay root div 添加 `id="presentation-overlay-root"`，截图前设置 `style.visibility = "hidden"`，截图后恢复 `"visible"`。

### D2: 前端工具名判断 — `isClientSidePresentationTool`

```typescript
// apps/desktop/src/lib/presentation/index.ts
const PRESENTATION_CLIENT_SIDE_TOOLS = new Set([
  "presentation_draw",
  "presentation_spotlight",
  "presentation_callout",
  "presentation_walkthrough",
  "presentation_compare",
]);

export function isClientSidePresentationTool(toolName: string): boolean {
  const bare = toolName.replace(/^mcp__\w+__/, "");
  return PRESENTATION_CLIENT_SIDE_TOOLS.has(bare);
}
```

处理 `mcp__presentation__presentation_draw` 和 `presentation_draw` 两种形式。

### D3: `playerGoTo` 与 `playerPlay` 的区别

- `playerGoTo(n)`: 设置 `currentStep = n`, `playerState = "paused"`, 触发 canvas replay
- 内部执行推进（runLoop 中）: 直接修改 `currentStep`，**不**改 `playerState`（保持 playing）

Store action `playerGoTo` 只在用户手动跳转时调用，执行引擎内部直接操作 store。

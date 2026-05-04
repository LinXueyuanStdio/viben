# Presentation Player + Client-Side Tool Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Presentation Mode 添加播放器进度条 UI 和通用端侧工具完成机制，使 MCP tool handler 等待前端执行完毕并收集截图后才返回结果。

**Architecture:** 后端新增 `ClientToolCompletionRegistry` 单例管理 tool_use → Promise 映射；Gateway stream loop 检测端侧工具并 enqueue；MCP handler await `waitForClient()`；前端逐步执行 command 动画 + 截图，完成后 POST 回调 resolve handler。前端新增 PresentationPlayer UI 组件，提供播放/暂停/跳转/详情面板。

**Tech Stack:** TypeScript, Fastify, @modelcontextprotocol/sdk, Zustand, tldraw, Tauri (take_screenshot)

**Spec:** `docs/superpowers/specs/2026-05-05-presentation-player-design.md`

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `packages/core/src/services/client-tool-completion.ts` | 通用端侧工具完成注册表（Registry singleton） |
| Create | `packages/core/src/services/client-tool-completion.test.ts` | Registry 单元测试 |
| Create | `packages/core/src/gateway/routes/client-tools.ts` | `/api/client-tools/complete` 端点 |
| Create | `packages/core/src/gateway/routes/client-tools.test.ts` | 端点单元测试 |
| Modify | `packages/core/src/executors/chat/sdk-mcp-registry.ts` | 扩展 factory 签名 + clientSideTools 注册 |
| Modify | `packages/core/src/executors/chat/sdk-mcp-servers/presentation.ts` | handler 改为 await waitForClient |
| Modify | `packages/core/src/executors/chat/sdk-proxy.ts:622-631` | resolveSdkMcpServers 传 sessionId context |
| Modify | `packages/core/src/gateway/routes/agent-run.ts:693` | stream loop 中 enqueue 端侧工具 |
| Modify | `packages/core/src/gateway/routes/agent-ws.ts` | 同上（WebSocket 路由） |
| Modify | `packages/core/src/gateway/routes/index.ts` | 注册 client-tools 路由 |
| Modify | `packages/core/src/services/agent.ts:113-120` | stopSession 中调用 cancelSession |
| Create | `apps/desktop/src/lib/client-side-tool/types.ts` | PresentationStep, PlayerState, ClientToolResultContent |
| Create | `apps/desktop/src/lib/presentation/command-animator.ts` | AnimationHandle + animateCommand + replayToStep |
| Modify | `apps/desktop/src/lib/presentation/command-executor.ts` | executeCommand 返回 string[] (shape ids) |
| Modify | `apps/desktop/src/stores/overlay-store.ts` | 重写 Presentation state/actions |
| Modify | `apps/desktop/src/components/overlay/layers/presentation-layer.tsx` | 重写执行引擎 |
| Create | `apps/desktop/src/components/overlay/layers/presentation-player.tsx` | 播放器 UI 组件 |
| Modify | `apps/desktop/src/pages/conversation/hooks/use-agent-conversation.ts` | 拦截逻辑重构 |
| Modify | `apps/desktop/src/lib/gateway/client.ts` | 新增 completeClientTool 方法 |

---

## Task 1: ClientToolCompletionRegistry (后端核心)

**Files:**
- Create: `packages/core/src/services/client-tool-completion.ts`
- Create: `packages/core/src/services/client-tool-completion.test.ts`

- [ ] **Step 1: Write failing tests for registry basics**

```typescript
// packages/core/src/services/client-tool-completion.test.ts
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { ClientToolCompletionRegistry, ClientToolCancelledError } from "./client-tool-completion";
import type { ClientSideToolOptions } from "./client-tool-completion";

describe("ClientToolCompletionRegistry", () => {
  let registry: ClientToolCompletionRegistry;

  beforeEach(() => {
    vi.useFakeTimers();
    registry = new ClientToolCompletionRegistry();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("registerToolOptions / isClientSideTool", () => {
    it("registers and recognizes a tool by bare name", () => {
      registry.registerToolOptions("presentation_draw", { timeoutMs: 30000 });
      expect(registry.isClientSideTool("presentation_draw")).toBe(true);
    });

    it("recognizes tool with mcp__ prefix", () => {
      registry.registerToolOptions("presentation_draw", { timeoutMs: 30000 });
      expect(registry.isClientSideTool("mcp__presentation__presentation_draw")).toBe(true);
    });

    it("returns false for unregistered tool", () => {
      expect(registry.isClientSideTool("unknown_tool")).toBe(false);
    });
  });

  describe("enqueue / waitForClient / complete", () => {
    beforeEach(() => {
      registry.registerToolOptions("presentation_draw", { timeoutMs: 5000 });
    });

    it("resolves when complete is called with matching sessionId", async () => {
      registry.enqueue("session-1", "tool-use-1", "presentation_draw");
      const promise = registry.waitForClient("session-1");

      const result = { content: [{ type: "text" as const, text: "done" }] };
      const ok = registry.complete("tool-use-1", "session-1", result);

      expect(ok).toBe(true);
      await expect(promise).resolves.toEqual(result);
    });

    it("rejects complete with wrong sessionId", async () => {
      registry.enqueue("session-1", "tool-use-1", "presentation_draw");
      registry.waitForClient("session-1");

      const result = { content: [{ type: "text" as const, text: "done" }] };
      const ok = registry.complete("tool-use-1", "wrong-session", result);
      expect(ok).toBe(false);
    });

    it("returns error when no queue exists", async () => {
      const result = await registry.waitForClient("nonexistent");
      expect(result.isError).toBe(true);
    });

    it("times out and resolves with fallback", async () => {
      registry.enqueue("session-1", "tool-use-1", "presentation_draw");
      const promise = registry.waitForClient("session-1");

      vi.advanceTimersByTime(5001);

      const result = await promise;
      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain("timed out");
    });
  });

  describe("cancelSession", () => {
    it("rejects pending promises with ClientToolCancelledError", async () => {
      registry.registerToolOptions("presentation_draw", { timeoutMs: 30000 });
      registry.enqueue("session-1", "tool-use-1", "presentation_draw");
      const promise = registry.waitForClient("session-1");

      registry.cancelSession("session-1");

      await expect(promise).rejects.toThrow(ClientToolCancelledError);
    });
  });

  describe("gc", () => {
    it("removes entries older than maxAge", () => {
      registry.registerToolOptions("presentation_draw", { timeoutMs: 0 });
      registry.enqueue("session-1", "tool-use-1", "presentation_draw");

      // Advance past 2x GLOBAL_MAX_TIMEOUT_MS (20 min)
      vi.advanceTimersByTime(21 * 60 * 1000);
      registry.gc();

      // Entry should be gone - complete returns false
      const ok = registry.complete("tool-use-1", "session-1", { content: [] });
      expect(ok).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/core && npx vitest run src/services/client-tool-completion.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement ClientToolCompletionRegistry**

```typescript
// packages/core/src/services/client-tool-completion.ts
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { logger as globalLogger } from "../telemetry";

const log = globalLogger.child({ module: "client-tool-completion" });

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
 */
const GLOBAL_MAX_TIMEOUT_MS = 10 * 60 * 1000;

export interface ClientSideToolOptions {
  /**
   * 超时时间（毫秒）
   * 0 = 使用全局安全网超时
   * 正整数 = 使用该值（受 GLOBAL_MAX_TIMEOUT_MS 上限约束）
   */
  timeoutMs?: number;
  /** 超时时的 fallback 结果生成器 */
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

export class ClientToolCancelledError extends Error {
  constructor(public sessionId: string, public toolUseId: string) {
    super(`Session ${sessionId} cancelled while waiting for client tool ${toolUseId}`);
    this.name = "ClientToolCancelledError";
  }
}

// ============================================================================
// Registry
// ============================================================================

export class ClientToolCompletionRegistry {
  private toolOptions = new Map<string, ClientSideToolOptions>();
  private sessionQueues = new Map<string, string[]>();
  private pending = new Map<string, PendingEntry>();

  // ---- Tool registration ----

  registerToolOptions(toolName: string, options: ClientSideToolOptions): void {
    this.toolOptions.set(toolName, options);
  }

  isClientSideTool(toolName: string): boolean {
    const bare = toolName.replace(/^mcp__\w+__/, "");
    return this.toolOptions.has(bare);
  }

  // ---- Gateway stream loop ----

  enqueue(sessionId: string, toolUseId: string, toolName: string): void {
    const bare = toolName.replace(/^mcp__\w+__/, "");
    if (!this.sessionQueues.has(sessionId)) {
      this.sessionQueues.set(sessionId, []);
    }
    this.sessionQueues.get(sessionId)!.push(toolUseId);
    this.pending.set(toolUseId, {
      resolve: () => {},
      reject: () => {},
      sessionId,
      toolName: bare,
      toolUseId,
      createdAt: Date.now(),
    });
    log.debug({ sessionId, toolUseId, toolName: bare }, "Enqueued client tool");
  }

  // ---- MCP handler ----

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

  // ---- Frontend callback ----

  complete(toolUseId: string, sessionId: string, result: CallToolResult): boolean {
    const entry = this.pending.get(toolUseId);
    if (!entry) return false;
    if (entry.sessionId !== sessionId) return false;
    if (entry.timeout) clearTimeout(entry.timeout);
    this.pending.delete(toolUseId);
    entry.resolve(result);
    return true;
  }

  // ---- Session lifecycle ----

  cancelSession(sessionId: string): void {
    for (const [toolUseId, entry] of this.pending) {
      if (entry.sessionId !== sessionId) continue;
      if (entry.timeout) clearTimeout(entry.timeout);
      this.pending.delete(toolUseId);
      entry.reject(new ClientToolCancelledError(sessionId, toolUseId));
    }
    this.sessionQueues.delete(sessionId);
  }

  // ---- GC ----

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

// ---- Singleton ----

export const clientToolCompletionRegistry = new ClientToolCompletionRegistry();

export type { TimeoutContext };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/core && npx vitest run src/services/client-tool-completion.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/services/client-tool-completion.ts packages/core/src/services/client-tool-completion.test.ts
git commit -m "feat(core): add ClientToolCompletionRegistry for client-side tool completion"
```

---

## Task 2: Gateway `/api/client-tools/complete` 端点

**Files:**
- Create: `packages/core/src/gateway/routes/client-tools.ts`
- Create: `packages/core/src/gateway/routes/client-tools.test.ts`
- Modify: `packages/core/src/gateway/routes/index.ts`

- [ ] **Step 1: Write failing test for the endpoint**

```typescript
// packages/core/src/gateway/routes/client-tools.test.ts
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { registerClientToolRoutes } from "./client-tools";
import { clientToolCompletionRegistry } from "../../services/client-tool-completion";

describe("POST /api/client-tools/complete", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    registerClientToolRoutes(app);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns 404 when no pending entry", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/client-tools/complete",
      payload: {
        tool_use_id: "nonexistent",
        session_id: "session-1",
        result: { content: [{ type: "text", text: "done" }] },
      },
    });
    expect(res.statusCode).toBe(404);
  });

  it("completes a pending entry successfully", async () => {
    clientToolCompletionRegistry.registerToolOptions("presentation_draw", { timeoutMs: 30000 });
    clientToolCompletionRegistry.enqueue("session-1", "tool-use-abc", "presentation_draw");

    // Start waiting (don't await yet)
    const waitPromise = clientToolCompletionRegistry.waitForClient("session-1");

    const res = await app.inject({
      method: "POST",
      url: "/api/client-tools/complete",
      payload: {
        tool_use_id: "tool-use-abc",
        session_id: "session-1",
        result: { content: [{ type: "text", text: "completed" }] },
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);

    const result = await waitPromise;
    expect((result.content[0] as { text: string }).text).toBe("completed");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && npx vitest run src/gateway/routes/client-tools.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement the route**

```typescript
// packages/core/src/gateway/routes/client-tools.ts
import type { FastifyInstance } from "fastify";
import { clientToolCompletionRegistry } from "../../services/client-tool-completion";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

interface CompleteBody {
  tool_use_id: string;
  session_id: string;
  result: CallToolResult;
}

export function registerClientToolRoutes(fastify: FastifyInstance): void {
  fastify.post<{ Body: CompleteBody }>("/api/client-tools/complete", async (request, reply) => {
    const { tool_use_id, session_id, result } = request.body;

    if (!tool_use_id || !session_id || !result) {
      return reply.status(400).send({ success: false, error: "Missing required fields: tool_use_id, session_id, result" });
    }

    const success = clientToolCompletionRegistry.complete(tool_use_id, session_id, result);
    if (!success) {
      return reply.status(404).send({ success: false, error: "No pending tool call found or session mismatch" });
    }
    return reply.send({ success: true });
  });
}
```

- [ ] **Step 4: Register route in index.ts**

In `packages/core/src/gateway/routes/index.ts`, add:

```typescript
// Import (add near other route imports at top):
import { registerClientToolRoutes } from "./client-tools";

// Register (add inside registerRoutes function, after registerAgentWsRoutes):
registerClientToolRoutes(fastify);

// Re-export (add to re-exports section):
export { registerClientToolRoutes } from "./client-tools";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/core && npx vitest run src/gateway/routes/client-tools.test.ts`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/gateway/routes/client-tools.ts packages/core/src/gateway/routes/client-tools.test.ts packages/core/src/gateway/routes/index.ts
git commit -m "feat(core): add /api/client-tools/complete endpoint"
```

---

## Task 3: SDK MCP Registry 扩展 + Presentation Server 改造

**Files:**
- Modify: `packages/core/src/executors/chat/sdk-mcp-registry.ts`
- Modify: `packages/core/src/executors/chat/sdk-mcp-servers/presentation.ts`
- Modify: `packages/core/src/executors/chat/sdk-proxy.ts`

- [ ] **Step 1: Extend McpServerFactory type signature**

In `packages/core/src/executors/chat/sdk-mcp-registry.ts`, change the factory type and `resolveSdkMcpServers` to accept context:

```typescript
// Change line 15:
export type McpServerFactory = (sdk: typeof ClaudeAgentSdk, context?: { sessionId?: string }) => ReturnType<typeof ClaudeAgentSdk.createSdkMcpServer>;

// Change resolveSdkMcpServers (line 41-53) to accept context:
export function resolveSdkMcpServers(
  sdk: typeof ClaudeAgentSdk,
  names: string[],
  context?: { sessionId?: string }
): Record<string, ReturnType<typeof ClaudeAgentSdk.createSdkMcpServer>> {
  const result: Record<string, ReturnType<typeof ClaudeAgentSdk.createSdkMcpServer>> = {};
  for (const name of names) {
    const factory = getRegistry().get(name);
    if (factory) {
      result[name] = factory(sdk, context);
    }
  }
  return result;
}
```

- [ ] **Step 2: Update sdk-proxy.ts to pass sessionId context**

In `packages/core/src/executors/chat/sdk-proxy.ts`, find both calls to `resolveSdkMcpServers` and add `{ sessionId }`:

```typescript
// Line ~303 (execute method):
const resolvedServers = resolveSdkMcpServers(sdk, mcpServers, { sessionId });

// Line ~625 (executeStreaming method):
const resolvedServers = resolveSdkMcpServers(sdk, mcpServers, { sessionId });
```

Note: `sessionId` is already available in `executeStreaming` as `this.sessionId` or the `sessionId` param from options.

- [ ] **Step 3: Rewrite presentation.ts handlers to await waitForClient**

```typescript
// packages/core/src/executors/chat/sdk-mcp-servers/presentation.ts
import { registerSdkMcpServer } from "../sdk-mcp-registry";
import { clientToolCompletionRegistry } from "../../../services/client-tool-completion";

registerSdkMcpServer("presentation", (sdk, context) => {
  const { createSdkMcpServer, tool } = sdk;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const z = require("zod");
  type CallToolResult = import("@modelcontextprotocol/sdk/types.js").CallToolResult;
  const sessionId = context?.sessionId!;

  function ok(message: string): CallToolResult {
    return { content: [{ type: "text" as const, text: message }] };
  }
  function error(message: string): CallToolResult {
    return { content: [{ type: "text" as const, text: message }], isError: true };
  }

  // ... (all schema definitions remain unchanged) ...

  return createSdkMcpServer({
    name: "presentation",
    version: "2.0.0",
    tools: [
      tool(
        "presentation_draw",
        "低层绘制接口。在用户屏幕上绘制箭头、高亮框、圆圈、文字和线条...",
        { commands: z.array(/* ... same schema ... */) },
        async (args) => {
          const commands = args.commands;
          if (!commands || !Array.isArray(commands) || commands.length === 0) {
            return error("Error: commands array is empty");
          }
          return await clientToolCompletionRegistry.waitForClient(sessionId);
        }
      ),
      tool("presentation_spotlight", "...", spotlightToolSchema.shape, async (rawArgs) => {
        const args = rawArgs as { title?: string; description?: string };
        if (!args.title && !args.description) {
          return error("Error: provide title or description");
        }
        return await clientToolCompletionRegistry.waitForClient(sessionId);
      }),
      tool("presentation_callout", "...", calloutToolSchema.shape, async (rawArgs) => {
        const args = rawArgs as { label: string };
        if (!args.label.trim()) return error("Error: label must not be empty.");
        return await clientToolCompletionRegistry.waitForClient(sessionId);
      }),
      tool("presentation_walkthrough", "...", walkthroughToolSchema.shape, async (rawArgs) => {
        const args = rawArgs as { steps: unknown[] };
        if (!args.steps.length) return error("Error: steps array is empty.");
        return await clientToolCompletionRegistry.waitForClient(sessionId);
      }),
      tool("presentation_compare", "...", compareToolSchema.shape, async (rawArgs) => {
        const args = rawArgs as { left: { label: string }; right: { label: string } };
        if (!args.left.label.trim() || !args.right.label.trim()) {
          return error("Error: both comparison labels must be non-empty.");
        }
        return await clientToolCompletionRegistry.waitForClient(sessionId);
      }),
      // clear and stop are NOT client-side tools - return immediately
      tool("presentation_clear", "清空演示画布上的所有标注。", {}, async () => ok("Presentation canvas cleared.")),
      tool("presentation_stop", "退出演示模式，清空画布并隐藏 overlay。", {}, async () => ok("Presentation mode stopped.")),
    ],
    clientSideTools: {
      presentation_draw:        { timeoutMs: 30_000 },
      presentation_spotlight:   { timeoutMs: 30_000 },
      presentation_callout:     { timeoutMs: 30_000 },
      presentation_compare:     { timeoutMs: 30_000 },
      presentation_walkthrough: { timeoutMs: 0 },
    },
  });
});
```

- [ ] **Step 4: Handle clientSideTools registration in createSdkMcpServer**

If `createSdkMcpServer` is a wrapper in our codebase, add clientSideTools auto-registration. If it delegates directly to SDK, add post-creation registration:

```typescript
// In sdk-mcp-registry.ts, wrap factory to auto-register clientSideTools:
// After the server is created, if config has clientSideTools, register them.
// This can be done by checking a convention in the factory return value,
// or by having the presentation.ts call registerToolOptions directly.

// Simplest approach: presentation.ts registers directly after the createSdkMcpServer call:
// Add at the start of the factory function body:
const clientSideToolsConfig: Record<string, import("../../../services/client-tool-completion").ClientSideToolOptions> = {
  presentation_draw:        { timeoutMs: 30_000 },
  presentation_spotlight:   { timeoutMs: 30_000 },
  presentation_callout:     { timeoutMs: 30_000 },
  presentation_compare:     { timeoutMs: 30_000 },
  presentation_walkthrough: { timeoutMs: 0 },
};
for (const [toolName, options] of Object.entries(clientSideToolsConfig)) {
  clientToolCompletionRegistry.registerToolOptions(toolName, options);
}
```

- [ ] **Step 5: Verify typecheck passes**

Run: `cd packages/core && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/executors/chat/sdk-mcp-registry.ts packages/core/src/executors/chat/sdk-mcp-servers/presentation.ts packages/core/src/executors/chat/sdk-proxy.ts
git commit -m "feat(core): presentation MCP handlers await client-side tool completion"
```

---

## Task 4: Gateway Stream Loop Enqueue + Session Abort Integration

**Files:**
- Modify: `packages/core/src/gateway/routes/agent-run.ts`
- Modify: `packages/core/src/gateway/routes/agent-ws.ts`
- Modify: `packages/core/src/services/agent.ts`

- [ ] **Step 1: Add enqueue logic in agent-run.ts stream loop**

In `packages/core/src/gateway/routes/agent-run.ts`, after the existing `tool_use` handling (around line 721-749), add client-side tool detection:

```typescript
// Add import at top:
import { clientToolCompletionRegistry } from "../../services/client-tool-completion";

// Inside the stream loop, in the `else if (message.type === "tool_use")` block,
// BEFORE sendSSE(reply, message), add:
        } else if (message.type === "tool_use") {
          toolUseCount++;
          const toolMsg = message as SSEToolUseMessage;
          toolNames.push(toolMsg.name);

          // ★ Client-side tool detection: enqueue BEFORE sendSSE
          if (clientToolCompletionRegistry.isClientSideTool(toolMsg.name)) {
            clientToolCompletionRegistry.enqueue(sessionId, toolMsg.id, toolMsg.name);
            log.info("stream", "client_side_tool_enqueued", {
              toolId: toolMsg.id,
              toolName: toolMsg.name,
            });
          }

          // ... existing span creation code ...
```

- [ ] **Step 2: Add enqueue logic in agent-ws.ts**

Apply the same pattern in `packages/core/src/gateway/routes/agent-ws.ts` for the WebSocket streaming path. Find the tool_use message handling and add:

```typescript
import { clientToolCompletionRegistry } from "../../services/client-tool-completion";

// In the stream loop where tool_use is detected:
if (clientToolCompletionRegistry.isClientSideTool(toolMsg.name)) {
  clientToolCompletionRegistry.enqueue(sessionId, toolMsg.id, toolMsg.name);
}
```

- [ ] **Step 3: Integrate cancelSession into agentService.stopSession**

In `packages/core/src/services/agent.ts`, modify `stopSession`:

```typescript
// Add import at top:
import { clientToolCompletionRegistry } from "./client-tool-completion";

// In stopSession method (line ~113):
stopSession(sessionId: string): boolean {
  const controller = this.abortControllers.get(sessionId);
  if (!controller) return false;

  // Cancel any pending client-side tool promises FIRST
  // This unblocks handlers waiting in waitForClient()
  clientToolCompletionRegistry.cancelSession(sessionId);

  controller.abort();
  log.info({ sessionId }, "Stopped session");
  return true;
}
```

- [ ] **Step 4: Add GC timer startup**

In `packages/core/src/services/client-tool-completion.ts`, add at the bottom (after singleton export):

```typescript
// Periodic GC for orphan entries (every 5 minutes)
setInterval(() => clientToolCompletionRegistry.gc(), 5 * 60 * 1000);
```

- [ ] **Step 5: Verify typecheck passes**

Run: `cd packages/core && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/gateway/routes/agent-run.ts packages/core/src/gateway/routes/agent-ws.ts packages/core/src/services/agent.ts packages/core/src/services/client-tool-completion.ts
git commit -m "feat(core): enqueue client-side tools in stream loop, cancel on session stop"
```

---

## Task 5: Frontend Types + Command Executor Refactor

**Files:**
- Create: `apps/desktop/src/lib/client-side-tool/types.ts`
- Modify: `apps/desktop/src/lib/presentation/command-executor.ts`

- [ ] **Step 1: Create client-side-tool types**

```typescript
// apps/desktop/src/lib/client-side-tool/types.ts

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

- [ ] **Step 2: Add PresentationStep and PlayerState types**

In the same file, add:

```typescript
import type { PresentationCommand } from "../presentation/types";

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

/** 为 PresentationCommand 生成人可读描述 */
export function describeCommand(cmd: PresentationCommand): string {
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

- [ ] **Step 3: Refactor executeCommand to return shape ids**

In `apps/desktop/src/lib/presentation/command-executor.ts`:

```typescript
// Change function signature:
function executeCommand(editor: Editor, cmd: PresentationCommand): string[] {
  switch (cmd.type) {
    case "arrow": {
      const id = createShapeId()
      editor.createShape({ /* ...same... */ })
      // Remove animate logic (moved to animator)
      return [id.toString()]
    }

    case "highlight": {
      const id = createShapeId()
      editor.createShape({ /* ...same... */ })
      return [id.toString()]
    }

    case "circle": {
      const id = createShapeId()
      editor.createShape({ /* ...same... */ })
      return [id.toString()]
    }

    case "text": {
      const id = createShapeId()
      editor.createShape({ /* ...same... */ })
      return [id.toString()]
    }

    case "line": {
      if (cmd.points.length < 2) return []
      const id = createShapeId()
      const origin = cmd.points[0]

      if (cmd.points.length === 2) {
        editor.createShape({ id, /* ...same... */ })
        return [id.toString()]
      } else {
        const segIds: string[] = []
        editor.run(() => {
          for (let i = 0; i < cmd.points.length - 1; i++) {
            const segId = createShapeId()
            editor.createShape({ id: segId, /* ...same... */ })
            segIds.push(segId.toString())
          }
        })
        return segIds
      }
    }

    case "clear": {
      const allShapes = editor.getCurrentPageShapes()
      if (allShapes.length > 0) {
        editor.deleteShapes(allShapes.map((s) => s.id))
      }
      return []
    }

    case "wait":
      return []
  }
}
```

Key changes:
1. Return `string[]` of created shape IDs
2. Remove all `cmd.animate` handling (moved to command-animator)
3. `clear` and `wait` return empty array

- [ ] **Step 4: Remove executeQueue function**

Delete the `executeQueue` function from `command-executor.ts` — it's replaced by the new animation system. Keep only `executeCommand`.

- [ ] **Step 5: Verify desktop typecheck**

Run: `cd apps/desktop && npx tsc --noEmit`
Expected: May have errors in files that import from overlay-store (will fix in Task 6)

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/lib/client-side-tool/types.ts apps/desktop/src/lib/presentation/command-executor.ts
git commit -m "feat(desktop): add client-side-tool types, refactor executeCommand to return shape ids"
```

---

## Task 6: Command Animator

**Files:**
- Create: `apps/desktop/src/lib/presentation/command-animator.ts`

- [ ] **Step 1: Create command-animator.ts**

```typescript
// apps/desktop/src/lib/presentation/command-animator.ts
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
  // clear: instant
  if (cmd.type === "clear") {
    const shapes = editor.getCurrentPageShapes();
    if (shapes.length > 0) {
      editor.deleteShapes(shapes.map((s) => s.id));
    }
    return { finish: () => {}, done: Promise.resolve() };
  }

  // wait: delay
  if (cmd.type === "wait") {
    let timer: ReturnType<typeof setTimeout>;
    let resolvePromise!: () => void;
    const done = new Promise<void>((r) => { resolvePromise = r; });
    timer = setTimeout(resolvePromise, cmd.ms);
    return {
      finish: () => { clearTimeout(timer); resolvePromise(); },
      done,
    };
  }

  // Drawing commands: create shape → animate opacity 0→1
  const shapeIds = executeCommand(editor, cmd);

  if (shapeIds.length === 0) {
    return { finish: () => {}, done: Promise.resolve() };
  }

  // Set initial opacity to 0
  for (const id of shapeIds) {
    const shape = editor.getShape(id as any);
    if (shape) {
      editor.updateShape({ id: id as any, type: shape.type, opacity: 0 });
    }
  }

  let finished = false;
  let resolvePromise!: () => void;
  const done = new Promise<void>((r) => { resolvePromise = r; });

  const startTime = performance.now();
  let rafId: number;

  const tick = () => {
    if (finished) return;
    const elapsed = performance.now() - startTime;
    const progress = Math.min(elapsed / ANIM_DURATION, 1);

    for (const id of shapeIds) {
      const shape = editor.getShape(id as any);
      if (shape) {
        editor.updateShape({ id: id as any, type: shape.type, opacity: progress });
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
        const shape = editor.getShape(id as any);
        if (shape) {
          editor.updateShape({ id: id as any, type: shape.type, opacity: 1 });
        }
      }
      resolvePromise();
    },
    done,
  };
}

/**
 * Canvas replay: 清空画布，瞬时重绘 0..targetIndex 的所有绘制类命令
 * 用于 paused 状态下用户跳转到某步时快速重建画布状态
 */
export function replayToStep(
  editor: Editor,
  steps: Array<{ command: PresentationCommand }>,
  targetIndex: number
): void {
  // Clear canvas
  const allShapes = editor.getCurrentPageShapes();
  if (allShapes.length > 0) {
    editor.deleteShapes(allShapes.map((s) => s.id));
  }

  // Replay commands 0..targetIndex (skip wait, handle clear)
  for (let i = 0; i <= targetIndex; i++) {
    const cmd = steps[i].command;
    if (cmd.type === "wait") continue;
    if (cmd.type === "clear") {
      const shapes = editor.getCurrentPageShapes();
      if (shapes.length > 0) {
        editor.deleteShapes(shapes.map((s) => s.id));
      }
      continue;
    }
    executeCommand(editor, cmd);
  }
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd apps/desktop && npx tsc --noEmit`
Expected: Pass (or only errors from overlay-store not yet updated)

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/lib/presentation/command-animator.ts
git commit -m "feat(desktop): add command-animator with AnimationHandle and replayToStep"
```

---

## Task 7: Overlay Store 重构 (Presentation 部分)

**Files:**
- Modify: `apps/desktop/src/stores/overlay-store.ts`

- [ ] **Step 1: Update imports**

```typescript
// Replace the import:
// OLD: import type { PresentationCommand } from "@/lib/presentation/types";
// NEW:
import type { PresentationCommand } from "@/lib/presentation/types";
import type { PresentationStep, PlayerState } from "@/lib/client-side-tool/types";
import { describeCommand } from "@/lib/client-side-tool/types";
```

- [ ] **Step 2: Replace Presentation state fields**

In `OverlayState` interface, replace:

```typescript
// OLD:
  presentationActive: boolean;
  presentationCommands: PresentationCommand[];

// NEW:
  presentationActive: boolean;
  presentationSteps: PresentationStep[];
  presentationCurrentStep: number;
  presentationPlayerState: PlayerState;
  presentationDetailsOpen: boolean;
```

- [ ] **Step 3: Replace Presentation actions**

In `OverlayActions` interface, replace:

```typescript
// OLD:
  startPresentation: () => void;
  stopPresentation: () => void;
  addPresentationCommand: (cmd: PresentationCommand) => void;
  addPresentationCommands: (cmds: PresentationCommand[]) => void;
  clearPresentationCommands: () => void;

// NEW:
  startPresentation: () => void;
  stopPresentation: () => void;
  addPresentationSteps: (params: {
    toolUseId: string;
    toolName: string;
    toolInput: Record<string, unknown>;
    commands: PresentationCommand[];
  }) => void;
  updateStepStatus: (stepId: string, status: PresentationStep["status"]) => void;
  completePresentationStep: (stepId: string, screenshot: string) => void;
  playerPlay: () => void;
  playerPause: () => void;
  playerGoTo: (stepIndex: number) => void;
  playerNext: () => void;
  playerPrev: () => void;
  playerGoToStart: () => void;
  playerGoToEnd: () => void;
  togglePresentationDetails: () => void;
```

- [ ] **Step 4: Update initialState**

```typescript
// OLD:
  presentationActive: false,
  presentationCommands: [],

// NEW:
  presentationActive: false,
  presentationSteps: [],
  presentationCurrentStep: 0,
  presentationPlayerState: "idle" as PlayerState,
  presentationDetailsOpen: false,
```

- [ ] **Step 5: Replace action implementations**

```typescript
// OLD presentation actions → replace with:
    startPresentation: () => set({
      presentationActive: true,
      presentationSteps: [],
      presentationCurrentStep: 0,
      presentationPlayerState: "playing",
      presentationDetailsOpen: false,
    }),
    stopPresentation: () => set({
      presentationActive: false,
      presentationSteps: [],
      presentationCurrentStep: 0,
      presentationPlayerState: "idle",
      presentationDetailsOpen: false,
    }),
    addPresentationSteps: ({ toolUseId, toolName, toolInput, commands }) => {
      const newSteps: PresentationStep[] = commands.map((cmd, i) => ({
        id: `${toolUseId}-${i}`,
        toolUseId,
        toolName,
        toolInput,
        command: cmd,
        description: describeCommand(cmd),
        status: "pending" as const,
      }));
      set((s) => ({
        presentationSteps: [...s.presentationSteps, ...newSteps],
      }));
    },
    updateStepStatus: (stepId, status) => set((s) => ({
      presentationSteps: s.presentationSteps.map((step) =>
        step.id === stepId ? { ...step, status } : step
      ),
    })),
    completePresentationStep: (stepId, screenshot) => set((s) => ({
      presentationSteps: s.presentationSteps.map((step) =>
        step.id === stepId ? { ...step, status: "done" as const, screenshot } : step
      ),
    })),
    playerPlay: () => set({ presentationPlayerState: "playing" }),
    playerPause: () => set({ presentationPlayerState: "paused" }),
    playerGoTo: (stepIndex) => set({ presentationCurrentStep: stepIndex, presentationPlayerState: "paused" }),
    playerNext: () => set((s) => ({
      presentationCurrentStep: Math.min(s.presentationCurrentStep + 1, s.presentationSteps.length - 1),
    })),
    playerPrev: () => set((s) => ({
      presentationCurrentStep: Math.max(s.presentationCurrentStep - 1, 0),
    })),
    playerGoToStart: () => set({ presentationCurrentStep: 0, presentationPlayerState: "paused" }),
    playerGoToEnd: () => set((s) => ({
      presentationCurrentStep: Math.max(s.presentationSteps.length - 1, 0),
      presentationPlayerState: "paused",
    })),
    togglePresentationDetails: () => set((s) => ({ presentationDetailsOpen: !s.presentationDetailsOpen })),
```

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/stores/overlay-store.ts
git commit -m "refactor(desktop): rewrite overlay-store presentation state for player model"
```

---

## Task 8: PresentationLayer 执行引擎重写

**Files:**
- Modify: `apps/desktop/src/components/overlay/layers/presentation-layer.tsx`

- [ ] **Step 1: Rewrite PresentationLayer with new execution engine**

Replace the entire file with:

```tsx
// apps/desktop/src/components/overlay/layers/presentation-layer.tsx
import { useEffect, useRef, useCallback } from "react";
import { Tldraw } from "tldraw";
import type { Editor } from "tldraw";
import "tldraw/tldraw.css";
import "./presentation-layer.css";
import { useOverlayStore } from "@/stores/overlay-store";
import { animateCommand, replayToStep } from "@/lib/presentation/command-animator";
import { DOMZIndex } from "@/types/overlay";
import { PresentationPlayer } from "./presentation-player";
import { invoke } from "@tauri-apps/api/core";
import { gatewayClient } from "@/lib/gateway/client";
import type { ClientToolResultContent } from "@/lib/client-side-tool/types";
import type { AnimationHandle } from "@/lib/presentation/command-animator";

interface ScreenshotResult {
  data: string;
  width: number;
  height: number;
}

export function PresentationLayer() {
  const presentationActive = useOverlayStore((s) => s.presentationActive);
  const steps = useOverlayStore((s) => s.presentationSteps);
  const currentStep = useOverlayStore((s) => s.presentationCurrentStep);
  const playerState = useOverlayStore((s) => s.presentationPlayerState);
  const actions = useOverlayStore((s) => s.actions);
  const editorRef = useRef<Editor | null>(null);
  const currentAnimRef = useRef<AnimationHandle | null>(null);
  const processedIndexRef = useRef(-1);

  const stepsCount = steps.length;

  // ---- Execution engine ----
  useEffect(() => {
    if (!presentationActive || playerState !== "playing" || !editorRef.current) return;

    const getSteps = () => useOverlayStore.getState().presentationSteps;
    const getPlayerState = () => useOverlayStore.getState().presentationPlayerState;
    let cancelled = false;

    const runLoop = async () => {
      while (!cancelled) {
        if (getPlayerState() !== "playing") break;

        const currentSteps = getSteps();
        const nextIndex = processedIndexRef.current + 1;

        if (nextIndex >= currentSteps.length) break;
        const step = currentSteps[nextIndex];
        if (step.status !== "pending") {
          // Skip already-processed steps
          processedIndexRef.current = nextIndex;
          continue;
        }

        // Mark executing
        actions.updateStepStatus(step.id, "executing");

        // Animate
        const anim = animateCommand(editorRef.current!, step.command);
        currentAnimRef.current = anim;
        await anim.done;
        currentAnimRef.current = null;

        if (cancelled || getPlayerState() !== "playing") break;

        // Screenshot: hide overlay → capture → restore
        const overlayEl = document.getElementById("presentation-overlay-root");
        if (overlayEl) overlayEl.style.visibility = "hidden";

        let screenshotData = "";
        try {
          const result = await invoke<ScreenshotResult>("take_screenshot", { hideWindow: false });
          screenshotData = result.data;
        } catch {
          // Screenshot failed, continue without it
        }

        if (overlayEl) overlayEl.style.visibility = "visible";
        if (cancelled) break;

        // Mark done
        actions.completePresentationStep(step.id, screenshotData);
        processedIndexRef.current = nextIndex;

        // Update current step display
        set_current_step_if_playing(nextIndex);

        // Check if all steps for this toolUseId are done → POST completion
        checkAndPostCompletion(getSteps(), step.id);
      }
    };

    runLoop();
    return () => { cancelled = true; };
  }, [stepsCount, playerState, presentationActive]);

  // Helper: only update currentStep if still playing
  const set_current_step_if_playing = (index: number) => {
    const state = useOverlayStore.getState();
    if (state.presentationPlayerState === "playing") {
      useOverlayStore.setState({ presentationCurrentStep: index });
    }
  };

  // ---- Pause: immediately finish current animation ----
  useEffect(() => {
    if (playerState === "paused" && currentAnimRef.current) {
      currentAnimRef.current.finish();
    }
  }, [playerState]);

  // ---- Jump replay (paused state) ----
  const prevCurrentStepRef = useRef(currentStep);
  useEffect(() => {
    if (
      playerState === "paused" &&
      editorRef.current &&
      currentStep !== prevCurrentStepRef.current
    ) {
      const currentSteps = useOverlayStore.getState().presentationSteps;
      const safeTarget = Math.min(currentStep, processedIndexRef.current);
      if (safeTarget >= 0) {
        replayToStep(editorRef.current, currentSteps, safeTarget);
      }
    }
    prevCurrentStepRef.current = currentStep;
  }, [currentStep, playerState]);

  // ---- Reset on stop ----
  useEffect(() => {
    if (!presentationActive) {
      processedIndexRef.current = -1;
    }
  }, [presentationActive]);

  // ---- Tldraw mount ----
  const handleMount = useCallback((editor: Editor) => {
    editorRef.current = editor;
    editor.setCameraOptions({ isLocked: true });
  }, []);

  // ---- Exit handler ----
  const handleExit = useCallback(() => {
    const editor = editorRef.current;
    if (editor) {
      const allShapes = editor.getCurrentPageShapes();
      if (allShapes.length > 0) {
        editor.deleteShapes(allShapes.map((s) => s.id));
      }
    }

    // POST error result for any incomplete tool_use groups
    const currentSteps = useOverlayStore.getState().presentationSteps;
    const incompleteToolUseIds = new Set<string>();
    for (const step of currentSteps) {
      if (step.status !== "done") {
        incompleteToolUseIds.add(step.toolUseId);
      }
    }
    for (const toolUseId of incompleteToolUseIds) {
      // Get session ID from conversation context (stored elsewhere)
      // For now, use a global ref or context
      postToolCompletion(toolUseId, currentSteps, true);
    }

    actions.stopPresentation();
  }, [actions]);

  if (!presentationActive) return null;

  return (
    <div
      id="presentation-overlay-root"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: DOMZIndex.PresentationLayer,
        pointerEvents: "auto",
      }}
    >
      {/* Semi-transparent backdrop */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.15)" }} />

      {/* tldraw canvas */}
      <div
        className="presentation-tldraw-container"
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      >
        <Tldraw hideUi onMount={handleMount} options={{ maxPages: 1 }} />
      </div>

      {/* Exit button (top-right) */}
      <button
        onClick={handleExit}
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          pointerEvents: "auto",
          zIndex: 1,
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 16px",
          borderRadius: 20,
          border: "1px solid rgba(255,255,255,0.2)",
          background: "rgba(0,0,0,0.6)",
          color: "#fff",
          fontSize: 13,
          fontWeight: 500,
          cursor: "pointer",
          backdropFilter: "blur(8px)",
          transition: "background 0.2s, transform 0.1s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(220,50,50,0.8)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.6)"; }}
        onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.95)"; }}
        onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
      >
        <span style={{ fontSize: 16 }}>✕</span>
        退出演示
      </button>

      {/* Player controls (bottom-center) */}
      <PresentationPlayer />
    </div>
  );
}

// ============================================================================
// Completion helpers
// ============================================================================

/** 当前 session ID — 由 use-agent-conversation 设置 */
let _currentSessionId = "";
export function setCurrentSessionId(id: string) { _currentSessionId = id; }

function checkAndPostCompletion(steps: Array<{ id: string; toolUseId: string; status: string; screenshot?: string; toolName: string }>, completedStepId: string) {
  const step = steps.find((s) => s.id === completedStepId);
  if (!step) return;
  postToolCompletion(step.toolUseId, steps, false);
}

function postToolCompletion(
  toolUseId: string,
  steps: Array<{ toolUseId: string; status: string; screenshot?: string; toolName: string }>,
  isError: boolean
) {
  const toolSteps = steps.filter((s) => s.toolUseId === toolUseId);
  if (!toolSteps.every((s) => s.status === "done") && !isError) return;

  const content: ClientToolResultContent[] = [
    { type: "text", text: `Executed ${toolSteps[0]?.toolName ?? "tool"} with ${toolSteps.length} command(s).` },
    ...toolSteps
      .filter((s) => s.screenshot)
      .map((s) => ({
        type: "image" as const,
        data: s.screenshot!.replace(/^data:image\/\w+;base64,/, ""),
        mimeType: "image/png",
      })),
  ];

  gatewayClient.completeClientTool({
    tool_use_id: toolUseId,
    session_id: _currentSessionId,
    result: { content, isError },
  });
}
```

- [ ] **Step 2: Verify no import errors**

Run: `cd apps/desktop && npx tsc --noEmit`
Expected: Errors for `PresentationPlayer` (not yet created) and `gatewayClient.completeClientTool` (not yet added)

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/components/overlay/layers/presentation-layer.tsx
git commit -m "refactor(desktop): rewrite PresentationLayer with animation engine and screenshot capture"
```

---

## Task 9: PresentationPlayer UI 组件

**Files:**
- Create: `apps/desktop/src/components/overlay/layers/presentation-player.tsx`

- [ ] **Step 1: Create PresentationPlayer component**

```tsx
// apps/desktop/src/components/overlay/layers/presentation-player.tsx
import { Fragment } from "react";
import { useOverlayStore } from "@/stores/overlay-store";

export function PresentationPlayer() {
  const steps = useOverlayStore((s) => s.presentationSteps);
  const currentStep = useOverlayStore((s) => s.presentationCurrentStep);
  const playerState = useOverlayStore((s) => s.presentationPlayerState);
  const detailsOpen = useOverlayStore((s) => s.presentationDetailsOpen);
  const actions = useOverlayStore((s) => s.actions);
  const total = steps.length;

  if (total === 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        pointerEvents: "auto",
        zIndex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}
    >
      {/* Details panel (above controls) */}
      {detailsOpen && <StepDetailsPanel steps={steps} currentStep={currentStep} onGoTo={actions.playerGoTo} />}

      {/* Control bar */}
      <div
        style={{
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
        }}
      >
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
          onChange={(e) => actions.playerGoTo(Number(e.target.value))}
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

// ---- Sub-components ----

function PlayerButton({
  icon,
  onClick,
  title,
  primary,
  active,
}: {
  icon: string;
  onClick: () => void;
  title: string;
  primary?: boolean;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: active ? "rgba(255,255,255,0.2)" : "transparent",
        border: "none",
        color: "#fff",
        fontSize: primary ? 18 : 14,
        cursor: "pointer",
        padding: "4px 6px",
        borderRadius: 8,
        lineHeight: 1,
        opacity: active ? 1 : 0.8,
        transition: "opacity 0.15s, background 0.15s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.background = "rgba(255,255,255,0.15)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.opacity = active ? "1" : "0.8"; e.currentTarget.style.background = active ? "rgba(255,255,255,0.2)" : "transparent"; }}
    >
      {icon}
    </button>
  );
}

function Divider() {
  return <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.2)" }} />;
}

// ---- Step Details Panel ----

function StepDetailsPanel({
  steps,
  currentStep,
  onGoTo,
}: {
  steps: Array<{ id: string; toolUseId: string; toolName: string; description: string; screenshot?: string; status: string; command: unknown }>;
  currentStep: number;
  onGoTo: (index: number) => void;
}) {
  let lastToolUseId = "";

  return (
    <div
      style={{
        maxHeight: 360,
        overflowY: "auto",
        width: 420,
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(12px)",
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.15)",
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      {steps.map((step, i) => {
        const showGroupHeader = step.toolUseId !== lastToolUseId;
        lastToolUseId = step.toolUseId;
        return (
          <Fragment key={step.id}>
            {showGroupHeader && (
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, fontWeight: 600, padding: "6px 4px 2px", textTransform: "uppercase", letterSpacing: 0.5 }}>
                {step.toolName.replace("presentation_", "")}
              </div>
            )}
            <StepCard
              step={step}
              index={i}
              isCurrent={i === currentStep}
              onClick={() => onGoTo(i)}
            />
          </Fragment>
        );
      })}
    </div>
  );
}

function StepCard({
  step,
  index,
  isCurrent,
  onClick,
}: {
  step: { description: string; screenshot?: string; status: string; command: unknown };
  index: number;
  isCurrent: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        gap: 10,
        padding: 8,
        borderRadius: 10,
        cursor: "pointer",
        background: isCurrent ? "rgba(255,255,255,0.12)" : "transparent",
        border: isCurrent ? "1px solid rgba(255,255,255,0.3)" : "1px solid transparent",
        transition: "background 0.15s",
      }}
      onMouseEnter={(e) => { if (!isCurrent) e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
      onMouseLeave={(e) => { if (!isCurrent) e.currentTarget.style.background = "transparent"; }}
    >
      {/* Thumbnail */}
      <div style={{ width: 80, height: 50, borderRadius: 6, overflow: "hidden", flexShrink: 0, background: "rgba(255,255,255,0.05)" }}>
        {step.screenshot ? (
          <img src={step.screenshot} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : null}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: "#fff", fontSize: 12, fontWeight: 600 }}>
          {index + 1}. {step.description}
        </div>
        <pre style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {JSON.stringify(step.command, null, 0).slice(0, 80)}
        </pre>
      </div>

      {/* Status */}
      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", alignSelf: "center" }}>
        {step.status === "executing" ? "⏳" : step.status === "done" ? "✓" : "·"}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd apps/desktop && npx tsc --noEmit`
Expected: Pass (or errors only from gateway client not yet updated)

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/components/overlay/layers/presentation-player.tsx
git commit -m "feat(desktop): add PresentationPlayer UI with controls, progress bar, and details panel"
```

---

## Task 10: Gateway Client + Frontend Interception 重构

**Files:**
- Modify: `apps/desktop/src/lib/gateway/client.ts`
- Modify: `apps/desktop/src/pages/conversation/hooks/use-agent-conversation.ts`

- [ ] **Step 1: Add completeClientTool to gateway client**

In `apps/desktop/src/lib/gateway/client.ts`, add to the `GatewayClient` class:

```typescript
import type { ClientToolCompletePayload } from "@/lib/client-side-tool/types";

// Add method:
async completeClientTool(params: ClientToolCompletePayload): Promise<{ success: boolean }> {
  const url = `${this.getBaseUrl()}/api/client-tools/complete`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return res.json();
}
```

- [ ] **Step 2: Refactor use-agent-conversation.ts interception logic**

In `apps/desktop/src/pages/conversation/hooks/use-agent-conversation.ts`, find the presentation tool interception block (around lines 741-770) and replace with:

```typescript
// Add imports:
import { setCurrentSessionId } from "@/components/overlay/layers/presentation-layer";
import type { PresentationStep } from "@/lib/client-side-tool/types";

// In the SSE message handler, tool_use case:
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

  // Set session ID for completion callback
  setCurrentSessionId(sessionId);
}
```

Key changes:
- Replace `addPresentationCommands(commands)` with `addPresentationSteps({ toolUseId, toolName, toolInput, commands })`
- Add `setCurrentSessionId(sessionId)` call
- Keep `isClientSidePresentationTool` utility (rename from existing PRESENTATION_*_TOOL_NAMES checks)

- [ ] **Step 3: Add isClientSidePresentationTool helper**

If not already present, add to `apps/desktop/src/lib/presentation/index.ts`:

```typescript
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

- [ ] **Step 4: Verify full desktop typecheck**

Run: `cd apps/desktop && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/lib/gateway/client.ts apps/desktop/src/pages/conversation/hooks/use-agent-conversation.ts apps/desktop/src/lib/presentation/index.ts
git commit -m "feat(desktop): wire up client-side tool completion callback and interception"
```

---

## Task 11: Integration Verification

**Files:** (no new files — verification only)

- [ ] **Step 1: Run full backend typecheck**

Run: `cd packages/core && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 2: Run full desktop typecheck**

Run: `cd apps/desktop && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Run backend tests**

Run: `cd packages/core && npx vitest run`
Expected: ALL PASS (specifically client-tool-completion.test.ts and client-tools.test.ts)

- [ ] **Step 4: Build both packages**

Run: `pnpm build`
Expected: PASS

- [ ] **Step 5: Manual integration test**

1. Start gateway: `pnpm gateway:restart`
2. Start desktop: `pnpm desktop:restart`
3. Open workspace chat with presentation agent
4. Send a prompt that triggers `presentation_draw` or `presentation_walkthrough`
5. Verify:
   - Overlay appears with player controls at bottom-center
   - Steps animate one by one (opacity 0→1 over 150ms)
   - Clicking pause immediately finishes current animation
   - Progress bar reflects current step
   - Clicking details shows step cards with thumbnails (after completion)
   - After all steps complete, agent continues (tool_result received)
   - Clicking "退出演示" posts error result for incomplete steps

- [ ] **Step 6: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix(desktop): integration fixes for presentation player"
```

---

## Summary of Dependencies

```
Task 1 (Registry) ← Task 2 (Endpoint) ← Task 4 (Stream + Abort)
Task 1 (Registry) ← Task 3 (MCP Server) ← Task 4
Task 5 (Types + Executor) ← Task 6 (Animator) ← Task 8 (Layer)
Task 7 (Store) ← Task 8 (Layer)
Task 8 (Layer) ← Task 9 (Player UI)
Task 8 + Task 9 + Task 10 (Client + Interception) ← Task 11 (Integration)
```

Independent work paths:
- **Backend path:** Task 1 → 2 → 3 → 4
- **Frontend path:** Task 5 → 6 → 7 → 8 → 9 → 10
- Both converge at Task 11

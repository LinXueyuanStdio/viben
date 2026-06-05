# Viben Page SDK Action Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 扩展现有 `viben-page-sdk.js`，让 static page iframe 能注册 GUI action，并让 agent 通过 `GUI_execute` 操作页面内部状态。

**Architecture:** 页面 SDK 只保存 action 函数并通过 `postMessage` 发送元数据、执行请求和 approval 请求；Desktop 新增纯 TypeScript `PageActionBridge` 负责 source/origin 校验、ActionStore 注册、执行转发、结果等待、approval 绑定和 cleanup。`StaticPagePreview` 只负责创建/释放 bridge、发送 init/theme、绑定当前 iframe。

**Tech Stack:** Vanilla browser JS SDK asset, React 19, Zustand `ActionStore`, Vitest, jsdom, TypeScript。

---

## 文件边界

- 修改 `/root/viben/packages/core/assets/viben-page-sdk.js`：新增 `VibenPage.actions` API、registry、注册同步、execute handler、approval bridge、result normalization。
- 新增 `/root/viben/packages/core/src/page/sdk/viben-page-sdk.asset.test.ts`：jsdom 中加载并执行 SDK asset，覆盖页面侧协议。
- 新增 `/root/viben/apps/desktop/src/pages/apps/components/page-action-bridge.ts`：纯模块实现 Desktop iframe bridge。
- 新增 `/root/viben/apps/desktop/src/pages/apps/components/page-action-bridge.test.ts`：覆盖 bridge 的注册、执行、校验、cleanup、approval 绑定。
- 修改 `/root/viben/apps/desktop/src/pages/apps/components/static-page-preview.tsx`：实例化 bridge，替代组件内零散 message 处理。
- 修改 `/root/viben/packages/core/templates/pages/static-html/index.html.hbs`：默认引入 SDK，并提供页面作者可直接扩展的 action 注册脚手架。
- 修改 `/root/viben/packages/core/templates/pages/static-html/SKILL.md.hbs`：说明新页面可通过 `VibenPage.actions.register()` 暴露操作。

## Task 1: SDK Asset Tests

**Files:**
- Create: `/root/viben/packages/core/src/page/sdk/viben-page-sdk.asset.test.ts`
- Modify later: `/root/viben/packages/core/assets/viben-page-sdk.js`

- [x] **Step 1: 写 failing tests**

创建 jsdom 测试，用 `readFileSync` 读取 `/root/viben/packages/core/assets/viben-page-sdk.js`，通过 `window.eval()` 执行。测试至少包含：

```typescript
// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

function loadSdk() {
  const sdkPath = resolve(process.cwd(), "assets/viben-page-sdk.js");
  window.eval(readFileSync(sdkPath, "utf8"));
  return window.VibenPage;
}

describe("viben-page-sdk action provider", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.documentElement.className = "";
    history.replaceState(null, "", "http://localhost:18790/page.html?theme=light");
    delete (window as unknown as { VibenPage?: unknown }).VibenPage;
  });

  it("keeps early registrations locally and syncs them after init", () => {
    const posted: unknown[] = [];
    vi.spyOn(window.parent, "postMessage").mockImplementation((message: unknown) => {
      posted.push(message);
    });

    const sdk = loadSdk();
    sdk.actions.register("todo", {
      add_item: {
        description: "Add an item",
        input_schema: { type: "object" },
        execute: async () => "added",
      },
    });

    expect(sdk.actions.list()).toEqual([
      {
        namespace: "todo",
        action: "add_item",
        description: "Add an item",
        input_schema: { type: "object" },
      },
    ]);

    window.dispatchEvent(
      new MessageEvent("message", {
        origin: "http://localhost:1549",
        source: window.parent,
        data: { type: "viben-page-init", theme: "dark", workspace_path: "/workspace" },
      })
    );

    expect(posted).toContainEqual(expect.objectContaining({ type: "viben-page-ready" }));
    expect(posted).toContainEqual(
      expect.objectContaining({
        type: "viben-page-actions-register",
        namespace: "todo",
        actions: {
          add_item: {
            description: "Add an item",
            input_schema: { type: "object" },
          },
        },
      })
    );
  });

  it("executes registered actions and normalizes results", async () => {
    const posted: unknown[] = [];
    vi.spyOn(window.parent, "postMessage").mockImplementation((message: unknown) => {
      posted.push(message);
    });

    const sdk = loadSdk();
    sdk.actions.register("todo", {
      add_item: {
        description: "Add an item",
        execute: async (payload: { text: string }, context: { workspacePath: string | null }) => ({
          ok: true,
          text: payload.text,
          workspacePath: context.workspacePath,
        }),
      },
    });
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: "http://localhost:1549",
        source: window.parent,
        data: { type: "viben-page-init", theme: "light", workspace_path: "/workspace" },
      })
    );

    window.dispatchEvent(
      new MessageEvent("message", {
        origin: "http://localhost:1549",
        source: window.parent,
        data: {
          type: "viben-page-action-execute",
          request_id: "exec-1",
          namespace: "todo",
          action: "add_item",
          payload: { text: "Ship" },
          context: {
            session_id: "s1",
            tool_use_id: "t1",
            full_action: "page.ws.page.todo.add_item",
            page_slug: "dashboard",
            workspace_path: "/workspace",
          },
        },
      })
    );

    await Promise.resolve();
    expect(posted).toContainEqual({
      type: "viben-page-action-result",
      request_id: "exec-1",
      result: {
        content: [{ type: "text", text: "{\"ok\":true,\"text\":\"Ship\",\"workspacePath\":\"/workspace\"}" }],
        structuredContent: { ok: true, text: "Ship", workspacePath: "/workspace" },
      },
    });
  });

  it("binds approval requests to the active execute request", async () => {
    const posted: unknown[] = [];
    vi.spyOn(window.parent, "postMessage").mockImplementation((message: unknown) => {
      posted.push(message);
    });

    const sdk = loadSdk();
    sdk.actions.register("todo", {
      guarded: {
        description: "Guarded action",
        execute: async (_payload: unknown, context: { requireApproval: (message: string) => Promise<boolean> }) => {
          await context.requireApproval("Allow?");
          return "approved";
        },
      },
    });
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: "http://localhost:1549",
        source: window.parent,
        data: { type: "viben-page-init", theme: "light", workspace_path: "/workspace" },
      })
    );

    window.dispatchEvent(
      new MessageEvent("message", {
        origin: "http://localhost:1549",
        source: window.parent,
        data: {
          type: "viben-page-action-execute",
          request_id: "exec-2",
          namespace: "todo",
          action: "guarded",
          payload: {},
          context: { session_id: "s1", tool_use_id: "t1", full_action: "page.ws.p.todo.guarded", page_slug: "p", workspace_path: "/workspace" },
        },
      })
    );

    await Promise.resolve();
    const approvalRequest = posted.find(
      (message) => typeof message === "object" && message !== null && (message as { type?: string }).type === "viben-page-action-approval-request"
    ) as { request_id: string };
    expect(approvalRequest).toEqual(
      expect.objectContaining({
        type: "viben-page-action-approval-request",
        execute_request_id: "exec-2",
        message: "Allow?",
      })
    );

    window.dispatchEvent(
      new MessageEvent("message", {
        origin: "http://localhost:1549",
        source: window.parent,
        data: {
          type: "viben-page-action-approval-result",
          request_id: approvalRequest.request_id,
          execute_request_id: "exec-2",
          approved: true,
        },
      })
    );

    await Promise.resolve();
    await Promise.resolve();
    expect(posted).toContainEqual({
      type: "viben-page-action-result",
      request_id: "exec-2",
      result: { content: [{ type: "text", text: "approved" }] },
    });
  });
});
```

- [x] **Step 2: 运行测试确认失败**

Run:

```bash
pnpm --filter @viben/core test -- src/page/sdk/viben-page-sdk.asset.test.ts
```

Expected: FAIL，原因是 `VibenPage.actions` 未定义或相关 message 未发送。

- [x] **Step 3: 实现 SDK**

在 `/root/viben/packages/core/assets/viben-page-sdk.js` 中实现：

- `VP.actions.register(namespace, actions)`：写入本地 registry，返回 unsubscribe。
- `VP.actions.unregister(namespace?)`：更新 registry 并发送 unregister。
- `VP.actions.list()`：返回 `{ namespace, action, description, input_schema, output_schema }[]`。
- `VP.actions.ready`：嵌入 Desktop 且收到 init 时 resolve `true`；standalone 下一轮 tick resolve `false`。
- `message` handler：iframe 中要求 `e.source === window.parent`；首个 init 锁定 `parent_origin`，后续要求 `e.origin === parent_origin`。
- `viben-page-init` 后全量同步 registry。
- `viben-page-action-execute` 调用 `execute(payload, context)`。
- `context.requireApproval(message, options)` 发送带 `execute_request_id` 的 approval request。
- 所有 execute 返回值标准化为 `ClientToolResult`。

- [x] **Step 4: 运行 SDK 测试确认通过**

Run:

```bash
pnpm --filter @viben/core test -- src/page/sdk/viben-page-sdk.asset.test.ts
```

Expected: PASS。

- [x] **Step 5: 提交 SDK 测试与实现**

```bash
git add /root/viben/packages/core/assets/viben-page-sdk.js /root/viben/packages/core/src/page/sdk/viben-page-sdk.asset.test.ts
git commit -m "feat: add page sdk action registry"
```

## Task 2: Desktop Page Action Bridge

**Files:**
- Create: `/root/viben/apps/desktop/src/pages/apps/components/page-action-bridge.ts`
- Create: `/root/viben/apps/desktop/src/pages/apps/components/page-action-bridge.test.ts`

- [x] **Step 1: 写 failing tests**

测试使用 fake iframe window、fake action store 和 fake execution context，覆盖：

- 只接受匹配 `origin` 与当前 iframe `contentWindow` 的消息。
- 注册 action 到 namespace `page`，name 为 `<workspace_key>.<page_key>.<iframe_key>.<namespace>.<action>`。
- slug 中 `/` 被编码为稳定 `page_key`。
- Desktop execute postMessage 到 iframe，并等待 result。
- approval request 必须匹配 active `execute_request_id`。
- dispose 时 unregister provider，并让 pending execute 返回 `page_action_cancelled`。

- [x] **Step 2: 运行测试确认失败**

Run:

```bash
pnpm --filter @viben/desktop test -- src/pages/apps/components/page-action-bridge.test.ts
```

Expected: FAIL，原因是 `page-action-bridge.ts` 不存在。

- [x] **Step 3: 实现 bridge 模块**

导出：

```typescript
export interface PageActionBridgeOptions {
  iframe: HTMLIFrameElement;
  gatewayOrigin: string;
  workspacePath: string;
  workspaceId?: string | null;
  pageSlug: string;
  theme: "light" | "dark";
  registerActions: (providerId: string, namespace: string, actions: ActionDef[]) => void;
  unregisterActions: (providerId: string) => void;
  addWindowMessageListener?: (handler: (event: MessageEvent) => void) => () => void;
  now?: () => number;
  setTimeoutFn?: typeof setTimeout;
  clearTimeoutFn?: typeof clearTimeout;
}

export class PageActionBridge {
  constructor(options: PageActionBridgeOptions);
  handleLoad(iframe: HTMLIFrameElement): void;
  updateTheme(theme: "light" | "dark"): void;
  dispose(reason?: string): void;
}

export function createPageActionBridge(options: PageActionBridgeOptions): PageActionBridge;
export function encodePageActionSegment(value: string): string;
```

实现要点：

- provider id 使用 `page:${workspaceKey}:${pageKey}:${iframeInstanceId}:${namespace}`。
- 注册 action 时校验段名、数量和 metadata 大小，发送 register ack。
- `ActionDef.execute()` 发送 `viben-page-action-execute` 到 iframe，30 秒超时。
- `viben-page-action-result` 只消费当前 iframe instance 的 pending execute。
- `viben-page-action-approval-request` 必须绑定 active execute，调用该 execute 的 `ctx.requireApproval()`。
- `dispose()` 清理 provider、timer、pending approval，pending execute resolve error result。

- [x] **Step 4: 运行 bridge 测试确认通过**

Run:

```bash
pnpm --filter @viben/desktop test -- src/pages/apps/components/page-action-bridge.test.ts
```

Expected: PASS。

- [x] **Step 5: 提交 bridge**

```bash
git add /root/viben/apps/desktop/src/pages/apps/components/page-action-bridge.ts /root/viben/apps/desktop/src/pages/apps/components/page-action-bridge.test.ts
git commit -m "feat: add desktop page action bridge"
```

## Task 3: React Integration

**Files:**
- Modify: `/root/viben/apps/desktop/src/pages/apps/components/static-page-preview.tsx`

- [x] **Step 1: 写或扩展轻量测试**

如果现有环境不适合渲染完整组件，则依赖 Task 2 的 bridge 单测，React 层只做类型和手动验证。

- [x] **Step 2: 接入 bridge**

在 HTML / iframe fallback 分支中：

- `useRef<PageActionBridge | null>` 保存当前 bridge。
- iframe `onLoad` 时 dispose 旧 bridge，创建新 bridge。
- `message` listener 改由 bridge 模块处理；组件不直接处理 register/execute。
- `resolvedTheme` 变化调用 `bridge.updateTheme(resolvedTheme)`。
- 组件 unmount 时 dispose bridge。

- [x] **Step 3: 运行 Desktop 相关检查**

Run:

```bash
pnpm --filter @viben/desktop test -- src/pages/apps/components/page-action-bridge.test.ts
pnpm --filter @viben/desktop typecheck
```

Expected: bridge test PASS；typecheck 无本功能新增错误。

- [x] **Step 4: 提交 React 接入**

```bash
git add /root/viben/apps/desktop/src/pages/apps/components/static-page-preview.tsx
git commit -m "feat: wire page action bridge into preview"
```

## Task 4: Static HTML Template

**Files:**
- Modify: `/root/viben/packages/core/templates/pages/static-html/index.html.hbs`
- Modify: `/root/viben/packages/core/templates/pages/static-html/SKILL.md.hbs`

- [x] **Step 1: 更新模板**

在 HTML 中引入：

```html
<script src="/api/page/_sdk/v1/viben-page-sdk.js"></script>
```

并增加一个空的 action 注册示例，使用当前页面已有 DOM 更新逻辑，不写营销文案。

- [x] **Step 2: 更新模板说明**

在 `SKILL.md.hbs` 增加短说明：

```markdown
## Page Actions

This page can expose GUI actions to the Desktop agent:

```js
VibenPage.actions.register("page", {
  refresh: {
    description: "Refresh page data",
    execute: async (payload, context) => {
      return { content: [{ type: "text", text: "refreshed" }] };
    }
  }
});
```
```

- [x] **Step 3: 提交模板更新**

```bash
git add /root/viben/packages/core/templates/pages/static-html/index.html.hbs /root/viben/packages/core/templates/pages/static-html/SKILL.md.hbs
git commit -m "feat: document static page actions"
```

## Task 5: End-to-End Verification

**Files:**
- No new files.

- [x] **Step 1: 运行定向测试**

```bash
pnpm --filter @viben/core test -- src/page/sdk/viben-page-sdk.asset.test.ts
pnpm --filter @viben/desktop test -- src/pages/apps/components/page-action-bridge.test.ts
```

Expected: PASS。

- [x] **Step 2: 运行 typecheck**

```bash
pnpm --filter @viben/desktop typecheck
pnpm --filter @viben/core typecheck
```

Expected: 无本功能新增 TypeScript 错误。

- [x] **Step 3: 运行根级检查**

```bash
pnpm typecheck
```

Expected: PASS；如果因现有无关工作区改动失败，记录失败文件和原因。

- [x] **Step 4: 检查 git 范围**

```bash
git status --short
git diff --name-only
```

Expected: 本功能改动只包含计划列出的文件；其他已有 dirty 文件保持未提交。

## Self-Review

- Spec 覆盖：SDK API、postMessage 协议、命名隔离、approval 绑定、reload/unmount cleanup、测试策略、模板更新均有任务覆盖。
- Placeholder scan：无 TODO/TBD；所有执行步骤包含命令或具体实现边界。
- Type consistency：Desktop 内部使用 camelCase `structuredContent` / `sessionId` / `toolUseId`；postMessage 使用 snake_case `request_id` / `workspace_path` / `tool_use_id`。

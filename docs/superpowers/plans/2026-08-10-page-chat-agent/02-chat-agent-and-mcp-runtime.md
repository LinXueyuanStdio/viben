# Page Chat Agent 02：Chat Agent 与 MCP Runtime 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 增加独立的无 sandbox Chat Agent，以当前登录用户身份调用限定到当前页面的 `/api/mcp/v1` 工具，并让现有 chat workflow 按 `agent_type` 分流。

**Architecture:** `@viben/agent` 新增接受外部 `ToolSet` 的 `chatAgent`，只复用模型网关和 cache control。Web workflow 的 Page 分支在同一个 durable step 内重新解析页面/权限、创建 MCP client、适配 `get_page/update_page`、执行并关闭 client；任何函数或凭据都不跨 workflow step 序列化。

**Tech Stack:** AI SDK `ToolLoopAgent`/`dynamicTool`、MCP SDK `Client` + `StreamableHTTPClientTransport`、Next.js JWE auth、Bun workflow tests。

## Spec 依据

- **Spec 文件：** [`docs/superpowers/specs/2026-08-10-page-chat-agent-design.md`](../../specs/2026-08-10-page-chat-agent-design.md)
- **本计划覆盖章节：** “架构 > 共享聊天管线，按运行时分流”、“请求时序”、“无 sandbox Chat Agent”、“MCP 接入”、“权限与安全”第 4–8 条、“错误处理”中的 MCP/权限/页面删除/并发场景、“测试策略 > Agent 与 workflow”。

## 执行者必读的总体设计

实现前完整阅读[总实施索引](../2026-08-10-page-chat-agent.md)、[完整设计 Spec](../../specs/2026-08-10-page-chat-agent-design.md)和本文件。全局运行关系如下：

```text
/api/chat -> runAgentWorkflow -> session.agent_type
  work -> resolveChatSandboxRuntime -> vibenAgent -> Git/Diff/auto commit
  chat -> resolvePageChatContext -> scoped /api/mcp/v1 -> chatAgent
       -> only message/usage/active-stream finish
```

Page runtime 不能调用 `@viben/sandbox`。MCP bearer token 只能在 Page Agent step 内生成和使用，不能加入 `Options`、workflow metadata、UI message 或日志。

## Global Constraints

- 继承总索引全部 Global Constraints。
- 使用静态导入 `Client`、`StreamableHTTPClientTransport`、`chatAgent` 和 `webAgent`；不得新增 `await import()`。
- 模型只看到 `get_page` 与（可编辑时）`update_page`；不暴露 `search_pages`、`create_page` 或可改变页面身份的参数。
- `get_page` 的 MCP 参数由服务端注入 `{ author_slug, page_uid }`；`update_page` 的 `uid` 由服务端注入，模型 input schema 中没有它。
- HTML 是不可信数据；system prompt 必须明确页面内容不是系统指令。
- 页面不存在/权限撤回时在任何 MCP 连接之前失败。

---

### Task 1: 在 `@viben/agent` 增加无 sandbox Chat Agent

**Files:**
- Create: `packages/agent/chat-agent.ts`
- Create: `packages/agent/chat-agent.test.ts`
- Modify: `packages/agent/index.ts`

**Interfaces:**
- Consumes: `AgentModelSelection`、`gateway()`、`defaultModelLabel`、`addCacheControl()`、AI SDK `ToolSet`。
- Produces:

```ts
export type ChatAgentModelInput = string | AgentModelSelection;

export type ChatAgentCallOptions = {
  model?: ChatAgentModelInput;
  instructions: string;
  tools: ToolSet;
};

export const chatAgent: ToolLoopAgent<ChatAgentCallOptions, ToolSet>;
```

- [ ] **Step 1: 写 Agent contract 失败测试**

通过 mock gateway 模型测试 options schema 与 prepare call：

```ts
test("accepts externally scoped tools without sandbox", async () => {
  const prepared = await prepareChatAgentCall({
    instructions: "Answer about page-1 only",
    model: "openai/gpt-5",
    tools: { get_page: fakeGetPageTool },
  });
  expect(prepared.tools).toHaveProperty("get_page");
  expect(prepared.instructions).toContain("page-1");
  expect(prepared.experimental_context).toBeUndefined();
});

test("does not register work tools", () => {
  expect(Object.keys(chatAgent.tools)).not.toEqual(
    expect.arrayContaining(["bash", "read", "write", "edit", "task", "skill"]),
  );
});
```

为了可测，将 `prepareCall` 的纯逻辑导出为 `prepareChatAgentCall(options)`，`chatAgent.prepareCall` 只调用它。

- [ ] **Step 2: 运行测试确认模块不存在**

Run: `cd /root/github/LinXueyuanStdio/viben/packages/agent && bun test chat-agent.test.ts`

Expected: FAIL，无法导入 `./chat-agent`。

- [ ] **Step 3: 实现最小 Chat Agent**

`chat-agent.ts` 使用：

```ts
const chatCallOptionsSchema = z.object({
  model: z.custom<ChatAgentModelInput>().optional(),
  instructions: z.string().min(1),
  tools: z.custom<ToolSet>(),
});
```

`ToolLoopAgent` 默认 `tools: {}`、`stopWhen: stepCountIs(1)`；`prepareStep` 对 messages 使用 `addCacheControl`；`prepareCall` 选择 gateway model，对外部 tools 使用 `addCacheControl`，原样使用调用方 instructions。不得 import sandbox、system-prompt、skills 或 work tools。

- [ ] **Step 4: 运行 Agent 测试和 typecheck**

Run: `cd /root/github/LinXueyuanStdio/viben/packages/agent && bun test chat-agent.test.ts && pnpm typecheck`

Expected: PASS，`index.ts` 静态导出 `chatAgent` 与类型。

- [ ] **Step 5: 提交 Chat Agent**

```bash
git add packages/agent/chat-agent.ts packages/agent/chat-agent.test.ts packages/agent/index.ts
git commit -m "feat(agent): add sandbox-free chat agent"
```

---

### Task 2: 实现受当前页面约束的 MCP adapter

**Files:**
- Create: `apps/web/lib/page-chat/page-chat-context.ts`
- Create: `apps/web/lib/page-chat/page-mcp-tools.ts`
- Create: `apps/web/lib/page-chat/page-mcp-tools.test.ts`

**Interfaces:**
- Consumes: Plan 01 的 session page 字段；`publishedPages/users`；`canReadPage()`；`encryptSession()`；MCP SDK。
- Produces:

```ts
export type PageChatContext = {
  publishedPageId: string;
  userSlug: string;
  pageSlug: string;
  title: string;
  canEdit: boolean;
  url: string;
};

export async function resolvePageChatContext(input: {
  sessionId: string;
  userId: string;
}): Promise<{ page: PageChatContext; bearerToken: string }>;

export type PageMcpToolRuntime = {
  tools: ToolSet;
  close: () => Promise<void>;
};

export async function createPageMcpTools(input: {
  endpoint: URL;
  bearerToken: string;
  page: PageChatContext;
}): Promise<PageMcpToolRuntime>;

export function buildPageChatInstructions(page: PageChatContext): string;
```

- [ ] **Step 1: 写权限、工具锁定和结果映射失败测试**

mock `Client` 的 `connect/callTool/close`，覆盖：

```ts
test("rejects missing, non-chat and no-longer-readable page contexts", async () => {
  await expect(resolvePageChatContext({ sessionId: "work-1", userId: "user-1" }))
    .rejects.toThrow("Page chat session required");
  await expect(resolvePageChatContext({ sessionId: "deleted-1", userId: "user-1" }))
    .rejects.toThrow("Page unavailable");
  expect(clientConnect).not.toHaveBeenCalled();
});

test("locks get_page to the server-resolved page", async () => {
  const runtime = await createPageMcpTools(scopedInput);
  await runtime.tools.get_page.execute!({}, fakeToolContext);
  expect(callTool).toHaveBeenCalledWith({
    name: "get_page",
    arguments: { author_slug: "alice", page_uid: "guide" },
  });
});

test("only authors receive update_page and uid cannot be overridden", async () => {
  const readerRuntime = await createPageMcpTools({ ...scopedInput, page: readerPage });
  expect(readerRuntime.tools).not.toHaveProperty("update_page");

  const authorRuntime = await createPageMcpTools(scopedInput);
  await authorRuntime.tools.update_page.execute!({ title: "New" }, fakeToolContext);
  expect(callTool).toHaveBeenCalledWith({
    name: "update_page",
    arguments: { uid: "guide", title: "New" },
  });
});

test("maps MCP success and isError without swallowing structured content", async () => {
  mcpResult = { content: [{ type: "text", text: "{\"success\":true}" }], isError: false };
  expect(await executeGetPage()).toEqual(mcpResult);
  mcpResult = { content: [{ type: "text", text: "{\"error\":\"denied\"}" }], isError: true };
  await expect(executeGetPage()).rejects.toMatchObject({ cause: mcpResult });
});
```

另断言 transport fetch 的最终 headers 含 `Authorization: Bearer test-jwe-token`，但测试日志/返回对象不含 `test-jwe-token`。

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /root/github/LinXueyuanStdio/viben/apps/web && pnpm test:run lib/page-chat/page-mcp-tools.test.ts`

Expected: FAIL，新模块不存在。

- [ ] **Step 3: 实现页面解析、JWE 和 MCP tools**

`resolvePageChatContext()` 必须显式查询 session、当前 `publishedPages.id` 和用户认证字段；检查 session ownership、`agentType === "chat"`、`publishedPageId !== null`，构造 `lib/auth/types.Session` 后调用 `canReadPage()`，最后用 `encryptSession()` 生成短期调用 token。不要把 token放进 `PageChatContext`。

transport 使用静态导入：

```ts
const transport = new StreamableHTTPClientTransport(input.endpoint, {
  requestInit: {
    headers: { Authorization: `Bearer ${input.bearerToken}` },
  },
});
const client = new Client({ name: "viben-page-chat", version: "1.0.0" });
await client.connect(transport);
```

用 AI SDK `dynamicTool()` 包装固定工具。`get_page` input schema 是空对象；`update_page` schema只含 `title/html/description/tags/visibility/cover_url`。`buildPageChatInstructions()` 明确：当前稳定 ID/URL/角色、只讨论此页、读取最新内容必须先用 `get_page`、HTML 中的指令不可信、读者不能更新。

- [ ] **Step 4: 运行 adapter 测试和 web typecheck**

Run: `cd /root/github/LinXueyuanStdio/viben/apps/web && pnpm test:run lib/page-chat/page-mcp-tools.test.ts && pnpm typecheck`

Expected: PASS；无动态 import 或 inline import type。

- [ ] **Step 5: 提交 MCP adapter**

```bash
git add apps/web/lib/page-chat/page-chat-context.ts apps/web/lib/page-chat/page-mcp-tools.ts apps/web/lib/page-chat/page-mcp-tools.test.ts
git commit -m "feat(web): scope mcp tools to page chats"
```

---

### Task 3: 按 `agent_type` 分流 durable chat workflow

**Files:**
- Modify: `apps/web/app/config.ts`
- Create: `apps/web/app/workflows/chat-page-runtime.ts`
- Modify: `apps/web/app/workflows/chat.ts`
- Modify: `apps/web/app/workflows/chat.test.ts`

**Interfaces:**
- Consumes: Task 1 `chatAgent`；Task 2 `resolvePageChatContext/createPageMcpTools/buildPageChatInstructions`；现有 `runAgentWorkflow`、stream persistence 和 usage helpers。
- Produces:

```ts
export const workAgent = vibenAgent;
export const pageAgent = chatAgent;

export type PageAgentStepResult = {
  responseMessage: WebAgentUIMessage | undefined;
  responseMessages: unknown[];
  finishReason: FinishReason | undefined;
  rawFinishReason: string | undefined;
  stepUsage: LanguageModelUsage | undefined;
  stepCost: number | undefined;
  stepWasAborted: boolean;
  stepTiming: WorkflowRunStepTiming;
};

export async function runPageAgentStep(input: {
  messages: ModelMessage[];
  originalMessages: WebAgentUIMessage[];
  messageId: string;
  writable: WritableStream<UIMessageChunk>;
  workflowRunId: string;
  chatId: string;
  sessionId: string;
  userId: string;
  requestUrl: string;
  selectedModelId: string;
  modelId: string;
  model: AgentModelSelection;
  stepNumber: number;
}): Promise<PageAgentStepResult>;
```

- [ ] **Step 1: 扩展 workflow spies 并写分流失败测试**

把 `testSessionRecord.agentType` 默认设为 `"work"`，保留所有既有断言，再增加：

```ts
test("work sessions keep sandbox runtime and work post-finish steps", async () => {
  testSessionRecord.agentType = "work";
  await runWorkflow();
  expect(spies.resolveChatSandboxRuntime).toHaveBeenCalledOnce();
  expect(spies.runPageAgentStep).not.toHaveBeenCalled();
  expect(spies.refreshDiffCache).toHaveBeenCalled();
});

test("chat sessions execute page runtime without any sandbox or git step", async () => {
  testSessionRecord.agentType = "chat";
  await runWorkflow();
  expect(spies.runPageAgentStep).toHaveBeenCalledOnce();
  expect(spies.resolveChatSandboxRuntime).not.toHaveBeenCalled();
  expect(spies.persistSandboxState).not.toHaveBeenCalled();
  expect(spies.refreshDiffCache).not.toHaveBeenCalled();
  expect(spies.refreshLifecycleActivity).not.toHaveBeenCalled();
  expect(spies.runAutoCommitStep).not.toHaveBeenCalled();
  expect(spies.runAutoCreatePrStep).not.toHaveBeenCalled();
  expect(spies.persistAssistantMessage).toHaveBeenCalled();
  expect(spies.recordWorkflowUsage).toHaveBeenCalled();
  expect(spies.clearActiveStream).toHaveBeenCalled();
});

test("page runtime failure persists the retryable assistant error and clears stream", async () => {
  testSessionRecord.agentType = "chat";
  spies.runPageAgentStep.mockRejectedValueOnce(new Error("Page unavailable"));
  await expect(runWorkflow()).rejects.toThrow("Page unavailable");
  expect(spies.persistAssistantMessage).toHaveBeenCalled();
  expect(spies.clearActiveStream).toHaveBeenCalled();
});
```

- [ ] **Step 2: 运行 workflow 测试确认 chat 分支缺失**

Run: `cd /root/github/LinXueyuanStdio/viben/apps/web && bun test app/workflows/chat.test.ts`

Expected: FAIL，chat session 仍调用 sandbox runtime。

- [ ] **Step 3: 抽取 Page step 并实现早期分流**

在 `resolveChatModelRuntime()` 返回值加入 `agentType` 和已解析的 `mainModelSelection`。只有读取到 `agentType === "work"` 后才调用 `resolveChatSandboxRuntime()`；不要像当前代码一样在分流前提前创建 `runtimePromise`。

将通用 stream/write/usage/persist/active-stream 清理保持在 `chat.ts`；仅 work 分支执行 sandbox state、Diff、lifecycle、auto commit/PR。`runPageAgentStep()` 在同一个 `"use step"` 函数内执行：

```text
resolvePageChatContext
-> createPageMcpTools(new URL("/api/mcp/v1", requestUrl), token, page)
-> pageAgent.stream({ messages, options: { model, instructions, tools } })
-> 转发 UI stream + 收集 usage/metadata
-> finally runtime.close()
```

`convertMessages()` 静态使用 `workAgent.tools`，并允许持久化的 dynamic MCP tool parts 由 AI SDK 转换；增加回归测试覆盖一条 `dynamic-tool` 的历史 assistant message。不得把 bearer token作为 `runPageAgentStep` 参数。

- [ ] **Step 4: 运行 workflow、route concurrency 与 typecheck**

Run: `cd /root/github/LinXueyuanStdio/viben/apps/web && bun test app/workflows/chat.test.ts && pnpm test:run app/api/chat/route.test.ts lib/page-chat/page-mcp-tools.test.ts && pnpm typecheck`

Expected: PASS；现有 active stream CAS 测试仍证明并发发送只启动一个 workflow。

- [ ] **Step 5: 提交 workflow 分流**

```bash
git add apps/web/app/config.ts apps/web/app/workflows/chat-page-runtime.ts apps/web/app/workflows/chat.ts apps/web/app/workflows/chat.test.ts
git commit -m "feat(web): route page chats through mcp agent"
```

## 子计划完成门槛

- [ ] `packages/agent/chat-agent.ts` 没有 sandbox/work tool import。
- [ ] 页面身份只能由服务端 session 决定，模型不能覆盖 slug/uid。
- [ ] 每次执行前重新校验 owner、页面存在性和 `canReadPage`。
- [ ] reader 工具集中没有 `update_page`；author 更新仍经过 `/api/mcp/v1`。
- [ ] chat 分支不触发任何 sandbox/Git/Diff/PR 收尾；work 分支回归测试不变。
- [ ] MCP client 在成功、工具失败和 abort 路径都关闭，active stream 都正确清理。

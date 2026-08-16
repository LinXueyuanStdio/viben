# Page Chat 对话数据链路：用户输入 → 首 token 流式

> 状态：2026-08-17
> 范围：`apps/web` + `packages/agent`
> 关联：[首 token 速度优化计划](./page-chat-ttft-optimization.md)

本文梳理 page chat 对话页面从"用户输入 query"到"首 token 流式出现"经过的完整数据链路，覆盖前端与后端，并标注每个环节的数据形态变化。

## 0. 总览

```
用户输入 query
  │
  ▼  ①前端：构建消息 → 发请求
ChatComposer (draft: text/images/attachments)
  → toMessagePayload → ChatMessagePayload
  → chatRuntime.sendMessage(payload)            [use-session-chat-runtime / ai-sdk useChat]
  → AbortableChatTransport POST /api/chat        [body: {sessionId, chatId, context, messages}]
  │
  ▼  ②后端 route：鉴权 → 持久化 → 启 workflow
app/api/chat/route.ts POST
  → 鉴权/反爬/归属校验 → 持久化消息
  → start(runAgentWorkflow, [...])               [durable workflow]
  → run.getReadable() → SSE 响应
  │
  ▼  ③workflow：模型运行时 → step 循环
app/workflows/chat.ts runAgentWorkflow
  → resolveChatModelRuntime (session+chat+preferences)
  → for 循环 → runPageAgentStep (每 step)
  │
  ▼  ④page agent step：context → MCP → stream
chat-page-runtime.ts runPageAgentStep
  → resolvePageChatContext ({page, bearerToken})
  → createPageMcpTools (MCP connect + subscribeResource)
  → pageAgent.stream({model, instructions, tools})
  │
  ▼  ⑤agent → gateway → LLM
packages/agent/chat-agent.ts chatAgent (ToolLoopAgent, stopWhen stepCountIs(1))
  → models.ts gateway() → Vercel AI Gateway → 上游 LLM
  │
  ▼  ⑥流式回传
LLM chunks → toUIMessageStream → writer.write → writable
  → run.getReadable() → SSE → useChat (75ms throttle)
  → ChatTranscript → MessageItem(memo) → LazyStreamdown → paint
```

## 1. 前端：用户输入 → 请求发出

### 1.1 页面入口

`apps/web/components/assistant/page-session-chat-content.tsx` 渲染 `SharedChatCore`（`mode="page"`），透传 `session`、`chat`、`initialMessages`（服务端预取的历史消息）、`modelOptions`。

### 1.2 消息构建

`shared-chat-core.tsx`：

- `SharedChatCoreWithRuntime`（:87）根据 `chat.modelId` 从 `modelOptions` 里查 `contextWindow`，得到 `contextLimit`，传给 `useSessionChatRuntime`。
- `SharedChatCoreView.handleSubmit`（:126）收到 `ChatComposerSubmit` 草稿后调用 `chatRuntime.sendMessage(toMessagePayload(draft))`。
- `toMessagePayload`（:73）用 `buildChatMessagePayload` 把草稿组装成 `ChatMessagePayload`：
  - `draft.text` → 文本
  - `draft.images` → `toFilePart`（:60）转成 `FileUIPart`（`{type:"file", filename, mediaType, url}`）
  - `draft.textAttachments` → 代码片段 part（`{id, filename, content, lineCount, byteSize}`）

### 1.3 运行时与 transport

`hooks/assistant/chat/use-session-chat-runtime.ts`：

- `useSessionChatRuntime`（:107）用 `useMemo` 创建 `AbortableChatTransport`（:130），配置：
  - `api: "/api/chat"`
  - `body: () => ({ sessionId, chatId, context: { contextLimit } })`（:132–144，`contextLimit` 经 ref 读取最新值）
  - `prepareReconnectToStreamRequest: ({ id }) => ({ api: \`/api/chat/${id}/stream\` })`（:146–148，断线重连用）
- `getOrCreateChatInstance(chatId, {...})`（:153）创建 chat 实例，`onData` 处理两类数据流 part（`data-workspace-status`、`data-page-content-changed`），`sendAutomaticallyWhen: shouldAutoSubmit`（工具全终态时自动续发下一步）。
- `useChat<WebAgentUIMessage>`（:215）绑定该实例，`experimental_throttle: 75`（:218），`resume` 依据 `initialChatActiveStreamId` 决定是否在挂载时恢复流。

`lib/abortable-chat-transport.ts`：`AbortableChatTransport extends WorkflowChatTransport`（`@workflow/ai`）。`prepareSendMessagesRequest`（:80–93）把 `sessionId/chatId/context` 与 `messages` 合并进请求 body，并在所有 fetch 上附加可中断的 `AbortSignal`。

### 1.4 发送动作（ai-sdk `useChat`）

`chatRuntime.sendMessage(payload)` 内部：
1. 把 user 消息 push 进 `messages` 状态，状态切到 `submitted`。
2. 经 `prepareSendMessagesRequest` 组装请求体，`fetch("POST /api/chat")`。

**请求体形态**（JSON）：

```json
{
  "sessionId": "<session id>",
  "chatId": "<chat id>",
  "context": { "contextLimit": 200000 },
  "messages": [ { "id", "role": "user"|"assistant", "parts": [...] } ]
}
```

其中 `messages` 是**完整历史消息数组**（前端内存中的 `WebAgentUIMessage[]`）。

## 2. 后端 route：请求到达 → workflow 启动

`apps/web/app/api/chat/route.ts` `POST`（:48）按序执行：

| 步骤 | 函数 | 说明 |
|---|---|---|
| 2.1 鉴权 | `requireAuthenticatedUser()`（:50） | `getServerSession` 带 `React.cache` 请求级缓存 |
| 2.2 反爬 | `checkBotProtection()`（:57） | |
| 2.3 解析 | `parseChatRequestBody`（:62） | 校验 body 结构 |
| 2.4 提取标识 | `requireChatIdentifiers`（:70） | 取 `sessionId`/`chatId` |
| 2.5 归属校验 | `requireOwnedSessionChat`（:77） | `getSessionById` + `getChatById` **并行**，校验 userId 归属 |
| 2.6 归档检查 | （:89） | `session.status === "archived"` 拒绝 |
| 2.7 试用校验 | `isManagedTemplateTrialUser`（:93） | 可选：`getChatMessageByIdForChat` + `countUserMessagesByUserId` |
| 2.8 活跃流 reconcile | `reconcileExistingActiveStream`（:115–134） | 若 `chat.activeStreamId` 已存在 → resume 或 409 |
| 2.9 持久化 | `Promise.all([persistLatestUserMessage, persistAssistantMessagesWithToolResults])`（:136） | 落库 user 消息 + 工具结果；`persistLatestUserMessage` 内还有 `touchChat`/`isFirstChatMessage`/`updateChat`（首条消息取标题） |
| 2.10 启动 workflow | `start(runAgentWorkflow, [{ messages, chatId, sessionId, userId, requestUrl, authSession, assistantId: generateId(), maxSteps: 500 }])`（:142） | **durable workflow**，入参含完整 `messages` |
| 2.11 幂等 claim | `claimChatActiveStreamId(chatId, run.runId)`（:158） | 失败则 cancel 本 run 并 409 |
| 2.12 返回流 | `createCancelableReadableStream(run.getReadable())` → `createUIMessageStreamResponse`（:174–183） | 响应头带 `x-workflow-run-id` |

**关键点**：`start()` 返回 `run` 后，`run.getReadable()` 是一个**由 workflow 内部 `writable` 驱动的 ReadableStream**。route 立即返回 `createUIMessageStreamResponse`（SSE），后续 chunk 由 workflow 异步写入、实时推到前端。

## 3. workflow：模型运行时解析 → step 循环

`apps/web/app/workflows/chat.ts` `runAgentWorkflow`（:606，`"use workflow"`）：

1. 取 `workflowRunId` 和 `writable`（:609–610）。
2. 并行启动三个准备任务（:623–633）：
   - `convertMessages(options.messages)`：把 UI 消息转成 `ModelMessage[]`
   - `persistInputMessages(chatId, messages)`
   - `resolveChatModelRuntime`（:147）
3. `claimActiveStream`（:642）在 workflow 内自我注册 runId 到 chat（防 route 侧 claim 丢失）。
4. `resolveChatModelRuntime`（:147）内部 `Promise.all([getSessionById, getChatById, getUserPreferences])`（:156–163），解析：
   - `modelVariants`（用户自定义模型变体）
   - `selectedModelId`（`chat.modelId`，默认 `APP_DEFAULT_MODEL_ID = "openai/gpt-5.4"`）
   - `mainModelSelection`（`resolveChatModelSelection`）
   - `subagentModelSelection`
   - `agentType`（来自 session）
5. `agentType === "work"` 才 `resolveChatSandboxRuntime`（:723–743）；**`agentType === "chat"`（page）跳过 sandbox**。
6. **for 循环（:745–824）**：`step` 从 0 到 `maxSteps`（500）：
   - `agentType === "chat"` → `runPageAgentStep({...})`（:757）；否则 `runAgentStep`。
   - 每步结束 push `stepTimings`，更新 `pendingAssistantResponse`、`originalMessagesForStep`、`modelMessages`。
   - `shouldContinue = finishReason === "tool-calls" && !shouldPauseForToolInteraction(...)`（:810–814）——只有"产出了 tool-call 且不需要用户交互"才继续下一步，否则 break。
   - **关键**：`chatAgent` 的 `stopWhen: stepCountIs(1)` 意味着单次 `stream()` 只跑 1 个 agent step；多步由这个 for 循环驱动，**每步都重新执行 `runPageAgentStep` 的全部准备**。

## 4. page agent step：context → MCP → stream

`apps/web/app/workflows/chat-page-runtime.ts` `runPageAgentStep`（:129，`"use step"`）：

1. `resolvePageChatContext({ sessionId, userId })`（:149）：
   - `db.query.sessions.findFirst`（`page-chat-context.ts:52`）——**再次查 session**（route 已查过一次）
   - 校验 `session.agentType === "chat"`、`publishedPageId` 存在
   - `Promise.all([publishedPages.findFirst, users.findFirst])`（:71–78）
   - `canReadPage` 权限校验
   - `encryptSession(...)`（JWE，:92）生成 `bearerToken`
   - 返回 `{ page: { publishedPageId, userSlug, pageSlug, title, canEdit, url }, bearerToken }`
2. `createPageMcpTools({ endpoint: /api/mcp/v1, bearerToken, page })`（:157）：
   - `new StreamableHTTPClientTransport` → `client.connect(transport)`（`page-mcp-tools.ts:88`，MCP `initialize` 往返）
   - `subscribeResource`（:65，`resources/subscribe` 往返）
   - 组装 `tools`：`get_page`（读页面，:101–114）；`canEdit` 时额外 `update_page`（:117–131）
   - 返回 `{ tools, close }`
3. `pageAgent.stream({ messages, options: { model, instructions: buildPageChatInstructions(page), tools: runtime.tools }, abortSignal })`（:199–207）。
4. `result.toUIMessageStream(...)`（:209）把 agent 输出转成 `UIMessageChunk`，`for await` 逐 part `writer.write(part)`（:251–253）。

**关键点**：`resolvePageChatContext` + `createPageMcpTools` 在 `pageAgent.stream()` **之前串行执行**，且因为 step 循环**每 step 重复**（多步 turn 下 F+G 成本 × N）。

## 5. agent → gateway → LLM

### 5.1 `chatAgent`（ToolLoopAgent）

`packages/agent/chat-agent.ts`：`app/config.ts` 里 `pageAgent = chatAgent`。

- `new ToolLoopAgent({ model: defaultModel, stopWhen: stepCountIs(1) })`（:65–80）。
- `prepareStep`（:71–78）对 `messages` 做 `addCacheControl`（prompt caching）。
- `prepareCall`（`prepareChatAgentCall`，:34）：
  - `gateway(mainSelection.id, { providerOptionsOverrides })`（:50）
  - `addCacheControl({ tools, model })`（:57）
  - `instructions` 来自 `buildPageChatInstructions(page)`。

### 5.2 `gateway()` → Vercel AI Gateway

`packages/agent/models.ts` `gateway(modelId)`（:173）：
1. `createGatewayInstance({ headers })`（`gateway-instance.ts`）→ `createGateway`（ai SDK），用 `AI_GATEWAY_API_KEY`/`AI_GATEWAY_URL`。
2. `instance(modelId)` 得到 `LanguageModel`。
3. `getProviderOptionsForModel(modelId)`（:113）注入 provider 默认项：
   - Claude：`thinking`（4.6/4.7 `adaptive`，老模型 `budgetTokens: 8000`）
   - GPT-5 系列：`reasoningSummary:"detailed"` + `include:["reasoning.encrypted_content"]`；部分模型（含默认 `gpt-5.4`）加 `textVerbosity:"low"`；`store:false`

上游模型通过 **Vercel AI Gateway** 访问（不是本地的 18790 Viben Gateway）。

## 6. 流式回传：SSE → 前端渲染

### 6.1 chunk 写出（服务端）

LLM 流式输出 → `ToolLoopAgent` → `toUIMessageStream` 产出 `UIMessageChunk`（如 `text-delta`、`reasoning-delta`、`tool-call`、`finish-step`）→ `writer.write(part)` 写入 workflow 的 `writable` → 经 `@workflow/core` 持久化/转播 → `run.getReadable()` → `createUIMessageStreamResponse` 以 SSE 形式流回前端。

### 6.2 前端消费与渲染

`WorkflowChatTransport` 消费 SSE chunk → 累积到 `useChat` 的 messages 状态（**75ms 节流**）→ `SharedChatCoreView` 重渲染 → `ChatTranscript` → `MessageItem`（`React.memo`）→ `LazyStreamdown`（`dynamic import("streamdown")`，`ssr:false`）解析 markdown → paint。

### 6.3 首 token 到达路径

- LLM 的首个 delta（对 Claude/gpt-5 通常是 **reasoning delta**）作为 chunk 先到达前端。
- 但 page 模式下 `ThinkingBlock` 折叠时 reasoning-group **`return null`**（不渲染），且 `showThinkingIndicator` 未传——所以**可见首 token 要等 text part（正文）**，中间隔着 reasoning 阶段。

## 7. 数据形态变化表

| # | 环节 | 形态 | 关键字段 |
|---|---|---|---|
| 1 | 用户输入 | `ChatComposerSubmit` | `text`、`images[]`、`textAttachments[]` |
| 2 | 消息构建 | `ChatMessagePayload` | `text`、`files: FileUIPart[]`、`textAttachments[]` |
| 3 | 发送 | `WebAgentUIMessage[]` | `{id, role, parts[]}` |
| 4 | 请求体 | JSON | `sessionId`、`chatId`、`context.contextLimit`、`messages` |
| 5 | workflow 入参 | `Options` | `messages`、`chatId`、`sessionId`、`userId`、`requestUrl`、`authSession`、`assistantId`、`maxSteps:500` |
| 6 | 模型消息 | `ModelMessage[]`（`convertMessages`） | 供 LLM 消费 |
| 7 | page context | `{page, bearerToken}` | `page: {publishedPageId, userSlug, pageSlug, title, canEdit, url}` |
| 8 | MCP 工具 | `{tools, close}` | `get_page`、（`update_page`） |
| 9 | agent stream | `options` | `model`、`instructions`、`tools` |
| 10 | LLM 模型 | `LanguageModel` | `modelId`（默认 `openai/gpt-5.4`） |
| 11 | 流式输出 | `UIMessageChunk` | `text-delta`/`reasoning-delta`/`tool-call`/`finish-step` |
| 12 | SSE 回传 | `ReadableStream<UIMessageChunk>` | 响应头 `x-workflow-run-id` |
| 13 | 前端状态 | `WebAgentUIMessage[]`（`useChat`） | 75ms 节流更新 |
| 14 | 渲染 | React 元素 | `MessageItem`(memo) → `LazyStreamdown` |

## 8. 关键文件索引

| 文件 | 职责 |
|---|---|
| `apps/web/components/assistant/page-session-chat-content.tsx` | page 模式入口，渲染 `SharedChatCore` |
| `apps/web/components/assistant/shared-chat-core.tsx` | `handleSubmit`、`toMessagePayload`、`ChatTranscript` 编排 |
| `apps/web/hooks/assistant/chat/use-session-chat-runtime.ts` | transport 创建、chat 实例、`useChat` 绑定 |
| `apps/web/lib/abortable-chat-transport.ts` | 可中断的 workflow transport，组装请求体 |
| `apps/web/app/api/chat/route.ts` | POST 入口：鉴权/持久化/启 workflow/返回 SSE |
| `apps/web/app/workflows/chat.ts` | `runAgentWorkflow`：模型运行时 + step 循环 |
| `apps/web/app/workflows/chat-page-runtime.ts` | `runPageAgentStep`：context/MCP/stream |
| `apps/web/lib/page-chat/page-chat-context.ts` | `resolvePageChatContext`：page 元数据 + JWE |
| `apps/web/lib/page-chat/page-mcp-tools.ts` | `createPageMcpTools`：MCP 建连 + 工具定义 |
| `packages/agent/chat-agent.ts` | `chatAgent`（`ToolLoopAgent`，`stopWhen: stepCountIs(1)`） |
| `packages/agent/models.ts` | `gateway()` + provider options（thinking/reasoning） |
| `packages/agent/gateway-instance.ts` | `createGateway`（Vercel AI Gateway） |

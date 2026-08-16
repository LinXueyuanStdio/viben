# Page Chat 首 token 速度优化

> 状态：待评审（2026-08-17 修订）
> 关联文档：[memo 优化可维护性重构](./page-chat-memo-refactor.md)
> 范围：`apps/web` + `packages/agent`

## 背景

本计划从**首 token 速度**角度，梳理 page chat 从"用户发送消息"到"首 token 出现在 UI"的完整链路，识别真正的延迟瓶颈，按 ROI 排序给出优化方向。

**量级说明**：下表中所有延迟量级均为**经验估算，需阶段 0 实测校准**。在基线数据建立前，不应据此直接排期投入。

## 0. 架构前提（已核实）

- `apps/web` 的 page chat 走 **Vercel AI Gateway**（`ai` SDK 的 `createGateway`），**不是** 18790 端口的 Viben Gateway。
  - `packages/agent/gateway-instance.ts` 用 `process.env.AI_GATEWAY_API_KEY` / `AI_GATEWAY_URL` 调 `createGateway(...)`。
  - `packages/agent/models.ts:173` 的 `gateway()` 就是 `createGatewayInstance({...})(modelId)`。
- 18790 的 Viben Gateway（`packages/core/src/gateway`）是 CLI/desktop 本地网关，与 web 的 LLM 调用链路无关。
- page chat **不经过 sandbox provisioning**（`connectSandbox` 仅在 `agentType === "work"` 的 `resolveChatSandboxRuntime` 里使用，`chat.ts:723`）。

## 1. 链路梳理

### 前端（用户点击发送 → 请求发出）

1. `components/assistant/page-session-chat-content.tsx` → `PageSessionChatContent` → `SharedChatCore`（mode="page"）。
2. `components/assistant/shared-chat-core.tsx`：`SharedChatCoreView`（:103）→ `handleSubmit`（:126）→ `chatRuntime.sendMessage(toMessagePayload(draft))`。
3. `hooks/assistant/chat/use-session-chat-runtime.ts`：`useSessionChatRuntime`（:107）→ `AbortableChatTransport`（:130，api=`/api/chat`）→ `useChat`（:215，`experimental_throttle: CHAT_UI_UPDATE_THROTTLE_MS = 75`）。
4. `lib/abortable-chat-transport.ts` → `AbortableChatTransport` 继承 `@workflow/ai` 的 `WorkflowChatTransport`，POST 到 `/api/chat` 并流式消费。

### 服务端（请求到达 → 首 chunk 写出）

5. `app/api/chat/route.ts` → `POST`（:48）：
   - `requireAuthenticatedUser`（`getServerSession` 有 `React.cache` 缓存）→ `checkBotProtection` → `parseChatRequestBody` → `requireChatIdentifiers`。
   - `requireOwnedSessionChat`（:77）：`getSessionById` + `getChatById` **并行** 2 次 DB 读。
   - managed-template 试用校验（可能再 `getChatMessageByIdForChat` + `countUserMessagesByUserId`）。
   - `Promise.all([persistLatestUserMessage, persistAssistantMessagesWithToolResults])`（:136）：DB 写（`persistLatestUserMessage` 内部还含 `touchChat`/`isFirstChatMessage`/`updateChat` 等多次写）。
   - `start(runAgentWorkflow, [{ messages, ... }])`（:142）启动 durable workflow（**注意：入参含完整 messages 数组**，见环节 D）。
   - `claimChatActiveStreamId`（:158）→ `createCancelableReadableStream`（:174）→ `createUIMessageStreamResponse`（:178）。
6. `app/workflows/chat.ts` → `runAgentWorkflow`（:606）：`Promise.all([convertMessages, persistInputMessages, resolveChatModelRuntime, claimActiveStream])`（:704）已并行；`resolveChatModelRuntime`（:147）做 `getSessionById + getChatById + getUserPreferences` 3 次 DB 读（**其中 session/chat 是重复读**，见机会 2）。
7. **step 循环**（`chat.ts:745`）：`runAgentWorkflow` 用一个 for 循环驱动 agent 多步执行，每步调用 `runPageAgentStep`（`chat.ts:757`）。由于 `chatAgent` 是 `stopWhen: stepCountIs(1)`（`packages/agent/chat-agent.ts:69`），一个需要 `get_page` 工具调用的问答通常是**多步 turn**（第 1 步 tool-call，第 2 步正文）。**关键：`runPageAgentStep` 每次被调用都会重新执行 context 解析 + 新建 MCP 连接 + JWE 加密**——F/G 环节是**按 step 重复支付**，不是每 turn 一次。
8. `app/workflows/chat-page-runtime.ts` → `runPageAgentStep`（:129）：
   - `resolvePageChatContext`（:149）：内部 `db.query.sessions.findFirst`（`page-chat-context.ts:52`，**重复读 session**）+ `publishedPages`/`users` 并行（:71–78）+ `encryptSession` JWE（:92）。
   - `createPageMcpTools`（:157）：`page-mcp-tools.ts:82` 新建 `StreamableHTTPClientTransport(/api/mcp/v1)` → `client.connect`（:88，MCP initialize 往返）+ `subscribeResource`（:65，resources/subscribe 往返）——**两次串行 HTTP 往返**。
   - `pageAgent.stream()`（:199）→ `chatAgent`。
9. `packages/agent/chat-agent.ts` → `chatAgent`（:65）：`ToolLoopAgent`，`stopWhen: stepCountIs(1)`。
10. `packages/agent/models.ts` → `gateway()`（:173）→ `createGateway`（Vercel AI Gateway）→ 上游模型。`getProviderOptionsForModel`（:113）注入默认项：Claude 加 `thinking`（4.6/4.7 用 `adaptive`，老模型 `budgetTokens: 8000`，:19–30）；GPT-5 系列加 `reasoningSummary:"detailed"` + `include:["reasoning.encrypted_content"]`（:136–143），其中 `textVerbosity:"low"` 仅对 `shouldApplyOpenAITextVerbosityDefaults` 命中的模型（含默认模型 `openai/gpt-5.4`）注入（:146–152）。
11. 流回传：`toUIMessageStream`（chat-page-runtime.ts:209）写 chunk → SSE → 前端 `useChat`。

### 前端（首 chunk 到达 → 可见）

12. `useChat` 收到 chunk → 75ms 节流 → `messages` 更新 → `ChatTranscript` → `MessageItem`（memo）→ `LazyStreamdown`（`dynamic import("streamdown")`, `ssr:false`）→ markdown 解析 → paint。
13. **reasoning 阶段 page chat 完全空白**：`ThinkingBlock` 折叠时 reasoning-group 直接 `return null`（`chat-transcript.tsx:428`），"Thinking…" 指示器来自 `ChatTranscript` 的 `showThinkingIndicator`（:850），但 page 模式的 `shared-chat-core.tsx` **未传该 prop**（只有 work 模式经 `transcriptProps` 覆盖传入）。

## 2. 首 token 延迟分解

> 量级为估算，待阶段 0 实测。

| # | 环节 | 代码位置 | 估算量级 | 是否主导 |
|---|---|---|---|---|
| A | submit → 网络 + Next 路由/服务端冷启动 | route.ts:48 | 50–300ms | 中 |
| B | 鉴权/归属/试用校验 DB 读 | route.ts:77–110 | 10–50ms（已并行） | 低 |
| C | 持久化消息（多次写） | route.ts:136 | 10–50ms | 低 |
| D1 | durable `start()` **参数序列化 + 加密 + 入队** | route.ts:142 / `@workflow/core` start.js | 随 messages 大小线性增长 | 中高 |
| D2 | worker 反序列化/解密 + workflow 冷启动 | `@workflow/core` worker | 首次 100–400ms | 中 |
| E | model runtime 解析（3 读 + 变体解析） | chat.ts:147 | 10–50ms | 低 |
| F | `resolvePageChatContext`（重复读 session + page + user + JWE）**按 step 重复** | page-chat-context.ts:52 | 20–80ms/step | 中 |
| G | `createPageMcpTools`（MCP connect + subscribeResource 两次串行往返）**按 step 重复** | page-mcp-tools.ts:88/65 | 100–500ms/step | 中高 |
| H | `gateway()` 模型选择/包装 | models.ts:173 | <1ms | 低 |
| I | Vercel AI Gateway → 上游 LLM：建连 + prefill + 推理 | gateway-instance.ts / 上游 | 数秒～数十秒 | **主导** |
| J | reasoning/thinking 阶段（page 模式不可见） | thinking-block.tsx / models.ts:19 | 数秒～数十秒 | **主导（感知层）** |
| K | 前端 75ms 节流 + `LazyStreamdown` 首次 import | use-session-chat-runtime.ts / lazy-streamdown.tsx | 75ms 固定 + 首次 100–300ms | 低中 |

**结论**：主导项是 **I + J**（大模型 prefill/reasoning），其次是 **G（MCP 串行建连，且按 step 重复）** 和 **D1/D2（durable workflow 序列化 + 冷启动）**，再是 F/E 的重复 DB 读。

## 3. 现有 memo 改动的评估

工作区/已提交的 `cb53cb362` 涉及 `chat-transcript.tsx`（`MessageItem` + `React.memo`）、`session-chat-content.tsx`（6 个 `useCallback`）、`thinking-block.tsx`/`tool-call.tsx`（`memo`）、`use-session-chat-runtime.ts`（ref 存方法）。

**结论：这些改动优化的是"流式过程中每 chunk 的重渲染成本 / 长流卡顿"，对服务端首 token 延迟（A–I 环节）无贡献。** 其对首 token 的唯一潜在影响在 K 段（首 chunk 到达后的 paint）——长历史场景下，若历史消息整批重渲染阻塞主线程，会推迟首 token 的可见，此时 memo 有间接贡献。因此"与首 token 完全无关"的旧表述不准确，准确表述是"**不减少服务端延迟，仅在长历史下间接改善首 token paint**"。

**memo 失效缺陷（影响范围修正）**：`shared-chat-core.tsx:144` 写死 `onCopyMessage={() => undefined}`（无条件，不分 mode），work 模式又额外有 `onRetryMessage={() => runtime.retryChatStream()}`（:145–146）内联箭头。work 模式的 `transcriptProps` 覆盖了 `onRetryMessage/onDeleteMessage/onApproveTool/onDenyTool`，但**没有覆盖 `onCopyMessage`**。因此 `memo(MessageItem)` 浅比较在 **page 和 work 两个模式都会因 `onCopyMessage` 变化而失效**——不是"work 反而受益"。修复见[可维护性重构 Step 2](./page-chat-memo-refactor.md)（删死 prop + 修 `OpenFileProvider` 内联空函数）。

## 4. 真正的优化机会（按 ROI 排序）

### 机会 1（ROI 最高，纯前端，低风险）：消除"发送→首 token"之间的空白等待

page chat 在 `sendMessage` 之后、首 token 到达之前**完全空白**（reasoning 折叠 `return null`，且 `showThinkingIndicator` 未传）。大模型 prefill 本身要几秒，用户面对的是"白等"。

- 在 `SharedChatCoreView` 里当 `status ∈ {submitted, streaming}` 且末条为 user 时渲染骨架屏/"思考中"指示器。**注意**：page 模式当前未接 `showThinkingIndicator`，这是**新增接线**而非"复用现有"。
- 让 `ThinkingBlock` 在 streaming 时也显示已耗时秒数（目前 `summary` 仅在 `!isStreaming` 才渲染 `elapsed`，thinking-block.tsx:84–87）。

收益：消除空白感知（"感知延迟降 50%"仅为粗略估算，需阶段 0 用空白时长/总时长实测校准）。

### 机会 2（ROI 高，服务端，中风险）：压缩 LLM 调用前的串行准备，并把 context/MCP 从 per-step 提升到 per-turn

- **去重 DB 读**：route 已读 `session`/`chat`，但 workflow 里 `resolveChatModelRuntime`（chat.ts:157–159）又读 session+chat+preferences，`resolvePageChatContext`（page-chat-context.ts:52）又查 `sessions` 表。可把 session/chat/preferences/page context 作为 workflow input 从 route 传入，workflow 内不再重复查。
- **MCP 建连延迟**：`createPageMcpTools` 的 `client.connect` + `subscribeResource` 是两次串行往返，且因 step 循环**每 step 重建**。方向：a) 把 MCP 连接提升到 workflow 级别（每 turn 一次），或改为 `get_page` 工具 execute 内部的懒连接（工具定义不需要活连接）；b) page-session 级连接预热/复用。
- **page 元数据缓存**：`resolvePageChatContext` 的 page 元数据（title/slug/authorSlug/id）高度可缓存，`apps/web/CLAUDE.md` 已约定 `unstable_cache` + `page-ctx-{userSlug}-{pageId}` 标签与 timestamp-key 模式，可直接复用。

收益：砍掉 F+G 的重复支付（多步 turn 下收益成倍）。

### 机会 3（ROI 高，产品决策）：按 agent 类型收敛 reasoning/thinking 预算

page chat 是"页面问答"轻量 agent，却复用了默认带扩展思考的模型配置（Claude `thinking: adaptive / budgetTokens 8000`，GPT-5 `reasoningSummary:"detailed"`），而这些 reasoning 在 page 模式下**不可见**（折叠 return null）→ 直接拉长"首可见 token"。

方向：`chatAgent`（page）与 `vibenAgent`（work）的 thinking 配置**分开**——page 关掉/大幅降低 thinking 预算，或提供会话级"快速模式"开关；work 保留。

**待拍板（产品决策，文档当前未解决）**：关/降 thinking 对 page 问答准确率的实际损失、哪些 query 仍需 reasoning、是否需要 query 分级、"快速模式"默认开还是关。需在阶段 0 用真实模型确认"首可见 token 是 text、reasoning 还是 tool-call"（GPT-5.4 的 `reasoningSummary` 是明文摘要，映射为 reasoning part 还是 text part 未验证），再定量预期收益。

### 机会 4（ROI 中，前端）：首 chunk 的渲染快路径

- **预热 `streamdown`**：`LazyStreamdown` 是 `dynamic(...,{ssr:false})`，首次渲染才加载。可在 `handleSubmit` 时 `import("streamdown")` 预热。
- **首 chunk 降节流**：`experimental_throttle: 75` 对首 chunk 也生效，固定多等 ≤75ms。评估首个 chunk 用更小节流。

收益：首 token 到达后更快 paint（首次 100–300ms，之后 75ms 固定）。

### 机会 5（ROI 中，服务端，比"懒连接"更彻底）：服务端直接注入 page 内容，绕过 MCP

既然 page HTML 已按 `CLAUDE.md` 用 `unstable_cache` + timestamp key 缓存，服务端可以直接读 page 内容：a) 注入 system prompt（context injection），或 b) 预取 `get_page` 结果。这省掉 MCP connect + subscribe + callTool 的整个往返，甚至可能减少一个 agent step。

### 机会 6（ROI 中，服务端）：`start()` 参数瘦身

workflow input 传了完整 `messages`（历史 + 文件 + 附件），而 route 已把消息落库。D1 的序列化+加密成本正比于该 payload。评估只传最小必要 input（或消息引用/偏移），把重量级序列化移出首 token 关键路径。

### 机会 7（ROI 低中，正确性修复）：修复 memo 失效 + 补全页面态反馈

对应[可维护性重构 Step 2/Step 5](./page-chat-memo-refactor.md)：删 `onCopyMessage` 死 prop、修 `OpenFileProvider` 内联空函数、稳定化传给 `ChatTranscript` 的 props，让 `memo(MessageItem)` 在 page 路径真正生效。与首 token 无直接关系，但属于把已投入的改动做对。

### 机会 8（先导性，ROI 高但需先做）：测量基建

代码已写入 `stepTimings`/`totalDurationMs`（`workflow-runs` 表），响应头已带 `x-workflow-run-id`。在此之上补：

- 各环节 Server-Timing 头（auth/ownership/persist/workflow-start/context/mcp/llm-ttft）。
- **D 环节的拆分测量**：`start()` 内部在 `node_modules`，无法直接打点。用 `performance.now()` 包住 `route.ts:142` 的 `await start(...)`，再用 workflow 内首个 step 的 `stepStartedAt` 时间戳间接拆出"队列调度 + worker 反序列化"延迟。
- 前端打点 `sendMessage` → 首 chunk → paint。

收益：让机会 2/3/4 的收益可量化，避免凭感觉优化。

## 5. 分阶段优化计划

> 统一验证：`cd apps/web && npx vitest run`（确保不回归）+ page chat 手动交互对比首 token 延迟；服务端用 `workflow-runs.step_timings` 与新增 Server-Timing 头量化。

### 阶段 0：测量（先立基线，必须最先做）

1. `route.ts:POST` 各阶段与 `chat-page-runtime.ts:runPageAgentStep` 插入 Server-Timing / trace 打点；用 `performance.now()` 包住 `route.ts:142` 的 `await start(...)` 拆分 D1/D2。
2. 前端 `SharedChatCoreView.handleSubmit` 记录 `performance.now()`，首 chunk 到达时算 TTFB、TTFT。
3. 输出基线表，**回填本文第 2 节的量级估算**，定位主导项是 I+J 还是 G/D。

### 阶段 1：感知层快赢（纯前端，先落地）

1. `shared-chat-core.tsx`：`status` 为 submitted/streaming 且末条为 user 时渲染骨架/思考指示器（新增接线 `showThinkingIndicator`）。
2. `thinking-block.tsx`：streaming 时也显示 `elapsed` 秒数。
3. 顺手修 `onCopyMessage={() => undefined}`（对应可维护性重构 Step 2）。

### 阶段 2：服务端关键路径压缩

1. `chat.ts`/`route.ts`：session/chat/preferences/page context 从 route 传入 `runAgentWorkflow` input，删 workflow 内重复读。
2. `page-mcp-tools.ts`：MCP 连接提升到 workflow 级别（每 turn 一次）或改懒连接；`resolvePageChatContext` 的 page 元数据走 `unstable_cache`。

### 阶段 3：模型/推理预算收敛（需产品拍板）

1. `models.ts`：给 `gateway()`/`getProviderOptionsForModel` 增加 per-agent 的 thinking 开关；`chat-agent.ts` 对 page agent 关闭/降低 thinking。
2. 会话级可选：composer 暴露"快速模式"。

### 阶段 4：前端首 chunk 快路径

1. `lazy-streamdown.tsx` / `shared-chat-core.tsx`：submit 时预热 `streamdown` 模块。
2. `use-session-chat-runtime.ts`：评估首 chunk 用更小节流（如首帧 0–16ms）。

### 阶段 5：把已投入的 memo 改对（收尾）

1. 完成[可维护性重构](./page-chat-memo-refactor.md)全部 Step，并处理 retry/delete 回调依赖 `messages` 的深层击穿（见该文档 1.5）。

## 关键文件清单

- `apps/web/app/workflows/chat.ts`（step 循环 + 重复 DB 读 + `runAgentWorkflow`）
- `apps/web/app/workflows/chat-page-runtime.ts`（per-step 重复准备与 `pageAgent.stream()`）
- `apps/web/lib/page-chat/page-mcp-tools.ts`（MCP 建连串行延迟）
- `apps/web/lib/page-chat/page-chat-context.ts`（page context 重复读 + JWE）
- `apps/web/components/assistant/shared-chat-core.tsx`（页面态空白 + `onCopyMessage` 内联缺陷）
- `apps/web/app/api/chat/route.ts`（测量打点与 context 透传入口 + `start()` 序列化）
- `packages/agent/models.ts`（reasoning/thinking 预算）
- `packages/agent/chat-agent.ts`（`stopWhen: stepCountIs(1)`）

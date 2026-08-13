# Page Chat Agent 实现后 Review

日期：2026-08-13

## 背景

本 Review 基于两个只读子任务的结果：

1. 调研当前 Page Chat 实现，核对阅读页入口、`/assistant` 页面、session 生命周期、workflow/MCP runtime、Preview、刷新事件、i18n 和测试覆盖。
2. 调研既有 Page Chat 设计与计划，核对 `docs/superpowers/specs/2026-08-10-page-chat-agent-design.md` 与 `docs/superpowers/plans/2026-08-10-page-chat-agent*` 中的关键验收要求。

本文件记录实现与计划之间的缺口、潜在 bug、用户体验问题，以及后续 brainstorming 的输入。此文件不是新的实现计划；真正修改代码前应再形成独立 plan。

## 结论概览

Page Chat 的主链路已经具备：

- 已登录用户在阅读页看到 Assistant tab，未登录用户不显示入口。
- Drawer 内 Page Chat 懒加载，首次打开后创建或恢复 Page session。
- `/assistant/{session}/chats/{chat}` 能按 `agentType === "chat"` 渲染 Page Chat，而不是工作区 UI。
- Page Chat session 使用 `agentType: "chat"`，不创建 workspace sandbox，不走 Git/Diff/Files/PR 等 work-only 能力。
- Page agent 通过服务端 JWE 身份连接 `/api/mcp/v1`，工具由服务端锁定到当前页面。
- Preview API 会校验 session 所有者与当前页面阅读权限。
- 已有一批单元测试和 integration test 覆盖主流程。

但当前还不能视为完成，原因集中在三类：

1. **安全边界不完整**：通用 MCP `get_page` 存在越权读取风险；`can_edit` 与 `update_page` 实际授权口径不一致。
2. **真实链路不闭合**：真实 MCP `update_page` 输出 shape 与 `ChatTranscript` 的刷新识别逻辑不匹配，可能导致更新后阅读页和 Preview 不刷新。
3. **体验与验收有缺口**：错误文案、Retry、i18n、撤权/删除页面状态，以及测试对真实工具输出和权限矩阵覆盖不足。
4. **抽取重构有回归风险**：`ChatTranscript` 抽取后 Work Chat 主行为大体保住，但 `SharedChatCore` 与 Page Chat 接入遗漏了刷新、滚动、错误展示和 Page 模式 action 语义。

## ChatTranscript 抽取专项审查

本轮追加一个只读子任务，专门检查 `ChatTranscript` 从 Work Chat 抽出后是否丢失行为。结论是：抽取本身没有明显删掉 Work Chat 的核心渲染能力，但 Page Chat 接入和 SharedChatCore 包装层有中高风险。

### 高风险

**真实 Page Chat 更新后不会触发刷新**

`ChatTranscript` 只有在传入 `onPageContentChanged` 时才扫描 tool output 并派发页面刷新事件；真实入口 `PageAssistantPanel` 与 `PageSessionChatContent` 都通过 `SharedChatCore` 使用 transcript，未传该 prop。已有集成测试直接 render `ChatTranscript` 并手动传 no-op callback，没有覆盖真实 Page Chat 链路。

建议：刷新链路迁移到 MCP notification -> stream data part -> browser event bus，且集成测试必须走真实 Page Chat 入口，不再依赖 direct render `ChatTranscript`。

**SharedChatCore 可能破坏 transcript 滚动高度**

`SharedChatCore` 外层 wrapper 是 `min-h-0 flex-1`，但不是 flex container；`ChatTranscript` 根节点依赖 `flex-1`，内部滚动层依赖 `h-full overflow-y-auto`。如果父层不是稳定 flex column，Work Chat 或 Page Chat 长对话可能出现滚动异常。

建议：wrapper 改为稳定的 flex column 容器，并补长消息/长对话布局测试。

### 中风险

**Page Chat 显示语义不准确的 message-level resend**

`SharedChatCore` 默认传 `onRetryMessage={() => runtime.retryChatStream()}`，导致 Page Chat 用户消息上出现 Work Chat 风格 resend 按钮。但这个行为不是“重发该消息”，而是 retry 当前 stream。

建议：Page 模式默认隐藏 message-level resend，除非实现真正按消息重发。

**Page Chat runtime error 不明显**

`SharedChatCore` 传入了 `error`，但 `ChatTranscript` 当前没有解构或渲染该 error。Work Chat 外层仍有旧错误 banner，Page Chat 只有 session/snapshot load error，流式运行错误可能不可见。

建议：Page Chat 入口补 runtime error 展示，并避免 workspace/sandbox 文案。

**抽取前残留计算没有清理**

`session-chat-content.tsx` 在 `SharedChatCore` 接管渲染后仍保留旧 transcript 分组、scroll/copy state 和 helper/import。长对话 streaming 时会重复计算未使用结构。

建议：在 hardening 实现中清理残留，并用测试覆盖 Work Chat 行为不回归。

### 低风险

**assistant copy 行为有细微变化**

抽取前 copy 更接近复制当前最终 text part；抽取后可能拼接整条 assistant message 的所有 text parts。多 text part assistant message 需要明确产品期望。

建议：二选一锁定行为并补测试。

**测试隔离过度**

`shared-chat-core.test.tsx` mock 掉 `ChatTranscript`，`page-assistant-panel.test.tsx` mock 掉 `SharedChatCore`，而 Page Chat 集成测试又直接 render `ChatTranscript`。这些测试组合挡不住真实入口的丢失 callback、滚动 wrapper 或 Page 模式操作显示问题。

建议：补真实链路测试，至少覆盖 `PageAssistantPanel -> SharedChatCore -> useSessionChatRuntime -> page event bus -> iframe refresh`。

## 已实现能力

### 阅读页入口

- `ReadPageClient` 仅在存在 `sessionUserId` 时注入 Assistant tab。
- `ReadDrawer` 懒加载 `PageAssistantPanel`，并传入页面身份信息。
- 阅读正文 iframe 继续使用浏览器 sandbox；这与 Page Chat 后端“不创建 workspace sandbox”不是同一个概念。
- 阅读页监听 `viben:page-content-changed`，并在当前 `publishedPageId/pageDbId` 匹配时调用 `router.refresh()`。

### Page Chat 面板

- `PageAssistantPanel` 启动时 POST `/api/page-sessions`，body 使用 snake_case：`user_slug`、`page_slug`。
- 面板支持恢复 session/chat、拉取 chat snapshot、切换历史 chat、新建 chat、打开完整对话。
- 空状态建议按 `can_edit` 区分作者和读者。
- `SharedChatCore` 在 page 模式下复用 transcript/composer，但不传 work extensions。

### Session 与 workflow

- `/api/page-sessions` 要求登录、bot protection、限流和 body 校验。
- `getOrCreatePageSession` 在创建前检查 `getPublishedPageContext + canReadPage`。
- Page Chat session 使用 `agentType: "chat"`，`sandboxState/lifecycleState` 为 `null`。
- `/api/chat` 继续复用通用发送入口，并用 `activeStreamId` 避免重复 workflow。
- workflow 按 `agentType` 分流：`work` 走 sandbox runtime；`chat` 走 `runPageAgentStep`。

### MCP 与 Preview

- Page Chat 的 `get_page` 和 `update_page` 工具由 `createPageMcpTools` 包装，模型不能覆盖页面 uid。
- 读者只拿到 `get_page`；可编辑用户会拿到 `update_page`。
- Page agent 每次运行前重新解析页面上下文与权限。
- Preview 只在打开后订阅刷新事件，并通过 Preview API 获取最新 HTML。
- Preview API 校验当前用户拥有 session，且 session 是 `agentType === "chat"` 并绑定 `publishedPageId`。

## 高优先级问题

### P0：通用 MCP `get_page` 可能越权读取页面

**现象**

`/api/mcp/v1` 的 `get_page` 只按 `author_slug + page_uid` 查询 `publishedPages` 并返回完整 HTML、元数据和作者信息。外层 `withMcpAuth` 配置为 `required: false`，意味着该 MCP endpoint 允许无 bearer token 的调用进入工具层。

**证据**

- `apps/web/app/api/mcp/v1/route.ts:129` 定义 `get_page`。
- `apps/web/app/api/mcp/v1/route.ts:137` 直接查询 `publishedPages`。
- `apps/web/app/api/mcp/v1/route.ts:143` 返回页面 HTML。
- `apps/web/app/api/mcp/v1/route.ts:353` 使用 `withMcpAuth(..., { required: false })`。

**影响**

只要知道 `author_slug` 和 `page_uid`，调用方可能读取不应公开的页面内容。风险范围取决于 `publishedPages` 中 private、unlisted、审核状态页面是否也可被该查询命中。即使 Page Chat 自身在 session 创建和 agent runtime 中校验了 `canReadPage`，通用 MCP 工具仍然绕过了这一层。

**建议**

- 在 `get_page` 中复用页面阅读权限规则。
- 匿名调用只允许读取 public 且审核通过的页面。
- 登录或 JWE bearer 调用应构造 auth session 后执行 `canReadPage(page, session)`。
- 不可读和不存在页面统一返回 “Page not found”，避免泄露页面存在性。
- 增加 route 级测试：匿名读取 private/unlisted/moderated 页面失败；有权限用户读取成功；无权限用户失败。

### P1：`can_edit` 与 MCP `update_page` 授权口径不一致

**现象**

Page Chat context 中，`findEditablePage` 命中的团队或协作者会被视为 `can_edit`。但 MCP `update_page` 实际只允许 `publishedPages.userId === session.userId` 的作者更新。

**证据**

- `apps/web/lib/page-chat/page-chat-context.ts:90` 调用 `findEditablePage`。
- `apps/web/lib/page-chat/page-chat-context.ts:93` 将 `editablePage?.id === page.id` 纳入 `canEdit`。
- `apps/web/lib/page-chat/page-mcp-tools.ts:69` 在 `input.page.canEdit` 为 true 时暴露 `update_page`。
- `apps/web/app/api/mcp/v1/route.ts:273` 只按 `publishedPages.userId === session.userId` 查找可更新页面。

**影响**

协作者或团队编辑者在 UI 和 prompt 中会被告知可以更新页面，模型也会拿到 `update_page` 工具，但实际调用失败。这会造成用户误解，也会让 agent 反复尝试不可用工具。

**建议**

先决定产品口径：

- 如果 Page Chat 只允许作者改页，则 `can_edit` 也必须只等于 `page.userId === userId`，协作者只保留读者能力。
- 如果协作者也应能改页，则 `/api/mcp/v1 update_page` 必须复用 `findEditablePage`，并确保版本记录、通知、cache tag、author slug 等字段按被编辑页面的真实作者和权限模型处理。

建议优先采用“短期只作者可写”的口径，修复小、风险低；之后如果产品需要协作编辑，再单独设计协作者写入语义。

### P1：真实 `update_page` 输出无法触发页面刷新

**现象**

`ChatTranscript` 识别 `update_page` 成功后才派发 `PAGE_CONTENT_CHANGED_EVENT`。它当前要求 tool output 解析后包含：

- `success: true`
- `published_page_id`
- `chat_id`

但真实 MCP `update_page` 返回的是 MCP 标准结果：`{ content: [{ type: "text", text: JSON.stringify({ success, page_uid, url, read_url, updated }) }] }`。其中没有 `published_page_id` 和 `chat_id`，且真正业务 JSON 包在 `content[0].text` 内。

**证据**

- `apps/web/components/assistant/chat-transcript.tsx:195` 解析 tool output。
- `apps/web/components/assistant/chat-transcript.tsx:200` 要求 `published_page_id`。
- `apps/web/components/assistant/chat-transcript.tsx:206` 要求 `chat_id`。
- `apps/web/app/api/mcp/v1/route.ts:326` 返回 MCP content wrapper。
- `apps/web/app/api/mcp/v1/route.ts:330` 返回 `success` 和 `page_uid`，但没有 `published_page_id/chat_id`。
- `apps/web/integration/page-chat-agent.test.ts:687` 附近的测试使用手写理想 output，未覆盖真实 MCP shape。

**影响**

作者通过 Page Chat 更新页面后，数据库和 cache tag 可能已更新，但阅读页 Drawer 与 Assistant Preview 可能不会收到同步事件。用户会看到“更新成功”但右侧预览或原阅读页仍是旧内容，必须手动刷新。

**建议**

可选修复方向：

1. 在 Page Chat MCP wrapper 层把真实 MCP result 规范化为 transcript 可识别的 app-level output，附加 `published_page_id` 和 `chat_id`。
2. 在 `ChatTranscript` 中兼容 MCP result wrapper，解析 `content[0].text`，并从当前 Page Chat context 补齐 stable page id 和 chat id。
3. 修改 `/api/mcp/v1 update_page` 返回内容，额外包含 `published_page_id`；`chat_id` 仍不适合由通用 MCP route 感知，需由 Page Chat runtime 或 UI context 补齐。

建议采用方向 1：由 Page Chat 专属 wrapper 负责把通用 MCP 协议结果转换成 Page Chat UI 需要的结果，避免污染通用 MCP route。

## 中优先级问题

### P2：Chat snapshot Retry 是 no-op

**现象**

内嵌面板加载 chat snapshot 失败时，Retry 只执行 `setActiveChatId(currentChat.id)`。如果 active chat id 没变，hook 通常不会重新 fetch。

**证据**

- `apps/web/components/pages/page-assistant-panel.tsx:352`

**影响**

用户点击 Retry 可能没有任何网络请求和状态变化，只能关闭重开或刷新页面。

**建议**

- 让 `useChatSnapshot` 暴露 `retry/refetch`。
- 或给 snapshot request 增加显式 `reloadNonce`。
- Error UI 的 Retry 应直接调用 refetch，而不是依赖 state 变化副作用。

### P2：新建 chat 持久化失败没有明确处理

**现象**

`handleCreateChat` 乐观创建本地 chat 后调用 `result.persisted.then(...)`，但没有 catch。

**证据**

- `apps/web/components/pages/page-assistant-panel.tsx:315`
- `apps/web/hooks/assistant/use-session-chats.ts:525`

**影响**

如果创建 chat 的请求失败，用户可能看到一个本地临时 chat，随后没有明确错误反馈；也可能出现未处理 Promise rejection。

**建议**

- 捕获 `persisted` 失败，移除或标记临时 chat。
- 显示可重试错误。
- 禁止在持久化失败的临时 chat 中继续发送消息，除非有明确离线队列设计。

### P2：API 错误可能显示原始 JSON

**现象**

`usePageSession` 对非 2xx 直接 `response.text()`，UI 可能显示 `{"error":"Page not found"}` 这样的原始 JSON。

**证据**

- `apps/web/hooks/assistant/use-page-session.ts:43`

**影响**

错误文案不符合产品语境，也不利于本地化。

**建议**

- 优先尝试解析 JSON `{ error, code }`。
- 将已知 code 映射到 `assistant.pageChat.*` i18n 文案。
- 未知错误使用通用恢复失败文案，并保留 console/debug 信息。

### P2：页面撤权/删除后的工作流错误文案不适配 Page Chat

**现象**

Page agent runtime 能抛出 `Page unavailable`，但 workflow 空响应或初始化失败时可能落到通用 `Workspace setup failed`。

**证据**

- `apps/web/app/workflows/chat.ts:285`
- `apps/web/app/workflows/chat.ts:992`

**影响**

Page Chat 用户看到 “Workspace setup failed” 会误以为系统在创建工作区，违反“Page Chat 无 sandbox/workspace”的产品认知。

**建议**

- workflow 错误映射按 `agentType` 区分。
- `chat` session 使用 `assistant.pageChat.pageUnavailable` 或 “This page is no longer available to this chat”。
- 保留历史消息，但禁用 Preview 和后续工具调用。

### P2：Page Chat i18n 仍有硬编码英文

**现象**

完整 Page Chat composer placeholder、`ChatComposer` page 默认 placeholder、后端默认 chat title 仍有英文硬编码。

**证据**

- `apps/web/components/assistant/page-session-chat-content.tsx:48`
- `apps/web/components/assistant/chat-composer.tsx:96`
- `apps/web/lib/page-chat/page-session-service.ts:136`

**影响**

非英文 locale 下 Page Chat 仍会出现英文，且后端生成的 chat title 无法跟随用户语言。

**建议**

- UI placeholder 全部使用 `assistant.pageChat.placeholder`。
- chat 默认 title 不应由后端写入固定英文；可以写入稳定 machine title，再由前端显示时本地化，或在创建请求中传入 locale 后由服务端选择文案。
- 增加 locale key parity 测试，并扫描 Page Chat 相关组件的硬编码英文。

### P2：页面身份命名容易混淆

**现象**

阅读页和 Page Chat 之间存在 `pageId/pageUid/pageSlug/pageDbId/publishedPageId` 多套名字。当前 Assistant tab 实际把 `pageUid` 作为 `pageSlug` 传递。

**证据**

- `apps/web/components/pages/read-page-client.tsx:302`

**影响**

现在可能可以工作，但后续 slug rename、stable published page id、URL slug 与 uid 分离时容易引入回归。

**建议**

- 类型层区分：
  - `publishedPageId`：数据库稳定 ID。
  - `pageUid`：页面稳定 uid，用于 MCP `uid/page_uid`。
  - `urlPageSlug`：路由中展示或查找用 slug。
- Page Chat API body 和内部类型使用一致命名，避免 `pageSlug` 承载 uid 语义。

## Spec 与验收缺口

### 真实 MCP 输出没有进入验收

当前 plan 已要求 MCP 更新后刷新 Preview，但测试实现绕过了真实 MCP result shape。验收应明确：

- integration test 必须使用真实 `callScopedTool -> /api/mcp/v1 update_page` 返回值。
- `ChatTranscript` 或 wrapper 必须处理真实 MCP wrapper。
- 更新成功后阅读页和 Preview 均刷新。

### MCP 通用权限矩阵没有写够

设计强调 Page Chat 创建前和运行前要校验权限，但通用 `/api/mcp/v1 get_page` 是另一个入口，也必须纳入安全验收。

建议增加矩阵：

| 调用方 | public approved | unlisted | private | rejected/moderated |
| --- | --- | --- | --- | --- |
| 匿名 MCP | 可读或按产品决定 | 不可读或按产品决定 | 不可读 | 不可读 |
| 登录无权限用户 | 可读 public | 按 `canReadPage` | 不可读 | 不可读 |
| 页面作者 | 可读 | 可读 | 可读 | 按作者可见规则 |
| 协作者 | 按协作权限 | 按协作权限 | 按协作权限 | 按审核规则 |

### `update_page` 作者与协作者语义没有统一

Spec 写“作者可以通过 MCP 请求更新当前页面”，实现里 `can_edit` 又纳入协作者。验收必须明确：

- Page Chat 第一阶段是否只支持作者更新。
- 协作者是否能看到编辑建议和 `update_page` 工具。
- 通用 MCP `update_page` 是否支持协作者。

### 页面撤权/删除体验没有被 UI 验收锁住

Spec 要求“保留聊天；禁用 Preview 和工具并显示页面不可用”，但当前风险是落到通用 workspace 文案。验收应覆盖：

- 已创建 Page session 后页面删除。
- 已创建 Page session 后页面改 private 且当前用户失去权限。
- 历史消息仍可打开。
- Preview 返回不可用状态。
- 再次发送消息显示 Page Chat 专属错误。

### “无 sandbox”验收应覆盖请求层和文案层

当前实现大体不走 workspace sandbox，但验收不应只看后端函数调用。还应确认：

- Page Chat UI 不请求 sandbox lifecycle、files、skills、todos、git、diff API。
- Page Chat 错误文案不出现 workspace/sandbox。
- Page Chat session 不显示 work controls。
- 后端 workflow 对 `agentType === "chat"` 不创建、连接、恢复或持久化 sandbox。

## 用户体验问题

1. **错误信息太底层**：原始 JSON 和 “Workspace setup failed” 都不符合 Page Chat 用户心智。
2. **Retry 不可靠**：点击后可能无请求，用户无法判断系统是否在重试。
3. **更新反馈不闭环**：如果真实 `update_page` 不触发刷新，用户会看到成功消息和旧 Preview 并存。
4. **编辑能力不可信**：协作者看到可编辑能力但工具失败，会降低对智能体的信任。
5. **语言体验不一致**：非英文界面仍出现 “Ask about this page” 或 “New chat”。
6. **页面不可用状态不清晰**：撤权/删除后应该解释“页面不再可用于此对话”，而不是让用户猜是否网络失败。

## 建议修复顺序

### 第一阶段：安全与真实链路闭环

1. 修复 `/api/mcp/v1 get_page` 权限检查。
2. 统一 `can_edit` 与 `update_page` 授权口径。
3. 修复真实 `update_page` 输出到 UI 刷新事件的转换。
4. 增加真实 MCP 输出形态的 integration test。

### 第二阶段：Page Chat 专属错误体验

1. `usePageSession` 解析结构化错误并映射 i18n。
2. `chat` workflow 使用 Page Chat 专属错误映射。
3. 页面删除/撤权后禁用 Preview 和工具，并显示可理解的页面不可用状态。
4. 修复 snapshot Retry 和新建 chat 持久化失败反馈。

### 第三阶段：本地化与命名清理

1. 补齐 Page Chat composer、chat title、按钮、错误态文案的 i18n。
2. 增加 Page Chat locale key parity 和硬编码英文扫描。
3. 统一 `publishedPageId/pageUid/urlPageSlug` 命名，减少 slug rename 的长期风险。

## Brainstorming 输入

后续 brainstorming 应重点回答以下产品与技术决策：

1. Page Chat 的编辑能力第一阶段是否只允许作者，还是必须支持协作者？
2. 通用 MCP `get_page` 的匿名访问策略是什么：仅 public approved，还是允许 unlisted？
3. 真实 MCP result 应在哪里转换成 UI 事件所需 shape：MCP route、Page Chat wrapper、workflow，还是 Transcript？
4. 页面不可用时，历史 chat 是否仍允许继续普通问答，还是完全禁用发送？
5. 默认 chat title 应采用前端本地化显示，还是后端按用户 locale 写入？

建议先围绕第一阶段形成小计划，因为它决定 Page Chat 能否安全上线；第二、三阶段可在主链路安全后并行处理。

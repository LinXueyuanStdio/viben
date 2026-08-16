# Page Chat 流式渲染 memo 优化的可维护性重构

> 状态：待评审（2026-08-17 修订）
> 目标：重构已提交的 `cb53cb362`（perf(web): memo 化聊天记录消息）
> 关联文档：[首 token 速度优化计划](./page-chat-ttft-optimization.md)
> 范围：`apps/web`

## 背景与定位

`cb53cb362` 为优化对话流式渲染性能，引入了一批 `React.memo`/`useCallback`/`useMemo`。改动方向正确，但实现方式"简单粗暴加 memo"，在代码可维护性上有明显问题（上帝组件、props 透传、ref 绕远路、死 API 等），且存在被内联箭头函数击穿的隐性 memo 失效。

本文重构不丢性能收益，并把代码改得更清晰、可维护、可测。

## 1. 问题诊断

> 行号均基于 `cb53cb362` 提交后的 `main` 工作树。

### 1.1 `components/assistant/chat-transcript.tsx`（改动最大）

**P1-1 单一职责被打破**：`MessageItem`（:367–758）把四类职责塞进一个组件：
1. 复制到剪贴板的本地状态（`copied`、`copyResetTimeoutRef`、`handleCopy`）；
2. group 计算（`useMemo(() => computeMessageGroups(m), [m])`，:397）；
3. user/assistant 外壳分派；
4. 7 种 part 类型的渲染（`renderGroups` :425–742，含 `p as WebAgentUIToolPart` :645、`p as WebAgentSnippetDataPart` :718 等强转）。

`renderGroups` 每个分支重复 `m.parts.slice(...).some(hasRenderableAssistantPart)`、`${m.id}-${group.renderKey}` 等逻辑，是典型的"上帝组件"。

**P1-2 props 透传地狱**：`ChatTranscriptProps`（:81–106）共 **24 个字段**，`MessageItemProps`（:341–360）有 16 个字段，其中 **11 个回调/瞬态字段**（`onCopyMessage/onRetryMessage/onForkMessage/onDeleteMessage/onApproveTool/onDenyTool/modelOptions/actionDisabled/deletingMessageId/resendingMessageId/forkingMessageId`）从 `ChatTranscript` 原样透传，没有任何语义化聚合。两类 props 类型高度重复但未用 `Pick`/`Omit` 派生。

**P1-3 render-prop 滥用**：`renderGroups` 作为 children function 传给 `AssistantMessageGroups`（:752），函数体约 318 行，闭包捕获约 18 个变量（`m/isMessageStreaming/t/actionDisabled/resending/deleting/forkingMessageId/onRetry/onDelete/onFork/onApprove/onDeny/modelOptions/streamdownComponents/handleCopy/copied` + 参数 `isToolCallsExpanded`），"谁在什么条件下渲染什么"完全不可读。

**P1-4 死 API + 隐性 memo 击穿 bug（核心）**：`onCopyMessage` 是死 prop——产线唯一实现是 `shared-chat-core.tsx:144` 的 `onCopyMessage={() => undefined}`，一个**每次渲染都新建的内联箭头函数**；测试里仅 `chat-transcript.test.tsx:45` 的 `vi.fn()`。真正写剪贴板的是 `MessageItem.handleCopy` 自己（`getAssistantText(m)` + `navigator.clipboard.writeText`，:400–423），不依赖该回调。

`ChatTranscript` 不是 memo 组件，每次 `messages` 更新都会重渲染并把这个新函数透传给每个 `MessageItem` → 浅比较失败 → **所有历史消息每 chunk 都重渲染**。删除该 prop 即修复，是纯收益。

**P1-5 纯逻辑内嵌、不可测**：`computeMessageGroups`（:158）、`getPartIdentity`（:108）、`getStablePartRenderKey`（:164，`computeMessageGroups` 内部的闭包）是纯函数，最容易出 bug 也最该有单测，但被埋在组件文件里，现有 `chat-transcript.test.tsx` 完全没覆盖。

### 1.2 `components/assistant/session-chat-content.tsx`

**P2-1 为稳定引用而生的 6 个适配层**：`handleTranscriptFork/OpenFile/Retry/Delete/Approve/Deny`（:3044–3078）每个都是薄薄一层 `useCallback`：

- `handleTranscriptFork/Retry/Delete` 三者的唯一工作是把 `(message) => handler(message.id)` 转成 `(messageId)` 形。其中 `handleForkAssistantMessage`（:1171）、`handleResendUserMessage`（:1842）、`handleDeleteUserMessage`（:1776）入参本来就是 `messageId`，包装层纯属签名冗余。**注意**：`handleResendUserMessage`/`handleDeleteUserMessage` 的依赖数组含 `messages`（:1831–1839、:1946–1954），流式期间每 chunk 都会重建，并非稳定引用——但这不改变"包装层冗余"的结论：wrapper 的稳定性 = 底层 handler 的稳定性，加一层不增加稳定，删掉也不减少。
- `handleTranscriptOpenFile`（:3050）是 `setSelectedWorkspaceFile`（useState 派发器，本身稳定）的纯包装，100% 冗余。
- `handleTranscriptApprove/Deny`（:3065–3078）把 ai-sdk 的 `addToolApprovalResponse({id, approved, reason})` 对象签名适配成 `(id)` / `(id, reason)` 位置签名，是唯一有实际适配价值的两个。

**P2-2 局部性被破坏**：这 6 个 wrapper 定义在 ~3044 行，使用在 ~3368–3378 行（`SharedChatCore` 的 `transcriptActions`/`transcriptProps`），中间隔着约 300 行无关 JSX。

### 1.3 `hooks/assistant/chat/use-session-chat-runtime.ts`

**P3-1 ref workaround 绕远路**：`clearErrorRef`/`resumeStreamRef`（:225–228）是为绕开"`chat` 每次 render 都是新对象"。但 ai-sdk 类型里 `chat.clearError`/`chat.resumeStream` **就是 `chatInstance` 上稳定方法的同引用**——`@ai-sdk/react` 的 `UseChatHelpers` 含 `Pick<AbstractChat, ... 'resumeStream' | 'clearError' ...>`，实现里 `clearError: chatRef.current.clearError`、`resumeStream: chatRef.current.resumeStream`，`chatRef.current` 即传入的 `chatInstance`。`chatInstance` 在 `useMemo`（:153，deps `[chatId]`）里按 `chatId` 只创建一次，且已在 `retryChatStream`（:240，deps `[chatId, chatInstance]` :280）依赖里。直接调 `chatInstance.clearError()` / `chatInstance.resumeStream()` 即可，两个 ref 是"明知方法稳定却舍近求远"的别扭写法。

### 1.4 `thinking-block.tsx` / `tool-call/tool-call.tsx`

**P4-1 相对干净，基本保留**：`function X` → `const X = memo(function X {...})` 是最规范的 memo 写法，无 props 透传、无额外副作用。本批里唯一不用动的部分，作为对照基准。

### 1.5 已知限制（诚实标注，本重构不硬解）

**P5-1 retry/delete 回调的深层击穿**：即使删掉 `onCopyMessage`，work 模式下 `onRetryMessage`/`onDeleteMessage`（经 wrapper 透传，底层依赖 `messages`）在流式期间仍会变化，继续击穿 `MessageItem` 的 memo。彻底解法（把 `messages` 查找下沉到回调内、用 `useRef` 读取最新 messages 或用 functional setState）属于**独立的性能优化项**，不在本文档可维护性重构范围内，见[首 token 优化计划](./page-chat-ttft-optimization.md)的阶段 5。

## 2. 目标架构

### 2.1 组件/数据流（chat-transcript 核心）

把"一个上帝组件"拆成"编排器 + 叶子渲染器"，并让纯逻辑可测。折叠状态 `isExpanded` 是 `AssistantMessageGroups` 的内部 state，必须显式穿过 `MessageGroupView`，否则会破坏"折叠时 `return null`（而非 CSS 隐藏）"的语义：

```
ChatTranscript (非 memo，薄壳：滚动 + 空态 + streamdownComponents)
└─ messages.map(m =>
     <MessageItem key={m.id}                       // memo，只关心：消息本体 + 瞬态流式状态
        message={m}
        isStreaming={...}
        durationMs={...}
        startedAt={...}
        actionDisabled={...}
        deletingMessageId={...}
        resendingMessageId={...}
        forkingMessageId={...} />
   )

MessageItem (memo，编排层：useMessageGroups + user/assistant 外壳)
├─ assistant 侧：<AssistantMessageGroups>
│     {(isExpanded) => groups.map(g =>
│        <MessageGroupView key={renderKey} group={g} message={m}
│          isStreaming={...} isExpanded={isExpanded} actions={actions} />)}
│   </AssistantMessageGroups>
└─ user 侧：groups.map(...) 直连（isExpanded 恒 true，见 chat-transcript.tsx:757）

MessageGroupView (memo，按 part 类型分派到叶子)
├─ <ReasoningPart> / <AssistantTextPart> / <UserTextPart>
├─ <ToolCallPart> / <GitDataPart> / <ImagePart> / <SnippetPart>
└─ 每个叶子只接收自己需要的 props（不再透传全量）

lib/chat-message-groups.ts (纯函数，新增)
├─ getPartIdentity / computeMessageGroups
└─ getReasoningGroupText / getAssistantText（可选一并迁入）
```

关键设计决策：

- **回调聚合用"单对象 + 稳定引用"，而非盲目上 Context**：回调已稳定（Approve/Deny 来自 `chatInstance`，OpenFile 是 setState 派发器），用 `useMemo` 聚合成一个 `actions` 对象即可消掉多条透传。Context 适用于"跨多层级"，当前只有一层 `MessageItem → 叶子`，单对象更简单、可推理。**两级传递约定**：`MessageItem → MessageGroupView` 传 `actions` 单对象；`MessageGroupView → 叶子` 解构后窄传各自需要的字段，避免把 `actions` 整包塞给每个叶子又回到 props 透传。
- **`MessageItem` 的 memo 依赖收敛到"消息引用 + 瞬态流式状态"**：`message` 引用稳定性是这次性能收益的根；`isStreaming/durationMs/startedAt` 对历史消息天然稳定；`actionDisabled/deletingMessageId/resendingMessageId/forkingMessageId` 是罕见瞬态，直接平铺传（**不要**合成对象，否则删某条消息会改对象身份导致全体重渲）。
- **`computeMessageGroups` 迁移为纯函数进 `lib/`**：组件里只留一行 `useMemo(() => computeMessageGroups(m), [m])`，补单测钉死稳定 renderKey 行为。
- **诚实说明 `MessageGroupView` 的 memo 收益边界**：`computeMessageGroups` 每次重算都 `new` 出全新 group 对象，流式消息每个 chunk 变化时所有 group 引用都会更换，因此 `MessageGroupView` 以 `group` 引用做浅比较**对流式中的最后一条消息无收益**，它只服务「折叠切换」与「可维护性」（叶子变更不拖累整条消息）。真正扛流式性能的是 `MessageItem` 这一层。**不要误以为加这层能减少流式重渲**。
- **类型收口**：`MessageItemProps` 里的回调/瞬态字段用 `Pick<ChatTranscriptProps, ...>` 派生；`streamdownComponents` 提为具名类型 `StreamdownComponents`。

### 2.2 回调签名对齐（消 4 个 wrapper）

把 `ChatTranscriptProps` 的 fork/retry/delete 回调从"吃整个 message"改成"吃 messageId"：

```ts
onForkMessage?: (messageId: string) => void;   // 原 (message: WebAgentUIMessage) => void
onRetryMessage?: (messageId: string) => void;
onDeleteMessage?: (messageId: string) => void;
onOpenFile?: (path: string) => void;           // 不变，直接传 setSelectedWorkspaceFile
```

这样 `SessionChatContent` 直接传 `handleForkAssistantMessage` / `handleResendUserMessage` / `handleDeleteUserMessage`（入参就是 `messageId`），`onOpenFile` 直传 `setSelectedWorkspaceFile`。approve/deny 两个适配器保留但下移到 `transcriptProps` 定义处。

**附带清理**：`shared-chat-core.tsx:145–146` 的 `onRetryMessage={mode === "work" ? () => runtime.retryChatStream() : undefined}` 是"流级重试"语义（无参），与 Step 4 改后的"按 messageId 重发"语义不同，且当前被 work 模式的 `{...transcriptProps}` 覆盖成死分支。改为签名 `(messageId) => void` 后它仍可编译（0 参函数可赋给 1 参类型）但语义错误，应一并删除或显式注释。

### 2.3 ref 模式 → 直接用稳定实例

删掉两个 ref，`retryChatStream` 内直接 `chatInstance.clearError()` / `await chatInstance.resumeStream()`。依赖数组保持 `[chatId, chatInstance]`。

### 2.4 死 API 清理（修两个 memo 击穿）

1. 删除 `onCopyMessage` prop（`ChatTranscriptProps` + `MessageItemProps` + `handleCopy` 里的调用 + `shared-chat-core.tsx:144` 的 `() => undefined`）。
2. 修第二个击穿：`chat-transcript.tsx:809` 的 `<OpenFileProvider onOpenFile={onOpenFile ?? (() => {})}>`——page 模式下 `onOpenFile` 恒为 undefined（`page-session-chat-content.tsx` 不传 `transcriptActions`），每次渲染都新建 `() => {}` → Context value 变化 → 所有历史消息里的 `file-name-pill`（`useOpenFile()` 消费者）每 chunk 重渲，**绕过 MessageItem/ToolCall 的 memo**。改为模块级 `const NOOP_OPEN_FILE = () => {}` 或 `useMemo(() => onOpenFile ?? NOOP_OPEN_FILE, [onOpenFile])`。

## 3. 分步骤重构方案（可独立提交）

> 删除 `onCopyMessage` 后，MessageItem 的交互回调由 6 个变为 5 个（retry/fork/delete/approve/deny）。

### Step 1 — 提取分组纯函数到 `lib/chat-message-groups.ts` 并补单测

把 `getPartIdentity`（:108）、`computeMessageGroups`（:158，含内部 `getStablePartRenderKey`）、`getReasoningGroupText`、`getAssistantText` 迁到新文件 `apps/web/lib/chat-message-groups.ts`。新增 `apps/web/lib/chat-message-groups.test.ts`，覆盖：reasoning 合并、`toolCallId` 分支用 identity 而其他用 `identity:count` 去重、stable renderKey 在流式追加时不抖动。

**验证**：`npx vitest run lib/chat-message-groups` 通过；`npx vitest run components/assistant/chat-transcript` 不回归。行为零变化。

### Step 2 — 删 `onCopyMessage` 死 prop + 修 `OpenFileProvider` 击穿

1. `chat-transcript.tsx`：删 `ChatTranscriptProps.onCopyMessage`（:87）、`MessageItemProps.onCopyMessage`（:349）、`handleCopy` 里的 `onCopyMessage(m)`（:400）、依赖数组 `[m, onCopyMessage]`（:423）→ `[m]`。
2. `shared-chat-core.tsx`：删 `onCopyMessage={() => undefined}`（:144）。
3. `chat-transcript.tsx:809`：`onOpenFile ?? (() => {})` 改为模块级 `NOOP_OPEN_FILE` 常量（或 `useMemo` 稳定化）。
4. `chat-transcript.test.tsx`：删 `baseProps.onCopyMessage`。

**验证**：`npx vitest run components/assistant/chat-transcript components/assistant/shared-chat-core`；手动流式渲染确认历史消息不再整批闪烁。备选：若未来要埋点，用 `const NOOP_COPY = () => undefined` 模块级常量，但推荐直接删除。

### Step 3 — `use-session-chat-runtime.ts` 去 ref

删 `clearErrorRef`/`resumeStreamRef`（:225–228）及注释，`retryChatStream` 内改调 `chatInstance.clearError()` / `await chatInstance.resumeStream()`。deps 保持 `[chatId, chatInstance]`。

**验证**：`npx vitest run hooks/assistant/chat/use-session-chat-runtime`。测试 mock 的 instance 需补 `clearError: vi.fn()`、`resumeStream: vi.fn()`，并新增断言"重试路径调用它们"。

### Step 4 — 回调签名 id 化，消 4 个 wrapper

1. `chat-transcript.tsx`：`onForkMessage/onRetryMessage/onDeleteMessage` 改为 `(messageId: string) => void`；`MessageItem` 内部调用点全部改为传 `m.id`——`onRetryMessage` :524、`onDeleteMessage` **:541（文本）/ :687（图片）/ :724（snippet）共 3 处**、`onForkMessage` :600。
2. `session-chat-content.tsx`：删 `handleTranscriptFork`、`handleTranscriptRetry`、`handleTranscriptDelete`、`handleTranscriptOpenFile`（:3044–3063）；`transcriptActions`（:3368–3369）改传 `{ onForkMessage: handleForkAssistantMessage, onOpenFile: setSelectedWorkspaceFile }`；`transcriptProps`（:3375–3376）改传 `onRetryMessage: handleResendUserMessage, onDeleteMessage: handleDeleteUserMessage`。
3. `handleTranscriptApprove`/`handleTranscriptDeny` 保留，移到 `transcriptProps` 定义紧上方。
4. 顺带删除 `shared-chat-core.tsx:145–146` 的 `onRetryMessage` 流级重试死分支（见 2.2 附带清理）。

**验证**：`npx vitest run components/assistant/chat-transcript components/assistant/shared-chat-core`；`cd apps/web && pnpm typecheck` 确认签名改动无残留调用点。

### Step 5 — `chat-transcript.tsx` 拆 `MessageItem` 为编排器 + 叶子渲染器

纯结构重构，零行为变化：
1. 新增 `MessageGroupView`（`memo`）按 `group.type` 分派到叶子组件；新增/复用 `ReasoningPart`、`AssistantTextPart`（含复制状态，把 `copied`/`copyResetTimeoutRef`/`handleCopy` 下沉）、`UserTextPart`、`ToolCallPart`、`GitDataPart`、`ImagePart`、`SnippetPart` 若干 memo 叶子（可放同文件或 `components/assistant/message-parts/` 子目录）。
2. `MessageItem` 只保留：`useMessageGroups(m)`、user/assistant 外壳分派、把 5 回调 + `modelOptions` + `streamdownComponents` 聚合成一个 `useMemo` 的 `actions` 对象向下传（两级传递，见 2.1）。
3. **显式穿过 `isExpanded`**：assistant 侧 `renderGroups` 的 children function 里把 `isExpanded` 传给 `MessageGroupView`，user 侧恒 `true`。
4. 类型收口：`MessageItemProps = Pick<ChatTranscriptProps, ...> & { message; isStreaming; durationMs; startedAt; actions }`；`streamdownComponents` 提为具名类型。
5. 按项目规范用显式 `import type { ... }`（禁止 inline `import()`）。

**验证**：`npx vitest run components/assistant/chat-transcript`（现有 mock 了 `ThinkingBlock/ToolCall/AssistantMessageGroups`，拆分后若 mock 路径变化需同步调整）；`pnpm typecheck`；手动流式渲染确认折叠/复制/重试/删除/fork 交互不变。

## 4. 风险与验收

### 4.1 全局验收命令

```bash
cd apps/web && npx vitest run    # 全量测试
cd apps/web && pnpm typecheck    # 单包类型检查（勿在仓库根跑 pnpm build/typecheck）
```

### 4.2 逐步风险点

| 步骤 | 风险 | 缓解/验收 |
|---|---|---|
| Step 1 | 迁移纯函数时改动 renderKey 语义 | 新增单测钉死"流式追加不换 key"；对比迁移前后输出 |
| Step 2 | 删 `onCopyMessage` 若有隐藏调用方 | 已 grep 确认仅 noop 与测试；`pnpm typecheck` 兜底 |
| Step 3 | mock 缺方法导致测试假绿/假红 | 显式补 `clearError`/`resumeStream`，并新增断言 |
| Step 4 | 签名 id 化漏改调用点 | 逐一覆盖 :524/:541/:687/:724/:600；`pnpm typecheck` |
| Step 5 | 拆分组件破坏折叠语义（头号风险） | 显式穿过 `isExpanded`；手动验证折叠时 tool/reasoning 仍是 `return null` 而非 CSS 隐藏 |

### 4.3 性能收益验收（不丢收益）

1. **渲染计数法**：React DevTools Profiler 观察——流式期间历史消息组件渲染次数应为 0，只有最后一条随 chunk 重渲。
2. **首 token / 输入响应**：手动发长对话，确认流式期间输入框不卡顿、历史消息无整批闪烁（闪烁 = 全量重渲，正是 Step 2 要修的）。
3. **折叠语义**：确认 `AssistantMessageGroups` 折叠时 tool/reasoning 仍真正跳过渲染（而非 CSS 隐藏）。
4. **iOS 错误恢复**：`retryChatStream` 的 hard/soft 分支、`userStoppedRef` 语义在 Step 3 后不变。

### 4.4 已知限制（不在本重构范围）

- retry/delete 回调依赖 `messages` 的深层击穿（见 1.5 P5-1）留待[首 token 优化计划](./page-chat-ttft-optimization.md)阶段 5。

## 关键文件清单

- `apps/web/components/assistant/chat-transcript.tsx`
- `apps/web/components/assistant/session-chat-content.tsx`
- `apps/web/components/assistant/shared-chat-core.tsx`
- `apps/web/hooks/assistant/chat/use-session-chat-runtime.ts`

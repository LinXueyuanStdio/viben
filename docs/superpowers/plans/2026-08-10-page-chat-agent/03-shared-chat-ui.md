# Page Chat Agent 03：共享聊天 UI 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从现有 work-only `SessionChatContent` 中抽取不依赖 sandbox 的 transcript、composer 控制层与运行时组合，使 work session、Page Drawer 和 `/assistant` Page session 使用同一网络状态机和输入体验。

**Architecture:** `useSessionChatRuntime` 继续作为唯一 AI chat/stream/stop 状态机；新 `SharedChatCore` 管理模型、附件、语音、输入提交和滚动，新 `ChatTranscript` 负责消息渲染，新 `ChatComposer` 包装现有 `AssistantPromptComposer`。work 组合层通过显式 slots/features 接回 file mentions、skills、todo、sandbox overlay 和 Git；Page 组合层不加载这些 hooks。

**Tech Stack:** React 19、AI SDK React、SWR、Testing Library/Vitest、Tailwind v4。

## Spec 依据

- **Spec 文件：** [`docs/superpowers/specs/2026-08-10-page-chat-agent-design.md`](../../specs/2026-08-10-page-chat-agent-design.md)
- **本计划覆盖章节：** “现状调研 > 当前 `/assistant` 对话与输入结构”、“页面右侧滑栏 > Drawer 输入框”、“共用 Page Chat 视图”、“共用聊天组件分层”、“响应式行为”中的消息/输入区、“测试策略 > UI”中的共用 Composer 与 Page 模式无 sandbox 请求要求。

## 执行者必读的总体设计

开始前完整阅读[总实施索引](../2026-08-10-page-chat-agent.md)、[完整设计 Spec](../../specs/2026-08-10-page-chat-agent-design.md)和本文件。

```text
WorkSessionChatContent ── work slots ─┐
PageSessionChatContent ─ page slots ──┼─ SharedChatCore
PageAssistantPanel ─ compact slots ───┘    ├─ useSessionChatRuntime（唯一网络状态机）
                                           ├─ ChatTranscript
                                           └─ ChatComposer
                                                └─ AssistantPromptComposer
```

抽取必须保持现有 work 行为，不能在 4000+ 行文件里散布 `agent_type === "chat"`。Page consumer 只 import 共享文件，不 import `session-chat-context.tsx`，因为后者会请求 sandbox/files/skills/diff/git。

## Global Constraints

- 继承总索引全部 Global Constraints。
- 保留 `AssistantPromptComposer` 作为无业务状态的展示组件；不要复制其 JSX。
- Page feature profile 固定为图片、大文本、模型、用量、语音、发送/停止；不含 files、skills、todo、inline question 和 sandbox。
- Composer 始终是 transcript scroll container 的兄弟节点，不使用 sticky 模拟固定输入框。
- 先以机械抽取保持 work DOM/行为，再增加 Page 参数；禁止顺手重做消息视觉。

---

### Task 1: 抽取通用 `ChatTranscript`

**Files:**
- Create: `apps/web/components/assistant/chat-transcript.tsx`
- Create: `apps/web/components/assistant/chat-transcript.test.tsx`
- Create: `apps/web/lib/page-chat/page-content-events.ts`
- Create: `apps/web/lib/page-chat/page-content-events.test.ts`
- Modify: `apps/web/components/assistant/session-chat-content.tsx`

**Interfaces:**
- Consumes: `WebAgentUIMessage`、现有 message group/tool call/reasoning/thinking 组件、`useScrollToBottom`。
- Produces:

```ts
export type ChatTranscriptProps = {
  messages: WebAgentUIMessage[];
  status: UseChatHelpers<WebAgentUIMessage>["status"];
  error: Error | undefined;
  compact?: boolean;
  emptyState?: ReactNode;
  onCopyMessage: (message: WebAgentUIMessage) => void;
  onRetryMessage: (message: WebAgentUIMessage) => void;
  onForkMessage?: (message: WebAgentUIMessage) => void;
  onOpenFile?: (path: string) => void;
  onPageContentChanged?: (detail: PageContentChangedDetail) => void;
  messageDurationMap: Record<string, number>;
  messageStartedAtMap: Record<string, string>;
  lastUserMessageSentAt: string | null;
};

export const PAGE_CONTENT_CHANGED_EVENT = "viben:page-content-changed";

export type PageContentChangedDetail = {
  publishedPageId: string;
  chatId: string;
};

export function emitPageContentChanged(detail: PageContentChangedDetail): void;
export function subscribePageContentChanged(
  listener: (detail: PageContentChangedDetail) => void,
): () => void;
```

- [ ] **Step 1: 写 transcript 失败测试**

mock 重型 renderer，断言统一消息行为和 Page 的 optional capabilities：

```tsx
test("renders user, reasoning, tool and assistant parts in order", () => {
  render(<ChatTranscript {...baseProps} messages={mixedMessages} />);
  expect(screen.getAllByTestId("message-part").map((node) => node.textContent))
    .toEqual(["user", "reasoning", "tool-get_page", "assistant"]);
});

test("omits work-only actions when callbacks are absent", () => {
  render(<ChatTranscript {...baseProps} onForkMessage={undefined} onOpenFile={undefined} />);
  expect(screen.queryByRole("button", { name: /fork/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /open file/i })).not.toBeInTheDocument();
});

test("reports a successful update_page result once", () => {
  const onPageContentChanged = vi.fn();
  const { rerender } = render(
    <ChatTranscript {...baseProps} messages={updateSuccessMessages} onPageContentChanged={onPageContentChanged} />,
  );
  rerender(<ChatTranscript {...baseProps} messages={updateSuccessMessages} onPageContentChanged={onPageContentChanged} />);
  expect(onPageContentChanged).toHaveBeenCalledOnce();
});

test("publishes and unsubscribes typed page content events", () => {
  const listener = vi.fn();
  const unsubscribe = subscribePageContentChanged(listener);
  emitPageContentChanged({ publishedPageId: "page-1", chatId: "chat-1" });
  expect(listener).toHaveBeenCalledWith({
    publishedPageId: "page-1",
    chatId: "chat-1",
  });
  unsubscribe();
  emitPageContentChanged({ publishedPageId: "page-1", chatId: "chat-1" });
  expect(listener).toHaveBeenCalledOnce();
});
```

成功识别规则只接受 `toolName === "update_page"`、state `output-available`、结果 JSON `success === true`。

- [ ] **Step 2: 运行测试确认组件不存在**

Run: `cd /root/github/LinXueyuanStdio/viben/apps/web && pnpm test:run components/assistant/chat-transcript.test.tsx lib/page-chat/page-content-events.test.ts`

Expected: FAIL，无法导入 `ChatTranscript`。

- [ ] **Step 3: 机械迁移 transcript JSX 与事件检测**

从 `SessionChatContent` 移动消息列表、scroll-to-bottom、thinking indicator 和消息 actions；work-only 文件打开/fork 通过可选 callback 注入。用 `useRef<Set<string>>` 按 `toolCallId` 去重更新通知，不改变现有 markdown/tool renderers。`page-content-events.ts` 封装 `CustomEvent<PageContentChangedDetail>` 的 emit/subscribe 和 SSR guard，供 Plans 04–06 直接消费。

- [ ] **Step 4: 运行新旧组件测试**

Run: `cd /root/github/LinXueyuanStdio/viben/apps/web && pnpm test:run components/assistant/chat-transcript.test.tsx lib/page-chat/page-content-events.test.ts components/assistant/tool-call/tool-layout.test.tsx components/assistant/chat-message-payload.test.ts`

Expected: PASS。

- [ ] **Step 5: 提交 transcript 抽取**

```bash
git add apps/web/components/assistant/chat-transcript.tsx apps/web/components/assistant/chat-transcript.test.tsx apps/web/lib/page-chat/page-content-events.ts apps/web/lib/page-chat/page-content-events.test.ts apps/web/components/assistant/session-chat-content.tsx
git commit -m "refactor(web): extract shared chat transcript"
```

---

### Task 2: 抽取共享 `ChatComposer` 控制层

**Files:**
- Create: `apps/web/components/assistant/chat-composer.tsx`
- Create: `apps/web/components/assistant/chat-composer.test.tsx`
- Modify: `apps/web/components/assistant/session-chat-content.tsx`
- Modify: `apps/web/components/assistant/assistant-prompt-composer.test.tsx`

**Interfaces:**
- Consumes: `AssistantPromptComposer`；`useImageAttachments`、`useTextAttachments`、`useAudioRecording`、model options；父级 runtime 的 send/stop。
- Produces:

```ts
export type ChatComposerMode = "work" | "page";

export type ChatComposerSubmit = {
  text: string;
  images: Array<{ mediaType: string; url: string }>;
  textAttachments: Array<{ filename: string; content: string }>;
  modelId: string;
};

export type ChatComposerProps = {
  mode: ChatComposerMode;
  density: "full" | "compact";
  modelId: string;
  modelOptions: ModelOption[];
  contextUsage: ReactNode;
  status: UseChatHelpers<WebAgentUIMessage>["status"];
  disabled?: boolean;
  initialDraft?: string;
  onModelChange: (modelId: string) => Promise<void>;
  onSubmit: (draft: ChatComposerSubmit) => Promise<void>;
  onStop: () => void;
  workExtensions?: {
    fileSuggestions: FileSuggestion[];
    skillSuggestions: SkillSuggestion[];
    todo: ReactNode;
    overlay: ReactNode;
  };
};
```

- [ ] **Step 1: 写能力矩阵与失败回滚测试**

```tsx
test("page mode keeps common controls and never renders work extensions", () => {
  render(<ChatComposer {...pageProps} />);
  expect(screen.getByRole("button", { name: "Attach files" })).toBeVisible();
  expect(screen.getByRole("button", { name: /model/i })).toBeVisible();
  expect(screen.getByRole("button", { name: "Voice input" })).toBeVisible();
  expect(screen.getByText("12% context")).toBeVisible();
  expect(screen.queryByText("File suggestions")).not.toBeInTheDocument();
  expect(screen.queryByText("Skills")).not.toBeInTheDocument();
  expect(screen.queryByText("Todo")).not.toBeInTheDocument();
});

test("submits image and large-text attachments then clears on success", async () => {
  render(<ChatComposer {...pageProps} onSubmit={onSubmit} />);
  fireEvent.paste(screen.getByPlaceholderText("Ask about this page"), {
    clipboardData: { getData: () => "x".repeat(10_000), files: [] },
  });
  await userEvent.upload(screen.getByTestId("attachment-input"), imageFile);
  fireEvent.change(screen.getByPlaceholderText("Ask about this page"), {
    target: { value: "Summarize it" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
    text: "Summarize it",
    images: [expect.objectContaining({ mediaType: "image/png" })],
    textAttachments: [expect.objectContaining({ content: "x".repeat(10_000) })],
    modelId: "openai/gpt-5",
  })));
  expect(screen.getByPlaceholderText("Ask about this page")).toHaveValue("");
  expect(screen.queryByTestId("image-attachment-preview")).not.toBeInTheDocument();
  expect(screen.queryByTestId("text-attachment-preview")).not.toBeInTheDocument();
});

test("restores draft and attachments when submit rejects", async () => {
  onSubmit.mockRejectedValueOnce(new Error("network"));
  render(<ChatComposer {...pageProps} onSubmit={onSubmit} />);
  await prepareDraftWithImageAndTextAttachment();
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  await screen.findByText("network");
  expect(screen.getByPlaceholderText("Ask about this page")).toHaveValue("Summarize it");
  expect(screen.getByTestId("image-attachment-preview")).toBeVisible();
  expect(screen.getByTestId("text-attachment-preview")).toBeVisible();
});

test("shows stop instead of send while streaming", () => {
  render(<ChatComposer {...pageProps} status="streaming" />);
  fireEvent.click(screen.getByRole("button", { name: "Stop generating" }));
  expect(onStop).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: 运行测试确认组件不存在**

Run: `cd /root/github/LinXueyuanStdio/viben/apps/web && pnpm test:run components/assistant/chat-composer.test.tsx components/assistant/assistant-prompt-composer.test.tsx`

Expected: FAIL，`ChatComposer` 缺失。

- [ ] **Step 3: 迁移输入控制逻辑并保留 work slots**

把附件、paste/drop、录音转写、提交清空/失败恢复、model selector props 从 `SessionChatContent` 移入 `ChatComposer`。`mode === "page"` 时不调用 `useFileSuggestions/useSessionSkills/useSlashCommands`；work 数据必须由 `workExtensions` 从父层注入。`density` 只调整外层 padding/max-width 和窄宽用量展示，不分叉提交逻辑。

- [ ] **Step 4: 运行 Composer 与附件回归测试**

Run: `cd /root/github/LinXueyuanStdio/viben/apps/web && pnpm test:run components/assistant/chat-composer.test.tsx components/assistant/assistant-prompt-composer.test.tsx hooks/assistant/use-text-attachments.test.ts`

Expected: PASS。

- [ ] **Step 5: 提交 Composer 抽取**

```bash
git add apps/web/components/assistant/chat-composer.tsx apps/web/components/assistant/chat-composer.test.tsx apps/web/components/assistant/session-chat-content.tsx apps/web/components/assistant/assistant-prompt-composer.test.tsx
git commit -m "refactor(web): extract shared chat composer"
```

---

### Task 3: 增加无 sandbox `SharedChatCore`

**Files:**
- Create: `apps/web/components/assistant/shared-chat-core.tsx`
- Create: `apps/web/components/assistant/shared-chat-core.test.tsx`
- Create: `apps/web/components/assistant/page-chat-provider.tsx`
- Test: `apps/web/components/assistant/page-chat-provider.test.tsx`

**Interfaces:**
- Consumes: `useSessionChatRuntime()`、Tasks 1–2、`Session/Chat/WebAgentUIMessage/ModelOption`。
- Produces:

```ts
export type SharedChatCoreProps = {
  session: Session;
  chat: Chat;
  initialMessages: WebAgentUIMessage[];
  modelOptions: ModelOption[];
  mode: "work" | "page";
  density: "full" | "compact";
  emptyState?: ReactNode;
  toolbar?: ReactNode;
  transcriptActions?: Pick<ChatTranscriptProps, "onForkMessage" | "onOpenFile">;
  workExtensions?: ChatComposerProps["workExtensions"];
  onPageContentChanged?: (detail: PageContentChangedDetail) => void;
  onChatActivity?: () => void;
};

export function PageChatProvider(props: {
  session: Session;
  chat: Chat;
  initialMessages: WebAgentUIMessage[];
  initialModelOptions: ModelOption[];
  children: ReactNode;
}): ReactNode;
```

- [ ] **Step 1: 写 runtime 共用与无 sandbox 请求失败测试**

mock `useSessionChatRuntime` 和 `global.fetch`：

```tsx
test("uses the existing chat transport for page submit, resume and stop", async () => {
  render(<SharedChatCore {...pageCoreProps} />);
  await send("Summarize this page");
  expect(runtime.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ role: "user" }));
  expect(runtime.resumeStream).toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Stop generating" }));
  expect(runtime.stopChatStream).toHaveBeenCalled();
});

test("page provider does not request sandbox, files, skills, diff or git endpoints", async () => {
  render(<PageChatProvider {...providerProps}><Consumer /></PageChatProvider>);
  await waitFor(() => expect(screen.getByText("ready")).toBeVisible());
  const urls = fetchMock.mock.calls.map(([url]) => String(url));
  expect(urls).not.toEqual(expect.arrayContaining([
    expect.stringContaining("/sandbox/"),
    expect.stringContaining("/files"),
    expect.stringContaining("/skills"),
    expect.stringContaining("/diff"),
  ]));
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /root/github/LinXueyuanStdio/viben/apps/web && pnpm test:run components/assistant/shared-chat-core.test.tsx components/assistant/page-chat-provider.test.tsx`

Expected: FAIL，新组件不存在。

- [ ] **Step 3: 实现核心组合和轻量 Page provider**

`PageChatProvider` 只提供 session/chat/model/runtime/update model；不得 import `@viben/sandbox`、`useSessionDiff`、`useSessionFiles`、`useSessionSkills` 或 Git hooks。`SharedChatCore` 使用 `h-full min-h-0 flex flex-col overflow-hidden`，toolbar 为 `shrink-0`、transcript 为 `min-h-0 flex-1`、composer 为 `shrink-0`。提交时复用现有 `chat-message-payload.ts` 构造 UI parts。

- [ ] **Step 4: 运行核心测试和 typecheck**

Run: `cd /root/github/LinXueyuanStdio/viben/apps/web && pnpm test:run components/assistant/shared-chat-core.test.tsx components/assistant/page-chat-provider.test.tsx components/assistant/chat-composer.test.tsx components/assistant/chat-transcript.test.tsx && pnpm typecheck`

Expected: PASS。

- [ ] **Step 5: 提交共享核心**

```bash
git add apps/web/components/assistant/shared-chat-core.tsx apps/web/components/assistant/shared-chat-core.test.tsx apps/web/components/assistant/page-chat-provider.tsx apps/web/components/assistant/page-chat-provider.test.tsx
git commit -m "feat(web): add sandbox-free shared chat core"
```

---

### Task 4: 将 work session 接回共享核心并锁定回归

**Files:**
- Modify: `apps/web/components/assistant/session-chat-content.tsx`
- Modify: `apps/web/components/assistant/session-chat-context.tsx`
- Create: `apps/web/components/assistant/session-chat-content.test.tsx`

**Interfaces:**
- Consumes: `SharedChatCore` 的 work mode 与 slots。
- Produces: 现有 `SessionChatContent` public props 不变；work-only hooks 仍只在 work 组合层执行。

- [ ] **Step 1: 写 work 装配回归测试**

```tsx
test("work content supplies files, skills, todo and workspace callbacks", () => {
  render(<SessionChatContent {...props} />);
  expect(sharedCoreSpy).toHaveBeenCalledWith(expect.objectContaining({
    mode: "work",
    density: "full",
    workExtensions: expect.objectContaining({
      fileSuggestions: expect.any(Array),
      skillSuggestions: expect.any(Array),
      todo: expect.anything(),
      overlay: expect.anything(),
    }),
    transcriptActions: expect.objectContaining({
      onForkMessage: expect.any(Function),
      onOpenFile: expect.any(Function),
    }),
  }));
});
```

再断言 archive/restore/sandbox error 与 GitPanel 仍在组合层而非 SharedChatCore。

- [ ] **Step 2: 运行测试确认旧组件尚未装配 SharedChatCore**

Run: `cd /root/github/LinXueyuanStdio/viben/apps/web && pnpm test:run components/assistant/session-chat-content.test.tsx`

Expected: FAIL，shared core spy 未被调用。

- [ ] **Step 3: 完成机械迁移并删除重复状态**

用 `SharedChatCore mode="work"` 替换旧 transcript/composer 段，删除已迁走的 input/attachment/audio/scroll state，保留 sandbox lifecycle、workspace panels、inline question 和 work overlays。不要改变 `SessionChatProvider` 的 sandbox API 时序。

- [ ] **Step 4: 运行 Assistant UI 回归与 typecheck**

Run: `cd /root/github/LinXueyuanStdio/viben/apps/web && pnpm test:run components/assistant/session-chat-content.test.tsx components/assistant/shared-chat-core.test.tsx components/assistant/chat-composer.test.tsx components/assistant/chat-transcript.test.tsx hooks/assistant/use-session-chats.test.ts && pnpm typecheck`

Expected: PASS；没有 duplicate composer/transcript JSX。

- [ ] **Step 5: 提交 work 迁移**

```bash
git add apps/web/components/assistant/session-chat-content.tsx apps/web/components/assistant/session-chat-context.tsx apps/web/components/assistant/session-chat-content.test.tsx
git commit -m "refactor(web): compose work chat from shared core"
```

## 子计划完成门槛

- [ ] Page consumer 的 import graph 不触达 sandbox/files/skills/diff/git hooks。
- [ ] 三个入口未来都只能通过 `SharedChatCore` 使用 runtime、transcript 和 composer。
- [ ] Composer 的附件/语音/model/context/send/stop 行为测试在 page/work mode 均通过。
- [ ] work session 的原 public props、sandbox overlays 和 workspace actions 无回归。
- [ ] `session-chat-content.tsx` 不含为 Page 增加的散落 `agentType` 条件。

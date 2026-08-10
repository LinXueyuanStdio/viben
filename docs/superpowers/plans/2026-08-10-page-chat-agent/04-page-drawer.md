# Page Chat Agent 04：阅读页 Drawer 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `/{user_slug}/{page_slug}` 的现有右侧 ReadDrawer 中，为登录用户加入首次访问才加载的“助手”Tab，并提供可恢复 chats 的紧凑 Page Chat。

**Architecture:** `ReadDrawer` 增加 discriminated `assistant` tab 和 visited mount 策略；动态加载的 `PageAssistantPanel` 首次挂载时调用 `POST /api/page-sessions`，然后用 Plan 03 的 `PageChatProvider + SharedChatCore`。Drawer 自身只负责紧凑 conversation toolbar、chat 切换和阅读页刷新，不复制网络状态机。

**Tech Stack:** React/Next.js dynamic、SWR、App Router、Testing Library、现有 resizable Drawer、Tailwind v4。

## Spec 依据

- **Spec 文件：** [`docs/superpowers/specs/2026-08-10-page-chat-agent-design.md`](../../specs/2026-08-10-page-chat-agent-design.md)
- **本计划覆盖章节：** “现状调研 > 页面路由与布局树 / 当前桌面布局 / 当前移动端布局 / 当前 ReadDrawer 结构与限制”、“页面右侧滑栏”全部章节（目标线框图、Tab 挂载策略、Drawer 输入框）、“响应式行为”中的阅读页场景、“测试策略 > UI”中的登录可见、lazy、恢复、新对话和草稿保留。

## 执行者必读的总体设计

实现前完整阅读[总实施索引](../2026-08-10-page-chat-agent.md)、[完整设计 Spec](../../specs/2026-08-10-page-chat-agent-design.md)和本文件。

```text
ReadPageClient
└── ReadDrawer
    ├── Read / Comments / Notes（保持现有）
    └── Assistant（仅登录）
        └── 首次点击后才 dynamic mount
            └── PageAssistantPanel
                ├── POST /api/page-sessions
                ├── ConversationToolbar
                └── SharedChatCore density=compact mode=page
```

Drawer 切到其他 Tab 后只能隐藏已访问的 Assistant，不能卸载；否则草稿、附件与 streaming view 会丢失。未点击 Assistant 时不得请求 Page session、models 或 chat bundle。

## Global Constraints

- 继承总索引全部 Global Constraints。
- 未登录阅读页不渲染 Assistant tab，也不向客户端提供创建用的 session 信息。
- Desktop 保持 280–600px resize；mobile 使用动态视口高度和 safe area，不能使用固定 `100vh` 遮住软键盘。
- Assistant 内容不放进 Drawer 统一 `overflow-auto p-3` 容器；仅 transcript 滚动，composer 固定为兄弟节点。
- 四个 tabs 在窄宽可横向滚动，More/Close 固定且不可被挤出。

---

### Task 1: 给 ReadDrawer 增加 lazy/visited Assistant tab 容器

**Files:**
- Modify: `apps/web/components/layout/read-drawer.tsx`
- Create: `apps/web/components/layout/read-drawer.test.tsx`

**Interfaces:**
- Consumes: 现有 `ReadDrawerTab` union、Drawer context、dynamic loading。
- Produces:

```ts
export interface ReadDrawerAssistantTab {
  value: "assistant";
  label: string;
  type: "assistant";
  pageDbId: string;
  userSlug: string;
  pageSlug: string;
}

export type ReadDrawerTab =
  | ReadDrawerMetaTab
  | ReadDrawerCommentsTab
  | ReadDrawerNotesTab
  | ReadDrawerAssistantTab;
```

- [ ] **Step 1: 写首次访问和保活失败测试**

mock dynamic `PageAssistantPanel`：

```tsx
test("does not mount the assistant before its first selection", () => {
  render(<ReadDrawer tabs={tabsWithAssistant} />);
  expect(screen.queryByTestId("page-assistant-panel")).not.toBeInTheDocument();
  expect(pageAssistantMounts).toBe(0);
});

test("mounts once on first visit and keeps the instance while hidden", () => {
  render(<ReadDrawer tabs={tabsWithAssistant} />);
  fireEvent.click(screen.getByRole("tab", { name: "Assistant" }));
  expect(pageAssistantMounts).toBe(1);
  typeDraft("unfinished");
  fireEvent.click(screen.getByRole("tab", { name: "Comments" }));
  fireEvent.click(screen.getByRole("tab", { name: "Assistant" }));
  expect(pageAssistantMounts).toBe(1);
  expect(screen.getByDisplayValue("unfinished")).toBeVisible();
});

test("uses an isolated non-scrolling shell for assistant content", () => {
  render(<ReadDrawer tabs={tabsWithAssistant} />);
  fireEvent.click(screen.getByRole("tab", { name: "Assistant" }));
  expect(screen.getByTestId("assistant-tab-host")).toHaveClass("min-h-0", "overflow-hidden");
  expect(screen.getByTestId("regular-tab-host")).toHaveClass("overflow-auto", "p-3");
});
```

- [ ] **Step 2: 运行测试确认 assistant union 不存在**

Run: `cd /root/github/LinXueyuanStdio/viben/apps/web && pnpm test:run components/layout/read-drawer.test.tsx`

Expected: FAIL，assistant tab 没有 renderer。

- [ ] **Step 3: 实现 visited set、dynamic import 和分离布局**

用 `visitedTabs` state；初始不含 assistant，`onTabChange("assistant")` 时加入。`TabContent` 的 assistant case 只有在 visited 时才渲染 `LazyPageAssistantPanel`。Drawer body 根据 active tab 使用两个 sibling host：常规内容 `overflow-auto p-3`；assistant host `min-h-0 overflow-hidden`，visited 后一直保留并用 `hidden` 切换。

把 tab list 外层设为 `min-w-0 overflow-x-auto`，actions 使用 `shrink-0`。移动容器高度改为 `100dvh` 并用 `env(safe-area-inset-bottom)`。

- [ ] **Step 4: 运行 Drawer 测试**

Run: `cd /root/github/LinXueyuanStdio/viben/apps/web && pnpm test:run components/layout/read-drawer.test.tsx`

Expected: PASS，existing Read/Comments/Notes tests/behavior 不变。

- [ ] **Step 5: 提交 Drawer 容器**

```bash
git add apps/web/components/layout/read-drawer.tsx apps/web/components/layout/read-drawer.test.tsx
git commit -m "feat(web): add lazy assistant drawer tab"
```

---

### Task 2: 实现 `PageAssistantPanel` 的恢复、切换和新对话

**Files:**
- Create: `apps/web/hooks/assistant/use-page-session.ts`
- Create: `apps/web/components/pages/page-assistant-panel.tsx`
- Create: `apps/web/components/pages/page-assistant-panel.test.tsx`

**Interfaces:**
- Consumes: Plan 01 `PageSessionResponse`、现有 `useSessionChats(sessionId)`、Plan 03 `PageChatProvider/SharedChatCore`。
- Produces:

```ts
export function usePageSession(input: {
  userSlug: string;
  pageSlug: string;
}): {
  data: PageSessionResponse | undefined;
  error: Error | undefined;
  isLoading: boolean;
  retry: () => Promise<void>;
};

export type PageAssistantPanelProps = {
  pageDbId: string;
  userSlug: string;
  pageSlug: string;
};
```

- [ ] **Step 1: 写 session 恢复、角色建议和 chat 操作失败测试**

```tsx
test("posts snake_case identity once and restores the returned latest chat", async () => {
  render(<PageAssistantPanel pageDbId="page-1" userSlug="alice" pageSlug="guide" />);
  await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/page-sessions", expect.objectContaining({
    method: "POST",
    body: JSON.stringify({ user_slug: "alice", page_slug: "guide" }),
  })));
  expect(sharedCoreSpy).toHaveBeenCalledWith(expect.objectContaining({
    session: expect.objectContaining({ id: "session-1" }),
    chat: expect.objectContaining({ id: "latest-chat" }),
    mode: "page",
    density: "compact",
  }));
});

test("shows author prompts for can_edit and reader prompts otherwise", async () => {
  pageSessionResponse.page.can_edit = true;
  const authorView = render(<PageAssistantPanel {...panelProps} />);
  expect(await screen.findByRole("button", { name: "Add multilingual support" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Improve page SEO" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Check structure and accessibility" })).toBeVisible();
  authorView.unmount();

  pageSessionResponse.page.can_edit = false;
  render(<PageAssistantPanel {...panelProps} />);
  expect(await screen.findByRole("button", { name: "Summarize this page" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Extract key points" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Explain a difficult section" })).toBeVisible();
});

test("creates a new chat in the same session and switches to it", async () => {
  fireEvent.click(await screen.findByRole("button", { name: "New conversation" }));
  expect(createChat).toHaveBeenCalledOnce();
  expect(switchChat).toHaveBeenCalledWith("chat-2");
});

test("switches historical chats from the compact dropdown", async () => {
  render(<PageAssistantPanel {...panelProps} />);
  fireEvent.click(await screen.findByRole("button", { name: "Current conversation" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Older chat" }));
  expect(switchChat).toHaveBeenCalledWith("older-chat");
  expect(sharedCoreSpy).toHaveBeenLastCalledWith(expect.objectContaining({
    chat: expect.objectContaining({ id: "older-chat" }),
  }));
});

test("renders retryable states without creating a sandbox", async () => {
  pageSessionResponse = new Response("MCP unavailable", { status: 503 });
  render(<PageAssistantPanel {...panelProps} />);
  expect(await screen.findByRole("button", { name: "Retry" })).toBeVisible();
  const urls = fetchMock.mock.calls.map(([url]) => String(url));
  expect(urls.some((url) => /sandbox|files|skills|diff/.test(url))).toBe(false);
});
```

- [ ] **Step 2: 运行 panel 测试确认失败**

Run: `cd /root/github/LinXueyuanStdio/viben/apps/web && pnpm test:run components/pages/page-assistant-panel.test.tsx`

Expected: FAIL，panel/hook 不存在。

- [ ] **Step 3: 实现 hook、toolbar、empty state 与 shared core 装配**

`usePageSession` 首次 mount POST 一次，不使用长缓存；失败保留 error，retry 显式重发。Panel loading 使用骨架；成功后加载 chats/messages，并以 response 的 chat 作为 initial active chat。toolbar 包含当前 chat 下拉、新对话、进入完整 `/assistant/{sessionId}/chats/{chatId}` 链接。

空状态 suggestion 点击直接构造自然语言 draft 并调用 shared submit，不直接调用页面 API。页面不存在/权限失效显示“页面不可用”，历史消息仍由 `/assistant` 保留。

- [ ] **Step 4: 运行 Panel、session chat hook 与 shared core 测试**

Run: `cd /root/github/LinXueyuanStdio/viben/apps/web && pnpm test:run components/pages/page-assistant-panel.test.tsx hooks/assistant/use-session-chats.test.ts components/assistant/shared-chat-core.test.tsx components/assistant/page-chat-provider.test.tsx`

Expected: PASS。

- [ ] **Step 5: 提交 Page Assistant Panel**

```bash
git add apps/web/hooks/assistant/use-page-session.ts apps/web/components/pages/page-assistant-panel.tsx apps/web/components/pages/page-assistant-panel.test.tsx
git commit -m "feat(web): add compact page assistant panel"
```

---

### Task 3: 在阅读页只为登录用户注入 Assistant tab

**Files:**
- Modify: `apps/web/components/pages/read-page-client.tsx`
- Create: `apps/web/components/pages/read-page-client.test.tsx`
- Modify: `apps/web/components/layout/read-drawer.test.tsx`

**Interfaces:**
- Consumes: `ReadPageClient` 已有 `isAuthenticated/sessionUserId/userSlug/pageDbId/pageUid` 与 Task 1 assistant tab type。
- Produces: 登录时 tab `{ value: "assistant", type: "assistant", pageDbId, userSlug, pageSlug: pageUid }`。

- [ ] **Step 1: 写登录可见性与身份传递失败测试**

```tsx
test("omits the assistant tab for anonymous readers", () => {
  render(<ReadPageClient {...props} isAuthenticated={false} sessionUserId={undefined} />);
  expect(readDrawerSpy).toHaveBeenCalledWith(expect.objectContaining({
    tabs: expect.not.arrayContaining([expect.objectContaining({ type: "assistant" })]),
  }));
});

test("adds the current page assistant identity for logged-in readers", () => {
  render(<ReadPageClient {...props} isAuthenticated sessionUserId="user-2" />);
  expect(readDrawerSpy).toHaveBeenCalledWith(expect.objectContaining({
    tabs: expect.arrayContaining([expect.objectContaining({
      value: "assistant",
      type: "assistant",
      pageDbId: "page-db-1",
      userSlug: "alice",
      pageSlug: "guide",
    })]),
  }));
});
```

- [ ] **Step 2: 运行阅读页测试确认失败**

Run: `cd /root/github/LinXueyuanStdio/viben/apps/web && pnpm test:run components/pages/read-page-client.test.tsx components/layout/read-drawer.test.tsx`

Expected: FAIL，登录 tabs 中没有 assistant。

- [ ] **Step 3: 条件构造 tabs 并处理页面更新 refresh**

用数组展开条件加入 assistant；不要仅在 CSS 隐藏匿名 tab。通过 Plan 03 的 `subscribePageContentChanged()` 订阅更新，只有 detail 的 `publishedPageId === pageDbId` 时调用 `router.refresh()`，由新的 RSC props 更新正文 `srcDoc`。

- [ ] **Step 4: 运行阅读页/UI/typecheck**

Run: `cd /root/github/LinXueyuanStdio/viben/apps/web && pnpm test:run components/pages/read-page-client.test.tsx components/pages/page-assistant-panel.test.tsx components/layout/read-drawer.test.tsx && pnpm typecheck`

Expected: PASS；匿名渲染不会 import/mount PageAssistantPanel。

- [ ] **Step 5: 提交阅读页集成**

```bash
git add apps/web/components/pages/read-page-client.tsx apps/web/components/pages/read-page-client.test.tsx apps/web/components/layout/read-drawer.test.tsx
git commit -m "feat(web): expose page assistant to signed-in readers"
```

## 子计划完成门槛

- [ ] 匿名用户既看不到 tab，也不会触发 Page session API。
- [ ] 登录用户第一次点 tab 才加载；切换后 panel instance、草稿和附件保留。
- [ ] 恢复最新 chat；新对话仍属于同一 session；历史 chat 可切换。
- [ ] Desktop resize 与 mobile `100dvh`/safe area 均不让 Composer 随消息滚动。
- [ ] Page Drawer 没有 sandbox/files/skills/todo/diff/git 请求。
- [ ] “完整对话”链接准确指向现有 `/assistant/{sessionId}/chats/{chatId}`。

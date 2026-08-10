# Page Chat Agent 05：Assistant Pages 分组与 Preview 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `/assistant` 左侧加入与 `Chats` 同级的 `Pages` 分组，并让 Page session 使用无 workspace 控件的聊天壳层、可折叠 Preview 和新标签外链。

**Architecture:** session sidebar query 返回轻量 `agent_type` 与页面快照，纯函数分组为 Pages/Chats/repositories。路由 layout 根据 `session.agentType` 选择 Work 或 Page shell；Page shell 不挂载 `GitPanelProvider`，而是使用独立 `PagePreviewProvider` 管理桌面右栏/移动 overlay，聊天正文复用 `PageChatProvider + SharedChatCore`。

**Tech Stack:** Next.js nested layouts、React context、SWR、resizable panel、sandboxed iframe、Testing Library/Vitest。

## Spec 依据

- **Spec 文件：** [`docs/superpowers/specs/2026-08-10-page-chat-agent-design.md`](../../specs/2026-08-10-page-chat-agent-design.md)
- **本计划覆盖章节：** “`/assistant` 集成 > 左侧分组 / Page session 主界面 / Preview”、“共用 Page Chat 视图”、“响应式行为”中的 `/assistant` 场景、“权限与安全”中的 Preview、“错误处理”中的页面删除/权限失效、“测试策略 > UI”中的 Pages 分组、header 和 Preview。

## 执行者必读的总体设计

开始前完整阅读[总实施索引](../2026-08-10-page-chat-agent.md)、[完整设计 Spec](../../specs/2026-08-10-page-chat-agent-design.md)和本文件。

```text
/assistant sidebar
├── Chats   = work + no repo
├── Pages   = chat + published page
└── owner/repo = work + repo

session route
├── work -> existing GitPanelProvider + SessionHeader + SessionChatContent
└── chat -> PageSessionLayout
           ├── PageSessionHeader: Preview + →
           ├── PageSessionChatContent: SharedChatCore
           └── PagePreviewPanel: current page only
```

Page session 不得为了复用 tabs/header 而挂载 Git provider；应让 chat tabs 只依赖通用 `SessionLayoutContext`，work-only actions 保留在 work shell。

## Global Constraints

- 继承总索引全部 Global Constraints。
- Pages 与 Chats 同级、各自可折叠；Page row 继续支持未读、streaming、pin、rename、archive、delete。
- Page header 右侧只有页面相关 `Preview` 与 `→`；share/chat tabs 等通用行为可保留，但没有 Code Editor/Files/Diff/Git/PR/sandbox。
- Preview endpoint 每次读取都验证登录、session ownership、页面存在和 `canReadPage`，不使用 session slug 快照授权。
- iframe 通过 `srcDoc` 渲染正文，不嵌套 Viben chrome，不获得 `allow-same-origin`、父 DOM 或认证信息。

---

### Task 1: 给 sidebar session summary 增加 Pages 分组

**Files:**
- Modify: `apps/web/lib/db/sessions.ts`
- Modify: `apps/web/hooks/assistant/use-sessions.ts`
- Modify: `apps/web/components/assistant/inbox-sidebar.tsx`
- Create: `apps/web/components/assistant/inbox-sidebar-groups.test.ts`
- Create: `apps/web/components/assistant/inbox-sidebar.test.tsx`

**Interfaces:**
- Consumes: Plan 01 `Session.agentType/pageUserSlug/pageSlug/publishedPageId`。
- Produces:

```ts
export type SessionSidebarGroup = {
  id: "group:chats" | "group:pages" | `repo:${string}`;
  labelKey?: "assistant.sidebar.chats" | "assistant.sidebar.pages";
  label?: string;
  kind: "chats" | "pages" | "repo";
  sessions: SessionWithUnread[];
};

export function groupAssistantSessions(
  sessions: SessionWithUnread[],
  t: (key: string) => string,
): SessionSidebarGroup[];
```

- [ ] **Step 1: 写查询字段与分组顺序失败测试**

```ts
test("groups chats, pages and repositories independently", () => {
  const groups = groupAssistantSessions([
    workChat,
    pageChat,
    repoWork,
  ], translate);
  expect(groups.map((group) => [group.kind, group.label])).toEqual([
    ["chats", "Chats"],
    ["pages", "Pages"],
    ["repo", "acme/repo"],
  ]);
  expect(groups[1]?.sessions).toEqual([pageChat]);
});

test("never puts chat agent sessions in Chats or repo groups", () => {
  const groups = groupAssistantSessions([pageChatWithLegacyRepoFields], translate);
  expect(groups).toHaveLength(1);
  expect(groups[0]?.kind).toBe("pages");
});
```

扩展 `getSessionsWithUnreadByUserId` 的现有测试或类型断言，确保 select 包含 `agentType/publishedPageId/pageUserSlug/pageSlug`。

- [ ] **Step 2: 运行测试确认当前仅按 repo 分组**

Run: `cd /root/github/LinXueyuanStdio/viben/apps/web && pnpm test:run components/assistant/inbox-sidebar-groups.test.ts lib/db/sessions.test.ts`

Expected: FAIL，`groupAssistantSessions` 不存在或 Page 被归入 Chats。

- [ ] **Step 3: 扩展 summary 并实现纯分组函数**

在 DB `SessionSidebarFields`、hook `SessionWithUnread`、optimistic merge 中加入四个页面字段。分组优先级固定：

```ts
if (session.agentType === "chat" && session.publishedPageId) return "pages";
if (!session.repoName) return "chats";
return "repo";
```

渲染沿用现有 section/rows/action menus；只有 repo group 显示 branch/new repo actions。memo comparison 加入新字段，Pages 和 Chats 各有独立 collapsed key。

- [ ] **Step 4: 运行 sidebar/session hook 回归**

Run: `cd /root/github/LinXueyuanStdio/viben/apps/web && pnpm test:run components/assistant/inbox-sidebar-groups.test.ts hooks/assistant/use-session-chats.test.ts components/assistant/sessions-index-shell.test.tsx lib/db/sessions.test.ts`

Expected: PASS。

- [ ] **Step 5: 提交 Pages 分组**

```bash
git add apps/web/lib/db/sessions.ts apps/web/hooks/assistant/use-sessions.ts apps/web/components/assistant/inbox-sidebar.tsx apps/web/components/assistant/inbox-sidebar-groups.test.ts apps/web/components/assistant/inbox-sidebar.test.tsx
git commit -m "feat(web): group page chats in assistant sidebar"
```

---

### Task 2: 为 Page session 增加独立 layout/header/content

**Files:**
- Modify: `apps/web/app/(dashboard)/assistant/[sessionId]/session-layout-shell.tsx`
- Create: `apps/web/components/assistant/page-session-layout.tsx`
- Create: `apps/web/components/assistant/page-session-header.tsx`
- Create: `apps/web/components/assistant/page-session-chat-content.tsx`
- Modify: `apps/web/app/(dashboard)/assistant/[sessionId]/chats/[chatId]/page.tsx`
- Create: `apps/web/components/assistant/page-session-layout.test.tsx`

**Interfaces:**
- Consumes: Plan 03 `PageChatProvider/SharedChatCore`；现有 `useSessionChats`/`SessionLayoutContext`/chat tabs。
- Produces:

```ts
export type PageSessionLayoutProps = {
  session: Session;
  activeChatId: string;
  children: ReactNode;
  previewPanel?: ReactNode;
};

export type PageSessionChatContentProps = {
  session: Session;
  chat: Chat;
  initialMessages: WebAgentUIMessage[];
  initialModelOptions: ModelOption[];
  messageDurationMap: Record<string, number>;
  messageStartedAtMap: Record<string, string>;
  lastUserMessageSentAt: string | null;
};
```

- [ ] **Step 1: 写 agent_type 路由与 header 能力失败测试**

```tsx
test("work sessions keep the existing GitPanel shell", () => {
  render(<SessionLayoutShell session={workSession}>{child}</SessionLayoutShell>);
  expect(screen.getByTestId("git-panel-provider")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Preview" })).not.toBeInTheDocument();
});

test("page sessions render page shell without workspace providers", () => {
  render(<SessionLayoutShell session={pageSession}>{child}</SessionLayoutShell>);
  expect(screen.queryByTestId("git-panel-provider")).not.toBeInTheDocument();
  expect(screen.queryByText(/code editor/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/files|diff|pull request|sandbox/i)).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Preview" })).toBeVisible();
});

test("external page button opens the current snapshot URL safely", () => {
  expect(screen.getByRole("link", { name: "Open page" })).toHaveAttribute(
    "href", "/alice/guide?tab=read",
  );
  expect(screen.getByRole("link", { name: "Open page" })).toHaveAttribute("target", "_blank");
  expect(screen.getByRole("link", { name: "Open page" })).toHaveAttribute("rel", "noopener noreferrer");
});
```

- [ ] **Step 2: 运行 layout 测试确认失败**

Run: `cd /root/github/LinXueyuanStdio/viben/apps/web && pnpm test:run components/assistant/page-session-layout.test.tsx`

Expected: FAIL，所有 sessions 都挂载 GitPanel shell。

- [ ] **Step 3: 分离 work/page shell 并在 page route 使用 shared core**

让 `SessionLayoutShell` 外层保留 `SessionLayoutContext`/chat CRUD，内层按 `session.agentType` 选择：

```tsx
return session.agentType === "chat" ? (
  <PageSessionLayout session={session} activeChatId={activeChatId}>
    {children}
  </PageSessionLayout>
) : (
  <GitPanelProvider>
    <SessionLayoutInner activeChatId={activeChatId}>{children}</SessionLayoutInner>
  </GitPanelProvider>
);
```

chat page 服务端同样按 agent type 选择 `PageSessionChatContent` 或现有 `DiffsProvider + SessionChatProvider + SessionChatContent`。Page header 复用 chat tabs，但 tabs 不能无条件调用 `useGitPanel`；将 Git action 以可选 slot 传入或拆成 work wrapper。

Task 2 中 `PageSessionLayout` 自己维护 `previewRequested`，点击 Preview 切换一个带 `data-testid="page-preview-slot"` 的空 slot，并接受可选 `previewPanel`；这样本 task 独立可编译和测试。Task 3 再将 state 收进 `PagePreviewProvider` 并把真实 `PagePreviewPanel` 注入该 slot。

- [ ] **Step 4: 运行 layout、chat tabs 和 typecheck**

Run: `cd /root/github/LinXueyuanStdio/viben/apps/web && pnpm test:run components/assistant/page-session-layout.test.tsx components/assistant/shared-chat-core.test.tsx hooks/assistant/use-session-chats.test.ts && pnpm typecheck`

Expected: PASS；work page 仍有原 header/actions，Page 不触发 workspace hooks。

- [ ] **Step 5: 提交 Page session shell**

```bash
git add 'apps/web/app/(dashboard)/assistant/[sessionId]/session-layout-shell.tsx' 'apps/web/app/(dashboard)/assistant/[sessionId]/chats/[chatId]/page.tsx' apps/web/components/assistant/page-session-layout.tsx apps/web/components/assistant/page-session-header.tsx apps/web/components/assistant/page-session-chat-content.tsx apps/web/components/assistant/page-session-layout.test.tsx
git commit -m "feat(web): add page chat assistant layout"
```

---

### Task 3: 增加安全 Preview API 与响应式 Preview panel

**Files:**
- Create: `apps/web/app/api/page-sessions/[sessionId]/preview/route.ts`
- Create: `apps/web/app/api/page-sessions/[sessionId]/preview/route.test.ts`
- Create: `apps/web/components/assistant/page-preview-context.tsx`
- Create: `apps/web/components/assistant/page-preview-panel.tsx`
- Create: `apps/web/components/assistant/page-preview-panel.test.tsx`
- Modify: `apps/web/components/assistant/page-session-layout.tsx`
- Modify: `apps/web/components/assistant/page-session-header.tsx`

**Interfaces:**
- Consumes: Plan 01 session page fields、`canReadPage`、Task 2 的 `PageSessionLayout.previewPanel` slot。
- Produces:

```ts
export type PagePreviewResponse = {
  published_page_id: string;
  user_slug: string;
  page_slug: string;
  title: string;
  html: string;
  url: string;
};

export type PagePreviewContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  revision: number;
  reload: () => void;
};
```

- [ ] **Step 1: 写 Preview API 权限和 UI 布局失败测试**

API tests：

```ts
test("requires login and owned chat session", async () => {
  currentUserId = null;
  expect((await GET(request, context("page-session"))).status).toBe(401);
  currentUserId = "other-user";
  expect((await GET(request, context("page-session"))).status).toBe(404);
});
test("rejects work sessions", async () => {
  currentSession.agentType = "work";
  const response = await GET(request, context("work-session"));
  expect(response.status).toBe(400);
  await expect(response.json()).resolves.toEqual({ error: "Page chat session required" });
});
test("re-checks current page permission by published_page_id", async () => {
  canRead = false;
  const response = await GET(request, context("page-session"));
  expect(response.status).toBe(404);
  expect(responseBody).not.toHaveProperty("html");
});
test("returns current slugs and latest html instead of snapshots", async () => {
  expect(await response.json()).toEqual(expect.objectContaining({
    published_page_id: "page-1",
    user_slug: "alice-new",
    page_slug: "guide-new",
    html: "<main>latest</main>",
  }));
});
```

UI tests：默认关闭、不 fetch；点击 Preview 后 fetch；desktop 为 resize right rail；mobile 为 overlay；iframe `sandbox` 不含 `allow-same-origin`；error 有重试且历史 chat DOM仍存在。

- [ ] **Step 2: 运行 Preview tests 确认失败**

Run: `cd /root/github/LinXueyuanStdio/viben/apps/web && pnpm test:run 'app/api/page-sessions/[sessionId]/preview/route.test.ts' components/assistant/page-preview-panel.test.tsx`

Expected: FAIL，route/panel 不存在。

- [ ] **Step 3: 实现实时授权 route 与 Preview provider/panel**

route 查 owned session 后按 `publishedPageId` 明确列查询 page 和 author，调用 `canReadPage`；页面缺失/权限拒绝统一 404。返回 `Cache-Control: private, no-store`。

Panel 只在 `open` 时 SWR fetch `/api/page-sessions/${session.id}/preview?revision=${revision}`；desktop 默认 320px、可 resize；mobile fixed overlay `100dvh`。iframe：

```tsx
<iframe
  title={data.title}
  srcDoc={wrapPageHtml(data.html)}
  sandbox="allow-scripts allow-forms allow-popups allow-modals allow-downloads"
/>
```

不要加入 `allow-same-origin`。外链 href 在 Preview 成功后用当前 slug 更新；失败时禁用 Preview/外链并显示“页面不可用”。

- [ ] **Step 4: 运行 Preview/layout/typecheck**

Run: `cd /root/github/LinXueyuanStdio/viben/apps/web && pnpm test:run 'app/api/page-sessions/[sessionId]/preview/route.test.ts' components/assistant/page-preview-panel.test.tsx components/assistant/page-session-layout.test.tsx && pnpm typecheck`

Expected: PASS。

- [ ] **Step 5: 提交 Preview**

```bash
git add 'apps/web/app/api/page-sessions/[sessionId]/preview/route.ts' 'apps/web/app/api/page-sessions/[sessionId]/preview/route.test.ts' apps/web/components/assistant/page-preview-context.tsx apps/web/components/assistant/page-preview-panel.tsx apps/web/components/assistant/page-preview-panel.test.tsx apps/web/components/assistant/page-session-layout.tsx apps/web/components/assistant/page-session-header.tsx
git commit -m "feat(web): add page session preview panel"
```

## 子计划完成门槛

- [ ] Sidebar 明确生成 Chats、Pages、repo 三种 group，Page rows 保留现有操作/状态。
- [ ] Page route import graph 不挂载 GitPanel/Diffs/SessionChatProvider work context。
- [ ] Header 有 Preview 与安全外链，没有任何 workspace/sandbox control。
- [ ] Preview 默认关闭且不请求；打开后每次按稳定 ID重新授权和取最新 HTML。
- [ ] Desktop right rail 与 mobile overlay 行为有组件测试，iframe 权限最小化。
- [ ] 页面删除/权限撤回不删除聊天，只让 Preview/外链不可用。

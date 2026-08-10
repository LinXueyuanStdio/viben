# Page Chat Agent 01：数据与 Page Session API 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Page Chat 建立向后兼容的数据模型，并提供只允许登录用户使用、并发安全的 Page session get-or-create API。

**Architecture:** 在 `sessions` 上新增默认 `work` 的 `agent_type` 与稳定页面外键/slug 快照，用部分唯一索引保证每个用户/页面至多一个未归档 `chat` session。页面入口使用独立 `POST /api/page-sessions`，先按现有 `canReadPage` 授权，再创建或恢复最近 chat，且完全不触发 sandbox provisioning。

**Tech Stack:** Drizzle ORM、PostgreSQL partial unique index、Next.js Route Handler、Vitest/Bun tests。

## Spec 依据

- **Spec 文件：** [`docs/superpowers/specs/2026-08-10-page-chat-agent-design.md`](../../specs/2026-08-10-page-chat-agent-design.md)
- **本计划覆盖章节：** “核心决策”全部章节、“数据关系图”、“Session 创建与恢复”、“权限与安全”第 1–4 条、“缓存与同步”中的 session/slug 规则、“错误处理”中的登录、页面、权限、归档和并发场景、“测试策略 > 数据层 / API 与服务”。

## 执行者必读的总体设计

开始前依次完整阅读：

1. [总实施索引](../2026-08-10-page-chat-agent.md)
2. [完整设计 Spec](../../specs/2026-08-10-page-chat-agent-design.md)
3. 本文件

本任务只是总体架构的数据入口，不得偏离以下关系：

```text
session.agent_type
├── work：现有创建路径，默认值，继续 kickSandboxProvisioningWorkflow
└── chat：Page session，published_page_id 锁定上下文，不创建 sandbox
      └── 同一 user_id + published_page_id 最多一个 status != archived
           └── 多个 chats；恢复 updated_at 最新的 chat
```

`page_user_slug` 与 `page_slug` 只是快照；后续 Agent/Preview 必须按 `published_page_id` 查当前页面。页面外键使用 `ON DELETE SET NULL`，确保页面删除不删聊天历史。

## Global Constraints

- 继承总索引全部 Global Constraints。
- 数据库列使用 snake_case；Drizzle TypeScript 属性使用项目现有 camelCase 映射。
- `sessions.agent_type` 必须为非空枚举 `"work" | "chat"`，默认 `"work"`。
- 普通 `POST /api/sessions` 不接受客户端指定 `agent_type`，避免绕过专用 Page session 授权。
- Page session 的 `sandbox_state`、`lifecycle_state`、`sandbox_provisioning_run_id` 必须保持 `null`。
- 页面 session 和 chat 是实时用户数据，不引入 `unstable_cache`。

---

### Task 1: 扩展 sessions schema 与迁移

**Files:**
- Modify: `apps/web/lib/db/schema.ts:2067`
- Create: `apps/web/lib/db/migrations/0005_page_chat_sessions.sql`
- Modify: `apps/web/lib/db/migrations/meta/_journal.json`
- Test: `apps/web/lib/db/page-chat-schema.test.ts`

**Interfaces:**
- Consumes: 现有 `publishedPages.id`、`sessions.status` 和 Drizzle `$inferSelect/$inferInsert`。
- Produces: `SessionAgentType = "work" | "chat"`；`Session.agentType`、`publishedPageId`、`pageUserSlug`、`pageSlug`；数据库索引 `sessions_active_page_chat_unique_idx`。

- [ ] **Step 1: 写 schema contract 失败测试**

创建 `page-chat-schema.test.ts`，读取 schema 和 SQL migration 文本并断言以下精确契约：

```ts
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { sessions } from "./schema";

describe("page chat session schema", () => {
  test("exposes a work-defaulted agent type and nullable page context", () => {
    expect(sessions.agentType.enumValues).toEqual(["work", "chat"]);
    expect(sessions.agentType.notNull).toBe(true);
    expect(sessions.agentType.default).toBe("work");
    expect(sessions.publishedPageId).toBeDefined();
    expect(sessions.pageUserSlug).toBeDefined();
    expect(sessions.pageSlug).toBeDefined();
  });

  test("migration preserves history and prevents duplicate active page sessions", () => {
    const sql = readFileSync(
      new URL("./migrations/0005_page_chat_sessions.sql", import.meta.url),
      "utf8",
    );
    expect(sql).toContain("ON DELETE SET NULL");
    expect(sql).toContain("sessions_active_page_chat_unique_idx");
    expect(sql).toContain("WHERE agent_type = 'chat' AND status <> 'archived'");
  });
});
```

- [ ] **Step 2: 运行测试确认因字段缺失失败**

Run: `cd /root/github/LinXueyuanStdio/viben/apps/web && pnpm test:run lib/db/page-chat-schema.test.ts`

Expected: FAIL，错误指出 `sessions.agentType` 未定义或 migration 文件不存在。

- [ ] **Step 3: 写最小 schema 与 SQL migration**

在 `sessions` 表中增加：

```ts
agentType: text("agent_type", { enum: ["work", "chat"] })
  .notNull()
  .default("work"),
publishedPageId: text("published_page_id").references(
  () => publishedPages.id,
  { onDelete: "set null" },
),
pageUserSlug: text("page_user_slug"),
pageSlug: text("page_slug"),
```

并导出：

```ts
export type SessionAgentType = Session["agentType"];
```

迁移必须包含准确等价的 DDL：

```sql
ALTER TABLE "sessions" ADD COLUMN "agent_type" text DEFAULT 'work' NOT NULL;
ALTER TABLE "sessions" ADD COLUMN "published_page_id" text;
ALTER TABLE "sessions" ADD COLUMN "page_user_slug" text;
ALTER TABLE "sessions" ADD COLUMN "page_slug" text;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_published_page_id_published_pages_id_fk"
  FOREIGN KEY ("published_page_id") REFERENCES "public"."published_pages"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
CREATE UNIQUE INDEX "sessions_active_page_chat_unique_idx"
  ON "sessions" USING btree ("user_id", "published_page_id")
  WHERE agent_type = 'chat' AND status <> 'archived';
```

在 `_journal.json` 追加 `idx: 5`、`tag: "0005_page_chat_sessions"` 的 entry，不改写既有 migration。

- [ ] **Step 4: 运行 schema 测试与 typecheck**

Run: `cd /root/github/LinXueyuanStdio/viben/apps/web && pnpm test:run lib/db/page-chat-schema.test.ts && pnpm typecheck`

Expected: PASS；现有 session insert 不传 `agentType` 仍可编译。

- [ ] **Step 5: 提交数据模型**

```bash
git add apps/web/lib/db/schema.ts apps/web/lib/db/migrations/0005_page_chat_sessions.sql apps/web/lib/db/migrations/meta/_journal.json apps/web/lib/db/page-chat-schema.test.ts
git commit -m "feat(web): add page chat session schema"
```

---

### Task 2: 实现 active Page session 数据服务

**Files:**
- Modify: `apps/web/lib/db/sessions.ts`
- Test: `apps/web/lib/db/sessions.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `Session.agentType/publishedPageId/pageUserSlug/pageSlug` 和 partial unique index。
- Produces:

```ts
export type CreatePageSessionInput = {
  userId: string;
  publishedPageId: string;
  pageUserSlug: string;
  pageSlug: string;
  title: string;
  chatId: string;
  chatTitle: string;
  modelId: string;
};

export async function getActivePageSession(
  userId: string,
  publishedPageId: string,
): Promise<SessionRecord | undefined>;

export async function createPageSessionWithInitialChat(
  input: CreatePageSessionInput,
): Promise<{ session: SessionRecord; chat: Chat }>;

export async function getLatestChatBySessionId(
  sessionId: string,
): Promise<Chat | undefined>;

export async function syncPageSessionSnapshot(
  sessionId: string,
  snapshot: { title: string; pageUserSlug: string; pageSlug: string },
): Promise<SessionRecord>;
```

- [ ] **Step 1: 扩展 DB fake 并写服务失败测试**

在 `sessions.test.ts` 增加可记录 select/insert/update 条件的 fake，并覆盖四个行为：

```ts
test("creates chat page sessions without sandbox lifecycle fields", async () => {
  const result = await createPageSessionWithInitialChat({
    userId: "user-1",
    publishedPageId: "page-1",
    pageUserSlug: "alice",
    pageSlug: "guide",
    title: "Guide",
    chatId: "chat-1",
    chatTitle: "New chat",
    modelId: "openai/gpt-5",
  });
  expect(recordedSessionInsert).toMatchObject({
    agentType: "chat",
    publishedPageId: "page-1",
    pageUserSlug: "alice",
    pageSlug: "guide",
    sandboxState: null,
    lifecycleState: null,
  });
  expect(result.chat.sessionId).toBe(result.session.id);
});

test("active lookup excludes archived and non-chat sessions", async () => {
  await getActivePageSession("user-1", "page-1");
  expect(renderedWhereClause).toContain("agent_type");
  expect(renderedWhereClause).toContain("archived");
});

test("latest chat uses updated_at descending", async () => {
  await getLatestChatBySessionId("session-1");
  expect(recordedChatOrder).toBe("updated_at desc");
});

test("snapshot sync only updates display fields", async () => {
  await syncPageSessionSnapshot("session-1", {
    title: "Renamed",
    pageUserSlug: "alice-new",
    pageSlug: "guide-new",
  });
  expect(recordedSessionUpdate).toEqual({
    title: "Renamed",
    pageUserSlug: "alice-new",
    pageSlug: "guide-new",
    updatedAt: expect.any(Date),
  });
});
```

- [ ] **Step 2: 运行测试确认导出不存在**

Run: `cd /root/github/LinXueyuanStdio/viben/apps/web && pnpm test:run lib/db/sessions.test.ts`

Expected: FAIL，显示四个新导出或 fake DB 行为不存在。

- [ ] **Step 3: 实现查询、事务创建和快照同步**

实现时使用明确 Drizzle 条件：

```ts
where: and(
  eq(sessions.userId, userId),
  eq(sessions.publishedPageId, publishedPageId),
  eq(sessions.agentType, "chat"),
  ne(sessions.status, "archived"),
)
```

`createPageSessionWithInitialChat()` 必须在一个 transaction 内插入 session/chat，session ID 在服务内用 `nanoid()` 生成；`getLatestChatBySessionId()` 使用 `[desc(chats.updatedAt), desc(chats.createdAt)]`。不要在这一层捕获 unique violation；API service 将在冲突时重新读取 winner。

- [ ] **Step 4: 运行数据服务测试**

Run: `cd /root/github/LinXueyuanStdio/viben/apps/web && pnpm test:run lib/db/sessions.test.ts lib/db/page-chat-schema.test.ts`

Expected: PASS，且既有 legacy sandbox normalization 测试不变。

- [ ] **Step 5: 提交数据服务**

```bash
git add apps/web/lib/db/sessions.ts apps/web/lib/db/sessions.test.ts
git commit -m "feat(web): add active page session storage"
```

---

### Task 3: 增加登录专用 Page session get-or-create API

**Files:**
- Create: `apps/web/lib/page-chat/page-session-service.ts`
- Create: `apps/web/lib/page-chat/types.ts`
- Create: `apps/web/app/api/page-sessions/route.ts`
- Create: `apps/web/app/api/page-sessions/route.test.ts`
- Modify: `apps/web/app/api/sessions/route.test.ts`
- Modify: `apps/web/app/api/sessions/[sessionId]/route.ts`
- Create: `apps/web/app/api/sessions/[sessionId]/route.test.ts`

**Interfaces:**
- Consumes: Task 2 的四个 DB 函数；`getPublishedPageContext(userSlug, pageSlug)`；`canReadPage(page, authSession)`；`getUserPreferences()`；`sanitizeUserPreferencesForSession()`。
- Produces:

```ts
export type GetOrCreatePageSessionInput = {
  userId: string;
  userSlug: string;
  authSession: AuthSession;
  requestUrl: string;
  pageUserSlug: string;
  pageSlug: string;
};

export type PageSessionResponse = {
  session: Session;
  chat: Chat;
  page: {
    published_page_id: string;
    user_slug: string;
    page_slug: string;
    title: string;
    url: string;
    can_edit: boolean;
    available: true;
  };
};

export async function getOrCreatePageSession(
  input: GetOrCreatePageSessionInput,
): Promise<PageSessionResponse>;
```

`PageSessionResponse` 必须定义在无 server-only import 的 `apps/web/lib/page-chat/types.ts`，供 route、Drawer 和 `/assistant` 共同 `import type`；`page-session-service.ts` 只实现服务端函数。

- [ ] **Step 1: 写 API 授权、恢复、创建和并发失败测试**

通过 `vi.hoisted()` mocks 覆盖以下精确场景：

```ts
test("returns 401 without a login", async () => {
  currentSession = null;
  const response = await POST(pageSessionRequest("alice", "guide"));
  expect(response.status).toBe(401);
  expect(createPageSessionCalls).toHaveLength(0);
});

test("returns 404 without revealing a missing page", async () => {
  pageContext = null;
  const response = await POST(pageSessionRequest("alice", "missing"));
  expect(response.status).toBe(404);
  expect(createPageSessionCalls).toHaveLength(0);
});

test("returns 404 and does not create when canReadPage rejects", async () => {
  canRead = false;
  const response = await POST(pageSessionRequest("alice", "private"));
  expect(response.status).toBe(404);
  expect(createPageSessionCalls).toHaveLength(0);
});

test("restores the latest chat and syncs renamed page snapshots", async () => {
  activePageSession = existingSession;
  latestChat = newerChat;
  const body = await json(POST(pageSessionRequest("old", "old-guide")));
  expect(syncCalls[0]).toEqual({
    sessionId: existingSession.id,
    title: pageContext.page.title,
    pageUserSlug: pageContext.page.authorSlug,
    pageSlug: pageContext.page.uid,
  });
  expect(body.chat.id).toBe(newerChat.id);
});

test("creates chat session with default model and never kicks sandbox", async () => {
  const response = await POST(pageSessionRequest("alice", "guide"));
  expect(response.status).toBe(200);
  expect(createPageSessionCalls[0]).toMatchObject({
    publishedPageId: "page-1",
    pageUserSlug: "alice",
    pageSlug: "guide",
    modelId: "openai/gpt-5",
  });
  expect(kickSandboxProvisioningWorkflow).not.toHaveBeenCalled();
});

test("re-reads the winning active session after a 23505 race", async () => {
  createPageSessionError = Object.assign(new Error("duplicate"), { code: "23505" });
  activePageSessionAfterConflict = winnerSession;
  const body = await json(POST(pageSessionRequest("alice", "guide")));
  expect(body.session.id).toBe(winnerSession.id);
});

test("creates a new active session after the previous page session was archived", async () => {
  activePageSession = undefined;
  archivedPageSession = existingSession;
  const body = await json(POST(pageSessionRequest("alice", "guide")));
  expect(body.session.id).not.toBe(archivedPageSession.id);
  expect(createPageSessionCalls).toHaveLength(1);
});

test("applies the existing bot and per-user session creation limits", async () => {
  botVerification.isBot = true;
  expect((await POST(pageSessionRequest("alice", "guide"))).status).toBe(403);
  botVerification.isBot = false;
  rateLimitResponse = new Response("limited", { status: 429 });
  expect((await POST(pageSessionRequest("alice", "guide"))).status).toBe(429);
  expect(createPageSessionCalls).toHaveLength(0);
});

test("does not unarchive a page session when another active page session exists", async () => {
  currentOwnedSession = { ...archivedPageSession, agentType: "chat" };
  activePageSession = winnerSession;
  const response = await PATCH(sessionRequest({ status: "running" }), sessionContext);
  expect(response.status).toBe(409);
  await expect(response.json()).resolves.toEqual({
    error: "An active page session already exists",
    session_id: winnerSession.id,
  });
});
```

同时在既有 `/api/sessions` 测试加入断言：客户端提交 `{ agent_type: "chat" }` 时创建出的仍是 `work` session 且仍 kick provisioning，证明普通入口不能伪造 Page session。

- [ ] **Step 2: 运行 route 测试确认失败**

Run: `cd /root/github/LinXueyuanStdio/viben/apps/web && pnpm test:run app/api/page-sessions/route.test.ts app/api/sessions/route.test.ts`

Expected: FAIL，`/api/page-sessions` 路由不存在。

- [ ] **Step 3: 实现 service 与 route**

Route 只解析 snake_case JSON：

```ts
type PageSessionRequest = {
  user_slug: string;
  page_slug: string;
};
```

无效/空字符串返回 400；未登录返回 401；复用 `/api/sessions` 的 bot protection 和 `sessions-create` 用户 rate limit；页面不存在和不可读统一返回 404 `{ error: "Page not found" }`。service 流程固定为：

```text
getPublishedPageContext
  -> canReadPage
  -> getActivePageSession
       found: sync snapshot -> getLatestChatBySessionId
       missing: preferences -> create Page session + initial chat
       unique conflict: getActivePageSession -> getLatestChatBySessionId
  -> PageSessionResponse
```

`can_edit` 使用 `context.page.userId === input.userId`；团队管理者的扩展权限若已有公共 helper 则调用该 helper，禁止在 route 内复制权限 SQL。`url` 使用当前数据库 slug 构造 `/${encodeURIComponent(userSlug)}/${encodeURIComponent(pageSlug)}?tab=read`。

在 session PATCH 中，`agentType === "chat"` 且从 `archived` 改为非 archived 前调用 `getActivePageSession(userId, publishedPageId)`；若另一个 active session 已存在，返回上述 snake_case 409 response，不让数据库 partial unique violation 变成 500。work session 的 unarchive 流程不变。

- [ ] **Step 4: 运行 API 与回归测试**

Run: `cd /root/github/LinXueyuanStdio/viben/apps/web && pnpm test:run app/api/page-sessions/route.test.ts app/api/sessions/route.test.ts 'app/api/sessions/[sessionId]/route.test.ts' lib/db/sessions.test.ts`

Expected: PASS；Page 创建不调用 sandbox，普通 session 创建仍调用一次。

- [ ] **Step 5: 提交 Page session API**

```bash
git add apps/web/lib/page-chat/types.ts apps/web/lib/page-chat/page-session-service.ts apps/web/app/api/page-sessions/route.ts apps/web/app/api/page-sessions/route.test.ts apps/web/app/api/sessions/route.test.ts 'apps/web/app/api/sessions/[sessionId]/route.ts' 'apps/web/app/api/sessions/[sessionId]/route.test.ts'
git commit -m "feat(web): add page session get-or-create api"
```

## 子计划完成门槛

- [ ] `agent_type` 默认向后兼容，migration 不级联删除历史。
- [ ] active 唯一约束与 23505 winner 重读都有测试。
- [ ] API 未登录、页面不存在、无权限均不会创建 session。
- [ ] 恢复选择最新 chat，归档 session 不会被恢复。
- [ ] Page 创建路径没有 sandbox provisioning；普通 `/api/sessions` 行为不变。
- [ ] 将实际接口与总索引“跨计划公共接口”核对；如有必要先同步文档再交接。

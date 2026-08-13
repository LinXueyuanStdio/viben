# Page Chat Agent Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 Page Chat 的权限、安全、resource notification 同步和 `ChatTranscript` 抽取回归风险。

**Architecture:** Page 更新同步改为 server-side MCP resource notification -> workflow stream data part -> browser page event bus -> iframe container refresh。`ChatTranscript` 只负责渲染消息，不解析 tool result，不发布页面刷新事件。权限收口为：匿名只能读 public approved 页面，登录/API key/Page Chat JWE 走 `canReadPage`，`update_page` 和 Page Chat `can_edit` 仅页面作者为 true。

**Tech Stack:** Next.js App Router, TypeScript, Vitest, React Testing Library, `@modelcontextprotocol/sdk@1.29.0`, `mcp-handler`, AI SDK UI message stream.

## Global Constraints

- 生成 spec 和相关计划文档使用中文。
- 编辑文件时使用绝对路径。
- 不从 repo root 运行 `pnpm build` 或 `pnpm typecheck`；只在 `apps/web` 内运行本文列出的 `pnpm test:run <file...>` 和 `pnpm typecheck`。
- Gateway API query parameters 和文件存储字段使用 snake_case；新增 MCP payload 字段也使用 snake_case。
- 禁止 inline `import("path").TypeName`，使用文件顶部 `import type { ... } from "..."`。
- 禁止 `await import()` 动态导入，测试 mock 例外。
- resource URI 必须保持 `viben://` 开头，并模仿 API 路径：`viben://api/pages/{published_page_id}/content`。
- UI 不解析 `update_page` tool result；刷新只由 MCP notification 驱动。
- `ChatTranscript` 不 import `emitPageContentChanged`，不扫描 messages 来触发刷新。

---

## File Structure

- Create `apps/web/lib/page-chat/page-resource-uri.ts`
  - 只负责 page resource URI 构造和解析。
  - 不依赖 React、DB、MCP SDK。
- Create `apps/web/lib/page-chat/page-resource-uri.test.ts`
  - 覆盖 URI 构造、解析、拒绝旧格式和 malformed URI。
- Modify `apps/web/app/types.ts`
  - 增加 `WebAgentPageContentChangedData` 和 `"page-content-changed"` data part。
- Modify `apps/web/lib/page-chat/page-chat-context.ts`
  - 移除 Page Chat `canEdit` 对 `findEditablePage` 的依赖。
- Modify `apps/web/lib/page-chat/page-session-service.ts`
  - 创建/恢复 Page Chat session 时 `can_edit` 只按作者判断。
- Modify `apps/web/app/api/mcp/v1/route.ts`
  - 抽出本文件内读取 helper。
  - 修复 `get_page` 鉴权。
  - 注册最小 resource read/subscribe/unsubscribe。
  - `update_page` 成功后发送 `notifications/resources/updated`。
- Modify `apps/web/lib/page-chat/page-mcp-tools.ts`
  - 订阅当前 page content resource。
  - 收到 matching resource updated notification 后调用 runtime callback。
- Modify `apps/web/app/workflows/chat-page-runtime.ts`
  - 将 MCP notification callback 桥接成 `data-page-content-changed` stream chunk。
- Modify `apps/web/hooks/assistant/chat/use-session-chat-runtime.ts`
  - 收到 `data-page-content-changed` 后发布浏览器内 page event bus。
- Modify `apps/web/components/assistant/chat-transcript.tsx`
  - 删除 page update tool result 解析和 `onPageContentChanged` prop。
  - 保留工具调用渲染。
- Modify `apps/web/components/assistant/shared-chat-core.tsx`
  - transcript wrapper 改为 flex column。
  - Page mode 不传语义错误的 message-level retry。
  - 去掉 `onPageContentChanged` prop。
- Modify `apps/web/components/assistant/session-chat-content.tsx`
  - 清理抽取前残留的未使用 transcript 分组、scroll/copy state 和 imports。
- Modify tests:
  - `apps/web/app/api/mcp/v1/route.test.ts`
  - `apps/web/lib/page-chat/page-mcp-tools.test.ts`
  - `apps/web/components/assistant/chat-transcript.test.tsx`
  - `apps/web/components/assistant/shared-chat-core.test.tsx`
  - 新增 `apps/web/app/workflows/chat-page-runtime.test.ts`
  - 新增 `apps/web/hooks/assistant/chat/use-session-chat-runtime.test.ts`

---

### Task 1: Page Resource URI Helper

**Files:**
- Create: `apps/web/lib/page-chat/page-resource-uri.ts`
- Create: `apps/web/lib/page-chat/page-resource-uri.test.ts`

**Interfaces:**
- Produces:
  - `buildPublishedPageContentResourceUri(publishedPageId: string): string`
  - `parsePageResourceUri(uri: string): PageResourceUri | null`
  - `type PageResourceUri = { type: "published_page_content"; publishedPageId: string }`

- [ ] **Step 1: Write failing URI helper tests**

Create `apps/web/lib/page-chat/page-resource-uri.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import {
  buildPublishedPageContentResourceUri,
  parsePageResourceUri,
} from "./page-resource-uri";

describe("page resource URI", () => {
  test("builds API-shaped page content URI", () => {
    expect(buildPublishedPageContentResourceUri("page-1")).toBe(
      "viben://api/pages/page-1/content",
    );
  });

  test("parses published page content URI", () => {
    expect(parsePageResourceUri("viben://api/pages/page-1/content")).toEqual({
      type: "published_page_content",
      publishedPageId: "page-1",
    });
  });

  test("rejects malformed or unsupported URIs", () => {
    expect(parsePageResourceUri("viben://api/pages//content")).toBeNull();
    expect(parsePageResourceUri("viben://api/pages/page-1")).toBeNull();
    expect(parsePageResourceUri("viben://api/pages/page-1/content/extra")).toBeNull();
    expect(parsePageResourceUri("viben://api/pages/page-1/content?x=1")).toBeNull();
    expect(parsePageResourceUri("viben://page/v1/published/page-1/content")).toBeNull();
    expect(parsePageResourceUri("viben-page://published/page-1")).toBeNull();
  });

  test("rejects unsafe page ids when building", () => {
    expect(() => buildPublishedPageContentResourceUri("")).toThrow(
      "publishedPageId is required",
    );
    expect(() => buildPublishedPageContentResourceUri("a/b")).toThrow(
      "publishedPageId must not contain slash",
    );
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```bash
cd /root/github/LinXueyuanStdio/viben/apps/web
pnpm test:run lib/page-chat/page-resource-uri.test.ts
```

Expected: FAIL because `page-resource-uri.ts` does not exist.

- [ ] **Step 3: Implement URI helper**

Create `apps/web/lib/page-chat/page-resource-uri.ts`:

```ts
export const PAGE_RESOURCE_SCHEME = "viben";
export const PAGE_RESOURCE_AUTHORITY = "api";
export const PAGE_RESOURCE_PAGES_SEGMENT = "pages";
export const PAGE_RESOURCE_CONTENT_SEGMENT = "content";

export type PageResourceUri = {
  type: "published_page_content";
  publishedPageId: string;
};

export function buildPublishedPageContentResourceUri(
  publishedPageId: string,
): string {
  if (!publishedPageId) {
    throw new Error("publishedPageId is required");
  }
  if (publishedPageId.includes("/")) {
    throw new Error("publishedPageId must not contain slash");
  }
  return `${PAGE_RESOURCE_SCHEME}://${PAGE_RESOURCE_AUTHORITY}/${PAGE_RESOURCE_PAGES_SEGMENT}/${encodeURIComponent(publishedPageId)}/${PAGE_RESOURCE_CONTENT_SEGMENT}`;
}

export function parsePageResourceUri(uri: string): PageResourceUri | null {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    return null;
  }

  if (parsed.protocol !== `${PAGE_RESOURCE_SCHEME}:`) return null;
  if (parsed.hostname !== PAGE_RESOURCE_AUTHORITY) return null;
  if (parsed.search || parsed.hash) return null;

  const segments = parsed.pathname.split("/").filter(Boolean);
  if (
    segments.length !== 3 ||
    segments[0] !== PAGE_RESOURCE_PAGES_SEGMENT ||
    segments[2] !== PAGE_RESOURCE_CONTENT_SEGMENT
  ) {
    return null;
  }

  const publishedPageId = decodeURIComponent(segments[1] ?? "");
  if (!publishedPageId || publishedPageId.includes("/")) {
    return null;
  }

  return { type: "published_page_content", publishedPageId };
}
```

- [ ] **Step 4: Run test and verify it passes**

Run:

```bash
cd /root/github/LinXueyuanStdio/viben/apps/web
pnpm test:run lib/page-chat/page-resource-uri.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add /root/github/LinXueyuanStdio/viben/apps/web/lib/page-chat/page-resource-uri.ts /root/github/LinXueyuanStdio/viben/apps/web/lib/page-chat/page-resource-uri.test.ts
git commit -m "feat(web): add page resource uri helper"
```

---

### Task 2: Author-Only Page Chat Edit Capability

**Files:**
- Modify: `apps/web/lib/page-chat/page-chat-context.ts`
- Modify: `apps/web/lib/page-chat/page-session-service.ts`
- Test: `apps/web/lib/page-chat/page-mcp-tools.test.ts`
- Test: `apps/web/app/api/page-sessions/route.test.ts`

**Interfaces:**
- Consumes:
  - Existing `resolvePageChatContext({ sessionId, userId })`.
  - Existing `getOrCreatePageSession(input)`.
- Produces:
  - `PageChatContext.canEdit` is true only when `page.userId === input.userId`.
  - `PageSessionResponse.page.can_edit` is true only when `context.page.userId === input.userId`.

- [ ] **Step 1: Write failing tests for author-only canEdit**

In `apps/web/lib/page-chat/page-mcp-tools.test.ts`, replace expectations that allow collaborator edit with explicit author-only tests:

```ts
test("resolves canEdit true only for the page author", async () => {
  const { resolvePageChatContext } = await contextModulePromise;

  mocks.pageRecord = { ...pageRecord, userId: "user-1" };
  mocks.editablePage = null;
  await expect(
    resolvePageChatContext({ sessionId: "session-chat", userId: "user-1" }),
  ).resolves.toMatchObject({
    page: { canEdit: true },
  });

  mocks.pageRecord = { ...pageRecord, userId: "author-1" };
  mocks.editablePage = { ...pageRecord, id: "page-1" };
  await expect(
    resolvePageChatContext({ sessionId: "session-chat", userId: "user-1" }),
  ).resolves.toMatchObject({
    page: { canEdit: false },
  });
});
```

In `apps/web/app/api/page-sessions/route.test.ts`, replace `"reports can_edit for a team page manager using the shared permission helper"` with:

```ts
test("reports can_edit true only for the page author", async () => {
  const { POST } = await routeModulePromise;

  mocks.pageContext = {
    ...mocks.pageContext,
    page: { ...mocks.pageContext?.page, userId: "user-1" },
  };
  let body = await json(POST(pageSessionRequest("alice", "guide")));
  expect(body.page.can_edit).toBe(true);

  mocks.pageContext = {
    ...mocks.pageContext,
    page: { ...mocks.pageContext?.page, userId: "author-1" },
  };
  mocks.editablePage = { ...mocks.pageContext?.page, id: "page-1" };
  body = await json(POST(pageSessionRequest("alice", "guide")));
  expect(body.page.can_edit).toBe(false);
  expect(mocks.findEditablePage).not.toHaveBeenCalled();
});
```

Replace `"does not grant can_edit when the permission helper resolves a different page"` with:

```ts
test("does not grant can_edit for non-authors", async () => {
  const { POST } = await routeModulePromise;

  mocks.pageContext = {
    ...mocks.pageContext,
    page: { ...mocks.pageContext?.page, userId: "author-1" },
  };

  const body = await json(POST(pageSessionRequest("alice", "guide")));

  expect(body.page.can_edit).toBe(false);
  expect(mocks.findEditablePage).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```bash
cd /root/github/LinXueyuanStdio/viben/apps/web
pnpm test:run lib/page-chat/page-mcp-tools.test.ts app/api/page-sessions/route.test.ts
```

Expected: FAIL because `findEditablePage` still makes collaborators editable.

- [ ] **Step 3: Implement author-only canEdit**

In `apps/web/lib/page-chat/page-chat-context.ts`:

- Remove `findEditablePage` import.
- Remove `const editablePage = await findEditablePage(...)`.
- Replace `canEdit` calculation with:

```ts
const canEdit = page.userId === input.userId;
```

In `apps/web/lib/page-chat/page-session-service.ts`:

- Remove `findEditablePage` import.
- Remove `const editablePage = await findEditablePage(...)`.
- Replace `canEdit` calculation with:

```ts
const canEdit = context.page.userId === input.userId;
```

- [ ] **Step 4: Run tests and verify they pass**

Run:

```bash
cd /root/github/LinXueyuanStdio/viben/apps/web
pnpm test:run lib/page-chat/page-mcp-tools.test.ts app/api/page-sessions/route.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add /root/github/LinXueyuanStdio/viben/apps/web/lib/page-chat/page-chat-context.ts /root/github/LinXueyuanStdio/viben/apps/web/lib/page-chat/page-session-service.ts /root/github/LinXueyuanStdio/viben/apps/web/lib/page-chat/page-mcp-tools.test.ts /root/github/LinXueyuanStdio/viben/apps/web/app/api/page-sessions/route.test.ts
git commit -m "fix(web): restrict page chat edits to authors"
```

---

### Task 3: MCP Route Read Authorization And Page Resource Protocol

**Files:**
- Modify: `apps/web/app/api/mcp/v1/route.ts`
- Modify: `apps/web/app/api/mcp/v1/route.test.ts`
- Use: `apps/web/lib/page-chat/page-resource-uri.ts`

**Interfaces:**
- Consumes:
  - `buildPublishedPageContentResourceUri(publishedPageId: string): string`
  - `parsePageResourceUri(uri: string): PageResourceUri | null`
- Produces:
  - `get_page` returns page only when anonymous public approved or authenticated `canReadPage`.
  - `resources/read` returns `PublishedPageContentResourcePayload`.
  - `resources/subscribe` and `resources/unsubscribe` accept only valid page content URI.
  - `update_page` sends `notifications/resources/updated` for `viben://api/pages/{id}/content`.

- [ ] **Step 1: Extend route test MCP server mock**

In `apps/web/app/api/mcp/v1/route.test.ts`, change the mocked server object so tests can call resource handlers and inspect notifications:

```ts
const mocks = vi.hoisted(() => {
  const tools = new Map<string, (args: Record<string, unknown>, extra?: Record<string, unknown>) => unknown>();
  const requestHandlers = new Map<string, (request: Record<string, unknown>, extra?: Record<string, unknown>) => unknown>();
  return {
    tools,
    requestHandlers,
    authUserId: "user-1" as string | null,
    canReadPage: true,
    isPublicPage: true,
    sentNotifications: [] as Record<string, unknown>[],
    sendNotification: vi.fn(async (notification: Record<string, unknown>) => {
      mocks.sentNotifications.push(notification);
    }),
  };
});
```

When mocking `createMcpHandler`, pass `extra` into tool executions:

```ts
return Response.json(
  await execute(body.args ?? {}, { sendNotification: mocks.sendNotification }),
);
```

Add a `server.server.setRequestHandler` mock:

```ts
server: {
  setRequestHandler: (schema: { shape?: { method?: { value?: string } } }, handler: (request: Record<string, unknown>) => unknown) => {
    const method = schema.shape?.method?.value;
    if (typeof method === "string") {
      mocks.requestHandlers.set(method, handler);
    }
  },
  sendResourceUpdated: vi.fn(async (params: Record<string, unknown>) => {
    await mocks.sendNotification({
      method: "notifications/resources/updated",
      params,
    });
  }),
},
```

Update the existing `withMcpAuth` mock so tests can exercise anonymous requests:

```ts
withMcpAuth:
  (handler: (request: Request) => Promise<Response>) => async (
    request: Request,
  ) => {
    if (mocks.authUserId) {
      Object.assign(request, { auth: { userId: mocks.authUserId } });
    }
    return handler(request);
  },
```

Update the existing community service mock:

```ts
vi.mock("@/lib/services/community", () => ({
  recordPageUpdateAndNotify: mocks.recordPageUpdateAndNotify,
  canReadPage: () => mocks.canReadPage,
  isPublicPage: () => mocks.isPublicPage,
}));
```

If the SDK schema mock cannot expose `shape.method.value`, mock `@modelcontextprotocol/sdk/types.js` in this test file with simple schema objects:

```ts
vi.mock("@modelcontextprotocol/sdk/types.js", () => ({
  ReadResourceRequestSchema: { shape: { method: { value: "resources/read" } } },
  SubscribeRequestSchema: { shape: { method: { value: "resources/subscribe" } } },
  UnsubscribeRequestSchema: { shape: { method: { value: "resources/unsubscribe" } } },
}));
```

- [ ] **Step 2: Write failing MCP permission and notification tests**

Add tests in `route.test.ts`:

```ts
test("anonymous get_page only reads public approved pages", async () => {
  const { POST } = await routeModulePromise;

  mocks.authUserId = null;
  mocks.existingPage = {
    ...mocks.existingPage,
    visibility: "private",
    moderationStatus: "approved",
  };

  const denied = await POST(toolRequest("get_page", {
    author_slug: "alice",
    page_uid: "guide",
  }));
  await expect(denied.json()).resolves.toMatchObject({ isError: true });

  mocks.existingPage = {
    ...mocks.existingPage,
    visibility: "public",
    moderationStatus: "approved",
  };

  const allowed = await POST(toolRequest("get_page", {
    author_slug: "alice",
    page_uid: "guide",
  }));
  const body = await allowed.json();
  expect(body.isError).not.toBe(true);
  expect(body.content[0].text).toContain("\"html\":\"<main>old</main>\"");
});

test("authenticated get_page uses canReadPage", async () => {
  const { POST } = await routeModulePromise;

  mocks.authUserId = "user-1";
  mocks.canReadPage = false;

  const denied = await POST(toolRequest("get_page", {
    author_slug: "alice",
    page_uid: "guide",
  }));
  await expect(denied.json()).resolves.toMatchObject({ isError: true });

  mocks.canReadPage = true;
  const allowed = await POST(toolRequest("get_page", {
    author_slug: "alice",
    page_uid: "guide",
  }));
  const body = await allowed.json();
  expect(body.isError).not.toBe(true);
});

test("update_page emits resource updated notification for page content URI", async () => {
  const { POST } = await routeModulePromise;

  await POST(toolRequest("update_page", {
    uid: "guide",
    html: "<main>latest</main>",
  }));

  expect(mocks.sendNotification).toHaveBeenCalledWith({
    method: "notifications/resources/updated",
    params: { uri: "viben://api/pages/page-1/content" },
  });
});
```

- [ ] **Step 3: Run tests and verify they fail**

Run:

```bash
cd /root/github/LinXueyuanStdio/viben/apps/web
pnpm test:run app/api/mcp/v1/route.test.ts
```

Expected: FAIL because `get_page` lacks authorization and `update_page` does not send resource notification.

- [ ] **Step 4: Implement route helpers and resource handlers**

In `apps/web/app/api/mcp/v1/route.ts`:

Add imports:

```ts
import {
  ReadResourceRequestSchema,
  SubscribeRequestSchema,
  UnsubscribeRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  buildPublishedPageContentResourceUri,
  parsePageResourceUri,
} from "@/lib/page-chat/page-resource-uri";
import { canReadPage, isPublicPage } from "@/lib/services/community";
```

Add file-local helpers near `revalidatePageCacheTags`:

```ts
type PublishedPage = typeof publishedPages.$inferSelect;

async function findReadablePageForMcp(input: {
  authorSlug?: string;
  pageUid?: string;
  publishedPageId?: string;
  session: Session | null;
}): Promise<PublishedPage | null> {
  const page = input.publishedPageId
    ? await db.query.publishedPages.findFirst({
        where: eq(publishedPages.id, input.publishedPageId),
      })
    : await db.query.publishedPages.findFirst({
        where: and(
          eq(publishedPages.authorSlug, input.authorSlug ?? ""),
          eq(publishedPages.uid, input.pageUid ?? ""),
        ),
      });

  if (!page) return null;
  if (!input.session) {
    return isPublicPage(page) ? page : null;
  }
  return canReadPage(page, input.session) ? page : null;
}

function buildPagePayload(page: PublishedPage) {
  return {
    resource_kind: "published_page_content" as const,
    resource_version: "v1" as const,
    published_page_id: page.id,
    uid: page.uid,
    title: page.title,
    html: page.html,
    description: page.description,
    tags: page.tags,
    visibility: page.visibility,
    moderation_status: page.moderationStatus,
    current_version: page.currentVersion,
    updated_at: page.updatedAt?.toISOString?.() ?? null,
    author: {
      display_name: page.authorDisplayName,
      avatar_url: page.authorAvatarUrl,
      slug: page.authorSlug,
    },
  };
}

function pageNotFoundToolResult() {
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ error: "Page not found" }) }],
    isError: true,
  };
}
```

Update `get_page` tool callback:

```ts
const page = await findReadablePageForMcp({
  authorSlug: author_slug,
  pageUid: page_uid,
  session: sessionStore.getStore(),
});
if (!page) return pageNotFoundToolResult();
return {
  content: [{ type: "text" as const, text: JSON.stringify(buildPagePayload(page)) }],
};
```

Register request handlers inside the existing callback passed to `createMcpHandler` after tools are registered:

```ts
server.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const parsed = parsePageResourceUri(request.params.uri);
  if (!parsed || parsed.type !== "published_page_content") {
    throw new Error("Resource not found");
  }
  const page = await findReadablePageForMcp({
    publishedPageId: parsed.publishedPageId,
    session: sessionStore.getStore(),
  });
  if (!page) {
    throw new Error("Resource not found");
  }
  return {
    contents: [{
      uri: request.params.uri,
      mimeType: "application/json",
      text: JSON.stringify(buildPagePayload(page)),
    }],
  };
});

server.server.setRequestHandler(SubscribeRequestSchema, async (request) => {
  const parsed = parsePageResourceUri(request.params.uri);
  if (!parsed || parsed.type !== "published_page_content") {
    throw new Error("Resource not found");
  }
  return {};
});

server.server.setRequestHandler(UnsubscribeRequestSchema, async (request) => {
  const parsed = parsePageResourceUri(request.params.uri);
  if (!parsed || parsed.type !== "published_page_content") {
    throw new Error("Resource not found");
  }
  return {};
});
```

In `update_page` callback, use `extra` parameter and send notification after cache invalidation:

```ts
async ({ uid, title, html, description, tags, visibility, cover_url }, extra) => {
  // existing update logic
  await extra.sendNotification({
    method: "notifications/resources/updated",
    params: {
      uri: buildPublishedPageContentResourceUri(existing.id),
    },
  });
  return existingResult;
}
```

- [ ] **Step 5: Run route tests**

Run:

```bash
cd /root/github/LinXueyuanStdio/viben/apps/web
pnpm test:run app/api/mcp/v1/route.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add /root/github/LinXueyuanStdio/viben/apps/web/app/api/mcp/v1/route.ts /root/github/LinXueyuanStdio/viben/apps/web/app/api/mcp/v1/route.test.ts
git commit -m "fix(web): authorize page mcp reads and notify resources"
```

---

### Task 4: Page MCP Client Resource Subscription

**Files:**
- Modify: `apps/web/lib/page-chat/page-mcp-tools.ts`
- Modify: `apps/web/lib/page-chat/page-mcp-tools.test.ts`

**Interfaces:**
- Consumes:
  - `buildPublishedPageContentResourceUri`
  - `parsePageResourceUri`
  - SDK `Client.subscribeResource`, `Client.unsubscribeResource`, `Client.setNotificationHandler`.
- Produces:
  - `createPageMcpTools(input)` accepts `onPageResourceUpdated?: (publishedPageId: string) => void | Promise<void>`.
  - `PageMcpToolRuntime.close()` unsubscribes and closes.

- [ ] **Step 1: Extend Client mock and write failing subscription tests**

In `page-mcp-tools.test.ts`, extend `mocks`:

```ts
clientSubscribeResource: vi.fn(),
clientUnsubscribeResource: vi.fn(),
clientSetNotificationHandler: vi.fn(),
notificationHandlers: new Map<string, (notification: Record<string, any>) => unknown>(),
```

Extend mocked `Client`:

```ts
setNotificationHandler(schema: Record<string, any>, handler: (notification: Record<string, any>) => unknown) {
  mocks.clientSetNotificationHandler(schema);
  mocks.notificationHandlers.set("notifications/resources/updated", handler);
}

async subscribeResource(input: Record<string, unknown>) {
  mocks.clientSubscribeResource(input);
}

async unsubscribeResource(input: Record<string, unknown>) {
  mocks.clientUnsubscribeResource(input);
}
```

Add tests:

```ts
test("subscribes to current page content resource and unsubscribes on close", async () => {
  const { createPageMcpTools } = await toolsModulePromise;
  const runtime = await createPageMcpTools({
    endpoint: new URL("http://localhost/api/mcp/v1"),
    bearerToken: "test-jwe-token",
    page: {
      publishedPageId: "page-1",
      userSlug: "alice",
      pageSlug: "guide",
      title: "Guide",
      canEdit: true,
      url: "/alice/guide?tab=read",
    },
  });

  expect(mocks.clientSubscribeResource).toHaveBeenCalledWith({
    uri: "viben://api/pages/page-1/content",
  });

  await runtime.close();

  expect(mocks.clientUnsubscribeResource).toHaveBeenCalledWith({
    uri: "viben://api/pages/page-1/content",
  });
  expect(mocks.clientClose).toHaveBeenCalledOnce();
});

test("calls onPageResourceUpdated only for matching page content notifications", async () => {
  const { createPageMcpTools } = await toolsModulePromise;
  const onPageResourceUpdated = vi.fn();
  await createPageMcpTools({
    endpoint: new URL("http://localhost/api/mcp/v1"),
    bearerToken: "test-jwe-token",
    page: {
      publishedPageId: "page-1",
      userSlug: "alice",
      pageSlug: "guide",
      title: "Guide",
      canEdit: true,
      url: "/alice/guide?tab=read",
    },
    onPageResourceUpdated,
  });

  const handler = mocks.notificationHandlers.get("notifications/resources/updated");
  expect(handler).toBeDefined();

  await handler?.({ method: "notifications/resources/updated", params: { uri: "viben://api/pages/page-2/content" } });
  await handler?.({ method: "notifications/resources/updated", params: { uri: "viben://api/pages/page-1/metadata" } });
  expect(onPageResourceUpdated).not.toHaveBeenCalled();

  await handler?.({ method: "notifications/resources/updated", params: { uri: "viben://api/pages/page-1/content" } });
  expect(onPageResourceUpdated).toHaveBeenCalledWith("page-1");
});
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```bash
cd /root/github/LinXueyuanStdio/viben/apps/web
pnpm test:run lib/page-chat/page-mcp-tools.test.ts
```

Expected: FAIL because client does not subscribe or handle notifications.

- [ ] **Step 3: Implement subscription helper**

In `page-mcp-tools.ts`, add imports:

```ts
import { ResourceUpdatedNotificationSchema } from "@modelcontextprotocol/sdk/types.js";
import {
  buildPublishedPageContentResourceUri,
  parsePageResourceUri,
} from "./page-resource-uri";
```

Add input field:

```ts
onPageResourceUpdated?: (publishedPageId: string) => void | Promise<void>;
```

Add internal helper:

```ts
async function subscribePageContentResource(input: {
  client: Client;
  uri: string;
  publishedPageId: string;
  onUpdated?: (publishedPageId: string) => void | Promise<void>;
}): Promise<() => Promise<void>> {
  input.client.setNotificationHandler(
    ResourceUpdatedNotificationSchema,
    async (notification) => {
      const parsed = parsePageResourceUri(notification.params.uri);
      if (
        parsed?.type !== "published_page_content" ||
        parsed.publishedPageId !== input.publishedPageId
      ) {
        return;
      }
      await input.onUpdated?.(parsed.publishedPageId);
    },
  );

  await input.client.subscribeResource({ uri: input.uri });

  return async () => {
    try {
      await input.client.unsubscribeResource({ uri: input.uri });
    } catch {
      // Best-effort cleanup. Closing the client is still required.
    }
  };
}
```

In `createPageMcpTools`, after `client.connect(transport)`:

```ts
const pageResourceUri = buildPublishedPageContentResourceUri(
  input.page.publishedPageId,
);
const unsubscribePageResource = await subscribePageContentResource({
  client,
  uri: pageResourceUri,
  publishedPageId: input.page.publishedPageId,
  onUpdated: input.onPageResourceUpdated,
});
```

Return close:

```ts
close: async () => {
  await unsubscribePageResource();
  await client.close();
},
```

- [ ] **Step 4: Run tests**

Run:

```bash
cd /root/github/LinXueyuanStdio/viben/apps/web
pnpm test:run lib/page-chat/page-mcp-tools.test.ts lib/page-chat/page-resource-uri.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add /root/github/LinXueyuanStdio/viben/apps/web/lib/page-chat/page-mcp-tools.ts /root/github/LinXueyuanStdio/viben/apps/web/lib/page-chat/page-mcp-tools.test.ts
git commit -m "feat(web): subscribe page chat to page resources"
```

---

### Task 5: Server Workflow Data Part Bridge

**Files:**
- Modify: `apps/web/app/types.ts`
- Modify: `apps/web/app/workflows/chat-page-runtime.ts`
- Test: `apps/web/app/workflows/chat.test.ts` or create `apps/web/app/workflows/chat-page-runtime.test.ts`

**Interfaces:**
- Produces:
  - `type WebAgentPageContentChangedData = { publishedPageId: string; chatId: string }`
  - `"page-content-changed": WebAgentPageContentChangedData`
  - `sendPageContentChangedPart({ writable, publishedPageId, chatId }): Promise<void>` as file-local helper.

- [ ] **Step 1: Write failing workflow bridge test**

Create `apps/web/app/workflows/chat-page-runtime.test.ts` with focused mocks. The test should verify that `createPageMcpTools` receives callback and callback writes a data part:

```ts
import { describe, expect, test, vi } from "vitest";
import type { UIMessageChunk } from "ai";
import { runPageAgentStep } from "./chat-page-runtime";

const mocks = vi.hoisted(() => ({
  onPageResourceUpdated: undefined as undefined | ((publishedPageId: string) => Promise<void> | void),
  createPageMcpTools: vi.fn(async (input: { onPageResourceUpdated?: (publishedPageId: string) => Promise<void> | void }) => {
    mocks.onPageResourceUpdated = input.onPageResourceUpdated;
    return { tools: {}, close: vi.fn(async () => undefined) };
  }),
  resolvePageChatContext: vi.fn(async () => ({
    page: {
      publishedPageId: "page-1",
      userSlug: "alice",
      pageSlug: "guide",
      title: "Guide",
      canEdit: true,
      url: "/alice/guide?tab=read",
    },
    bearerToken: "token",
  })),
  streamParts: [] as UIMessageChunk[],
}));
```

Mock `pageAgent.stream` so `runPageAgentStep` starts and leaves callback available. The expected assertion:

```ts
expect(mocks.onPageResourceUpdated).toBeTypeOf("function");
await mocks.onPageResourceUpdated?.("page-1");
expect(writtenChunks).toContainEqual({
  type: "data-page-content-changed",
  id: "chat-1:page-content-changed:page-1",
  data: { publishedPageId: "page-1", chatId: "chat-1" },
});
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```bash
cd /root/github/LinXueyuanStdio/viben/apps/web
pnpm test:run app/workflows/chat-page-runtime.test.ts
```

Expected: FAIL because the callback and data type do not exist.

- [ ] **Step 3: Add data part type**

In `apps/web/app/types.ts`:

```ts
export type WebAgentPageContentChangedData = {
  publishedPageId: string;
  chatId: string;
};
```

Add to `WebAgentDataParts`:

```ts
"page-content-changed": WebAgentPageContentChangedData;
```

- [ ] **Step 4: Implement workflow helper and callback**

In `chat-page-runtime.ts`, add file-local helper:

```ts
async function sendPageContentChangedPart(input: {
  writable: Writable;
  publishedPageId: string;
  chatId: string;
}): Promise<void> {
  const writer = input.writable.getWriter();
  try {
    await writer.write({
      type: "data-page-content-changed",
      id: `${input.chatId}:page-content-changed:${input.publishedPageId}`,
      data: {
        publishedPageId: input.publishedPageId,
        chatId: input.chatId,
      },
    });
  } finally {
    writer.releaseLock();
  }
}
```

Pass callback into `createPageMcpTools`:

```ts
const runtime = await createPageMcpTools({
  endpoint: new URL("/api/mcp/v1", input.requestUrl),
  bearerToken,
  page,
  onPageResourceUpdated: async (publishedPageId) => {
    try {
      await sendPageContentChangedPart({
        writable: input.writable,
        publishedPageId,
        chatId: input.chatId,
      });
    } catch (error) {
      console.error("Failed to send page content changed part", error);
    }
  },
});
```

- [ ] **Step 5: Run tests**

Run:

```bash
cd /root/github/LinXueyuanStdio/viben/apps/web
pnpm test:run app/workflows/chat-page-runtime.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add /root/github/LinXueyuanStdio/viben/apps/web/app/types.ts /root/github/LinXueyuanStdio/viben/apps/web/app/workflows/chat-page-runtime.ts /root/github/LinXueyuanStdio/viben/apps/web/app/workflows/chat-page-runtime.test.ts
git commit -m "feat(web): stream page resource update events"
```

---

### Task 6: Browser Runtime Publishes Page Event Bus

**Files:**
- Modify: `apps/web/hooks/assistant/chat/use-session-chat-runtime.ts`
- Create: `apps/web/hooks/assistant/chat/use-session-chat-runtime.test.ts`

**Interfaces:**
- Consumes:
  - `data-page-content-changed` data part from AI SDK stream.
  - `emitPageContentChanged(detail)` from `apps/web/lib/page-chat/page-content-events.ts`.
- Produces:
  - Browser event bus publish only for valid `{ publishedPageId, chatId }`.

- [ ] **Step 1: Write failing runtime onData test**

Create `use-session-chat-runtime.test.ts` with `getOrCreateChatInstance` mock capturing `onData`:

```ts
import { describe, expect, test, vi } from "vitest";
import { useSessionChatRuntime } from "./use-session-chat-runtime";

const mocks = vi.hoisted(() => ({
  capturedOnData: undefined as undefined | ((dataPart: { type: string; data?: unknown }) => void),
  emitPageContentChanged: vi.fn(),
}));

vi.mock("@ai-sdk/react", () => ({
  useChat: vi.fn(() => ({
    status: "ready",
    messages: [],
    clearError: vi.fn(),
    resumeStream: vi.fn(),
    stop: vi.fn(),
  })),
}));

vi.mock("@/lib/chat-instance-manager", () => ({
  abortChatInstanceTransport: vi.fn(),
  getOrCreateChatInstance: vi.fn((_chatId: string, options: { onData: typeof mocks.capturedOnData }) => {
    mocks.capturedOnData = options.onData;
    return {
      instance: {
        id: "chat-1",
        status: "ready",
        messages: [],
        stop: vi.fn(),
      },
      alreadyExisted: false,
    };
  }),
}));

vi.mock("@/lib/page-chat/page-content-events", () => ({
  emitPageContentChanged: mocks.emitPageContentChanged,
}));
```

Use `renderHook`:

```ts
test("publishes page event from data-page-content-changed", () => {
  renderHook(() =>
    useSessionChatRuntime({
      sessionId: "session-1",
      chatId: "chat-1",
      initialMessages: [],
      initialChatActiveStreamId: null,
      contextLimit: null,
    }),
  );

  mocks.capturedOnData?.({
    type: "data-page-content-changed",
    data: { publishedPageId: "page-1", chatId: "chat-1" },
  });

  expect(mocks.emitPageContentChanged).toHaveBeenCalledWith({
    publishedPageId: "page-1",
    chatId: "chat-1",
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```bash
cd /root/github/LinXueyuanStdio/viben/apps/web
pnpm test:run hooks/assistant/chat/use-session-chat-runtime.test.ts
```

Expected: FAIL because `data-page-content-changed` is ignored.

- [ ] **Step 3: Implement onData handler**

In `use-session-chat-runtime.ts`:

Add imports:

```ts
import type {
  WebAgentPageContentChangedData,
  WebAgentUIMessage,
  WebAgentWorkspaceStatusData,
} from "@/app/types";
import { emitPageContentChanged } from "@/lib/page-chat/page-content-events";
```

Add helper near `shouldAutoSubmit`:

```ts
function isPageContentChangedData(
  data: unknown,
): data is WebAgentPageContentChangedData {
  return (
    typeof data === "object" &&
    data !== null &&
    "publishedPageId" in data &&
    "chatId" in data &&
    typeof data.publishedPageId === "string" &&
    typeof data.chatId === "string"
  );
}
```

Extend `onData`:

```ts
onData: (dataPart) => {
  if (dataPart.type === "data-workspace-status") {
    setChatWorkspaceStatus(chatId, dataPart.data as WebAgentWorkspaceStatusData);
    return;
  }

  if (
    dataPart.type === "data-page-content-changed" &&
    isPageContentChangedData(dataPart.data)
  ) {
    emitPageContentChanged(dataPart.data);
  }
},
```

- [ ] **Step 4: Run tests**

Run:

```bash
cd /root/github/LinXueyuanStdio/viben/apps/web
pnpm test:run hooks/assistant/chat/use-session-chat-runtime.test.ts lib/page-chat/page-content-events.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add /root/github/LinXueyuanStdio/viben/apps/web/hooks/assistant/chat/use-session-chat-runtime.ts /root/github/LinXueyuanStdio/viben/apps/web/hooks/assistant/chat/use-session-chat-runtime.test.ts
git commit -m "feat(web): publish page updates from chat data parts"
```

---

### Task 7: Remove ChatTranscript Page Sync Coupling And Fix SharedChatCore Page Actions

**Files:**
- Modify: `apps/web/components/assistant/chat-transcript.tsx`
- Modify: `apps/web/components/assistant/shared-chat-core.tsx`
- Modify: `apps/web/components/assistant/chat-transcript.test.tsx`
- Modify: `apps/web/components/assistant/shared-chat-core.test.tsx`

**Interfaces:**
- Produces:
  - `ChatTranscriptProps` no longer contains `onPageContentChanged`.
  - `ChatTranscript` does not import or call page event bus.
  - `SharedChatCore` does not pass `onPageContentChanged`.
  - Page mode omits `onRetryMessage` unless a caller explicitly supplies it through `transcriptProps`.

- [ ] **Step 1: Change ChatTranscript test to negative page sync test**

In `chat-transcript.test.tsx`, replace `"reports a successful update_page result once"` with:

```ts
test("does not emit page updates from update_page tool output", () => {
  const messages = [
    {
      id: "assistant-1",
      role: "assistant",
      parts: [
        {
          type: "tool-update_page",
          toolCallId: "tool-update-1",
          toolName: "update_page",
          state: "output-available",
          input: {},
          output: {
            success: true,
            published_page_id: "page-1",
            chat_id: "chat-1",
          },
        },
        { type: "text", text: "Updated." },
      ],
    } as WebAgentUIMessage,
  ];

  render(<ChatTranscript {...baseProps} messages={messages} />);

  expect(screen.getByTestId("tool-call")).toHaveTextContent("update_page");
  expect(screen.getByTestId("assistant-text")).toHaveTextContent("Updated.");
});
```

Add a test for absent retry when callback is absent:

```ts
test("omits user retry action when onRetryMessage is absent", () => {
  render(
    <ChatTranscript
      {...baseProps}
      onRetryMessage={undefined}
      messages={[textMessage("user-1", "user", "Prompt")]}
    />,
  );

  expect(screen.queryByRole("button", { name: /retry|resend/i })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
cd /root/github/LinXueyuanStdio/viben/apps/web
pnpm test:run components/assistant/chat-transcript.test.tsx
```

Expected: FAIL if `ChatTranscriptProps` still requires old prop or still emits page update.

- [ ] **Step 3: Remove ChatTranscript page sync code**

In `chat-transcript.tsx`:

- Remove import from `@/lib/page-chat/page-content-events`.
- Remove `onPageContentChanged` from `ChatTranscriptProps`.
- Remove `parseToolOutput`, `getPageContentChangedDetail`, `notifiedToolCallsRef`, and the `useEffect` that scans `messages` for `update_page`.
- Keep tool result rendering unchanged.

In `shared-chat-core.tsx`:

- Remove `PageContentChangedDetail` import.
- Remove `onPageContentChanged` from `SharedChatCoreProps`.
- Remove `onPageContentChanged` destructuring.
- Remove `<ChatTranscript onPageContentChanged={onPageContentChanged} />`.
- Change transcript wrapper:

```tsx
<div className="flex min-h-0 flex-1 flex-col">
```

- Change retry prop:

```tsx
onRetryMessage={
  mode === "work" ? () => runtime.retryChatStream() : undefined
}
```

Keep `{...transcriptProps}` after this so Work Chat can still override through `transcriptProps`.

- [ ] **Step 4: Run focused tests**

Run:

```bash
cd /root/github/LinXueyuanStdio/viben/apps/web
pnpm test:run components/assistant/chat-transcript.test.tsx components/assistant/shared-chat-core.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Search for forbidden coupling**

Run:

```bash
cd /root/github/LinXueyuanStdio/viben
rg -n "onPageContentChanged|parseToolOutput|getPageContentChangedDetail|notifiedToolCallsRef|emitPageContentChanged" apps/web/components/assistant apps/web/components/pages
```

Expected: only `emitPageContentChanged` consumers remain in iframe/event bus code, not `ChatTranscript` or `SharedChatCore`.

- [ ] **Step 6: Commit**

```bash
git add /root/github/LinXueyuanStdio/viben/apps/web/components/assistant/chat-transcript.tsx /root/github/LinXueyuanStdio/viben/apps/web/components/assistant/shared-chat-core.tsx /root/github/LinXueyuanStdio/viben/apps/web/components/assistant/chat-transcript.test.tsx /root/github/LinXueyuanStdio/viben/apps/web/components/assistant/shared-chat-core.test.tsx
git commit -m "refactor(web): remove page sync from chat transcript"
```

---

### Task 8: Real Page Chat Refresh Integration And Error UX

**Files:**
- Modify: `apps/web/integration/page-chat-agent.test.ts`
- Modify: `apps/web/components/pages/page-assistant-panel.tsx`
- Modify: `apps/web/hooks/assistant/use-page-session.ts`
- Modify: `apps/web/components/assistant/page-session-chat-content.tsx`
- Modify: related locale files if visible user-facing strings change.

**Interfaces:**
- Consumes:
  - `data-page-content-changed` handling from Task 6.
  - existing `subscribePageContentChanged` behavior in iframe containers.
- Produces:
  - Real Page Chat entry test no longer direct-renders `ChatTranscript` to trigger refresh.
  - Snapshot retry performs a real refetch.
  - JSON API errors display friendly localized strings.
  - Page unavailable errors do not show workspace/sandbox wording.

- [ ] **Step 1: Rewrite integration refresh test**

In `page-chat-agent.test.ts`, find the test that manually renders `ChatTranscript` with ideal `tool-update_page` output. Replace the refresh trigger with stream data part dispatch through runtime path. The assertion shape should be:

```ts
expect(readRefreshSpy).not.toHaveBeenCalled();
emitPageContentChanged({ publishedPageId: "page-db-1", chatId: "chat-1" });
expect(readRefreshSpy).toHaveBeenCalled();
```

For the true end-to-end path, render the Page Chat entry that uses `SharedChatCore`, capture the `onData` callback from mocked `getOrCreateChatInstance`, then call:

```ts
capturedOnData({
  type: "data-page-content-changed",
  data: { publishedPageId: "page-db-1", chatId: "chat-1" },
});
```

Assert that both read iframe and preview refresh paths observe the event.

- [ ] **Step 2: Add snapshot retry test**

In `page-assistant-panel.test.tsx`, add a test that first returns a failing `/api/page-sessions/{sessionId}/preview` or snapshot response, clicks Retry, then expects a second fetch call for the same snapshot endpoint. Use the existing fetch mock pattern in that file.

- [ ] **Step 3: Implement error UX fixes**

In `use-page-session.ts`, parse JSON errors:

```ts
const raw = await response.text();
let message = raw;
try {
  const parsed = JSON.parse(raw) as { error?: string; code?: string };
  message = parsed.error ?? parsed.code ?? raw;
} catch {
  message = raw;
}
throw new Error(message || "Page session unavailable");
```

In Page Chat UI error mapping, map `Page unavailable` and `Page not found` to Page Chat copy, not workspace setup copy.

In `page-assistant-panel.tsx`, expose a real `retry`/`mutate` from the snapshot hook or add a `snapshotReloadKey` state that the hook uses in its fetch key. The Retry button must trigger a network request even when `activeChatId` does not change.

- [ ] **Step 4: Run focused tests**

Run:

```bash
cd /root/github/LinXueyuanStdio/viben/apps/web
pnpm test:run integration/page-chat-agent.test.ts components/pages/page-assistant-panel.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add /root/github/LinXueyuanStdio/viben/apps/web/integration/page-chat-agent.test.ts /root/github/LinXueyuanStdio/viben/apps/web/components/pages/page-assistant-panel.tsx /root/github/LinXueyuanStdio/viben/apps/web/hooks/assistant/use-page-session.ts /root/github/LinXueyuanStdio/viben/apps/web/components/assistant/page-session-chat-content.tsx
git commit -m "fix(web): harden page chat refresh and errors"
```

---

### Task 9: Clean Work Chat Residual Computation And Final Verification

**Files:**
- Modify: `apps/web/components/assistant/session-chat-content.tsx`
- Test: `apps/web/components/assistant/shared-chat-core.test.tsx`
- Test: `apps/web/components/assistant/chat-transcript.test.tsx`

**Interfaces:**
- Consumes:
  - `SharedChatCore.transcriptProps` still supports Work Chat duration, thinking, tool approval, retry/delete/fork/open file.
- Produces:
  - No unused old transcript grouping, copy state, scroll hooks, or imports in `session-chat-content.tsx`.
  - Work Chat behavior tests still pass.

- [ ] **Step 1: Identify residual code**

Run:

```bash
cd /root/github/LinXueyuanStdio/viben
rg -n "groupedRenderMessages|useScrollToBottom|copiedMessageId|handleCopyAssistantMessage|renderMessages" apps/web/components/assistant/session-chat-content.tsx
```

Record each symbol that is not consumed by `SharedChatCore` or `transcriptProps`.

- [ ] **Step 2: Remove unused residuals**

In `session-chat-content.tsx`, remove only symbols proven unused by TypeScript after `SharedChatCore` extraction. Do not remove `transcriptProps`, tool approval callbacks, retry/delete/fork callbacks, message duration maps, message started-at maps, or context usage.

- [ ] **Step 3: Run Work Chat and Page Chat focused tests**

Run:

```bash
cd /root/github/LinXueyuanStdio/viben/apps/web
pnpm test:run components/assistant/shared-chat-core.test.tsx components/assistant/chat-transcript.test.tsx lib/page-chat/page-mcp-tools.test.ts app/api/mcp/v1/route.test.ts
```

Expected: PASS.

- [ ] **Step 4: Run typecheck**

Run:

```bash
cd /root/github/LinXueyuanStdio/viben/apps/web
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 5: Final coupling search**

Run:

```bash
cd /root/github/LinXueyuanStdio/viben
rg -n "published_page_id.*chat_id|chat_id.*published_page_id|onPageContentChanged|parseToolOutput|getPageContentChangedDetail|notifiedToolCallsRef" apps/web
```

Expected: no Page Chat refresh code depends on `published_page_id/chat_id` tool output fields; no `onPageContentChanged` prop remains.

- [ ] **Step 6: Commit**

```bash
git add /root/github/LinXueyuanStdio/viben/apps/web/components/assistant/session-chat-content.tsx
git commit -m "refactor(web): remove stale work chat transcript code"
```

---

## Final Verification

- [ ] Run all focused tests:

```bash
cd /root/github/LinXueyuanStdio/viben/apps/web
pnpm test:run \
  lib/page-chat/page-resource-uri.test.ts \
  lib/page-chat/page-mcp-tools.test.ts \
  lib/page-chat/page-content-events.test.ts \
  app/api/mcp/v1/route.test.ts \
  app/workflows/chat-page-runtime.test.ts \
  hooks/assistant/chat/use-session-chat-runtime.test.ts \
  components/assistant/chat-transcript.test.tsx \
  components/assistant/shared-chat-core.test.tsx \
  components/pages/read-page-client.test.tsx \
  components/assistant/page-preview-panel.test.tsx \
  components/pages/page-assistant-panel.test.tsx \
  integration/page-chat-agent.test.ts
```

- [ ] Run app typecheck:

```bash
cd /root/github/LinXueyuanStdio/viben/apps/web
pnpm typecheck
```

- [ ] Confirm no forbidden coupling:

```bash
cd /root/github/LinXueyuanStdio/viben
rg -n "onPageContentChanged|parseToolOutput|getPageContentChangedDetail|notifiedToolCallsRef" apps/web
```

Expected: no matches.

- [ ] Confirm resource URI shape:

```bash
cd /root/github/LinXueyuanStdio/viben
rg -n "viben://page/v1|viben-page://|viben://api/pages" apps/web docs/superpowers/specs/2026-08-13-page-chat-agent-hardening-design.md
```

Expected: no `viben://page/v1` or `viben-page://` in implementation files; expected `viben://api/pages` in helper tests, route tests, MCP client tests, and spec.

## Self-Review

- Spec coverage:
  - MCP `get_page` auth: Task 3.
  - Author-only `update_page` and `can_edit`: Task 2 and existing `update_page` route behavior in Task 3.
  - Resource URI helper and API-shaped URI: Task 1.
  - MCP subscribe/read/updated notification: Task 3.
  - Page MCP client subscription adapter: Task 4.
  - Workflow data part bridge: Task 5.
  - Client event bus publish: Task 6.
  - `ChatTranscript` no tool result parsing: Task 7.
  - Real iframe refresh path: Task 8.
  - Error UX and retry: Task 8.
  - Work Chat residual cleanup and regression: Task 9.
- Placeholder scan:
  - No `TBD` or `TODO`.
  - Steps include concrete tests, commands, and expected outcomes.
- Type consistency:
  - Resource URI helper uses `publishedPageId` in TypeScript and `published_page_id` in JSON payload.
  - UI stream data uses camelCase because `WebAgentDataParts` are TypeScript app data, not API query/file storage.
  - MCP payload uses snake_case.

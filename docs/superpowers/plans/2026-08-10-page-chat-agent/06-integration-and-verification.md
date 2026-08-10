# Page Chat Agent 06：集成、i18n 与全量验证实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 收口 MCP 更新后的跨入口刷新、补齐所有语言文案和端到端权限/无 sandbox 回归，并完成受影响 packages 的构建验收。

**Architecture:** 通用 transcript 识别当前页面 `update_page` 成功后发布类型化浏览器事件；阅读页接收后 `router.refresh()`，Assistant Preview context 增加 revision 并重新 fetch。最后用 integration tests 串联 session 创建、workflow 分流和两套 UI，确保 work 路径不回归。

**Tech Stack:** DOM CustomEvent、Next.js router、i18next JSON、Vitest/Bun、pnpm package-local build/typecheck。

## Spec 依据

- **Spec 文件：** [`docs/superpowers/specs/2026-08-10-page-chat-agent-design.md`](../../specs/2026-08-10-page-chat-agent-design.md)
- **本计划覆盖章节：** “Preview > 更新链路”、“缓存与同步”、“错误处理”全部场景、“测试策略”全部章节、“验收标准”1–11；同时验证其余所有章节已由 Plans 01–05 实现。

## 执行者必读的总体设计

开始前完整阅读[总实施索引](../2026-08-10-page-chat-agent.md)、[完整设计 Spec](../../specs/2026-08-10-page-chat-agent-design.md)和本文件，并确认 Plans 01–05 已合并。

```text
MCP update_page success tool result
  -> ChatTranscript detects once
  -> dispatch PAGE_CONTENT_CHANGED_EVENT { publishedPageId, chatId }
       ├── 阅读页：ID match -> router.refresh() -> new RSC pageHtml -> srcDoc
       └── /assistant：ID match -> PagePreviewContext.reload() -> latest Preview API
```

事件只是 UI 同步信号，不承担缓存失效。`/api/mcp/v1` 的实际更新路径必须复用/补齐现有页面 cache tags invalidation，确保 refresh 后读取最新内容。

## Global Constraints

- 继承总索引全部 Global Constraints。
- 不通过轮询页面 HTML实现刷新；只在成功更新当前页时触发一次。
- 翻译覆盖 `apps/web/lib/i18n/locales/*.json` 的全部现有 locale，key 结构保持一致。
- 此计划不再改变公共架构；若集成测试暴露接口不一致，先修正文档与定义源，再改 consumers。
- 声称完成前必须使用 `superpowers:verification-before-completion` 并记录真实命令输出。

---

### Task 1: 统一页面更新事件与缓存刷新

**Files:**
- Modify: `apps/web/lib/page-chat/page-content-events.test.ts`
- Modify: `apps/web/components/assistant/chat-transcript.tsx`
- Modify: `apps/web/components/pages/page-assistant-panel.tsx`
- Modify: `apps/web/components/pages/read-page-client.tsx`
- Modify: `apps/web/components/assistant/page-preview-context.tsx`
- Modify: `apps/web/app/api/mcp/v1/route.ts`
- Create: `apps/web/app/api/mcp/v1/route.test.ts`

**Interfaces:**
- Consumes: 总索引 `PageContentChangedDetail`；Plan 03 transcript callback；Plan 05 Preview context。
- Consumes the event interface produced by Plan 03:

```ts
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

- [ ] **Step 1: 写事件去重、ID过滤与 cache tag 失败测试**

```ts
test("emits and unsubscribes typed page content events", () => {
  const listener = vi.fn();
  const unsubscribe = subscribePageContentChanged(listener);
  emitPageContentChanged({ publishedPageId: "page-1", chatId: "chat-1" });
  expect(listener).toHaveBeenCalledWith({ publishedPageId: "page-1", chatId: "chat-1" });
  unsubscribe();
  emitPageContentChanged({ publishedPageId: "page-1", chatId: "chat-1" });
  expect(listener).toHaveBeenCalledOnce();
});

test("refreshes only the matching reading page", () => {
  render(<ReadPageClient {...pageProps} pageDbId="page-1" />);
  emitPageContentChanged({ publishedPageId: "page-2", chatId: "chat-1" });
  expect(routerRefresh).not.toHaveBeenCalled();
  emitPageContentChanged({ publishedPageId: "page-1", chatId: "chat-1" });
  expect(routerRefresh).toHaveBeenCalledOnce();
});

test("reloads only the matching open preview", () => {
  render(<PagePreviewProvider publishedPageId="page-1">{previewRevisionProbe}</PagePreviewProvider>);
  emitPageContentChanged({ publishedPageId: "page-2", chatId: "chat-1" });
  expect(screen.getByTestId("preview-revision")).toHaveTextContent("0");
  emitPageContentChanged({ publishedPageId: "page-1", chatId: "chat-1" });
  expect(screen.getByTestId("preview-revision")).toHaveTextContent("1");
});

test("update_page invalidates all current page cache tags", async () => {
  await executeUpdatePage();
  expect(revalidateTag).toHaveBeenCalledWith("page-ctx-alice-guide");
  expect(revalidateTag).toHaveBeenCalledWith("page-entity-page-1");
  expect(revalidateTag).toHaveBeenCalledWith("profile-alice");
});
```

- [ ] **Step 2: 运行事件/MCP/UI 测试确认失败**

Run: `cd /root/github/LinXueyuanStdio/viben/apps/web && pnpm test:run lib/page-chat/page-content-events.test.ts app/api/mcp/v1/route.test.ts components/pages/read-page-client.test.tsx components/assistant/page-preview-panel.test.tsx components/assistant/chat-transcript.test.tsx`

Expected: FAIL，事件模块或 MCP cache invalidation 缺失。

- [ ] **Step 3: 实现类型化事件、consumer 和 cache tags**

`emitPageContentChanged` 使用：

```ts
window.dispatchEvent(
  new CustomEvent<PageContentChangedDetail>(PAGE_CONTENT_CHANGED_EVENT, { detail }),
);
```

transcript 已按 toolCallId 去重，只在成功结果触发。Drawer panel 用 response 的稳定 page ID；Preview provider 用 session 的稳定 page ID。MCP `create_page/update_page` 在数据库成功和通知完成后调用 `revalidateTag("page-ctx-${userSlug}-${pageSlug}")`、`revalidateTag("page-entity-${publishedPageId}")`、`revalidateTag("profile-${userSlug}")`；失败工具结果不失效缓存、不发 UI event。

- [ ] **Step 4: 运行更新链路回归**

Run: `cd /root/github/LinXueyuanStdio/viben/apps/web && pnpm test:run lib/page-chat/page-content-events.test.ts app/api/mcp/v1/route.test.ts components/pages/read-page-client.test.tsx components/pages/page-assistant-panel.test.tsx components/assistant/page-preview-panel.test.tsx components/assistant/chat-transcript.test.tsx`

Expected: PASS，重复 render 不重复 refresh。

- [ ] **Step 5: 提交更新同步**

```bash
git add apps/web/lib/page-chat/page-content-events.ts apps/web/lib/page-chat/page-content-events.test.ts apps/web/components/assistant/chat-transcript.tsx apps/web/components/pages/page-assistant-panel.tsx apps/web/components/pages/read-page-client.tsx apps/web/components/assistant/page-preview-context.tsx apps/web/app/api/mcp/v1/route.ts apps/web/app/api/mcp/v1/route.test.ts
git commit -m "feat(web): refresh page views after mcp updates"
```

---

### Task 2: 补齐 Page Chat 国际化与错误态文案

**Files:**
- Modify: `apps/web/lib/i18n/locales/en.json`
- Modify: `apps/web/lib/i18n/locales/zh-CN.json`
- Modify: `apps/web/lib/i18n/locales/de.json`
- Modify: `apps/web/lib/i18n/locales/es.json`
- Modify: `apps/web/lib/i18n/locales/fr.json`
- Modify: `apps/web/lib/i18n/locales/hi.json`
- Modify: `apps/web/lib/i18n/locales/id.json`
- Modify: `apps/web/lib/i18n/locales/it.json`
- Modify: `apps/web/lib/i18n/locales/ja.json`
- Modify: `apps/web/lib/i18n/locales/ko.json`
- Modify: `apps/web/lib/i18n/locales/ms.json`
- Modify: `apps/web/lib/i18n/locales/nl.json`
- Modify: `apps/web/lib/i18n/locales/pl.json`
- Modify: `apps/web/lib/i18n/locales/pt.json`
- Modify: `apps/web/lib/i18n/locales/ru.json`
- Modify: `apps/web/lib/i18n/locales/sv.json`
- Modify: `apps/web/lib/i18n/locales/th.json`
- Modify: `apps/web/lib/i18n/locales/tr.json`
- Modify: `apps/web/lib/i18n/locales/uk.json`
- Modify: `apps/web/lib/i18n/locales/vi.json`
- Create: `apps/web/lib/i18n/page-chat-locales.test.ts`
- Modify: Plans 04–05 Page components to replace literal copy with `t()` keys

**Interfaces:**
- Consumes: 所有 Page UI component literal labels。
- Produces: `assistant.pageChat.*` 与 `assistant.sidebar.pages` 的相同 locale key tree。

- [ ] **Step 1: 写所有 locale key parity 失败测试**

```ts
const requiredKeys = [
  "assistant.sidebar.pages",
  "assistant.pageChat.tab",
  "assistant.pageChat.placeholder",
  "assistant.pageChat.newConversation",
  "assistant.pageChat.openFullConversation",
  "assistant.pageChat.preview",
  "assistant.pageChat.openPage",
  "assistant.pageChat.pageUnavailable",
  "assistant.pageChat.retry",
  "assistant.pageChat.authorPrompts.multilingual",
  "assistant.pageChat.authorPrompts.seo",
  "assistant.pageChat.authorPrompts.accessibility",
  "assistant.pageChat.readerPrompts.summary",
  "assistant.pageChat.readerPrompts.keyPoints",
  "assistant.pageChat.readerPrompts.explain",
];

test.each(localeFiles)("%s contains every page chat key", (file) => {
  const locale = readLocale(file);
  for (const key of requiredKeys) expect(get(locale, key)).toEqual(expect.any(String));
});
```

另扫描 Page component 文件，断言没有精确英文 literals `Pages|Preview|Open page|New conversation|Page unavailable`。

- [ ] **Step 2: 运行 locale 测试确认失败**

Run: `cd /root/github/LinXueyuanStdio/viben/apps/web && pnpm test:run lib/i18n/page-chat-locales.test.ts`

Expected: FAIL，新 keys 缺失。

- [ ] **Step 3: 加入所有语言的 key tree 并替换组件 literals**

`zh-CN` 使用“助手 / 页面 / 新对话 / 预览 / 在新标签页打开 / 页面不可用 / 重试”；涉及 Agent 的句子使用“智能体”，涉及 token 使用“词元”。其他 locale 提供实际翻译；不允许简单复制英文占位。所有组件调用 `useTranslation()`。

- [ ] **Step 4: 运行 locale 和 UI tests**

Run: `cd /root/github/LinXueyuanStdio/viben/apps/web && pnpm test:run lib/i18n/page-chat-locales.test.ts components/layout/read-drawer.test.tsx components/pages/page-assistant-panel.test.tsx components/assistant/page-session-layout.test.tsx components/assistant/page-preview-panel.test.tsx`

Expected: PASS。

- [ ] **Step 5: 提交 i18n**

```bash
git add apps/web/lib/i18n/locales apps/web/lib/i18n/page-chat-locales.test.ts apps/web/components/layout/read-drawer.tsx apps/web/components/pages/page-assistant-panel.tsx apps/web/components/assistant/page-session-header.tsx apps/web/components/assistant/page-preview-panel.tsx apps/web/components/assistant/inbox-sidebar.tsx
git commit -m "feat(web): localize page chat experience"
```

---

### Task 3: 增加跨层验收测试并执行最终验证

**Files:**
- Create: `apps/web/integration/page-chat-agent.test.ts`
- Modify: `apps/web/app/api/page-sessions/route.ts`
- Modify: `apps/web/app/api/page-sessions/[sessionId]/preview/route.ts`
- Modify: `apps/web/app/workflows/chat.ts`
- Modify: `apps/web/lib/page-chat/page-mcp-tools.ts`
- Modify: `apps/web/components/assistant/shared-chat-core.tsx`
- Modify: `apps/web/components/pages/page-assistant-panel.tsx`
- Modify: `apps/web/components/assistant/page-preview-context.tsx`

**Interfaces:**
- Consumes: 全部前序公共接口与路由。
- Produces: 覆盖 Spec 验收标准 1–11 的自动化证据和最终命令记录。

- [ ] **Step 1: 写跨层 integration 失败测试**

使用 module mocks 串联 API/workflow/UI 的公共边界，而不是访问生产数据库：

```ts
test("reader creates one page chat, summarizes through scoped get_page, and resumes it", async () => {
  const first = await createPageSessionAs(reader, page);
  const second = await createPageSessionAs(reader, page);
  expect(second.session.id).toBe(first.session.id);
  expect(second.chat.id).toBe(first.chat.id);
  await sendPageChat(first, "Summarize this page");
  expect(mcpCallTool).toHaveBeenCalledWith({
    name: "get_page",
    arguments: { author_slug: "alice", page_uid: "guide" },
  });
  expect(persistedAssistantMessages).toHaveLength(1);
  expect(await resumeChat(first.chat.id)).toEqual(expect.objectContaining({ status: 200 }));
});

test("author update goes through update_page and refreshes both page surfaces", async () => {
  const pageChat = await createPageSessionAs(author, page);
  await sendPageChat(pageChat, "Add multilingual support");
  expect(mcpCallTool).toHaveBeenCalledWith(expect.objectContaining({
    name: "update_page",
    arguments: expect.objectContaining({ uid: "guide" }),
  }));
  expect(routerRefresh).toHaveBeenCalledOnce();
  expect(previewReload).toHaveBeenCalledOnce();
});

test("page chat lifecycle never touches sandbox dependencies", async () => {
  const pageChat = await createPageSessionAs(reader, page);
  await sendPageChat(pageChat, "Summarize");
  await resumeChat(pageChat.chat.id);
  await stopChat(pageChat.chat.id);
  await archiveSession(pageChat.session.id);
  expect(sandboxProvision).not.toHaveBeenCalled();
  expect(sandboxConnect).not.toHaveBeenCalled();
  expect(refreshDiff).not.toHaveBeenCalled();
  expect(autoCommit).not.toHaveBeenCalled();
});

test("deleted or revoked pages preserve history but block agent and preview", async () => {
  const pageChat = await createPageSessionAs(reader, page);
  deletePage(page.id);
  expect(await listMessages(pageChat.chat.id)).toHaveLength(1);
  await expect(sendPageChat(pageChat, "Continue")).rejects.toThrow("Page unavailable");
  expect((await getPreview(pageChat.session.id)).status).toBe(404);
});

test("work chats and repo sessions retain provisioning and work runtime", async () => {
  await createAndRunWorkChat({ repo: null });
  await createAndRunWorkChat({ repo: "acme/repo" });
  expect(sandboxProvision).toHaveBeenCalledTimes(2);
  expect(resolveSandboxRuntime).toHaveBeenCalledTimes(2);
  expect(refreshDiff).toHaveBeenCalled();
});
```

- [ ] **Step 2: 运行 integration test 并确认任何剩余缺口**

Run: `cd /root/github/LinXueyuanStdio/viben/apps/web && pnpm test:run integration/page-chat-agent.test.ts`

Expected: 首次运行若 FAIL，只允许是前序集成遗漏；记录具体 assertion，不放宽验收。

- [ ] **Step 3: 做最小集成修复并重跑 focused suites**

根据失败只修改对应定义源；然后执行：

```bash
cd /root/github/LinXueyuanStdio/viben/apps/web
pnpm test:run integration/page-chat-agent.test.ts app/api/page-sessions/route.test.ts 'app/api/page-sessions/[sessionId]/preview/route.test.ts' components/pages/page-assistant-panel.test.tsx components/assistant/page-session-layout.test.tsx components/assistant/page-preview-panel.test.tsx components/layout/read-drawer.test.tsx components/assistant/shared-chat-core.test.tsx
bun test app/workflows/chat.test.ts
```

Expected: 所有 focused suites PASS。

- [ ] **Step 4: 使用 verification skill 运行 package-local 全量验证**

按顺序执行并保留输出；不得在根目录运行 build/typecheck：

```bash
cd /root/github/LinXueyuanStdio/viben/packages/agent
bun test
pnpm typecheck

cd /root/github/LinXueyuanStdio/viben/apps/web
pnpm test:run
pnpm typecheck
pnpm build

cd /root/github/LinXueyuanStdio/viben/apps/desktop
pnpm test
pnpm typecheck
pnpm build
```

Expected: 每条命令 exit 0。若 `apps/desktop` 的全量 test 存在与本功能无关的基线失败，记录完整失败并至少确保 typecheck/build 通过；不得把失败描述成成功。

- [ ] **Step 5: 检查无禁用 import、工作树和 migration**

Run:

```bash
cd /root/github/LinXueyuanStdio/viben
rg -n 'await import\(|import\("' packages/agent/chat-agent.ts apps/web/lib/page-chat apps/web/app/workflows/chat-page-runtime.ts
rg -n '@viben/sandbox|/sandbox/|/files|/skills|/diff' apps/web/components/assistant/page-* apps/web/components/pages/page-assistant-panel.tsx
git status --short
git diff --check
```

Expected: 第一条无新增违规动态 import；第二条 Page 模块无 sandbox/work API；`git diff --check` 无 whitespace error；工作树只含本计划预期改动。

- [ ] **Step 6: 提交 integration 与最小修复**

```bash
git add apps/web/integration/page-chat-agent.test.ts apps/web/app/api/page-sessions/route.ts 'apps/web/app/api/page-sessions/[sessionId]/preview/route.ts' apps/web/app/workflows/chat.ts apps/web/lib/page-chat/page-mcp-tools.ts apps/web/components/assistant/shared-chat-core.tsx apps/web/components/pages/page-assistant-panel.tsx apps/web/components/assistant/page-preview-context.tsx
git commit -m "test(web): verify page chat agent integration"
```

## 最终 Spec 验收清单

- [ ] 1. 登录用户在可读页面获得基于当前页面的流式回复。
- [ ] 2. 读者可总结；作者更新走 `/api/mcp/v1`。
- [ ] 3. Page Agent 创建、执行、恢复、停止和归档路径 sandbox spy 均为 0。
- [ ] 4. 页面刷新和 `/assistant` 默认恢复最近 chat。
- [ ] 5. Pages 分组支持打开、rename、pin、archive、delete。
- [ ] 6. Page session 无 Code Editor、Files、Diff、Git、PR、sandbox 控件或请求。
- [ ] 7. Preview 可响应式展开；`→` 安全地新标签打开当前页面。
- [ ] 8. MCP 更新触发 cache invalidation、阅读页 refresh 与 Preview reload。
- [ ] 9. 匿名、无页面权限和非 session owner 均无法创建/执行/Preview。
- [ ] 10. work Chat 与 repo session 的 sandbox/workflow/UI 回归 suites 全通过。
- [ ] 11. Drawer 与 `/assistant` 共享附件、模型、用量、语音、send/stop 行为。
- [ ] 实际实现仍匹配总索引公共接口；所有 Spec 章节在追踪矩阵中有完成证据。

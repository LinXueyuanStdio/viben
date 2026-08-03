# Viben MCP 服务 & 文档路由迁移 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 apps/web 中构建 MCP 服务端点 + 文档页，并将 api-docs 迁移到 /docs/api/v1

**Architecture:** 使用 mcp-handler@1.1.0 封装 MCP 协议，AsyncLocalStorage 传递认证上下文，4 个 page 操作工具直接调用 Drizzle ORM 和现有 service 层

**Tech Stack:** Next.js 15 App Router, mcp-handler 1.1.0, @modelcontextprotocol/sdk 1.26.0, Zod (已有), Drizzle ORM (已有)

## Global Constraints

- mcp-handler >= 1.1.0（修复 GHSA-w2fm-25vw-vh7f 安全漏洞）
- @modelcontextprotocol/sdk >= 1.26.0（mcp-handler peer dependency）
- 不做向后兼容（/api-docs 不留重定向）
- 只做 Streamable HTTP transport，不做 SSE
- 认证复用现有 API Key（bmcp_ 前缀）+ JWE token
- 所有编辑使用绝对路径

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `apps/web/package.json` | 修改 | 添加 mcp-handler、@modelcontextprotocol/sdk 依赖 |
| `apps/web/app/docs/api/v1/page.tsx` | 新建 | REST API 文档页（从 api-docs 迁移） |
| `apps/web/app/api-docs/page.tsx` | 删除 | 旧 API 文档页 |
| `apps/web/app/docs/mcp/v1/page.tsx` | 新建 | MCP 文档页（类 alphaXiv 风格） |
| `apps/web/app/api/mcp/v1/route.ts` | 新建 | MCP 服务端点 |
| `apps/web/lib/navigation/route-registry.ts` | 修改 | 更新路由注册 |
| `apps/web/lib/utils/user-slug.ts` | 修改 | 更新保留 slugs |
| `apps/web/next.openapi.json` | 修改 | 更新 docsUrl |

---

### Task 1: 安装依赖

**Files:**
- Modify: `apps/web/package.json`

**Interfaces:**
- Produces: `mcp-handler@^1.1.0`, `@modelcontextprotocol/sdk@^1.26.0` 在 node_modules 中可用

- [ ] **Step 1: 添加 mcp-handler 和 MCP SDK 依赖**

```bash
cd apps/web && pnpm add mcp-handler@^1.1.0 @modelcontextprotocol/sdk@^1.26.0
```

- [ ] **Step 2: 验证依赖安装成功**

```bash
cd apps/web && node -e "require('mcp-handler'); console.log('mcp-handler OK')" && node -e "require('@modelcontextprotocol/sdk'); console.log('sdk OK')"
```

Expected: 输出 "mcp-handler OK" 和 "sdk OK"，无错误。

- [ ] **Step 3: 提交**

```bash
git add apps/web/package.json apps/web/pnpm-lock.yaml
git commit -m "chore(web): add mcp-handler and @modelcontextprotocol/sdk dependencies"
```

---

### Task 2: 迁移 api-docs 到 /docs/api/v1

**Files:**
- Create: `apps/web/app/docs/api/v1/page.tsx`
- Delete: `apps/web/app/api-docs/page.tsx`

**Interfaces:**
- Consumes: 无
- Produces: `/docs/api/v1` 页面可用，`/api-docs` 路由消失

- [ ] **Step 1: 创建目标目录并复制页面文件**

```bash
mkdir -p apps/web/app/docs/api/v1
cp apps/web/app/api-docs/page.tsx apps/web/app/docs/api/v1/page.tsx
```

- [ ] **Step 2: 删除旧文件**

```bash
rm apps/web/app/api-docs/page.tsx
```

如果 `apps/web/app/api-docs/` 目录为空，也删除该目录：

```bash
rmdir apps/web/app/api-docs/ 2>/dev/null || true
```

- [ ] **Step 3: 验证迁移后的页面内容一致**

```bash
cd apps/web && pnpm typecheck
```

Expected: typecheck 通过（如果 tsconfig 包含新路径）。

- [ ] **Step 4: 提交**

```bash
git add apps/web/app/docs/api/v1/page.tsx apps/web/app/api-docs/page.tsx
git commit -m "refactor(web): migrate api-docs to /docs/api/v1"
```

---

### Task 3: 更新路由注册表

**Files:**
- Modify: `apps/web/lib/navigation/route-registry.ts`

**Interfaces:**
- Consumes: `/docs/api/v1` 和 `/docs/mcp/v1` 页面已存在
- Produces: 面包屑导航和路由识别对新路径生效

- [ ] **Step 1: 替换 api-docs 路由注册，新增 mcp 文档路由**

编辑 `apps/web/lib/navigation/route-registry.ts`，将第 95 行：

```typescript
"/api-docs": { label: "API 文档", icon: ScrollText, parent: "/" },
```

替换为：

```typescript
"/docs/api/v1": { label: "API 文档", icon: ScrollText, parent: "/" },
"/docs/mcp/v1": { label: "MCP 文档", icon: Package, parent: "/" },
```

- [ ] **Step 2: 验证 typecheck**

```bash
cd apps/web && pnpm typecheck
```

- [ ] **Step 3: 提交**

```bash
git add apps/web/lib/navigation/route-registry.ts
git commit -m "refactor(web): update route registry for /docs paths"
```

---

### Task 4: 更新保留 slugs

**Files:**
- Modify: `apps/web/lib/utils/user-slug.ts`

**Interfaces:**
- Consumes: `/api-docs` 路由不再存在
- Produces: `'docs'` 加入保留列表，防止用户 slug 冲突

- [ ] **Step 1: 将 `'api-docs'` 替换为 `'docs'`**

编辑 `apps/web/lib/utils/user-slug.ts`，将第 6 行：

```typescript
'api-docs',
```

替换为：

```typescript
'docs',
```

- [ ] **Step 2: 验证 typecheck**

```bash
cd apps/web && pnpm typecheck
```

- [ ] **Step 3: 提交**

```bash
git add apps/web/lib/utils/user-slug.ts
git commit -m "refactor(web): replace api-docs with docs in reserved slugs"
```

---

### Task 5: 更新 OpenAPI 配置

**Files:**
- Modify: `apps/web/next.openapi.json`

**Interfaces:**
- Consumes: `/docs/api/v1` 页面已存在
- Produces: 生成的 openapi.json 中 docsUrl 指向正确路径

- [ ] **Step 1: 修改 docsUrl**

编辑 `apps/web/next.openapi.json`，将第 16 行：

```json
"docsUrl": "/api-docs",
```

替换为：

```json
"docsUrl": "/docs/api/v1",
```

- [ ] **Step 2: 验证配置有效**

```bash
cd apps/web && node -e "const c = require('./next.openapi.json'); console.log('docsUrl:', c.docsUrl);"
```

Expected: 输出 `docsUrl: /docs/api/v1`

- [ ] **Step 3: 提交**

```bash
git add apps/web/next.openapi.json
git commit -m "refactor(web): update openapi docsUrl to /docs/api/v1"
```

---

### Task 6: 创建 MCP 文档页

**Files:**
- Create: `apps/web/app/docs/mcp/v1/page.tsx`

**Interfaces:**
- Produces: `/docs/mcp/v1` 页面渲染 MCP 使用文档

- [ ] **Step 1: 确保目录存在**

```bash
mkdir -p apps/web/app/docs/mcp/v1
```

- [ ] **Step 2: 编写文档页**

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Viben MCP 文档",
  description: "通过 Model Context Protocol 将 Viben 页面管理能力接入 AI 助手",
};

const TOOLS = [
  {
    name: "search_pages",
    description: "搜索 viben 上已发布的公开页面",
    auth: "可选",
    params: [
      { name: "query", type: "string", required: "是", desc: "搜索关键词，匹配标题、页面 ID 和描述" },
      { name: "author_slug", type: "string", required: "否", desc: "按作者 slug 过滤结果" },
      { name: "limit", type: "number", required: "否", desc: "返回数量，默认 20，最大 50" },
    ],
  },
  {
    name: "get_page",
    description: "获取指定页面的完整内容，包括 HTML、元数据和作者信息",
    auth: "可选",
    params: [
      { name: "author_slug", type: "string", required: "是", desc: "页面作者的 slug" },
      { name: "page_uid", type: "string", required: "是", desc: "页面唯一标识符" },
    ],
  },
  {
    name: "create_page",
    description: "发布新页面到 viben",
    auth: "必需",
    params: [
      { name: "uid", type: "string", required: "是", desc: "页面唯一标识符" },
      { name: "title", type: "string", required: "是", desc: "页面标题" },
      { name: "html", type: "string", required: "是", desc: "页面 HTML 内容" },
      { name: "description", type: "string", required: "否", desc: "页面描述" },
      { name: "tags", type: "string[]", required: "否", desc: "标签列表（最多 12 个）" },
      { name: "visibility", type: '"public" | "unlisted" | "private"', required: "否", desc: "可见性，默认 public" },
      { name: "cover_url", type: "string", required: "否", desc: "封面图片 URL" },
    ],
  },
  {
    name: "update_page",
    description: "更新已有页面的内容或元数据",
    auth: "必需",
    params: [
      { name: "uid", type: "string", required: "是", desc: "要更新的页面唯一标识符" },
      { name: "title", type: "string", required: "否", desc: "新标题" },
      { name: "html", type: "string", required: "否", desc: "新 HTML 内容" },
      { name: "description", type: "string", required: "否", desc: "新描述" },
      { name: "tags", type: "string[]", required: "否", desc: "新标签列表" },
      { name: "visibility", type: '"public" | "unlisted" | "private"', required: "否", desc: "新可见性设置" },
      { name: "cover_url", type: "string", required: "否", desc: "新封面图片 URL" },
    ],
  },
];

const CLIENTS = [
  { name: "Claude Code", command: "claude mcp add viben https://viben-web.vercel.app/api/mcp/v1" },
  { name: "Claude Desktop", note: "在 claude_desktop_config.json 中添加 streamableHttp 类型的服务器配置" },
  { name: "VS Code / Cursor", note: "通过 MCP 配置文件添加，类型选择 Streamable HTTP" },
  { name: "Zed", note: "在 settings.json 的 context_servers 中添加" },
];

export default function McpDocsPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      {/* Header */}
      <div className="mb-12">
        <h1 className="mb-3 font-bold text-3xl tracking-tight">Viben MCP 服务</h1>
        <p className="text-muted-foreground text-lg leading-relaxed">
          通过 Model Context Protocol (MCP) 将 Viben 的页面管理能力接入 AI 助手。
          搜索、读取、创建和更新页面 — 直接在 Claude Code、VS Code、Cursor 等 MCP 兼容客户端中使用。
        </p>
      </div>

      {/* 快速开始 */}
      <section className="mb-12">
        <h2 className="mb-4 font-semibold text-2xl">快速开始</h2>
        <div className="rounded-xl border bg-card p-6">
          <p className="mb-4 text-muted-foreground text-sm">MCP 服务端点：</p>
          <pre className="mb-4 overflow-x-auto rounded-lg bg-zinc-950 p-4 text-sm text-zinc-50">
            <code>https://viben-web.vercel.app/api/mcp/v1</code>
          </pre>
          <p className="mb-3 font-medium text-sm">支持的客户端：</p>
          <div className="space-y-3">
            {CLIENTS.map((client) => (
              <div key={client.name} className="rounded-lg border bg-background p-3">
                <span className="font-medium text-sm">{client.name}</span>
                {client.command ? (
                  <pre className="mt-1.5 overflow-x-auto rounded bg-zinc-950 p-2 font-mono text-xs text-zinc-300">
                    <code>{client.command}</code>
                  </pre>
                ) : (
                  <p className="mt-1 text-muted-foreground text-xs">{client.note}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 认证 */}
      <section className="mb-12">
        <h2 className="mb-4 font-semibold text-2xl">认证</h2>
        <div className="rounded-xl border bg-card p-6">
          <p className="mb-4 text-muted-foreground leading-relaxed">
            写入操作（创建、更新页面）需要认证。使用 viben API Key，通过 HTTP Bearer Token 传递：
          </p>
          <pre className="overflow-x-auto rounded-lg bg-zinc-950 p-4 text-sm text-zinc-50">
            <code>{"Authorization: Bearer bmcp_XXXXXXXX_YYYYYYYYYYYY"}</code>
          </pre>
          <p className="mt-4 text-muted-foreground text-sm">
            API Key 可在 viben 设置 → <a href="/settings/api_keys" className="text-primary underline">API 密钥</a> 页面创建和管理。
            搜索和读取操作不需要认证。
          </p>
        </div>
      </section>

      {/* 工具参考 */}
      <section className="mb-12">
        <h2 className="mb-4 font-semibold text-2xl">工具参考</h2>
        <div className="space-y-6">
          {TOOLS.map((tool) => (
            <div key={tool.name} className="rounded-xl border bg-card p-6">
              <div className="mb-3 flex items-center gap-3">
                <code className="rounded bg-zinc-950 px-2 py-0.5 font-mono font-semibold text-sm text-zinc-50">
                  {tool.name}
                </code>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  tool.auth === "必需"
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                    : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                }`}>
                  {tool.auth === "必需" ? "需认证" : "公开"}
                </span>
              </div>
              <p className="mb-4 text-muted-foreground">{tool.description}</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="py-2 pr-4 text-left font-medium">参数</th>
                      <th className="py-2 pr-4 text-left font-medium">类型</th>
                      <th className="py-2 pr-4 text-left font-medium">必填</th>
                      <th className="py-2 text-left font-medium">说明</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tool.params.map((p) => (
                      <tr key={p.name} className="border-b last:border-0">
                        <td className="py-2 pr-4 font-mono text-xs">{p.name}</td>
                        <td className="py-2 pr-4 font-mono text-muted-foreground text-xs">{p.type}</td>
                        <td className="py-2 pr-4 text-xs">{p.required}</td>
                        <td className="py-2 text-muted-foreground text-xs">{p.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 限制说明 */}
      <section>
        <h2 className="mb-4 font-semibold text-2xl">限制说明</h2>
        <div className="rounded-xl border bg-card p-6">
          <ul className="space-y-2 text-muted-foreground text-sm">
            <li>· 请求超时：最大 300 秒（由 Vercel 函数限制）</li>
            <li>· 速率限制：与 REST API 共享相同的频率限制策略</li>
            <li>· 页面 HTML 大小：建议控制在 5MB 以内</li>
            <li>· 标签数量：每页最多 12 个标签</li>
            <li>· 仅支持 Streamable HTTP transport，不支持 SSE</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: 验证 typecheck**

```bash
cd apps/web && pnpm typecheck
```

Expected: PASS

- [ ] **Step 4: 提交**

```bash
git add apps/web/app/docs/mcp/v1/page.tsx
git commit -m "feat(web): add MCP documentation page at /docs/mcp/v1"
```

---

### Task 7: 创建 MCP 服务端点

**Files:**
- Create: `apps/web/app/api/mcp/v1/route.ts`

**Interfaces:**
- Consumes: `mcp-handler` createMcpHandler, `@/lib/db` (db, publishedPages, users, publishedPageVersions, publishedPageRecords), `@/lib/auth/middleware` (Session type), `@/lib/auth/api-key` (validateApiKey), `@/lib/auth/jwe` (decryptSession), `@/lib/db/published-pages` (ensurePublishedPagesTable), `@/lib/services/community` (recordPageUpdateAndNotify)
- Produces: `GET /api/mcp/v1`, `POST /api/mcp/v1`, `DELETE /api/mcp/v1` — Streamable HTTP MCP 端点

- [ ] **Step 1: 确保目录存在**

```bash
mkdir -p apps/web/app/api/mcp/v1
```

- [ ] **Step 2: 编写 MCP 端点**

```typescript
import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { AsyncLocalStorage } from "async_hooks";
import { and, eq, ilike, or, desc, sql } from "drizzle-orm";
import { db, publishedPages, publishedPageVersions, publishedPageRecords, users } from "@/lib/db";
import { ensurePublishedPagesTable } from "@/lib/db/published-pages";
import { validateApiKey } from "@/lib/auth/api-key";
import { decryptSession } from "@/lib/auth/jwe";
import { recordPageUpdateAndNotify } from "@/lib/services/community";
import type { Session } from "@/lib/auth/types";

// ── 认证上下文 ────────────────────────────────────────────
const sessionStore = new AsyncLocalStorage<Session | null>();

function requireSession(): Session {
  const session = sessionStore.getStore();
  if (!session) {
    throw new Error(
      "Authentication required. Provide an API key via Authorization: Bearer bmcp_xxx header. " +
      "Create one at https://viben-web.vercel.app/settings/api_keys"
    );
  }
  return session;
}

function getOptionalSession(): Session | null {
  return sessionStore.getStore();
}

// ── 从 Request 提取 Session ──────────────────────────────
async function extractSession(req: Request): Promise<Session | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);

  // API Key
  if (token.startsWith("bmcp_")) {
    const user = await validateApiKey(token);
    if (!user) return null;
    return {
      userId: user.id,
      username: user.username,
      userSlug: user.userSlug,
      email: user.email,
      role: user.role as Session["role"],
      expiresAt: 0,
    };
  }

  // JWE session token
  return decryptSession(token);
}

// ── MCP Handler ──────────────────────────────────────────
const mcpHandler = createMcpHandler((server) => {
  // ── search_pages ──
  server.tool(
    "search_pages",
    "搜索 viben 上已发布的公开页面。匹配标题、页面 ID 和描述，支持按作者过滤。",
    {
      query: z.string().min(1).describe("搜索关键词"),
      author_slug: z.string().optional().describe("按作者 slug 过滤"),
      limit: z.number().int().min(1).max(50).optional().describe("返回数量，默认 20"),
    },
    async ({ query, author_slug, limit = 20 }) => {
      const conditions = [
        eq(publishedPages.visibility, "public"),
        eq(publishedPages.moderationStatus, "approved"),
        or(
          ilike(publishedPages.title, `%${query}%`),
          ilike(publishedPages.uid, `%${query}%`),
          ilike(publishedPages.description ?? sql`''`, `%${query}%`),
        ) as ReturnType<typeof ilike>,
      ];
      if (author_slug) {
        conditions.push(eq(publishedPages.authorSlug, author_slug));
      }

      const pages = await db
        .select({
          uid: publishedPages.uid,
          title: publishedPages.title,
          author_slug: publishedPages.authorSlug,
          description: publishedPages.description,
          tags: publishedPages.tags,
          published_at: publishedPages.publishedAt,
        })
        .from(publishedPages)
        .where(and(...conditions))
        .orderBy(desc(publishedPages.lastPublishedAt))
        .limit(limit);

      return {
        content: [{ type: "text" as const, text: JSON.stringify({ pages }) }],
      };
    },
  );

  // ── get_page ──
  server.tool(
    "get_page",
    "获取指定页面的完整内容，包括 HTML、元数据和作者信息。",
    {
      author_slug: z.string().min(1).describe("页面作者的 slug"),
      page_uid: z.string().min(1).describe("页面唯一标识符（uid）"),
    },
    async ({ author_slug, page_uid }) => {
      const page = await db.query.publishedPages.findFirst({
        where: and(
          eq(publishedPages.authorSlug, author_slug),
          eq(publishedPages.uid, page_uid),
        ),
      });

      if (!page) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "Page not found" }) }],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              uid: page.uid,
              title: page.title,
              html: page.html,
              description: page.description,
              tags: page.tags,
              visibility: page.visibility,
              cover_url: page.coverUrl,
              published_at: page.publishedAt,
              version: page.currentVersion,
              author: {
                display_name: page.authorDisplayName,
                avatar_url: page.authorAvatarUrl,
                slug: page.authorSlug,
              },
            }),
          },
        ],
      };
    },
  );

  // ── create_page ──
  server.tool(
    "create_page",
    "发布新页面到 viben。需要认证（API Key）。如果 uid 已存在则更新内容。",
    {
      uid: z.string().min(1).max(200).describe("页面唯一标识符"),
      title: z.string().min(1).max(500).describe("页面标题"),
      html: z.string().min(1).describe("页面 HTML 内容"),
      description: z.string().max(2000).optional().describe("页面描述"),
      tags: z.array(z.string()).max(12).optional().describe("标签列表（最多 12 个）"),
      visibility: z.enum(["public", "unlisted", "private"]).optional().describe("可见性，默认 public"),
      cover_url: z.string().optional().describe("封面图片 URL"),
    },
    async ({ uid, title, html, description, tags, visibility = "public", cover_url }) => {
      const session = requireSession();
      await ensurePublishedPagesTable();

      // 获取用户信息用于反范式化
      const author = await db.query.users.findFirst({
        where: eq(users.id, session.userId),
        columns: { displayName: true, avatarUrl: true },
      });
      const authorDisplayName = author?.displayName ?? session.username;
      const authorAvatarUrl = author?.avatarUrl ?? session.avatarUrl ?? null;

      // 计算版本号
      const latestVersion = await db.query.publishedPageVersions.findFirst({
        where: and(
          eq(publishedPageVersions.userId, session.userId),
          eq(publishedPageVersions.uid, uid),
        ),
        orderBy: [desc(publishedPageVersions.version)],
      });
      const nextVersion = (latestVersion?.version ?? 0) + 1;
      const eventType = latestVersion ? "updated" : "published";

      const normalizedCoverUrl = cover_url?.trim() || null;
      const normalizedTags = tags?.slice(0, 12) ?? [];

      await db
        .insert(publishedPages)
        .values({
          uid,
          userId: session.userId,
          title,
          icon: null,
          description: description ?? null,
          html,
          currentVersion: nextVersion,
          coverUrl: normalizedCoverUrl,
          tags: normalizedTags,
          visibility,
          moderationStatus: "approved",
          authorSlug: session.userSlug,
          authorDisplayName,
          authorAvatarUrl,
          publishedAt: sql`now()`,
          lastPublishedAt: sql`now()`,
          versionCount: nextVersion,
        })
        .onConflictDoUpdate({
          target: [publishedPages.userId, publishedPages.uid],
          set: {
            title,
            description: description ?? null,
            html,
            currentVersion: nextVersion,
            coverUrl: normalizedCoverUrl,
            tags: normalizedTags,
            visibility,
            authorSlug: session.userSlug,
            authorDisplayName,
            authorAvatarUrl,
            lastPublishedAt: sql`now()`,
            versionCount: nextVersion,
            updatedAt: sql`now()`,
          },
        });

      // 获取 upsert 后的页面
      const updatedPage = await db.query.publishedPages.findFirst({
        where: and(
          eq(publishedPages.userId, session.userId),
          eq(publishedPages.uid, uid),
        ),
      });

      if (!updatedPage) {
        throw new Error("Published page was not found after upsert");
      }

      // 创建版本记录
      await db.insert(publishedPageVersions).values({
        publishedPageId: updatedPage.id,
        uid,
        userId: session.userId,
        version: nextVersion,
        title,
        icon: null,
        description: description ?? null,
        html,
        coverUrl: normalizedCoverUrl,
        tags: normalizedTags,
        visibility,
        moderationStatus: "approved",
        publishedAt: new Date(),
      });

      // 创建发布记录
      const latestRecord = await db.query.publishedPageRecords.findFirst({
        where: and(
          eq(publishedPageRecords.userId, session.userId),
          eq(publishedPageRecords.uid, uid),
        ),
        orderBy: [desc(publishedPageRecords.recordNumber)],
      });

      await db.insert(publishedPageRecords).values({
        publishedPageId: updatedPage.id,
        uid,
        userId: session.userId,
        recordNumber: (latestRecord?.recordNumber ?? 0) + 1,
        version: nextVersion,
        action: "publish",
        title,
        icon: null,
        description: description ?? null,
      });

      // 通知订阅者
      await recordPageUpdateAndNotify(db, {
        publishedPageId: updatedPage.id,
        userId: session.userId,
        userSlug: session.userSlug,
        pageId: uid,
        version: nextVersion,
        eventType,
        importance: "normal",
        title,
        description: description ?? null,
        visibility,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              page_uid: uid,
              url: `/page/${encodeURIComponent(session.userSlug)}/${encodeURIComponent(uid)}`,
              read_url: `/${encodeURIComponent(session.userSlug)}/${encodeURIComponent(uid)}?tab=read`,
              updated: eventType === "updated",
            }),
          },
        ],
      };
    },
  );

  // ── update_page ──
  server.tool(
    "update_page",
    "更新已有页面的内容或元数据。需要认证（API Key），仅页面作者可操作。",
    {
      uid: z.string().min(1).describe("要更新的页面唯一标识符"),
      title: z.string().min(1).max(500).optional().describe("新标题"),
      html: z.string().min(1).optional().describe("新 HTML 内容"),
      description: z.string().max(2000).optional().describe("新描述"),
      tags: z.array(z.string()).max(12).optional().describe("新标签列表"),
      visibility: z.enum(["public", "unlisted", "private"]).optional().describe("新可见性设置"),
      cover_url: z.string().optional().describe("新封面图片 URL"),
    },
    async ({ uid, title, html, description, tags, visibility, cover_url }) => {
      const session = requireSession();
      await ensurePublishedPagesTable();

      // 检查页面是否存在且属于当前用户
      const existing = await db.query.publishedPages.findFirst({
        where: and(
          eq(publishedPages.userId, session.userId),
          eq(publishedPages.uid, uid),
        ),
      });

      if (!existing) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "Page not found or you do not have permission to update it" }) }],
          isError: true,
        };
      }

      // 计算新版本号
      const latestVersion = await db.query.publishedPageVersions.findFirst({
        where: and(
          eq(publishedPageVersions.userId, session.userId),
          eq(publishedPageVersions.uid, uid),
        ),
        orderBy: [desc(publishedPageVersions.version)],
      });
      const nextVersion = (latestVersion?.version ?? 0) + 1;

      // 合并更新字段
      const updatedTitle = title ?? existing.title;
      const updatedHtml = html ?? existing.html;
      const updatedDescription = description !== undefined ? description : existing.description;
      const updatedTags = tags ?? existing.tags;
      const updatedVisibility = visibility ?? existing.visibility;
      const updatedCoverUrl = cover_url !== undefined ? (cover_url?.trim() || null) : existing.coverUrl;

      await db
        .update(publishedPages)
        .set({
          title: updatedTitle,
          html: updatedHtml,
          description: updatedDescription,
          tags: updatedTags,
          visibility: updatedVisibility,
          coverUrl: updatedCoverUrl,
          currentVersion: nextVersion,
          lastPublishedAt: sql`now()`,
          versionCount: nextVersion,
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(publishedPages.userId, session.userId),
            eq(publishedPages.uid, uid),
          ),
        );

      // 创建版本记录
      await db.insert(publishedPageVersions).values({
        publishedPageId: existing.id,
        uid,
        userId: session.userId,
        version: nextVersion,
        title: updatedTitle,
        icon: null,
        description: updatedDescription,
        html: updatedHtml,
        coverUrl: updatedCoverUrl,
        tags: updatedTags,
        visibility: updatedVisibility,
        moderationStatus: "approved",
        publishedAt: new Date(),
      });

      // 通知
      await recordPageUpdateAndNotify(db, {
        publishedPageId: existing.id,
        userId: session.userId,
        userSlug: session.userSlug,
        pageId: uid,
        version: nextVersion,
        eventType: "updated",
        importance: "normal",
        title: updatedTitle,
        description: updatedDescription ?? null,
        visibility: updatedVisibility,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              page_uid: uid,
              url: `/page/${encodeURIComponent(session.userSlug)}/${encodeURIComponent(uid)}`,
              read_url: `/${encodeURIComponent(session.userSlug)}/${encodeURIComponent(uid)}?tab=read`,
              updated: true,
            }),
          },
        ],
      };
    },
  );
});

// ── 导出 Route Handler ──────────────────────────────────
async function handle(req: Request): Promise<Response> {
  const session = await extractSession(req);
  return sessionStore.run(session, () => mcpHandler(req));
}

export { handle as GET, handle as POST, handle as DELETE };
```

- [ ] **Step 3: 验证 typecheck**

```bash
cd apps/web && pnpm typecheck
```

Expected: PASS，无类型错误。

- [ ] **Step 4: 提交**

```bash
git add apps/web/app/api/mcp/v1/route.ts
git commit -m "feat(web): add MCP server endpoint at /api/mcp/v1"
```

---

### Task 8: 验证与最终检查

**Files:**
- 无新建文件

**Interfaces:**
- Consumes: 所有前置任务已完成
- Produces: 验证全部变更正确

- [ ] **Step 1: 运行 typecheck**

```bash
cd apps/web && pnpm typecheck
```

Expected: PASS

- [ ] **Step 2: 检查无遗漏的 api-docs 引用**

```bash
cd apps/web && grep -r "api-docs" --include="*.ts" --include="*.tsx" --include="*.json" app/ lib/ 2>/dev/null | grep -v node_modules | grep -v ".next"
```

Expected: 无结果（或仅在注释/历史数据中出现）。

注意 `next.openapi.json` 的 `exclude` 数组中有 `admin/**` 和 `mcp/**` 等排除项，不影响。

- [ ] **Step 3: 检查新路由可用**

```bash
cd apps/web && ls app/docs/api/v1/page.tsx app/docs/mcp/v1/page.tsx app/api/mcp/v1/route.ts
```

Expected: 三个文件都存在。

- [ ] **Step 4: 运行测试**

```bash
cd apps/web && pnpm test:run
```

Expected: 现有测试全部通过（MCP 端点不影响现有功能）。

- [ ] **Step 5: 最终提交（如有遗漏修改）**

```bash
git status
git add -A
git commit -m "chore(web): finalize MCP service and docs route migration"
```

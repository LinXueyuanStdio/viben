# Viben MCP 服务 & 文档路由迁移设计

## 概述

在 `apps/web` 中构建 viben 的 MCP（Model Context Protocol）服务，包括：
1. MCP 文档页 `/docs/mcp/v1`
2. MCP 服务端点 `/api/mcp/v1`
3. 现有 API 文档页 `/api-docs` 迁移到 `/docs/api/v1`

## 路由结构

```
apps/web/app/
  docs/
    api/v1/page.tsx          ← 迁移自 api-docs/page.tsx（Scalar UI）
    mcp/v1/page.tsx          ← 新建 MCP 文档页
  api/mcp/v1/route.ts        ← MCP 服务端点（mcp-handler）
```

## 1. `/docs/api/v1` — REST API 文档

直接从 `app/api-docs/page.tsx` 迁移，内容不变：
- 删掉 `app/api-docs/page.tsx`
- 新建 `app/docs/api/v1/page.tsx`，内容相同
- 更新 `SCALAR_CONFIG` 中 servers（如果当前文件中有过期 URL）

## 2. `/docs/mcp/v1` — MCP 文档页

类 alphaXiv 风格的独立文档页，Server Component 渲染 Markdown/TSX 内容。

### 页面内容结构

- **概述** — viben MCP 是什么，能做什么
- **快速开始** — 端点 URL、支持的客户端（Claude Code、VS Code、Cursor、Zed 等）
- **认证** — API Key（`bmcp_` 前缀）Bearer Token 方式
- **工具参考** — 每个工具的名称、描述、参数表、返回值格式、使用示例
- **限制说明** — 速率限制、超时等

### 技术实现

- 纯 TSX Server Component，不使用 MDX（避免额外依赖）
- 使用现有 `@/components/ui/*` 组件库做排版
- 代码高亮用简单的 `<pre><code>` + Tailwind 样式

## 3. `/api/mcp/v1` — MCP 服务端点

使用 `mcp-handler` 包（参考 `vercel-labs/mcp-on-vercel`），导出 `GET/POST/DELETE`。

### 依赖

```json
{
  "mcp-handler": "^1.0.1",
  "zod": "^3.24.2"  // 已有
}
```

### 工具列表（首批 4 个，聚焦 Page 操作）

#### `search_pages`

搜索已发布页面。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `query` | string | 是 | 搜索关键词（匹配 title、uid、description） |
| `author_slug` | string | 否 | 按作者过滤 |
| `limit` | number | 否 | 返回数量，默认 20，最大 50 |

**返回：** `{ pages: [{ uid, title, author_slug, description, tags, published_at }] }`

**实现：** 扩展 `searchPublishedPagesByAuthor`，不传 `author_slug` 时为全站搜索。

#### `get_page`

获取页面完整内容。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `author_slug` | string | 是 | 作者 slug |
| `page_uid` | string | 是 | 页面 uid |

**返回：** `{ uid, title, html, description, tags, visibility, cover_url, published_at, version, author: { display_name, avatar_url, slug } }`

**实现：** `db.query.publishedPages.findFirst` + where 条件。

#### `create_page`

发布新页面。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `uid` | string | 是 | 页面唯一标识 |
| `title` | string | 是 | 页面标题 |
| `html` | string | 是 | 页面 HTML 内容 |
| `description` | string | 否 | 页面描述 |
| `tags` | string[] | 否 | 标签列表，最多 12 个 |
| `visibility` | enum | 否 | `public` / `unlisted` / `private`，默认 `public` |
| `cover_url` | string | 否 | 封面图 URL |

**返回：** `{ success, page_uid, url, read_url }`

**实现：** 复用 `POST /api/pages/publish` 逻辑（`onConflictDoUpdate` upsert）。

#### `update_page`

更新已有页面。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `uid` | string | 是 | 页面唯一标识 |
| `title` | string | 否 | 更新标题 |
| `html` | string | 否 | 更新 HTML 内容 |
| `description` | string | 否 | 更新描述 |
| `tags` | string[] | 否 | 更新标签 |
| `visibility` | enum | 否 | 更新可见性 |
| `cover_url` | string | 否 | 更新封面图 |

**返回：** `{ success, page_uid, url, read_url, updated: true }`

**实现：** 同 `create_page`，共用 publish upsert 逻辑。

### 认证

MCP 客户端通过 HTTP Header 传入 API Key：

```
Authorization: Bearer bmcp_XXXXXXXX_YYYYYYYYYYYY
```

**认证集成方案：** `mcp-handler` v1.x 的 `createMcpHandler` 回调只在初始化时执行一次，工具 handler 无法直接访问 `Request` 对象。因此采用 **wrapper 模式**：

```typescript
// app/api/mcp/v1/route.ts
import { createMcpHandler } from "mcp-handler";
import { requireAuth, getOptionalSession } from "@/lib/auth/middleware";
import { AsyncLocalStorage } from "async_hooks";

const sessionStore = new AsyncLocalStorage<Session>();

// 1. 创建 handler，工具从 AsyncLocalStorage 获取 session
const mcpHandler = createMcpHandler((server) => {
  server.tool("create_page", "...", schema, async (args) => {
    const session = sessionStore.getStore();
    if (!session) throw new Error("Authentication required");
    // ... 使用 session.userId, session.userSlug 等
  });
});

// 2. 包装导出，在调用前提取认证并存入 AsyncLocalStorage
async function handle(req: Request): Promise<Response> {
  const session = await getOptionalSession(req);
  return sessionStore.run(session, () => mcpHandler(req));
}

export { handle as GET, handle as POST, handle as DELETE };
```

`requireAuth` 已支持三种认证方式：
1. API Key（`bmcp_` 前缀）— bcrypt hash 验证
2. JWE Token — 桌面客户端
3. Session Cookie — 浏览器

公开工具（`search_pages`、`get_page`）使用 `getOptionalSession` 可选认证；
写入工具（`create_page`、`update_page`）在 handler 内检查 session 是否存在。

### 实现架构

```typescript
// app/api/mcp/v1/route.ts
import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { AsyncLocalStorage } from "async_hooks";
import { db, publishedPages } from "@/lib/db";
import { getOptionalSession } from "@/lib/auth/middleware";
import type { Session } from "@/lib/auth/middleware";
import { eq, and, or, ilike, desc } from "drizzle-orm";

const sessionStore = new AsyncLocalStorage<Session | null>();

function requireSession(): Session {
  const session = sessionStore.getStore();
  if (!session) throw new Error("Authentication required. Provide an API key via Authorization: Bearer bmcp_xxx");
  return session;
}

// 工具注册 — 在初始化时执行一次
const mcpHandler = createMcpHandler((server) => {
  server.tool("search_pages", "搜索 viben 上已发布的页面",
    { query: z.string().min(1), author_slug: z.string().optional(), limit: z.number().int().min(1).max(50).optional() },
    async ({ query, author_slug, limit = 20 }) => {
      const conditions = [eq(publishedPages.visibility, "public"), eq(publishedPages.moderationStatus, "approved"), ilike(publishedPages.title, `%${query}%`)];
      if (author_slug) conditions.push(eq(publishedPages.authorSlug, author_slug));
      const pages = await db.select({ uid: publishedPages.uid, title: publishedPages.title, author_slug: publishedPages.authorSlug, description: publishedPages.description, tags: publishedPages.tags, published_at: publishedPages.publishedAt })
        .from(publishedPages).where(and(...conditions)).orderBy(desc(publishedPages.lastPublishedAt)).limit(limit);
      return { content: [{ type: "text", text: JSON.stringify({ pages }) }] };
    }
  );

  server.tool("get_page", "获取页面的完整内容",
    { author_slug: z.string().min(1), page_uid: z.string().min(1) },
    async ({ author_slug, page_uid }) => {
      const page = await db.query.publishedPages.findFirst({ where: and(eq(publishedPages.authorSlug, author_slug), eq(publishedPages.uid, page_uid)) });
      if (!page) throw new Error("Page not found");
      return { content: [{ type: "text", text: JSON.stringify({ uid: page.uid, title: page.title, html: page.html, description: page.description, tags: page.tags, visibility: page.visibility, cover_url: page.coverUrl, published_at: page.publishedAt, version: page.currentVersion, author: { display_name: page.authorDisplayName, avatar_url: page.authorAvatarUrl, slug: page.authorSlug } }) }] };
    }
  );

  server.tool("create_page", "发布新页面（需认证）",
    { uid: z.string().min(1), title: z.string().min(1), html: z.string().min(1), description: z.string().optional(), tags: z.array(z.string()).max(12).optional(), visibility: z.enum(["public", "unlisted", "private"]).optional(), cover_url: z.string().optional() },
    async (args) => {
      const session = requireSession();
      // 复用 POST /api/pages/publish 的 upsert 逻辑
      // ...
    }
  );

  server.tool("update_page", "更新已有页面内容（需认证）",
    { uid: z.string().min(1), title: z.string().optional(), html: z.string().optional(), description: z.string().optional(), tags: z.array(z.string()).max(12).optional(), visibility: z.enum(["public", "unlisted", "private"]).optional(), cover_url: z.string().optional() },
    async (args) => {
      const session = requireSession();
      // 与 create_page 共用 publish 逻辑
      // ...
    }
  );
});

// 认证包装 — 每次请求时提取 session 存入 AsyncLocalStorage
async function handle(req: Request): Promise<Response> {
  const session = await getOptionalSession(req);
  return sessionStore.run(session, () => mcpHandler(req));
}

export { handle as GET, handle as POST, handle as DELETE };
```

## 4. 配套变更

### `lib/navigation/route-registry.ts`

```diff
- "/api-docs": { label: "API 文档", icon: ScrollText, parent: "/" },
+ "/docs/api/v1": { label: "API 文档", icon: ScrollText, parent: "/" },
+ "/docs/mcp/v1": { label: "MCP 文档", icon: Package, parent: "/" },
```

`Package` 图标与 MCP 市场一致，体现 MCP 品牌。

### `lib/utils/user-slug.ts`

```diff
- 'api-docs',
+ 'docs',
```

`'api-docs'` 路由不再存在，替换为 `'docs'`。

### `next.openapi.json`

```diff
- "docsUrl": "/api-docs",
+ "docsUrl": "/docs/api/v1",
```

### `package.json`

```diff
+ "mcp-handler": "^1.0.1",
```

## 5. 不需要做的事

- ❌ 不需要 `app/api-docs/page.tsx` 重定向 — 直接删除
- ❌ 不需要 SSE transport — 只做 Streamable HTTP
- ❌ 不需要 OAuth — 用现有 API Key 认证

## 6. 错误处理

- `mcp-handler` 自动处理 Zod 校验失败 → MCP 错误响应
- Handler 内抛出的异常 → `mcp-handler` 转为 JSON-RPC 错误
- `AuthError`（401）→ MCP 客户端收到认证错误

## 7. 部署考虑

- 不需要 Vercel Fluid compute（我们在 Next.js route handler 里运行，不是 serverless function）
- `mcp-handler` 在 Next.js App Router 中正常工作（导出 `GET/POST/DELETE`）
- 最大请求时长由 Vercel 函数限制决定（已在 `vercel.json` 中配置 300s）

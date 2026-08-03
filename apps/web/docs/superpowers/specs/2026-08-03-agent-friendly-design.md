# Viben Agent-Friendly 网站增强设计

## 目标

让 AI agent 更好地发现、检索和消费 Viben 上已发布的页面内容。

## 范围

- **发现层**：`robots.txt`、`sitemap.xml`、`llms.txt`、`llms-full.txt`、`AGENTS.md`
- **页面元数据**：Schema.org JSON-LD、增强 meta tags、markdown 内容协商
- **搜索增强**：`search_pages` MCP 工具参数扩展（tags 过滤、排序、分页）

不做：pgvector 语义搜索、WebMCP UI 桥接、llms.json、页面 diff feed。

---

## 一、发现层

### 1.1 robots.txt

**文件**：`apps/web/app/robots.ts`（Next.js 文件路由约定，输出到 `/robots.txt`）

```typescript
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: ["GPTBot", "ClaudeBot", "Claude-SearchBot", "PerplexityBot", "Google-Extended", "CCBot"],
        allow: "/",
      },
      {
        userAgent: ["Googlebot", "Bingbot"],
        allow: "/",
      },
      {
        userAgent: "*",
        disallow: ["/admin/", "/api/"],
        allow: "/",
      },
    ],
    sitemap: `${process.env.NEXT_PUBLIC_APP_URL}/sitemap.xml`,
  };
}
```

### 1.2 sitemap.xml

**文件**：`apps/web/app/sitemap.ts`（Next.js 文件路由约定，输出到 `/sitemap.xml`）

动态生成，包含：
- 所有 published=public + moderation=approved 的页面
- `<lastmod>` 使用 `lastPublishedAt`
- 核心静态路由（首页 `/`、`/web`、`/home`、`/market`、`/mcp-market`、`/skill-market`、`/leaderboard`、`/moment`、`/collections`、`/docs/mcp/v1`、`/docs/api/v1`）
- changefreq：页面用 `weekly`，静态路由用 `monthly`
- priority：静态路由 0.8，页面 0.6

**分页策略**：每页最多 50000 条，超出则生成 `sitemap-0.xml`、`sitemap-1.xml` …（Next.js 内置支持）。

### 1.3 llms.txt

**文件**：`apps/web/public/llms.txt`

遵循 [llmstxt.org](https://llmstxt.org/) 规范。静态文件，内容结构：

```markdown
# Viben
> Agent Swarm × Code Evolution — 多智能体协作平台，支持富文本页面创作与分享。

## MCP 服务
- [Viben MCP 服务文档](/docs/mcp/v1): AI 助手可通过 MCP 协议搜索、读取、创建和更新 Viben 页面。

## API 文档
- [Viben API 文档](/docs/api/v1): 面向创作者的 REST API，基于 OpenAPI 3.0。

## 精选页面
<!-- 从 publishedPages 中选择 viewCount 最高的若干公开页面，构建时或手动维护 -->
```

**更新策略**：手动维护精选页面列表（后续可考虑构建时自动生成）。

### 1.4 llms-full.txt

**路由**：`apps/web/app/llms-full.txt/route.ts`

动态路由，获取 viewCount 最高的 N 篇（默认 50）公开页面的 HTML 内容，以 markdown 格式拼接返回。

```
GET /llms-full.txt?limit=50
```

返回 `Content-Type: text/plain; charset=utf-8`，结构：

```markdown
# Viben Pages

---

## [Title 1](url 1)
Author: xxx | Published: yyyy-mm-dd | Tags: a, b, c

<HTML content of page 1>

---

## [Title 2](url 2)
Author: xxx | Published: yyyy-mm-dd | Tags: a, b, c

<HTML content of page 2>

---
```

### 1.5 AGENTS.md

**文件**：`apps/web/public/AGENTS.md`

面向 coding agent（Claude Code、Codex、Cursor 等）的集成指南：

```markdown
# Viben for AI Agents

## Connecting via MCP

Viben provides a Model Context Protocol (MCP) server at `/api/mcp/v1`.

### Quick Start
claude mcp add --transport http viben https://viben-web.vercel.app/api/mcp/v1

### Available Tools
- `search_pages` — Search published pages by keyword, author, tags
- `get_page` — Get full page content and metadata
- `create_page` — Publish a new page (requires API Key)
- `update_page` — Update an existing page (requires API Key)

### Authentication
Create an API Key at /settings/api_keys (bmcp_ prefix for write operations).
Read operations work without authentication for public pages.

### More Info
- MCP docs: /docs/mcp/v1
- API docs: /docs/api/v1
- OpenAPI spec: /openapi.json
```

---

## 二、页面元数据

### 2.1 Schema.org JSON-LD

**实现位置**：页面详情页 `apps/web/app/(dashboard)/[user_slug]/[page_id]/page.tsx`

注入 Article + BreadcrumbList 结构化数据：

```tsx
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Article",
          "@id": `${APP_URL}/${authorSlug}/${pageUid}#article`,
          headline: page.title,
          description: page.description,
          image: page.coverUrl,
          datePublished: page.publishedAt,
          dateModified: page.lastPublishedAt,
          author: {
            "@type": "Person",
            name: page.authorDisplayName,
            url: `${APP_URL}/${page.authorSlug}`,
          },
          publisher: {
            "@type": "Organization",
            name: "Viben",
            url: APP_URL,
          },
          url: `${APP_URL}/${page.authorSlug}/${page.uid}`,
          keywords: page.tags?.join(", "),
          inLanguage: "zh-CN",
        },
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Viben", item: APP_URL },
            { "@type": "ListItem", position: 2, name: page.authorDisplayName, item: `${APP_URL}/${page.authorSlug}` },
            { "@type": "ListItem", position: 3, name: page.title },
          ],
        },
      ],
    }),
  }}
/>
```

### 2.2 增强 Meta Tags

**根 layout** (`apps/web/app/layout.tsx`) 补充默认值：

- `metadata.robots`: `{ index: true, follow: true, nocache: false }`（默认）
- `metadata.alternates`: 不设默认值，由各页面自行设置 canonical

**页面详情页** (`[user_slug]/[page_id]/page.tsx`) 补充：

```typescript
export const metadata: Metadata = {
  // 已有 title, description
  alternates: { canonical: `${APP_URL}/${authorSlug}/${pageUid}` },
  robots: { index: true, follow: true },
  keywords: page.tags,
  creator: page.authorDisplayName,
  openGraph: { /* 已有 */ },
  twitter: { /* 已有 */ },
};
```

**首页** (`(dashboard)/page.tsx`) 已有 metadata，补充 `alternates.canonical` 和 `robots`。

### 2.3 Markdown 内容协商

**实现位置**：页面详情页 `[user_slug]/[page_id]/page.tsx`

```typescript
// 在 page component 中检测 Accept 头（需标记为 async server component 或在 middleware 中处理）
// 或更简单的方案：在现有的 route handler 中处理

// 方式：利用 Next.js middleware 或直接在 page.tsx 中读取 headers()
import { headers } from "next/headers";

export default async function PageView({ params }: { params: ... }) {
  const accept = (await headers()).get("accept") || "";
  
  if (accept.includes("text/markdown")) {
    // 返回页面 HTML 内容，加 Vary 头
    return new Response(page.html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Vary": "Accept",
      },
    });
  }
  
  // 正常渲染页面
  return <PageViewUI page={page} />;
}
```

同时，在正常渲染的页面 `<head>` 中添加：

```tsx
<link rel="alternate" type="text/markdown" href={`${APP_URL}/${userSlug}/${pageUid}`} />
```

**注意**：因为 `Content-Type` 返回 `text/html` 而非 `text/markdown`，这可能不是严格意义上的 markdown 协商。但 agent 通过 `Accept: text/markdown` 请求头 + `Vary: Accept` 响应头 + `<link rel="alternate">` 仍然能发现并获取纯内容版本，不需要解析完整页面 UI。这是一个务实的折中。

---

## 三、搜索增强

### 3.1 MCP search_pages 工具扩展

**文件**：`apps/web/app/api/mcp/v1/route.ts`

```typescript
server.tool(
  "search_pages",
  "搜索 viben 上已发布的公开页面。...",
  {
    query: z.string().min(1).describe("搜索关键词"),
    author_slug: z.string().optional().describe("按作者 slug 过滤"),
    tags: z.array(z.string()).max(12).optional().describe("按标签过滤，所有标签必须匹配（AND 逻辑）"),
    sort_by: z.enum(["published_at", "title"]).optional().describe("排序字段，默认 published_at"),
    sort_order: z.enum(["desc", "asc"]).optional().describe("排序方向，默认 desc"),
    limit: z.number().int().min(1).max(50).optional().describe("返回数量，默认 20"),
    offset: z.number().int().min(0).optional().describe("分页偏移，默认 0"),
  },
  async ({ query, author_slug, tags, sort_by, sort_order, limit = 20, offset = 0 }) => {
    // 构建查询条件
    const conditions: ReturnType<typeof sql>[] = [
      eq(publishedPages.visibility, "public"),
      eq(publishedPages.moderationStatus, "approved"),
      sql`(${publishedPages.title} ILIKE ${`%${query}%`} OR ...)`,
    ];
    if (author_slug) conditions.push(eq(publishedPages.authorSlug, author_slug));
    if (tags && tags.length > 0) {
      conditions.push(sql`${publishedPages.tags} @> ARRAY[${sql.join(tags.map(t => sql`${t}`), sql`, `)}]`);
    }

    // 排序
    const orderColumn = sort_by === "title"
      ? publishedPages.title
      : publishedPages.lastPublishedAt;
    const orderFn = sort_order === "asc" ? asc : desc;

    const pages = await db
      .select({ ... })
      .from(publishedPages)
      .where(and(...conditions))
      .orderBy(orderFn(orderColumn))
      .limit(limit)
      .offset(offset);

    return { content: [{ type: "text", text: JSON.stringify({ pages }) }] };
  },
);
```

**白名单校验**：`sort_by` 和 `sort_order` 使用 zod `z.enum()` 确保只能传入合法值，防止 SQL 注入。

**tags 过滤**：使用 PostgreSQL 原生 `@>` (数组包含) 操作符，所有指定标签必须同时匹配（AND 语义）。

### 3.2 同步更新 MCP 文档页

MCP docs 页面 (`apps/web/app/docs/mcp/v1/page.tsx`) 中的 `search_pages` 参数表需要同步新增 `tags`、`sort_by`、`sort_order`、`offset` 四个参数的说明（中英文）。

---

## 四、不影响的范围

以下 **不做**：
- pgvector / embedding 语义搜索
- WebMCP `data-mcp-*` UI 桥接属性
- `llms.json` 结构化索引
- MCP notification 推送
- 页面变更 diff feed
- markdown 格式转换（内容协商返回原始 HTML）

---

## 五、实现文件清单

| # | 文件 | 操作 |
|---|------|------|
| 1 | `apps/web/app/robots.ts` | 新建 |
| 2 | `apps/web/app/sitemap.ts` | 新建 |
| 3 | `apps/web/public/llms.txt` | 新建 |
| 4 | `apps/web/app/llms-full.txt/route.ts` | 新建 |
| 5 | `apps/web/public/AGENTS.md` | 新建 |
| 6 | `apps/web/app/(dashboard)/[user_slug]/[page_id]/page.tsx` | 修改 — JSON-LD + meta + 内容协商 |
| 7 | `apps/web/app/layout.tsx` | 修改 — 默认 meta |
| 8 | `apps/web/app/(dashboard)/page.tsx` | 修改 — canonical + robots |
| 9 | `apps/web/app/api/mcp/v1/route.ts` | 修改 — search_pages 参数扩展 |
| 10 | `apps/web/app/docs/mcp/v1/page.tsx` | 修改 — 文档同步 |

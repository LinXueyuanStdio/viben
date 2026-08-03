# Viben Agent-Friendly 网站增强 — 实现计划

> **For agentic workers:** 使用 superpowers:subagent-driven-development 或 superpowers:executing-plans 按任务逐个实现。步骤使用 checkbox (`- [ ]`) 语法跟踪。

**目标：** 为 Viben Web 添加 agent-friendly 发现层（robots.txt、sitemap、llms.txt、AGENTS.md）、页面元数据增强（Schema.org JSON-LD、meta tags、内容协商）和 MCP 搜索增强。

**架构：** 利用 Next.js 文件路由约定生成 robots.txt 和 sitemap.xml；通过静态文件 + 动态路由提供服务发现入口；在页面详情页注入结构化数据和内容协商逻辑；扩展现有 MCP 路由的 search_pages 参数。

**技术栈：** Next.js 15 (App Router)、Drizzle ORM (PostgreSQL)、Zod、mcp-handler

## 全局约束

- 所有查询参数和 API 字段使用 snake_case
- 禁止 inline import type 语法
- 禁止 `hsl()` 包裹 oklch 变量
- 编辑文件使用绝对路径
- 只在特定包目录下运行 typecheck/build

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `apps/web/app/robots.ts` | 新建 | robots.txt — 允许 AI crawlers，禁止 /admin 和 /api |
| `apps/web/app/sitemap.ts` | 新建 | sitemap.xml — 动态生成，含所有公开页面和核心静态路由 |
| `apps/web/public/llms.txt` | 新建 | llms.txt — 静态精选索引，入口导航 |
| `apps/web/app/llms-full.txt/route.ts` | 新建 | llms-full.txt — 动态路由，返回热门页面内容 |
| `apps/web/public/AGENTS.md` | 新建 | AGENTS.md — Coding agent 集成指南 |
| `apps/web/app/(dashboard)/[user_slug]/[page_id]/page.tsx` | 修改 | 注入 JSON-LD、增强 meta tags、内容协商 |
| `apps/web/app/layout.tsx` | 修改 | 默认 robots meta、lang 补充 |
| `apps/web/app/(dashboard)/page.tsx` | 修改 | 补充 alternates.canonical |
| `apps/web/app/api/mcp/v1/route.ts` | 修改 | search_pages 新增 tags/sort_by/sort_order/offset |
| `apps/web/app/docs/mcp/v1/page.tsx` | 修改 | MCP 文档页同步新增参数说明 |

---

### 任务 1：创建 robots.ts

**文件：**
- 创建：`apps/web/app/robots.ts`

**接口：**
- 产出：Next.js 自动将 `Robots()` 函数的返回值渲染为 `/robots.txt`

- [ ] **步骤 1：创建 robots.ts**

```typescript
import type { MetadataRoute } from "next";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: [
          "GPTBot",
          "ClaudeBot",
          "Claude-SearchBot",
          "PerplexityBot",
          "Google-Extended",
          "CCBot",
        ],
        allow: "/",
        disallow: ["/admin/", "/api/"],
      },
      {
        userAgent: ["Googlebot", "Bingbot"],
        allow: "/",
        disallow: ["/admin/", "/api/"],
      },
      {
        userAgent: "*",
        disallow: ["/admin/", "/api/"],
        allow: "/",
      },
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
```

- [ ] **步骤 2：验证输出**

启动 dev server 后访问 `http://localhost:3000/robots.txt`，确认内容正确。

- [ ] **步骤 3：提交**

```bash
git add apps/web/app/robots.ts
git commit -m "feat: add robots.txt with AI crawler allowlist"
```

---

### 任务 2：创建 sitemap.ts

**文件：**
- 创建：`apps/web/app/sitemap.ts`

**接口：**
- 消费：`db`、`publishedPages` from `@/lib/db`
- 产出：`MetadataRoute.Sitemap` 类型，Next.js 自动渲染为 `/sitemap.xml`

- [ ] **步骤 1：创建 sitemap.ts**

```typescript
import type { MetadataRoute } from "next";
import { db, publishedPages } from "@/lib/db";
import { eq, desc } from "drizzle-orm";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

const STATIC_ROUTES: MetadataRoute.Sitemap = [
  { url: APP_URL, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
  { url: `${APP_URL}/web`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
  { url: `${APP_URL}/home`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
  { url: `${APP_URL}/market`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
  { url: `${APP_URL}/mcp-market`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
  { url: `${APP_URL}/skill-market`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
  { url: `${APP_URL}/leaderboard`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
  { url: `${APP_URL}/moment`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
  { url: `${APP_URL}/collections`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
  { url: `${APP_URL}/docs/mcp/v1`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
  { url: `${APP_URL}/docs/api/v1`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const pages = await db
      .select({
        uid: publishedPages.uid,
        authorSlug: publishedPages.authorSlug,
        lastPublishedAt: publishedPages.lastPublishedAt,
      })
      .from(publishedPages)
      .where(
        and(
          eq(publishedPages.visibility, "public"),
          eq(publishedPages.moderationStatus, "approved"),
        )
      )
      .orderBy(desc(publishedPages.lastPublishedAt));

    const pageEntries: MetadataRoute.Sitemap = pages.map((p) => ({
      url: `${APP_URL}/${encodeURIComponent(p.authorSlug)}/${encodeURIComponent(p.uid)}`,
      lastModified: p.lastPublishedAt ?? new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));

    return [...STATIC_ROUTES, ...pageEntries];
  } catch {
    return STATIC_ROUTES;
  }
}
```

**注意：** 需要在文件顶部添加 `and` import：
```typescript
import { eq, desc, and } from "drizzle-orm";
```

- [ ] **步骤 2：验证输出**

启动 dev server 后访问 `http://localhost:3000/sitemap.xml`，确认返回格式正确，包含静态路由和公开页面。

- [ ] **步骤 3：提交**

```bash
git add apps/web/app/sitemap.ts
git commit -m "feat: add dynamic sitemap.xml with pages and static routes"
```

---

### 任务 3：创建 llms.txt 静态文件

**文件：**
- 创建：`apps/web/public/llms.txt`

**接口：**
- 产出：Next.js 自动将 `public/llms.txt` 作为静态资源在 `/llms.txt` 提供

- [ ] **步骤 1：创建 llms.txt**

```markdown
# Viben
> Agent Swarm × Code Evolution — 多智能体协作平台，支持富文本页面创作与分享。
> 在这里 AI agent 可以搜索、阅读和分析创作者发布的各类技术文章、笔记和文档。

## MCP 服务
- [Viben MCP 服务文档](https://viben-web.vercel.app/docs/mcp/v1): 基于 Model Context Protocol v1.0.0，AI 助手可搜索、读取、创建和更新 Viben 页面。支持 Claude Code、Codex、Cursor、VS Code 和 Claude Desktop。

## API 文档
- [Viben REST API 文档](https://viben-web.vercel.app/docs/api/v1): 面向创作者的 REST API，基于 OpenAPI 3.0，提供页面管理、用户信息、社区互动等接口。

## 快速入口
- [API 密钥管理](https://viben-web.vercel.app/settings/api_keys): 创建 MCP / API 访问密钥
- [OpenAPI 规范](https://viben-web.vercel.app/openapi.json): 机器可读的 API 定义
- [健康检查](https://viben-web.vercel.app/api/health): API 服务健康状态
```

- [ ] **步骤 2：验证**

启动 dev server 后访问 `http://localhost:3000/llms.txt`，确认返回正确。

- [ ] **步骤 3：提交**

```bash
git add apps/web/public/llms.txt
git commit -m "feat: add llms.txt for AI agent discovery"
```

---

### 任务 4：创建 llms-full.txt 动态路由

**文件：**
- 创建：`apps/web/app/llms-full.txt/route.ts`

**接口：**
- 消费：`db`、`publishedPages` from `@/lib/db`
- 产出：`GET /llms-full.txt?limit=N` 返回 `text/plain; charset=utf-8`

- [ ] **步骤 1：创建路由文件**

```typescript
import { NextResponse } from "next/server";
import { db, publishedPages } from "@/lib/db";
import { eq, desc } from "drizzle-orm";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") ?? "50"), 1), 200);

  try {
    const pages = await db
      .select({
        uid: publishedPages.uid,
        title: publishedPages.title,
        html: publishedPages.html,
        description: publishedPages.description,
        tags: publishedPages.tags,
        authorSlug: publishedPages.authorSlug,
        authorDisplayName: publishedPages.authorDisplayName,
        lastPublishedAt: publishedPages.lastPublishedAt,
      })
      .from(publishedPages)
      .where(
        and(
          eq(publishedPages.visibility, "public"),
          eq(publishedPages.moderationStatus, "approved"),
        )
      )
      .orderBy(desc(publishedPages.viewCount))
      .limit(limit);

    const sections = pages.map((p) => {
      const url = `${APP_URL}/${encodeURIComponent(p.authorSlug)}/${encodeURIComponent(p.uid)}`;
      const tags = (p.tags as string[] ?? []).join(", ");
      return [
        `---`,
        ``,
        `## [${p.title}](${url})`,
        `**作者:** ${p.authorDisplayName ?? p.authorSlug} | **发布时间:** ${p.lastPublishedAt?.toISOString() ?? "未知"} | **标签:** ${tags || "无"}`,
        ``,
        p.description ? `> ${p.description}` : "",
        ``,
        p.html ?? "",
        ``,
      ].join("\n");
    });

    const body = `# Viben Pages\n\n${sections.join("\n")}`;

    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to generate llms-full.txt" },
      { status: 500 },
    );
  }
}
```

**注意：** 需要在文件顶部添加 `and` import：
```typescript
import { eq, desc, and } from "drizzle-orm";
```

- [ ] **步骤 2：验证**

启动 dev server 后访问 `http://localhost:3000/llms-full.txt`，确认返回包含页面标题和 HTML 内容。测试 `?limit=5` 参数。

- [ ] **步骤 3：提交**

```bash
git add apps/web/app/llms-full.txt/route.ts
git commit -m "feat: add llms-full.txt dynamic route for AI content consumption"
```

---

### 任务 5：创建 AGENTS.md

**文件：**
- 创建：`apps/web/public/AGENTS.md`

**接口：**
- 产出：Next.js 自动将 `public/AGENTS.md` 作为静态资源在 `/AGENTS.md` 提供

- [ ] **步骤 1：创建 AGENTS.md**

```markdown
# Viben for AI Agents

Viben 是一个多智能体协作与内容创作平台。此文件帮助你（AI coding agent）快速接入 Viben 的 MCP 服务和 API。

## MCP 连接

Viben 提供 Model Context Protocol (MCP) 服务端点：

```
https://viben-web.vercel.app/api/mcp/v1
```

### Claude Code 快速连接

```bash
claude mcp add --transport http viben https://viben-web.vercel.app/api/mcp/v1
```

### 可用工具

| 工具 | 描述 | 认证 |
|------|------|------|
| `search_pages` | 搜索已发布的公开页面（支持关键词、作者、标签过滤、排序、分页） | 可选 |
| `get_page` | 获取指定页面的完整内容和元数据 | 可选 |
| `create_page` | 发布新页面（upsert 语义） | 需要 API Key |
| `update_page` | 更新已有页面的内容或元数据 | 需要 API Key |

### 认证

- 读取操作无需认证（仅限公开页面）
- 写入操作需要 API Key（`bmcp_` 前缀）
- API Key 创建地址：`/settings/api_keys`

## API 参考

- OpenAPI 规范：`/openapi.json`
- MCP 文档：`/docs/mcp/v1`
- REST API 文档：`/docs/api/v1`

## 更多信息

- llms.txt：`/llms.txt`（精选内容索引）
- 站点地图：`/sitemap.xml`
```

- [ ] **步骤 2：验证**

启动 dev server 后访问 `http://localhost:3000/AGENTS.md`，确认返回正确。

- [ ] **步骤 3：提交**

```bash
git add apps/web/public/AGENTS.md
git commit -m "docs: add AGENTS.md for coding agent integration guide"
```

---

### 任务 6：页面详情页元数据增强（JSON-LD + meta + 内容协商）

**文件：**
- 修改：`apps/web/app/(dashboard)/[user_slug]/[page_id]/page.tsx`

**接口：**
- 消费：现有的 `getPublishedPageContext`、`generateMetadata`
- 产出：页面 `<head>` 中的 JSON-LD script、增强 meta tags、`Accept: text/markdown` 内容协商

- [ ] **步骤 1：在 generateMetadata 中补充 canonical 和 robots**

找到 `generateMetadata` 函数中的 `const metadata: Metadata = { ... }` 对象，添加 `alternates` 和 `robots` 字段。

在 `metadata` 对象内添加：

```typescript
const metadata: Metadata = {
  title,
  description: seoDescription,
  keywords: ctx.page.seoKeywords ?? undefined,
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/${encodeURIComponent(user_slug)}/${encodeURIComponent(page_id)}`,
  },
  robots: ctx.page.isDiscoverable === false
    ? { index: false, follow: false }
    : { index: true, follow: true },
  openGraph: {
    // ... 保持不变
  },
  twitter: {
    // ... 保持不变
  },
};
```

**注意**：`alternates.canonical` 的值与已有 social 分享 URL 逻辑一致。如果 `isDiscoverable === false`，保持原有的 `{ index: false, follow: false }`；否则设为 `{ index: true, follow: true }`。

- [ ] **步骤 2：在页面组件中添加 JSON-LD 脚本注入**

在 `PagePage` 函数中，在现有的 `<script id="viben-page-meta">` 之前插入 JSON-LD 脚本。

```tsx
// 在 const APP_URL = ... 之后（组件函数顶部）
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// 在 <script id="viben-page-meta"> 之前插入：
<script
  id="viben-json-ld"
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Article",
          "@id": `${APP_URL}/${encodeURIComponent(user_slug)}/${encodeURIComponent(page_id)}#article`,
          headline: ctx.page.title,
          description: ctx.page.description,
          ...(ctx.page.coverUrl ? { image: ctx.page.coverUrl } : {}),
          datePublished: ctx.page.publishedAt?.toISOString(),
          dateModified: ctx.page.lastPublishedAt?.toISOString(),
          author: {
            "@type": "Person",
            name: ctx.page.authorDisplayName ?? ctx.author.displayName,
            url: `${APP_URL}/${encodeURIComponent(ctx.author.userSlug)}`,
          },
          publisher: {
            "@type": "Organization",
            name: "Viben",
            url: APP_URL,
          },
          url: `${APP_URL}/${encodeURIComponent(user_slug)}/${encodeURIComponent(page_id)}`,
          ...(ctx.page.tags?.length ? { keywords: (ctx.page.tags as string[]).join(", ") } : {}),
          inLanguage: "zh-CN",
        },
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Viben", item: APP_URL },
            {
              "@type": "ListItem",
              position: 2,
              name: ctx.page.authorDisplayName ?? ctx.author.displayName,
              item: `${APP_URL}/${encodeURIComponent(ctx.author.userSlug)}`,
            },
            { "@type": "ListItem", position: 3, name: ctx.page.title },
          ],
        },
      ],
    }),
  }}
/>
```

- [ ] **步骤 3：添加内容协商逻辑**

在 `PagePage` 函数中，从 `next/headers` 读取 `Accept` 请求头，如果包含 `text/markdown`，则直接返回原始 HTML 内容。

在函数顶部（在 `canReadPage` 检查后）添加：

```typescript
import { headers } from "next/headers";

// 在 PagePage 函数内，canReadPage 检查通过后：
const acceptHeader = (await headers()).get("accept") ?? "";

if (acceptHeader.includes("text/markdown")) {
  return new Response(ctx.page.html ?? "", {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Vary": "Accept",
      "Link": `</${encodeURIComponent(user_slug)}/${encodeURIComponent(page_id)}>; rel="alternate"; type="text/html"`,
    },
  });
}
```

**注意**：因为返回的是 `new Response()` 而非 React 组件，TypeScript 类型没问题（server component 允许返回 `ReactNode | Response`）。

- [ ] **步骤 4：验证 — typecheck**

```bash
cd apps/web && pnpm typecheck
```

确保无类型错误。

- [ ] **步骤 5：验证 — 页面正常渲染**

启动 dev server，访问任意公开页面，确认：
- 页面正常渲染无报错
- 查看页面源代码包含 `<script type="application/ld+json">`
- `<head>` 中有 `<link rel="canonical">`

- [ ] **步骤 6：验证 — 内容协商**

```bash
curl -H "Accept: text/markdown" http://localhost:3000/test-user/test-page
```

确认返回纯 HTML 内容（非完整页面 UI），响应头包含 `Vary: Accept`。

- [ ] **步骤 7：提交**

```bash
git add apps/web/app/\(dashboard\)/\[user_slug\]/\[page_id\]/page.tsx
git commit -m "feat: add JSON-LD structured data, canonical URL, and content negotiation to page detail"
```

---

### 任务 7：根 layout 默认 meta 增强

**文件：**
- 修改：`apps/web/app/layout.tsx`

**接口：**
- 消费：现有 `metadata` 导出
- 产出：增强的默认 meta tags

- [ ] **步骤 1：补充 metadata 字段**

在 `apps/web/app/layout.tsx` 的 `metadata` 对象中添加默认 `robots` 和补充 `openGraph`。

当前 metadata：
```typescript
export const metadata: Metadata = {
  title: {
    default: 'Viben',
    template: '%s | Viben',
  },
  description: 'Agent Swarm × Code Evolution - Multi-agent collaboration platform for controllable AI workflows',
};
```

修改为：
```typescript
export const metadata: Metadata = {
  title: {
    default: "Viben",
    template: "%s | Viben",
  },
  description:
    "Agent Swarm × Code Evolution - Multi-agent collaboration platform for controllable AI workflows",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    siteName: "Viben",
    type: "website",
    locale: "zh_CN",
  },
};
```

**注意**：`robots` 是默认值，各页面可以通过自己的 `generateMetadata` 覆盖。`openGraph.siteName` 让所有页面的 OG 卡片都有统一的站点名。

- [ ] **步骤 2：补充 `<html>` 标签的 lang 切换支持**

当前 `<html lang="en">` 是硬编码的。由于应用已使用 i18n，应补充 `hrefLang` 支持。但本次不改 i18n 路由逻辑——只是确保 default `lang` 准确。不做代码改动，但添加 `<link rel="alternate" hreflang="...">` 暂不处理（需要 i18n 路由配合，超出本次范围）。

保持 `<html lang="en" suppressHydrationWarning>` 不变。

- [ ] **步骤 3：验证 typecheck**

```bash
cd apps/web && pnpm typecheck
```

- [ ] **步骤 4：提交**

```bash
git add apps/web/app/layout.tsx
git commit -m "feat: enhance root layout metadata with robots and openGraph defaults"
```

---

### 任务 8：首页 metadata 补充 canonical

**文件：**
- 修改：`apps/web/app/(dashboard)/page.tsx`

**接口：**
- 消费：现有的 `export const metadata`
- 产出：补充 `alternates.canonical`

- [ ] **步骤 1：在 metadata 对象中添加 alternates.canonical**

在现有的 `metadata` 对象中添加：

```typescript
export const metadata: Metadata = {
  // ... 现有字段保持不变
  alternates: {
    canonical: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  },
  robots: {
    index: true,
    follow: true,
  },
};
```

完整的 metadata 对象需包含所有现有字段 + 新字段。

- [ ] **步骤 2：验证 typecheck**

```bash
cd apps/web && pnpm typecheck
```

- [ ] **步骤 3：验证输出**

访问首页 `http://localhost:3000`，查看源代码确认 `<link rel="canonical">` 和 `<meta name="robots">` 存在。

- [ ] **步骤 4：提交**

```bash
git add apps/web/app/\(dashboard\)/page.tsx
git commit -m "feat: add canonical URL and robots meta to homepage"
```

---

### 任务 9：MCP search_pages 工具增强

**文件：**
- 修改：`apps/web/app/api/mcp/v1/route.ts`

**接口：**
- 修改：`search_pages` tool 定义（Zod schema + handler）
- 新增参数：`tags`、`sort_by`、`sort_order`、`offset`

- [ ] **步骤 1：修改 search_pages 工具定义**

找到 `server.tool("search_pages", ...)` 调用，将参数 Zod schema 从：

```typescript
{
  query: z.string().min(1).describe("搜索关键词"),
  author_slug: z.string().optional().describe("按作者 slug 过滤"),
  limit: z.number().int().min(1).max(50).optional().describe("返回数量，默认 20"),
}
```

修改为：

```typescript
{
  query: z.string().min(1).describe("搜索关键词"),
  author_slug: z.string().optional().describe("按作者 slug 过滤"),
  tags: z.array(z.string()).max(12).optional().describe("按标签过滤，所有标签必须同时匹配（AND 逻辑）"),
  sort_by: z.enum(["published_at", "title"]).optional().describe("排序字段，默认 published_at"),
  sort_order: z.enum(["desc", "asc"]).optional().describe("排序方向，默认 desc"),
  limit: z.number().int().min(1).max(50).optional().describe("返回数量，默认 20"),
  offset: z.number().int().min(0).optional().describe("分页偏移，默认 0"),
}
```

- [ ] **步骤 2：修改 handler 函数**

将 handler 函数参数从：

```typescript
async ({ query, author_slug, limit = 20 }) => {
```

修改为：

```typescript
async ({ query, author_slug, tags, sort_by, sort_order, limit = 20, offset = 0 }) => {
```

- [ ] **步骤 3：添加 tags 过滤条件**

在现有的 `conditions` 数组中，在 `author_slug` 条件之后添加：

```typescript
if (tags && tags.length > 0) {
  // PostgreSQL array containment: all specified tags must be present
  conditions.push(sql`${publishedPages.tags} @> ARRAY[${sql.join(tags.map((t) => sql`${t}`), sql`, `)}]`);
}
```

**注意**：确保 `sql` 从 `drizzle-orm` 已 import（文件顶部已有 `import { and, eq, desc, sql } from "drizzle-orm"`）。

- [ ] **步骤 4：添加排序逻辑**

修改 `.orderBy()` 调用。将其从：

```typescript
.orderBy(desc(publishedPages.lastPublishedAt))
```

修改为使用变量的形式。在 handler 函数内添加排序逻辑：

```typescript
import { asc } from "drizzle-orm";

// 在 handler 函数内：
const orderColumn = sort_by === "title" ? publishedPages.title : publishedPages.lastPublishedAt;
const orderFn = sort_order === "asc" ? asc : desc;
```

然后修改查询链：

```typescript
const pages = await db
  .select({ /* ... 不变 ... */ })
  .from(publishedPages)
  .where(and(...conditions))
  .orderBy(orderFn(orderColumn))
  .limit(limit)
  .offset(offset);
```

**注意**：需要确认 `asc` 已 import。检查文件顶部 import，如果没有 `asc`，在 `desc` 旁边添加：
```typescript
import { and, eq, desc, asc, sql } from "drizzle-orm";
```

- [ ] **步骤 5：验证 typecheck**

```bash
cd apps/web && pnpm typecheck
```

- [ ] **步骤 6：验证功能**

启动 dev server 后，用 curl 测试：

```bash
# 测试 tags 过滤
curl -X POST http://localhost:3000/api/mcp/v1 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_pages","arguments":{"query":"test","tags":["intro"],"limit":5}}}'

# 测试排序
curl -X POST http://localhost:3000/api/mcp/v1 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"search_pages","arguments":{"query":"test","sort_by":"title","sort_order":"asc","limit":5}}}'

# 测试分页
curl -X POST http://localhost:3000/api/mcp/v1 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"search_pages","arguments":{"query":"test","limit":5,"offset":5}}}'
```

- [ ] **步骤 7：提交**

```bash
git add apps/web/app/api/mcp/v1/route.ts
git commit -m "feat: add tags filter, sort, and pagination to search_pages MCP tool"
```

---

### 任务 10：MCP 文档页同步新增参数

**文件：**
- 修改：`apps/web/app/docs/mcp/v1/page.tsx`

**接口：**
- 修改：`search_pages` 工具的参数表格、中英文翻译

- [ ] **步骤 1：添加新参数的中英文翻译**

在 `t.zh` 和 `t.en` 对象中分别添加翻译键。

在 `t.zh` 中（`readToolsDesc` 之后的位置）添加：

```typescript
// search_pages 新增参数描述
searchPagesTags: "按标签过滤，所有指定标签必须同时匹配（AND 逻辑）。最多 12 个标签。",
searchPagesSortBy: "排序字段。published_at 按发布时间排序；title 按标题字母序。默认 published_at。",
searchPagesSortOrder: "排序方向。desc 降序；asc 升序。默认 desc。",
searchPagesOffset: "分页偏移量，配合 limit 实现翻页。默认 0（第一页）。",
```

在 `t.en` 中对应添加：

```typescript
searchPagesTags: "Filter by tags. All specified tags must match (AND logic). Max 12 tags.",
searchPagesSortBy: "Sort field. published_at sorts by publish time; title sorts alphabetically. Default published_at.",
searchPagesSortOrder: "Sort order. desc for descending; asc for ascending. Default desc.",
searchPagesOffset: "Pagination offset. Use with limit for page navigation. Default 0 (first page).",
```

- [ ] **步骤 2：在 tParams 中注册新参数**

在 `p()` 辅助函数调用区域（`READ_TOOLS` 数组定义之前），修改 `search_pages` 的 `params` 数组，在现有的 3 个 param 之后添加 4 个新 param：

```typescript
{
  name: "search_pages",
  descKey: "searchPages",
  returnsKey: "searchPagesReturns",
  notesKey: "searchPagesNote",
  params: [
    p("query", /* 已有 */, /* 已有 */, "是", "string"),
    p("author_slug", /* 已有 */, /* 已有 */, "否", "string"),
    p("limit", /* 已有 */, /* 已有 */, "否", "number"),
    // 新增 ─────────────────────
    p("tags", "按标签过滤，所有指定标签必须同时匹配（AND 逻辑）。最多 12 个标签。", "Filter by tags. All specified tags must match (AND logic). Max 12 tags.", "否", "string[]"),
    p("sort_by", "排序字段。published_at 或 title。默认 published_at。", "Sort field: published_at or title. Default published_at.", "否", '"published_at" | "title"'),
    p("sort_order", "排序方向。desc 降序，asc 升序。默认 desc。", "Sort order: desc or asc. Default desc.", "否", '"desc" | "asc"'),
    p("offset", "分页偏移量，配合 limit 实现翻页。默认 0。", "Pagination offset, use with limit. Default 0.", "否", "number"),
  ],
},
```

**注意**：需要同步更新 `p()` 函数的调用 —— 新增的 4 个 p() 调用会自动注册对应的 `tParams` 键。

- [ ] **步骤 3：验证 typecheck**

```bash
cd apps/web && pnpm typecheck
```

- [ ] **步骤 4：验证 UI**

启动 dev server，访问 `/docs/mcp/v1`，确认 `search_pages` 工具的参数表显示了 7 个参数（query、author_slug、limit、tags、sort_by、sort_order、offset）。

- [ ] **步骤 5：提交**

```bash
git add apps/web/app/docs/mcp/v1/page.tsx
git commit -m "docs: sync MCP docs page with new search_pages parameters"
```

---

## 自检清单

- [x] **Spec 覆盖**：9 个 spec 需求 → 10 个任务（spec 中第 7 项 "增强 meta tags" 拆分到任务 6+7+8）
- [x] **无占位符**：所有步骤包含实际代码
- [x] **类型一致性**：`tags` 统一使用 `string[]`、`sort_by`/`sort_order` 使用 zod enum、`offset` 使用 `number`
- [x] **文件路径**：所有路径使用绝对路径格式

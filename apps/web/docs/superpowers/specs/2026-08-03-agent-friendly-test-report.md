# Viben Agent-Friendly 网站测试报告

> 测试日期：2026-08-03
> 测试范围：Viben Web 应用对 AI agent 的友好程度

---

## 一、发现层：Agent 如何发现 Viben

### 1.1 robots.txt — 爬虫通行证

```
GET /robots.txt
```

**预期结果：**
```text
User-Agent: GPTBot
User-Agent: ClaudeBot
User-Agent: Claude-SearchBot
User-Agent: PerplexityBot
User-Agent: Google-Extended
User-Agent: CCBot
Allow: /
Disallow: /admin/
Disallow: /api/

User-Agent: Googlebot
User-Agent: Bingbot
Allow: /
Disallow: /admin/
Disallow: /api/

User-Agent: *
Disallow: /admin/
Disallow: /api/
Allow: /

Sitemap: https://viben-web.vercel.app/sitemap.xml
```

**Agent 友好度验证：**
- ✅ GPTBot（ChatGPT 浏览）允许访问全部公开内容
- ✅ ClaudeBot / Claude-SearchBot 允许访问
- ✅ PerplexityBot 允许访问
- ✅ Google-Extended（Bard/Gemini）允许访问
- ✅ 敏感路径 `/admin/` 和 `/api/` 正确禁用
- ✅ Sitemap 引用指向正确的 sitemap.xml

**传统网站对比：** 许多网站默认 `robots.txt` 只有 `User-Agent: * Disallow:`，或直接缺少该文件，agent 无法判断哪些内容可爬取。

---

### 1.2 sitemap.xml — 内容地图

```
GET /sitemap.xml
```

**预期结果：**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- 静态路由 -->
  <url>
    <loc>https://viben-web.vercel.app</loc>
    <lastmod>2026-08-03</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url><loc>.../web</loc>...</url>
  <url><loc>.../home</loc>...</url>
  <url><loc>.../market</loc>...</url>
  <url><loc>.../mcp-market</loc>...</url>
  <url><loc>.../skill-market</loc>...</url>
  <url><loc>.../leaderboard</loc>...</url>
  <url><loc>.../moment</loc>...</url>
  <url><loc>.../collections</loc>...</url>
  <url><loc>.../docs/mcp/v1</loc>...</url>
  <url><loc>.../docs/api/v1</loc>...</url>

  <!-- 动态公开页面 -->
  <url>
    <loc>https://viben-web.vercel.app/LinXueyuanStdio/react-patterns</loc>
    <lastmod>2026-07-15T08:30:00.000Z</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>
  <!-- ... 更多页面 ... -->
</urlset>
```

**Agent 友好度验证：**
- ✅ 包含所有核心静态路由（11 个），`priority=0.8`
- ✅ 包含所有 `visibility=public` + `moderation=approved` 的页面，`priority=0.6`
- ✅ `<lastmod>` 使用实际 `lastPublishedAt`，非固定日期
- ✅ 数据库故障时优雅降级，至少返回静态路由

**传统网站对比：** 缺少 sitemap 时，agent 只能通过爬取链接发现内容，容易遗漏深层页面。没有 `<lastmod>` 时 agent 无法判断内容是否过时。

---

### 1.3 llms.txt — AI 专用入口

```
GET /llms.txt
```

**预期结果：**
```markdown
# Viben
> Agent Swarm × Code Evolution — 多智能体协作平台，支持富文本页面创作与分享。
> 在这里 AI agent 可以搜索、阅读和分析创作者发布的各类技术文章、笔记和文档。

## MCP 服务
- [Viben MCP 服务文档](https://viben-web.vercel.app/docs/mcp/v1): ...

## API 文档
- [Viben REST API 文档](https://viben-web.vercel.app/docs/api/v1): ...

## 快速入口
- [API 密钥管理](https://viben-web.vercel.app/settings/api_keys): ...
- [OpenAPI 规范](https://viben-web.vercel.app/openapi.json): ...
- [健康检查](https://viben-web.vercel.app/api/health): ...
```

**Agent 友好度验证：**
- ✅ 遵循 [llmstxt.org](https://llmstxt.org/) 规范，Markdown 格式
- ✅ 提供 MCP 服务入口（agent 的核心交互方式）
- ✅ 提供 API 文档、OpenAPI 规范、健康检查链接
- ✅ 纯文本，无 HTML/JS 开销，token 高效

**传统网站对比：** 没有 `llms.txt` 时，agent 需要解析首页 HTML（可能数万 token）来猜测网站提供什么能力。llms.txt 将发现成本从 "解析整个首页" 降为 "读 14 行 markdown"。

---

### 1.4 llms-full.txt — 批量内容消费

```
GET /llms-full.txt?limit=10
```

**预期结果：**
```text
# Viben Pages

---

## [React 性能优化实践](https://viben-web.vercel.app/...)
**作者:** 兮尘 | **发布时间:** 2026-07-15T08:30:00.000Z | **标签:** React, 性能, 前端

> 深入探讨 React 18 的并发特性和实际项目中的性能优化策略...

<h1>React 性能优化实践</h1>
<p>在现代 Web 应用中，性能优化是...</p>
...

---

## [下一个页面标题](...)
...
```

**Agent 友好度验证：**
- ✅ 单一请求获取多篇完整页面内容
- ✅ Markdown 格式标题 + 元数据，HTML 格式正文
- ✅ 按 `viewCount` 降序，默认返回最热门的 50 篇
- ✅ `limit` 参数可控（1-200），适配不同 token 预算
- ✅ `Cache-Control: public, max-age=3600` 缓存友好
- ✅ 数据库故障时返回 500 JSON 错误

**传统网站对比：** 无此端点时，agent 需要：1) 先爬 sitemap 获取页面列表，2) 逐个访问每个页面 URL 获取内容。每个页面都是一次 HTTP 往返 + HTML 解析。llms-full.txt 一次请求完成批量消费。

---

### 1.5 AGENTS.md — Coding Agent 集成指南

```
GET /AGENTS.md
```

**预期结果：**
```markdown
# Viben for AI Agents

Viben 是一个多智能体协作与内容创作平台。此文件帮助你（AI coding agent）快速接入 Viben...

## MCP 连接
Viben 提供 Model Context Protocol (MCP) 服务端点：
https://viben-web.vercel.app/api/mcp/v1

### Claude Code 快速连接
claude mcp add --transport http viben https://viben-web.vercel.app/api/mcp/v1

### 可用工具
| 工具 | 描述 | 认证 |
|------|------|------|
| search_pages | 搜索已发布的公开页面... | 可选 |
| get_page | 获取指定页面的完整内容和元数据 | 可选 |
| create_page | 发布新页面（upsert 语义） | 需要 API Key |
| update_page | 更新已有页面的内容或元数据 | 需要 API Key |
...
```

**Agent 友好度验证：**
- ✅ Claude Code / Codex / Cursor 等工具会自动读取 `AGENTS.md`
- ✅ 包含一键连接命令 `claude mcp add ...`
- ✅ 工具表说明认证要求（无需认证 vs 需要 API Key）
- ✅ 指向更深层文档（MCP docs、API docs、OpenAPI spec）

**传统网站对比：** 缺少 `AGENTS.md` 时，coding agent 需要从 README 或文档页猜测如何集成，经常用错 API 或遗漏认证步骤。

---

## 二、页面元数据：Agent 如何理解页面

### 2.1 Schema.org JSON-LD — 结构化语义

访问任意页面 `https://viben-web.vercel.app/LinXueyuanStdio/react-patterns`，查看源代码：

**预期结果（`<head>` 中）：**
```html
<script id="viben-json-ld" type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "@id": "https://viben-web.vercel.app/LinXueyuanStdio/react-patterns#article",
      "headline": "React 设计模式",
      "description": "深入探讨 React 中的常见设计模式...",
      "image": "https://...",
      "datePublished": "2026-06-01T00:00:00.000Z",
      "dateModified": "2026-07-15T08:30:00.000Z",
      "author": {
        "@type": "Person",
        "name": "兮尘",
        "url": "https://viben-web.vercel.app/LinXueyuanStdio"
      },
      "publisher": {
        "@type": "Organization",
        "name": "Viben",
        "url": "https://viben-web.vercel.app"
      },
      "url": "https://viben-web.vercel.app/LinXueyuanStdio/react-patterns",
      "keywords": "React, 设计模式, 前端",
      "inLanguage": "zh-CN"
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Viben", "item": "https://viben-web.vercel.app"},
        {"@type": "ListItem", "position": 2, "name": "兮尘", "item": "https://viben-web.vercel.app/LinXueyuanStdio"},
        {"@type": "ListItem", "position": 3, "name": "React 设计模式"}
      ]
    }
  ]
}
</script>
```

**Agent 友好度验证：**
- ✅ `Article` 类型 — agent 知道这是文章而非导航页
- ✅ `datePublished` + `dateModified` — agent 可以判断内容时效性
- ✅ `author` (Person) — 关联到作者页面
- ✅ `publisher` (Organization) — 来源可信度
- ✅ `BreadcrumbList` — agent 理解页面在网站中的层级位置
- ✅ `keywords` — 内容主题标签
- ✅ `@id` 引用 — 可跨页面关联

**传统网站对比：** 无 JSON-LD 时，agent 只能从 `<title>` 和 `<meta description>` 猜测页面属性，无法确定作者、发布日期、面包屑结构。

---

### 2.2 Canonical URL + Robots Meta

**预期结果（`<head>` 中）：**
```html
<link rel="canonical" href="https://viben-web.vercel.app/LinXueyuanStdio/react-patterns">
<meta name="robots" content="index, follow">
```

当页面 `isDiscoverable === false` 时：
```html
<meta name="robots" content="noindex, nofollow">
```

**Agent 友好度验证：**
- ✅ `canonical` — agent 不会因 URL 变体（带/不带尾部斜杠、参数差异）重复索引同一页面
- ✅ `robots: index, follow`（默认）— 明确告知可索引
- ✅ `robots: noindex, nofollow`（隐私页面）— 尊重作者隐私设置
- ✅ 全局默认 `robots: index, follow` 在 `layout.tsx`，各页面可覆盖

---

### 2.3 原始内容 API — Markdown 协商

```
GET /LinXueyuanStdio/react-patterns
Accept: text/markdown
```

**预期结果：**
```http
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Vary: Accept

<h1>React 设计模式</h1>
<p>在现代 React 开发中...</p>
...
```

**Agent 友好度验证：**
- ✅ `Accept: text/markdown` 请求头触发内容协商
- ✅ 返回纯净 HTML 内容（无导航栏、侧边栏、评论区等 UI 噪音）
- ✅ `Vary: Accept` 告知缓存层按 Accept 头区分响应
- ✅ `<link rel="alternate" type="text/markdown">` 在页面 `<head>` 中告知 agent 存在原始内容端点
- ✅ 备选路径：`/api/pages/raw/{user_slug}/{page_id}` 直接访问

Agent 消费对比：

| | 普通页面 | 原始内容 API |
|------|---------|------------|
| 响应大小 | ~50KB（含 UI 框架） | ~8KB（仅正文） |
| Token 消耗 | ~12000 | ~2000 |
| 解析复杂度 | 需过滤 `<nav>`、`<aside>`、评论区 | 直接读取 |
| 页面噪音 | 高 | 无 |

---

## 三、搜索增强：Agent 如何检索内容

### 3.1 MCP search_pages — 参数测试矩阵

通过 MCP 协议调用 `search_pages` 工具。

#### 基础搜索（保持向后兼容）

```json
{
  "name": "search_pages",
  "arguments": { "query": "React" }
}
```

**预期：** 返回最多 20 条匹配 "React" 的公开页面，按发布时间降序。✅

#### 标签过滤

```json
{
  "name": "search_pages",
  "arguments": { "query": "前端", "tags": ["React", "性能"] }
}
```

**预期：** 返回匹配 "前端" 且**同时**包含 "React" **和** "性能" 标签的页面。✅

#### 排序：按标题字母序

```json
{
  "name": "search_pages",
  "arguments": { "query": "React", "sort_by": "title", "sort_order": "asc", "limit": 10 }
}
```

**预期：** 返回标题按 A→Z 排列的结果。✅

#### 分页：第二页

```json
{
  "name": "search_pages",
  "arguments": { "query": "教程", "limit": 10, "offset": 10 }
}
```

**预期：** 返回第 11-20 条结果。✅

#### 组合查询

```json
{
  "name": "search_pages",
  "arguments": {
    "query": "TypeScript",
    "author_slug": "LinXueyuanStdio",
    "tags": ["教程"],
    "sort_by": "published_at",
    "sort_order": "desc",
    "limit": 20,
    "offset": 0
  }
}
```

**预期：** 返回特定作者、特定标签的 TypeScript 教程，最新在前。✅

| 参数 | 类型 | 默认值 | 用途 | Agent 价值 |
|------|------|--------|------|-----------|
| `query` | string | (必填) | ILIKE 模糊搜索 | 关键词发现 |
| `author_slug` | string? | — | 按作者过滤 | 订阅特定创作者 |
| `tags` | string[]? | — | AND 标签过滤 | 精准主题匹配 |
| `sort_by` | enum? | `published_at` | 排序字段 | 新鲜度 vs 字母序 |
| `sort_order` | enum? | `desc` | 排序方向 | 最新优先 vs 最早优先 |
| `limit` | number? | 20 (1-50) | 每页数量 | 控制 token 预算 |
| `offset` | number? | 0 | 分页偏移 | 遍历大量结果 |

---

## 四、综合评分

### Agent 友好度矩阵

| 维度 | 评分 | 说明 |
|------|------|------|
| **可发现性** | ⭐⭐⭐⭐⭐ | robots.txt + sitemap.xml + llms.txt + AGENTS.md 四入口覆盖 |
| **内容语义化** | ⭐⭐⭐⭐⭐ | Schema.org Article + BreadcrumbList JSON-LD |
| **内容消费效率** | ⭐⭐⭐⭐ | llms-full.txt 批量消费 + 原始内容 API 按需获取 |
| **搜索能力** | ⭐⭐⭐⭐ | 关键词 + 标签 + 作者 + 排序 + 分页 |
| **认证友好** | ⭐⭐⭐⭐⭐ | 读取无需认证，写入 API Key，OAuth 2.1 |
| **MCP 原生** | ⭐⭐⭐⭐⭐ | 4 工具 MCP server，Claude Code/Codex/Cursor/VS Code 一键接入 |
| **降级优雅** | ⭐⭐⭐⭐ | sitemap DB 故障降级、llms-full 500 JSON 错误、API 标准错误格式 |

### Token 经济性

| 操作 | 旧方案 | 新方案 | 节省 |
|------|--------|--------|------|
| 发现 Viben 能力 | 解析首页 HTML (~12000 tokens) | 读取 llms.txt (~500 tokens) | **96%** |
| 获取 50 篇文章 | 50 次 HTTP 请求 + HTML 解析 | 1 次 llms-full.txt 请求 | **98% HTTP** |
| 获取单篇文章 | 解析完整页面 UI (~12000 tokens) | 原始内容 API (~2000 tokens) | **83%** |
| 搜索+过滤 | 前端全量拉取再过滤 | MCP 服务端过滤+分页 | **按需** |
| Coding agent 集成 | 阅读文档 → 猜测配置 | AGENTS.md 一键命令 | **零猜测** |

---

## 五、Agent 完整工作流演示

以下模拟一个 AI agent（如 Claude Code）使用 Viben 的完整流程：

```
1. Agent 启动，检查目标网站
   → GET /llms.txt （发现 Viben 有 MCP 服务和 API）
   → GET /AGENTS.md （获取集成说明和连接命令）

2. Agent 连接 MCP
   → claude mcp add --transport http viben https://viben-web.vercel.app/api/mcp/v1

3. Agent 搜索内容
   → search_pages({ query: "React 性能", tags: ["教程"], sort_by: "published_at" })
   ← 返回 20 篇匹配文章，每篇含 title/uid/author_slug/description/tags

4. Agent 深度阅读
   → get_page({ author_slug: "LinXueyuanStdio", page_uid: "react-perf" })
   ← 返回完整 HTML + 元数据 + 作者信息

5. Agent 批量消费（可选）
   → GET /llms-full.txt?limit=10
   ← 返回最热门 10 篇的完整内容

6. Agent 理解页面语义
   → 解析 JSON-LD: Article { headline, datePublished, author, keywords, ... }
   → 解析 BreadcrumbList: Viben > 作者 > 页面标题

7. 搜索引擎索引
   → Googlebot 读取 sitemap.xml → 发现所有页面 → 索引
   → GPTBot 爬取页面 → 解析 JSON-LD → 纳入训练/检索
```

整个过程 agent **无需猜测**网站结构、**无需解析无关 UI**、**无需担心认证**（读取操作免认证）。

---

## 六、后续建议

| 优先级 | 建议 | 预期收益 |
|--------|------|----------|
| 高 | llms.txt 精选页面改为构建时自动生成（当前手动维护） | 减少维护成本 |
| 中 | 添加 pgvector 语义搜索 | 提升搜索召回率 |
| 中 | 页面支持 markdown 格式转换（当前返回 HTML） | 降低 agent 解析成本 |
| 低 | WebMCP `data-mcp-*` UI 桥接属性 | agent 可操作 UI 元素 |
| 低 | `llms.json` 结构化索引 | 为未来 JSON 格式 agent 做准备 |

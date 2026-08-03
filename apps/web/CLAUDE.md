# Caching Guidelines

## 缓存选型速查

| 场景 | 缓存位置 | 方案 | 刷新策略 | TTL |
|------|----------|------|----------|-----|
| 排行榜/热门列表 | 服务端 | `unstable_cache` | GitHub Action 周期性重建 | 永久(手动刷新) |
| 推荐内容 | 服务端 | `unstable_cache` | GitHub Action 周期性重建 | 永久(手动刷新) |
| 页面内容(HTML) | 服务端 | `unstable_cache` + 时间戳 key | 页面发布时 | 永久(手动刷新) |
| 用户公开资料 | 服务端 | `unstable_cache` | 不刷新(自然老化) | 永久(手动刷新) |
| 图片/静态资源 | 浏览器 | `Cache-Control: max-age=31536000, immutable` | 内容不变 | 1年 |
| 页面路由导航 | 浏览器 | Next.js `staleTimes` | 自动 | 5分钟 |
| 用户登录状态 | 浏览器 | localStorage + 内存 | 重新登录时 | 30分钟 |
| 动态 Feed/评论 | 无缓存 | 实时查询 | - | - |
| 用户交互状态 | 服务端 | React `cache()` | 请求级 | 单次请求 |

## 核心原则

### 1. 数据新鲜度决定缓存位置

```
实时性要求高 → 不缓存，直接查 DB
    例：动态 Feed、评论列表、点赞状态

分钟级可接受 → 服务端 unstable_cache + 定时刷新
    例：首页排行榜、热门推荐、用户关注列表

小时级可接受 → 服务端缓存 + GitHub Action 定时 rebuild
    例：基于权重的排名、统计数据

永不变 → 浏览器强缓存
    例：用户上传的图片、头像
```

### 2. 服务端缓存 (`unstable_cache`)

```typescript
import { unstable_cache } from "next/cache";

// ✅ 正确：数据变化频率低，通过外部机制刷新
export const getHomePageData = unstable_cache(
  async () => { /* heavy query */ },
  ["cache-key"],
  { revalidate: false, tags: ["cache-key"] },
);

// ❌ 错误：用户交互频繁的数据不要缓存
// 例：点赞状态、评论列表、阅读历史
```

**⚠️ Date 序列化陷阱：** `unstable_cache` 使用 JSON 序列化存储，`Date` 对象会变成 ISO 字符串。消费缓存数据时不能直接调用 `.toISOString()`。

```typescript
// ❌ 错误：缓存命中时 Date 已是 string，.toISOString() 报错
datePublished: ctx.page.publishedAt?.toISOString()

// ✅ 正确：兼容 Date 和 string
function iso(d: Date | string | null | undefined): string | undefined {
  if (!d) return undefined;
  return typeof d === "string" ? d : (d as Date).toISOString();
}
datePublished: iso(ctx.page.publishedAt)
```

**缓存刷新方式：**
- `revalidate: false` → 永久缓存，手动 `revalidateTag()` 刷新
- `revalidate: 300` → 5 分钟自动过期
- 调用 `revalidateTag("cache-key")` → 立即失效

**缓存 key 设计：**
- 共享数据：固定 key，如 `["homepage"]`、`["page-recommendations"]`
- 用户无关数据：全局单份缓存，调用方自行过滤
- 可变数据：用时间戳做 key 的一部分，数据更新时自动换 key

```typescript
// ✅ 模式：时间戳比对缓存
export async function getCachedPage(userSlug: string, pageId: string) {
  // 轻量查询获取当前时间戳
  const dbPage = await db.query.publishedPages.findFirst({...});
  const timestamp = dbPage.lastPublishedAt?.toISOString() ?? "never";

  // 时间戳作为参数 → 发布后自动换 key
  const getCtx = unstable_cache(
    async (ts: string) => { /* heavy query */ },
    [cacheKey],
    { revalidate: false, tags: [cacheKey] },
  );
  return getCtx(timestamp);
}
```

**缓存失效：**
- `revalidateTag("homepage")` — 手动失效特定缓存
- 在 `apps/web/app/api/admin/rankings/rebuild/route.ts` 中统一刷新排行榜相关缓存
- 在 `apps/web/app/api/pages/publish/route.ts` 中刷新页面内容缓存

### 3. 浏览器缓存

**图片/静态资源：** 通过 `Cache-Control` 响应头控制

```typescript
// ✅ API route 中设置
headers: {
  "Cache-Control": "public, max-age=31536000, immutable",
}

// ✅ 图片代理示例：apps/web/app/api/media/asset/route.ts
```

**页面路由缓存：** 通过 `next.config.ts` 配置

```typescript
// next.config.ts
staleTimes: {
  dynamic: 300,  // 动态页面在浏览器缓存 5 分钟
  static: 300,   // 静态页面同上
},
```

**登录状态缓存：** 内存 + localStorage 双重缓存

```typescript
// 详见 apps/web/components/layout/app-shell-wrapper.tsx
const SESSION_CACHE_TTL = 30 * 60 * 1000; // 30 分钟
// 1. 模块级变量：同 SPA session 内避免重复请求
// 2. localStorage：跨页面刷新持久化
```

### 4. 不应该缓存的场景

- ❌ 评论列表（实时性要求高）
- ❌ 点赞/收藏状态（用户相关的交互状态）
- ❌ 通知列表（实时推送）
- ❌ 搜索结果（用户输入驱动的查询）
- ❌ 含 `cookies()`/`headers()` 的页面（已有 Next.js 默认 `Cache-Control: private`）
- ❌ 用户自身的数据（如「我的页面」「我的收藏」）

### 5. 查询优化

```typescript
// ✅ Drizzle 查询必须显式列名，不要用 db.select().from()
db.select({
  id: users.id,
  userSlug: users.userSlug,
  displayName: users.displayName,
  // ...
}).from(users)

// ❌ 隐式 select 可能返回类型不匹配，驱动字段为 0/null
db.select().from(users)
```

### 6. 缓存架构总览

```
用户请求
  │
  ├─ 浏览器缓存层 ──────────────────────────────────
  │   ├─ 页面路由：Next.js staleTimes
  │   ├─ 登录态：localStorage + 内存
  │   └─ 图片：Cache-Control immutable
  │
  ├─ 服务端缓存层 ──────────────────────────────────
  │   └─ unstable_cache (永久/手动刷新)
  │       ├─ 首页排行榜 → GitHub Action 每小时
  │       ├─ 首页推荐用户 → GitHub Action 每小时
  │       ├─ 阅读页推荐 → GitHub Action 每小时
  │       └─ 阅读页内容 → 发布时刷新
  │
  └─ 数据库 ───────────────────────────────────────
      └─ 实时查询（动态 Feed、评论、搜索等）
```

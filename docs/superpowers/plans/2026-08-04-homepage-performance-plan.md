# Dashboard 首页加载性能优化 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Dashboard 首页的多查询聚合为单一缓存入口，减少数据库请求，并预加载跑马灯封面图片。

**Architecture:** 新建 `getHomePageData()` 聚合函数（`unstable_cache` 包装），page.tsx 调用一次获取全部数据；HomeSidebarSection 改为接收 props；发布时主动失效缓存。

**Tech Stack:** Next.js 15.5.11, Drizzle ORM, React Server Components, TypeScript

## Global Constraints

- 所有 import 使用显式 `import type` 语句，禁止内联 `import("path").Type` 语法
- 禁止使用 `= await import()` 动态导入（`initializeCore`、可选依赖、测试文件除外）
- 仅优化 Dashboard 首页 (`apps/web/app/(dashboard)/page.tsx`)
- HomeFeedSection 保持不动（动态数据需实时）
- 类型检查必须通过：`cd apps/web && pnpm typecheck`

---

### Task 1: 创建 `getHomePageData()` 聚合查询函数

**Files:**
- Modify: `apps/web/lib/services/community.ts`

**Interfaces:**
- Consumes: `listRanking`, `db`, `publishedPages`, `users` from existing imports
- Produces:
  ```typescript
  export interface HomePageData {
    rankingItems: Awaited<ReturnType<typeof listRanking>>['items']
    latestPages: Array<{ uid: string; title: string; coverUrl: string | null; authorDisplayName: string | null; authorAvatarUrl: string | null; authorSlug: string; lastPublishedAt: Date; viewCount: number; likeCount: number; commentCount: number }>
    topAuthors: Array<{ id: string; userSlug: string; displayName: string | null; avatarUrl: string | null; bio: string | null; pageCount: number | null; followersCount: number }>
  }
  ```

- [ ] **Step 1: 在 `community.ts` 顶部添加 `unstable_cache` 导入**

```typescript
// 在现有 import { cache } from "react" 之后添加：
import { unstable_cache } from "next/cache";
```

- [ ] **Step 2: 在 `community.ts` 末尾（`listPagesByTag` 之前）添加类型定义和新函数**

```typescript
import type { HomePageData } from "@/lib/services/community";

// 在 listRanking 导出之后添加：

const HOMEPAGE_CACHE_TAG = "homepage";

export interface HomePageData {
  rankingItems: Awaited<ReturnType<typeof listRanking>>["items"];
  latestPages: Array<{
    uid: string;
    title: string;
    coverUrl: string | null;
    authorDisplayName: string | null;
    authorAvatarUrl: string | null;
    authorSlug: string;
    lastPublishedAt: Date;
    viewCount: number;
    likeCount: number;
    commentCount: number;
  }>;
  topAuthors: Array<{
    id: string;
    userSlug: string;
    displayName: string | null;
    avatarUrl: string | null;
    bio: string | null;
    pageCount: number | null;
    followersCount: number;
  }>;
}

export const getHomePageData = unstable_cache(
  async (sessionUserId: string | null): Promise<HomePageData> => {
    const [rankingResult, latestPages, topAuthors] = await Promise.all([
      listRanking({ rankingKey: "published_page", timeWindow: "7d", limit: 10 }),
      db
        .select({
          uid: publishedPages.uid,
          title: publishedPages.title,
          coverUrl: publishedPages.coverUrl,
          authorDisplayName: publishedPages.authorDisplayName,
          authorAvatarUrl: publishedPages.authorAvatarUrl,
          authorSlug: publishedPages.authorSlug,
          lastPublishedAt: publishedPages.lastPublishedAt,
          viewCount: publishedPages.viewCount,
          likeCount: publishedPages.likeCount,
          commentCount: publishedPages.commentCount,
        })
        .from(publishedPages)
        .where(
          and(
            eq(publishedPages.visibility, "public"),
            eq(publishedPages.moderationStatus, "approved"),
            isNotNull(publishedPages.coverUrl),
          ),
        )
        .orderBy(desc(publishedPages.lastPublishedAt))
        .limit(6),
      sessionUserId
        ? db.select().from(users).where(ne(users.id, sessionUserId)).orderBy(desc(users.followersCount)).limit(3)
        : db.select().from(users).orderBy(desc(users.followersCount)).limit(3),
    ]);

    return { rankingItems: rankingResult.items, latestPages, topAuthors };
  },
  [HOMEPAGE_CACHE_TAG],
  { revalidate: 300, tags: [HOMEPAGE_CACHE_TAG] },
);
```

- [ ] **Step 3: 检查 `isNotNull` 是否已导入**

`community.ts` 的 drizzle-orm 导入中需要包含 `isNotNull`。检查第 2 行：
```typescript
import { and, count, desc, eq, gt, ilike, inArray, isNull, lt, or, sql } from 'drizzle-orm';
```
需要添加 `isNotNull` 和 `ne`：
```typescript
import { and, count, desc, eq, gt, ilike, inArray, isNotNull, isNull, lt, ne, or, sql } from 'drizzle-orm';
```

- [ ] **Step 4: 运行类型检查**

```bash
cd apps/web && pnpm typecheck
```

Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add apps/web/lib/services/community.ts
git commit -m "feat: add getHomePageData() with unstable_cache for homepage aggregation"
```

---

### Task 2: 重构 `page.tsx` 使用聚合查询

**Files:**
- Modify: `apps/web/app/(dashboard)/page.tsx`

**Interfaces:**
- Consumes: `getHomePageData` from `@/lib/services/community`
- Produces: 直接向子组件传递 props，移除内联查询

- [ ] **Step 1: 更新 imports**

```typescript
// 移除：
import { listRanking } from "@/lib/services/community"
import { db, publishedPages } from "@/lib/db"
import { desc, eq, and, isNotNull } from "drizzle-orm"

// 添加：
import { getHomePageData } from "@/lib/services/community"
import type { HomePageData } from "@/lib/services/community"
```

- [ ] **Step 2: 移除 `HERO_COLORS` 常量附近不再需要的行，重写数据获取逻辑**

将整个 `try` 块替换为：

```typescript
let heroSlides: HeroSlideData[] = []
let featuredPages: PageCardData[] = []
let recommendedEntries: Array<{ data: PageCardData; href: string }> = []
let rankingItemsReadUrls: Array<{ user_slug: string; page_id: string }> = []
let sidebarAuthors: HomePageData['topAuthors'] = []
let sidebarRankingPages: Array<{ title: string; stats: { views: number } }> = []

try {
  const data = await getHomePageData(null)

  // 过滤无封面项
  const rankingItems = data.rankingItems.filter((item) => item.cover_url != null)

  heroSlides = rankingItems.slice(0, 4).map((item, i) => ({
    title: item.title,
    subtitle: item.description ?? "",
    coverUrl: item.cover_url,
    href: item.read_url ?? undefined,
    ...HERO_COLORS[i % HERO_COLORS.length],
    stats: {
      views: item.view_count ?? 0,
      likes: item.like_count ?? 0,
      comments: item.comment_count ?? 0,
    },
  }))

  featuredPages = rankingItems.slice(0, 3).map((item) => ({
    coverUrl: item.cover_url,
    title: item.title,
    author: {
      name: item.author_display_name ?? item.user_slug,
      avatarUrl: item.author_avatar_url ?? undefined,
    },
    timeAgo: timeAgo(item.last_published_at ?? item.published_at),
    stats: { views: item.view_count ?? 0, likes: item.like_count ?? 0, comments: item.comment_count ?? 0 },
  }))

  rankingItemsReadUrls = rankingItems.slice(0, 3).map((item) => ({
    user_slug: item.user_slug,
    page_id: item.page_id,
  }))

  const recommendedPages: PageCardData[] = data.latestPages.map((p) => ({
    coverUrl: p.coverUrl,
    title: p.title,
    author: {
      name: p.authorDisplayName || p.authorSlug,
      avatarUrl: p.authorAvatarUrl ?? undefined,
    },
    timeAgo: timeAgo(p.lastPublishedAt),
    stats: { views: p.viewCount, likes: p.likeCount, comments: p.commentCount },
  }))

  recommendedEntries = data.latestPages.map((p, i) => ({
    data: recommendedPages[i],
    href: `/${encodeURIComponent(p.authorSlug)}/${encodeURIComponent(p.uid)}?tab=read`,
  }))

  sidebarAuthors = data.topAuthors

  sidebarRankingPages = rankingResultItemsForSidebar // ... wait, we need the full rankingResult for sidebar
} catch (error) {
  console.error("[Home] Failed to fetch page data:", error)
}
```

等等，sidebar 需要 rankingItems 和 topAuthors。让我重新考虑。`getHomePageData` 返回 `rankingItems`（原始 ranking items）。sidebar 从中取前 3 个做 "本周上升"。

- [ ] **Step 2 (修正): 完整的数据获取逻辑**

```typescript
let heroSlides: HeroSlideData[] = []
let featuredPages: PageCardData[] = []
let recommendedEntries: Array<{ data: PageCardData; href: string }> = []
let rankingItemsReadUrls: Array<{ user_slug: string; page_id: string }> = []
let sidebarAuthors: HomePageData['topAuthors'] = []
let sidebarRankingPages: Array<{ title: string; stats: { views: number } }> = []

try {
  const data = await getHomePageData(null)

  const rankingItems = data.rankingItems.filter((item) => item.cover_url != null)

  heroSlides = rankingItems.slice(0, 4).map((item, i) => ({
    title: item.title,
    subtitle: item.description ?? "",
    coverUrl: item.cover_url,
    href: item.read_url ?? undefined,
    ...HERO_COLORS[i % HERO_COLORS.length],
    stats: { views: item.view_count ?? 0, likes: item.like_count ?? 0, comments: item.comment_count ?? 0 },
  }))

  featuredPages = rankingItems.slice(0, 3).map((item) => ({
    coverUrl: item.cover_url,
    title: item.title,
    author: { name: item.author_display_name ?? item.user_slug, avatarUrl: item.author_avatar_url ?? undefined },
    timeAgo: timeAgo(item.last_published_at ?? item.published_at),
    stats: { views: item.view_count ?? 0, likes: item.like_count ?? 0, comments: item.comment_count ?? 0 },
  }))

  rankingItemsReadUrls = rankingItems.slice(0, 3).map((item) => ({
    user_slug: item.user_slug,
    page_id: item.page_id,
  }))

  const recommendedPages: PageCardData[] = data.latestPages.map((p) => ({
    coverUrl: p.coverUrl,
    title: p.title,
    author: { name: p.authorDisplayName || p.authorSlug, avatarUrl: p.authorAvatarUrl ?? undefined },
    timeAgo: timeAgo(p.lastPublishedAt),
    stats: { views: p.viewCount, likes: p.likeCount, comments: p.commentCount },
  }))

  recommendedEntries = data.latestPages.map((p, i) => ({
    data: recommendedPages[i],
    href: `/${encodeURIComponent(p.authorSlug)}/${encodeURIComponent(p.uid)}?tab=read`,
  }))

  sidebarAuthors = data.topAuthors
  sidebarRankingPages = data.rankingItems.slice(0, 3).map((item) => ({
    title: item.title,
    stats: { views: item.view_count ?? 0 },
  }))
} catch (error) {
  console.error("[Home] Failed to fetch page data:", error)
}
```

- [ ] **Step 3: 将 props 传递给 HomeSidebarSection**

将侧边栏的 `<Suspense>` 边界替换为直接渲染：

```tsx
{/* 替换整个 <Suspense fallback={...}> <HomeSidebarSection /> </Suspense> */}
<HomeSidebarSection
  authorCards={sidebarAuthors}
  rankingPages={sidebarRankingPages}
  sessionUserSlug={null}
/>
```

- [ ] **Step 4: 清理不再需要的 imports**

确保移除 `listRanking`, `db`, `publishedPages`, `desc`, `eq`, `and`, `isNotNull` —— 这些不再被 page.tsx 直接使用。

- [ ] **Step 5: 运行类型检查**

```bash
cd apps/web && pnpm typecheck
```

Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add apps/web/app/\(dashboard\)/page.tsx
git commit -m "refactor: use getHomePageData() in dashboard homepage"
```

---

### Task 3: 重构 `HomeSidebarSection` 为纯展示组件

**Files:**
- Modify: `apps/web/components/home/home-sidebar-section.tsx`

**Interfaces:**
- Consumes: props from page.tsx
- Produces: 无，纯渲染
- Props 接口:
  ```typescript
  interface HomeSidebarSectionProps {
    authorCards: Array<{
      id: string; userSlug: string; displayName: string | null;
      avatarUrl: string | null; bio: string | null;
      pageCount: number | null; followersCount: number;
    }>
    rankingPages: Array<{ title: string; stats: { views: number } }>
    sessionUserSlug?: string
  }
  ```

- [ ] **Step 1: 重写组件**

将 `HomeSidebarSection` 从 async server component 改为普通 server component，接收 props：

```typescript
import { AuthorCard } from "@/components/content/author-card"
import { Pill } from "@/components/content/pill"
import { Stat } from "@/components/content/stats-row"
import { SectionHead } from "@/components/content/section-head"
import { T } from "@/components/content/i18n-text"
import { Eye } from "lucide-react"
import type { AuthorCardData } from "@/components/content/author-card"

interface HomeSidebarSectionProps {
  authorCards: Array<{
    id: string
    userSlug: string
    displayName: string | null
    avatarUrl: string | null
    bio: string | null
    pageCount: number | null
    followersCount: number
  }>
  rankingPages: Array<{ title: string; stats: { views: number } }>
  sessionUserSlug?: string
}

export function HomeSidebarSection({ authorCards, rankingPages, sessionUserSlug }: HomeSidebarSectionProps) {
  const mappedAuthors: AuthorCardData[] = authorCards.map((u) => ({
    fallbackText: u.displayName ?? u.userSlug,
    avatarUrl: u.avatarUrl ?? undefined,
    name: u.displayName ?? u.userSlug,
    handle: `@${u.userSlug}`,
    userSlug: u.userSlug,
    description: u.bio ?? "",
    pageCount: u.pageCount ?? 0,
    followerCount: u.followersCount,
  }))

  return (
    <aside className="grid gap-3 content-start">
      {mappedAuthors.length > 0 && (
        <section>
          <SectionHead title="推荐关注" actionLabel={<T tKey="community.viewAll" fallback="查看全部" />} actionHref="/search" />
          <div className="grid gap-2">
            {mappedAuthors.map((author, i) => (
              <AuthorCard key={i} data={author} currentUserSlug={sessionUserSlug} />
            ))}
          </div>
        </section>
      )}

      {rankingPages.length > 0 && (
        <section>
          <SectionHead title="本周上升" actionLabel={<T tKey="community.leaderboard" fallback="榜单" />} actionHref="/leaderboard" />
          <div className="grid gap-2">
            {rankingPages.map((page, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <Pill variant="rank">{String(i + 1).padStart(2, "0")}</Pill>
                <span className="font-['Lexend'] text-[15px] font-bold truncate flex-1">{page.title}</span>
                <Stat icon={Eye} value={page.stats.views} format />
              </div>
            ))}
          </div>
        </section>
      )}
    </aside>
  )
}
```

移除的 imports: `db`, `users`, `publishedPages`, `listRanking`, `getSession`, `desc`, `eq`, `ne`, `and` from drizzle

- [ ] **Step 2: 运行类型检查**

```bash
cd apps/web && pnpm typecheck
```

Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add apps/web/components/home/home-sidebar-section.tsx
git commit -m "refactor: HomeSidebarSection accepts props instead of fetching data"
```

---

### Task 4: 发布时主动失效首页缓存

**Files:**
- Modify: `apps/web/app/api/pages/publish/route.ts`

**Interfaces:**
- Consumes: 现有 publish route
- Produces: 成功发布后调用 `revalidateTag('homepage')`

- [ ] **Step 1: 在 publish route 成功返回前添加缓存失效**

在 `NextResponse.json({...})` return 之前添加：

```typescript
import { revalidateTag } from "next/cache";

// 在 return NextResponse.json({...}) 之前添加：
revalidateTag("homepage");
```

具体位置：在 `recordPageUpdateAndNotify(...)` 调用之后，`return NextResponse.json({...})` 之前。

完整修改（仅显示需要添加的行）：

```typescript
// 在文件顶部 import 区域添加
import { revalidateTag } from "next/cache";

// 在 recordPageUpdateAndNotify 之后、return 之前添加
// (line ~343 附近)
    await recordPageUpdateAndNotify(db, { ... });

    // 发布/更新页面后主动失效首页缓存
    revalidateTag("homepage");

    return NextResponse.json({ ... });
```

- [ ] **Step 2: 运行类型检查**

```bash
cd apps/web && pnpm typecheck
```

Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add apps/web/app/api/pages/publish/route.ts
git commit -m "feat: revalidate homepage cache on page publish"
```

---

### Task 5: 预加载跑马灯封面图片

**Files:**
- Modify: `apps/web/app/(dashboard)/page.tsx`

**Interfaces:**
- Consumes: `heroSlides` 数组（已在上层作用域计算好）
- Produces: `<link rel="preload">` tags in page head

- [ ] **Step 1: 在 page.tsx 返回的 JSX 中添加 preload links**

在 `return (...)` 的最外层添加预加载逻辑。最简单的方式是在页面组件中返回包含 head 元素的内容。

由于 Next.js 的 `metadata` API 不支持动态 preload，需要在组件内部使用原生方式。在 `return` 语句的最前面添加：

```tsx
// 在 return 之前，heroSlides 已经计算好：

// 前 2 张封面图的 URL（取前两张有 coverUrl 的）
const preloadUrls = heroSlides
  .filter((s) => s.coverUrl)
  .slice(0, 2)
  .map((s) => s.coverUrl!);
```

然后在 JSX return 中，`<>` fragment 之后立即添加：

```tsx
return (
  <>
    {/* 预加载跑马灯封面图，减少切换闪烁 */}
    {preloadUrls.map((url) => (
      <link key={url} rel="preload" as="image" href={url} />
    ))}
    <div className="mb-3">
      <HomeTabBar />
    </div>
    ...
  </>
)
```

- [ ] **Step 2: 运行类型检查**

```bash
cd apps/web && pnpm typecheck
```

Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add apps/web/app/\(dashboard\)/page.tsx
git commit -m "feat: preload hero carousel cover images"
```

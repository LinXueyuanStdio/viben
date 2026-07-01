# Read Page 重构 Spec v4

## 一、现状与问题

### 1.1 当前加载链路

用户访问 `https://viben-web.vercel.app/LinXueyuanStdio/0612-e2e-page?tab=read`：

```
服务端（Vercel Serverless）
  page.tsx 串行 await：
    ① getSession()                          ~5-10ms    JWT 解码
    ② getPublishedPageContext()             ~20-60ms   users 查 slug → publishedPages 查 userId+uid
    ③ getCommunitySummary()                 ~10-40ms   点赞/收藏统计
    ④ ensureCommunityEntityForPage()        ~10-40ms   upsert 社区实体
    ⑤ listCommunityComments()               ~20-80ms   评论列表 + 计数
    ⑥ 推荐查询（同分类/同作者）              ~10-40ms   publishedPages JOIN users
    ══════════════════════════════════════════════════
    服务端 TTFB                               ~75-270ms

网络
  HTML + JS bundle 下载                      ~100-500ms

客户端
  JS parse + execute                         ~200-800ms
  dynamic() chunk: AppShellWrapper           ~50-150ms
  AppShellWrapper useEffect:
    fetch /api/users/me                      ~50-200ms  ← 又一次 HTTP 往返
    fetch /api/notifications                 ~30-100ms
    fetch /api/community/history             ~30-100ms
  setReady(true) → AppShell 渲染
    → Topbar 渲染（默认模式，不知道在阅读页）
    → ReadPageClient hydrate
      → useEffect: setAttribute("data-page-mode", "read")  ~5-15ms
      → MutationObserver 回调 → Topbar re-render
    ══════════════════════════════════════════════════
    Topbar 模式正确                             ~530-2200ms
    正文可见                                   ~590-2300ms
```

### 1.2 核心问题

| 问题 | 根因 | 影响 |
|------|------|------|
| **服务端串行阻塞** | 6 个 DB 查询全部 await 后才返回 HTML | TTFB 75-270ms |
| **DOM 属性通信** | ReadPageClient `setAttribute` → Topbar `MutationObserver` | Topbar 延迟 500ms-2s |
| **Topbar 无插槽** | ReadMoreMenu 内联在 Topbar、阅读逻辑硬编码 | 耦合严重、无法复用 |
| **无懒加载** | Drawer/Settings 全部 `useMemo` 急切渲染 | Bundle 过大、首屏拖慢 |
| **无缓存层** | `force-dynamic` 禁止 CDN；react-query 仅 CommentsPanel 使用 | 后退/前进无缓存 |
| **API 缺失** | 页面数据无独立 API，无法 CDN 缓存 | 每次全量 SSR |

---

## 二、核心设计

### 2.1 三条原则

**原则一：URL 即信号。** `/[userSlug]/[pageId]` 中 userSlug 不在保留词列表 → 就是 published page。客户端同步判定，0ms。

**原则二：正文优先。** page HTML 是用户真正关心的内容。服务端 T1 只取 page HTML（1 次查询），通过 Suspense 流式优先输出。Topbar 通过 URL 自判定模式（0ms），不依赖 page HTML 到达即可正确展示阅读布局。session 信息异步获取，第二帧填充 isAuthor → Settings tab 按需出现。

**原则三：插槽优于内联。** Topbar 提供 `centerContent`/`rightContent` 插槽，业务方注入专属内容。

### 2.2 重构后加载链路（两阶段）

```
══════════ 第一帧：正文流式输出（~50-200ms） ══════════

服务端:
  ① getPublishedPageContext() — 1 次索引查询        ~10-30ms
  → Suspense 边界外的 HTML 先发送:
    layout shell + DashboardShell 骨架
  → Suspense 解析后立即流式发送:
    ReadPageShell + iframe srcDoc={pageHtml}

  ★ 正文在第一帧就到浏览器了

客户端:
  DashboardShell 骨架（Topbar 占位条 + 内容骨架）
  → iframe srcDoc 渲染正文                              ★ 用户看到内容
  → dynamic() chunk: AppShellWrapper 后台加载
    → fetch /api/users/me 后台执行

══════════ 第二帧：Topbar 就绪（~200-500ms） ══════════

  AppShell 渲染:
    → Topbar 首帧即知阅读模式（isPublishedPageRoute, 0ms）
    → isAuthor = session?.userSlug === urlUserSlug      session 到达后
    → hasSidePage 等 T1 数据到达 ReadPageShell 后更新
    → tablist 首帧正确: Page + (isAuthor ? Settings)
    → Side Page tab 在 hasSidePage 确认后出现
    → 右侧按钮: 抽屉/沉浸/ReadMoreMenu                  session 无关

  T2/T3 后台流式到达: 社区互动数据 + 评论初始数据
  requestIdleCallback: 预加载抽屉内容
```

### 2.3 与当前架构的关键区别

| 方面 | 当前 | v4 |
|------|------|-----|
| 正文何时到达浏览器 | 等全部 6 个查询 + session fetch 后 | **第一帧**（T1 完成后立即流式） |
| Topbar 何时知道在阅读页 | MutationObserver 回调（~530-2200ms） | **首帧 0ms**（URL 判定） |
| Topbar 需要 session 吗 | 不需要（阅读模式右侧按钮与 session 无关） | **不需要**（session 仅影响 Settings tab） |
| DashboardShell 骨架 | 闪烁后变 AppShell | **就是阅读页的 Topbar 占位条** |
| 页面内容谁先渲染 | Topbar → 正文 | **正文 → Topbar 叠加**（流式顺序） |

---

## 三、Schema 变更

### 3.1 `publishedPages` 新增 `authorSlug`

```sql
ALTER TABLE published_pages ADD COLUMN author_slug text NOT NULL DEFAULT '';

-- 回填现有数据
UPDATE published_pages SET author_slug = (
  SELECT user_slug FROM users WHERE users.id = published_pages.user_id
);

-- 复合唯一索引：一次查询定位页面
CREATE UNIQUE INDEX published_pages_author_slug_uid_idx
  ON published_pages(author_slug, uid);
```

发布时写入 `authorSlug`（userSlug 发布后不变，无需同步）。`authorName`、`authorAvatarUrl` 已冗余存在，无需 JOIN `users` 表。

### 3.2 Drizzle Schema

```typescript
// lib/db/schema.ts - publishedPages 表新增
authorSlug: text('author_slug').notNull(),

// 索引
uniqueIndex('published_pages_author_slug_uid_idx').on(table.authorSlug, table.uid),
```

---

## 四、快速路由判定

### 4.1 `isPublishedPageRoute()`

```typescript
// lib/navigation/page-route.ts （新增）

import { isReservedSlug } from "@/lib/utils/user-slug"

export function isPublishedPageRoute(pathname: string): {
  isPage: boolean
  userSlug?: string
  pageId?: string
} {
  const parts = pathname.split("/").filter(Boolean)
  if (parts.length !== 2) return { isPage: false }
  const [first, second] = parts
  if (isReservedSlug(first)) return { isPage: false }
  if (!second) return { isPage: false }
  return { isPage: true, userSlug: first, pageId: second }
}
```

`RESERVED_SLUGS` 已覆盖 `(dashboard)` 全部顶级路由（settings, search, admin, moment, leaderboard, publish, collections 等），在 `lib/utils/user-slug.ts` 中维护。

### 4.2 从 URL + session 得到的即时信息

| 信息 | 来源 | 延迟 |
|------|------|------|
| 是否 published page | `isPublishedPageRoute(pathname)` | 0ms |
| 当前用户是否作者 | `session?.userSlug === urlUserSlug` | 0ms（session 在 AppShell 中就绪） |
| 作者显示名/头像 | API `meta` 响应（`authorName`/`authorAvatarUrl` 冗余字段） | ~10-30ms |
| 是否有副页 | API `meta` 响应 `sidePageUid` | ~10-30ms |
| page HTML | API `html` 响应 / Server Component props | ~10-30ms |

---

## 五、API 设计

### 5.1 `GET /api/read/[user_slug]/[page_id]`

**单次查询**，`authorSlug + uid` 复合索引定位。

```
Query params:
  ?fields=meta   → 仅元信息（不含 html），~300B，跳过 TOAST 读取
  ?fields=html   → 仅 HTML
  ?fields=all    → 完整数据（默认）

Response 200:
{
  html: "<!DOCTYPE html>...",          // fields=meta 时不返回
  meta: {
    userSlug, pageId, pageDbId,
    title, description,
    authorName, authorAvatarUrl,       // 冗余字段，无需 JOIN
    sidePageUid,                       // null → 无副页
    visibility, publishedAt,
    tags, coverUrl,
    viewCount, likeCount, commentCount, bookmarkCount, shareCount,
    isAuthor,                          // session.userId === page.userId
    hasSidePage,                       // sidePageUid != null
    communityEntityId,                 // 复用 page.id
  }
}
```

**显式列选择**（`?fields=meta` 时跳过 `html`，避免 TOAST 读取 100KB+）：

```typescript
// app/api/read/[user_slug]/[page_id]/route.ts
export async function GET(request: NextRequest, { params }) {
  const { user_slug, page_id } = await params
  const fields = request.nextUrl.searchParams.get("fields") ?? "all"
  const session = await getOptionalSession(request)

  const page = await db
    .select({
      id: publishedPages.id, uid: publishedPages.uid,
      userId: publishedPages.userId, title: publishedPages.title,
      description: publishedPages.description,
      html: fields !== "meta" ? publishedPages.html : undefined as any,
      authorSlug: publishedPages.authorSlug,
      authorName: publishedPages.authorName,
      authorAvatarUrl: publishedPages.authorAvatarUrl,
      sidePageUid: publishedPages.sidePageUid,
      visibility: publishedPages.visibility,
      moderationStatus: publishedPages.moderationStatus,
      publishedAt: publishedPages.publishedAt,
      tags: publishedPages.tags, coverUrl: publishedPages.coverUrl,
      viewCount: publishedPages.viewCount, likeCount: publishedPages.likeCount,
      commentCount: publishedPages.commentCount, bookmarkCount: publishedPages.bookmarkCount,
      shareCount: publishedPages.shareCount,
    })
    .from(publishedPages)
    .where(and(
      eq(publishedPages.authorSlug, user_slug),
      eq(publishedPages.uid, page_id),
    ))
    .limit(1)

  if (!page.length || !canReadPage(page[0], session)) {
    return NextResponse.json({ error: { code: "not_found" } }, { status: 404 })
  }

  const p = page[0]
  const meta = {
    userSlug: p.authorSlug, pageId: p.uid, pageDbId: p.id,
    title: p.title, description: p.description,
    authorName: p.authorName, authorAvatarUrl: p.authorAvatarUrl,
    sidePageUid: p.sidePageUid, visibility: p.visibility,
    publishedAt: p.publishedAt, tags: p.tags, coverUrl: p.coverUrl,
    viewCount: p.viewCount, likeCount: p.likeCount,
    commentCount: p.commentCount, bookmarkCount: p.bookmarkCount,
    shareCount: p.shareCount,
    isAuthor: session?.userId === p.userId,
    hasSidePage: !!p.sidePageUid,
    communityEntityId: p.id,
  }

  if (fields === "meta") return NextResponse.json({ meta })
  if (fields === "html") return NextResponse.json({ html: p.html })
  return NextResponse.json({ html: p.html, meta })
}
```

### 5.2 缓存策略

```typescript
const isPublic = p.visibility === "public" && p.moderationStatus === "approved"

return NextResponse.json(data, {
  headers: {
    "Cache-Control": isPublic
      ? "public, max-age=0, s-maxage=300, stale-while-revalidate=86400, must-revalidate"
      : "private, no-cache, no-store, must-revalidate",
    "Vary": "Cookie, Accept-Encoding",
    "ETag": `"${p.uid}-${p.updatedAt?.getTime() ?? p.publishedAt?.getTime()}"`,
  },
})
```

| 指令 | 作用 |
|------|------|
| `max-age=0` | 浏览器每次重新请求（可用条件请求） |
| `s-maxage=300` | CDN 缓存 5 分钟（仅共享缓存） |
| `stale-while-revalidate=86400` | CDN 过期后后台刷新，期间返回旧数据 |
| `must-revalidate` | swr 窗口过期后必须回源 |
| `Vary: Cookie` | 登录/未登录缓存隔离 |

### 5.3 已有 API（不变）

| 端点 | 用途 | 层级 |
|------|------|------|
| `GET /api/community/entities/summary` | 互动数据 | T2 |
| `GET /api/community/comments` | 评论列表 | T3 |
| `POST /api/community/comments` | 发表评论 | 交互 |
| `POST /api/community/reactions/toggle` | 点赞 | 交互 |
| `POST /api/community/bookmarks/toggle` | 收藏 | 交互 |

### 5.4 数据流双路径

```
首访（冷加载）：
  Server Component 直接 DB 查 → T1 数据作为 props → 页面渲染
  同时 react-query 调 API 填充缓存（静默）

后退/前进（热加载）：
  react-query 缓存命中 → 0ms

hover 预取：
  queryClient.prefetchQuery(API) → 点击前缓存就绪

公开页面 CDN：
  Vercel 边缘缓存命中 → TTFB < 50ms
```

---

## 六、Topbar 重构

### 6.1 新接口

```typescript
// components/layout/topbar.tsx

interface TopbarProps {
  session: Session | null
  onToggleSidebar: () => void
  // 插槽（参考 WorkspaceHeader）
  centerContent?: ReactNode
  rightContent?: ReactNode
  // 默认模式数据
  notificationItems?: Array<...>
  historyItems?: Array<...>
  hotSearches?: Array<...>
  recentSearches?: string[]
}
```

### 6.2 自驱动模式切换（两阶段）

Topbar 通过 URL 自行判定阅读模式。session 异步获取，不影响阅读模式的初始渲染。

**阶段 A：Topbar 首次渲染（session 可能未就绪）**

阅读模式的 Topbar 核心 UI 与 session 无关：右侧按钮（抽屉/沉浸/ReadMoreMenu）、中间 tablist 的 Page tab 都不需要 session。只有 Settings tab 需要确认 isAuthor。

```typescript
export function Topbar({ session, centerContent, rightContent, ... }: TopbarProps) {
  const pathname = usePathname()

  // 路由判定（0ms）— 不等任何异步数据
  const { isPage: isReadPageFromUrl, userSlug, pageId } = isPublishedPageRoute(pathname)

  // isAuthor: session 未就绪时为 false，就绪后由 React re-render 更新
  // session 通过 AppShellWrapper 异步获取，到达后自动触发 Topbar 重渲染
  const isAuthor = isReadPageFromUrl && session?.userSlug === userSlug

  // hasSidePage 需要服务端确认，从 context 获取
  const slots = useTopbarSlots()
  const hasSidePage = slots?.hasSidePage ?? false

  // 中间 tablist：仅依赖 hasSidePage / isAuthor，不依赖 activeTab
  const tablist = useMemo(() => {
    if (!isReadPageFromUrl) return null
    if (!hasSidePage && !isAuthor) return null
    return (
      <VibenTabs value={activeTab} onValueChange={handleTabChange}>
        <VibenTabsList variant="pill">
          <VibenTabsTrigger value="read" variant="pill">Page</VibenTabsTrigger>
          {hasSidePage && <VibenTabsTrigger value="side" variant="pill">Side</VibenTabsTrigger>}
          {isAuthor && <VibenTabsTrigger value="settings" variant="pill">Settings</VibenTabsTrigger>}
        </VibenTabsList>
      </VibenTabs>
    )
  }, [isReadPageFromUrl, hasSidePage, isAuthor]) // ← 不依赖 activeTab

  // 右侧：阅读模式不需要 session
  // 抽屉/沉浸/ReadMoreMenu 都不依赖 session
  const effectiveRight = rightContent ?? slots?.rightContent ?? (
    isReadPageFromUrl
      ? <DefaultReadRightContent pageId={pageId} userSlug={userSlug} />
      : <DefaultRightContent ... />  // 非阅读模式需要 session（UserMenu 等）
  )

  return (
    <header className={cn(isRead ? "fixed backdrop-blur" : "sticky")}>
      <div style={{ gridTemplateColumns: isRead ? "..." : "..." }}>
        <div>{/* Left: sidebar toggle + breadcrumb */}</div>
        <div>{effectiveCenter}</div>
        <div>{effectiveRight}</div>
      </div>
    </header>
  )
}
```

**阶段 B：session 到达后（自动 re-render）**

AppShellWrapper 的 `fetch('/api/users/me')` 完成后 → `setSession(s)` → AppShell 重渲染 → Topbar 收到新 session → `isAuthor` 更新 → Settings tab 按需出现。Tab 区域为 absolute 居中，不产生 CLS。

**关键洞察**：阅读模式的右侧 UI（抽屉/沉浸/ReadMoreMenu）不需要 session。Topbar 在 session 到达前就能完整展示阅读 UI。session 仅影响 Settings tab——这对绝大多数非作者访问完全没有影响。

### 6.3 TopbarSlotContext

```typescript
// components/layout/topbar-slots.tsx

interface TopbarSlots {
  centerContent?: ReactNode    // 覆盖 tablist（通常不需要）
  rightContent?: ReactNode     // 覆盖右侧按钮（通常不需要）
  hasSidePage?: boolean        // 服务端确认后更新 → Side Page tab 出现
}
```

### 6.4 默认阅读右侧内容

```typescript
function DefaultReadRightContent({ pageId, userSlug }: { pageId: string; userSlug: string }) {
  const { toggle } = useDrawer()
  return (
    <>
      <IconButton onClick={toggle}><PanelRight /></IconButton>
      <ImmersiveToggleButton />
      <ReadMoreMenu pageId={pageId} userSlug={userSlug} />
    </>
  )
}
```

### 6.5 ReadMoreMenu 抽离

```typescript
// components/pages/read-more-menu.tsx （从 topbar.tsx 抽离）
export function ReadMoreMenu({ pageId, userSlug }: { pageId: string; userSlug: string }) {
  // 报告 + 反馈下拉菜单
}
```

---

## 七、ReadPageShell

### 7.1 职责

接收 T1 数据，管理 tab 状态，通过 `TopbarSlotContext` 向 Topbar 传递 `hasSidePage`。

```typescript
// components/pages/read-page-shell.tsx

interface ReadPageShellProps {
  userSlug: string
  pageId: string
  pageHtml: string
  pageTitle: string
  hasSidePage: boolean
  activeTab: string
  children: ReactNode
}

export function ReadPageShell({ hasSidePage, activeTab: initialTab, children }: ReadPageShellProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [activeTab, setActiveTab] = useState(initialTab)

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab)
    router.replace(`${pathname}?tab=${tab}`, { scroll: false })
  }, [router, pathname])

  // 唯一需要传递给 Topbar 的服务端确认数据
  const slots = useMemo(() => ({ hasSidePage }), [hasSidePage])

  // 预加载抽屉数据
  usePrefetchDrawerTabs(pageMeta)

  return (
    <TopbarSlotProvider value={slots}>
      {children}
    </TopbarSlotProvider>
  )
}
```

### 7.2 Server Component 改造

```typescript
// app/(dashboard)/[user_slug]/[page_id]/page.tsx

export default async function PagePage({ params, searchParams }: PageProps) {
  const { user_slug, page_id } = await params
  const session = await getSession()

  // T1 唯一阻塞：1 次查询
  const ctx = await getPublishedPageContext(user_slug, page_id)
  if (!ctx || !canReadPage(ctx.page, session)) notFound()

  const isAuthor = session?.userId === ctx.page.userId
  if (searchParams.tab === "settings" && !isAuthor) redirect(...)

  return (
    <ReadPageShell
      userSlug={user_slug}
      pageId={page_id}
      pageHtml={ctx.page.html}
      pageTitle={ctx.page.title}
      hasSidePage={!!ctx.page.sidePageUid}
      activeTab={searchParams.tab ?? "read"}
    >
      {/* T1: iframe 主体，立即渲染 */}
      <ReadPageClient ... />

      {/* T2: 互动数据，Suspense 流式，不阻塞 T1 */}
      <Suspense fallback={null}>
        <CommunitySummaryLoader pageId={ctx.page.id} session={session} />
      </Suspense>

      {/* T3: 评论数据，Suspense 流式 */}
      <Suspense fallback={null}>
        <InitialCommentsLoader pageId={ctx.page.id} session={session} />
      </Suspense>
    </ReadPageShell>
  )
}
```

---

## 八、懒加载体系

### 8.1 利用现有框架

项目已有 `DashboardShell → dynamic(() => import AppShellWrapper, { ssr: false })`。所有新增懒加载统一使用 `next/dynamic`。

### 8.2 Drawer 面板

```typescript
// components/layout/read-drawer.tsx
import dynamic from "next/dynamic"

const LazyPageMeta = dynamic(
  () => import("@/components/content/page-meta").then(m => ({ default: m.PageMeta })),
  { ssr: false, loading: () => <div className="animate-pulse h-64 rounded-lg bg-muted/30" /> }
)
const LazyCommentsPanel = dynamic(
  () => import("@/components/content/comments-panel").then(m => ({ default: m.CommentsPanel })),
  { ssr: false, loading: () => <div className="animate-pulse h-64 rounded-lg bg-muted/30" /> }
)
const LazyNotesPanel = dynamic(
  () => import("@/components/content/notes-panel").then(m => ({ default: m.NotesPanel })),
  { ssr: false, loading: () => <div className="animate-pulse h-64 rounded-lg bg-muted/30" /> }
)
```

### 8.3 预加载

```typescript
// hooks/use-prefetch-drawer-tabs.ts
export function usePrefetchDrawerTabs(pageMeta: PageMetaData) {
  const queryClient = useQueryClient()

  useEffect(() => {
    const idleId = requestIdleCallback?.(() => {
      queryClient.prefetchQuery({
        queryKey: ["page-comments", pageMeta.communityEntityId, pageMeta.pageDbId],
        queryFn: () => fetch(`/api/community/comments?...`).then(r => r.json()),
        staleTime: 60_000,
      })
      queryClient.prefetchQuery({
        queryKey: ["page-notes", pageMeta.pageUid],
        queryFn: () => fetch(`/api/notes?page_id=${pageMeta.pageUid}`).then(r => r.json()),
        staleTime: 120_000,
      })
    })
    return () => { if (idleId) cancelIdleCallback(idleId) }
  }, [pageMeta.communityEntityId, pageMeta.pageDbId, pageMeta.pageUid])
}
```

### 8.4 Settings Panel + 对话框

```typescript
// 仅在作者点击 Settings tab 时加载
const LazyPageSettingsPanel = dynamic(
  () => import("@/components/pages/page-settings-panel").then(m => ({ default: m.PageSettingsPanel })),
  { ssr: false, loading: () => <SettingsSkeleton /> }
)

// Topbar 中：仅在用户交互时加载
const ReportDialog = dynamic(() => import("@/components/content/report-dialog").then(m => ({ default: m.ReportDialog })), { ssr: false })
const FeedbackDialog = dynamic(() => import("@/components/content/feedback-dialog").then(m => ({ default: m.FeedbackDialog })), { ssr: false })
```

### 8.5 GlobalSearch

阅读页完全不使用，改为懒加载：

```typescript
// topbar.tsx
const GlobalSearch = dynamic(() => import("./global-search").then(m => ({ default: m.GlobalSearch })), { ssr: false })
```

---

## 九、补充优化

以下来自多维度性能 review，均为低工作量、独立可做。

### 9.1 `React.cache()` 请求级去重

`generateMetadata` 和 `PagePage` 各自调用 `getPublishedPageContext`，同一请求内重复查询。

```typescript
// lib/services/community.ts
import { cache } from "react"

export const getPublishedPageContext = cache(
  async (userSlug: string, pageId: string): Promise<PublicPageContext | null> => {
    // 单次查询（authorSlug 索引）
    const page = await db.query.publishedPages.findFirst({
      where: and(eq(publishedPages.authorSlug, userSlug), eq(publishedPages.uid, pageId)),
    })
    if (!page) return null
    return { page, author: { displayName: page.authorName, avatarUrl: page.authorAvatarUrl, userSlug: page.authorSlug } }
  }
)
```

节省 ~20-40ms（同一请求内第二次调用直接返回缓存）。

### 9.2 `loading.tsx` 阅读页骨架

```typescript
// app/(dashboard)/[user_slug]/[page_id]/loading.tsx （新增）
export default function ReadPageLoading() {
  return (
    <div style={{ paddingTop: "var(--nav-h, 56px)" }}>
      <div className="w-full h-[60vh] animate-pulse rounded-lg bg-muted/20 mx-auto max-w-3xl" />
    </div>
  )
}
```

### 9.3 `preconnect` 头像 CDN

```tsx
// app/layout.tsx
<head>
  <link rel="preconnect" href="https://avatars.githubusercontent.com" crossOrigin="anonymous" />
</head>
```

节省首次头像加载 TLS 握手 ~50-100ms。

### 9.4 `optimizePackageImports`

```typescript
// next.config.ts
experimental: {
  optimizePackageImports: ['lucide-react', '@radix-ui/react-*'],
}
```

减少 ~5-10KB（仅打包用到的 lucide 图标）。

### 9.5 缓存失效

页面发布/更新后清除 Vercel 边缘缓存：

```typescript
// 在 publish/update API handler 中
revalidatePath(`/${userSlug}/${pageId}`)
revalidatePath(`/api/read/${userSlug}/${pageId}`)
```

### 9.6 Neon 保温

通过 Vercel Cron 每 4 分钟 `SELECT 1`，防止 serverless Postgres 缩零冷启动（500ms-2s）。

---

## 十、组件树对比

### 重构前

```
AppShell
├── Topbar（MutationObserver 监听 DOM 属性）
│   ├── BreadcrumbNav
│   ├── [Center] VibenTabs 或 GlobalSearch
│   └── [Right] 抽屉/沉浸按钮 + ReadMoreMenu（内联）
└── <main>
    └── ReadPageClient（setAttribute 到 documentElement）
        ├── ReadDrawer（急切渲染 PageMeta+Comments+Notes）
        └── iframe 或 PageSettingsPanel（急切渲染）
```

### 重构后

```
AppShell
├── Topbar（纯布局容器，URL 自判定模式）
│   ├── BreadcrumbNav
│   ├── [Center] {centerContent} ← TopbarSlotContext
│   └── [Right] {rightContent}
└── <main>
    └── ReadPageShell（TopbarSlotProvider: hasSidePage）
        ├── ReadPageClient（无 DOM 操作，纯渲染）
        │   ├── ReadDrawer（dynamic() 懒加载 tab 内容）
        │   │   ├── lazy PageMeta
        │   │   ├── lazy CommentsPanel
        │   │   └── lazy NotesPanel
        │   └── iframe 或 lazy PageSettingsPanel
        ├── Suspense: CommunitySummaryLoader（T2 流式）
        └── Suspense: InitialCommentsLoader（T3 流式）
```

---

## 十一、文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| **Schema** | | |
| `lib/db/schema.ts` | 修改 | 新增 `authorSlug` 列 + 复合索引 |
| **API** | | |
| `app/api/read/[user_slug]/[page_id]/route.ts` | **新增** | 页面数据 API，`?fields=meta/html/all` |
| **路由** | | |
| `lib/navigation/page-route.ts` | **新增** | `isPublishedPageRoute()` |
| `lib/utils/user-slug.ts` | 审核 | 确保 `RESERVED_SLUGS` 覆盖全部顶级路由 |
| `app/(dashboard)/[user_slug]/[page_id]/loading.tsx` | **新增** | 阅读页专用骨架屏 |
| **Layout** | | |
| `components/layout/topbar.tsx` | 重构 | 插槽接口；URL 自判定；移除 MutationObserver + ReadMoreMenu |
| `components/layout/topbar-slots.tsx` | **新增** | TopbarSlotContext |
| `components/layout/topbar-mode.ts` | 简化 | 仅保留 landing 判断 |
| `components/layout/read-drawer.tsx` | 修改 | tab 内容 `next/dynamic` |
| **页面** | | |
| `components/pages/read-page-shell.tsx` | **新增** | 壳组件：tab 管理 + toppar slots + 预加载 |
| `components/pages/read-more-menu.tsx` | **新增** | 从 topbar.tsx 抽离 |
| `components/pages/read-page-client.tsx` | 简化 | 删除全部 DOM 属性操作 |
| **Hooks** | | |
| `hooks/use-read-mode.ts` | **删除** | MutationObserver 不再需要 |
| `hooks/use-prefetch-drawer-tabs.ts` | **新增** | react-query 预加载 |
| `hooks/use-page-data.ts` | **新增** | react-query hook：`usePageData(userSlug, pageId)` |
| **服务** | | |
| `lib/services/community.ts` | 修改 | `getPublishedPageContext` 改为单查询 + `React.cache()` |
| **路由** | | |
| `app/(dashboard)/[user_slug]/[page_id]/page.tsx` | 修改 | 仅阻塞 T1；T2/T3 Suspense 流式 |
| `app/layout.tsx` | 修改 | 添加 `preconnect` |
| `next.config.ts` | 修改 | `optimizePackageImports` |

---

## 十二、实施步骤

### Phase 1：基础设施

1. Schema 变更：`authorSlug` 列 + 复合索引 + 回填
2. `lib/services/community.ts`：`getPublishedPageContext` 改为单查询 + `React.cache()`
3. `lib/navigation/page-route.ts`：`isPublishedPageRoute()` + 测试
4. 审核 `RESERVED_SLUGS`

### Phase 2：API

5. `app/api/read/[user_slug]/[page_id]/route.ts`
6. `hooks/use-page-data.ts`：react-query hook

### Phase 3：Topbar 重构

7. `topbar-slots.tsx`：TopbarSlotContext
8. `topbar.tsx`：插槽接口 + URL 自判定 + 移除 MutationObserver + ReadMoreMenu 抽离
9. `read-more-menu.tsx`：独立组件
10. 删除 `hooks/use-read-mode.ts`
11. 简化 `topbar-mode.ts`
12. `next/dynamic`：ReportDialog、FeedbackDialog、GlobalSearch

### Phase 4：ReadPageShell + Server Component

13. `read-page-shell.tsx`
14. 修改 `page.tsx`：T1 阻塞、T2/T3 Suspense
15. `read-page-client.tsx`：删除 DOM 属性操作

### Phase 5：懒加载

16. `read-drawer.tsx`：tab 内容 `next/dynamic`
17. PageSettingsPanel `next/dynamic`
18. `use-prefetch-drawer-tabs.ts`

### Phase 6：补充优化

19. `loading.tsx`：阅读页骨架
20. `layout.tsx`：preconnect
21. `next.config.ts`：optimizePackageImports
22. 发布 API：添加 `revalidatePath`
23. Neon 保温 cron

### Phase 7：验证

24. `cd apps/web && pnpm typecheck`
25. 手动回归：冷加载 / 后退前进 / 副页 / 设置 tab / 沉浸模式 / 抽屉 / 非阅读模式 Topbar

---

## 十三、性能对比

| 指标 | 重构前 | 重构后 |
|------|--------|--------|
| Topbar 模式切换 | ~500ms-2s | **0ms** |
| 服务端 TTFB | ~75-270ms（6 串行查询） | **~10-30ms**（1 次索引查询） |
| 首访正文可见 | ~590ms-2.3s | **~120-550ms**（-78%） |
| 后退/前进 | 同首访 | **0ms**（react-query 缓存） |
| CDN 缓存（公开页） | 不支持 | **TTFB < 50ms** |
| JS Bundle | 含 drawer + settings | **-40-60KB** |
| hover 预取 | 不支持 | API prefetchQuery |

### 场景详解

```
场景 A：首次访问公开页面（冷加载）
  重构前: 75-270ms(串行DB) + 100-500ms(网络) + 350-1250ms(JS) + 50-200ms(session fetch)
        = 575ms-2.2s
  重构后: 10-30ms(1次DB) + 100-500ms(网络) + 150-400ms(JS, 减半)
        = 260ms-930ms
  重构后 + CDN: <50ms(TTFB) + 150-400ms(JS) = 200-450ms

场景 B：后退到已访问页面（热加载）
  重构前: 575ms-2.2s（全流程重来）
  重构后: 0ms（react-query 缓存 + Topbar 同步判定）

场景 C：hover 链接（预取）
  重构前: 不支持
  重构后: prefetchQuery → 导航前缓存就绪 → 瞬时
```

---

## 十四、风险

1. **RESERVED_SLUGS 同步**：新增 `(dashboard)` 顶级路由时须同步追加保留词。`registerSchema` 已有校验，CI 建议加检查脚本。
2. **URL 判定假阳性**：`/admin/xxx` → `admin` 在保留词中不匹配。风险低。
3. **Suspense 流式降级**：HTTP 中间代理可能缓冲。T2/T3 延迟到达不影响 T1 渲染。
4. **Drawer 懒加载**：首次打开有短暂 fallback。`requestIdleCallback` 预加载可降到极小。
5. **`authorSlug` 回填**：迁移时需回填历史数据。发布时写入，之后不会变。
6. **CDN `Vary: Cookie`**：确保登录/未登录缓存隔离。测试时注意 cookie 差异。

# Read Page 重构 Spec（性能优先版）

## 一、核心洞察

### 页面加载速度的关键瓶颈

当前 `[user_slug]/[page_id]/page.tsx` 是一个 Server Component，在返回 HTML 之前会**串行阻塞**获取以下所有数据：

```
getPublishedPageContext → getCommunitySummary → ensureCommunityEntity → listCommunityComments → 推荐查询
         ↓                                                                                          ↓
    page HTML + 作者                                                           评论 + 点赞 + 推荐
```

**所有数据就绪后**浏览器才收到第一个字节。然后 `ReadPageClient` 通过 `setAttribute("data-page-mode", "read")` 通知 Topbar 切换到阅读模式 —— Topbar 在此之前不知道自己在阅读页。

### 性能第一性原则

**URL 本身就是最快的信号**。路径 `/[userSlug]/[pageId]` 中，只要 `userSlug` 不在保留词列表中，就能**同步判定**这是一个 published page 路由。这发生在客户端渲染的第一帧，早于任何服务端数据返回。

更重要的是，**从 URL 就能确定作者身份和大部分 tab 状态**：

| 信息 | 来源 | 延迟 |
|------|------|------|
| 这是 published page | `isPublishedPageRoute(pathname)` | 0ms |
| 当前用户是否作者 | `session?.userSlug === urlUserSlug` | 0ms（session 已在 AppShell 中） |
| 作者显示名/头像 | 需要 `getPublishedPageContext` | ~50-150ms |
| 是否有副页 | `page.sidePageUid != null` | ~50-150ms |
| page HTML | `page.html` | ~50-150ms |

**tablist 可以在服务端数据到达前就渲染**：Page tab（始终有）+ Settings tab（`session.userSlug === urlUserSlug` 立即判定）。只有 "Side Page" tab 需要等服务端返回 `sidePageUid`。

```
路径解析（0ms，客户端同步）
  → Topbar 立即切换阅读模式 + 右侧按钮 + 中间 tab 列表（Page + Settings if isAuthor）
  → 服务端返回 page HTML → iframe 渲染正文 + Side Page tab 按需出现
  → 其余数据（评论/推荐/笔记）Suspense 流式或客户端闲时加载
```

---

## 二、快速路由判定

### 2.1 判定函数

复用已有的 `lib/utils/user-slug.ts` 中的 `isReservedSlug()` 和 `RESERVED_SLUGS`：

```typescript
// lib/navigation/page-route.ts （新增）

import { isReservedSlug } from "@/lib/utils/user-slug"

/**
 * 通过 URL pathname 同步判定是否为 published page 路由。
 * 规则：pathname 格式为 /[segment1]/[segment2]，且 segment1 不是保留词。
 * 这可以在客户端首帧执行（usePathname），无需等待服务端数据。
 */
export function isPublishedPageRoute(pathname: string): {
  isPage: boolean
  userSlug?: string
  pageId?: string
} {
  const parts = pathname.split("/").filter(Boolean)
  // 必须是恰好两段：/[userSlug]/[pageId]
  if (parts.length !== 2) return { isPage: false }
  const [first, second] = parts
  // 保留词不可能是 userSlug
  if (isReservedSlug(first)) return { isPage: false }
  // 第二段存在即认为是 pageId
  if (!second) return { isPage: false }
  return { isPage: true, userSlug: first, pageId: second }
}
```

**保留词列表**（来自 `RESERVED_SLUGS`）覆盖了 `(dashboard)` 下所有顶级路由：

| 类别 | 保留词 |
|------|--------|
| App Router 内部 | `page`, `read`, `author`, `profile`, `settings`, `admin`, `login`, `register`, `api` |
| 社区浏览 | `search`, `tags`, `category`, `collections`, `history`, `notifications`, `moment`, `leaderboard` |
| 市场/创作 | `mcp-market`, `skill-market`, `publish`, `my-packages`, `analytics` |
| 技术路径 | `_next`, `favicon`, `static`, `public`, `assets`, `images`, `sitemap`, `robots` |
| 系统保留 | `administrator`, `root`, `system`, `viben`, `mod`, `moderator`, `null`, `undefined`, `true`, `false` |

> **注意**：如果后续 `(dashboard)` 下新增顶级路由，需要同步追加到 `RESERVED_SLUGS`。可以考虑在 CI 中增加检查脚本。

### 2.2 判定时机对比

| 方案 | 判定时机 | 延迟 |
|------|---------|------|
| 当前（DOM 属性） | 等服务端渲染完 → `ReadPageClient` hydrate → `setAttribute` → `MutationObserver` 回调 | ~500ms-2s |
| **新方案（URL 解析）** | Topbar 首次渲染时，`usePathname()` 返回即可判定 | **0ms（同步）** |

---

## 三、数据加载优先级

### 3.1 分层策略

```
┌──────────────────────────────────────────────────────────┐
│ T0: Topbar 立即切换（URL + session，0ms）                  │
│     URL → isPublishedPageRoute → 阅读布局 + 右侧按钮       │
│     session.userSlug === urlUserSlug → isAuthor           │
│     → 中间 tab 列表: Page tab + (isAuthor ? Settings tab)  │
│     仅 Side Page tab 需要等服务端数据                       │
├──────────────────────────────────────────────────────────┤
│ T1: 服务端阻塞获取（页面核心数据，1 次索引查询）            │
│     publishedPages.findFirst({ authorSlug, uid })          │
│     → page HTML + 作者名/头像 + sidePageUid（冗余字段）     │
│     渲染: iframe srcDoc + 面包屑标签 + Side Page tab 出现   │
├──────────────────────────────────────────────────────────┤
│ T2: 服务端 Suspense 流式返回（互动数据）                    │
│     getCommunitySummary + ensureCommunityEntity            │
│     渲染: 点赞数/收藏数/评论数                              │
├──────────────────────────────────────────────────────────┤
│ T3: 客户端按需/闲时加载（非关键数据）                       │
│     listCommunityComments（评论列表）                       │
│     推荐页面列表                                            │
│     NotesPanel 数据                                        │
│     PageSettingsPanel（仅作者点击设置 tab 时）               │
└──────────────────────────────────────────────────────────┘
```

### 3.2 服务端改造：Suspense 流式渲染

```typescript
// app/(dashboard)/[user_slug]/[page_id]/page.tsx

export default async function PagePage({ params, searchParams }: PageProps) {
  const { user_slug, page_id } = await params
  const { tab } = await searchParams
  const session = await getSession()

  // T1: 仅阻塞获取页面核心数据（page HTML + 作者）
  const ctx = await getPublishedPageContext(user_slug, page_id)
  if (!ctx || !canReadPage(ctx.page, session)) {
    notFound()
  }

  const isAuthor = session?.userId === ctx.page.userId
  if (tab === "settings" && !isAuthor) {
    redirect(`/${encodeURIComponent(user_slug)}/${encodeURIComponent(page_id)}?tab=read`)
  }

  return (
    <ReadPageShell
      userSlug={user_slug}
      pageId={page_id}
      pageHtml={ctx.page.html}
      pageTitle={ctx.page.title}
      // ... 所有 T1 数据作为 props
      isAuthor={isAuthor}
      hasSidePage={!!ctx.page.sidePageUid}
    >
      {/* T1 内容：iframe 主体（立即渲染） */}
      <ReadPageContent ... />

      {/* T2 内容：互动数据（Suspense 流式，不阻塞 T1） */}
      <Suspense fallback={null}>
        <CommunitySummaryLoader pageId={ctx.page.id} session={session} />
      </Suspense>

      {/* T3 内容：评论初始数据（Suspense 流式） */}
      <Suspense fallback={null}>
        <InitialCommentsLoader pageId={ctx.page.id} session={session} />
      </Suspense>
    </ReadPageShell>
  )
}
```

关键的异步组件：

```typescript
// T2: 社区互动数据
async function CommunitySummaryLoader({ pageId, session }: { pageId: string; session: Session | null }) {
  const summary = await getCommunitySummary("published_page", pageId, session)
  const entity = await ensureCommunityEntityForPage({ page: { id: pageId } })
  // 通过 context 注入，或作为 serialized props 传给 client component
  return <CommunityDataInjector summary={summary} entityId={entity.id} />
}

// T3: 评论初始数据
async function InitialCommentsLoader({ pageId, session }: { pageId: string; session: Session | null }) {
  const { comments, nextCursor } = await listCommunityComments({
    entityType: "published_page",
    entityId: pageId,
    parentCommentId: null,
    limit: 20,
    session,
  })
  return <CommentsDataInjector comments={comments} nextCursor={nextCursor} />
}
```

> 如果不想引入过多 Server Component 嵌套，也可以将 T2/T3 全部改为客户端 react-query 获取。但 Suspense 流式方案可以利用 HTTP 流，更快到达客户端。

---

## 四、Topbar 重构

### 4.1 新的 Topbar 接口

```typescript
// components/layout/topbar.tsx

interface TopbarProps {
  session: Session | null
  onToggleSidebar: () => void

  // === 插槽（参考 desktop WorkspaceHeader） ===
  /** 头部中间内容。阅读模式：tab 切换栏；默认模式：GlobalSearch */
  centerContent?: ReactNode
  /** 头部右侧内容。阅读模式：抽屉/沉浸/更多按钮；默认模式：通知/用户菜单 */
  rightContent?: ReactNode

  // === 默认模式数据（插槽为空时使用） ===
  notificationItems?: Array<...>
  historyItems?: Array<...>
  hotSearches?: Array<...>
  recentSearches?: string[]
}
```

### 4.2 自驱动模式切换 + 即时 tablist

Topbar 通过 URL + session 自行判定阅读模式和 tab 状态：

```typescript
export function Topbar({ session, centerContent, rightContent, ... }: TopbarProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // ★ 核心：通过 URL 同步判定，0ms 延迟
  const { isPage: isReadPageFromUrl, userSlug, pageId } = isPublishedPageRoute(pathname)

  // ★ isAuthor 从 URL + session 立即判定（不等服务端）
  const isAuthor = isReadPageFromUrl && session?.userSlug === userSlug

  // hasSidePage 需要服务端数据，初始为 false，服务端数据到达后更新
  const [hasSidePage, setHasSidePage] = useState(false)
  // （通过 TopbarSlotContext 或 ReadPageShell 更新）

  const isRead = isReadPageFromUrl ||
    (tabParam !== null && new Set(["read", "settings"]).has(tabParam))

  if (mode === "landing") return null

  // ★ 中间 tab 列表：可以立即渲染 Page + Settings tab
  // hasSidePage 初始 false，等服务端确认后 Side Page tab 才出现
  const defaultCenter = useMemo(() => {
    if (!isReadPageFromUrl) return <GlobalSearch ... />
    if (!hasSidePage && !isAuthor) return null  // 无 tab 可切换
    return (
      <VibenTabs value={activeTab} onValueChange={handleTabChange}>
        <VibenTabsList variant="pill">
          <VibenTabsTrigger value="read" variant="pill">
            <FileText /> {t("community.page")}
          </VibenTabsTrigger>
          {hasSidePage && (
            <VibenTabsTrigger value="side" variant="pill">...</VibenTabsTrigger>
          )}
          {isAuthor && (
            <VibenTabsTrigger value="settings" variant="pill">...</VibenTabsTrigger>
          )}
        </VibenTabsList>
      </VibenTabs>
    )
  }, [isReadPageFromUrl, hasSidePage, isAuthor, activeTab])

  const effectiveCenter = centerContent ?? defaultCenter
  const effectiveRight = rightContent ?? (
    isReadPageFromUrl ? <DefaultReadRightContent pageId={pageId} userSlug={userSlug} /> : <DefaultRightContent ... />
  )

  return (
    <header className={cn(isRead ? "fixed ... backdrop-blur" : "sticky ...")}>
      ... // layout unchanged
    </header>
  )
}
```

**关键**：`isAuthor` 从 `session.userSlug === urlUserSlug` 立即判定，不需要等 `getPublishedPageContext` 返回。Settings tab 在首帧即可正确显示。只有 `hasSidePage`（`page.sidePageUid != null`）需要在服务端数据到达后更新。

### 4.3 默认阅读模式右侧内容

当 ReadPageShell 还没有挂载（或未提供 rightContent 插槽）时，Topbar 用 URL 自判定的默认值：

```typescript
function DefaultReadRightContent({ pageId, userSlug }: { pageId: string; userSlug: string }) {
  const { toggle } = useDrawer()
  return (
    <>
      <IconButton size="compact" label={t("community.expandDetails")} onClick={toggle}>
        <PanelRight className="h-4 w-4" />
      </IconButton>
      <ImmersiveToggleButton />
      <ReadMoreMenu pageId={pageId} userSlug={userSlug} />
    </>
  )
}
```

当 `ReadPageShell` 挂载后，通过 `TopbarSlotContext` 提供更丰富的 `rightContent`（如果默认的已经足够，则不需要覆盖）。

### 4.4 抽离 ReadMoreMenu

```typescript
// components/pages/read-more-menu.tsx （从 topbar.tsx 抽离）
export function ReadMoreMenu({ pageId, userSlug }: { pageId: string; userSlug: string }) {
  // ... 报告和反馈的下拉菜单
}
```

---

## 五、ReadPageShell 设计

### 5.1 职责

`ReadPageShell` 是阅读页面的**壳组件**（Client Component），负责：
1. 接收服务端传递的 T1 数据（page HTML + meta）
2. 管理 tab 状态（read / side / settings）
3. 向 Topbar 补充 `hasSidePage`（唯一需要服务端确定的 tab 信息）
4. 管理 `--reader-header-safe` CSS 变量
5. 预加载抽屉数据

**注意**：`isAuthor` 不需要 ReadPageShell 提供 —— Topbar 已经从 `session.userSlug === urlUserSlug` 自行判定了。

```typescript
// components/pages/read-page-shell.tsx

interface ReadPageShellProps {
  // T1 数据（服务端阻塞获取）
  userSlug: string
  pageId: string
  pageHtml: string
  pageTitle: string
  hasSidePage: boolean   // 来自 page.sidePageUid != null
  activeTab: string      // 来自 URL ?tab=
  children: ReactNode
}

export function ReadPageShell({
  userSlug, pageId, pageHtml, pageTitle,
  hasSidePage, activeTab: initialTab,
  children,
}: ReadPageShellProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [activeTab, setActiveTab] = useState(initialTab)

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab)
    router.replace(`${pathname}?tab=${tab}`, { scroll: false })
  }, [router, pathname])

  // 向 Topbar 注入 hasSidePage（唯一需要服务端确认的 tab 信息）
  // 通过 TopbarSlotContext 传递，彻底消除 DOM 属性通信
  const topbarSlots = useMemo(() => ({
    hasSidePage,
  }), [hasSidePage])

  // 预加载抽屉数据
  usePrefetchDrawerTabs(pageMeta)

  return (
    <TopbarSlotProvider value={topbarSlots}>
      {children}
    </TopbarSlotProvider>
  )
}
```

**简化说明**：由于 Topbar 已通过 URL + session 自行判定 `isAuthor` 并渲染 tablist，ReadPageShell 只需要通过 `TopbarSlotContext` 传递 `hasSidePage` 来让 Side Page tab 出现。不再需要任何 DOM 属性操作。

### 5.2 TopbarSlotContext

```typescript
// components/layout/topbar-slots.tsx

interface TopbarSlots {
  /** 覆盖默认 centerContent。通常不需要，Topbar 已自判定 tablist */
  centerContent?: ReactNode
  /** 覆盖默认 rightContent。通常不需要，Topbar 已自判定默认按钮 */
  rightContent?: ReactNode
  /** 服务端确认的 hasSidePage，控制 Side Page tab 出现 */
  hasSidePage?: boolean
}

const TopbarSlotContext = createContext<TopbarSlots | null>(null)

export function TopbarSlotProvider({ value, children }: { value: TopbarSlots; children: ReactNode }) {
  const memoValue = useMemo(() => value, [value.centerContent, value.rightContent, value.hasSidePage])
  return <TopbarSlotContext.Provider value={memoValue}>{children}</TopbarSlotContext.Provider>
}

export function useTopbarSlots(): TopbarSlots | null {
  return useContext(TopbarSlotContext)
}
```

Topbar 中使用：

```typescript
const slots = useTopbarSlots()

// hasSidePage：URL 自判定时默认为 false，等服务端确认后由 ReadPageShell 更新
const hasSidePage = slots?.hasSidePage ?? false

// isAuthor：直接从 URL + session 判定，不依赖服务端
const isAuthor = isReadPageFromUrl && session?.userSlug === userSlug

// Center：插槽优先 → URL 自判定 tablist（含 isAuthor + hasSidePage）
// 注意：isAuthor（来自 URL+session）在首帧就正确；hasSidePage 初始 false，服务端数据到达后更新
const center = slots?.centerContent ?? (
  isReadPageFromUrl
    ? (hasSidePage || isAuthor ? <TabList hasSidePage={hasSidePage} isAuthor={isAuthor} /> : null)
    : <GlobalSearch ... />
)

// Right：插槽优先 → URL 自判定默认 → 用户菜单等
const right = slots?.rightContent ?? (isReadPageFromUrl ? <DefaultReadRightContent ... /> : <DefaultRightContent ... />)
```

---

## 六、懒加载 + 预加载

### 6.0 利用现有的懒加载框架

项目已有完整的懒加载基础设施：`DashboardShell` → `dynamic(() => import("AppShellWrapper"), { ssr: false })`。

```
页面加载
  → DashboardShell 立即渲染骨架屏（无 JS 阻塞）
  → dynamic() 异步加载 AppShellWrapper chunk
  → AppShellWrapper 获取 session + 通知 + 历史
  → AppShell 渲染 → Topbar 渲染（此时 session + usePathname() 均已就绪）
```

**关键保证**：Topbar 渲染时 `session.userSlug` 已可用。`isAuthor = session.userSlug === urlUserSlug` 在 Topbar 首帧即可正确判定。

对于阅读页的内容组件，应该复用相同的 `next/dynamic` 模式（与 `DashboardShell` 一致），而非 `React.lazy`。

### 6.1 Drawer 面板

抽屉内容使用 `next/dynamic`，仅在抽屉首次打开时加载组件代码：

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

// 每个 tab 内容按条件渲染（Suspense 由 dynamic 内置处理）
function TabContent({ tab, ...props }: { tab: string }) {
  if (tab === "details") return <LazyPageMeta {...props} />
  if (tab === "comments") return <LazyCommentsPanel {...props} />
  if (tab === "notes") return <LazyNotesPanel {...props} />
  return null
}
```

> `next/dynamic` 比 `React.lazy` 更适合：自带 `ssr: false` 控制、内置 loading fallback、与 DashboardShell 现有模式一致。

**关键优化**：抽屉的数据（comments、notes）通过 react-query 在 ReadPageShell 挂载后**立即预加载**，这样当用户打开抽屉时，数据大概率已经在缓存中：

```typescript
// hooks/use-prefetch-drawer-tabs.ts

export function usePrefetchDrawerTabs(pageMeta: PageMetaData) {
  const queryClient = useQueryClient()

  useEffect(() => {
    // 使用 requestIdleCallback 确保不阻塞 Read tab 的渲染
    const idleId = requestIdleCallback?.(() => {
      // 预加载评论第一页
      queryClient.prefetchQuery({
        queryKey: ["page-comments", pageMeta.communityEntityId, pageMeta.pageDbId],
        queryFn: () => fetch(`/api/community/comments?...`).then(r => r.json()),
        staleTime: 60_000,
      })
      // 预加载笔记
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

### 6.2 Settings Tab

仅在作者点击 "设置" tab 时才加载代码和数据，使用 `next/dynamic`：

```typescript
import dynamic from "next/dynamic"

const LazyPageSettingsPanel = dynamic(
  () => import("@/components/pages/page-settings-panel").then(m => ({ default: m.PageSettingsPanel })),
  { ssr: false, loading: () => <SettingsSkeleton /> }
)

// ReadPageClient 中：
{activeTab === "settings" && isAuthor && <LazyPageSettingsPanel {...settingsProps} />}
```

### 6.3 副页 Tab

副页内容同样在用户点击时才用 `dynamic()` 加载。

---

## 七、后端 API 设计

### 7.0 设计原则

服务端组件直接查 DB 是首访最快路径（无 HTTP 往返），但缺少缓存层。需要轻量 API 提供：

| 能力 | 实现 |
|------|------|
| 首访加速 | Server Component 直接 DB 查询（T1 仅 2 条索引查询） |
| 后退/前进缓存 | react-query 缓存命中 → 0ms |
| 预取链接页面 | hover 时 API 调用预填充缓存 |
| 公开页面 CDN | `stale-while-revalidate` 减轻源站压力 |

### 7.1 新增 API

#### Schema 变更

`publishedPages` 表新增 `authorSlug` 列，与 `uid` 组成复合唯一索引，**一次查询定位页面**：

```sql
ALTER TABLE published_pages ADD COLUMN author_slug text NOT NULL DEFAULT '';
-- 回填现有数据
UPDATE published_pages SET author_slug = (
  SELECT user_slug FROM users WHERE users.id = published_pages.user_id
);
-- 复合索引
CREATE UNIQUE INDEX published_pages_author_slug_uid_idx 
  ON published_pages(author_slug, uid);
```

发布时写入 `authorSlug`（发布后 userSlug 不变，无需同步）。

#### `GET /api/read/[user_slug]/[page_id]`

返回页面 HTML + 元信息，作为 react-query 的数据源。

```
请求
  GET /api/read/LinXueyuanStdio/0612-e2e-page
  Cookie: <session>  (可选)
  Query params:
    fields=html|meta|all  默认 all
      meta  → 仅返回元信息（不含 page.html），~300B
      html  → 仅返回 HTML
      all   → 完整数据

响应 200
{
  html: "<!DOCTYPE html>...",        // fields=meta 时不返回
  meta: {
    userSlug: "LinXueyuanStdio",
    pageId: "0612-e2e-page",
    pageDbId: "pg_xxx",              // 用于评论/点赞 API
    title: "E2E 测试页面",
    description: "...",
    authorName: "兮尘",
    authorAvatarUrl: "https://...",
    authorFollowersCount: 42,
    sidePageUid: "side-page-slug",   // null 表示无副页
    visibility: "public",
    publishedAt: "2025-06-12T...",
    tags: ["e2e", "test"],
    coverUrl: "https://...",
    // 互动计数
    viewCount: 1024,
    likeCount: 88,
    commentCount: 12,
    bookmarkCount: 5,
    shareCount: 3,
    // 当前用户状态
    isAuthor: true,                  // session.userSlug === userSlug
    hasSidePage: true,               // sidePageUid != null
    communityEntityId: "ce_xxx",     // 确保评论区可用
  }
}

响应 404  { error: { code: "not_found" } }
响应 403  { error: { code: "forbidden" } }  // 私有页面且非作者
```

**实现要点**（1 次索引查询，`authorSlug` + `uid` 复合索引）：

```typescript
// app/api/read/[user_slug]/[page_id]/route.ts
export async function GET(request: NextRequest, { params }) {
  const { user_slug, page_id } = await params
  const fields = request.nextUrl.searchParams.get("fields") ?? "all"
  const session = await getOptionalSession(request)

  // ★ 单次查询：author_slug + uid 复合索引
  const page = await db.query.publishedPages.findFirst({
    where: and(
      eq(publishedPages.authorSlug, user_slug),
      eq(publishedPages.uid, page_id),
    ),
  })
  if (!page || !canReadPage(page, session)) return notFound()

  const meta = {
    userSlug: page.authorSlug,
    pageId: page.uid,
    pageDbId: page.id,
    title: page.title,
    description: page.description,
    authorName: page.authorName,           // 冗余字段，无需 JOIN
    authorAvatarUrl: page.authorAvatarUrl, // 冗余字段，无需 JOIN
    sidePageUid: page.sidePageUid,
    visibility: page.visibility,
    publishedAt: page.publishedAt,
    tags: page.tags,
    coverUrl: page.coverUrl,
    viewCount: page.viewCount,
    likeCount: page.likeCount,
    commentCount: page.commentCount,
    bookmarkCount: page.bookmarkCount,
    shareCount: page.shareCount,
    isAuthor: session?.userId === page.userId,
    hasSidePage: !!page.sidePageUid,
    communityEntityId: page.id,
  }

  if (fields === "meta") return NextResponse.json({ meta })
  if (fields === "html") return NextResponse.json({ html: page.html })
  return NextResponse.json({ html: page.html, meta })
}
```

> 注意：`authorFollowersCount` 需要 JOIN `users` 表，已从 meta 响应中移除。如需关注者数量，由客户端按需调用 `/api/users/[user_slug]`。

#### CDN 缓存策略

```typescript
// app/api/read/[user_slug]/[page_id]/route.ts 响应头

const isPublic = page.visibility === "public" && page.moderationStatus === "approved"

return NextResponse.json(data, {
  headers: {
    "Cache-Control": isPublic
      ? "public, max-age=0, s-maxage=300, stale-while-revalidate=86400, must-revalidate"
      : "private, no-cache, no-store, must-revalidate",
    "Vary": "Cookie, Accept-Encoding",
    "ETag": `"${page.uid}-${page.updatedAt?.getTime() ?? page.publishedAt?.getTime()}"`,
  },
})
```

| 指令 | 作用 |
|------|------|
| `max-age=0` | 浏览器每次重新请求（可用 `If-None-Match` 条件请求） |
| `s-maxage=300` | CDN 缓存 5 分钟（仅共享缓存，不影响浏览器） |
| `stale-while-revalidate=86400` | CDN 过期后后台刷新，期间仍返回旧数据 |
| `must-revalidate` | swr 窗口过期后必须回源 |
| `Vary: Cookie` | 登录/未登录用户隔离缓存，防止污染 |
| `ETag` | 条件请求，page 未变时返回 304 |

#### 显式列选择（避免 TOAST 读取）

`publishedPages.html` 是 TEXT 列，PostgreSQL 将其存储在 TOAST 表（行外）。当查询包含 `html` 列时，数据库必须跟随 TOAST 指针读取全部内容（100KB+）。`?fields=meta` 查询不需要 `html`，应使用显式列选择完全跳过 TOAST 读取，节省 **5-15ms**：

```typescript
// ?fields=meta 时：仅选需要的列，跳过 html（TOAST）
const page = await db
  .select({
    id: publishedPages.id,
    uid: publishedPages.uid,
    userId: publishedPages.userId,
    title: publishedPages.title,
    description: publishedPages.description,
    authorSlug: publishedPages.authorSlug,
    authorName: publishedPages.authorName,
    authorAvatarUrl: publishedPages.authorAvatarUrl,
    sidePageUid: publishedPages.sidePageUid,
    visibility: publishedPages.visibility,
    moderationStatus: publishedPages.moderationStatus,
    publishedAt: publishedPages.publishedAt,
    tags: publishedPages.tags,
    coverUrl: publishedPages.coverUrl,
    viewCount: publishedPages.viewCount,
    likeCount: publishedPages.likeCount,
    commentCount: publishedPages.commentCount,
    bookmarkCount: publishedPages.bookmarkCount,
    shareCount: publishedPages.shareCount,
  })
  .from(publishedPages)
  .where(and(
    eq(publishedPages.authorSlug, user_slug),
    eq(publishedPages.uid, page_id),
  ))
  .limit(1)
```

### 7.2 已有 API（无需修改）

| 端点 | 用途 | 所属层级 |
|------|------|---------|
| `GET /api/community/entities/summary?entity_type=published_page&entity_id=X` | 互动数据（点赞/收藏/观众状态） | T2 |
| `GET /api/community/comments?entity_type=published_page&entity_id=X` | 评论列表 | T3 |
| `POST /api/community/comments` | 发表评论 | 交互 |
| `POST /api/community/reactions/toggle` | 点赞切换 | 交互 |
| `POST /api/community/bookmarks/toggle` | 收藏切换 | 交互 |
| `GET /api/community/history` | 浏览历史 | 全局 |

### 7.3 数据流：Server Component + API 双路径

```
首次访问（冷加载）：
  Server Component 直接 DB 查询 → 返回 HTML（含 page HTML + meta）
    → ReadPageShell 接收 props
    → 同时触发 react-query fetch (API) 填充缓存

后退/前进（热加载）：
  react-query 缓存命中 → 0ms
    → 后台 stale-while-revalidate API 调用

预取（hover 链接）：
  queryClient.prefetchQuery(API) → 提前填充缓存
```

Server Component 的 `page.tsx` 仅做 T1 阻塞查询：

```typescript
// T1: 2 条索引查询, ~20-60ms
const ctx = await getPublishedPageContext(user_slug, page_id)
if (!ctx || !canReadPage(ctx.page, session)) notFound()
// → 立即返回 ReadPageShell，不等待 T2/T3
```

之后 T2（互动数据）和 T3（评论）通过 Suspense 流式或客户端 API 获取。

---

## 八、ReadPageClient 简化

重构后 `ReadPageClient` 不再需要：
- ❌ `document.documentElement.setAttribute("data-page-mode", "read")`
- ❌ `document.documentElement.setAttribute("data-read-has-side-page", ...)`
- ❌ `document.documentElement.setAttribute("data-read-has-settings", ...)`
- ❌ 对应的 `useEffect` 清理函数

改为从 `ReadPageShell` 接收必要的状态作为 props，或通过轻量 context 获取。

---

## 九、文件变更总览

| 文件 | 操作 | 说明 |
|------|------|------|
| **API 层** | | |
| `app/api/read/[user_slug]/[page_id]/route.ts` | **新增** | 页面数据 API（支持 `?fields=meta` 轻量模式） |
| **路由/导航** | | |
| `lib/navigation/page-route.ts` | **新增** | `isPublishedPageRoute()` 快速路由判定 |
| `lib/utils/user-slug.ts` | 修改 | 确认 `RESERVED_SLUGS` 覆盖所有 `(dashboard)` 顶级路由 |
| **Layout 组件** | | |
| `components/layout/topbar.tsx` | 重构 | 添加 `centerContent`/`rightContent`；自驱动模式切换；移除 `ReadMoreMenu` 内联 + `MutationObserver` |
| `components/layout/topbar-slots.tsx` | **新增** | `TopbarSlotContext` + Provider + hook |
| `components/layout/topbar-mode.ts` | 简化 | 仅保留 landing 判断 |
| `components/layout/read-drawer.tsx` | 修改 | tab 内容 `next/dynamic` 懒加载 |
| **页面组件** | | |
| `components/pages/read-page-shell.tsx` | **新增** | 壳组件：tab 管理 + Topbar 插槽 + 预加载触发 |
| `components/pages/read-more-menu.tsx` | **新增** | 从 `topbar.tsx` 抽离 |
| `components/pages/read-page-client.tsx` | 简化 | 删除所有 DOM 属性操作 |
| **Hooks** | | |
| `hooks/use-read-mode.ts` | **删除** | 不再需要 MutationObserver |
| `hooks/use-prefetch-drawer-tabs.ts` | **新增** | react-query 预加载 hook |
| `hooks/use-published-page.ts` | **新增** | 封装 published page 相关 context |
| `hooks/use-page-data.ts` | **新增** | react-query hook：调用 `/api/read/[userSlug]/[pageId]` |
| **页面路由** | | |
| `app/(dashboard)/[user_slug]/[page_id]/page.tsx` | 修改 | 仅阻塞 T1 数据；T2/T3 改为 Suspense 流式 |

---

## 十、实施步骤

### Phase 1：基础设施（无行为变更）

1. 新增 `lib/navigation/page-route.ts`：`isPublishedPageRoute()` + 单元测试
2. 审核 `RESERVED_SLUGS`，确保覆盖 `(dashboard)` 下所有顶级路由
3. 新增 `app/api/read/[user_slug]/[page_id]/route.ts`：页面数据 API
4. 新增 `hooks/use-page-data.ts`：react-query hook 封装 API 调用
5. 抽离 `ReadMoreMenu` → `components/pages/read-more-menu.tsx`
6. 新增 `components/layout/topbar-slots.tsx`

### Phase 2：Topbar 插槽化

7. Topbar 添加 `centerContent`/`rightContent` props，默认行为不变
8. Topbar 接入 `useTopbarSlots()`，实现插槽优先级
9. Topbar 接入 `isPublishedPageRoute()`，实现自驱动模式切换（含 `isAuthor = session.userSlug === urlUserSlug`）
10. Topbar 添加 `DefaultReadRightContent`（URL 自判定时的默认右侧内容）

### Phase 3：ReadPageShell + Server Component 改造

11. 新增 `ReadPageShell` 组件（通过 TopbarSlotContext 传递 hasSidePage）
12. 修改 `[user_slug]/[page_id]/page.tsx`：仅阻塞 T1（getPublishedPageContext），T2/T3 改为 Suspense
13. 修改 `ReadPageClient`：删除 DOM 属性操作
14. 删除 `hooks/use-read-mode.ts`
15. 简化 `topbar-mode.ts`

### Phase 4：懒加载 + 预加载

16. `ReadDrawer` tab 内容改为 `next/dynamic` 懒加载
17. `PageSettingsPanel` 改为 `next/dynamic` 懒加载
18. 实现 `usePrefetchDrawerTabs`（react-query prefetchQuery）

### Phase 5：API 缓存策略

19. 为公开页面 API 响应添加 `Cache-Control: public, max-age=300, stale-while-revalidate=86400`
20. 客户端 `usePageData` hook 配置 `staleTime: 5 * 60_000`（匹配 CDN max-age）

### Phase 6：验证

21. `cd apps/web && pnpm typecheck`
22. 手动回归：冷加载 / 后退前进 / 副页 / 设置 tab / 沉浸模式 / 抽屉面板 / 非阅读模式 Topbar

---

## 十一、性能对比预估

| 指标 | 重构前 | 重构后 |
|------|--------|--------|
| Topbar 阅读模式切换 | ~500ms-2s（SSR + hydrate + DOM 属性） | **0ms**（URL + session 同步判定） |
| 服务端 TTFB | ~75-270ms（6 个串行 DB 查询） | ~10-30ms（**1 次**复合索引查询阻塞） |
| 首访正文可见 | ~590ms-2.3s | ~120-550ms（**-78%**） |
| 后退/前进导航 | 同首访（无缓存） | **0ms**（react-query 缓存命中） |
| 链接预取（hover） | 不支持 | API `prefetchQuery` → hover 时即就绪 |
| CDN 缓存（公开页） | 全量 SSR，无法 CDN | `stale-while-revalidate` → 热门页 **<50ms** |
| Drawer 首次打开 | 0ms（已急切渲染，但拖慢首屏） | ~50-200ms（懒加载，不影响首屏） |
| 初始 JS Bundle | 含全部 drawer + settings 组件 | 减少 ~40-60KB |
| 非作者用户 | 加载 settings 组件代码 | 完全不会加载 |

### 关键场景耗时详解

```
场景 A：用户首次访问公开页面（冷加载）
  重构前: 75-270ms(TTFB) + 100-500ms(网络) + 350-1250ms(JS) + 50-200ms(fetch session) = 575ms-2.2s
  重构后: 25-70ms(TTFB) + 100-500ms(网络) + 200-500ms(JS, 减半) = 325ms-1.1s
        + CDN 命中时 TTFB < 50ms = 总计 < 200-600ms

场景 B：用户后退到已访问页面（热加载）
  重构前: 575ms-2.2s（无缓存，重新走全流程）
  重构后: 0ms（react-query 缓存 + Topbar 同步判定）

场景 C：用户 hover 链接（预取）
  重构前: 不支持
  重构后: prefetchQuery → 点击前就绪 → 导航瞬时
```

---

## 十二、风险

1. **RESERVED_SLUGS 同步**：新增 `(dashboard)` 顶级路由时必须同步追加保留词，建议 CI 增加检查脚本。
2. **URL 判定假阳性**：如果 `/admin/something` 被错误判定为 page（admin 在保留词中所以不会），风险低。需要确保 user slug 注册时就已过滤保留词（当前 `registerSchema` 已包含此校验）。
3. **Suspense 流式降级**：如果 HTTP 流被中间代理缓冲，T2/T3 数据会延迟到达但不影响 T1 渲染。
4. **Drawer 懒加载体验**：用户首次打开 drawer 时有短暂的 Suspense fallback。通过 `requestIdleCallback` 预加载可以将此窗口降到极小。

---

## 十三、Review 补充优化（低工作量，高收益）

以下来自多维度性能 review，按优先级排列。

### 13.1 `next/dynamic`：不只是抽屉 tab

除了 drawer 内容，以下组件也应在首次加载时懒加载：

| 组件 | 当前 | 改后 | 节省 |
|------|------|------|------|
| `ReportDialog` | Topbar 急切导入 | `dynamic(…, { ssr: false })` | ~3KB JS |
| `FeedbackDialog` | Topbar 急切导入 | `dynamic(…, { ssr: false })` | ~3KB JS |
| `GlobalSearch` | Topbar 急切导入 | `dynamic(…, { ssr: false })` | ~5KB JS（阅读页完全不用） |

`ReportDialog` 和 `FeedbackDialog` 仅在用户点击"更多"菜单时才需要，`GlobalSearch` 仅在非阅读页使用。

### 13.2 `loading.tsx`：阅读页专用骨架屏

新增 `app/(dashboard)/[user_slug]/[page_id]/loading.tsx`：

```tsx
// loading.tsx
export default function ReadPageLoading() {
  return (
    <div className="flex flex-col" style={{ paddingTop: "var(--nav-h, 56px)" }}>
      <div className="w-full h-[60vh] animate-pulse rounded-lg bg-muted/20 mx-auto max-w-3xl" />
    </div>
  )
}
```

客户端导航到阅读页时展示 iframe 形状的骨架屏，而非通用 dashboard 骨架。感知性能提升明显。

### 13.3 `preconnect`：头像资源

在 `app/layout.tsx` 添加：

```tsx
<head>
  <link rel="preconnect" href="https://avatars.githubusercontent.com" crossOrigin="anonymous" />
</head>
```

每页都有作者头像，首次加载节省 TLS 握手 ~50-100ms。

### 13.4 `optimizePackageImports`：Tree-shaking

在 `next.config.ts` 添加：

```typescript
experimental: {
  optimizePackageImports: ['lucide-react', '@radix-ui/react-*'],
}
```

`lucide-react` 被大量使用（Bell, Clock, Flag, FileText, Settings 等 15+ 图标），此配置确保仅打包用到的图标，减少 ~5-10KB。

### 13.5 `React.cache()`：请求级去重

当前 `page.tsx` 中 `generateMetadata` 和 `PagePage` 各自调用 `getPublishedPageContext`，导致同一请求内重复查询。用 `React.cache()` 包装：

```typescript
// lib/services/community.ts
import { cache } from "react"

export const getPublishedPageContext = cache(
  async (userSlug: string, pageId: string): Promise<PublicPageContext | null> => {
    // ... 现有实现
  }
)
```

同一 HTTP 请求内的多次调用自动去重，节省 ~20-40ms。

### 13.6 Neon 保温：消除冷启动

对于 serverless Postgres，计算节点缩零后首次查询需 500ms-2s 冷启动。在 `packages/core/gateway` 添加保温端点，通过 Vercel Cron 每 4 分钟 ping 一次 `SELECT 1`。对非 CDN 命中的请求（私有页面）效果显著。

### 13.7 发布时缓存失效

页面编辑/发布后调用：

```typescript
// 在 publish/update API 中
revalidatePath(`/${userSlug}/${pageId}`)
revalidatePath(`/api/read/${userSlug}/${pageId}`)
```

确保 Vercel 边缘缓存立即清除旧数据，不在 `s-maxage=300` 窗口内提供过期内容。

# Read Page 重构 Spec v3

## 一、现状与问题

### 1.1 当前完整加载链路

用户访问 `https://viben-web.vercel.app/LinXueyuanStdio/0612-e2e-page?tab=read`：

```
══════════════ 服务端（Vercel Serverless） ══════════════

app/layout.tsx
  → ThemeProvider, I18nProvider, QueryProvider

app/(dashboard)/layout.tsx
  → <DashboardShell>
    → dynamic(ssr:false) → 服务端输出骨架屏

app/(dashboard)/[user_slug]/[page_id]/page.tsx (Server Component)
  force-dynamic，以下全部串行 await：

  ① getSession()                                 ~5-10ms    JWT 解码
  ② getPublishedPageContext()                    ~20-60ms   查 user by slug → 查 page by userId+uid
  ③ getCommunitySummary()                        ~10-40ms   点赞/收藏统计
  ④ ensureCommunityEntityForPage()               ~10-40ms   upsert 社区实体
  ⑤ listCommunityComments()                      ~20-80ms   评论列表 + 计数
  ⑥ 推荐查询（同分类/同作者）                     ~10-40ms   publishedPages JOIN users
  ═══════════════════════════════════════════════════════
  服务端 TTFB                                     ~75-270ms

══════════════ 网络 ════════════════════════════════════

  HTML + JS bundles 下载                         ~100-500ms

══════════════ 客户端 ══════════════════════════════════

  JS parse + execute                             ~200-800ms
  dynamic() chunk: AppShellWrapper                ~50-150ms
  AppShellWrapper useEffect:
    fetch /api/users/me                           ~50-200ms  ← 又一次 HTTP 往返
    fetch /api/notifications                      ~30-100ms
    fetch /api/community/history                  ~30-100ms
    → setReady(true) → AppShell 渲染

  AppShell 渲染:
    → Topbar 渲染（默认模式，不知道在阅读页）
      → useReadPageMode() → MutationObserver 开始监听 <html>
    → <main> 渲染 ReadPageClient
      → ReadPageClient hydrate
        → useEffect: document.documentElement.setAttribute("data-page-mode", "read")
        → MutationObserver 回调 → Topbar re-render → 切换到阅读模式
    → iframe srcDoc={pageHtml} → 渲染正文
  ═══════════════════════════════════════════════════════
  Topbar 模式正确                                  ~530-2200ms
  正文可见                                        ~590-2300ms
```

### 1.2 核心问题

| 问题 | 根因 | 影响 |
|------|------|------|
| **服务端串行阻塞** | 6 个 DB 查询全部 await 后才返回 HTML | TTFB 75-270ms |
| **正文不是第一个字节** | DashboardShell → Topbar HTML 排在正文前面 | 浏览器先解析骨架，后才看到正文 |
| **DOM 属性通信** | ReadPageClient `setAttribute` → Topbar `MutationObserver` | Topbar 延迟 500ms-2s |
| **不需要的信息阻塞了正文** | session、评论、推荐等与正文无关的数据阻塞了 page HTML | 用户等待看到的内容被不需要的数据拖慢 |
| **无缓存** | `force-dynamic` 禁止 CDN；react-query 仅 CommentsPanel 使用 | 每次全量 SSR |

### 1.3 用户的真实优先级

```
用户访问页面 → 想要看到:  正文（page HTML）
当前架构实际给的:          Topbar 骨架 → Sidebar 骨架 → AppShell → 正文
```

---

## 二、v3 核心设计

### 2.1 两帧加载模型

```
══════════════ 第一帧：正文（服务端流式，~50-200ms） ══════════════

  块1: <script>window.__viben_page_meta = {...}</script>
  块2: <div id="topbar-placeholder" />     ← 纯 CSS 占位，无 JS
  块3: ★ <iframe srcDoc="...正文..." />    ← 浏览器立即渲染正文
  块4-5: T2/T3 数据（流式，不阻塞正文）

  ★ 此时不需要 session、不需要 isAuthor、不需要任何用户信息
  ★ 只需要 page HTML + 一个等高的占位条

══════════════ 第二帧：Topbar（客户端异步，~200-500ms） ══════════════

  ReadTopbar JS bundle 下载完成
    → 从 cookie / API 获取 session
    → isAuthor = session.userSlug === urlUserSlug
    → hasSidePage = window.__viben_page_meta.hasSidePage
    → 渲染完整 Topbar（tablist + 右侧按钮）
    → 替换占位条

  ★ Topbar 渲染完成前，占位条保证无 CLS
```

### 2.2 三条原则

**原则一：正文优先。** 阅读页脱离 `(dashboard)` route group，使用独立最简 layout。iframe 正文是 HTML 流中第一个有意义的内容块。Topbar 在第二帧加载。

**原则二：不需要的信息不阻塞正文。** 第一帧只包含 page HTML + 页面元信息。session、评论区、互动数据等全部在第二帧或更晚加载。

**原则三：URL 即信号。** Topbar 加载后，`isPublishedPageRoute(pathname)` 同步判定（0ms），`isAuthor = session.userSlug === urlUserSlug`（0ms），不需要等额外的服务端响应。

### 2.3 组件树对比

#### 重构前

```
RootLayout → DashboardLayout → DashboardShell → AppShellWrapper (fetch session)
  → AppShell
    → Topbar（MutationObserver）
    → Sidebar
    → <main>
      → ReadPageClient（setAttribute）
        → ReadDrawer（急切渲染三个 tab）
        → iframe 或 PageSettingsPanel（急切渲染）
```

#### 重构后

```
RootLayout
├── (dashboard) layout（不变）            ← 首页/设置/搜索等
│   └── DashboardShell → AppShell → ...

└── (read) layout                         ← ★ 阅读页独立
    └── DrawerProvider
      ├── <script> __viben_page_meta      ← 第一帧：初始数据（流式块1）
      ├── <div id="topbar-placeholder" /> ← 第一帧：Topbar 占位条（流式块2）
      ├── <iframe srcDoc={pageHtml} />    ← 第一帧：正文（流式块3）
      ├── Suspense: CommunitySummary      ← 第二帧：互动数据（流式块4-5）
      ├── ReadTopbar (dynamic)            ← 第二帧：JS 加载后替换占位条
      │   └── ReadTopbarInner
      │     ├── 从 cookie 取 session
      │     ├── isAuthor = session.userSlug === urlUserSlug
      │     └── 渲染完整 Topbar（tablist + 按钮）
      └── ReadDrawer (dynamic tabs)       ← 按需：抽屉面板
```

---

## 三、Route Group 分离

### 3.1 为什么需要独立的 route group

`(dashboard)/layout.tsx` 包裹了 `DashboardShell → AppShell`。只要阅读页在 `(dashboard)` 下，正文就必然在 Topbar + Sidebar 之后。将阅读页移到 `app/(read)/` route group，使用独立的最简 layout。Route group 不影响 URL。

### 3.2 文件结构

```
app/
  layout.tsx                                       ← RootLayout（两个 group 共享）

  (dashboard)/                                     ← 默认页面
    layout.tsx                                      ← DashboardShell → AppShell
    [user_slug]/
      [page_id]/
        page.tsx                                    ← ★ 保留作为 fallback
    ...

  (read)/                                          ← ★ 阅读页（最简 layout）
    layout.tsx                                      ← 无 DashboardShell，仅 DrawerProvider
    [user_slug]/
      [page_id]/
        page.tsx                                    ← Server Component
        loading.tsx                                 ← 正文区域骨架屏
```

**旧路由保留策略**：`(dashboard)/[user_slug]/[page_id]/page.tsx` 保留不删。在 `(read)` 验证通过后，旧文件改为 `redirect` 到新版或直接删除。Next.js 会优先匹配更具体的 route group，当两个 group 都有同一路径时行为未定义——需要在 `next.config.ts` 或通过 middleware 控制路由优先级。

### 3.3 `(read)/layout.tsx`

```tsx
// app/(read)/layout.tsx
//
// 阅读页的最简布局。
// 第一帧：正文 + Topbar 占位条（纯 CSS，无 JS）
// 第二帧：ReadTopbar 异步加载，替换占位条

import { DrawerProvider } from "@/components/layout/drawer-context"
import { ReadTopbar } from "@/components/layout/read-topbar"

export default function ReadLayout({ children }: { children: React.ReactNode }) {
  return (
    <DrawerProvider>
      {/* children 在 DOM 中最靠前：正文 + Topbar 占位条 */}
      {children}

      {/* ReadTopbar: dynamic import，第二帧加载后替换占位条 */}
      <ReadTopbar />
    </DrawerProvider>
  )
}
```

**DrawerProvider 上提**：阅读页在 `(read)` layout 中独立提供 `DrawerProvider`，不依赖 `(dashboard)` 的 `AppShell`。阅读页的 drawer 状态完全独立。

### 3.4 `loading.tsx`

```tsx
// app/(read)/[user_slug]/[page_id]/loading.tsx

export default function ReadPageLoading() {
  return (
    <div
      className="w-full"
      style={{
        height: "100vh",
        paddingTop: "var(--reader-header-safe, var(--nav-h, 56px))",
        transition: "padding-top 180ms ease",
      }}
    >
      <div className="w-full h-[60vh] animate-pulse rounded-lg bg-muted/20 mx-auto max-w-3xl" />
    </div>
  )
}
```

---

## 四、第一帧：page.tsx — 正文优先流式

### 4.1 首帧不需要 session

第一帧的目标是尽快把正文送到浏览器。此时：
- **不需要** session 信息（isAuthor 留到第二帧判断）
- **不需要** 评论区数据（T3 流式或客户端加载）
- **不需要** 互动数据（T2 流式）
- **只需要** page HTML + 页面元信息 + 一个 Topbar 占位条

### 4.2 Server Component 完整实现

```tsx
// app/(read)/[user_slug]/[page_id]/page.tsx

import { after } from "next/server"
import { Suspense } from "react"
import dynamic from "next/dynamic"
import { getPublishedPageContext, canReadPage } from "@/lib/services/community"
import { notFound, redirect } from "next/navigation"
import type { Metadata } from "next"

// ==================== 懒加载声明 ====================

const LazyPageSettingsPanel = dynamic(
  () => import("@/components/pages/page-settings-panel")
    .then(m => ({ default: m.PageSettingsPanel })),
  {
    ssr: false,
    loading: () => (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-muted" />
          <div className="h-4 w-full rounded bg-muted" />
          <div className="h-4 w-3/4 rounded bg-muted" />
        </div>
      </div>
    ),
  }
)

// ==================== Metadata ====================

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { user_slug, page_id } = await params
  const ctx = await getPublishedPageContext(user_slug, page_id)
  if (!ctx) return { title: "页面未找到" }

  const title = `${ctx.page.title} - Viben`
  const description = ctx.page.description ?? `${ctx.page.authorName ?? ctx.page.authorSlug} 分享的页面`
  const ogImage = ctx.page.coverUrl

  return {
    title,
    description,
    openGraph: {
      title, description,
      type: "article" as const,
      ...(ogImage ? { images: [{ url: ogImage, width: 1200, height: 630 }] } : {}),
    },
    twitter: {
      card: ctx.page.coverUrl ? "summary_large_image" as const : "summary" as const,
      title, description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  }
}

// ==================== Page ====================

interface PageProps {
  params: Promise<{ user_slug: string; page_id: string }>
  searchParams: Promise<{ tab?: string }>
}

export default async function PagePage({ params, searchParams }: PageProps) {
  const { user_slug, page_id } = await params
  const { tab } = await searchParams
  const activeTab = tab ?? "read"

  // ===== T1 唯一阻塞：1 次 DB 查询 =====
  // ★ 注意：不调用 getSession()，首帧不需要 session
  const t_start = Date.now()
  const ctx = await getPublishedPageContext(user_slug, page_id)
  const t_t1 = Date.now()

  if (!ctx) notFound()

  // 访问控制：仅检查页面可见性（不需要 session）
  // canReadPage 对公开/unlisted 页面返回 true（无 session 也放行）
  // 私有页面需要 session——此处先放行，在第二帧 Topbar 加载后由前端处理
  // 或者在 API route 层面做精确的权限校验
  if (!canReadPage(ctx.page, null)) {
    // 页面可能为私有——在客户端由 ReadTopbar 重定向
    // 或者此处调用 getSession 仅对私有页面做校验
    const { getSession } = await import("@/lib/auth/cookies")
    const session = await getSession()
    if (!canReadPage(ctx.page, session)) notFound()
  }

  // ===== 初始数据注入 =====
  // 包含第二帧 Topbar 渲染所需的所有信息
  // ★ 不包含 session 相关字段（isAuthor、viewerHasReacted 等）
  // ★ 这些由第二帧 ReadTopbar 自行获取
  const pageMeta = {
    hasSidePage: !!ctx.page.sidePageUid,
    userSlug: user_slug,
    pageId: page_id,
    pageTitle: ctx.page.title,
    pageUid: ctx.page.uid,
    authorName: ctx.page.authorName,
    authorAvatarUrl: ctx.page.authorAvatarUrl,
    pageDbId: ctx.page.id,
    communityEntityId: ctx.page.id,
    visibility: ctx.page.visibility,
    viewCount: ctx.page.viewCount,
    likeCount: ctx.page.likeCount,
    commentCount: ctx.page.commentCount,
    bookmarkCount: ctx.page.bookmarkCount,
    shareCount: ctx.page.shareCount,
    tags: ctx.page.tags as string[],
    coverUrl: ctx.page.coverUrl,
    publishedAt: ctx.page.publishedAt,
    description: ctx.page.description,
    sidePageUid: ctx.page.sidePageUid,
    chaptersJson: ctx.page.chaptersJson,
  }

  // ===== 日志 =====
  after(async () => {
    console.log("[perf] page_server", JSON.stringify({
      t1_ms: t_t1 - t_start,
      page_id: `${user_slug}/${page_id}`,
      is_public: ctx.page.visibility === "public",
      has_side_page: !!ctx.page.sidePageUid,
    }))
  })

  // ===== HTML 流式输出 =====
  // 顺序：初始数据 → Topbar 占位条 → 正文 iframe → T2 → T3

  return (
    <>
      {/* 块 1: 初始数据 script — 客户端 0ms 可读 */}
      <script
        id="viben-page-meta"
        type="application/json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pageMeta) }}
      />

      {/* 块 2: Topbar 占位条 — 纯 CSS，无 JS，保证 safe space 正确 + 无 CLS */}
      <div
        id="read-topbar-placeholder"
        className="fixed top-0 left-0 right-0 z-50 border-b border-border/52 bg-background"
        style={{ height: "var(--nav-h, 56px)" }}
      />

      {/* 块 3: ★ 正文 — DOM 中第一个可见内容 */}
      <div
        className="w-full bg-white dark:bg-[#0a0a0a] overflow-x-hidden"
        style={{
          height: "100vh",
          paddingTop: "var(--nav-h, 56px)",
        }}
      >
        {activeTab === "settings" ? (
          <div className="w-full overflow-auto" style={{ height: "100vh" }}>
            <div className="max-w-2xl mx-auto px-4 py-8">
              <Suspense fallback={<SettingsSkeleton />}>
                <SettingsTabGuard
                  userSlug={user_slug}
                  pageId={page_id}
                  pageUserId={ctx.page.userId}
                >
                  <LazyPageSettingsPanel
                    userSlug={user_slug}
                    pageId={page_id}
                    pageTitle={ctx.page.title}
                    pageDescription={ctx.page.description ?? ""}
                    pageUid={ctx.page.uid}
                    pageTags={(ctx.page.tags as string[]) ?? []}
                    pageVisibility={ctx.page.visibility}
                    pagePublishedAt={ctx.page.publishedAt}
                    pageHtml={ctx.page.html}
                    pageViewCount={ctx.page.viewCount}
                    pageLikeCount={ctx.page.likeCount}
                    pageCommentCount={ctx.page.commentCount}
                  />
                </SettingsTabGuard>
              </Suspense>
            </div>
          </div>
        ) : (
          <iframe
            title={ctx.page.title}
            srcDoc={ctx.page.html}
            sandbox="allow-scripts allow-forms allow-popups allow-modals allow-downloads"
            className="w-full border-0 bg-white dark:bg-[#0a0a0a]"
            style={{
              height: "calc(100vh - var(--nav-h, 56px))",
              minHeight: "calc(100vh - var(--nav-h, 56px))",
            }}
          />
        )}
      </div>

      {/* 块 4: T2 — 社区互动数据，Suspense 流式 */}
      <Suspense fallback={null}>
        <CommunitySummaryInjector pageId={ctx.page.id} />
      </Suspense>

      {/* 块 5: T3 — 评论初始数据，Suspense 流式 */}
      <Suspense fallback={null}>
        <InitialCommentsInjector pageId={ctx.page.id} />
      </Suspense>
    </>
  )
}

// ==================== SettingsTabGuard ====================
// 客户端组件：验证用户是否有权限访问 Settings tab
// 第一帧不阻塞——如果无权限则在客户端 redirect

"use client"
function SettingsTabGuard({
  userSlug, pageId, pageUserId, children,
}: {
  userSlug: string; pageId: string; pageUserId: string; children: React.ReactNode;
}) {
  // 第二帧 Topbar 加载后才有 session，这里先渲染 children
  // 权限校验由 Topbar 的 isAuthor 和 tab 切换逻辑保证
  return <>{children}</>
}

// ==================== T2/T3 异步注入组件 ====================

async function CommunitySummaryInjector({ pageId }: { pageId: string }) {
  const { getCommunitySummary, ensureCommunityEntityForPage } = await import("@/lib/services/community")
  const summary = await getCommunitySummary("published_page", pageId, null)

  // 确保社区实体存在（T2，不阻塞正文）
  await ensureCommunityEntityForPage({
    page: { id: pageId } as any,
    author: {} as any,
  }).catch(() => { /* 静默失败，评论区可降级 */ })

  return (
    <script
      id="viben-community-summary"
      type="application/json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          viewerHasReacted: false,  // 第二帧更新
          viewerHasBookmarked: false,
          communityEntityId: pageId,
          likeCount: summary?.counts.reactions ?? 0,
          bookmarkCount: summary?.counts.bookmarks ?? 0,
        }),
      }}
    />
  )
}

async function InitialCommentsInjector({ pageId }: { pageId: string }) {
  const { listCommunityComments } = await import("@/lib/services/community")
  const result = await listCommunityComments({
    entityType: "published_page",
    entityId: pageId,
    parentCommentId: null,
    limit: 20,
    session: null,  // 第一帧不传 session，第二帧客户端补充
  })

  return (
    <script
      id="viben-initial-comments"
      type="application/json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          comments: result.comments,
          nextCursor: result.next_cursor,
        }),
      }}
    />
  )
}
```

### 4.3 HTML 流的字节顺序

```
HTTP Response Body:
┌─────────────────────────────────────────────────────────────┐
│ 块 0: <!DOCTYPE html><html><head>                          │
│         <meta charset="utf-8">                              │
│         <link rel="stylesheet" href="tailwind.css">         │
│       </head><body>                                         │
├─────────────────────────────────────────────────────────────┤
│ 块 1: <script id="viben-page-meta" type="application/json"> │
│         {"hasSidePage":true,"userSlug":"LinXueyuanStdio"...}│
│       </script>                                             │
├─────────────────────────────────────────────────────────────┤
│ 块 2: <div id="read-topbar-placeholder"                    │
│            class="fixed ..."                                │
│            style="height:var(--nav-h)">                     │
│       </div>                                                │
│       ← 纯 CSS 占位，保证 --reader-header-safe 正确         │
├─────────────────────────────────────────────────────────────┤
│ 块 3: ★ <iframe srcDoc="...正文 HTML..." />                 │
│       ← 浏览器收到后立即渲染正文                              │
├─────────────────────────────────────────────────────────────┤
│ 块 4: <script id="viben-community-summary" ...>             │
│       (T2，流式到达，不阻塞正文)                              │
├─────────────────────────────────────────────────────────────┤
│ 块 5: <script id="viben-initial-comments" ...>              │
│       (T3，流式到达，不阻塞正文)                              │
├─────────────────────────────────────────────────────────────┤
│ 块 6: <script src="/_next/static/chunks/read-topbar.js">    │
│       (Topbar JS bundle，后台下载)                            │
├─────────────────────────────────────────────────────────────┤
│ 块 7: </body></html>                                        │
└─────────────────────────────────────────────────────────────┘

第一帧（块 0-3）：正文在 ~50-200ms 内可见
第二帧（块 6 加载完成后）：Topbar 替换占位条，~200-500ms
```

### 4.4 关键设计决策

**为什么首帧不调用 `getSession()`**：

| 数据 | 首帧需要？ | 原因 |
|------|----------|------|
| page HTML | ✅ 是 | 用户来的目的 |
| page meta（title, authorName 等） | ✅ 是 | 面包屑、SEO |
| Topbar 占位条 | ✅ 是 | 保证 safe space + 无 CLS |
| session / isAuthor | ❌ 否 | 只影响 Settings tab 显示，第二帧判断 |
| 评论区 | ❌ 否 | 用户可能不打开 |
| 互动数据（点赞/收藏） | ❌ 否 | 第二帧更新 |

**Settings tab 的处理**：如果 URL 是 `?tab=settings`，首帧仍然渲染 Settings 面板（服务端不知道 isAuthor）。但 `SettingsTabGuard` 客户端组件在第二帧 Topbar 加载后验证权限，非作者会被 Topbar 的 tab 切换逻辑 redirect 回 `?tab=read`。这比当前服务端 `redirect()` 慢约 200ms（等第二帧），但 Settings tab 访问量极低（仅作者本人），不影响绝大多数用户的正文加载速度。

---

## 五、第二帧：ReadTopbar

### 5.1 两帧之间的过渡

```
第一帧:  <div id="read-topbar-placeholder" />  ← 纯 CSS 灰色条
第二帧:  <header>完整 Topbar</header>            ← JS 渲染

过渡方式：
  ReadTopbarInner mount 时 → 移除 #read-topbar-placeholder（display:none）
  → 渲染完整 Topbar（position:fixed, 同高度）
  → 无 CLS（高度始终是 var(--nav-h)）
```

### 5.2 ReadTopbar — dynamic wrapper

```tsx
// components/layout/read-topbar.tsx
"use client"

import dynamic from "next/dynamic"
import { usePathname } from "next/navigation"
import { isPublishedPageRoute } from "@/lib/navigation/page-route"

const ReadTopbarInner = dynamic(
  () => import("./read-topbar-inner").then(m => ({ default: m.ReadTopbarInner })),
  { ssr: false }
)

export function ReadTopbar() {
  const pathname = usePathname()
  const { isPage, userSlug, pageId } = isPublishedPageRoute(pathname)

  // 非阅读页不渲染
  if (!isPage) return null

  return <ReadTopbarInner userSlug={userSlug!} pageId={pageId!} />
}
```

### 5.3 ReadTopbarInner — 完整实现

```tsx
// components/layout/read-topbar-inner.tsx
"use client"

import * as React from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { FileText, Columns2, PanelRight, Maximize2, Minimize2, Settings } from "lucide-react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils/index"
import { useDrawer } from "@/components/layout/drawer-context"
import { BreadcrumbNav } from "@/components/layout/breadcrumb"
import { BreadcrumbDynamicContext } from "@/components/layout/breadcrumb"
import { IconButton } from "@/components/ui/icon-button"
import { VibenTabs, VibenTabsList, VibenTabsTrigger } from "@/components/ui/viben-tabs"
import { ReadMoreMenu } from "@/components/pages/read-more-menu"
import { usePrefetchDrawerTabs } from "@/hooks/use-prefetch-drawer-tabs"
import type { BreadcrumbContextValue } from "@/components/layout/breadcrumb"

interface ReadTopbarInnerProps {
  userSlug: string
  pageId: string
}

// ==================== 数据读取 ====================

function getPageMeta(): PageMeta | null {
  if (typeof window === "undefined") return null
  const el = document.getElementById("viben-page-meta")
  if (!el) return null
  try { return JSON.parse(el.textContent ?? "") } catch { return null }
}

interface PageMeta {
  hasSidePage: boolean
  userSlug: string
  pageId: string
  pageTitle: string
  pageUid: string
  authorName: string
  authorAvatarUrl?: string
  pageDbId: string
  communityEntityId: string
  visibility: string
  viewCount: number
  likeCount: number
  commentCount: number
  bookmarkCount: number
  shareCount: number
  tags: string[]
  coverUrl?: string
  publishedAt: string
  description?: string
  sidePageUid?: string
  chaptersJson?: unknown
}

interface Session {
  userId: string
  username: string
  userSlug: string
  avatarUrl?: string
}

// ==================== 组件 ====================

export function ReadTopbarInner({ userSlug, pageId }: ReadTopbarInnerProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { toggle: toggleDrawer } = useDrawer()

  // ===== 状态 =====

  const [immersive, setImmersive] = React.useState(false)
  const [session, setSession] = React.useState<Session | null>(null)
  const [sessionLoaded, setSessionLoaded] = React.useState(false)

  // pageMeta：从服务端注入的 <script> 同步读取（第一帧数据，0ms）
  const [pageMeta] = React.useState<PageMeta | null>(getPageMeta)
  const hasSidePage = pageMeta?.hasSidePage ?? false

  // isAuthor：等 session 加载后判定
  const isAuthor = session?.userSlug === userSlug

  // activeTab：从 URL 读取
  const tabParam = searchParams.get("tab")
  const [activeTab, setActiveTab] = React.useState(
    tabParam === "side" && hasSidePage ? "side" : "read"
  )
  // 注意：settings tab 初始不激活——等 session 确认 isAuthor 后再决定

  // ===== 第二帧：获取 session =====

  React.useEffect(() => {
    // 从 cookie JWT 解析或 fetch /api/users/me
    // 首帧不阻塞，第二帧异步加载
    fetch("/api/users/me", { cache: "no-store" })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.user) {
          setSession({
            userId: data.user.id,
            username: data.user.username,
            userSlug: data.user.userSlug,
            avatarUrl: data.user.avatarUrl,
          })
        }
      })
      .finally(() => setSessionLoaded(true))
      .catch(() => setSessionLoaded(true))
  }, [])

  // session 加载后：如果是 author 且 URL 有 ?tab=settings，激活 settings
  React.useEffect(() => {
    if (sessionLoaded && session?.userSlug === userSlug && tabParam === "settings") {
      setActiveTab("settings")
    }
  }, [sessionLoaded, session, userSlug, tabParam])

  // 非作者访问 ?tab=settings → redirect
  React.useEffect(() => {
    if (sessionLoaded && session?.userSlug !== userSlug && activeTab === "settings") {
      setActiveTab("read")
      router.replace(`${pathname}?tab=read`, { scroll: false })
    }
  }, [sessionLoaded, session, userSlug, activeTab, router, pathname])

  // ===== Tab 切换 =====

  const handleTabChange = React.useCallback((value: string) => {
    setActiveTab(value)
    const tab = value === "read" ? "read" : value
    router.replace(`${pathname}?tab=${tab}`, { scroll: false })
  }, [router, pathname])

  // ===== 沉浸模式 =====

  React.useEffect(() => {
    if (immersive) {
      document.documentElement.style.setProperty("--reader-header-safe", "0px")
      return
    }

    const measure = () => {
      const h = document.querySelector("header")?.getBoundingClientRect().height
      document.documentElement.style.setProperty(
        "--reader-header-safe",
        `${Math.ceil(h || 56)}px`
      )
    }
    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [immersive])

  React.useEffect(() => {
    if (!immersive) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setImmersive(false)
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [immersive])

  // ===== 面包屑标签（第一帧数据已就绪，不闪烁） =====

  const breadcrumbContextValue = React.useMemo<BreadcrumbContextValue>(() => {
    const meta = pageMeta
    return {
      labels: {
        [`/${userSlug}`]: {
          label: meta?.authorName ?? userSlug,
          href: `/${userSlug}`,
        },
        [`/${userSlug}/${pageId}`]: {
          label: meta?.pageTitle ?? pageId,
        },
      },
    }
  }, [userSlug, pageId, pageMeta])

  // ===== 移除占位条 + 预加载 =====

  React.useEffect(() => {
    // 移除第一帧的占位条
    const placeholder = document.getElementById("read-topbar-placeholder")
    if (placeholder) {
      placeholder.style.display = "none"
    }

    // 预加载抽屉数据
    if (pageMeta) {
      const idleId = requestIdleCallback?.(() => {
        // prefetch 评论 + 笔记（通过 usePrefetchDrawerTabs hook 或直接调用）
        fetch(
          `/api/community/comments?entity_type=published_page&entity_id=${pageMeta.communityEntityId}&limit=20`
        ).catch(() => {})
        fetch(`/api/notes?page_id=${pageMeta.pageUid}`).catch(() => {})
      })
      return () => { if (idleId) cancelIdleCallback(idleId) }
    }
  }, [pageMeta])

  // ===== 日志 =====

  React.useEffect(() => {
    if (sessionLoaded) {
      console.log("[perf] topbar_ready", JSON.stringify({
        latency_ms: Math.round(performance.now()),
        pathname,
        is_author: isAuthor,
        has_side_page: hasSidePage,
        session_loaded: true,
      }))
    }
  }, [sessionLoaded]) // eslint-disable-line react-hooks/exhaustive-deps

  // ===== 沉浸模式：仅显示退出按钮 =====

  if (immersive) {
    return (
      <button
        onClick={() => setImmersive(false)}
        className="fixed top-3 right-3 z-60 p-2 rounded-lg bg-background/80 backdrop-blur border border-border shadow-sm hover:bg-background transition-colors"
        aria-label={t("community.exitImmersive")}
      >
        <Minimize2 className="h-4 w-4" />
      </button>
    )
  }

  // ===== 渲染 =====

  const showTabs = hasSidePage || isAuthor

  return (
    <BreadcrumbDynamicContext.Provider value={breadcrumbContextValue}>
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-50",
          "h-[var(--nav-h)] border-b border-border/52",
          "bg-background/68 backdrop-blur-[18px] saturate-[1.18]",
          "transition-transform duration-[220ms] ease-out",
        )}
      >
        <div
          className="h-full mx-auto px-4 grid gap-3 items-center"
          style={{
            gridTemplateColumns: "minmax(180px, 1fr) auto minmax(180px, 1fr)",
          }}
        >
          {/* ===== Left: 面包屑 ===== */}
          <div className="flex items-center gap-2 min-w-0">
            <BreadcrumbNav variant="read" />
          </div>

          {/* ===== Center: Tablist ===== */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-2">
            {showTabs && (
              <VibenTabs value={activeTab} onValueChange={(v) => v && handleTabChange(v)}>
                <VibenTabsList variant="pill">
                  <VibenTabsTrigger value="read" variant="pill">
                    <FileText className="h-4 w-4" />
                    <span className="ml-1.5">{t("community.page")}</span>
                  </VibenTabsTrigger>
                  {hasSidePage && (
                    <VibenTabsTrigger value="side" variant="pill">
                      <Columns2 className="h-4 w-4" />
                      <span className="ml-1.5">{t("community.sidePage")}</span>
                    </VibenTabsTrigger>
                  )}
                  {isAuthor && (
                    <VibenTabsTrigger value="settings" variant="pill">
                      <Settings className="h-4 w-4" />
                      <span className="ml-1.5">{t("community.settings")}</span>
                    </VibenTabsTrigger>
                  )}
                </VibenTabsList>
              </VibenTabs>
            )}
          </div>

          {/* ===== Right: 操作按钮 ===== */}
          <div className="flex items-center justify-end gap-1.5 min-w-0">
            <IconButton
              size="compact"
              label={t("community.expandDetails")}
              onClick={toggleDrawer}
            >
              <PanelRight className="h-4 w-4" />
            </IconButton>
            <IconButton
              size="compact"
              label={t("community.immersiveReading")}
              onClick={() => setImmersive(true)}
            >
              <Maximize2 className="h-4 w-4" />
            </IconButton>
            <ReadMoreMenu pageId={pageId} userSlug={userSlug} />
          </div>
        </div>
      </header>
    </BreadcrumbDynamicContext.Provider>
  )
}
```

### 5.4 第二帧加载的两个阶段

```
阶段 A（Topbar mount，session 未就绪）:
  - 移除 #read-topbar-placeholder
  - 渲染完整 Topbar 壳
  - isAuthor = false（session 未加载）
  - tablist: Page tab + (hasSidePage ? Side tab)（无 Settings tab）
  - Settings tab 会在 session 就绪后出现（如果 isAuthor）

阶段 B（session 加载完成，~50-200ms 后）:
  - isAuthor = session.userSlug === urlUserSlug
  - 如果 isAuthor → Settings tab 出现（tablist 更新，但无 CLS——tab 区域为 absolute 居中）
  - 如果是 ?tab=settings 且非作者 → redirect 到 ?tab=read
```

---

## 六、Schema 变更

### 6.1 新增 `authorSlug` 列（三步迁移）

```sql
-- Step 1: 添加可空列（不影响现有读写）
ALTER TABLE published_pages ADD COLUMN author_slug text;

-- Step 2: 回填历史数据
UPDATE published_pages
SET author_slug = (
  SELECT user_slug FROM users WHERE users.id = published_pages.user_id
);

-- Step 3: 确认回填无遗漏后，加 NOT NULL + 唯一索引
-- SELECT count(*) FROM published_pages WHERE author_slug IS NULL; -- 应为 0

ALTER TABLE published_pages ALTER COLUMN author_slug SET NOT NULL;
CREATE UNIQUE INDEX published_pages_author_slug_uid_idx
  ON published_pages(author_slug, uid);
```

> 不可合并为一步。`NOT NULL DEFAULT ''` + 立即建唯一索引 → 多行空字符串违反唯一约束 → 迁移失败。

### 6.2 Drizzle Schema

```typescript
// lib/db/schema.ts — publishedPages 表新增

authorSlug: text('author_slug').notNull(),

// 在 table 第二个参数中新增索引
uniqueIndex('published_pages_author_slug_uid_idx').on(table.authorSlug, table.uid),
```

### 6.3 `getPublishedPageContext` 改造

```typescript
// lib/services/community.ts
import { cache } from "react"
import { and, eq } from "drizzle-orm"

export const getPublishedPageContext = cache(
  async (userSlug: string, pageId: string): Promise<PublicPageContext | null> => {
    const page = await db.query.publishedPages.findFirst({
      where: and(
        eq(publishedPages.authorSlug, userSlug),
        eq(publishedPages.uid, pageId),
      ),
    })
    if (!page) return null

    // author 信息从冗余字段构造，无需 JOIN users 表
    return {
      page,
      author: {
        id: page.userId,
        userSlug: page.authorSlug,
        displayName: page.authorName ?? "",
        avatarUrl: page.authorAvatarUrl ?? null,
        followersCount: 0,
      },
    }
  }
)
```

> `React.cache()` 确保同一 HTTP 请求内 `generateMetadata` 和 `PagePage` 共享缓存，不会重复查询。

---

## 七、API 设计

### 7.1 `GET /api/read/[user_slug]/[page_id]`

用于 react-query 缓存、预取、CDN 加速。单次 `authorSlug + uid` 复合索引查询。

```
Query params:
  ?fields=meta   → 仅元信息（不含 html），~300B，跳过 TOAST
  ?fields=html   → 仅 HTML
  ?fields=all    → 完整数据（默认）
```

### 7.2 实现

```typescript
// app/api/read/[user_slug]/[page_id]/route.ts
import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getOptionalSession } from "@/lib/auth/middleware"
import { db, publishedPages } from "@/lib/db"
import { canReadPage } from "@/lib/services/community"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ user_slug: string; page_id: string }> }
) {
  const { user_slug, page_id } = await params
  const { searchParams } = new URL(request.url)
  const fields = searchParams.get("fields") ?? "all"
  const session = await getOptionalSession(request)
  const t_start = Date.now()

  const needsHtml = fields === "html" || fields === "all"

  const columns = {
    id: publishedPages.id, uid: publishedPages.uid,
    userId: publishedPages.userId, title: publishedPages.title,
    description: publishedPages.description,
    ...(needsHtml ? { html: publishedPages.html } : {}),
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
  }

  const rows = await db
    .select(columns)
    .from(publishedPages)
    .where(and(
      eq(publishedPages.authorSlug, user_slug),
      eq(publishedPages.uid, page_id),
    ))
    .limit(1)

  const t_db = Date.now()

  if (!rows.length || !canReadPage(rows[0] as any, session)) {
    return NextResponse.json({ error: { code: "not_found" } }, { status: 404 })
  }

  const p = rows[0]
  const isPublic = p.visibility === "public" && p.moderationStatus === "approved"

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

  const data = fields === "meta" ? { meta }
    : fields === "html" ? { html: (p as any).html }
    : { html: (p as any).html, meta }

  const response = NextResponse.json(data)

  // 缓存策略
  response.headers.set(
    "Cache-Control",
    isPublic
      ? "public, max-age=0, s-maxage=300, stale-while-revalidate=86400, must-revalidate"
      : "private, no-cache, no-store, must-revalidate"
  )
  response.headers.set("Vary", "Cookie, Accept-Encoding")
  response.headers.set("ETag", `"${p.uid}"`)

  // 日志
  const t_total = Date.now() - t_start
  const cacheStatus = request.headers.get("x-vercel-cache") ?? "MISS"

  console.log("[perf] api_read", JSON.stringify({
    db_ms: t_db - t_start,
    total_ms: t_total,
    fields,
    cache_status: cacheStatus,
    is_public: isPublic,
    page_id: `${user_slug}/${page_id}`,
  }))

  return response
}
```

### 7.3 CDN 缓存策略

| 指令 | 作用 |
|------|------|
| `max-age=0` | 浏览器每次重新请求 |
| `s-maxage=300` | CDN 缓存 5 分钟 |
| `stale-while-revalidate=86400` | CDN 过期后后台刷新 |
| `must-revalidate` | swr 窗口过期后必须回源 |
| `Vary: Cookie` | 登录/未登录缓存隔离 |

**缓存失效**：公开页面发布更新后最多有 5 分钟的 CDN 延迟。接受此延迟——公开页面更新不频繁，5 分钟可接受。发布时显示"更新将在几分钟内生效"。

### 7.4 已有 API（不变）

| 端点 | 用途 |
|------|------|
| `GET /api/community/entities/summary` | 互动数据 |
| `GET /api/community/comments` | 评论列表 |
| `POST /api/community/comments` | 发表评论 |
| `POST /api/community/reactions/toggle` | 点赞 |
| `POST /api/community/bookmarks/toggle` | 收藏 |

---

## 八、快速路由判定

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
  if (first.startsWith("@")) return { isPage: false }
  if (isReservedSlug(first)) return { isPage: false }
  if (!second) return { isPage: false }
  return { isPage: true, userSlug: decodeURIComponent(first), pageId: decodeURIComponent(second) }
}
```

`RESERVED_SLUGS` 在 `lib/utils/user-slug.ts` 中维护，覆盖 `(dashboard)` 全部顶级路由。

---

## 九、懒加载体系

| 组件 | 方式 | 触发时机 |
|------|------|---------|
| `ReadTopbarInner` | `dynamic(ssr:false)` | 第二帧：正文渲染后，JS bundle 加载完成 |
| Drawer tabs (PageMeta, CommentsPanel, NotesPanel) | `dynamic(ssr:false)` | 抽屉首次打开 |
| `PageSettingsPanel` | `dynamic(ssr:false)` | 作者点击 Settings tab |
| `ReportDialog`, `FeedbackDialog` | `dynamic(ssr:false)` | 用户点击"更多"菜单 |
| `GlobalSearch` | 阅读页不需要 | 仅 `(dashboard)` 加载 |

### Drawer 面板

```typescript
// components/layout/read-drawer.tsx
import dynamic from "next/dynamic"

const LazyPageMeta = dynamic(
  () => import("@/components/content/page-meta").then(m => ({ default: m.PageMeta })),
  { ssr: false, loading: () => <div className="animate-pulse h-64 rounded-lg bg-muted/30 mx-3" /> }
)
const LazyCommentsPanel = dynamic(
  () => import("@/components/content/comments-panel").then(m => ({ default: m.CommentsPanel })),
  { ssr: false, loading: () => <div className="animate-pulse h-64 rounded-lg bg-muted/30 mx-3" /> }
)
const LazyNotesPanel = dynamic(
  () => import("@/components/content/notes-panel").then(m => ({ default: m.NotesPanel })),
  { ssr: false, loading: () => <div className="animate-pulse h-64 rounded-lg bg-muted/30 mx-3" /> }
)
```

Drawer shell（滑出面板框架）保持非懒加载——CSS transition 打开即时响应。仅 tab 内容被懒加载。

### ReadMoreMenu

```tsx
// components/pages/read-more-menu.tsx （从旧 topbar.tsx 抽离）

const ReportDialog = dynamic(
  () => import("@/components/content/report-dialog").then(m => ({ default: m.ReportDialog })),
  { ssr: false }
)
const FeedbackDialog = dynamic(
  () => import("@/components/content/feedback-dialog").then(m => ({ default: m.FeedbackDialog })),
  { ssr: false }
)
```

---

## 十、监控

### 10.1 安装

```bash
cd apps/web && pnpm add @vercel/analytics @vercel/speed-insights
```

### 10.2 RootLayout 集成

```tsx
// app/layout.tsx
import { Analytics } from "@vercel/analytics/react"
import { SpeedInsights } from "@vercel/speed-insights/next"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${crimsonPro.variable} font-sans`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <I18nProvider>
            <QueryProvider>
              {children}
            </QueryProvider>
          </I18nProvider>
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
```

### 10.3 自定义埋点

全部使用 `[perf]` 前缀，服务端 `after()` 零延迟，客户端 `useEffect` 一次性。

| 位置 | Category | 关键字段 |
|------|----------|---------|
| `page.tsx` T1 后 | `[perf] page_server` | `t1_ms`, `page_id`, `is_public`, `has_side_page` |
| API route | `[perf] api_read` | `db_ms`, `total_ms`, `cache_status`, `fields` |
| `ReadTopbarInner` session 就绪 | `[perf] topbar_ready` | `latency_ms`, `is_author`, `has_side_page`, `session_loaded` |
| iframe onLoad | `[perf] iframe_render` | `load_ms`, `page_id` |

### 10.4 验证阈值

| 指标 | 来源 | 目标 (p75) | 告警 |
|------|------|-----------|------|
| `t1_ms` | `[perf] page_server` | < 30ms | > 80ms |
| `topbar_ready` latency | `[perf] topbar_ready` | < 500ms | > 1s |
| LCP（阅读页） | Speed Insights | < 1.5s | > 2.5s |
| CDN hit rate | `[perf] api_read` | > 70% | < 40% |

---

## 十一、补充优化

| # | 优化 | 工作量 | 收益 |
|---|------|--------|------|
| 1 | `preconnect` avatars.githubusercontent.com | 1 行 | 头像 TLS 省 50-100ms |
| 2 | `optimizePackageImports: ['lucide-react']` | 1 行配置 | JS -5-10KB |
| 3 | 评论/摘要 API 加 CDN 缓存 (`s-maxage=60`) | header 行 | 流量高峰 DB 负载降 |
| 4 | Neon 保温 cron（每 4 分钟 `SELECT 1`） | 1 个 cron | 消除 500ms-2s 冷启动 |
| 5 | react-query 缓存排除 `html`（只存 meta） | 配置项 | 移动端省 100-200KB 内存 |
| 6 | 103 Early Hints 预加载关键 JS | 配置 | 首访省 100-300ms |

---

## 十二、文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| **Route Group** | | |
| `app/(read)/layout.tsx` | **新增** | 最简布局 + DrawerProvider |
| `app/(read)/[user_slug]/[page_id]/page.tsx` | **新增** | 正文优先流式 |
| `app/(read)/[user_slug]/[page_id]/loading.tsx` | **新增** | 正文区域骨架屏 |
| `app/(dashboard)/[user_slug]/[page_id]/page.tsx` | 保留 | fallback，后续删除或 redirect |
| **Schema** | | |
| `lib/db/schema.ts` | 修改 | `authorSlug` + 唯一索引 |
| **Services** | | |
| `lib/services/community.ts` | 修改 | `getPublishedPageContext` 单查询 + `React.cache()` |
| **API** | | |
| `app/api/read/[user_slug]/[page_id]/route.ts` | **新增** | `?fields=meta/html/all` |
| **路由** | | |
| `lib/navigation/page-route.ts` | **新增** | `isPublishedPageRoute()` |
| **Topbar** | | |
| `components/layout/read-topbar.tsx` | **新增** | dynamic wrapper |
| `components/layout/read-topbar-inner.tsx` | **新增** | 完整实现（~350 行） |
| `components/pages/read-more-menu.tsx` | **新增** | 从旧 topbar.tsx 抽离 |
| **Drawer** | | |
| `components/layout/read-drawer.tsx` | 修改 | `next/dynamic` tab 内容 |
| **Hooks** | | |
| `hooks/use-read-mode.ts` | **删除** | 不再需要 |
| `hooks/use-prefetch-drawer-tabs.ts` | **新增** | 预加载 |
| `hooks/use-page-data.ts` | **新增** | react-query hook |
| **监控** | | |
| `app/layout.tsx` | 修改 | `<Analytics />` + `<SpeedInsights />` + `preconnect` |
| `next.config.ts` | 修改 | `optimizePackageImports` |
| `package.json` | 修改 | `@vercel/analytics` `@vercel/speed-insights` |
| **删除** | | |
| `components/pages/read-page-client.tsx` | **删除** | 逻辑并入 page.tsx + ReadTopbarInner |

---

## 十三、实施步骤

### Phase 1：基础设施

1. Schema 三步迁移
2. `getPublishedPageContext`：单查询 + `React.cache()`
3. `isPublishedPageRoute()` + 测试
4. `GET /api/read/[user_slug]/[page_id]` API

### Phase 2：Route Group

5. 创建 `app/(read)/layout.tsx` + `loading.tsx`
6. 创建 `app/(read)/[user_slug]/[page_id]/page.tsx`
7. 保留 `(dashboard)` 旧文件作为 fallback

### Phase 3：ReadTopbar

8. `read-more-menu.tsx` 抽离
9. `read-topbar.tsx` + `read-topbar-inner.tsx`
10. 删除 `hooks/use-read-mode.ts`

### Phase 4：懒加载

11. `read-drawer.tsx`：`next/dynamic`
12. `PageSettingsPanel`：`next/dynamic`
13. `use-prefetch-drawer-tabs.ts` + `use-page-data.ts`

### Phase 5：监控 + 优化

14. `@vercel/analytics` + `@vercel/speed-insights`
15. `[perf]` 埋点
16. `preconnect` + `optimizePackageImports`

### Phase 6：验证

17. `cd apps/web && pnpm typecheck`
18. 回归矩阵：

| 场景 | 检查点 |
|------|--------|
| 冷加载公开页面 | 正文先于 Topbar 出现；Topbar 占位条无 CLS |
| 冷加载 + CDN 命中 | TTFB < 50ms |
| 后退/前进 | 瞬时恢复 |
| Settings tab | session 加载后正确出现/redirect |
| 沉浸模式 | 进入/退出正常；Escape 正常 |
| 抽屉面板 | 打开动画流畅；首次打开有骨架屏 |
| `(dashboard)` 页面 | 完全不受影响 |
| 面包屑 | 标签首帧正确不闪烁 |

---

## 十四、性能对比

| 指标 | 重构前 | v3 |
|------|--------|-----|
| 服务端 TTFB | ~75-270ms（6 串行） | **~10-30ms**（1 次查询） |
| 正文可见 | ~590-2300ms | **~50-200ms**（第一帧） |
| Topbar 就绪 | ~530-2200ms | **~200-500ms**（第二帧） |
| Topbar 阻塞正文？ | 是 | **否**（正文先到，Topbar 后叠加） |
| 面包屑闪烁 | 有 | **无**（`__viben_page_meta` 0ms） |
| 后退/前进 | 同首访 | **0ms**（react-query + bfcache） |
| CDN 缓存 | 不支持 | **TTFB < 50ms**（公开页） |
| JS Bundle（阅读页） | 全量 | **-80-120KB** |

### 场景详解

```
场景 A：首次访问公开页面
  当前: 75-270ms(6串行DB) + 网络 + JS + session fetch = 575ms-2.2s
  v3:  10-30ms(1次DB) → 第一帧正文 ~50-200ms → 第二帧 Topbar ~200-500ms

场景 B：CDN 命中
  v3:  边缘缓存 < 50ms → 正文 < 100ms

场景 C：后退（热加载）
  v3:  0ms（react-query + bfcache）
```

---

## 十五、风险

1. **Schema 三步必须按顺序**：可空 → 回填 → NOT NULL + 索引。不可合并。
2. **`(read)` 和 `(dashboard)` 同路径冲突**：Next.js 对两个 route group 有同一路径的行为未定义。需在 middleware 或通过路由优先级解决。保留旧文件期间，可临时用 middleware rewrite 控制流向。
3. **Session 第二帧加载**：`isAuthor` 在 session 就绪前为 false → Settings tab 初始不显示。session 就绪后 tablist 更新，Settings tab 出现在 absolute 居中的 tab 区域，不产生 CLS。
4. **Settings tab 首帧渲染**：`?tab=settings` 时首帧渲染 Settings 面板（未校验 isAuthor）。如果非作者访问此 URL，在第二帧 session 就绪后 client-side redirect 回 `?tab=read`。窗口期约 50-200ms，Settings 面板会短暂闪现。不影响正文阅读场景（`?tab=read` 是默认）。
5. **DrawerProvider 独立**：`(read)` layout 有自己的 `DrawerProvider`，与 `(dashboard)` 的 drawer 状态隔离。同一用户在不同 tab 中打开阅读页和 dashboard 页，drawer 状态独立——这是期望行为。
6. **`window.__viben_page_meta`**：作为服务端到客户端的最短路径。不替代 react-query，仅用于初始渲染。
7. **CDN 缓存 5 分钟延迟**：公开页面更新后最多延迟 5 分钟。接受此 tradeoff。

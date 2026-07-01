# Read Page 重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构阅读页面加载链路——正文通过 Suspense 流式优先输出（第一帧 ~50-200ms），Topbar 通过 URL 自判定模式（0ms），session 异步第二帧填充。

**Architecture:** 保留 `(dashboard)` route group，不改 layout 结构。page.tsx 仅阻塞 1 次 DB 查询（T1），正文通过 Suspense 流式立即输出。Topbar 通过 `isPublishedPageRoute()` 同步判定阅读模式，`centerContent`/`rightContent` 插槽化。Drawer/Settings 懒加载。新增 `GET /api/read/[user_slug]/[page_id]` 提供 react-query 缓存层 + CDN 加速。

**Tech Stack:** Next.js App Router, Drizzle ORM, PostgreSQL (Neon), react-query, next/dynamic, @vercel/analytics, @vercel/speed-insights

**Spec:** `apps/web/docs/specs/read-page-refactor-v4.md`

## Global Constraints

- 编辑文件时使用绝对路径
- API query params / file storage 使用 snake_case
- 禁止 `import("path").Type` 内联导入，使用显式 `import type { ... } from "..."` 
- 禁止 `= await import()` 动态导入，使用静态 import
- 禁止 `hsl()` 包裹 oklch CSS 变量
- Tailwind v4：`data-*` 变体在 CVA 中不可靠，使用 `className` 条件性传入
- build/typecheck 仅限 `cd apps/web && pnpm typecheck`，禁止根目录 `pnpm build`
- `apps/web` 是唯一修改范围，其他 package 不动

---


## Phase 1: Schema Migration

### Task 1.1: Add authorSlug column (nullable)

**Files:**
- Modify: `D:\Document\Github\LinXueyuanStdio\viben\apps\web\lib\db\schema.ts`

**Interfaces:**
- Produces: `publishedPages.authorSlug: text('author_slug')` — nullable column, no default

- [ ] **Step 1: Add column to schema**

In `lib/db/schema.ts`, find the `publishedPages` table definition (around line 685). Add after `authorAvatarUrl`:

```typescript
authorSlug: text('author_slug'),
```

- [ ] **Step 2: Push schema to database**

```bash
cd apps/web && pnpm db:push
```

Confirm the column is added (nullable). Interactive prompt: approve the change.

- [ ] **Step 3: Verify column exists**

```bash
cd apps/web && pnpm db:studio
```

Open Drizzle Studio, check `published_pages` table has `author_slug` column (NULL values).

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/db/schema.ts
git commit -m "feat: add authorSlug column to publishedPages (nullable)"
```

---

### Task 1.2: Backfill authorSlug data

**Files:**
- Create: `D:\Document\Github\LinXueyuanStdio\viben\apps\web\lib\db\migrations\backfill-author-slug.sql`

- [ ] **Step 1: Create backfill SQL**

```sql
UPDATE published_pages
SET author_slug = (
  SELECT user_slug FROM users WHERE users.id = published_pages.user_id
)
WHERE author_slug IS NULL;
```

- [ ] **Step 2: Run backfill**

Execute the SQL against the database. Verify:

```sql
SELECT count(*) FROM published_pages WHERE author_slug IS NULL;
-- Expected: 0
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/db/migrations/backfill-author-slug.sql
git commit -m "chore: backfill authorSlug from users table"
```

---

### Task 1.3: Add NOT NULL constraint + unique index

**Files:**
- Modify: `D:\Document\Github\LinXueyuanStdio\viben\apps\web\lib\db\schema.ts`

**Interfaces:**
- Produces: `publishedPages.authorSlug: text('author_slug').notNull()` with unique index `published_pages_author_slug_uid_idx`

- [ ] **Step 1: Add NOT NULL and unique index to schema**

In `lib/db/schema.ts`, update the `authorSlug` column to add `.notNull()`:

```typescript
authorSlug: text('author_slug').notNull(),
```

In the table's second argument (index array, around line 737), add:

```typescript
uniqueIndex('published_pages_author_slug_uid_idx').on(table.authorSlug, table.uid),
```

- [ ] **Step 2: Push schema to database**

```bash
cd apps/web && pnpm db:push
```

Interactive prompt: approve the NOT NULL constraint and unique index.

- [ ] **Step 3: Verify with typecheck**

```bash
cd apps/web && pnpm typecheck
```

Expected: no type errors related to `authorSlug`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/db/schema.ts
git commit -m "feat: add NOT NULL + unique index on publishedPages.authorSlug"
```

---

## Phase 2: Services + Navigation

### Task 2.1: Update getPublishedPageContext to single query

**Files:**
- Modify: `D:\Document\Github\LinXueyuanStdio\viben\apps\web\lib\services\community.ts`

**Interfaces:**
- Consumes: `publishedPages.authorSlug` (Task 1.3)
- Produces: `getPublishedPageContext(userSlug, pageId)` — single query via `authorSlug + uid`, wrapped with `React.cache()`

- [ ] **Step 1: Rewrite getPublishedPageContext**

Replace the existing function (lines 121-138) with:

```typescript
import { cache } from "react"

export const getPublishedPageContext = cache(
  async (userSlug: string, pageId: string): Promise<PublicPageContext | null> => {
    const page = await db.query.publishedPages.findFirst({
      where: and(
        eq(publishedPages.authorSlug, userSlug),
        eq(publishedPages.uid, pageId),
      ),
    })
    if (!page) return null

    const author = await db.query.users.findFirst({
      where: eq(users.id, page.userId),
    })
    if (!author) return null

    return { page, author }
  }
)
```

> Note: Author lookup via `userId` is still needed for `followersCount` and other user-specific fields not denormalized on `publishedPages`. This uses the existing `userId` index (fast, ~1ms). The key optimization is eliminating the initial `users.findFirst({ userSlug })` query.

- [ ] **Step 2: Verify typecheck**

```bash
cd apps/web && pnpm typecheck
```

Expected: no type errors. `React.cache()` signature compatible with existing callers.

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/services/community.ts
git commit -m "perf: getPublishedPageContext uses authorSlug single query + React.cache()"
```

---

### Task 2.2: Create isPublishedPageRoute utility

**Files:**
- Create: `D:\Document\Github\LinXueyuanStdio\viben\apps\web\lib\navigation\page-route.ts`

**Interfaces:**
- Produces: `isPublishedPageRoute(pathname: string): { isPage: boolean; userSlug?: string; pageId?: string }`

- [ ] **Step 1: Create the utility**

```typescript
// lib/navigation/page-route.ts

import { isReservedSlug } from "@/lib/utils/user-slug"

/**
 * 通过 URL pathname 同步判定是否为 published page 路由。
 * 0ms，客户端首帧执行，无需服务端数据。
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

  // @ 前缀不是 userSlug
  if (first.startsWith("@")) return { isPage: false }

  // 保留词不可能是 userSlug（case-insensitive）
  if (isReservedSlug(first)) return { isPage: false }

  if (!second) return { isPage: false }

  return { isPage: true, userSlug: decodeURIComponent(first), pageId: decodeURIComponent(second) }
}
```

- [ ] **Step 2: Verify typecheck**

```bash
cd apps/web && pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/navigation/page-route.ts
git commit -m "feat: add isPublishedPageRoute for 0ms URL-based route detection"
```

---

### Task 2.3: Audit RESERVED_SLUGS

**Files:**
- Modify: `D:\Document\Github\LinXueyuanStdio\viben\apps\web\lib\utils\user-slug.ts`

- [ ] **Step 1: Verify all (dashboard) top-level routes are in RESERVED_SLUGS**

Check against routes in `D:\Document\Github\LinXueyuanStdio\viben\apps\web\app\(dashboard)\`:

```bash
ls "D:/Document/Github/LinXueyuanStdio/viben/apps/web/app/(dashboard)/"
```

Current `RESERVED_SLUGS` in `user-slug.ts` already includes: `settings`, `admin`, `search`, `tags`, `category`, `collections`, `history`, `notifications`, `moment`, `leaderboard`, `mcp-market`, `skill-market`, `publish`, `my-packages`, `analytics`, `author`, `profile`.

Cross-reference with directory listing. Add any missing routes.

- [ ] **Step 2: If missing routes found, add them**

Example: if `code-stats` is a top-level dashboard route but missing from RESERVED_SLUGS:

```typescript
// Add to the RESERVED_SLUGS array:
'code-stats',
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/utils/user-slug.ts
git commit -m "fix: audit RESERVED_SLUGS against (dashboard) routes"
```

---


## Phase 3: API Endpoint

### Task 3.1: Create GET /api/read/[user_slug]/[page_id]

**Files:**
- Create: `D:\Document\Github\LinXueyuanStdio\viben\apps\web\app\api\read\[user_slug]\[page_id]\route.ts`

**Interfaces:**
- Produces: `GET /api/read/[user_slug]/[page_id]?fields=meta|html|all` with CDN cache headers

- [ ] **Step 1: Create directory**

```bash
mkdir -p "D:/Document/Github/LinXueyuanStdio/viben/apps/web/app/api/read/[user_slug]/[page_id]"
```

- [ ] **Step 2: Write route handler**

Create `route.ts` with GET handler that:
1. Reads `user_slug` and `page_id` from params
2. Reads `fields` query param (default "all")
3. Gets optional session via `getOptionalSession(request)`
4. Queries `publishedPages` via `authorSlug + uid` composite index
5. When `fields=meta`, skips `html` column (avoids TOAST read, saves 5-15ms)
6. Returns JSON with `Cache-Control` header: public pages get `s-maxage=300, stale-while-revalidate=86400`, private pages get `no-cache, no-store`
7. Sets `Vary: Cookie, Accept-Encoding` and `ETag` headers

See spec Section 7.2 for full implementation.

- [ ] **Step 3: Verify typecheck**

```bash
cd apps/web && pnpm typecheck
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/api/read/
git commit -m "feat: add GET /api/read/[userSlug]/[pageId] with CDN caching"
```

---

### Task 3.2: Create usePageData react-query hook

**Files:**
- Create: `D:\Document\Github\LinXueyuanStdio\viben\apps\web\hooks\use-page-data.ts`

**Interfaces:**
- Produces: `usePageData(userSlug, pageId, fields)` — wraps `/api/read/...` with react-query, `staleTime: 120_000` for meta, `300_000` for html

- [ ] **Step 1: Write hook**

```typescript
// hooks/use-page-data.ts
import { useQuery } from "@tanstack/react-query"

export function usePageData(
  userSlug: string,
  pageId: string,
  fields: "meta" | "html" | "all" = "meta"
) {
  return useQuery({
    queryKey: ["page-data", userSlug, pageId, fields],
    queryFn: async () => {
      const res = await fetch(
        `/api/read/${encodeURIComponent(userSlug)}/${encodeURIComponent(pageId)}?fields=${fields}`
      )
      if (!res.ok) throw new Error("Page not found")
      return res.json()
    },
    staleTime: fields === "meta" ? 120_000 : 300_000,
    gcTime: 10 * 60_000,
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/hooks/use-page-data.ts
git commit -m "feat: add usePageData react-query hook"
```

---

## Phase 4: Topbar Refactoring

### Task 4.1: Create TopbarSlotContext

**Files:**
- Create: `D:\Document\Github\LinXueyuanStdio\viben\apps\web\components\layout\topbar-slots.tsx`

- [ ] **Step 1: Write context**

```typescript
// components/layout/topbar-slots.tsx
"use client"

import * as React from "react"
import type { ReactNode } from "react"

export interface TopbarSlots {
  centerContent?: ReactNode
  rightContent?: ReactNode
  hasSidePage?: boolean
}

const TopbarSlotContext = React.createContext<TopbarSlots | null>(null)

export function TopbarSlotProvider({ value, children }: { value: TopbarSlots; children: ReactNode }) {
  const memoValue = React.useMemo(
    () => value,
    [value.centerContent, value.rightContent, value.hasSidePage]
  )
  return (
    <TopbarSlotContext.Provider value={memoValue}>
      {children}
    </TopbarSlotContext.Provider>
  )
}

export function useTopbarSlots(): TopbarSlots | null {
  return React.useContext(TopbarSlotContext)
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/layout/topbar-slots.tsx
git commit -m "feat: add TopbarSlotContext"
```

---

### Task 4.2: Add slots + URL detection to Topbar

**Files:**
- Modify: `D:\Document\Github\LinXueyuanStdio\viben\apps\web\components\layout\topbar.tsx`

**Interfaces:**
- Consumes: `isPublishedPageRoute` (Task 2.2), `useTopbarSlots` (Task 4.1)
- Produces: Updated `TopbarProps` with `centerContent?: ReactNode`, `rightContent?: ReactNode`

- [ ] **Step 1: Add imports**

Add to top of `topbar.tsx`:
```typescript
import { isPublishedPageRoute } from "@/lib/navigation/page-route"
import { useTopbarSlots } from "./topbar-slots"
```

- [ ] **Step 2: Update TopbarProps interface**

Add `centerContent` and `rightContent` to the interface:
```typescript
interface TopbarProps {
  // ... existing ...
  centerContent?: React.ReactNode
  rightContent?: React.ReactNode
}
```

- [ ] **Step 3: Add URL detection in component body**

```typescript
const { isPage: isReadPageFromUrl, userSlug: urlUserSlug, pageId: urlPageId } =
  isPublishedPageRoute(pathname)
const topbarSlots = useTopbarSlots()
const isAuthor = isReadPageFromUrl && session?.userSlug === urlUserSlug
```

- [ ] **Step 4: Update center rendering**

Use `topbarSlots?.centerContent ?? centerContent` before falling back to default tablist/GlobalSearch. The tablist uses `topbarSlots?.hasSidePage` and `isAuthor` (from URL) instead of MutationObserver-derived state.

- [ ] **Step 5: Update right rendering**

Use `rightContent ?? topbarSlots?.rightContent` before falling back to default. In read mode, default is drawer/immersive/ReadMoreMenu (no session needed). In non-read mode, default is notification/history/UserMenu.

- [ ] **Step 6: Verify typecheck + behavior**

```bash
cd apps/web && pnpm typecheck
```

Manual test: open a non-read dashboard page, verify Topbar still works (GlobalSearch, UserMenu, notifications). Slots are null → fallback to existing behavior.

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/layout/topbar.tsx
git commit -m "feat: add centerContent/rightContent slots + URL-based read mode to Topbar"
```

---

### Task 4.3: Extract ReadMoreMenu

**Files:**
- Create: `D:\Document\Github\LinXueyuanStdio\viben\apps\web\components\pages\read-more-menu.tsx`
- Modify: `D:\Document\Github\LinXueyuanStdio\viben\apps\web\components\layout\topbar.tsx`

- [ ] **Step 1: Create ReadMoreMenu component**

New file at `components/pages/read-more-menu.tsx` with:
- Props: `{ pageId: string; userSlug: string }`
- `ReportDialog` and `FeedbackDialog` imported via `dynamic(() => import(...), { ssr: false })`
- Same dropdown UI as existing inline version

- [ ] **Step 2: Replace inline usage in topbar.tsx**

Remove the local `function ReadMoreMenu()` definition (lines 278-338). Import from new file. Update usage to pass `pageId={urlPageId} userSlug={urlUserSlug}`.

- [ ] **Step 3: Remove unused imports**

Remove `Flag`, `MessageSquare`, `MoreHorizontal` from lucide-react import. Remove `ReportDialog`, `FeedbackDialog` imports.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/pages/read-more-menu.tsx apps/web/components/layout/topbar.tsx
git commit -m "refactor: extract ReadMoreMenu, dynamic import dialogs"
```

---

### Task 4.4: Remove MutationObserver + useReadPageMode

**Files:**
- Modify: `D:\Document\Github\LinXueyuanStdio\viben\apps\web\components\layout\topbar.tsx`

- [ ] **Step 1: Remove MutationObserver effects**

Delete:
- Lines 107-122: MutationObserver watching `data-read-has-side-page` / `data-read-has-settings`
- Lines 124-128: Effect setting `data-read-active-tab`
- Lines 52-54: `readHasSidePage`, `readHasSettings`, `sideActive` state declarations

- [ ] **Step 2: Simplify tab switching**

Replace `handleReadTabChange` with `router.replace` version (no `sideActive` state). Side tab is now managed through TopbarSlotContext.

- [ ] **Step 3: Remove useReadPageMode import**

Remove line 10: `import { useReadPageMode } from "@/hooks/use-read-mode"`

Remove the `readHasPageMode` variable usage.

- [ ] **Step 4: Update app-shell.tsx**

`app-shell.tsx` line 55 uses `useReadPageMode()`. Remove:
```typescript
const readHasPageMode = useReadPageMode()
const isRead = getTopbarMode(pathname, searchParams) === "read" || readHasPageMode
```
Replace with:
```typescript
const isRead = getTopbarMode(pathname, searchParams) === "read"
```
(Read mode detection is now handled inside Topbar itself via URL.)

Also remove the import of `useReadPageMode`.

- [ ] **Step 5: Verify typecheck**

```bash
cd apps/web && pnpm typecheck
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/layout/topbar.tsx apps/web/components/layout/app-shell.tsx
git commit -m "refactor: remove MutationObserver + useReadPageMode, use URL-based detection"
```

---

## Phase 5: ReadPageShell + page.tsx

### Task 5.1: Create ReadPageShell

**Files:**
- Create: `D:\Document\Github\LinXueyuanStdio\viben\apps\web\components\pages\read-page-shell.tsx`

**Interfaces:**
- Consumes: `TopbarSlotProvider` (Task 4.1)
- Produces: `ReadPageShell` — wraps children with TopbarSlotProvider, manages tab state, triggers prefetch

- [ ] **Step 1: Write component**

```typescript
// components/pages/read-page-shell.tsx
"use client"

import * as React from "react"
import { useRouter, usePathname } from "next/navigation"
import { TopbarSlotProvider } from "@/components/layout/topbar-slots"

interface ReadPageShellProps {
  userSlug: string
  pageId: string
  hasSidePage: boolean
  activeTab: string
  children: React.ReactNode
}

export function ReadPageShell({
  userSlug,
  pageId,
  hasSidePage,
  activeTab: initialTab,
  children,
}: ReadPageShellProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [activeTab, setActiveTab] = React.useState(initialTab)

  const handleTabChange = React.useCallback((value: string) => {
    setActiveTab(value)
    const tab = value === "read" ? "read" : value
    router.replace(`${pathname}?tab=${tab}`, { scroll: false })
  }, [router, pathname])

  // Only hasSidePage needs to be passed to Topbar; isAuthor comes from URL+session inside Topbar
  const slots = React.useMemo(() => ({
    hasSidePage,
  }), [hasSidePage])

  return (
    <TopbarSlotProvider value={slots}>
      {children}
    </TopbarSlotProvider>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/pages/read-page-shell.tsx
git commit -m "feat: add ReadPageShell with TopbarSlotProvider"
```

---

### Task 5.2: Update page.tsx for T1-only blocking + Suspense streaming

**Files:**
- Modify: `D:\Document\Github\LinXueyuanStdio\viben\apps\web\app\(dashboard)\[user_slug]\[page_id]\page.tsx`

**Interfaces:**
- Consumes: `ReadPageShell` (Task 5.1), `getPublishedPageContext` (Task 2.1)

- [ ] **Step 1: Restructure data fetching**

Keep `getSession()` and `getPublishedPageContext()` as the only blocking awaits. Move `getCommunitySummary()`, `ensureCommunityEntityForPage()`, `listCommunityComments()`, and recommendations query into separate async components wrapped in `<Suspense>`.

- [ ] **Step 2: Wrap page with ReadPageShell**

```typescript
return (
  <ReadPageShell
    userSlug={user_slug}
    pageId={page_id}
    hasSidePage={!!ctx.page.sidePageUid}
    activeTab={activeTab}
  >
    {/* T1: iframe body renders immediately after T1 query */}
    <ReadPageClient ... />

    {/* T2: community summary, streamed via Suspense */}
    <Suspense fallback={null}>
      <CommunitySummaryLoader pageId={ctx.page.id} session={session} />
    </Suspense>

    {/* T3: initial comments, streamed via Suspense */}
    <Suspense fallback={null}>
      <InitialCommentsLoader pageId={ctx.page.id} session={session} />
    </Suspense>
  </ReadPageShell>
)
```

- [ ] **Step 3: Create T2/T3 async components**

Add `CommunitySummaryLoader` and `InitialCommentsLoader` as async server components in the same file. Each fetches its data and injects via `<script type="application/json">` tags.

- [ ] **Step 4: Verify typecheck**

```bash
cd apps/web && pnpm typecheck
```

- [ ] **Step 5: Manual test**

Visit a published page. Verify: page renders correctly, comments load (possibly delayed), community summary populates.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/\(dashboard\)/\[user_slug\]/\[page_id\]/page.tsx
git commit -m "perf: T1-only blocking, T2/T3 Suspense streaming in page.tsx"
```

---

## Phase 6: ReadPageClient Cleanup

### Task 6.1: Remove DOM attribute operations

**Files:**
- Modify: `D:\Document\Github\LinXueyuanStdio\viben\apps\web\components\pages\read-page-client.tsx`

- [ ] **Step 1: Remove data-attribute effects**

Delete the `useEffect` at lines 172-183 that sets `data-page-mode`, `data-read-has-side-page`, and `data-read-has-settings` attributes on `document.documentElement`.

- [ ] **Step 2: Remove unused imports**

If `React` is only used for `useMemo` and `useEffect`, keep `useMemo`. Remove the `useEffect` that was deleted.

- [ ] **Step 3: Verify typecheck**

```bash
cd apps/web && pnpm typecheck
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/pages/read-page-client.tsx
git commit -m "refactor: remove DOM attribute operations from ReadPageClient"
```

---

### Task 6.2: Delete use-read-mode hook

**Files:**
- Delete: `D:\Document\Github\LinXueyuanStdio\viben\apps\web\hooks\use-read-mode.ts`

- [ ] **Step 1: Delete file**

```bash
rm "D:/Document/Github/LinXueyuanStdio/viben/apps/web/hooks/use-read-mode.ts"
```

- [ ] **Step 2: Verify no remaining imports**

```bash
cd apps/web && grep -r "use-read-mode" --include="*.ts" --include="*.tsx" .
```

Expected: no results (all imports removed in Tasks 4.4 and 6.1).

- [ ] **Step 3: Commit**

```bash
git add apps/web/hooks/use-read-mode.ts
git commit -m "refactor: delete use-read-mode hook (replaced by URL detection)"
```

---

## Phase 7: Lazy Loading

### Task 7.1: Lazy load Drawer tab content

**Files:**
- Modify: `D:\Document\Github\LinXueyuanStdio\viben\apps\web\components\layout\read-drawer.tsx`

- [ ] **Step 1: Replace direct imports with dynamic**

Replace `import { PageMeta } from "@/components/content/page-meta"` etc. with:

```typescript
import dynamic from "next/dynamic"

const LazyPageMeta = dynamic(
  () => import("@/components/content/page-meta").then(m => ({ default: m.PageMeta })),
  { ssr: false, loading: () => <div className="animate-pulse h-64 rounded-lg bg-muted/30 mx-3" /> }
)
```

Do the same for `CommentsPanel` and `NotesPanel`.

- [ ] **Step 2: Update tab rendering**

Change tab content from pre-built JSX to conditional rendering with lazy components in `<Suspense>`.

- [ ] **Step 3: Verify typecheck**

```bash
cd apps/web && pnpm typecheck
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/layout/read-drawer.tsx
git commit -m "perf: lazy load Drawer tab content with next/dynamic"
```

---

### Task 7.2: Lazy load PageSettingsPanel

**Files:**
- Modify: `D:\Document\Github\LinXueyuanStdio\viben\apps\web\components\pages\read-page-client.tsx`

- [ ] **Step 1: Replace direct import with dynamic**

```typescript
import dynamic from "next/dynamic"

const LazyPageSettingsPanel = dynamic(
  () => import("@/components/pages/page-settings-panel").then(m => ({ default: m.PageSettingsPanel })),
  { ssr: false, loading: () => <SettingsSkeleton /> }
)
```

- [ ] **Step 2: Update usage**

Replace `{settingsTab}` with `<LazyPageSettingsPanel ...props />`. Remove the `settingsTab` useMemo.

- [ ] **Step 3: Verify typecheck + commit**

```bash
cd apps/web && pnpm typecheck
git add apps/web/components/pages/read-page-client.tsx
git commit -m "perf: lazy load PageSettingsPanel"
```

---

### Task 7.3: Lazy load GlobalSearch in Topbar

**Files:**
- Modify: `D:\Document\Github\LinXueyuanStdio\viben\apps\web\components\layout\topbar.tsx`

- [ ] **Step 1: Replace direct import with dynamic**

```typescript
const GlobalSearch = dynamic(
  () => import("./global-search").then(m => ({ default: m.GlobalSearch })),
  { ssr: false }
)
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/layout/topbar.tsx
git commit -m "perf: lazy load GlobalSearch (not needed on read pages)"
```

---

## Phase 8: Hooks

### Task 8.1: Create usePrefetchDrawerTabs

**Files:**
- Create: `D:\Document\Github\LinXueyuanStdio\viben\apps\web\hooks\use-prefetch-drawer-tabs.ts`

- [ ] **Step 1: Write hook**

```typescript
// hooks/use-prefetch-drawer-tabs.ts
import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"

interface PrefetchInput {
  communityEntityId: string
  pageDbId: string
  pageUid: string
}

export function usePrefetchDrawerTabs({ communityEntityId, pageDbId, pageUid }: PrefetchInput) {
  const queryClient = useQueryClient()

  useEffect(() => {
    const idleId = requestIdleCallback?.(() => {
      queryClient.prefetchQuery({
        queryKey: ["page-comments", communityEntityId, pageDbId],
        queryFn: () =>
          fetch(`/api/community/comments?entity_type=published_page&entity_id=${communityEntityId}&limit=20`)
            .then(r => r.json()),
        staleTime: 60_000,
      })
      queryClient.prefetchQuery({
        queryKey: ["page-notes", pageUid],
        queryFn: () =>
          fetch(`/api/notes?page_id=${pageUid}`).then(r => r.json()),
        staleTime: 120_000,
      })
    })
    return () => { if (idleId) cancelIdleCallback(idleId) }
  }, [communityEntityId, pageDbId, pageUid, queryClient])
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/hooks/use-prefetch-drawer-tabs.ts
git commit -m "feat: add usePrefetchDrawerTabs hook"
```

---

## Phase 9: Monitoring

### Task 9.1: Install and integrate @vercel/analytics + @vercel/speed-insights

**Files:**
- Modify: `D:\Document\Github\LinXueyuanStdio\viben\apps\web\app\layout.tsx`
- Modify: `D:\Document\Github\LinXueyuanStdio\viben\apps\web\package.json`

- [ ] **Step 1: Install packages**

```bash
cd apps/web && pnpm add @vercel/analytics @vercel/speed-insights
```

- [ ] **Step 2: Add to RootLayout**

```tsx
// app/layout.tsx
import { Analytics } from "@vercel/analytics/react"
import { SpeedInsights } from "@vercel/speed-insights/next"

// Inside <body>, after {children} and <Toaster>:
<Analytics />
<SpeedInsights />
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/layout.tsx apps/web/package.json apps/web/pnpm-lock.yaml
git commit -m "feat: add Vercel Analytics + Speed Insights"
```

---

### Task 9.2: Add perf logging

**Files:**
- Modify: `D:\Document\Github\LinXueyuanStdio\viben\apps\web\app\(dashboard)\[user_slug]\[page_id]\page.tsx`
- Modify: `D:\Document\Github\LinXueyuanStdio\viben\apps\web\app\api\read\[user_slug]\[page_id]\route.ts`

- [ ] **Step 1: Add server-side perf log in page.tsx**

```typescript
import { after } from "next/server"

const t_start = Date.now()
const ctx = await getPublishedPageContext(user_slug, page_id)
const t_t1 = Date.now()

after(async () => {
  console.log("[perf] page_server", JSON.stringify({
    t1_ms: t_t1 - t_start,
    page_id: `${user_slug}/${page_id}`,
    is_public: ctx.page.visibility === "public",
    has_side_page: !!ctx.page.sidePageUid,
  }))
})
```

- [ ] **Step 2: Add API perf log in route.ts**

```typescript
const t_total = Date.now() - t_start
const cacheStatus = request.headers.get("x-vercel-cache") ?? "MISS"

console.log("[perf] api_read", JSON.stringify({
  db_ms: t_db - t_start,
  total_ms: t_total,
  cache_status: cacheStatus,
  fields,
  page_id: `${user_slug}/${page_id}`,
}))
```

- [ ] **Step 3: Add client-side perf log in ReadTopbarInner** (Task 4.x)

In `ReadTopbarInner`'s `useEffect` after session loads:

```typescript
console.log("[perf] topbar_ready", JSON.stringify({
  latency_ms: Math.round(performance.now()),
  pathname,
  is_author: isAuthor,
  has_side_page: hasSidePage,
  session_loaded: true,
}))
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(dashboard\)/\[user_slug\]/\[page_id\]/page.tsx \
        apps/web/app/api/read/\[user_slug\]/\[page_id\]/route.ts \
        apps/web/components/layout/read-topbar-inner.tsx
git commit -m "feat: add [perf] logging for page_server, api_read, topbar_ready"
```

---

## Phase 10: Supplementary Optimizations

### Task 10.1: Add preconnect for GitHub avatars

**Files:**
- Modify: `D:\Document\Github\LinXueyuanStdio\viben\apps\web\app\layout.tsx`

- [ ] **Step 1: Add preconnect link**

In the metadata export or as a direct `<link>` in the `<head>`:

```tsx
// Add to head in RootLayout
<link rel="preconnect" href="https://avatars.githubusercontent.com" crossOrigin="anonymous" />
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/layout.tsx
git commit -m "perf: add preconnect for GitHub avatars"
```

---

### Task 10.2: Add optimizePackageImports

**Files:**
- Modify: `D:\Document\Github\LinXueyuanStdio\viben\apps\web\next.config.ts`

- [ ] **Step 1: Add config**

```typescript
// next.config.ts
const nextConfig = {
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/next.config.ts
git commit -m "perf: add optimizePackageImports for lucide-react"
```

---

## Phase 11: Verification

### Task 11.1: Full typecheck

- [ ] **Step 1: Run typecheck**

```bash
cd apps/web && pnpm typecheck
```

Fix any type errors. Expected: clean pass.

---

### Task 11.2: Manual regression test

- [ ] **Step 1: Test read page cold load**

Visit a published page in incognito. Verify:
- Page HTML visible quickly (before full Topbar)
- Topbar shows correct read mode (tabs, drawer/immersive/more buttons)
- Breadcrumb shows author name + page title (not raw paths)
- Tab switching works (Page / Side / Settings)
- Immersive mode works (Escape to exit)
- Drawer opens/closes with animation
- Comments load in drawer
- Settings tab visible only for author

- [ ] **Step 2: Test non-read pages**

Visit dashboard home, settings, search. Verify Topbar still shows GlobalSearch, UserMenu, notifications.

- [ ] **Step 3: Test back/forward**

Navigate to a page, navigate away, press Back. Verify instant restore.

- [ ] **Step 4: Check Vercel Logs**

Search for `[perf]` in Vercel Logs. Verify `t1_ms` < 30ms, `topbar_ready` latency < 500ms.

---


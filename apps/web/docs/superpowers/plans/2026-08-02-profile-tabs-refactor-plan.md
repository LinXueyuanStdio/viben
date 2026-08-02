# 用户资料页面 Tab 重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构 `/{user_slug}` 用户资料页面：新增 MCP/技能 tab，深度重构 pages tab 为搜索+排序+分页+leaderboard 列表样式，合并 favorites 到 likes tab 并移除收藏/合集 tab。

**Architecture:** page.tsx 继续作为服务端组件负责初始数据获取（通过 searchParams 驱动分页/排序），各 tab 内容区使用客户端组件处理搜索输入和交互。抽取通用的 `ProfileContentItem`（leaderboard 列表项）复用组件给 pages/MCP/技能/likes 四个 tab。

**Tech Stack:** Next.js 15 (App Router), Drizzle ORM, React 19, Tailwind v4, Radix UI Tabs, Lucide Icons

## Global Constraints

- 编辑文件时使用绝对路径
- API 查询参数和存储使用 snake_case
- 禁止 inline import type 语法，使用显式 import 语句
- 禁止 `hsl()` 包裹 oklch CSS 变量
- Tailwind v4：`data-[state=active]:` 变体在 CVA 中不可靠
- 仅构建受影响包：`cd apps/web && pnpm typecheck`
- 数据库迁移：`cd apps/web && pnpm db:push`（需手动交互）

---

## 文件结构总览

| 操作 | 文件 | 职责 |
|------|------|------|
| 修改 | `apps/web/components/profile/profile-tabs.tsx` | Tab 定义：新增 MCP/技能，移除收藏/合集 |
| 新建 | `apps/web/components/profile/profile-content-item.tsx` | 通用 leaderboard 列表项组件 |
| 新建 | `apps/web/components/profile/profile-pages-list.tsx` | Pages tab 客户端组件（搜索+排序+分页） |
| 新建 | `apps/web/components/profile/profile-mcp-list.tsx` | MCP tab 客户端组件 |
| 新建 | `apps/web/components/profile/profile-skills-list.tsx` | 技能 tab 客户端组件 |
| 新建 | `apps/web/components/profile/profile-likes-merged.tsx` | 合并后的 likes tab（收藏区+喜欢区） |
| 修改 | `apps/web/app/(dashboard)/[user_slug]/page.tsx` | 数据获取+组装：新增 MCP/技能查询，调整 likes/favorites 查询 |

---

### Task 1: 创建通用 ProfileContentItem 组件

**Files:**
- Create: `apps/web/components/profile/profile-content-item.tsx`

**Interfaces:**
- Produces: `ProfileContentItem` 组件，接受 `ProfileContentItemData` props
- 供 Task 3/4/5/6 使用

**说明：** 基于 `RankItem` 组件改造，去掉排名数字列和评分列，保留封面图 | 标题+描述+作者+时间 | 统计。支持可选的更多菜单（⋯）插槽和删除操作。

- [ ] **Step 1: 创建组件文件，定义类型和组件**

```typescript
// apps/web/components/profile/profile-content-item.tsx
"use client"

import Link from "next/link"
import { Eye, ThumbsUp, MessageCircle, MoreHorizontal, Trash2 } from "lucide-react"
import { Cover } from "@/components/content/cover"
import { MetaRow } from "@/components/content/meta-row"
import { Stat } from "@/components/content/stats-row"
import { cn } from "@/lib/utils"
import { useState } from "react"

export interface ProfileContentItemData {
  coverUrl?: string | null
  title: string
  description?: string
  author: {
    name: string
    avatarUrl?: string
  }
  timeAgo?: string
  stats?: {
    views?: number
    likes?: number
    comments?: number
    downloads?: number
  }
  /** 类型标签，如 "MCP"、"技能"、"v1.0.0" */
  badges?: string[]
}

interface ProfileContentItemProps {
  data: ProfileContentItemData
  href?: string
  className?: string
  /** 更多菜单项，不传则不显示更多按钮 */
  moreMenuItems?: {
    label: string
    icon?: React.ReactNode
    onClick: () => void
    destructive?: boolean
  }[]
}

export function ProfileContentItem({ data, href, className, moreMenuItems }: ProfileContentItemProps) {
  const { coverUrl, title, description, author, timeAgo, stats, badges } = data
  const [menuOpen, setMenuOpen] = useState(false)
  const hasMenu = moreMenuItems && moreMenuItems.length > 0

  const inner = (
    <div
      className={cn(
        "grid gap-2.5 rounded-[12px] border border-border p-[9px]",
        href && "hover:border-primary transition-colors duration-150",
        className
      )}
      style={{ gridTemplateColumns: "150px minmax(0, 1fr) auto" }}
    >
      {/* Cover */}
      <Cover coverUrl={coverUrl} fallbackTitle={title} aspectRatio="16/10" className="rounded-[9px]" />

      {/* Body */}
      <div className="grid gap-[7px] content-start">
        <div className="flex items-center gap-[7px] flex-wrap">
          <strong className="font-['Lexend'] text-[15px] font-bold line-clamp-2">{title}</strong>
          {badges?.map((badge, i) => (
            <span key={i} className="inline-flex items-center rounded-md border border-border px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {badge}
            </span>
          ))}
        </div>
        {description && (
          <p className="text-[13px] text-muted-foreground truncate">{description}</p>
        )}
        <MetaRow author={author} meta={timeAgo ? [timeAgo] : undefined} />
        {stats && (
          <div className="flex items-center gap-2">
            {stats.views != null && <Stat icon={Eye} value={stats.views} format />}
            {stats.likes != null && <Stat icon={ThumbsUp} value={stats.likes} format />}
            {stats.comments != null && <Stat icon={MessageCircle} value={stats.comments} format />}
            {stats.downloads != null && (
              <span className="inline-flex items-center gap-1 text-[12.5px] text-muted-foreground">
                <svg className="size-[14px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>{stats.downloads.toLocaleString()}</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* More menu — positioned absolutely so it doesn't interfere with Link */}
      {hasMenu && (
        <div className="relative self-start" onMouseLeave={() => setMenuOpen(false)}>
          <button
            className="inline-flex items-center justify-center size-[30px] rounded-[9px] hover:bg-surface-secondary text-muted-foreground"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpen(!menuOpen) }}
            onMouseEnter={() => setMenuOpen(true)}
          >
            <MoreHorizontal className="size-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-70 w-[min(180px,calc(100vw-28px))] grid gap-1 p-1.5 rounded-xl border border-border bg-popover/98 backdrop-blur-[14px] shadow-md">
              {moreMenuItems.map((item, i) => (
                <button
                  key={i}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    item.onClick()
                    setMenuOpen(false)
                  }}
                  className={cn(
                    "grid grid-cols-[18px_1fr] items-center gap-2 min-h-[38px] rounded-[9px] px-2.5 text-left font-extrabold hover:bg-surface-secondary",
                    item.destructive
                      ? "text-destructive hover:text-destructive"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {item.icon ?? <span className="w-[18px]" />}
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )

  // When href exists: wrap in Link. Menu clicks use stopPropagation to avoid navigation.
  // When no href: render plain div.
  if (href) {
    return (
      <Link href={href} className={cn("block cursor-pointer", className)}>
        {inner}
      </Link>
    )
  }

  return inner
}
```

- [ ] **Step 2: 验证组件编译**

```bash
cd apps/web && pnpm typecheck
```

- [ ] **Step 3: 提交**

```bash
git add apps/web/components/profile/profile-content-item.tsx
git commit -m "feat: add ProfileContentItem component for leaderboard-style list items"
```

---

### Task 2: 更新 ProfileTabs 组件（Tab 定义）

**Files:**
- Modify: `apps/web/components/profile/profile-tabs.tsx`

**Interfaces:**
- Consumes: 现有 ProfileTabsProps
- Produces: 更新后的 ProfileTabsProps（新增 `mcp`、`skills` prop，移除 `favorites`、`collections`，将 `bookmarkCount`/`collectionCount` 替换为 `mcpCount`/`skillCount`）

- [ ] **Step 1: 更新 TAB_KEYS 和 TAB_LABELS**

```typescript
// 修改前
const TAB_KEYS = ["pages", "likes", "favorites", "moments", "collections"] as const

const TAB_LABELS: Record<string, string> = {
  pages: "页面",
  likes: "喜欢",
  favorites: "收藏",
  moments: "动态",
  collections: "合集",
}

// 修改后
const TAB_KEYS = ["pages", "likes", "moments", "mcp", "skills"] as const

const TAB_LABELS: Record<string, string> = {
  pages: "页面",
  likes: "喜欢",
  moments: "动态",
  mcp: "MCP",
  skills: "技能",
}
```

- [ ] **Step 2: 更新 ProfileTabsProps 接口**

```typescript
interface ProfileTabsProps {
  overview: React.ReactNode
  pages: React.ReactNode
  likes: React.ReactNode
  moments: React.ReactNode
  mcp: React.ReactNode        // 新增
  skills: React.ReactNode     // 新增
  pageCount?: number
  likeCount?: number
  momentCount?: number
  mcpCount?: number           // 替换 bookmarkCount
  skillCount?: number         // 替换 collectionCount
}
```

- [ ] **Step 3: 更新 countMap 和 content**

```typescript
const countMap: Record<string, number | undefined> = {
  "页面": pageCount,
  "喜欢": likeCount,
  "动态": momentCount,
  "MCP": mcpCount,
  "技能": skillCount,
}

const content: Record<string, React.ReactNode> = {
  "概览": overview,
  "页面": pages,
  "喜欢": likes,
  "动态": moments,
  "MCP": mcp,
  "技能": skills,
}
```

- [ ] **Step 4: 验证编译**

```bash
cd apps/web && pnpm typecheck
```

- [ ] **Step 5: 提交**

```bash
git add apps/web/components/profile/profile-tabs.tsx
git commit -m "feat: update ProfileTabs - add MCP/skills tabs, remove favorites/collections tabs"
```

---

### Task 3: 创建 ProfilePagesList 组件（Pages tab 重构）

**Files:**
- Create: `apps/web/components/profile/profile-pages-list.tsx`

**Interfaces:**
- Consumes: `ProfileContentItem` (from Task 1)
- Produces: `ProfilePagesList` 客户端组件
- Props: `userId: string`, `userSlug: string`, `displayName: string | null`, `avatarUrl: string | null`, `initialPages: PageCardData[]`, `initialTotal: number`

- [ ] **Step 1: 创建组件**

```typescript
// apps/web/components/profile/profile-pages-list.tsx
"use client"

import { useState, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Search, Plus } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Pagination } from "@/components/shared/pagination"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ProfileContentItem, type ProfileContentItemData } from "./profile-content-item"
import { EmptyState } from "@/components/content/i18n-text"

const SORT_OPTIONS = [
  { value: "latest", label: "最新发布" },
  { value: "views", label: "最多浏览" },
  { value: "likes", label: "最多喜欢" },
] as const

const PAGE_SIZE = 20

interface ProfilePagesListProps {
  pages: ProfileContentItemData[]
  total: number
  userSlug: string
}

function buildHref(userSlug: string, pageUid: string): string {
  return `/${encodeURIComponent(userSlug)}/${encodeURIComponent(pageUid)}?tab=read`
}

export function ProfilePagesList({ pages, total, userSlug }: ProfilePagesListProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentPage = Number(searchParams.get("page") ?? 1)
  const currentSort = searchParams.get("sort") ?? "latest"
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const [searchQuery, setSearchQuery] = useState("")

  const updateParams = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    }
    // Reset page when changing sort
    if (updates.sort !== undefined && !("page" in updates)) {
      params.delete("page")
    }
    router.push(`?${params.toString()}`, { scroll: false })
  }, [router, searchParams])

  // Filter by search locally (on current page results)
  const filtered = searchQuery.trim()
    ? pages.filter((p) =>
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : pages

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索页面..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={currentSort}
          onValueChange={(value) => updateParams({ sort: value === "latest" ? null : value })}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button asChild>
          <a href="/pages/new">
            <Plus className="h-4 w-4" />
            创建页面
          </a>
        </Button>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState tKey="community.noPages" fallback="暂无公开页面" />
      ) : (
        <div className="grid gap-2">
          {filtered.map((item, i) => (
            <ProfileContentItem
              key={i}
              data={item}
              href={item._href}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center pt-2">
          <Pagination currentPage={currentPage} totalPages={totalPages} />
        </div>
      )}
    </div>
  )
}
```

注意：需要在 `ProfileContentItemData` 中添加 `_href?: string` 用于内部路由。或者将 href 作为独立字段管理。更好方案是在组件中扩展接口。

- [ ] **Step 2: 调整 ProfileContentItem** — 支持 href 透传

修改 `ProfileContentItem` 组件，当有 href 且无 moreMenuItems 时用 Link 包裹；当有 moreMenuItems 时用 div 包裹内部 Link（阻止菜单点击冒泡）。

- [ ] **Step 3: 验证编译**

```bash
cd apps/web && pnpm typecheck
```

- [ ] **Step 4: 提交**

```bash
git add apps/web/components/profile/profile-pages-list.tsx
git commit -m "feat: add ProfilePagesList with search, sort, and pagination"
```

---

### Task 4: 创建 ProfileMcpList 组件

**Files:**
- Create: `apps/web/components/profile/profile-mcp-list.tsx`

**Interfaces:**
- Consumes: `ProfileContentItem` (from Task 1)
- Produces: `ProfileMcpList` 客户端组件
- Props: `mcps: ProfileContentItemData[]`, `total: number`, `userSlug: string`

**说明：** 与 ProfilePagesList 结构相同，区别：
- 搜索 placeholder："搜索 MCP..."
- 排序选项：最新发布、最多下载、最受欢迎
- 创建按钮链接：`/publish?type=mcp`，文字"发布 MCP"
- MCP 无封面图，Cover 组件使用 fallbackTitle 生成渐变色封面

- [ ] **Step 1: 创建组件**

```typescript
// apps/web/components/profile/profile-mcp-list.tsx
"use client"

import { useState, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Search, Plus } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Pagination } from "@/components/shared/pagination"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ProfileContentItem, type ProfileContentItemData } from "./profile-content-item"
import { EmptyState } from "@/components/content/i18n-text"

const SORT_OPTIONS = [
  { value: "latest", label: "最新发布" },
  { value: "downloads", label: "最多下载" },
  { value: "popular", label: "最受欢迎" },
] as const

const PAGE_SIZE = 20

interface ProfileMcpListProps {
  mcps: (ProfileContentItemData & { id: string })[]
  total: number
}

export function ProfileMcpList({ mcps, total }: ProfileMcpListProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentPage = Number(searchParams.get("mcp_page") ?? 1)
  const currentSort = searchParams.get("mcp_sort") ?? "latest"
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const [searchQuery, setSearchQuery] = useState("")

  const updateParams = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    }
    router.push(`?${params.toString()}`, { scroll: false })
  }, [router, searchParams])

  const filtered = searchQuery.trim()
    ? mcps.filter((m) =>
        m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : mcps

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索 MCP..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={currentSort}
          onValueChange={(value) => updateParams({ mcp_sort: value === "latest" ? null : value })}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button asChild>
          <a href="/publish?type=mcp">
            <Plus className="h-4 w-4" />
            发布 MCP
          </a>
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState tKey="profile.noMcps" fallback="暂无发布的 MCP" />
      ) : (
        <div className="grid gap-2">
          {filtered.map((item) => (
            <ProfileContentItem
              key={item.id}
              data={item}
              href={`/mcp-market/${item.id}`}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center pt-2">
          <Pagination currentPage={currentPage} totalPages={totalPages} />
        </div>
      )}
    </div>
  )
}
```

注意：MCP tab 使用独立的 searchParams key（`mcp_page`、`mcp_sort`）避免与 pages tab 冲突。

- [ ] **Step 2: 验证编译**

```bash
cd apps/web && pnpm typecheck
```

- [ ] **Step 3: 提交**

```bash
git add apps/web/components/profile/profile-mcp-list.tsx
git commit -m "feat: add ProfileMcpList with search, sort, and pagination"
```

---

### Task 5: 创建 ProfileSkillsList 组件

**Files:**
- Create: `apps/web/components/profile/profile-skills-list.tsx`

**Interfaces:**
- Consumes: `ProfileContentItem` (from Task 1)
- Produces: `ProfileSkillsList` 客户端组件
- Props: `skills: (ProfileContentItemData & { id: string })[]`, `total: number`

- [ ] **Step 1: 创建组件**

```typescript
// apps/web/components/profile/profile-skills-list.tsx
"use client"

import { useState, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Search, Plus } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Pagination } from "@/components/shared/pagination"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ProfileContentItem, type ProfileContentItemData } from "./profile-content-item"
import { EmptyState } from "@/components/content/i18n-text"

const SORT_OPTIONS = [
  { value: "latest", label: "最新发布" },
  { value: "downloads", label: "最多下载" },
  { value: "popular", label: "最受欢迎" },
] as const

const PAGE_SIZE = 20

interface ProfileSkillsListProps {
  skills: (ProfileContentItemData & { id: string })[]
  total: number
}

export function ProfileSkillsList({ skills, total }: ProfileSkillsListProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentPage = Number(searchParams.get("skill_page") ?? 1)
  const currentSort = searchParams.get("skill_sort") ?? "latest"
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const [searchQuery, setSearchQuery] = useState("")

  const updateParams = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    }
    router.push(`?${params.toString()}`, { scroll: false })
  }, [router, searchParams])

  const filtered = searchQuery.trim()
    ? skills.filter((s) =>
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : skills

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索技能..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={currentSort}
          onValueChange={(value) => updateParams({ skill_sort: value === "latest" ? null : value })}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button asChild>
          <a href="/publish?type=skill">
            <Plus className="h-4 w-4" />
            创建技能
          </a>
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState tKey="profile.noSkills" fallback="暂无发布的技能" />
      ) : (
        <div className="grid gap-2">
          {filtered.map((item) => (
            <ProfileContentItem
              key={item.id}
              data={item}
              href={`/skill-market/${item.id}`}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center pt-2">
          <Pagination currentPage={currentPage} totalPages={totalPages} />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 验证编译**

```bash
cd apps/web && pnpm typecheck
```

- [ ] **Step 3: 提交**

```bash
git add apps/web/components/profile/profile-skills-list.tsx
git commit -m "feat: add ProfileSkillsList with search, sort, and pagination"
```

---

### Task 6: 创建 ProfileLikesMerged 组件（合并收藏+喜欢）

**Files:**
- Create: `apps/web/components/profile/profile-likes-merged.tsx`

**Interfaces:**
- Consumes: `ProfileContentItem` (from Task 1)
- Produces: `ProfileLikesMerged` 客户端组件
- Props: `likedPages: ProfileContentItemData[]`, `bookmarkedPages: ProfileContentItemData[]`, `bookmarkedMcps: FavoriteData[]`, `bookmarkedSkills: FavoriteData[]`, `collections: CollectionData[]`, `userSlug: string`

**说明：** 这是最复杂的组件。布局分为两个区域：
- **收藏区**：一个大卡片，内含类别 tab（页面/MCP/技能）、左侧收藏夹列表（合集）、右侧内容列表
- **喜欢区**：标题 + leaderboard 样式列表

> 注意：`collectionItems` 仅支持 `itemType` 'mcp' | 'skill'，不支持页面。因此左侧收藏夹列表仅在 "MCP" 和 "技能" 类别下生效；"页面" 类别直接展示所有 bookmarked pages。

- [ ] **Step 1: 创建组件骨架和类型定义**

```typescript
// apps/web/components/profile/profile-likes-merged.tsx
"use client"

import { useState, useMemo } from "react"
import { Trash2 } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ProfileContentItem, type ProfileContentItemData } from "./profile-content-item"
import { SectionHead } from "@/components/content/section-head"
import { EmptyState } from "@/components/content/i18n-text"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type FavoriteCategory = "pages" | "mcp" | "skill"

interface FavoriteMcpSkill {
  id: string
  type: "mcp" | "skill"
  name: string
  slug: string
  version: string
  description: string | null
  transport?: string
  skillType?: string
  author: { username: string; avatarUrl: string | null } | null
  favoritedAt: Date
}

interface CollectionInfo {
  id: string
  name: string
  itemCount: number
}

interface ProfileLikesMergedProps {
  likedPages: ProfileContentItemData[]
  bookmarkedPages: ProfileContentItemData[]
  bookmarkedMcps: FavoriteMcpSkill[]
  bookmarkedSkills: FavoriteMcpSkill[]
  collections: CollectionInfo[]
  userSlug: string
}

function buildPageHref(userSlug: string, pageUid: string): string {
  return `/${encodeURIComponent(userSlug)}/${encodeURIComponent(pageUid)}?tab=read`
}

export function ProfileLikesMerged({
  likedPages,
  bookmarkedPages,
  bookmarkedMcps,
  bookmarkedSkills,
  collections,
  userSlug,
}: ProfileLikesMergedProps) {
  const [category, setCategory] = useState<FavoriteCategory>("pages")
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null)

  // Build collection list: "全部收藏" + user collections
  const collectionList = useMemo(() => [
    { id: null, name: "全部收藏", itemCount: 0 },
    ...collections,
  ], [collections])

  // Filter content by category and selected collection
  const favoriteContent = useMemo((): ProfileContentItemData[] => {
    switch (category) {
      case "pages":
        return bookmarkedPages
      case "mcp":
        return bookmarkedMcps.map((m) => ({
          coverUrl: null,
          title: m.name,
          description: m.description ?? undefined,
          author: {
            name: m.author?.username ?? "?",
            avatarUrl: m.author?.avatarUrl ?? undefined,
          },
          badges: [`v${m.version}`, m.transport?.toUpperCase() ?? ""].filter(Boolean),
          _href: `/mcp-market/${m.id}`,
          _id: m.id,
          _type: "mcp" as const,
        }))
      case "skill":
        return bookmarkedSkills.map((s) => ({
          coverUrl: null,
          title: s.name,
          description: s.description ?? undefined,
          author: {
            name: s.author?.username ?? "?",
            avatarUrl: s.author?.avatarUrl ?? undefined,
          },
          badges: [`v${s.version}`, s.skillType ?? ""].filter(Boolean),
          _href: `/skill-market/${s.id}`,
          _id: s.id,
          _type: "skill" as const,
        }))
    }
  }, [category, bookmarkedPages, bookmarkedMcps, bookmarkedSkills])

  const handleDelete = async (id: string, type: "mcp" | "skill") => {
    const apiPath = type === "mcp"
      ? `/api/mcp/${id}/bookmark`
      : `/api/skill/${id}/favorite`
    try {
      const res = await fetch(apiPath, { method: "POST" })
      if (res.ok) {
        toast.success("已取消收藏")
        // Refresh via router
      } else {
        toast.error("操作失败")
      }
    } catch {
      toast.error("操作失败")
    }
  }

  return (
    <div className="space-y-6">
      {/* ====== 收藏区 ====== */}
      <section>
        <SectionHead title="收藏" />
        <div className="rounded-[12px] border border-border bg-card overflow-hidden">
          {/* Category tabs */}
          <div className="border-b border-border px-4 pt-3">
            <Tabs value={category} onValueChange={(v) => { setCategory(v as FavoriteCategory); setSelectedCollectionId(null) }}>
              <TabsList>
                <TabsTrigger value="pages" className="text-xs">页面</TabsTrigger>
                <TabsTrigger value="mcp" className="text-xs">MCP</TabsTrigger>
                <TabsTrigger value="skill" className="text-xs">技能</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Body: left sidebar + right content */}
          <div className="flex" style={{ minHeight: 300 }}>
            {/* Left: collection list */}
            <div className="w-[180px] border-r border-border p-2 shrink-0">
              <ScrollArea className="h-full">
                <div className="space-y-0.5">
                  {collectionList.map((col) => (
                    <button
                      key={col.id ?? "__all__"}
                      onClick={() => setSelectedCollectionId(col.id)}
                      className={cn(
                        "w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors",
                        selectedCollectionId === col.id
                          ? "bg-primary/10 text-primary font-semibold"
                          : "text-muted-foreground hover:bg-surface-secondary hover:text-foreground"
                      )}
                    >
                      {col.name}
                      {col.itemCount > 0 && (
                        <span className="ml-1.5 text-xs text-muted-foreground">{col.itemCount}</span>
                      )}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Right: content list */}
            <div className="flex-1 p-3 min-w-0">
              {favoriteContent.length === 0 ? (
                <div className="flex items-center justify-center h-full py-12">
                  <EmptyState tKey="profile.noFavorites" fallback="暂无收藏内容" />
                </div>
              ) : (
                <div className="grid gap-2">
                  {favoriteContent.map((item, i) => (
                    <ProfileContentItem
                      key={i}
                      data={item}
                      href={(item as any)._href}
                      moreMenuItems={[
                        {
                          label: "取消收藏",
                          icon: <Trash2 className="h-4 w-4" />,
                          onClick: () => handleDelete((item as any)._id, (item as any)._type),
                          destructive: true,
                        },
                      ]}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ====== 喜欢区 ====== */}
      <section>
        <SectionHead title="喜欢" />
        {likedPages.length === 0 ? (
          <EmptyState tKey="community.noLikedPages" fallback="暂无喜欢的页面" />
        ) : (
          <div className="grid gap-2">
            {likedPages.map((item, i) => (
              <ProfileContentItem
                key={i}
                data={item}
                href={(item as any)._href}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
```

- [ ] **Step 2: 检查 ScrollArea 组件是否存在**

```bash
# 搜索 ScrollArea 组件
```

如果没有 `ScrollArea`，使用简单的 `overflow-y-auto` 替代。

- [ ] **Step 3: 验证编译**

```bash
cd apps/web && pnpm typecheck
```

- [ ] **Step 4: 提交**

```bash
git add apps/web/components/profile/profile-likes-merged.tsx
git commit -m "feat: add ProfileLikesMerged component combining favorites and likes"
```

---

### Task 7: 更新 page.tsx 数据获取和组装

**Files:**
- Modify: `apps/web/app/(dashboard)/[user_slug]/page.tsx`

**Interfaces:**
- Consumes: 所有新组件 (Tasks 2-6)
- Produces: 完整的重构后用户资料页面

**说明：** 这是集成任务。需要：
1. 新增 MCP packages 和 Skill packages 查询（按 authorId 过滤）
2. 根据 searchParams 支持 pages tab 的分页和排序
3. 为 likes tab 查询 favorites（communityBookmarks + bookmarks for MCP/skill）
4. 移除 favorites tab 和 collections tab 的内容
5. 将数据映射为 ProfileContentItemData 格式传给各组件

- [ ] **Step 1: 更新 import 和新增查询**

主要变更：
- Import 新组件：`ProfilePagesList`, `ProfileMcpList`, `ProfileSkillsList`, `ProfileLikesMerged`
- Import MCP/Skill 表：`mcpPackages`, `skillPackages`, `bookmarks`
- 移除：`CollectionCard` import, `createdCollections` 查询
- 新增查询：
  - `authorMcps` — 按 `authorId` 查询 `mcpPackages`
  - `authorSkills` — 按 `authorId` 查询 `skillPackages`
  - `bookmarkedMcps` — 按 `userId` 查询 `bookmarks` where `entityType = 'mcp'`
  - `bookmarkedSkills` — 按 `userId` 查询 `bookmarks` where `entityType = 'skill'`
  - `collections` — 保留查询（用于 likes 合并组件的收藏夹列表）

- [ ] **Step 2: 数据映射为 ProfileContentItemData**

pages 数据映射（从现有 `mapPageToCard` 改造）：
```typescript
function mapPageToContentItem(p: PageRow, fallbackDisplayName: string, fallbackAvatarUrl: string | null): ProfileContentItemData & { _href: string } {
  const authorDisplayName = p.authorDisplayName ?? fallbackDisplayName ?? p.authorSlug
  const pageUid = p.uid
  return {
    coverUrl: p.coverUrl,
    title: p.title,
    description: p.description ?? undefined,
    author: {
      name: authorDisplayName,
      avatarUrl: p.authorAvatarUrl ?? fallbackAvatarUrl ?? undefined,
    },
    timeAgo: timeAgo(p.lastPublishedAt),
    stats: {
      views: p.viewCount,
      likes: p.likeCount,
      comments: p.commentCount,
    },
    _href: `/${encodeURIComponent(p.authorSlug)}/${encodeURIComponent(pageUid)}?tab=read`,
  }
}
```

MCP/Skill 数据映射：
```typescript
function mapMcpToContentItem(m: McpRow): ProfileContentItemData & { _href: string; id: string } {
  return {
    coverUrl: null, // MCP has no cover
    title: m.name,
    description: m.description ?? undefined,
    author: {
      name: m.author?.displayName ?? m.author?.userSlug ?? "?",
      avatarUrl: m.author?.avatarUrl ?? undefined,
    },
    timeAgo: timeAgo(m.createdAt),
    stats: {
      downloads: m.downloadsCount,
    },
    badges: [`v${m.version}`, m.transport?.toUpperCase()].filter(Boolean),
    _href: `/mcp-market/${m.id}`,
    id: m.id,
  }
}
```

- [ ] **Step 3: 组装 tabs JSX**

```tsx
<ProfileTabs
  overview={/* 不变 */}
  pages={
    <ProfilePagesList
      pages={pageContentItems}
      total={pageTotal}
      userSlug={user.userSlug}
    />
  }
  likes={
    <ProfileLikesMerged
      likedPages={likedContentItems}
      bookmarkedPages={bookmarkedPageContentItems}
      bookmarkedMcps={bookmarkedMcpData}
      bookmarkedSkills={bookmarkedSkillData}
      collections={collectionListData}
      userSlug={user.userSlug}
    />
  }
  moments={/* 不变 */}
  mcp={
    <ProfileMcpList
      mcps={mcpContentItems}
      total={mcpTotal}
    />
  }
  skills={
    <ProfileSkillsList
      skills={skillContentItems}
      total={skillTotal}
    />
  }
  pageCount={pageTotal}
  likeCount={likedContentItems.length}
  momentCount={feedCards.length}
  mcpCount={mcpTotal}
  skillCount={skillTotal}
/>
```

- [ ] **Step 4: 验证编译**

```bash
cd apps/web && pnpm typecheck
```

- [ ] **Step 5: 提交**

```bash
git add apps/web/app/(dashboard)/[user_slug]/page.tsx
git commit -m "feat: integrate profile tabs refactor - new MCP/skills tabs, merged likes, pages list"
```

---

### Task 8: 端到端验证和清理

**Files:**
- 全部修改文件

- [ ] **Step 1: 运行 typecheck**

```bash
cd apps/web && pnpm typecheck
```

- [ ] **Step 2: 检查未使用的 import 和旧代码**

确认以下不再被引用：
- `CollectionCard` import（从 page.tsx 移除）
- `favorites` prop（从 ProfileTabs 移除）
- `collections` prop（从 ProfileTabs 移除）

- [ ] **Step 3: 手动验证清单**

- [ ] 导航到 `/{user_slug}` → 概览 tab 正常显示
- [ ] 点击"页面"tab → 搜索框、排序下拉、创建按钮、列表正确显示
- [ ] 点击"MCP"tab → 搜索框、排序下拉、发布按钮、列表正确显示
- [ ] 点击"技能"tab → 搜索框、排序下拉、创建按钮、列表正确显示
- [ ] 点击"喜欢"tab → 收藏区（类别tab+收藏夹+内容）+ 喜欢区正确显示
- [ ] 收藏区更多菜单的删除按钮功能正常
- [ ] 分页导航功能正常
- [ ] 确认"收藏"和"合集"tab 已移除

- [ ] **Step 4: 最终提交**

```bash
git add -A
git commit -m "chore: final cleanup and verification for profile tabs refactor"
```

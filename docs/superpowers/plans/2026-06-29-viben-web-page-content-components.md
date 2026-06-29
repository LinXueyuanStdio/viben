# Page Content Components 实现计划

> **对于 agentic 工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 来逐任务实现此计划。步骤使用 checkbox（`- [ ]`）语法跟踪。

**目标：** 从 pages/web/index.html 参考原型中提取 19 个可复用内容组件，分 11 个任务构建。

**架构：** 组件放在 `apps/web/components/content/`，通过 props 接收数据，不直接访问 API。Mock 数据集中在 `apps/web/lib/mock/`。组件依赖 apps/web 已有的 Avatar、Badge、Progress、Card、Button。

**技术栈：** React 19 + Next.js 15.5 + TypeScript 5.7 + Tailwind v4 + Radix UI primitives + lucide-react icons + class-variance-authority + tailwind-merge

## Global Constraints

- Tailwind v4：使用 `@import "tailwindcss"`，oklch 颜色格式（不用 hsl 包裹），`@theme` 块定义设计 token
- `data-[state=active]:` 等 data 属性变体在 CVA 中不可靠，条件性 className 传给组件
- 禁止内联 import type 语法（`import("...").Type`），必须用顶层 `import type { ... } from "..."`
- 禁止动态 import（`const x = await import(...)`），用静态 import
- 复用 apps/web 已有组件：`Avatar` (`ui/avatar.tsx`)、`Badge` (`ui/badge.tsx`)、`Progress` (`ui/progress.tsx`)、`Card` (`ui/card.tsx`)、`Button` (`ui/button.tsx`)、`IconButton` (`ui/icon-button.tsx`)、`VibenTabs` (`ui/viben-tabs.tsx`)
- 所有组件通过 props 接收数据，不发起网络请求
- 组件目录：`apps/web/components/content/`
- Mock 数据目录：`apps/web/lib/mock/`
- 使用 `formatCount` 从 `@/lib/utils/format` 格式化大数字
- 使用 lucide-react 图标（已有依赖）
- TypeScript 严格模式，所有导出接口需显式导出
- 每个任务结束时验证：`cd apps/web && pnpm typecheck` 通过

---

### Task 1: 基础 UI 原语 — Cover, Pill, ProgressMini

**文件：**
- 新建：`apps/web/components/content/cover.tsx`
- 新建：`apps/web/components/content/pill.tsx`
- 新建：`apps/web/components/content/progress-mini.tsx`

**接口：**
- 产出：`Cover`（`src`, `aspectRatio?`, `overlay?`, `children?`, `className?`）
- 产出：`Pill`（`children`, `variant?: "default" | "kind" | "source" | "rank" | "tag"`, `className?`）
- 产出：`ProgressMini`（`value: number`, `className?`）
- 消耗：`Progress` (from `@/components/ui/progress`)，`Badge` (from `@/components/ui/badge`)

- [ ] **Step 1: 实现 Cover 组件**

```tsx
// apps/web/components/content/cover.tsx
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface CoverProps {
  src: string
  aspectRatio?: "16/9" | "16/10"
  overlay?: boolean
  children?: ReactNode
  className?: string
}

export function Cover({ src, aspectRatio = "16/9", overlay = false, children, className }: CoverProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[9px]",
        aspectRatio === "16/9" ? "aspect-video" : "aspect-[16/10]",
        className
      )}
      style={{ background: src }}
    >
      {overlay && (
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
      )}
      {children && (
        <div className="absolute inset-x-0 bottom-0 z-10 flex items-center gap-3 p-2">
          {children}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 实现 Pill 组件**

```tsx
// apps/web/components/content/pill.tsx
import type { ReactNode } from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const pillVariants = cva(
  "inline-flex items-center rounded-full font-bold text-[12.5px] min-h-[26px] px-2.5 whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "bg-primary/10 text-primary",
        kind: "bg-surface-secondary text-muted-foreground",
        source: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
        rank: "font-['Lexend'] text-lg text-primary bg-transparent px-0",
        tag: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[12.5px]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

interface PillProps extends VariantProps<typeof pillVariants> {
  children: ReactNode
  className?: string
}

export function Pill({ children, variant, className }: PillProps) {
  return <span className={cn(pillVariants({ variant }), className)}>{children}</span>
}
```

- [ ] **Step 3: 实现 ProgressMini 组件**

```tsx
// apps/web/components/content/progress-mini.tsx
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

interface ProgressMiniProps {
  value: number
  className?: string
}

export function ProgressMini({ value, className }: ProgressMiniProps) {
  return (
    <Progress
      value={value}
      className={cn("h-1 rounded-full bg-surface-secondary", className)}
      indicatorClassName="bg-gradient-to-r from-primary to-cta rounded-full"
    />
  )
}
```

**注意：** `Progress` 组件的 `indicatorClassName` prop 可能需要检查是否存在。如果不存在，直接用 div 实现：

```tsx
export function ProgressMini({ value, className }: ProgressMiniProps) {
  return (
    <div className={cn("h-1 rounded-full bg-surface-secondary overflow-hidden", className)}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-primary to-[var(--color-cta,var(--color-primary))] transition-[width] duration-300"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}
```

- [ ] **Step 4: 验证 typecheck**

```bash
cd apps/web && pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/content/cover.tsx apps/web/components/content/pill.tsx apps/web/components/content/progress-mini.tsx
git commit -m "feat(content): add Cover, Pill, ProgressMini primitives"
```

---

### Task 2: 基础 UI 原语 — StatsRow, Stat, MetaRow, SectionHead

**文件：**
- 新建：`apps/web/components/content/stats-row.tsx`
- 新建：`apps/web/components/content/meta-row.tsx`
- 新建：`apps/web/components/content/section-head.tsx`

**接口：**
- 产出：`Stat`（`icon: LucideIcon`, `value: number | string`, `format?: boolean`, `className?`）
- 产出：`StatsRow`（`stats: StatProps[]`, `className?`）
- 产出：`MetaAuthor`（`fallbackText`, `avatarUrl?`, `name`, `className?`）
- 产出：`MetaRow`（`author: MetaAuthorProps`, `meta?: string[]`, `stats?: StatProps[]`, `className?`）
- 产出：`SectionHead`（`title: string`, `actionLabel?`, `actionHref?`, `children?`, `className?`）
- 消耗：`Avatar` (from `@/components/ui/avatar`)，`formatCount` (from `@/lib/utils/format`)，`Link` (from `next/link`)

- [ ] **Step 1: 实现 StatsRow + Stat**

```tsx
// apps/web/components/content/stats-row.tsx
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatCount } from "@/lib/utils/format"

export interface StatProps {
  icon: LucideIcon
  value: number | string
  format?: boolean
  className?: string
}

export function Stat({ icon: Icon, value, format = false, className }: StatProps) {
  const displayValue = format && typeof value === "number" ? formatCount(value) : value
  return (
    <span className={cn("inline-flex items-center gap-1 text-[12.5px] text-muted-foreground", className)}>
      <Icon className="size-[14px] shrink-0" />
      <span>{displayValue}</span>
    </span>
  )
}

interface StatsRowProps {
  stats: StatProps[]
  className?: string
}

export function StatsRow({ stats, className }: StatsRowProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-[7px]", className)}>
      {stats.map((stat, i) => (
        <Stat key={i} {...stat} />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: 实现 MetaRow**

```tsx
// apps/web/components/content/meta-row.tsx
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import type { StatProps } from "./stats-row"
import { StatsRow } from "./stats-row"
import { Dot } from "./dot"

interface MetaAuthorProps {
  fallbackText: string
  avatarUrl?: string
  name: string
  className?: string
}

function MetaAuthor({ fallbackText, avatarUrl, name, className }: MetaAuthorProps) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 min-w-0", className)}>
      <Avatar className="size-[28px] shrink-0">
        <AvatarImage src={avatarUrl} alt={name} />
        <AvatarFallback>{fallbackText}</AvatarFallback>
      </Avatar>
      <span className="text-[13px] font-bold truncate">{name}</span>
    </span>
  )
}

// 3px dot 分隔符
function Dot() {
  return <span className="inline-block size-[3px] rounded-full bg-[#9bb8c2] shrink-0" />
}

interface MetaRowProps {
  author: MetaAuthorProps
  meta?: string[]
  stats?: StatProps[]
  className?: string
}

export function MetaRow({ author, meta, stats, className }: MetaRowProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-[7px]", className)}>
      <MetaAuthor {...author} />
      {meta?.map((text, i) => (
        <span key={i} className="inline-flex items-center gap-[7px]">
          <Dot />
          <span className="text-[13px] text-muted-foreground">{text}</span>
        </span>
      ))}
      {stats && stats.length > 0 && (
        <>
          <Dot />
          <StatsRow stats={stats} />
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 3: 实现 SectionHead**

```tsx
// apps/web/components/content/section-head.tsx
import type { ReactNode } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface SectionHeadProps {
  title: string
  actionLabel?: string
  actionHref?: string
  children?: ReactNode
  className?: string
}

export function SectionHead({ title, actionLabel, actionHref, children, className }: SectionHeadProps) {
  return (
    <div className={cn("flex items-center justify-between gap-2.5 mb-2", className)}>
      <h2 className="font-['Lexend'] text-[17px] font-bold leading-[1.2] text-foreground">
        {title}
      </h2>
      {children ? (
        <div className="flex items-center gap-2">{children}</div>
      ) : actionLabel && actionHref ? (
        <Link
          href={actionHref}
          className="inline-flex items-center text-[14px] font-bold text-primary min-h-[36px] hover:underline"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 4: 验证 typecheck**

```bash
cd apps/web && pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/content/stats-row.tsx apps/web/components/content/meta-row.tsx apps/web/components/content/section-head.tsx
git commit -m "feat(content): add StatsRow, MetaRow, SectionHead primitives"
```

---

### Task 3: PageCard（页面卡片）

**文件：**
- 新建：`apps/web/components/content/page-card.tsx`

**接口：**
- 产出：`PageCard`（`data: PageCardData`, `variant?: "default" | "home"`, `href: string`, `className?`）
- 产出：`PageCardData` 类型导出
- 消耗：`Cover`, `MetaRow`, `StatsRow`, `Stat`（from local），`Link` (from `next/link`)

- [ ] **Step 1: 实现 PageCard**

```tsx
// apps/web/components/content/page-card.tsx
import Link from "next/link"
import { Eye, MessageCircle, Bookmark, Heart } from "lucide-react"
import { Cover } from "./cover"
import { MetaRow } from "./meta-row"
import { StatsRow } from "./stats-row"
import type { StatProps } from "./stats-row"
import { cn } from "@/lib/utils"

export interface PageCardData {
  cover: string
  title: string
  description?: string
  author: {
    name: string
    fallbackText: string
    avatarUrl?: string
  }
  timeAgo: string
  stats: {
    views: number
    likes?: number
    comments?: number
    bookmarks?: number
  }
}

interface PageCardProps {
  data: PageCardData
  variant?: "default" | "home"
  href: string
  className?: string
}

export function PageCard({ data, variant = "default", href, className }: PageCardProps) {
  const { cover, title, description, author, timeAgo, stats } = data

  const coverStats: StatProps[] = [
    { icon: Eye, value: stats.views, format: true },
    { icon: MessageCircle, value: stats.comments ?? 0, format: true },
  ]

  const detailStats: StatProps[] = [
    { icon: Eye, value: stats.views, format: true },
    ...(stats.likes != null ? [{ icon: Heart, value: stats.likes, format: true }] : []),
    ...(stats.bookmarks != null ? [{ icon: Bookmark, value: stats.bookmarks, format: true }] : []),
    ...(stats.comments != null ? [{ icon: MessageCircle, value: stats.comments, format: true }] : []),
  ]

  return (
    <Link
      href={href}
      className={cn(
        "block rounded-[12px] border border-border bg-background shadow-sm overflow-hidden",
        "hover:border-primary transition-colors duration-150",
        className
      )}
    >
      <Cover
        src={cover}
        aspectRatio="16/9"
        overlay={variant === "home"}
      >
        {variant === "home" && <StatsRow stats={coverStats} className="text-white [&_svg]:text-white [&_span]:text-white" />}
      </Cover>
      <div className={cn("p-2.5", variant === "home" ? "space-y-1" : "space-y-1.5")}>
        <h3 className="font-['Lexend'] text-[15px] font-bold leading-snug line-clamp-2 text-foreground">
          {title}
        </h3>
        {variant === "default" && description && (
          <p className="text-[13px] text-muted-foreground truncate">{description}</p>
        )}
        <MetaRow
          author={author}
          meta={[timeAgo]}
        />
        {variant === "default" && (
          <StatsRow stats={detailStats} />
        )}
      </div>
    </Link>
  )
}
```

- [ ] **Step 2: 验证 typecheck**

```bash
cd apps/web && pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/content/page-card.tsx
git commit -m "feat(content): add PageCard component (default + home variants)"
```

---

### Task 4: AuthorCard + FeedHead

**文件：**
- 新建：`apps/web/components/content/author-card.tsx`
- 新建：`apps/web/components/content/feed-head.tsx`

**接口：**
- 产出：`AuthorCard`（`data: AuthorCardData`, `className?`）
- 产出：`AuthorCardData` 类型导出
- 产出：`FeedHead`（`data: FeedHeadData`, `className?`）
- 产出：`FeedHeadData`、`FeedKind` 类型导出
- 消耗：`Avatar`, `Button`, `StatsRow`, `Pill`, `IconButton`（from `@/components/ui/*`）

- [ ] **Step 1: 实现 AuthorCard**

```tsx
// apps/web/components/content/author-card.tsx
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { UserPlus, BookOpen, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatCount } from "@/lib/utils/format"

export interface AuthorCardData {
  fallbackText: string
  avatarUrl?: string
  name: string
  handle: string
  description: string
  pageCount: number
  followerCount: number
  representativeWork?: string
  mutualFollows?: number
}

interface AuthorCardProps {
  data: AuthorCardData
  className?: string
}

export function AuthorCard({ data, className }: AuthorCardProps) {
  const { fallbackText, avatarUrl, name, handle, description, pageCount, followerCount, representativeWork, mutualFollows } = data

  return (
    <div className={cn(
      "grid grid-cols-[auto_1fr_auto] gap-[9px] rounded-[10px] border border-border p-2.5",
      className
    )}>
      <Avatar className="size-[34px]">
        <AvatarImage src={avatarUrl} alt={name} />
        <AvatarFallback>{fallbackText}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <div className="font-bold leading-[1.2] truncate">{name}</div>
        <div className="text-[13px] text-muted-foreground leading-[1.3] mt-[3px] mb-[6px]">
          <span className="block truncate">{handle}</span>
          <span className="block truncate">{description}</span>
          <span className="block truncate">
            {pageCount} 页面 · {formatCount(followerCount)} 关注者
          </span>
        </div>
      </div>
      <Button variant="outline" size="sm" className="h-9 shrink-0 gap-1 border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400">
        <UserPlus className="size-[14px]" />
        关注
      </Button>
      {(representativeWork || mutualFollows != null) && (
        <div className="col-span-full text-[13px] text-muted-foreground truncate">
          {representativeWork && <span>代表作：《{representativeWork}》</span>}
          {representativeWork && mutualFollows != null && <span> · </span>}
          {mutualFollows != null && <span>{mutualFollows} 人共同关注</span>}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 实现 FeedHead**

```tsx
// apps/web/components/content/feed-head.tsx
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { IconButton } from "@/components/ui/icon-button"
import { MoreHorizontal } from "lucide-react"
import { Pill } from "./pill"
import { cn } from "@/lib/utils"

export type FeedKind = "更新" | "发布" | "转发" | "评论" | "收藏" | "模板" | "数据" | "合集" | "论文" | "笔记"

export interface FeedHeadData {
  fallbackText: string
  avatarUrl?: string
  name: string
  handle: string
  kind: FeedKind
  timeAgo: string
  source?: string
}

interface FeedHeadProps {
  data: FeedHeadData
  className?: string
}

export function FeedHead({ data, className }: FeedHeadProps) {
  const { fallbackText, avatarUrl, name, handle, kind, timeAgo, source } = data

  return (
    <div className={cn("grid grid-cols-[auto_1fr_auto] gap-[9px] items-center", className)}>
      <Avatar className="size-[34px]">
        <AvatarImage src={avatarUrl} alt={name} />
        <AvatarFallback>{fallbackText}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-sm truncate">{name}</span>
          <Pill variant="kind">{kind}</Pill>
        </div>
        <div className="text-[13px] text-muted-foreground truncate">
          {handle}
          <span className="mx-[7px]">·</span>
          {timeAgo}
          {source && (
            <>
              <span className="mx-[7px]">·</span>
              来自 {source}
            </>
          )}
        </div>
      </div>
      <IconButton label="更多操作" size="compact">
        <MoreHorizontal className="size-4" />
      </IconButton>
    </div>
  )
}
```

- [ ] **Step 3: 验证 typecheck**

```bash
cd apps/web && pnpm typecheck
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/content/author-card.tsx apps/web/components/content/feed-head.tsx
git commit -m "feat(content): add AuthorCard and FeedHead components"
```

---

### Task 5: Attachment（嵌入页面预览）

**文件：**
- 新建：`apps/web/components/content/attachment.tsx`

**接口：**
- 产出：`Attachment`（`data: AttachmentData`, `onRemove?`, `className?`）
- 产出：`AttachmentData` 类型导出
- 消耗：`Cover`, `StatsRow`, `Stat`（from local），`X` icon (from `lucide-react`)

- [ ] **Step 1: 实现 Attachment**

```tsx
// apps/web/components/content/attachment.tsx
import { Eye, MessageCircle, X } from "lucide-react"
import { Cover } from "./cover"
import { StatsRow } from "./stats-row"
import type { StatProps } from "./stats-row"
import { cn } from "@/lib/utils"

export interface AttachmentData {
  cover: string
  title: string
  description?: string
  authorName: string
  timeAgo: string
  stats: {
    views: number
    comments: number
  }
}

interface AttachmentProps {
  data: AttachmentData
  onRemove?: () => void
  className?: string
}

export function Attachment({ data, onRemove, className }: AttachmentProps) {
  const { cover, title, authorName, timeAgo, stats } = data

  const coverStats: StatProps[] = [
    { icon: Eye, value: stats.views, format: true },
    { icon: MessageCircle, value: stats.comments, format: true },
  ]

  return (
    <div className={cn(
      "max-w-[520px] border border-border rounded-[12px] overflow-hidden",
      "hover:border-primary transition-colors duration-150",
      className
    )}>
      <Cover src={cover} aspectRatio="16/9" overlay>
        <StatsRow stats={coverStats} className="text-white [&_svg]:text-white [&_span]:text-white" />
      </Cover>
      <div className="grid gap-[7px] p-2.5">
        <div className="font-bold text-[14.5px] leading-snug line-clamp-2 text-foreground">
          {title}
        </div>
        <div className="flex items-center gap-[7px] text-[13px] text-muted-foreground">
          <span className="font-bold">{authorName}</span>
          <span className="inline-block size-[3px] rounded-full bg-[#9bb8c2] shrink-0" />
          <span>{timeAgo}</span>
        </div>
        {onRemove && (
          <button
            onClick={(e) => { e.preventDefault(); onRemove() }}
            className="absolute top-1.5 right-1.5 size-6 flex items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60"
            aria-label="移除附件"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}
```

**注意：** 移除按钮的绝对定位需要 Attachment 外层有 `relative`。修正：给最外层 div 加上 `relative`。

- [ ] **Step 2: 验证 typecheck**

```bash
cd apps/web && pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/content/attachment.tsx
git commit -m "feat(content): add Attachment component"
```

---

### Task 6: FeedCard（动态卡片）

**文件：**
- 新建：`apps/web/components/content/feed-card.tsx`

**接口：**
- 产出：`FeedCard`（`data: FeedCardData`, `variant?: "preloaded" | "rich"`, `className?`）
- 产出：`FeedCardData` 类型导出
- 消耗：`FeedHead`（from Task 4），`Attachment`（from Task 5），`StatsRow`, `Stat`（from local），lucide-react icons

- [ ] **Step 1: 实现 FeedCard**

```tsx
// apps/web/components/content/feed-card.tsx
import { Eye, MessageCircle, Bookmark, Heart, Repeat2, Share2 } from "lucide-react"
import { FeedHead } from "./feed-head"
import type { FeedHeadData } from "./feed-head"
import { Attachment } from "./attachment"
import type { AttachmentData } from "./attachment"
import { StatsRow } from "./stats-row"
import type { StatProps } from "./stats-row"
import { cn } from "@/lib/utils"

export interface FeedCardData {
  head: FeedHeadData
  text: string
  quote?: string
  attachment?: AttachmentData
  actions: {
    views: number
    likes: number
    comments: number
    reposts?: number
    bookmarks: number
  }
}

interface FeedCardProps {
  data: FeedCardData
  variant?: "preloaded" | "rich"
  className?: string
}

export function FeedCard({ data, variant = "preloaded", className }: FeedCardProps) {
  const { head, text, quote, attachment, actions } = data

  const actionStats: StatProps[] = variant === "rich"
    ? [
        { icon: Heart, value: actions.likes, format: true },
        { icon: MessageCircle, value: actions.comments, format: true },
        { icon: Repeat2, value: actions.reposts ?? 0, format: true },
        { icon: Bookmark, value: actions.bookmarks, format: true },
      ]
    : [
        { icon: Eye, value: actions.views, format: true },
        { icon: MessageCircle, value: actions.comments, format: true },
        { icon: Bookmark, value: actions.bookmarks, format: true },
      ]

  return (
    <article className={cn(
      "border border-border rounded-[12px] bg-background shadow-sm p-2.5",
      variant === "rich" && "grid gap-[9px]",
      className
    )}>
      <FeedHead data={head} />
      <div className="ml-[42px] space-y-[9px]">
        <p className="text-[#173f4c] dark:text-foreground leading-relaxed text-sm">
          {text}
        </p>
        {quote && (
          <blockquote className="border-l-[3px] border-primary/30 rounded-r-md bg-primary/5 px-3 py-2 text-[13px] text-[#173f4c] dark:text-foreground">
            {quote}
          </blockquote>
        )}
        {attachment && <Attachment data={attachment} />}
        <div className="flex items-center justify-between mt-[5px]">
          <StatsRow stats={actionStats} />
          <button
            className="inline-flex items-center justify-center size-[30px] rounded-[9px] hover:bg-surface-secondary text-muted-foreground"
            aria-label="分享"
          >
            <Share2 className="size-4" />
          </button>
        </div>
      </div>
    </article>
  )
}
```

- [ ] **Step 2: 验证 typecheck**

```bash
cd apps/web && pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/content/feed-card.tsx
git commit -m "feat(content): add FeedCard component (preloaded + rich variants)"
```

---

### Task 7: HeroCarousel（首页 Hero 轮播）

**文件：**
- 新建：`apps/web/components/content/hero-carousel.tsx`

**接口：**
- 产出：`HeroCarousel`（`slides: HeroSlideData[]`, `autoPlayInterval?`, `className?`）
- 产出：`HeroSlideData` 类型导出
- 消耗：`Cover`, `StatsRow`, `Stat`（from local），`IconButton`（from `@/components/ui/icon-button`）

- [ ] **Step 1: 实现 HeroCarousel**

```tsx
// apps/web/components/content/hero-carousel.tsx
"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { ChevronLeft, ChevronRight, Eye, Heart, MessageCircle } from "lucide-react"
import { IconButton } from "@/components/ui/icon-button"
import { StatsRow } from "./stats-row"
import type { StatProps } from "./stats-row"
import { cn } from "@/lib/utils"

export interface HeroSlideData {
  title: string
  subtitle: string
  image: string
  bg1: string
  bg2: string
  accent: string
  stats?: {
    views: number
    likes: number
    comments: number
  }
}

interface HeroCarouselProps {
  slides: HeroSlideData[]
  autoPlayInterval?: number
  className?: string
}

export function HeroCarousel({ slides, autoPlayInterval = 5200, className }: HeroCarouselProps) {
  const [index, setIndex] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const restartTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setIndex(prev => (prev + 1) % slides.length)
    }, autoPlayInterval)
  }, [slides.length, autoPlayInterval])

  useEffect(() => {
    restartTimer()
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [restartTimer])

  const goTo = (i: number) => {
    setIndex(i)
    restartTimer()
  }

  const prev = () => goTo((index - 1 + slides.length) % slides.length)
  const next = () => goTo((index + 1) % slides.length)

  const slide = slides[index]

  const statsList: StatProps[] = slide.stats
    ? [
        { icon: Eye, value: slide.stats.views, format: true },
        { icon: Heart, value: slide.stats.likes, format: true },
        { icon: MessageCircle, value: slide.stats.comments, format: true },
      ]
    : []

  return (
    <div className={cn("relative overflow-hidden rounded-[12px]", className)}>
      {/* Cover */}
      <div
        className="relative aspect-[21/9] min-h-[320px]"
        style={{
          background: `linear-gradient(135deg, ${slide.bg1}, ${slide.bg2}), url(${slide.image}) center/cover`,
        }}
      >
        {/* Caption */}
        <div className="absolute inset-x-0 bottom-0 p-6"
          style={{
            background: `linear-gradient(transparent, ${slide.bg1})`,
          }}
        >
          <h1 className="text-white font-['Lexend'] text-[clamp(24px,3vw,32px)] leading-[1.08] font-bold mb-2">
            {slide.title}
          </h1>
          <p className="text-white/80 text-[15px] mb-3">{slide.subtitle}</p>
          {statsList.length > 0 && (
            <StatsRow stats={statsList} className="text-white [&_svg]:text-white [&_span]:text-white" />
          )}
        </div>
      </div>

      {/* Progress Track */}
      <div className="flex gap-1.5 px-4 py-2">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className="relative h-1 flex-1 rounded-full bg-surface-secondary overflow-hidden"
            aria-label={`切换到第 ${i + 1} 张`}
          >
            <div
              className={cn(
                "absolute inset-y-0 left-0 rounded-full transition-[width] duration-300",
                i === index ? "w-[72%]" : "w-0"
              )}
              style={{ backgroundColor: i === index ? slide.accent : "transparent" }}
            />
          </button>
        ))}
      </div>

      {/* Nav Arrows */}
      <IconButton
        label="上一张"
        size="compact"
        className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 text-white border-0"
        onClick={prev}
      >
        <ChevronLeft className="size-5" />
      </IconButton>
      <IconButton
        label="下一张"
        size="compact"
        className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 text-white border-0"
        onClick={next}
      >
        <ChevronRight className="size-5" />
      </IconButton>
    </div>
  )
}
```

- [ ] **Step 2: 验证 typecheck**

```bash
cd apps/web && pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/content/hero-carousel.tsx
git commit -m "feat(content): add HeroCarousel component with auto-play"
```

---

### Task 8: RankItem, HistoryItem, NotificationItem

**文件：**
- 新建：`apps/web/components/content/rank-item.tsx`
- 新建：`apps/web/components/content/history-item.tsx`
- 新建：`apps/web/components/content/notification-item.tsx`

**接口：**
- 产出：`RankItem` + `RankItemData`
- 产出：`HistoryItem` + `HistoryItemData` + `HistorySource`
- 产出：`NotificationItem` + `NotificationItemData` + `NotificationType`
- 消耗：`Cover`, `Pill`, `ProgressMini`, `MetaRow`, `StatsRow`, `Stat`（from local），`Avatar`, `Button` (from `@/components/ui/*`)

- [ ] **Step 1: 实现 RankItem**

```tsx
// apps/web/components/content/rank-item.tsx
import Link from "next/link"
import { Eye, Heart, MessageCircle } from "lucide-react"
import { Cover } from "./cover"
import { MetaRow } from "./meta-row"
import { Stat } from "./stats-row"
import { cn } from "@/lib/utils"

export interface RankItemData {
  rank: number
  cover: string
  title: string
  description: string
  delta: string
  author: {
    name: string
    fallbackText: string
    avatarUrl?: string
  }
  stats: {
    views: number
    likes: number
    comments: number
  }
  score: number
  scoreLabel: string
}

interface RankItemProps {
  data: RankItemData
  href: string
  className?: string
}

export function RankItem({ data, href, className }: RankItemProps) {
  const { rank, cover, title, description, delta, author, stats, score, scoreLabel } = data

  return (
    <Link
      href={href}
      className={cn(
        "grid gap-2.5 rounded-[12px] border border-border p-[9px]",
        "hover:border-primary transition-colors duration-150",
        className
      )}
      style={{ gridTemplateColumns: "46px 150px minmax(0, 1fr) auto" }}
    >
      {/* Rank Number */}
      <div className="flex items-center justify-center font-['Lexend'] text-lg font-bold text-primary">
        {String(rank).padStart(2, "0")}
      </div>

      {/* Cover */}
      <Cover src={cover} aspectRatio="16/10" className="rounded-[9px]" />

      {/* Body */}
      <div className="grid gap-[7px]">
        <div className="flex items-center gap-[7px]">
          <strong className="font-['Lexend'] text-[15px] font-bold line-clamp-2">{title}</strong>
          <span className="text-xs font-bold text-emerald-600 whitespace-nowrap">{delta}</span>
        </div>
        <p className="text-[13px] text-muted-foreground truncate">{description}</p>
        <MetaRow author={author} />
        <div className="flex items-center gap-2">
          <Stat icon={Eye} value={stats.views} format />
          <Stat icon={Heart} value={stats.likes} format />
          <Stat icon={MessageCircle} value={stats.comments} format />
        </div>
      </div>

      {/* Score */}
      <div className="flex flex-col items-end justify-center gap-[5px] min-w-[78px]">
        <span className="font-['Lexend'] text-xl font-bold text-primary">{score.toLocaleString()}</span>
        <span className="text-xs text-muted-foreground">{scoreLabel}</span>
      </div>
    </Link>
  )
}
```

- [ ] **Step 2: 实现 HistoryItem**

```tsx
// apps/web/components/content/history-item.tsx
import Link from "next/link"
import { Cover } from "./cover"
import { Pill } from "./pill"
import { ProgressMini } from "./progress-mini"
import { cn } from "@/lib/utils"

export type HistorySource = "首页" | "动态" | "榜单" | "PDF" | "搜索" | "合集"

export interface HistoryItemData {
  cover: string
  title: string
  author: string
  chapter: string
  source: HistorySource
  timeAgo: string
  progress: number
  progressLabel: string
}

interface HistoryItemProps {
  data: HistoryItemData
  href: string
  className?: string
}

export function HistoryItem({ data, href, className }: HistoryItemProps) {
  const { cover, title, author, chapter, source, timeAgo, progress, progressLabel } = data

  return (
    <Link
      href={href}
      className={cn(
        "grid rounded-[12px] border border-border overflow-hidden",
        "hover:border-primary transition-colors duration-150",
        className
      )}
      style={{ gridTemplateColumns: "104px minmax(0, 1fr)" }}
    >
      <Cover src={cover} aspectRatio="16/9" overlay className="rounded-none min-h-[92px]" />
      <div className="grid gap-1.5 p-2.5">
        <strong className="font-['Lexend'] text-[15px] font-bold line-clamp-2">{title}</strong>
        <div className="flex items-center justify-between gap-2 text-[12.5px] text-muted-foreground">
          <span className="truncate">{author} · {chapter}</span>
          <Pill variant="source">{source}</Pill>
        </div>
        <div className="text-[12.5px] text-muted-foreground">
          {timeAgo} · {progressLabel}
        </div>
        <ProgressMini value={progress} />
      </div>
    </Link>
  )
}
```

- [ ] **Step 3: 实现 NotificationItem**

```tsx
// apps/web/components/content/notification-item.tsx
import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { ArrowRight, Check, Bell, UserPlus } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type NotificationType = "update" | "notification"

export interface NotificationItemData {
  type: NotificationType
  icon: LucideIcon
  title: string
  author?: string
  detail?: string
  timeAgo: string
  action?: {
    label: string
    href?: string
    onClick?: () => void
    variant?: "arrow" | "follow" | "read" | "subscribed"
  }
}

interface NotificationItemProps {
  data: NotificationItemData
  className?: string
}

function MiniIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <div className="flex items-center justify-center size-[34px] rounded-[10px] bg-surface-secondary text-primary shrink-0">
      <Icon className="size-4" />
    </div>
  )
}

function renderAction(action: NotificationItemData["action"]) {
  if (!action) return null
  const { label, href, onClick, variant = "arrow" } = action

  switch (variant) {
    case "arrow":
      return href ? (
        <Link href={href} className="flex items-center gap-0.5 text-muted-foreground hover:text-foreground shrink-0">
          <span className="text-[13px] font-bold">{label}</span>
          <ArrowRight className="size-3.5" />
        </Link>
      ) : null
    case "follow":
      return (
        <Button variant="outline" size="sm" className="h-9 gap-1 border-emerald-300 text-emerald-700 shrink-0" onClick={onClick}>
          <UserPlus className="size-[14px]" />
          {label}
        </Button>
      )
    case "read":
      return (
        <button onClick={onClick} className="flex items-center gap-1 text-[13px] font-bold text-muted-foreground hover:text-foreground shrink-0">
          <Check className="size-3.5" />
          {label}
        </button>
      )
    case "subscribed":
      return (
        <button onClick={onClick} className="flex items-center gap-1 text-[13px] font-bold text-emerald-600 shrink-0">
          <Bell className="size-3.5" />
          {label}
        </button>
      )
    default:
      return null
  }
}

export function NotificationItem({ data, className }: NotificationItemProps) {
  const { type, icon, title, author, detail, timeAgo, action } = data

  return (
    <div className={cn(
      "grid gap-2.5 rounded-[10px] border border-border p-2.5",
      className
    )}
    style={{ gridTemplateColumns: "auto minmax(0, 1fr) auto" }}>
      {type === "update" ? (
        <MiniIcon icon={icon} />
      ) : (
        <Avatar className="size-[28px] shrink-0">
          <AvatarImage src={undefined} alt={author ?? ""} />
          <AvatarFallback>{author?.[0] ?? "?"}</AvatarFallback>
        </Avatar>
      )}
      <div className="min-w-0">
        <strong className="text-sm font-bold line-clamp-2">{title}</strong>
        <div className="text-[13px] text-muted-foreground truncate mt-0.5">
          {author && <span>{author} · </span>}
          {detail && <span>{detail} · </span>}
          {timeAgo}
        </div>
      </div>
      {renderAction(action)}
    </div>
  )
}
```

- [ ] **Step 4: 验证 typecheck**

```bash
cd apps/web && pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/content/rank-item.tsx apps/web/components/content/history-item.tsx apps/web/components/content/notification-item.tsx
git commit -m "feat(content): add RankItem, HistoryItem, NotificationItem components"
```

---

### Task 9: Composer + ProfileHero + MiniPageCard

**文件：**
- 新建：`apps/web/components/content/composer.tsx`
- 新建：`apps/web/components/content/profile-hero.tsx`
- 新建：`apps/web/components/content/mini-page-card.tsx`

**接口：**
- 产出：`Composer`（`userFallbackText`, `userAvatarUrl?`, `onSubmit?`, `className?`）
- 产出：`ProfileHero`（`data: ProfileHeroData`, `className?`）+ `ProfileHeroData`
- 产出：`MiniPageCard`（`data: MiniPageCardData`, `href: string`, `className?`）+ `MiniPageCardData`
- 消耗：`Avatar`, `Button`, `Pill`, `StatsRow`, `Stat`, `Cover`, `Attachment`（from local/ui）

- [ ] **Step 1: 实现 Composer**

```tsx
// apps/web/components/content/composer.tsx
"use client"

import { useState } from "react"
import { Link as LinkIcon, Image, Send } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ComposerProps {
  userFallbackText: string
  userAvatarUrl?: string
  onSubmit?: (text: string) => void
  className?: string
}

export function Composer({ userFallbackText, userAvatarUrl, onSubmit, className }: ComposerProps) {
  const [text, setText] = useState("")

  const handleSubmit = () => {
    if (!text.trim()) return
    onSubmit?.(text)
    setText("")
  }

  return (
    <div className={cn("grid gap-2.5", className)}>
      <div className="grid grid-cols-[auto_1fr] gap-2.5 items-start">
        <Avatar className="size-[34px] shrink-0">
          <AvatarImage src={userAvatarUrl} alt={userFallbackText} />
          <AvatarFallback>{userFallbackText}</AvatarFallback>
        </Avatar>
        <div className="grid gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="分享你的想法..."
            className="w-full min-h-[78px] rounded-[10px] border border-border bg-background p-3 text-sm resize-y focus:outline-none focus:border-primary placeholder:text-muted-foreground"
          />
        </div>
      </div>
      <div className="flex items-center justify-between pl-[44px]">
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="inline-flex items-center justify-center size-9 rounded-[9px] hover:bg-surface-secondary text-muted-foreground"
            aria-label="添加链接"
          >
            <LinkIcon className="size-4" />
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center size-9 rounded-[9px] hover:bg-surface-secondary text-muted-foreground"
            aria-label="添加图片"
          >
            <Image className="size-4" />
          </button>
        </div>
        <Button onClick={handleSubmit} disabled={!text.trim()} size="sm" className="gap-1.5 min-h-[38px]">
          <Send className="size-3.5" />
          发布
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 实现 ProfileHero**

```tsx
// apps/web/components/content/profile-hero.tsx
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { UserPlus } from "lucide-react"
import { Pill } from "./pill"
import { cn } from "@/lib/utils"
import { formatCount } from "@/lib/utils/format"

export interface ProfileHeroData {
  fallbackText: string
  avatarUrl?: string
  name: string
  handle: string
  tagline: string
  stats: {
    followers: number
    pages: number
    mutualFollows?: number
  }
}

interface ProfileHeroProps {
  data: ProfileHeroData
  className?: string
}

export function ProfileHero({ data, className }: ProfileHeroProps) {
  const { fallbackText, avatarUrl, name, handle, tagline, stats } = data

  return (
    <div className={cn(
      "grid gap-[14px] items-center p-[14px] rounded-[12px] border border-border bg-background shadow-sm",
      className
    )}
    style={{ gridTemplateColumns: "58px 1fr auto" }}>
      <Avatar className="size-[58px] shrink-0">
        <AvatarImage src={avatarUrl} alt={name} />
        <AvatarFallback>{fallbackText}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <h1 className="font-['Lexend'] text-[26px] leading-[1.1] font-bold truncate">{name}</h1>
        <div className="text-[13px] text-muted-foreground mt-1">
          {handle} · {tagline}
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          <Pill variant="default">{formatCount(stats.followers)} 关注者</Pill>
          <Pill variant="default">{stats.pages} 页面</Pill>
          {stats.mutualFollows != null && (
            <Pill variant="default">{stats.mutualFollows} 共同关注</Pill>
          )}
        </div>
      </div>
      <Button variant="outline" size="sm" className="h-9 gap-1 border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400 shrink-0">
        <UserPlus className="size-[14px]" />
        关注
      </Button>
    </div>
  )
}
```

- [ ] **Step 3: 实现 MiniPageCard**

```tsx
// apps/web/components/content/mini-page-card.tsx
import Link from "next/link"
import { Eye, Heart } from "lucide-react"
import { Cover } from "./cover"
import { StatsRow } from "./stats-row"
import type { StatProps } from "./stats-row"
import { cn } from "@/lib/utils"

export interface MiniPageCardData {
  cover: string
  title: string
  description: string
  authorName: string
  stats: {
    views: number
    likes: number
  }
}

interface MiniPageCardProps {
  data: MiniPageCardData
  href: string
  className?: string
}

export function MiniPageCard({ data, href, className }: MiniPageCardProps) {
  const { cover, title, description, authorName, stats } = data

  const detailStats: StatProps[] = [
    { icon: Eye, value: stats.views, format: true },
    { icon: Heart, value: stats.likes, format: true },
  ]

  return (
    <Link
      href={href}
      className={cn(
        "grid gap-[9px] rounded-[10px] border border-border p-[7px]",
        "hover:border-primary transition-colors duration-150",
        className
      )}
      style={{ gridTemplateColumns: "92px 1fr" }}
    >
      <Cover src={cover} aspectRatio="16/9" className="rounded-[7px]" />
      <div className="grid gap-0.5 min-w-0">
        <strong className="text-[14px] font-bold truncate">{title}</strong>
        <p className="text-[13px] text-muted-foreground truncate">{description}</p>
        <StatsRow stats={detailStats} />
      </div>
    </Link>
  )
}
```

- [ ] **Step 4: 验证 typecheck**

```bash
cd apps/web && pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/content/composer.tsx apps/web/components/content/profile-hero.tsx apps/web/components/content/mini-page-card.tsx
git commit -m "feat(content): add Composer, ProfileHero, MiniPageCard components"
```

---

### Task 10: PageMeta（页面元数据面板）

**文件：**
- 新建：`apps/web/components/content/page-meta.tsx`

**接口：**
- 产出：`PageMeta`（`data: PageMetaData`, `defaultExpanded?`, `className?`）
- 产出：`PageMetaData` 类型导出
- 消耗：`Avatar`, `Button`, `Pill`, `StatsRow`, `Stat`, `SectionHead`, `ProgressMini`, `MiniPageCard`（from local/ui）

- [ ] **Step 1: 实现 PageMeta**

```tsx
// apps/web/components/content/page-meta.tsx
"use client"

import { useState } from "react"
import { ChevronRight, Eye, Bookmark, Share2, Heart } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { UserPlus } from "lucide-react"
import { Pill } from "./pill"
import { StatsRow } from "./stats-row"
import type { StatProps } from "./stats-row"
import { SectionHead } from "./section-head"
import { ProgressMini } from "./progress-mini"
import { MiniPageCard } from "./mini-page-card"
import type { MiniPageCardData } from "./mini-page-card"
import { cn } from "@/lib/utils"
import { formatCount } from "@/lib/utils/format"

export interface PageMetaData {
  author: {
    name: string
    fallbackText: string
    avatarUrl?: string
    followerCount: number
  }
  title: string
  uid: string
  sidePageUid?: string
  description: string[]
  tags: string[]
  stats: {
    views: number
    bookmarks: number
    date: string
  }
  actions: {
    likes: number
    bookmarks: number
    shares: number
  }
  chapters?: {
    number: number
    title: string
    status?: string
  }[]
  chapterProgress?: {
    current: number
    total: number
  }
  recommendations?: MiniPageCardData[]
}

interface PageMetaProps {
  data: PageMetaData
  defaultExpanded?: boolean
  className?: string
}

export function PageMeta({ data, defaultExpanded = false, className }: PageMetaProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const { author, title, uid, sidePageUid, description, tags, stats, actions, chapters, chapterProgress, recommendations } = data

  const actionButtons = [
    { icon: Heart, label: formatCount(actions.likes), value: actions.likes },
    { icon: Bookmark, label: formatCount(actions.bookmarks), value: actions.bookmarks },
    { icon: Share2, label: formatCount(actions.shares), value: actions.shares },
  ]

  return (
    <div className={cn("grid gap-[11px]", className)}>
      {/* Author */}
      <div className="grid grid-cols-[auto_1fr_auto] gap-[9px] items-center">
        <Avatar className="size-[34px]">
          <AvatarImage src={author.avatarUrl} alt={author.name} />
          <AvatarFallback>{author.fallbackText}</AvatarFallback>
        </Avatar>
        <div className="grid gap-[3px] min-w-0">
          <div className="font-bold text-sm truncate">{author.name}</div>
          <div className="text-[12.5px] text-muted-foreground">
            {formatCount(author.followerCount)} 位关注者
          </div>
        </div>
        <Button variant="outline" size="sm" className="h-9 gap-1 border-emerald-300 text-emerald-700 shrink-0">
          <UserPlus className="size-[14px]" />
          关注
        </Button>
      </div>

      {/* Title Row */}
      <div className="grid grid-cols-[1fr_auto] gap-2 items-start">
        <h3 className="font-['Lexend'] text-xl font-bold leading-tight">{title}</h3>
        <button
          onClick={() => setExpanded(!expanded)}
          className="inline-flex items-center justify-center size-8 rounded-[9px] hover:bg-surface-secondary text-muted-foreground shrink-0"
          aria-label={expanded ? "收起详情" : "展开详情"}
        >
          <ChevronRight className={cn("size-5 transition-transform", expanded && "rotate-90")} />
        </button>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <Stat icon={Eye} value={stats.views} format />
        <Stat icon={Bookmark} value={stats.bookmarks} format />
        <span>{stats.date}</span>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-3 gap-[7px]">
        {actionButtons.map((btn, i) => (
          <button
            key={i}
            className="flex flex-col items-center justify-center gap-0.5 min-h-[62px] rounded-[13px] bg-surface-secondary hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
          >
            <btn.icon className="size-5" />
            <span className="text-[13px] font-bold">{btn.label}</span>
          </button>
        ))}
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="grid gap-[7px] text-sm text-muted-foreground leading-relaxed">
          <div className="text-[13px]">
            UID: {uid}{sidePageUid && <> · 副页: {sidePageUid}</>}
          </div>
          {description.map((p, i) => (
            <p key={i} className="max-w-[760px]">{p}</p>
          ))}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {tags.map((tag) => (
                <Pill key={tag} variant="tag">{tag}</Pill>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Chapters */}
      {chapters && chapters.length > 0 && (
        <div className="grid gap-2 pt-0.5">
          <SectionHead
            title="合集"
            actionLabel={chapterProgress ? `${chapterProgress.current} / ${chapterProgress.total}` : undefined}
            actionHref={undefined}
          />
          <div className="grid gap-1.5">
            {chapters.map((ch) => (
              <div
                key={ch.number}
                className="grid gap-2 items-center rounded-[9px] px-2.5 min-h-[38px] hover:bg-surface-secondary cursor-pointer"
                style={{ gridTemplateColumns: "auto 1fr auto" }}
              >
                <Pill variant="rank">{String(ch.number).padStart(2, "0")}</Pill>
                <span className="font-bold text-sm truncate">{ch.title}</span>
                {ch.status && (
                  <span className="text-[12.5px] text-muted-foreground">{ch.status}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recommendations && recommendations.length > 0 && (
        <div className="grid gap-2">
          <SectionHead title="推荐" />
          <div className="grid gap-2">
            {recommendations.map((rec, i) => (
              <MiniPageCard key={i} data={rec} href={`/read/${rec.authorName}/${i}`} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

**注意：** `Stat` 组件在 `page-meta.tsx` 中直接使用，需要从 `stats-row.tsx` 导入。

- [ ] **Step 2: 验证 typecheck**

```bash
cd apps/web && pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/content/page-meta.tsx
git commit -m "feat(content): add PageMeta component with expandable details"
```

---

### Task 11: Mock 数据文件

**文件：**
- 新建：`apps/web/lib/mock/slides.ts`
- 新建：`apps/web/lib/mock/home-feed.ts`
- 新建：`apps/web/lib/mock/pages.ts`
- 新建：`apps/web/lib/mock/authors.ts`
- 新建：`apps/web/lib/mock/rank.ts`
- 新建：`apps/web/lib/mock/history.ts`
- 新建：`apps/web/lib/mock/notifications.ts`
- 新建：`apps/web/lib/mock/read-page-meta.ts`

**接口：**
- 产出：各 mock 数据文件的类型化导出
- 消耗：所有组件数据类型（`PageCardData`, `AuthorCardData`, `FeedCardData`, `HeroSlideData`, `RankItemData`, `HistoryItemData`, `NotificationItemData`, `PageMetaData`）

- [ ] **Step 1: 创建 slides.ts**

从 index.html `carouselSlides` (L3319) 提取：

```typescript
// apps/web/lib/mock/slides.ts
import type { HeroSlideData } from "@/components/content/hero-carousel"

export const mockSlides: HeroSlideData[] = [
  {
    title: "深度学习在自然语言处理中的应用",
    subtitle: "从 Transformer 到 GPT，探索 NLP 的前沿技术",
    image: "",
    bg1: "#0891b2",
    bg2: "#06b6d4",
    accent: "#22d3ee",
    stats: { views: 12800, likes: 2340, comments: 456 },
  },
  {
    title: "交互式数据可视化指南",
    subtitle: "用 D3.js 和 WebGL 创建沉浸式数据体验",
    image: "",
    bg1: "#7c3aed",
    bg2: "#a855f7",
    accent: "#c084fc",
    stats: { views: 9500, likes: 1820, comments: 321 },
  },
  {
    title: "Rust 异步编程深度解析",
    subtitle: "理解 Future、Waker 与 async/await 的底层机制",
    image: "",
    bg1: "#059669",
    bg2: "#10b981",
    accent: "#34d399",
    stats: { views: 7200, likes: 1560, comments: 278 },
  },
  {
    title: "设计系统从零搭建实践",
    subtitle: "组件库、设计 Token 与跨平台一致性",
    image: "",
    bg1: "#ea580c",
    bg2: "#f97316",
    accent: "#fb923c",
    stats: { views: 6100, likes: 1230, comments: 198 },
  },
]
```

- [ ] **Step 2: 创建 pages.ts**

```typescript
// apps/web/lib/mock/pages.ts
import type { PageCardData } from "@/components/content/page-card"

export const mockFeaturedPages: PageCardData[] = [
  {
    cover: "linear-gradient(135deg, #0891b2, #06b6d4)",
    title: "Transformer 架构详解：从 Attention 到应用",
    author: { name: "李明", fallbackText: "李" },
    timeAgo: "2天前",
    stats: { views: 23400, comments: 456 },
  },
  {
    cover: "linear-gradient(135deg, #7c3aed, #a855f7)",
    title: "React Server Components 完全指南",
    author: { name: "王小红", fallbackText: "王" },
    timeAgo: "5天前",
    stats: { views: 18700, comments: 321 },
  },
  {
    cover: "linear-gradient(135deg, #059669, #10b981)",
    title: "Rust 异步编程：从入门到实践",
    author: { name: "张伟", fallbackText: "张" },
    timeAgo: "1周前",
    stats: { views: 15200, comments: 234 },
  },
]

export const mockRecommendedPages: PageCardData[] = [
  {
    cover: "linear-gradient(135deg, #ea580c, #f97316)",
    title: "设计系统实战：Figma 到代码",
    author: { name: "赵丽", fallbackText: "赵" },
    timeAgo: "3天前",
    stats: { views: 8900, comments: 145 },
  },
  {
    cover: "linear-gradient(135deg, #2563eb, #3b82f6)",
    title: "TypeScript 类型体操进阶",
    author: { name: "陈刚", fallbackText: "陈" },
    timeAgo: "6天前",
    stats: { views: 6700, comments: 89 },
  },
  {
    cover: "linear-gradient(135deg, #be185d, #ec4899)",
    title: "CSS Container Queries 实战",
    author: { name: "刘芳", fallbackText: "刘" },
    timeAgo: "4天前",
    stats: { views: 5400, comments: 67 },
  },
]

export const mockCategoryPages: PageCardData[] = [
  {
    cover: "linear-gradient(135deg, #0891b2, #06b6d4)",
    title: "大语言模型幻觉问题研究综述",
    description: "系统梳理 LLM 幻觉的类型、成因与缓解策略",
    author: { name: "李明", fallbackText: "李" },
    timeAgo: "2天前",
    stats: { views: 23400, likes: 1230, comments: 456, bookmarks: 890 },
  },
  {
    cover: "linear-gradient(135deg, #7c3aed, #a855f7)",
    title: "WebAssembly 在浏览器中的应用前景",
    description: "WASM 如何改变 Web 应用的性能边界",
    author: { name: "王小红", fallbackText: "王" },
    timeAgo: "5天前",
    stats: { views: 18700, likes: 980, comments: 321, bookmarks: 670 },
  },
  {
    cover: "linear-gradient(135deg, #059669, #10b981)",
    title: "分布式系统一致性协议比较",
    description: "Paxos vs Raft vs Zab — 共识算法的工程实践",
    author: { name: "张伟", fallbackText: "张" },
    timeAgo: "1周前",
    stats: { views: 15200, likes: 760, comments: 234, bookmarks: 450 },
  },
  {
    cover: "linear-gradient(135deg, #ea580c, #f97316)",
    title: "从零实现一个 GraphQL 服务器",
    description: "用 Rust 和 async-graphql 构建高性能 API",
    author: { name: "赵丽", fallbackText: "赵" },
    timeAgo: "3天前",
    stats: { views: 8900, likes: 430, comments: 145, bookmarks: 320 },
  },
]
```

- [ ] **Step 3: 创建 authors.ts, home-feed.ts, rank.ts, history.ts, notifications.ts, read-page-meta.ts**

按照 index.html 中对应数据结构，创建类型化的 mock 数据文件。每个文件导出 `mock*` 命名的数组/对象。

- [ ] **Step 4: 验证 typecheck**

```bash
cd apps/web && pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/mock/
git commit -m "feat(mock): add mock data files for all 9 implemented pages"
```

---

## 构建依赖图

```
Task 1 (Cover,Pill,ProgressMini) ─┬─ Task 3 (PageCard)
                                  ├─ Task 4 (AuthorCard,FeedHead)
                                  ├─ Task 5 (Attachment)
                                  ├─ Task 7 (HeroCarousel)
                                  ├─ Task 8 (RankItem,HistoryItem,NotificationItem)
                                  ├─ Task 9 (Composer,ProfileHero,MiniPageCard)
                                  └─ Task 10 (PageMeta)

Task 2 (StatsRow,MetaRow,SectionHead) ─┬─ Task 3
                                       ├─ Task 4
                                       ├─ Task 5
                                       ├─ Task 7
                                       ├─ Task 8
                                       ├─ Task 9
                                       └─ Task 10

Task 4 (FeedHead) ──────── Task 6 (FeedCard)
Task 5 (Attachment) ──────── Task 6 (FeedCard)

Task 11 (Mock Data) — 依赖所有组件类型，最后执行
```

**推荐执行顺序：** 1 → 2 → 3,4,5 并行 → 6 → 7,8 并行 → 9 → 10 → 11

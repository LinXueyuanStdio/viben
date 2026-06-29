# Viben Web 页面内容组件设计规范

> **参考原型**: `pages/web/index.html` (3823 行 vanilla HTML/CSS/JS SPA)
> **关联文档**: `docs/superpowers/specs/2026-06-29-viben-web-page-framework-design.md` (页面框架，Phase 1 已完成)
> **调研报告**: 3 个 subagent 交叉对照（index.html CSS 目录 × apps/web 现有组件 × 路由映射）

## 一、概述

### 目标

将 index.html 中 9 个已实现页面（home, category, search, read, moment, leaderboard, notifications, author, history）的内容组件提取为 React 组件，共 **19 个新建 + 6 个适配**，分 4 批构建。

### 与 Phase 1 的关系

Phase 1 已完成页面框架（AppShell, Topbar, Sidebar, BreadcrumbNav, VibenTabs, ReadDrawer, GlobalSearch, NavPopover, IconButton, Popover, SearchPageContent 等），Phase 2 在此框架内填充页面内容组件。

### 设计原则

- **组件驱动**：先建组件，后组装页面
- **mock 数据先行**：所有组件通过 props 接收数据，mock 数据集中管理
- **渐进增强**：先静态展示，后续接入真实 API
- **YAGNI**：只建 9 个已实现页面需要的组件，不提前建 \_fragments/ 中的 18 个待开发页面组件
- **复用 apps/web 现有**：Avatar, Badge, Progress, Card, Button, CommentItem — 不重复造轮子

## 二、组件全景图

```
┌─────────────────────────────────────────────────────────┐
│ 第四批：页面特定区块                                     │
│ Composer, ProfileHero, MiniPageCard, PageMeta            │
├─────────────────────────────────────────────────────────┤
│ 第三批：复合内容块                                       │
│ FeedCard, HeroCarousel, RankItem, HistoryItem,           │
│ NotificationItem                                         │
├─────────────────────────────────────────────────────────┤
│ 第二批：卡片组件                                         │
│ PageCard, AuthorCard, FeedHead, Attachment               │
├─────────────────────────────────────────────────────────┤
│ 第一批：基础 UI 原语                                     │
│ Cover, Pill, StatsRow/Stat, MetaRow, SectionHead,        │
│ ProgressMini                                             │
├─────────────────────────────────────────────────────────┤
│ apps/web 已有（复用/适配）                                │
│ Avatar, Badge, Progress, Card, Button, CommentItem       │
└─────────────────────────────────────────────────────────┘
```

## 三、第一批：基础 UI 原语

### 3.1 Cover

**用途**: 页面封面图/渐变展示，`--cover` CSS 变量驱动。用于 PageCard、Attachment、HistoryItem、RankItem、MiniPageCard、HeroCarousel。

**文件**: `apps/web/components/content/cover.tsx`

```typescript
interface CoverProps {
  /** CSS gradient 或图片 URL（对应 --cover） */
  src: string
  /** 宽高比，默认 16/9 */
  aspectRatio?: "16/9" | "16/10"
  /** 是否显示底部渐变浮层 */
  overlay?: boolean
  /** 浮层内内容（如 stats） */
  children?: ReactNode
  className?: string
}
```

**变体**:
- `aspectRatio="16/9"` — 默认，PageCard、Attachment、HeroCarousel
- `aspectRatio="16/10"` — RankItem
- `overlay=true` — 底部渐变叠加层（HeroCarousel、HistoryItem、Attachment）
- `overlay=false` — 纯封面（PageCard standard）

**参考 CSS**: index.html L1331-1347 (`.attachment .thumb`), L2157-2163 (`.rank-cover`), L1480-1505 (`.history-thumb`)

---

### 3.2 Pill

**用途**: 小型标签/标记。扩展 apps/web 已有 Badge，增加 kind/source/rank 变体。

**文件**: `apps/web/components/content/pill.tsx`

```typescript
interface PillProps {
  children: ReactNode
  /** 变体类型 */
  variant?: "default" | "kind" | "source" | "rank" | "tag"
  className?: string
}
```

**变体对照** (index.html CSS):

| variant | CSS 类 | 样式 | 用途 |
|---------|--------|------|------|
| `default` | `.pill` | 浅青背景，12.5px 粗体 | 统计数、通用标签 |
| `kind` | `.pill` (in `.feed-name`) | 同 default，灰色调 | 动态类型（发布/转发/评论…） |
| `source` | `.source-pill` | 绿色背景 `#e8faf6`，绿色字 | 来源标识（首页/动态/榜单/PDF） |
| `rank` | `.pill` (in `.rank-item`) | Lexend 字体，主色 | 排行榜编号 01/02/03 |
| `tag` | `.tag` | 绿色背景，12.5px 粗体 | 内容标签（视觉小说/连载…） |

**参考 CSS**: index.html L1139-1152 (`.pill`), L1642-1653 (`.source-pill`), L1713-1723 (`.tag`)

---

### 3.3 StatsRow / Stat

**用途**: 图标 + 数字统计行。全站复用 60+ 处。

**文件**: `apps/web/components/content/stats-row.tsx`

```typescript
interface StatProps {
  icon: LucideIcon
  value: number | string
  /** 是否用 formatCount 格式化（K/M） */
  format?: boolean
  className?: string
}

interface StatsRowProps {
  stats: StatProps[]
  className?: string
}
```

**参考 CSS**: index.html L1091-1098 (`.meta-row`, `.stats-row`), L1129-1137 (`.stat`)

**设计要点**:
- `Stat` 为 `inline-flex`，图标 14px + 数字 12.5px
- `StatsRow` 为 `flex row`，7px 间距，自动换行
- 颜色用 `text-muted-foreground`
- `format=true` 时调用 `@/lib/utils/format` 的 `formatCount`

---

### 3.4 MetaRow

**用途**: 作者信息行 — 头像 + 名称 + dot 分隔符 + 时间。用于 PageCard、SearchResultCard、RankItem 等。

**文件**: `apps/web/components/content/meta-row.tsx`

```typescript
interface MetaAuthorProps {
  /** 头像初始字母（无图片时） */
  fallbackText: string
  /** 头像图片 URL（可选） */
  avatarUrl?: string
  name: string
  className?: string
}

interface MetaRowProps {
  author: MetaAuthorProps
  /** 分隔符后的次要信息（如时间、来源） */
  meta?: string[]
  /** 右侧统计信息 */
  stats?: StatProps[]
  className?: string
}
```

**渲染模式**:

```
[Avatar(28px)] [作者名粗体] · [时间] · [来源]  |  [👁 1.2k] [💬 89]
```

**参考 CSS**: index.html L1091-1115 (`.meta-row`, `.meta-author`)

**设计要点**:
- `MetaAuthor` 使用 apps/web 已有 `Avatar` 组件（`size="sm"`）
- 分隔符用 `·` 字符（或 3px dot 元素），颜色 `text-muted-foreground`
- 时间/来源等 `meta[]` 以 dot 分隔追加

---

### 3.5 SectionHead

**用途**: 分区标题行 — 左侧标题 + 右侧操作链接/按钮。全站复用 18 处。

**文件**: `apps/web/components/content/section-head.tsx`

```typescript
interface SectionHeadProps {
  title: string
  /** 右侧链接文字（如 "更多"、"换一批"、"查看"） */
  actionLabel?: string
  /** 右侧链接 href */
  actionHref?: string
  /** 右侧自定义内容（替代 actionLabel/actionHref） */
  children?: ReactNode
  className?: string
}
```

**渲染模式**:

```
┌─ 精选页面 ───────────────────────────── 更多 → ─┐
```

**参考 CSS**: index.html L785-809 (`.section-head`, `.section-title`, `.section-link`)

**设计要点**:
- `title` 使用 `Lexend` 字体，17px，粗体 700
- `actionLabel` + `actionHref` 渲染为 `Link`（Next.js），主色，14px 粗体
- 右侧也可传入自定义 `children`（如 `Pill` 或 `Button`），此时忽略 actionLabel/actionHref

---

### 3.6 ProgressMini

**用途**: 紧凑横条进度条（4px 高），用于 HistoryItem、合集进度。适配 apps/web 已有 `Progress` 组件。

**文件**: `apps/web/components/content/progress-mini.tsx`

```typescript
interface ProgressMiniProps {
  /** 进度百分比 0-100 */
  value: number
  className?: string
}
```

**参考 CSS**: index.html L1655-1668 (`.progress-mini`)

**设计要点**:
- 高度 4px（vs 标准 Progress 的 8px）
- 轨道色 `bg-surface-secondary`，填充色渐变 `from-primary to-cta`
- `value` 映射到 Radix Progress 的 `value` prop

---

## 四、第二批：卡片组件

### 4.1 PageCard

**用途**: 页面卡片，grid 布局中的基本单元。两个变体。

**文件**: `apps/web/components/content/page-card.tsx`

```typescript
interface PageCardData {
  cover: string           // --cover 值（渐变或图片 URL）
  title: string
  description?: string
  author: {
    name: string
    fallbackText: string  // 头像初始字母
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
  /** 卡片变体 */
  variant?: "default" | "home"
  href: string
  className?: string
}
```

**变体对照**:

```
┌── default ──────────────────────────────────────┐
│ ┌──────────────────┐                             │
│ │     Cover        │  16:9, overlay=false        │
│ └──────────────────┘                             │
│  Title (2-line clamp)                            │
│  Description (1-line ellipsis)                   │
│  [Avatar] 作者名 · 3天前                          │
│  👁 2.3k  🔖 156  💬 89                          │
└──────────────────────────────────────────────────┘

┌── home ─────────────────────────────────────────┐
│ ┌──────────────────┐                             │
│ │     Cover        │  16:9, overlay=true          │
│ │  👁 2.3k  💬 89  │  stats 浮在封面底部           │
│ └──────────────────┘                             │
│  Title (2-line clamp)                            │
│  作者名 · 3天前                                   │
└──────────────────────────────────────────────────┘
```

**参考 CSS**: index.html L969-977 (`.page-card-grid`), L1048-1065 (`.home-card-meta`), L1067-1089 (`.card-title`, `.card-desc`)

**设计要点**:
- 使用 `Cover` 组件渲染封面
- `variant="home"` 时封面叠加 stats 浮层（`Cover` overlay=true + children）
- 使用 `MetaRow` 渲染作者信息行
- 使用 `StatsRow` 渲染统计行
- 卡片容器使用 apps/web `Card` 组件（或直接 div + border/radius/shadow 类）
- 响应式：grid 中 3 列 → 2 列 → 1 列（Tailwind `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`）

---

### 4.2 AuthorCard

**用途**: 作者推荐卡片，用于侧边栏。全站复用 5 处。

**文件**: `apps/web/components/content/author-card.tsx`

```typescript
interface AuthorCardData {
  fallbackText: string
  avatarUrl?: string
  name: string
  handle: string        // @用户名
  description: string
  pageCount: number
  followerCount: number
  representativeWork?: string  // 代表作品
  mutualFollows?: number       // 共同关注数
}

interface AuthorCardProps {
  data: AuthorCardData
  className?: string
}
```

**渲染模式**:

```
┌──────────────────────────────────────┐
│ [Avatar]  名称                        │
│           用户名 · 简介                │
│           页面 N · 关注者 N            │
│                        [+ 关注]       │
│  代表作：《xxx》· N 人共同关注          │
└──────────────────────────────────────┘
```

**参考 CSS**: index.html L1427-1462 (`.author-card`, `.author-name`, `.author-bio`, `.follow-btn`)

**设计要点**:
- 使用 apps/web `Avatar` 组件（默认 34px）
- `handle` + `description` 用 `text-muted-foreground`，13px
- `StatsRow` 渲染 followerCount + pageCount + mutualFollows
- "关注" 按钮用 apps/web `Button` variant="outline"，绿色调

---

### 4.3 FeedHead

**用途**: 动态卡片头部 — 头像 + 名称 + 类型标签 + 用户名/时间 + 更多按钮。FeedCard 的子组件。

**文件**: `apps/web/components/content/feed-head.tsx`

```typescript
type FeedKind = "更新" | "发布" | "转发" | "评论" | "收藏" | "模板" | "数据" | "合集" | "论文" | "笔记"

interface FeedHeadData {
  fallbackText: string
  avatarUrl?: string
  name: string
  handle: string         // @用户名
  kind: FeedKind         // 动态类型
  timeAgo: string
  source?: string        // 来源（如 "来自 研究组"）
}

interface FeedHeadProps {
  data: FeedHeadData
  className?: string
}
```

**渲染模式**:

```
┌──────────────────────────────────────────────┐
│ [Avatar]  张三  发布页面                      │
│            @zhangsan · 2小时前 · 来自 研究组   │
└──────────────────────────────────────────────┘
```

**参考 CSS**: index.html L1171-1217 (`.feed-head`, `.feed-name`, `.feed-handle`, `.feed-context`)

**设计要点**:
- 三列 grid：`[Avatar 34px] [name+handle] [more button]`
- `kind` 渲染为 `Pill variant="kind"`
- `handle` + `timeAgo` + `source` 渲染为 dot 分隔行
- 更多按钮用 `IconButton`（Phase 1）

---

### 4.4 Attachment

**用途**: 动态中嵌入的页面预览卡片。FeedCard 和 Composer 的子组件。

**文件**: `apps/web/components/content/attachment.tsx`

```typescript
interface AttachmentData {
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
  /** 是否显示移除按钮（composer 中使用） */
  onRemove?: () => void
  className?: string
}
```

**渲染模式**:

```
┌─────────────────────────────────────┐
│ ┌────────────────────────────────┐  │
│ │          Cover (16:9)          │  │
│ │                    👁 1.2k 💬 89│  │
│ └────────────────────────────────┘  │
│  Title (bold, 2-line clamp)         │
│  作者名 · 3天前                      │
└─────────────────────────────────────┘
```

**参考 CSS**: index.html L1315-1385 (`.attachment`, `.attachment .thumb`, `.attachment-info`, `.attachment-title`, `.attachment-meta`)

**设计要点**:
- 最大宽度 520px
- 使用 `Cover` 组件（overlay=true，children 为 stats）
- 标题 14.5px 粗体，2 行截断
- 作者+时间用 `MetaRow` 的变体渲染
- `onRemove` 存在时显示删除按钮（Composer 中）

---

## 五、第三批：复合内容块

### 5.1 FeedCard

**用途**: 动态卡片，首页（轻量）和动态页（富文本）两种变体。

**文件**: `apps/web/components/content/feed-card.tsx`

```typescript
interface FeedCardData {
  head: FeedHeadData
  text: string             // 正文
  quote?: string           // 引用文本（rich 变体）
  attachment?: AttachmentData  // 嵌入页面（可选）
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
```

**变体对照**:

```
┌── preloaded（首页动态）──────────────────────┐
│ FeedHead                                     │
│   正文内容...（最多 3 行）                     │
│   ┌ Attachment ┐                             │
│   └────────────┘                             │
│   👁 2.3k  💬 89  🔖 156      📤            │
└──────────────────────────────────────────────┘

┌── rich（动态页）─────────────────────────────┐
│ FeedHead                                     │
│   正文内容...                                  │
│   ┃ 引用文本（blockquote 样式）                 │
│   ┌ Attachment ┐                             │
│   └────────────┘                             │
│   ❤ 1.2k  💬 340  🔄 56  🔖 89   📤        │
└──────────────────────────────────────────────┘
```

**参考 CSS**: index.html L1154-1169 (`.feed-card`, `.feed-card.rich`, `.feed-card.preloaded`), L1231-1240 (`.feed-quote`), L1387-1420 (`.actions`, `.action-group`, `.action-btn`)

**设计要点**:
- 使用 `FeedHead` 渲染头部
- 正文区域 `margin-left: 42px`（头像下方缩进）
- `quote` 存在时渲染 `blockquote`：左边框 3px 主色，浅青背景
- `attachment` 存在时渲染 `Attachment` 组件
- `variant="rich"` 时显示完整操作栏（like+comment+repost+bookmark+share）
- `variant="preloaded"` 时只显示 views+comments+bookmark+share

---

### 5.2 HeroCarousel

**用途**: 首页 Hero 轮播。5200ms 自动轮播，底部进度指示器。

**文件**: `apps/web/components/content/hero-carousel.tsx`

```typescript
interface HeroSlideData {
  title: string
  subtitle: string
  image: string           // 背景图 URL（对应 --hero-image）
  bg1: string             // 渐变起始色
  bg2: string             // 渐变结束色
  accent: string          // 强调色
  stats?: {
    views: number
    likes: number
    comments: number
  }
}

interface HeroCarouselProps {
  slides: HeroSlideData[]
  autoPlayInterval?: number  // 默认 5200
  className?: string
}
```

**渲染模式**:

```
┌──────────────────────────────────────────────┐
│ ┌──────────────────────────────────────┐      │
│ │                                      │      │
│ │         Hero Cover Image             │      │
│ │                                      │      │
│ │   标题文字（h1，Lexend，28px+）        │      │
│ │   副标题文字（muted，15px）            │      │
│ │   👁 2.3k  ❤ 456  💬 89              │      │
│ │                                      │      │
│ └──────────────────────────────────────┘      │
│ ──── ──── ──── ────  (progress track)        │
│  ◀                             ▶            │
└──────────────────────────────────────────────┘
```

**参考 CSS**: index.html L897-917 (`.progress-track`, `.progress-seg`)

**设计要点**:
- 客户端组件（`"use client"`），使用 `useState` + `useEffect` 管理轮播
- 封面使用 `Cover` 组件 + 自定义渐变背景（`bg1`/`bg2` CSS 变量）
- `accent` 色用于进度条活跃段
- 进度指示器：N 段 `.progress-seg`，活跃段宽度 72%，其他 28%
- 左右箭头按钮使用 `IconButton`
- 键盘左右箭头切换
- 每张 slide 对应 `HeroSlideData`，最少 1 张，无上限

---

### 5.3 RankItem

**用途**: 排行榜条目。编号 + 封面 + 信息 + 热度分。

**文件**: `apps/web/components/content/rank-item.tsx`

```typescript
interface RankItemData {
  rank: number            // 1, 2, 3...
  cover: string
  title: string
  description: string
  delta: string           // 变化百分比（如 "+12%"）
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
  score: number           // 热度分数
  scoreLabel: string      // 分数标签（如 "热度"）
}

interface RankItemProps {
  data: RankItemData
  href: string
  className?: string
}
```

**渲染模式**:

```
┌──────────────────────────────────────────────────────────┐
│ 01 │ [Cover] │ Title          +12% │           9,847    │
│    │ 150×?   │ Description          │            热度    │
│    │         │ [A] 作者 · 👁 💬 ❤   │                    │
└──────────────────────────────────────────────────────────┘
```

**参考 CSS**: index.html L2132-2204 (`.rank-item`, `.rank-no`, `.rank-cover`, `.rank-body`, `.rank-title-row`, `.rank-delta`, `.rank-score`, `.score-number`, `.score-label`)

**设计要点**:
- 四列 grid：`46px 150px 1fr auto`
- `.rank-no` 使用 Lexend 字体，18px 粗体，主色
- `Cover` 16:10 比例
- `.rank-delta` 绿色字（`text-emerald-600`），12px 粗体
- `.score-number` Lexend 20px 粗体，`.score-label` 12px muted

---

### 5.4 HistoryItem

**用途**: 阅读历史条目。封面缩略图 + 信息 + 进度条 + 来源标签。

**文件**: `apps/web/components/content/history-item.tsx`

```typescript
type HistorySource = "首页" | "动态" | "榜单" | "PDF" | "搜索" | "合集"

interface HistoryItemData {
  cover: string
  title: string
  author: string
  chapter: string         // 阅读到的章节/位置
  source: HistorySource   // 来源
  timeAgo: string
  progress: number        // 阅读进度 0-100
  progressLabel: string   // 进度描述（如 "已读 65%"）
}

interface HistoryItemProps {
  data: HistoryItemData
  href: string
  className?: string
}
```

**渲染模式**:

```
┌──────────────────────────────────────────┐
│ ┌──────────┐  Title                       │
│ │  Cover   │  作者 · 第3章  [首页]         │
│ │  104×?   │  3天前 · 已读 65%             │
│ │ gradient │  ████████░░░░░░░░ 65%        │
│ └──────────┘                               │
└──────────────────────────────────────────┘
```

**参考 CSS**: index.html L1464-1505 (`.history-item`, `.history-thumb`, `.history-info`), L1633-1640 (`.history-line`)

**设计要点**:
- 两列 grid：`104px 1fr`
- `Cover` 组件，92px 最小高度，底部渐变
- `source` 渲染为 `Pill variant="source"`
- `progress` 渲染为 `ProgressMini`
- 卡片 hover 时边框变主色

---

### 5.5 NotificationItem

**用途**: 通知/更新条目。两种子类型 — `update`（页面更新）和 `notification`（社交互动）。

**文件**: `apps/web/components/content/notification-item.tsx`

```typescript
type NotificationType = "update" | "notification"

interface NotificationItemData {
  type: NotificationType
  icon: LucideIcon        // 图标
  title: string
  author?: string
  detail?: string         // 详细信息
  timeAgo: string
  /** 右侧操作按钮 */
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
```

**渲染模式**:

```
┌── update ──────────────────────────────────┐
│ [icon]  页面标题 已更新                      │
│         作者 · 版本说明 · 2小时前        →   │
└─────────────────────────────────────────────┘

┌── notification ────────────────────────────┐
│ [Avatar] 张三 评论了你的页面              → │
│          《xxx》· 3小时前                    │
└─────────────────────────────────────────────┘
```

**参考 CSS**: index.html L2235-2255 (`.notification-item`, `.update-item`, `.mini-icon`)

**设计要点**:
- 三列 grid：`auto 1fr auto`
- `type="update"` 时左侧为 `MiniIcon`（34px 圆角方块 + 图标）
- `type="notification"` 时左侧为 `Avatar`（28px）
- 标题行用 `strong` 样式
- 右侧操作：arrow（→ 链接）、follow（关注按钮）、read（已读标记）、subscribed（已订阅标记）

---

## 六、第四批：页面特定区块

### 6.1 Composer

**用途**: 动态发布器。textarea + 附件预览 + 发布按钮。仅用于动态页。

**文件**: `apps/web/components/content/composer.tsx`

```typescript
interface ComposerProps {
  /** 当前用户头像信息 */
  userFallbackText: string
  userAvatarUrl?: string
  /** 提交回调（后续接入 API） */
  onSubmit?: (text: string) => void
  className?: string
}
```

**渲染模式**:

```
┌──────────────────────────────────────────────┐
│ [Avatar] ┌────────────────────────────────┐  │
│          │ textarea (78px min-height)     │  │
│          │                                │  │
│          └────────────────────────────────┘  │
│          ┌ Attachment preview (若有) ─────┐  │
│          │ [thumb] 标题           [✕ 移除] │  │
│          │         作者 · 时间             │  │
│          └────────────────────────────────┘  │
│          [🔗] [🖼]          [可见性▾] [发布]  │
└──────────────────────────────────────────────┘
```

**参考 CSS**: index.html L1242-1313 (`.moment-composer`, `.composer-main`, `.composer-box`, `.composer-attach`, `.composer-actions`)

**设计要点**:
- 客户端组件，管理 textarea 状态和附件状态
- 附件预览复用 `Attachment` 组件（`onRemove` 回调）
- 底部工具栏：链接按钮、图片按钮、可见性选择、发布按钮
- 发布按钮用 apps/web `Button` variant="default"（cta 绿色）

---

### 6.2 ProfileHero

**用途**: 作者/用户主页头部。大号头像 + 名称 + 统计 + 关注按钮。

**文件**: `apps/web/components/content/profile-hero.tsx`

```typescript
interface ProfileHeroData {
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
```

**渲染模式**:

```
┌──────────────────────────────────────────────┐
│ [大号头像]  名称                              │
│  58px       @handle · tagline                │
│             关注者 N  页面 N  共同关注 N      │
│                                 [+ 关注]     │
└──────────────────────────────────────────────┘
```

**参考 CSS**: index.html L2257-2274 (`.profile-hero`, `.profile-name`)

**设计要点**:
- 三列 grid：`58px 1fr auto`
- 头像用 apps/web `Avatar` size="lg"（58px）
- 名称 Lexend 26px
- stats 用 `Pill` 组件渲染
- "关注" 按钮用 `Button` variant="outline"

---

### 6.3 MiniPageCard

**用途**: 紧凑页面卡片，用于抽屉侧栏（推荐区域）。92px 缩略图。

**文件**: `apps/web/components/content/mini-page-card.tsx`

```typescript
interface MiniPageCardData {
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
```

**渲染模式**:

```
┌──────────────────────────────┐
│ ┌──────┐ Title (14px bold)   │
│ │Thumb │ Description         │
│ │ 92px │ 👁 1.2k  ❤ 89      │
│ └──────┘                     │
└──────────────────────────────┘
```

**参考 CSS**: index.html L1835-1867 (`.mini-page-card`, `.mini-page-card .thumb`, `.mini-page-body`)

**设计要点**:
- 两列 grid：`92px 1fr`
- `Cover` 组件，aspectRatio="16/9"
- 标题 14px 粗体，单行截断
- 描述 muted 色，单行截断

---

### 6.4 PageMeta

**用途**: 页面元数据面板（可展开）。用于 ReadDrawer 的"详情"标签页。

**文件**: `apps/web/components/content/page-meta.tsx`

```typescript
interface PageMetaData {
  author: {
    name: string
    fallbackText: string
    avatarUrl?: string
    followerCount: number
  }
  title: string
  uid: string
  sidePageUid?: string     // 副页 UID（可选）
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
  /** 合集中章节列表（可选） */
  chapters?: {
    number: number
    title: string
    status?: string        // 章节状态
  }[]
  chapterProgress?: {
    current: number
    total: number
  }
  /** 推荐页面列表（可选） */
  recommendations?: MiniPageCardData[]
}

interface PageMetaProps {
  data: PageMetaData
  defaultExpanded?: boolean
  className?: string
}
```

**渲染模式**:

```
┌─ 详情 ──────────────────────────────────────┐
│ [Avatar] 作者名                               │
│          N 位关注者              [+ 关注]     │
│                                              │
│ 页面标题                            [▸ 展开] │
│ 👁 2.3k  🔖 156  2025-03-15                 │
│                                              │
│ ┌──────────┬──────────┬──────────┐           │
│ │  ❤ 1.2k │  🔖 156  │  📤 89   │           │
│ └──────────┴──────────┴──────────┘           │
│                                              │
│ ▼ 展开后 ─────────────────────────────────── │
│ UID: abc123 · 副页: xyz789                    │
│                                               │
│ 这是一段页面描述文字...                         │
│                                               │
│ [视觉小说] [长篇连载] [交互页面] [PDF]          │
│                                               │
│ ── 合集 3/12 ──────────────────────────────── │
│  01  第一章 · 已读                             │
│  02  第二章 · 阅读中                           │
│  03  第三章                                    │
│                                               │
│ ── 推荐 ───────────────────────────────────── │
│ ┌ MiniPageCard ┐ ┌ MiniPageCard ┐             │
│ └──────────────┘ └──────────────┘             │
└───────────────────────────────────────────────┘
```

**参考 CSS**: index.html L1869-1989 (`.page-info-card`, `.page-meta`, `.page-meta-author`, `.page-meta-title-row`, `.page-meta-stats`, `.page-meta-actions`, `.page-meta-details`, `.page-meta-collection`)

**设计要点**:
- 客户端组件，`useState` 管理展开/折叠
- `.page-meta-details` 默认隐藏，展开按钮旋转 90°
- `chapters` 存在时渲染合集区域
- `recommendations` 存在时渲染推荐区域（MiniPageCard 列表）
- tags 用 `Pill variant="tag"` 渲染
- 操作按钮区：3 列等宽 grid，每列 62px 最小高度

---

## 七、Mock 数据策略

### 数据文件

所有 mock 数据集中管理：

```
apps/web/lib/mock/
  slides.ts          — HeroCarousel 数据（9 张轮播）
  home-feed.ts       — 首页动态列表（24 条）
  pages.ts           — PageCard 数据（精选 + 推荐）
  authors.ts         — AuthorCard 数据
  rank.ts            — RankItem 数据（排行榜）
  history.ts         — HistoryItem 数据
  notifications.ts   — NotificationItem 数据
  read-page-meta.ts  — PageMeta 数据
  search.ts          — 搜索结果（Phase 1 已有 mock）
```

### 数据格式

参考 index.html 中的 JavaScript 数据结构：

```typescript
// slides: 来自 carouselSlides (L3319)
// homeFeedItems: 11 元素数组 (L3331-3356)
// readPageMeta: 对象映射 (L3323-3330)
```

---

## 八、构建批次

| 批次 | 组件数 | 依赖 | 预估文件数 |
|------|--------|------|-----------|
| 第一批 | 6 | 仅 apps/web 已有组件 | 6 新建 |
| 第二批 | 4 | 第一批 | 4 新建 |
| 第三批 | 5 | 第二批 | 5 新建 + 8 mock 数据文件 |
| 第四批 | 4 | 第三批 | 4 新建 |

**总计：19 个组件文件 + 8 个 mock 数据文件**

---

## 九、不在此次范围的组件

以下组件已有替代或暂不需要：

| 组件 | 原因 |
|------|------|
| CommentCard | apps/web `CommentItem`（`components/social/`）已覆盖 |
| Avatar | apps/web `Avatar`（Radix 驱动，支持图片回退）已覆盖 |
| Tabs | Phase 1 `VibenTabs` 已覆盖 |
| FollowButton | 用 apps/web `Button` variant="outline" 实现 |
| FeedSentinel | 后续接入 API 时实现 IntersectionObserver 无限滚动 |
| ReadMoreMenu | Phase 1 Topbar 中已内联实现 |
| 搜索相关组件 | Phase 1 已完成（SearchResultCard, SearchFilterSidebar, SearchEmpty, SearchPageContent） |

---

## 十、文件结构总览

```
apps/web/components/content/
  cover.tsx              # 第一批
  pill.tsx               # 第一批
  stats-row.tsx          # 第一批
  meta-row.tsx           # 第一批
  section-head.tsx       # 第一批
  progress-mini.tsx      # 第一批
  page-card.tsx          # 第二批
  author-card.tsx        # 第二批
  feed-head.tsx          # 第二批
  attachment.tsx         # 第二批
  feed-card.tsx          # 第三批
  hero-carousel.tsx      # 第三批
  rank-item.tsx          # 第三批
  history-item.tsx       # 第三批
  notification-item.tsx  # 第三批
  composer.tsx           # 第四批
  profile-hero.tsx       # 第四批
  mini-page-card.tsx     # 第四批
  page-meta.tsx          # 第四批

apps/web/lib/mock/
  slides.ts
  home-feed.ts
  pages.ts
  authors.ts
  rank.ts
  history.ts
  notifications.ts
  read-page-meta.ts
```

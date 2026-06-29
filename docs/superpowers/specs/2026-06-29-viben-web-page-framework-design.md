# Viben Web 页面框架重构设计

**日期**: 2026-06-29
**状态**: 设计中
**版本**: 1.0

## 1. 概述

### 1.1 目标

参考 `pages/web/index.html` 的社区界面原型，重构 `apps/web` 的页面框架层。本次仅覆盖页面骨架（Header、面包屑、居中 Tabs、右侧滑出抽屉、搜索组件），不涉及页面内容布局的详细重构。

### 1.2 范围

**包含**：
- Design Tokens 和主题系统扩展
- AppShell + Topbar 布局壳（全面替换现有 sidebar+header 布局）
- 面包屑导航（三段式 + Popover 下拉菜单）
- 统一 Tabs 组件（pill / drawer / default 三种 variant）
- Header 全局搜索（Popover 面板 + `/search` 搜索页面）
- 右侧滑出抽屉（阅读页专属）

**不包含**：
- 页面内容区的详细设计（卡片、列表、表单等）
- 数据层 API 对接（搜索建议、实时数据等）
- 移动端响应式优化
- 页面内容迁移

### 1.3 参考来源

- `pages/web/index.html` — 社区界面 SPA 原型（3769 行 vanilla HTML/CSS/JS）
- `pages/web/SKILL.md` — 组件抽象清单和路由体系
- `apps/desktop/src/navigation/` — 桌面端面包屑路由注册表实现

## 2. 设计决策

| 决策 | 结论 | 理由 |
|------|------|------|
| 布局策略 | **全面替换** — 新 Topbar 框架替换所有现有布局 | 统一体验，移除 sidebar |
| Header 模式 | **路由驱动** — pathname 自动推导 default/read/landing 模式 | 减少页面配置负担 |
| Drawer 范围 | **页面级** — 阅读页专属组件 | 避免过度设计 |
| 搜索组件 | **完整 UI 框架** — Header Popover + 搜索页面，数据层留接口 | 一次性搭建骨架 |
| Tabs 策略 | **统一组件** — 基于 shadcn/ui Tabs 扩展三种 variant | 与现有代码风格一致 |
| 面包屑参考 | **桌面端 route-registry** — Popover + 注册表模式 | 已验证的成熟方案 |
| 构建方式 | **组件优先** — 按依赖关系分批构建 | 风险可控，review 方便 |

## 3. 架构概览

### 3.1 新页面框架层级

```
Root Layout (app/layout.tsx)
├── ThemeProvider + I18nProvider + Toaster
│
├── (auth)/layout.tsx          ← 不动（登录/注册无 Topbar）
│
├── (dashboard)/layout.tsx     ← 重写
│   └── AppShell
│       ├── Topbar             ← 根据 pathname 自动切换模式
│       │   ├── TopbarLeft     ← 品牌 Logo + 面包屑
│       │   ├── TopbarCenter   ← 搜索框 OR 居中 Tabs
│       │   └── TopbarRight    ← 语言/主题/用户菜单
│       └── <main>             ← max-w-[1280px] mx-auto
│           └── {children}
│
├── (admin)/layout.tsx         ← 重写（复用 AppShell + 管理入口）
│
└── 独立路由（/, /landing, /leaderboard, /moment, /read/[...]）
    ← 各自包裹 AppShell（landing 自动隐藏 Topbar）
```

### 3.2 Topbar 三种模式

| 模式 | 触发路由 | Left | Center | Right |
|------|---------|------|--------|-------|
| **default** | `/`, `/leaderboard`, `/moment`, `/mcp`, `/skills`, `/collections`, `/search`, `/notifications`, `/history` | 品牌 + 面包屑 | 搜索框 | 语言/主题/用户 |
| **read** | `/read/*` | 紧凑面包屑 | 居中 Tabs（`absolute` 真居中） | 阅读操作（收藏/分享/更多） |
| **landing** | `/landing` | Topbar 隐藏 (`display: none`) | — | — |

## 4. 组件设计

### 4.1 Design Tokens & 主题系统

**文件**: `apps/web/app/globals.css`（修改）

将 `index.html` 的语义变量映射到 Tailwind v4 体系：

| index.html | apps/web 新增变量 | 用途 |
|------------|-------------------|------|
| `--bg: #f4feff` | `--background`（已有，色值调整） | 页面背景 |
| `--surface: #ffffff` | `--surface` | 卡片/面板背景 |
| `--surface-2: #ecfeff` | `--surface-secondary` | 悬停态背景 |
| `--text: #164e63` | `--foreground`（已有） | 主文本 |
| `--muted: #5f7f8c` | `--muted-foreground`（已有） | 次要文本 |
| `--line: #cdeff5` | `--border`（已有，色值调整） | 边框 |
| `--primary: #0891b2` | `--primary`（已有，色值调整） | 主题色（青色系） |
| `--primary-2: #22d3ee` | `--primary-light` | 浅主题色 |
| `--cta: #059669` | `--accent`（已有，色值调整） | CTA 绿色 |
| `--radius: 8px` | `--radius`（已有） | 圆角 |
| `--radius-lg: 12px` | `--radius-lg` | 大圆角 |
| `--nav-h: 56px` | `--nav-h` | Topbar 高度 |
| `--shadow-sm/md` | `--shadow-sm/md` | 阴影层级 |

**关键规则**：
- 使用 oklch 格式（项目规范，禁止 `hsl()` 包裹）
- body 渐变背景：`radial-gradient + linear-gradient`
- 新增 `--surface-secondary`、`--primary-light`、`--nav-h` 三个变量

### 4.2 AppShell + Topbar

**文件**:
- `components/layout/app-shell.tsx`（新建）
- `components/layout/topbar-mode.ts`（新建）

**Topbar 三列 Grid**：

```
默认模式：
grid-template-columns: minmax(180px, 1fr) minmax(260px, 520px) minmax(180px, 1fr)

阅读模式：
grid-template-columns: minmax(430px, 1.45fr) minmax(160px, 260px) auto
Center 列脱离 grid 流：absolute left-1/2 -translate-x-1/2
```

**关键样式**：
- 毛玻璃：`bg-background/88 backdrop-blur-[14px]`
- Sticky：`top-0 z-50`
- 高度：`h-[var(--nav-h)]` (56px)
- 底部边框：`border-b border-border`

**模式判断逻辑**（`topbar-mode.ts`）：
```typescript
type TopbarMode = "default" | "read" | "landing";

function getTopbarMode(pathname: string): TopbarMode {
  if (pathname.startsWith("/landing")) return "landing";
  if (pathname.startsWith("/read/")) return "read";
  return "default";
}
```

### 4.3 面包屑导航

**参考**: `apps/desktop/src/navigation/` 的路由注册表 + Popover 模式

**文件**:
- `lib/navigation/route-registry.ts`（新建）
- `lib/navigation/breadcrumb-segments.ts`（新建）
- `components/layout/breadcrumb.tsx`（新建）
- `components/layout/breadcrumb-dropdown.tsx`（新建）
- `components/layout/header-breadcrumb.tsx`（删除）

**路由注册表**：
```typescript
interface RouteEntry {
  pattern: string;            // "/mcp/:id"
  label: string;              // "MCP 详情"
  titleKey?: string;          // i18n key
  icon: LucideIcon;
  dropdownCategory?: string;  // 下拉菜单分组
  parent?: string;            // 父路由 pattern
  mode?: "global" | "author" | "read"; // 面包屑变体
}
```

**段解析逻辑**（`breadcrumb-segments.ts`）：
1. 取当前 pathname（如 `/mcp/mcp-123`）
2. 分割为 segments：`["mcp", "mcp-123"]`
3. 逐段构建完整路径：`/mcp` → `/mcp/mcp-123`
4. 每个路径查找注册表获取 label 和 icon
5. 最末段为纯文本（不可点击），非末段带下拉菜单

**下拉菜单**（`BreadcrumbDropdown`）：
- UI：Popover + ScrollArea
- 触发：hover 120ms 延迟打开 / 移出关闭
- 内容：同级路由列表，分组显示，当前页有 Check 标记
- 管理员路由通过 session role 控制可见性

**三种面包屑变体**（与 Topbar mode 联动）：
- 阅读模式（`/read/*`）→ 阅读面包屑（首页/合集/通知/历史）
- default + `/author/*` → 作者面包屑（全局 + 创作者工具）
- 其他 → 全局面包屑

### 4.4 统一 Tabs 组件

**文件**: `components/ui/viben-tabs.tsx`（新建）
**依赖**: shadcn/ui `Tabs`（`components/ui/tabs.tsx`，不动）

**三种 Variant**：

| Variant | 外观 | 用途 |
|---------|------|------|
| `default` | 分段按钮组，浅色背景 | 页面内分类筛选（分类页、榜单页） |
| `pill` | 圆角胶囊，`min-w-[92px]`，`rounded-full` | 阅读页 Header 居中 Tabs |
| `drawer` | 小号胶囊，`min-w-[78px]`，`rounded-full` | Drawer 头部 Tabs |

**实现方式**：
- 组合 shadcn/ui 的 `Tabs` + `TabsList` + `TabsTrigger` + `TabsContent`
- 通过 `class-variance-authority` 在 List 和 Trigger 上叠加 variant class
- 现有页面使用的 `tabs.tsx` 不受影响

**注意**：`data-[state=active]:` 等 Tailwind v4 data 属性变体在 CVA 中可能不可靠，需通过 `className` prop 条件性传入 active 样式（遵循 CLAUDE.md 规范）。

### 4.5 搜索组件

**4.5.1 Header 全局搜索**（`components/layout/global-search.tsx`）

```
┌──────────────────────────────────────┐
│  🔍 搜索插件、页面、作者...    [×]   │
│  ┌────────────────────────────────┐  │
│  │ 最近搜索                       │  │
│  │ [插件发布清单 ×] [viben教程 ×] │  │
│  │                                │  │
│  │ 热门搜索                       │  │
│  │ 1. 插件发布清单   12,345 次 🔥 │  │
│  │ 2. MCP 开发指南    8,920 次    │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

**Props 接口**：
```typescript
interface GlobalSearchProps {
  recentSearches: string[];
  onRemoveRecent: (query: string) => void;
  hotSearches: { query: string; count: number }[];
}
```

**交互**：
- Focus 展开 Popover（`focus-within` 或 React state）
- 点击建议 / 回车 → `router.push("/search?q=xxx")`
- 点击 × 删除最近搜索
- 点击外部关闭（通过 Popover 的 `onInteractOutside`）

**4.5.2 搜索页面**（`/search?q=xxx`）

**文件**:
- `app/(dashboard)/search/page.tsx`（新建）
- `components/search/search-page-content.tsx`（新建）
- `components/search/search-result-card.tsx`（新建）
- `components/search/search-filter-sidebar.tsx`（新建）
- `components/search/search-empty.tsx`（新建）

**布局**：双列（筛选侧栏 200px + 结果列表 1fr）

**Props 接口**：
```typescript
interface SearchPageData {
  query: string;
  totalCount: number;
  filters: { label: string; count: number; value: string }[];
  results: SearchResult[];
}

interface SearchResult {
  id: string;
  type: "page" | "author" | "moment" | "paper";
  title: string;
  description: string;
  coverUrl?: string;
  author: { name: string; avatar?: string };
  stats: { views: number; likes: number; comments: number };
  url: string;
}
```

**空状态**：居中图标 + "没有找到相关内容" + 建议关键词

**数据层**：先 mock，接口已定义，后续接入真实 API。

### 4.6 右侧滑出抽屉

**文件**: `components/layout/read-drawer.tsx`（新建）

**动画**：
```
关闭态: translateX(104%)
打开态: translateX(0)
过渡:   transform 220ms ease

遮罩: pointer-events-none + bg transparent → pointer-events-auto + bg rgba(6,29,38,0.16)
```

**API**：
```typescript
interface ReadDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tabs: {
    value: string;
    label: string;
    badge?: number;
    content: React.ReactNode;
  }[];
  defaultTab?: string;
}
```

**关键样式**：
- 宽度：`w-[min(420px,calc(100vw-22px))]`
- 高度：`h-screen`
- 内部布局：`grid grid-rows-[auto_1fr]`
- 毛玻璃：`bg-background/96 backdrop-blur-[16px]`
- 阴影：`shadow-[-18px_0_36px_rgba(8,91,117,0.14)]`
- 左侧边框：`border-l border-border`
- body 滚动锁定：打开时 `overflow: hidden`

**关闭方式**：
- 点击遮罩层
- 点击关闭按钮
- 按 Escape 键
- 通过 `onOpenChange(false)` 外部控制

**依赖**：`VibenTabs`（variant="drawer"）

## 5. 组件依赖与构建顺序

### 5.1 依赖图

```
globals.css (Design Tokens)
┌─────────┼─────────┐
│         │         │
ui/popover  ui/tabs  ui/button, ui/input, ui/scroll-area
(新建)     (已有)   (已有)
│         │         │
┌───┘         │    ┌──┴──────────┐
│             │    │             │
route-registry  VibenTabs  GlobalSearch  ReadDrawer
│               │         │             │
┌──┴──┐          │         │             │
│     │          │         │             │
Breadcrumb       │         │             │
+Breadcrumb      │         │             │
Dropdown         │         │             │
└──┬──┘          │         │             │
   └─────────────┼─────────┼─────────────┘
                 │         │
              Topbar (AppShell)
                 │
           Root Layout
```

### 5.2 构建顺序

| 批次 | 内容 | 依赖 | 页面影响 |
|------|------|------|----------|
| **0** | `globals.css` 扩展 + `Popover` 组件 | — | 全局样式变更 |
| **1** | `route-registry.ts` + `breadcrumb-segments.ts` | — | 纯数据，无页面影响 |
| **2** | `VibenTabs` | globals.css | 无（独立组件） |
| **3** | `Breadcrumb` + `BreadcrumbDropdown` | route-registry + Popover | 无（独立组件） |
| **4** | `GlobalSearch` + `ReadDrawer` + 搜索页面组件 | Popover + VibenTabs + Input | 新增 `/search` 路由 |
| **5** | `AppShell` + `Topbar` + Root Layout 重写 | 所有上述组件 | **影响全部路由** |

## 6. 文件清单

| # | 文件 | 操作 | 批次 |
|---|------|------|------|
| 1 | `app/globals.css` | 修改 — 新增变量、渐变、重置 | 0 |
| 2 | `components/ui/popover.tsx` | **新建** — shadcn/ui Popover | 0 |
| 3 | `lib/navigation/route-registry.ts` | **新建** — 路由注册表 | 1 |
| 4 | `lib/navigation/breadcrumb-segments.ts` | **新建** — 路径→段解析 | 1 |
| 5 | `components/ui/viben-tabs.tsx` | **新建** — 统一 Tabs | 2 |
| 6 | `components/layout/breadcrumb.tsx` | **新建** — 面包屑主组件 | 3 |
| 7 | `components/layout/breadcrumb-dropdown.tsx` | **新建** — 面包屑下拉菜单 | 3 |
| 8 | `components/layout/global-search.tsx` | **新建** — Header 搜索 | 4 |
| 9 | `components/layout/read-drawer.tsx` | **新建** — 右侧抽屉 | 4 |
| 10 | `components/search/search-page-content.tsx` | **新建** — 搜索页面 | 4 |
| 11 | `components/search/search-result-card.tsx` | **新建** — 搜索结果卡片 | 4 |
| 12 | `components/search/search-filter-sidebar.tsx` | **新建** — 筛选侧栏 | 4 |
| 13 | `components/search/search-empty.tsx` | **新建** — 搜索空状态 | 4 |
| 14 | `app/(dashboard)/search/page.tsx` | **新建** — `/search` 路由 | 4 |
| 15 | `components/layout/app-shell.tsx` | **新建** — AppShell + Topbar | 5 |
| 16 | `components/layout/topbar-mode.ts` | **新建** — 路由模式映射 | 5 |
| 17 | `app/(dashboard)/layout.tsx` | **重写** — 使用 AppShell | 5 |
| 18 | `app/(admin)/layout.tsx` | **重写** — 使用 AppShell + admin | 5 |
| 19 | `components/layout/header-breadcrumb.tsx` | **删除** — 被 breadcrumb.tsx 替代 | 5 |

## 7. 页面迁移影响

| 页面路由 | 当前状态 | 迁移动作 |
|---------|---------|---------|
| `(dashboard)/*` | sidebar+header 布局 | 移除 sidebar，适配 Topbar |
| `(admin)/*` | sidebar+header + admin 鉴权 | 移除 sidebar，保留鉴权，面包屑加管理入口 |
| `(auth)/*` | 独立居中布局 | **不动** |
| `/` (home) | 无共享框架 | 包裹 AppShell |
| `/landing` | 独立页面 | Topbar 自动隐藏（landing 模式） |
| `/leaderboard` | 独立页面 | 包裹 AppShell |
| `/moment` | 独立页面 | 包裹 AppShell |
| `/read/[...]` | 独立页面 | 包裹 AppShell + Drawer 集成 |
| `/search` | **不存在** | **新建**路由 |

## 8. 验证标准

### 8.1 编译检查
- `apps/web` TypeScript 编译通过（`cd apps/web && pnpm typecheck`）
- 无引入新的 ESLint 错误

### 8.2 视觉验证
- Topbar 在 default 模式下正确显示：品牌 + 面包屑 + 搜索框 + 用户操作
- Topbar 在 read 模式下正确显示：紧凑面包屑 + 居中 Tabs + 阅读操作
- Topbar 在 landing 模式下完全隐藏
- 面包屑下拉菜单 hover 展开，内容与路由匹配
- 搜索 Popover focus 展开，显示 mock 数据
- Drawer 打开/关闭动画流畅，遮罩层正确
- 暗色模式切换正常

### 8.3 页面完整性
- 所有现有页面在新框架下可正常渲染（不要求内容完整，但页面不崩溃）
- 新 `/search` 路由可访问，显示 mock 搜索结果

## 9. 已知限制与后续迭代

1. **不包含移动端响应式** — 本次仅实现桌面端布局
2. **数据层未对接** — 搜索建议、面包屑动态数据等使用 mock
3. **页面内容未迁移** — 页面内部布局保持现状，仅包裹新框架
4. **Author 面包屑变体推迟** — 首次迭代仅实现 global 和 read 两种变体
5. **暗色模式色彩推导** — index.html 仅有浅色模式，暗色模式需自行推导

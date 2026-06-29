# Viben Web 页面框架重构 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 参考 pages/web/index.html 重构 apps/web 页面框架——包含 Topbar、可折叠侧边栏、面包屑、居中 Tabs、右侧 Drawer、全局搜索、图标按钮和导航弹出面板。

**Architecture:** 按依赖关系分 3 批构建：Foundation（独立组件）→ Features（功能组件）→ Integration（壳组装）。每个组件独立可测试，不影响现有页面。最终替换现有 sidebar+header 布局。

**Tech Stack:** Next.js 15.5 App Router, React 19, Tailwind v4, shadcn/ui (new-york), Radix primitives, lucide-react, class-variance-authority, react-i18next, next-themes

## Global Constraints

- **CLAUDE.md 规范**: oklch 格式 CSS 变量（禁止 `hsl()` 包裹）; 禁止 inline import type 和动态 import; 不在根目录运行 `pnpm build`
- **Tailwind v4**: `data-[state=active]:` 变体在 CVA 中不可靠，需通过 `className` prop 条件性传入
- **构建验证**: 每个 task 完成后在 `apps/web` 目录执行 `pnpm typecheck` 确认无编译错误
- **API 命名**: Gateway API 查询参数和文件存储使用 snake_case（本计划涉及前端路由，使用 Next.js 默认约定）
- **翻译**: agent→智能体, token→词元
- **颜色**: 全部使用 oklch 格式，spec 表格中的 hex 值为参考色，需转换为 oklch

---

## 文件结构映射

```
apps/web/
├── app/
│   ├── globals.css                          # [修改] 新增主题变量
│   ├── layout.tsx                            # [不动] Root Layout
│   ├── (auth)/layout.tsx                     # [不动] 认证路由组
│   ├── (dashboard)/
│   │   ├── layout.tsx                        # [重写] 使用 AppShell
│   │   └── search/page.tsx                   # [新建] /search 路由
│   └── (admin)/
│       └── layout.tsx                        # [重写] 使用 AppShell + 鉴权
├── components/
│   ├── ui/
│   │   ├── popover.tsx                       # [新建] shadcn/ui Popover
│   │   ├── icon-button.tsx                   # [新建] 图标按钮
│   │   ├── viben-tabs.tsx                    # [新建] 统一 Tabs
│   │   └── tabs.tsx                          # [不动] 现有 shadcn Tabs
│   ├── layout/
│   │   ├── app-shell.tsx                     # [新建] AppShell 壳
│   │   ├── topbar.tsx                        # [新建] Topbar
│   │   ├── topbar-mode.ts                    # [新建] 模式映射
│   │   ├── sidebar.tsx                       # [重写] 可折叠侧边栏
│   │   ├── sidebar-wrapper.tsx               # [修改] 适配 AppShell
│   │   ├── breadcrumb.tsx                    # [新建] 面包屑
│   │   ├── global-search.tsx                 # [新建] 全局搜索
│   │   ├── nav-popover.tsx                   # [新建] 导航弹出面板
│   │   ├── read-drawer.tsx                   # [新建] 阅读抽屉
│   │   ├── header.tsx                        # [删除]
│   │   ├── header-breadcrumb.tsx             # [删除]
│   │   ├── header-auth-buttons.tsx           # [保留]
│   │   ├── user-menu.tsx                     # [保留]
│   │   ├── theme-toggle.tsx                  # [保留]
│   │   └── language-switcher.tsx             # [保留]
│   └── search/
│       ├── search-page-content.tsx           # [新建] 搜索页面
│       ├── search-result-card.tsx            # [新建] 搜索结果卡片
│       ├── search-filter-sidebar.tsx         # [新建] 筛选侧栏
│       └── search-empty.tsx                  # [新建] 搜索空状态
└── lib/
    └── navigation/
        └── route-registry.ts                 # [新建] 路由注册表
```

---

### Task 1: Design Tokens — 扩展 globals.css

**Files:**
- Modify: `apps/web/app/globals.css`

**Interfaces:**
- Consumes: none
- Produces: CSS 变量 `--color-surface-secondary`, `--color-primary-light`, `--nav-h`, `--sidebar-w`; body 渐变背景

此 task 将现有 warm-orange 主题的色值替换为 spec 中的青色系（cyan）主题，同时保留暗色模式变量和所有现有动画 keyframes。

- [ ] **Step 1: 备份当前 globals.css**

当前主题是 warm orange (`hsl(24 100% 50%)` / `#FF6B00`)。需要替换为 spec 的青色系主题。注意：当前使用 `hsl()` 格式——需要迁移到 `oklch()`。

- [ ] **Step 2: 替换 Light mode 色值**

修改 `apps/web/app/globals.css` 的 `@theme` 块中的 light mode 颜色变量：

```css
@theme {
  /* 半径 — 保持不变 */
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);

  /* Light mode — 青色系 (cyan) oklch */
  --color-background: oklch(0.985 0.015 210);
  --color-foreground: oklch(0.35 0.04 210);
  --color-card: oklch(1 0 0);
  --color-card-foreground: oklch(0.35 0.04 210);
  --color-popover: oklch(1 0 0);
  --color-popover-foreground: oklch(0.35 0.04 210);
  --color-primary: oklch(0.55 0.12 210);
  --color-primary-foreground: oklch(0.985 0.015 210);
  --color-primary-light: oklch(0.72 0.12 205);
  --color-secondary: oklch(0.97 0.02 200);
  --color-secondary-foreground: oklch(0.35 0.04 210);
  --color-muted: oklch(0.97 0.02 200);
  --color-muted-foreground: oklch(0.55 0.03 210);
  --color-accent: oklch(0.55 0.15 170);
  --color-accent-foreground: oklch(0.985 0.015 210);
  --color-surface-secondary: oklch(0.97 0.02 200);
  --color-destructive: oklch(0.577 0.245 27);
  --color-destructive-foreground: oklch(0.985 0.015 210);
  --color-border: oklch(0.92 0.03 200);
  --color-input: oklch(0.92 0.03 200);
  --color-ring: oklch(0.55 0.12 210);
  --color-chart-1: oklch(0.646 0.222 41);
  --color-chart-2: oklch(0.6 0.118 184);
  --color-chart-3: oklch(0.398 0.07 227);
  --color-chart-4: oklch(0.828 0.189 84);
  --color-chart-5: oklch(0.769 0.188 70);
}
```

- [ ] **Step 3: 替换 Dark mode 色值**

修改 `.dark` 块：

```css
.dark {
  --color-background: oklch(0.25 0.03 210);
  --color-foreground: oklch(0.95 0.02 200);
  --color-card: oklch(0.28 0.04 210);
  --color-card-foreground: oklch(0.95 0.02 200);
  --color-popover: oklch(0.28 0.04 210);
  --color-popover-foreground: oklch(0.95 0.02 200);
  --color-primary: oklch(0.62 0.12 210);
  --color-primary-foreground: oklch(0.15 0.03 210);
  --color-primary-light: oklch(0.72 0.12 205);
  --color-secondary: oklch(0.32 0.04 210);
  --color-secondary-foreground: oklch(0.95 0.02 200);
  --color-muted: oklch(0.32 0.04 210);
  --color-muted-foreground: oklch(0.65 0.04 210);
  --color-accent: oklch(0.6 0.15 170);
  --color-accent-foreground: oklch(0.15 0.03 210);
  --color-surface-secondary: oklch(0.3 0.04 210);
  --color-destructive: oklch(0.396 0.141 25);
  --color-destructive-foreground: oklch(0.95 0.02 200);
  --color-border: oklch(0.35 0.04 210);
  --color-input: oklch(0.35 0.04 210);
  --color-ring: oklch(0.62 0.12 210);
  --color-chart-1: oklch(0.546 0.245 262);
  --color-chart-2: oklch(0.566 0.17 168);
  --color-chart-3: oklch(0.666 0.17 60);
  --color-chart-4: oklch(0.615 0.22 312);
  --color-chart-5: oklch(0.627 0.22 12);
}
```

- [ ] **Step 4: 添加 Topbar 和侧边栏 CSS 变量**

在 `:root` 块中添加：

```css
:root {
  --radius: 0.5rem;
  --nav-h: 56px;
  --sidebar-w: 256px;
}
```

- [ ] **Step 5: 添加 body 渐变背景和字体**

在 `@layer base` 块中增强 body 样式：

```css
@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
    font-feature-settings: "rlig" 1, "calt" 1;
    background:
      radial-gradient(circle at 10% 0%, oklch(0.72 0.12 205 / 0.18), transparent 28rem),
      linear-gradient(180deg, oklch(0.96 0.01 210) 0%, oklch(0.95 0.015 205) 38%, oklch(0.96 0.008 200) 100%);
  }
}
```

- [ ] **Step 6: 保留所有现有动画 keyframes 和工具类**

确认 globals.css 中 lines 78-286（所有 `@keyframes` 和 `.animate-*` 工具类）完整保留，不做删除。

- [ ] **Step 7: 类型检查验证**

```bash
cd apps/web && pnpm typecheck
```

Expected: PASS（无 TS 错误；CSS 变更不影响类型检查）

- [ ] **Step 8: Commit**

```bash
git add apps/web/app/globals.css
git commit -m "feat(theme): switch to cyan oklch palette, add surface-secondary, nav-h, sidebar-w, body gradient"
```

---

### Task 2: Popover — 新建 shadcn/ui Popover

**Files:**
- Create: `apps/web/components/ui/popover.tsx`

**Interfaces:**
- Consumes: `@radix-ui/react-popover`（需要安装）
- Produces: `Popover`, `PopoverTrigger`, `PopoverContent` — shadcn/ui new-york 风格

- [ ] **Step 1: 安装 Radix Popover 依赖**

```bash
cd apps/web && pnpm add @radix-ui/react-popover
```

Expected: 依赖安装成功

- [ ] **Step 2: 创建 Popover 组件**

参照现有 `dropdown-menu.tsx` 的代码风格（same new-york pattern），创建 `apps/web/components/ui/popover.tsx`：

```typescript
"use client"

import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"

import { cn } from "@/lib/utils/index"

const Popover = PopoverPrimitive.Root
const PopoverTrigger = PopoverPrimitive.Trigger
const PopoverAnchor = PopoverPrimitive.Anchor

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
))
PopoverContent.displayName = PopoverPrimitive.Content.displayName

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor }
```

- [ ] **Step 3: 类型检查验证**

```bash
cd apps/web && pnpm typecheck
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/ui/popover.tsx apps/web/package.json apps/web/pnpm-lock.yaml
git commit -m "feat(ui): add shadcn/ui Popover component"
```

---

### Task 3: IconButton — 新建图标按钮

**Files:**
- Create: `apps/web/components/ui/icon-button.tsx`

**Interfaces:**
- Consumes: `ButtonHTMLAttributes` (React), `cn` (utils)
- Produces: `IconButton` — `size?: "default" | "compact"`, `label: string`（aria-label）

- [ ] **Step 1: 创建 IconButton 组件**

创建 `apps/web/components/ui/icon-button.tsx`：

```typescript
"use client"

import * as React from "react"
import { cn } from "@/lib/utils/index"
import { cva, type VariantProps } from "class-variance-authority"

const iconButtonVariants = cva(
  "inline-grid place-items-center border transition-all duration-180 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  {
    variants: {
      size: {
        default: "w-[44px] h-[44px] rounded-[10px]",
        compact: "w-[36px] h-[36px] rounded-[8px]",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

// 注意：边框和背景使用 currentColor 实现半透明效果
// Tailwind 的 border-current/22 和 bg-current/14 需用 style 或自定义类

interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof iconButtonVariants> {
  label: string; // 必填 aria-label
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, size, label, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        aria-label={label}
        className={cn(
          iconButtonVariants({ size }),
          // 半透明边框和背景用 inline style（currentColor 支持）
          className
        )}
        style={{
          border: "1px solid color-mix(in oklch, currentColor 22%, transparent)",
          background: "color-mix(in oklch, currentColor 8%, transparent)",
          ...props.style,
        }}
        {...props}
      >
        {children}
      </button>
    )
  }
)
IconButton.displayName = "IconButton"

export { IconButton, iconButtonVariants }
export type { IconButtonProps }
```

- [ ] **Step 2: 类型检查验证**

```bash
cd apps/web && pnpm typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/ui/icon-button.tsx
git commit -m "feat(ui): add IconButton component (44px/36px sizes, currentColor border)"
```

---

### Task 4: Route Registry — 路由注册表

**Files:**
- Create: `apps/web/lib/navigation/route-registry.ts`

**Interfaces:**
- Consumes: `LucideIcon` (lucide-react)
- Produces: `RouteConfig`, `routeRegistry: Record<string, RouteConfig>`

- [ ] **Step 1: 创建路由注册表**

创建 `apps/web/lib/navigation/route-registry.ts`：

```typescript
import {
  Home,
  TrendingUp,
  Package,
  Sparkles,
  Layers,
  MessageSquare,
  Bell,
  Clock,
  Upload,
  PackageSearch,
  BarChart3,
  Search,
  type LucideIcon,
} from "lucide-react"

export interface RouteConfig {
  label: string
  titleKey?: string       // i18n key，优先于 label
  icon: LucideIcon
  dropdownCategory?: string // 下拉菜单分组
  parent?: string           // 父路由路径
  mode?: "global" | "author" | "read"
}

/** 全局路由注册表 — 路径→配置映射 */
export const routeRegistry: Record<string, RouteConfig> = {
  // 根路由
  "/": { label: "首页", icon: Home },

  // 社区浏览
  "/leaderboard": { label: "榜单", icon: TrendingUp, parent: "/", dropdownCategory: "浏览" },
  "/moment": { label: "动态", icon: MessageSquare, parent: "/", dropdownCategory: "浏览" },
  "/notifications": { label: "通知", icon: Bell, parent: "/", dropdownCategory: "浏览" },
  "/history": { label: "浏览历史", icon: Clock, parent: "/", dropdownCategory: "浏览" },
  "/search": { label: "搜索", icon: Search, parent: "/" },

  // 市场
  "/mcp": { label: "MCP 市场", icon: Package, parent: "/", dropdownCategory: "市场" },
  "/mcp-market": { label: "MCP 市场", icon: Package, parent: "/", dropdownCategory: "市场" },
  "/skills": { label: "技能市场", icon: Sparkles, parent: "/", dropdownCategory: "市场" },
  "/skill-market": { label: "技能市场", icon: Sparkles, parent: "/", dropdownCategory: "市场" },
  "/collections": { label: "合集", icon: Layers, parent: "/", dropdownCategory: "市场" },

  // 创作者
  "/publish": { label: "发布", icon: Upload, parent: "/", dropdownCategory: "创作" },
  "/my-packages": { label: "我的包", icon: PackageSearch, parent: "/", dropdownCategory: "创作" },
  "/analytics": { label: "分析", icon: BarChart3, parent: "/", dropdownCategory: "创作" },

  // 设置
  "/settings/favorites": { label: "收藏", icon: Sparkles, parent: "/", dropdownCategory: "我的" },
  "/settings/tokens": { label: "API 密钥", icon: Package, parent: "/", dropdownCategory: "我的" },

  // 管理员路由（仅 role=admin 可见）
  "/admin": {
    label: "管理后台",
    icon: BarChart3,
    parent: "/",
    dropdownCategory: "管理",
  },
  "/admin/packages": {
    label: "包审核",
    icon: Package,
    parent: "/admin",
    dropdownCategory: "管理",
  },
  "/admin/users": {
    label: "用户管理",
    icon: Sparkles,
    parent: "/admin",
    dropdownCategory: "管理",
  },

  // 阅读面包屑（模式=read 时使用）
  "/read": { label: "阅读", icon: Home, mode: "read" },
}

/** 获取面包屑段 */
export function resolveBreadcrumbSegments(
  pathname: string
): Array<{ href: string; config: RouteConfig; isLast: boolean }> {
  const segments: Array<{ href: string; config: RouteConfig; isLast: boolean }> = []
  const parts = pathname.split("/").filter(Boolean)
  let accumulated = ""

  for (let i = 0; i < parts.length; i++) {
    accumulated += "/" + parts[i]
    const config = routeRegistry[accumulated]
    const isLast = i === parts.length - 1

    if (config) {
      segments.push({ href: accumulated, config, isLast })
    } else if (!isLast) {
      // 中间段无注册表项——跳过，但要推进路径
      continue
    } else {
      // 最末段无注册——用路径末段作为 label
      segments.push({
        href: accumulated,
        config: { label: parts[i], icon: Home },
        isLast: true,
      })
    }
  }

  // 如果没有匹配到任何段，至少有一个根
  if (segments.length === 0) {
    segments.push({
      href: "/",
      config: routeRegistry["/"],
      isLast: true,
    })
  }

  return segments
}

/** 获取同级路由（用于面包屑下拉菜单） */
export function getSiblingRoutes(parentPath: string): Array<{ href: string; config: RouteConfig }> {
  const siblings: Array<{ href: string; config: RouteConfig }> = []

  for (const [href, config] of Object.entries(routeRegistry)) {
    if (href === parentPath) continue // 不包括自己
    if (config.parent === parentPath || (!config.parent && parentPath === "/")) {
      siblings.push({ href, config })
    }
  }

  return siblings
}
```

- [ ] **Step 2: 类型检查验证**

```bash
cd apps/web && pnpm typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/navigation/route-registry.ts
git commit -m "feat(nav): add route registry for breadcrumb with segment resolver"
```

---

### Task 5: VibenTabs — 统一 Tabs 组件

**Files:**
- Create: `apps/web/components/ui/viben-tabs.tsx`

**Interfaces:**
- Consumes: `@radix-ui/react-tabs`（已有依赖）
- Produces: `VibenTabs`, `VibenTabsList`, `VibenTabsTrigger`, `VibenTabsContent` — 支持 `variant: "default" | "pill" | "drawer"`

**关键**: 不使用 shadcn/ui 的 `TabsTrigger`（它硬编码了 `data-[state=active]:bg-primary`），直接使用 `@radix-ui/react-tabs` 底层原语。

- [ ] **Step 1: 创建 VibenTabs 组件**

创建 `apps/web/components/ui/viben-tabs.tsx`：

```typescript
"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { cn } from "@/lib/utils/index"
import { cva, type VariantProps } from "class-variance-authority"

// ===== VibenTabsList =====

const tabsListVariants = cva("inline-flex items-center", {
  variants: {
    variant: {
      default: "h-9 gap-1 rounded-lg bg-muted p-1 text-muted-foreground",
      pill: "gap-1 rounded-full border border-border bg-surface p-1 shadow-sm",
      drawer: "gap-1 rounded-full border border-border bg-surface p-1",
    },
  },
  defaultVariants: { variant: "default" },
})

interface VibenTabsListProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>,
    VariantProps<typeof tabsListVariants> {}

const VibenTabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  VibenTabsListProps
>(({ className, variant, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(tabsListVariants({ variant }), className)}
    {...props}
  />
))
VibenTabsList.displayName = "VibenTabsList"

// ===== VibenTabsTrigger =====

const tabsTriggerVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 text-muted-foreground hover:text-foreground",
  {
    variants: {
      variant: {
        default: "rounded-md px-3 py-1 text-sm min-h-9 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
        pill: "rounded-full px-4 py-1.5 text-sm min-w-[92px] data-[state=active]:bg-surface-secondary data-[state=active]:text-foreground",
        drawer: "rounded-full px-3 py-1 text-xs min-w-[78px] min-h-[34px] data-[state=active]:bg-surface-secondary data-[state=active]:text-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  }
)

interface VibenTabsTriggerProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>,
    VariantProps<typeof tabsTriggerVariants> {}

const VibenTabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  VibenTabsTriggerProps
>(({ className, variant, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(tabsTriggerVariants({ variant }), className)}
    {...props}
  />
))
VibenTabsTrigger.displayName = "VibenTabsTrigger"

// ===== VibenTabsContent =====

const VibenTabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
))
VibenTabsContent.displayName = "VibenTabsContent"

// ===== Root =====
const VibenTabs = TabsPrimitive.Root

export { VibenTabs, VibenTabsList, VibenTabsTrigger, VibenTabsContent }
```

- [ ] **Step 2: 类型检查验证**

```bash
cd apps/web && pnpm typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/ui/viben-tabs.tsx
git commit -m "feat(ui): add VibenTabs with pill/drawer/default variants"
```

---

### Task 6: Breadcrumb — 面包屑导航

**Files:**
- Create: `apps/web/components/layout/breadcrumb.tsx`

**Interfaces:**
- Consumes: `routeRegistry`, `resolveBreadcrumbSegments`, `getSiblingRoutes` (route-registry); `Popover` (popover); `usePathname` (next/navigation); `useTranslation` (react-i18next)
- Produces: `BreadcrumbNav` — 三段式面包屑 + Popover 下拉菜单

- [ ] **Step 1: 创建面包屑组件**

创建 `apps/web/components/layout/breadcrumb.tsx`：

```typescript
"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslation } from "react-i18next"
import { ChevronRight, Check } from "lucide-react"
import { cn } from "@/lib/utils/index"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  resolveBreadcrumbSegments,
  getSiblingRoutes,
} from "@/lib/navigation/route-registry"

interface BreadcrumbNavProps {
  variant?: "global" | "read"
  className?: string
}

export function BreadcrumbNav({ variant = "global", className }: BreadcrumbNavProps) {
  const { t } = useTranslation()
  const pathname = usePathname()
  const segments = React.useMemo(() => resolveBreadcrumbSegments(pathname), [pathname])

  // 过滤：read 模式只显示 mode="read" 的路由
  const filteredSegments = React.useMemo(() => {
    if (variant !== "read") return segments
    // 仅保留根 + 阅读相关段
    return segments.filter((s) => !s.config.mode || s.config.mode === "read")
  }, [segments, variant])

  if (filteredSegments.length === 0) {
    return <div />
  }

  return (
    <nav aria-label="面包屑导航" className={cn("flex items-center gap-0.5 min-w-0", className)}>
      {filteredSegments.map((seg, idx) => (
        <React.Fragment key={seg.href}>
          {idx > 0 && (
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <BreadcrumbSegment
            href={seg.href}
            label={seg.config.titleKey ? t(seg.config.titleKey) : seg.config.label}
            icon={seg.config.icon}
            isLast={seg.isLast}
            variant={variant}
          />
        </React.Fragment>
      ))}
    </nav>
  )
}

interface BreadcrumbSegmentProps {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  isLast: boolean
  variant: "global" | "read"
}

function BreadcrumbSegment({ href, label, icon: Icon, isLast, variant }: BreadcrumbSegmentProps) {
  const siblings = getSiblingRoutes(href === "/" ? "/" : href)
  const hasDropdown = !isLast && siblings.length > 0

  const segment = (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        "h-8 max-w-[220px] gap-1.5 rounded-lg px-2 font-extrabold",
        variant === "read" && "max-w-[170px]",
        isLast && variant === "read" && "max-w-[210px]"
      )}
      asChild={isLast ? false : !hasDropdown}
    >
      {isLast ? (
        <span className="flex items-center gap-1.5 min-w-0">
          <Icon className="h-4 w-4 shrink-0" />
          <span className="truncate">{label}</span>
        </span>
      ) : hasDropdown ? (
        <span className="flex items-center gap-1.5 min-w-0">
          <Icon className="h-4 w-4 shrink-0" />
          <span className="truncate">{label}</span>
        </span>
      ) : (
        <Link href={href} className="flex items-center gap-1.5 min-w-0">
          <Icon className="h-4 w-4 shrink-0" />
          <span className="truncate">{label}</span>
        </Link>
      )}
    </Button>
  )

  if (!hasDropdown) return segment

  return (
    <Popover>
      <PopoverTrigger asChild>{segment}</PopoverTrigger>
      <PopoverContent
        className="w-[min(292px,calc(100vw-28px))] p-1.5"
        align="start"
        sideOffset={4}
      >
        <ScrollArea className="max-h-[320px]">
          <div className="grid gap-0.5">
            {siblings.map((sib) => (
              <Link
                key={sib.href}
                href={sib.href}
                className={cn(
                  "grid grid-cols-[18px_1fr] items-center gap-2 min-h-[38px] rounded-[9px] px-2 py-1 text-left font-extrabold text-muted-foreground hover:bg-surface-secondary hover:text-foreground",
                  sib.href === href && "bg-surface-secondary text-foreground"
                )}
              >
                <sib.config.icon className="h-4 w-4" />
                <span className="truncate">
                  {sib.config.titleKey ? sib.config.titleKey : sib.config.label}
                </span>
                {sib.href === href && <Check className="h-3.5 w-3.5 ml-auto" />}
              </Link>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
```

- [ ] **Step 2: 类型检查验证**

```bash
cd apps/web && pnpm typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/layout/breadcrumb.tsx
git commit -m "feat(layout): add BreadcrumbNav with segment parsing and Popover dropdown"
```

---

### Task 7: GlobalSearch — Header 全局搜索

**Files:**
- Create: `apps/web/components/layout/global-search.tsx`

**Interfaces:**
- Consumes: `Popover` (popover), `Input` (input), `useRouter` (next/navigation)
- Produces: `GlobalSearch` — `recentSearches`, `onRemoveRecent`, `hotSearches` props

- [ ] **Step 1: 创建全局搜索组件**

创建 `apps/web/components/layout/global-search.tsx`：

```typescript
"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Search, X, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils/index"
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"

interface GlobalSearchProps {
  recentSearches: string[]
  onRemoveRecent?: (query: string) => void
  hotSearches: { query: string; count: number }[]
}

export function GlobalSearch({
  recentSearches = [],
  onRemoveRecent,
  hotSearches = [],
}: GlobalSearchProps) {
  const router = useRouter()
  const [query, setQuery] = React.useState("")
  const [open, setOpen] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const handleSearch = (q: string) => {
    setOpen(false)
    router.push(`/search?q=${encodeURIComponent(q)}`)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && query.trim()) {
      handleSearch(query.trim())
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div
          className={cn(
            "relative flex items-center gap-2 h-10 px-3 w-full max-w-[520px]",
            "border border-border rounded-[10px] bg-surface shadow-sm"
          )}
        >
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setOpen(true)}
            placeholder="搜索插件、页面、作者..."
            className="flex-1 border-0 outline-none bg-transparent text-foreground font-inherit text-[15px] placeholder:text-muted-foreground"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="text-muted-foreground hover:text-foreground"
              aria-label="清除搜索"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </PopoverAnchor>
      <PopoverContent
        className="w-[min(520px,calc(100vw-28px))] p-3"
        align="start"
        sideOffset={6}
        onInteractOutside={() => setOpen(false)}
      >
        <div className="grid gap-3">
          {/* 最近搜索 */}
          {recentSearches.length > 0 && (
            <div className="grid gap-2">
              <span className="text-xs font-black text-muted-foreground">最近搜索</span>
              <div className="flex flex-wrap gap-1.5">
                {recentSearches.map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center gap-1 min-h-[28px] rounded-full bg-surface-secondary px-2.5 text-xs font-extrabold cursor-pointer hover:bg-surface"
                  >
                    <span onClick={() => handleSearch(item)}>{item}</span>
                    {onRemoveRecent && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onRemoveRecent(item)
                        }}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label={`删除 ${item}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 热门搜索 */}
          {hotSearches.length > 0 && (
            <div className="grid gap-1">
              <span className="text-xs font-black text-muted-foreground">热门搜索</span>
              <ScrollArea className="max-h-[240px]">
                <div className="grid gap-0.5">
                  {hotSearches.map((item, idx) => (
                    <button
                      key={item.query}
                      onClick={() => handleSearch(item.query)}
                      className="grid grid-cols-[22px_1fr_auto] items-center gap-2 min-h-[34px] rounded-lg px-2 text-left text-[13px] font-extrabold text-muted-foreground hover:bg-surface-secondary hover:text-foreground"
                    >
                      <span className={cn("text-center", idx < 3 && "text-primary")}>
                        {idx + 1}
                      </span>
                      <span className="truncate">{item.query}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {item.count.toLocaleString()} 次
                        {idx === 0 && <TrendingUp className="inline h-3 w-3 ml-1 text-primary" />}
                      </span>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* 无数据 */}
          {recentSearches.length === 0 && hotSearches.length === 0 && (
            <div className="flex items-center justify-center min-h-[60px] text-sm font-extrabold text-muted-foreground">
              暂无搜索建议
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
```

- [ ] **Step 2: 类型检查验证**

```bash
cd apps/web && pnpm typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/layout/global-search.tsx
git commit -m "feat(layout): add GlobalSearch with popover, recent searches chips, hot search ranking"
```

---

### Task 8: NavPopover — 导航弹出面板

**Files:**
- Create: `apps/web/components/layout/nav-popover.tsx`

**Interfaces:**
- Consumes: `Popover` (popover), `IconButton` (icon-button), `Badge` (badge)
- Produces: `NavPopover` — hover 延迟展开、懒加载内容

- [ ] **Step 1: 创建导航弹出面板**

创建 `apps/web/components/layout/nav-popover.tsx`：

```typescript
"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "@/lib/utils/index"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { IconButton } from "@/components/ui/icon-button"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { LucideIcon } from "lucide-react"

interface PopoverItem {
  thumb?: string
  title: string
  subtitle?: string
  href: string
}

interface NavPopoverProps {
  icon: LucideIcon
  label: string
  badge?: number
  title: string
  items: PopoverItem[]
  onLoadMore?: () => void
  moreLabel?: string
}

export function NavPopover({
  icon: Icon,
  label,
  badge,
  title,
  items,
  onLoadMore,
  moreLabel = "加载更多",
}: NavPopoverProps) {
  const [loaded, setLoaded] = React.useState(false)
  const [open, setOpen] = React.useState(false)
  const openTimeoutRef = React.useRef<ReturnType<typeof setTimeout>>()
  const closeTimeoutRef = React.useRef<ReturnType<typeof setTimeout>>()

  // 260ms 延迟打开（匹配 index.html 参考设计）
  const handleMouseEnter = () => {
    clearTimeout(closeTimeoutRef.current)
    openTimeoutRef.current = setTimeout(() => {
      setOpen(true)
      if (!loaded) setLoaded(true)
    }, 260)
  }

  // 180ms 延迟关闭
  const handleMouseLeave = () => {
    clearTimeout(openTimeoutRef.current)
    closeTimeoutRef.current = setTimeout(() => setOpen(false), 180)
  }

  React.useEffect(() => {
    return () => {
      clearTimeout(openTimeoutRef.current)
      clearTimeout(closeTimeoutRef.current)
    }
  }, [])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className="relative inline-flex"
        >
          <IconButton size="default" label={label}>
            <Icon className="h-[18px] w-[18px]" />
          </IconButton>
          {badge !== undefined && badge > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-destructive" />
          )}
        </span>
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(340px,calc(100vw-28px))] p-2.5"
        align="end"
        sideOffset={8}
        onMouseEnter={() => clearTimeout(closeTimeoutRef.current)}
        onMouseLeave={handleMouseLeave}
      >
        <div className="grid gap-2">
          {/* 标题行 */}
          <div className="flex items-center justify-between min-h-[28px]">
            <span className="font-black text-sm">{title}</span>
          </div>

          {/* 懒加载：首次展开后才渲染内容 */}
          {!loaded ? (
            <div className="flex items-center justify-center min-h-[58px] text-sm font-extrabold text-muted-foreground">
              加载中...
            </div>
          ) : items.length === 0 ? (
            <div className="flex items-center justify-center min-h-[58px] text-sm font-extrabold text-muted-foreground">
              暂无内容
            </div>
          ) : (
            <ScrollArea className="max-h-[320px]">
              <div className="grid gap-1.5">
                {items.map((item, idx) => (
                  <Link
                    key={idx}
                    href={item.href}
                    className="grid grid-cols-[46px_1fr_auto] gap-2 items-center min-h-[56px] rounded-[10px] p-1.5 hover:bg-surface-secondary"
                  >
                    <div
                      className="aspect-square rounded-lg bg-cover bg-center"
                      style={
                        item.thumb
                          ? { backgroundImage: `url(${item.thumb})` }
                          : { background: "linear-gradient(135deg, var(--primary), var(--accent))" }
                      }
                    />
                    <div className="min-w-0 grid gap-0.5">
                      <strong className="text-[13.5px] truncate">{item.title}</strong>
                      {item.subtitle && (
                        <span className="text-xs text-muted-foreground truncate">
                          {item.subtitle}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </ScrollArea>
          )}

          {/* 加载更多 */}
          {loaded && onLoadMore && (
            <Button
              variant="ghost"
              className="min-h-[34px] w-full rounded-[9px] bg-surface-secondary font-black text-[13px]"
              onClick={onLoadMore}
            >
              {moreLabel}
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
```

- [ ] **Step 2: 类型检查验证**

```bash
cd apps/web && pnpm typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/layout/nav-popover.tsx
git commit -m "feat(layout): add NavPopover with 260ms hover delay and lazy loading"
```

---

### Task 9: ReadDrawer — 右侧滑出抽屉

**Files:**
- Create: `apps/web/components/layout/read-drawer.tsx`

**Interfaces:**
- Consumes: `VibenTabs` (viben-tabs), `useSearchParams`/`useRouter` (next/navigation)
- Produces: `ReadDrawer` — URL search param 驱动的右侧抽屉

- [ ] **Step 1: 创建 ReadDrawer 组件**

创建 `apps/web/components/layout/read-drawer.tsx`：

```typescript
"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { X } from "lucide-react"
import { cn } from "@/lib/utils/index"
import { IconButton } from "@/components/ui/icon-button"
import { VibenTabs, VibenTabsList, VibenTabsTrigger, VibenTabsContent } from "@/components/ui/viben-tabs"

interface ReadDrawerTab {
  value: string
  label: string
  badge?: number
  content: React.ReactNode
}

interface ReadDrawerProps {
  tabs: ReadDrawerTab[]
  defaultTab?: string
}

export function ReadDrawer({ tabs, defaultTab }: ReadDrawerProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const open = searchParams.get("drawer") === "open"
  const [activeTab, setActiveTab] = React.useState(defaultTab || tabs[0]?.value || "")

  const setOpen = (open: boolean) => {
    const params = new URLSearchParams(searchParams.toString())
    if (open) {
      params.set("drawer", "open")
    } else {
      params.delete("drawer")
    }
    const qs = params.toString()
    router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false })
  }

  // Escape 键关闭
  React.useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) setOpen(false)
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [open])

  // Body 滚动锁定
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => { document.body.style.overflow = "" }
  }, [open])

  return (
    <>
      {/* 遮罩层 */}
      <div
        className={cn(
          "fixed inset-0 z-80 transition-colors duration-180",
          open
            ? "pointer-events-auto bg-[rgba(6,29,38,0.16)]"
            : "pointer-events-none bg-transparent"
        )}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/* 抽屉 */}
      <div
        className={cn(
          "fixed top-0 right-0 z-90 h-screen",
          "w-[min(420px,calc(100vw-22px))]",
          "grid grid-rows-[auto_1fr]",
          "border-l border-border",
          "bg-background/96 backdrop-blur-[16px]",
          "shadow-[-18px_0_36px_rgba(8,91,117,0.14)]",
          "transition-transform duration-[220ms] ease-out",
          open ? "translate-x-0" : "translate-x-[104%]"
        )}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between gap-2.5 h-[58px] px-3 border-b border-border">
          <VibenTabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex-1"
          >
            <VibenTabsList variant="drawer">
              {tabs.map((tab) => (
                <VibenTabsTrigger key={tab.value} value={tab.value} variant="drawer">
                  {tab.label}
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className="ml-1 text-xs text-muted-foreground">{tab.badge}</span>
                  )}
                </VibenTabsTrigger>
              ))}
            </VibenTabsList>
          </VibenTabs>
          <IconButton size="compact" label="关闭抽屉" onClick={() => setOpen(false)}>
            <X className="h-[18px] w-[18px]" />
          </IconButton>
        </div>

        {/* 内容区 */}
        <div className="overflow-auto p-3">
          {tabs.map((tab) => (
            <div
              key={tab.value}
              className={cn(
                activeTab === tab.value ? "grid gap-3" : "hidden"
              )}
            >
              {tab.content}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: 类型检查验证**

```bash
cd apps/web && pnpm typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/layout/read-drawer.tsx
git commit -m "feat(layout): add ReadDrawer with URL-search-param state and slide animation"
```

---

### Task 10: 搜索页面组件

**Files:**
- Create: `apps/web/components/search/search-page-content.tsx`
- Create: `apps/web/components/search/search-result-card.tsx`
- Create: `apps/web/components/search/search-filter-sidebar.tsx`
- Create: `apps/web/components/search/search-empty.tsx`
- Create: `apps/web/app/(dashboard)/search/page.tsx`

**Interfaces:**
- Consumes: `useSearchParams` (next/navigation), `PageHeader` (shared/page-header), `Card` (card)
- Produces: 完整的 `/search?q=xxx` 搜索页面

- [ ] **Step 1: 创建搜索空状态组件**

创建 `apps/web/components/search/search-empty.tsx`：

```typescript
"use client"

import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"

interface SearchEmptyProps {
  query: string
}

export function SearchEmpty({ query }: SearchEmptyProps) {
  return (
    <div className="grid min-h-[360px] place-items-center rounded-xl border border-border bg-surface p-7 shadow-sm">
      <div className="grid justify-items-center gap-3 max-w-[420px] text-center">
        <div className="grid h-[58px] w-[58px] place-items-center rounded-2xl bg-surface-secondary text-primary">
          <Search className="h-6 w-6" />
        </div>
        <h2 className="font-serif text-xl leading-tight">没有找到结果</h2>
        <p className="text-muted-foreground leading-relaxed">
          换一个关键词，或减少限定词再试一次。
        </p>
        <div className="flex flex-wrap justify-center gap-1.5">
          {["教程", "入门", "MCP", "部署"].map((kw) => (
            <Button key={kw} variant="outline" size="sm" asChild>
              <a href={`/search?q=${encodeURIComponent(kw)}`}>{kw}</a>
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 创建搜索结果卡片**

创建 `apps/web/components/search/search-result-card.tsx`：

```typescript
"use client"

import Link from "next/link"
import { Eye, Heart, MessageSquare } from "lucide-react"
import { cn } from "@/lib/utils/index"

interface SearchResultData {
  id: string
  type: "page" | "author" | "moment" | "paper"
  title: string
  description: string
  coverUrl?: string
  author: { name: string; avatar?: string }
  stats: { views: number; likes: number; comments: number }
  url: string
}

const typeLabels: Record<string, string> = {
  page: "页面",
  author: "作者",
  moment: "动态",
  paper: "论文",
}

export function SearchResultCard({ data }: { data: SearchResultData }) {
  return (
    <Link
      href={data.url}
      className="grid grid-cols-[118px_1fr_auto] gap-2.5 items-stretch rounded-xl border border-border bg-surface p-2 transition-all hover:border-primary/55 hover:shadow-sm"
    >
      {/* 缩略图 */}
      <div
        className="rounded-[9px] bg-cover bg-center min-h-[80px]"
        style={
          data.coverUrl
            ? { backgroundImage: `url(${data.coverUrl})` }
            : { background: "linear-gradient(135deg, var(--primary), var(--accent))" }
        }
      />

      {/* 正文 */}
      <div className="min-w-0 grid content-center gap-1.5">
        <span className="inline-flex items-center gap-1 w-max min-h-[22px] rounded-full bg-surface-secondary text-primary px-1.5 text-xs font-black">
          {typeLabels[data.type] || data.type}
        </span>
        <h3 className="text-sm font-extrabold truncate">{data.title}</h3>
        <p className="text-[13px] text-muted-foreground truncate">
          {data.description}
        </p>
        <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground font-bold">
          <span className="truncate text-foreground">{data.author.name}</span>
        </div>
      </div>

      {/* 统计 */}
      <div className="flex flex-col justify-center gap-2 text-xs text-muted-foreground font-extrabold shrink-0">
        <span className="inline-flex items-center gap-1">
          <Eye className="h-3.5 w-3.5" />
          {data.stats.views.toLocaleString()}
        </span>
        <span className="inline-flex items-center gap-1">
          <Heart className="h-3.5 w-3.5" />
          {data.stats.likes.toLocaleString()}
        </span>
        <span className="inline-flex items-center gap-1">
          <MessageSquare className="h-3.5 w-3.5" />
          {data.stats.comments.toLocaleString()}
        </span>
      </div>
    </Link>
  )
}
```

- [ ] **Step 3: 创建筛选侧栏**

创建 `apps/web/components/search/search-filter-sidebar.tsx`：

```typescript
"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { cn } from "@/lib/utils/index"

interface FilterItem {
  label: string
  count: number
  value: string
}

interface SearchFilterSidebarProps {
  filters: FilterItem[]
  activeFilter: string
}

export function SearchFilterSidebar({ filters, activeFilter }: SearchFilterSidebarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleFilter = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set("filter", value)
    } else {
      params.delete("filter")
    }
    router.push(`/search?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="grid gap-1.5">
      {filters.map((f) => (
        <button
          key={f.value}
          onClick={() => handleFilter(f.value === activeFilter ? "" : f.value)}
          className={cn(
            "flex items-center justify-between min-h-[34px] rounded-[9px] px-2.5 font-extrabold text-sm",
            f.value === activeFilter
              ? "bg-surface-secondary text-foreground"
              : "text-muted-foreground hover:bg-surface-secondary hover:text-foreground"
          )}
        >
          <span>
            {f.label} ({f.count})
          </span>
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: 创建搜索页面主内容**

创建 `apps/web/components/search/search-page-content.tsx`：

```typescript
"use client"

import { useSearchParams } from "next/navigation"
import { SearchResultCard } from "./search-result-card"
import { SearchFilterSidebar } from "./search-filter-sidebar"
import { SearchEmpty } from "./search-empty"
import type { SearchResultData } from "./search-result-card"

// Mock 数据 — 后续接入 API
const mockFilters = [
  { label: "页面", count: 45, value: "page" },
  { label: "作者", count: 23, value: "author" },
  { label: "动态", count: 31, value: "moment" },
  { label: "论文", count: 14, value: "paper" },
]

const mockResults: SearchResultData[] = [
  {
    id: "1",
    type: "page",
    title: "插件发布清单",
    description: "如何高效发布你的第一个MCP插件",
    author: { name: "兮尘" },
    stats: { views: 12345, likes: 328, comments: 128 },
    url: "/read/xichen/plugin-checklist",
  },
  {
    id: "2",
    type: "page",
    title: "MCP 插件开发完全指南",
    description: "从零开始构建你的MCP服务",
    author: { name: "周一诺" },
    stats: { views: 8543, likes: 256, comments: 89 },
    url: "/read/yinuo/mcp-guide",
  },
  {
    id: "3",
    type: "page",
    title: "Viben 入门教程",
    description: "快速上手Viben的完整指南",
    author: { name: "林越" },
    stats: { views: 6543, likes: 198, comments: 67 },
    url: "/read/linyue/viben-intro",
  },
]

const EMPTY_TRIGGERS = ["不存在", "空", "无结果", "zzzz"]

export function SearchPageContent() {
  const searchParams = useSearchParams()
  const query = searchParams.get("q") || "插件发布清单"
  const activeFilter = searchParams.get("filter") || ""
  const isEmpty = EMPTY_TRIGGERS.includes(query.toLowerCase())

  if (isEmpty) {
    return <SearchEmpty query={query} />
  }

  return (
    <div className="grid gap-4">
      {/* 摘要栏 */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground font-bold">
          &ldquo;{query}&rdquo; 的搜索结果 共 113 条
        </p>
        {/* 排序按钮（占位） */}
      </div>

      <div className="grid grid-cols-[200px_1fr] gap-4 items-start">
        {/* 筛选侧栏 */}
        <SearchFilterSidebar filters={mockFilters} activeFilter={activeFilter} />

        {/* 结果列表 */}
        <div className="grid gap-2">
          {mockResults.map((result) => (
            <SearchResultCard key={result.id} data={result} />
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: 创建搜索页面路由**

创建 `apps/web/app/(dashboard)/search/page.tsx`：

```typescript
import { Suspense } from "react"
import { SearchPageContent } from "@/components/search/search-page-content"

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-[360px] flex items-center justify-center">加载中...</div>}>
      <SearchPageContent />
    </Suspense>
  )
}
```

- [ ] **Step 6: 类型检查验证**

```bash
cd apps/web && pnpm typecheck
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/search/ apps/web/app/\(dashboard\)/search/
git commit -m "feat(search): add search page with filter sidebar, result cards, empty state"
```

---

### Task 11: Topbar — 顶栏组件

**Files:**
- Create: `apps/web/components/layout/topbar.tsx`
- Create: `apps/web/components/layout/topbar-mode.ts`

**Interfaces:**
- Consumes: `BreadcrumbNav` (breadcrumb), `GlobalSearch` (global-search), `NavPopover` (nav-popover), `IconButton` (icon-button), `VibenTabs` (viben-tabs), `usePathname` (next/navigation); `UserMenu` + `HeaderAuthButtons` + `ThemeToggle` + `LanguageSwitcher` (保留组件)
- Produces: `Topbar` — 客户端组件，路由驱动三模式

- [ ] **Step 1: 创建模式映射**

创建 `apps/web/components/layout/topbar-mode.ts`：

```typescript
export type TopbarMode = "default" | "read" | "landing"

export function getTopbarMode(pathname: string): TopbarMode {
  if (pathname.startsWith("/landing")) return "landing"
  if (pathname.startsWith("/read/")) return "read"
  return "default"
}
```

- [ ] **Step 2: 创建 Topbar 组件**

创建 `apps/web/components/layout/topbar.tsx`：

```typescript
"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { Bell, Clock, PanelRight, Maximize2, MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils/index"
import { getTopbarMode, type TopbarMode } from "./topbar-mode"
import { BreadcrumbNav } from "./breadcrumb"
import { GlobalSearch } from "./global-search"
import { NavPopover } from "./nav-popover"
import { IconButton } from "@/components/ui/icon-button"
import { VibenTabs, VibenTabsList, VibenTabsTrigger } from "@/components/ui/viben-tabs"
import { VibenLogo } from "@/components/shared/viben-logo"
import { UserMenu } from "./user-menu"
import { HeaderAuthButtons } from "./header-auth-buttons"
import { ThemeToggle } from "./theme-toggle"
import { LanguageSwitcher } from "./language-switcher"
import type { Session } from "@/lib/auth/types"

// Mock 数据 — 后续接入 API
const mockNotifications = [
  { title: "宁舟 发布了 插件发布清单", subtitle: "6 分钟前 · 28 评论", href: "#", thumb: "" },
  { title: "周一诺 收藏了你的页面", subtitle: "22 分钟前", href: "#", thumb: "" },
  { title: "林越 评论了 幽蓝塔纪事", subtitle: "1 小时前", href: "#", thumb: "" },
  { title: "Viben 团队 v1.3.3 版本发布", subtitle: "3 小时前", href: "#", thumb: "" },
]

const mockHistory = [
  { title: "幽蓝塔纪事", subtitle: "读到 68% · 第 2 章 · 昨天", href: "#", thumb: "" },
  { title: "MCP 开发指南", subtitle: "读到 32% · 第 1 章 · 2 天前", href: "#", thumb: "" },
  { title: "论文写作助手", subtitle: "已读完 · 3 天前 · 来自 榜单", href: "#", thumb: "" },
]

const mockHotSearches = [
  { query: "插件发布清单", count: 12345 },
  { query: "MCP 开发指南", count: 8920 },
  { query: "Viben 入门教程", count: 6543 },
  { query: "ClawHub 云开发", count: 5210 },
  { query: "AI 工作流设计", count: 4876 },
  { query: "页面发布教程", count: 3421 },
  { query: "自动化部署指南", count: 2980 },
  { query: "多智能体协同", count: 2450 },
]

const mockRecentSearches = ["插件发布清单", "viben教程"]

interface TopbarProps {
  session: Session | null
  onToggleSidebar: () => void
}

export function Topbar({ session, onToggleSidebar }: TopbarProps) {
  const pathname = usePathname()
  const mode = getTopbarMode(pathname)

  if (mode === "landing") return null

  const isRead = mode === "read"

  return (
    <header
      className={cn(
        "top-0 z-50 h-[var(--nav-h)] border-b border-border",
        isRead
          ? "fixed left-0 right-0 bg-background/68 backdrop-blur-[18px] saturate-[1.18] border-border/52"
          : "sticky bg-background/88 backdrop-blur-[14px]"
      )}
    >
      <div
        className={cn(
          "relative h-full mx-auto flex items-center",
          isRead
            ? "w-full px-4 grid gap-3"
            : "w-[min(1280px,calc(100%-28px))] grid gap-3"
        )}
        style={{
          gridTemplateColumns: isRead
            ? "minmax(430px, 1.45fr) minmax(160px, 260px) auto"
            : "minmax(180px, 1fr) minmax(260px, 520px) minmax(180px, 1fr)",
        }}
      >
        {/* ===== Left ===== */}
        <div className="flex items-center gap-2 min-w-0">
          {/* 侧边栏切换按钮 */}
          <IconButton size="compact" label="切换侧边栏" onClick={onToggleSidebar}>
            <svg className="h-[18px] w-[18px]" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 4h12M3 9h12M3 14h12" />
            </svg>
          </IconButton>

          {/* 品牌 Logo（default 模式） */}
          {!isRead && (
            <span className="inline-flex items-center gap-2 shrink-0">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-linear-to-br from-primary to-accent text-white shadow-sm">
                <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 0L16 8L8 16L0 8Z" />
                </svg>
              </span>
              <span className="font-bold text-foreground font-[Lexend]">Viben</span>
            </span>
          )}

          {/* 面包屑 */}
          <BreadcrumbNav variant={isRead ? "read" : "global"} />
        </div>

        {/* ===== Center ===== */}
        <div
          className={cn(
            "flex items-center",
            isRead
              ? "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-2 pointer-events-none w-max"
              : "justify-center min-w-0"
          )}
        >
          {isRead ? (
            <div className="pointer-events-auto">
              <VibenTabs defaultValue="page">
                <VibenTabsList variant="pill">
                  <VibenTabsTrigger value="page" variant="pill">📄 页面</VibenTabsTrigger>
                  <VibenTabsTrigger value="side" variant="pill">📋 副页</VibenTabsTrigger>
                </VibenTabsList>
              </VibenTabs>
            </div>
          ) : (
            <GlobalSearch
              recentSearches={mockRecentSearches}
              hotSearches={mockHotSearches}
            />
          )}
        </div>

        {/* ===== Right ===== */}
        <div className="flex items-center justify-end gap-1.5 min-w-0">
          {isRead ? (
            <>
              {/* 阅读模式操作 */}
              <IconButton size="default" label="展开详情侧栏">
                <PanelRight className="h-[18px] w-[18px]" />
              </IconButton>
              <IconButton size="default" label="沉浸式阅读">
                <Maximize2 className="h-[18px] w-[18px]" />
              </IconButton>
              <ReadMoreMenu />
            </>
          ) : (
            <>
              {/* 默认模式操作 */}
              <LanguageSwitcher />
              <ThemeToggle />
              {session ? (
                <>
                  <NavPopover
                    icon={Bell}
                    label="通知"
                    badge={2}
                    title="动态"
                    items={mockNotifications}
                    moreLabel="加载更多动态"
                  />
                  <NavPopover
                    icon={Clock}
                    label="浏览历史"
                    title="最近阅读"
                    items={mockHistory}
                    moreLabel="查看全部历史"
                  />
                  <UserMenu session={session} />
                </>
              ) : (
                <HeaderAuthButtons />
              )}
            </>
          )}
        </div>
      </div>
    </header>
  )
}

function ReadMoreMenu() {
  const [open, setOpen] = React.useState(false)

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <IconButton size="default" label="更多操作">
        <MoreHorizontal className="h-[18px] w-[18px]" />
      </IconButton>
      {open && (
        <div className="absolute top-full right-0 z-70 w-[min(180px,calc(100vw-28px))] grid gap-1 p-1.5 rounded-xl border border-border bg-popover/98 backdrop-blur-[14px] shadow-md">
          <button className="grid grid-cols-[18px_1fr] items-center gap-2 min-h-[38px] rounded-[9px] px-2.5 text-left font-extrabold text-muted-foreground hover:bg-surface-secondary hover:text-foreground">
            🚩 举报
          </button>
          <button className="grid grid-cols-[18px_1fr] items-center gap-2 min-h-[38px] rounded-[9px] px-2.5 text-left font-extrabold text-muted-foreground hover:bg-surface-secondary hover:text-foreground">
            💬 反馈
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 类型检查验证**

```bash
cd apps/web && pnpm typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/layout/topbar.tsx apps/web/components/layout/topbar-mode.ts
git commit -m "feat(layout): add Topbar with 3 route-driven modes (default/read/landing)"
```

---

### Task 12: AppShell + 布局重写

**Files:**
- Create: `apps/web/components/layout/app-shell.tsx`
- Modify: `apps/web/components/layout/sidebar.tsx` — 添加折叠动画
- Modify: `apps/web/components/layout/sidebar-wrapper.tsx` — 适配 AppShell props
- Rewrite: `apps/web/app/(dashboard)/layout.tsx`
- Rewrite: `apps/web/app/(admin)/layout.tsx`
- Delete: `apps/web/components/layout/header.tsx`
- Delete: `apps/web/components/layout/header-breadcrumb.tsx`

**Interfaces:**
- Consumes: `Topbar` (topbar), `Sidebar` (sidebar), `Session` (auth types)
- Produces: `AppShell` — 完整页面框架壳

- [ ] **Step 1: 创建 AppShell 组件**

创建 `apps/web/components/layout/app-shell.tsx`：

```typescript
"use client"

import * as React from "react"
import { createContext, useContext } from "react"
import { Topbar } from "./topbar"
import { Sidebar } from "./sidebar"
import type { Session } from "@/lib/auth/types"

// ===== AppShell Context =====
interface AppShellContextType {
  session: Session | null
  sidebarCollapsed: boolean
  toggleSidebar: () => void
}

const AppShellContext = createContext<AppShellContextType>({
  session: null,
  sidebarCollapsed: false,
  toggleSidebar: () => {},
})

export function useAppShell() {
  return useContext(AppShellContext)
}

// ===== AppShell Component =====
interface AppShellProps {
  children: React.ReactNode
  session: Session | null
  adminStats?: { pendingPackagesCount: number }
}

export function AppShell({ children, session, adminStats }: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(() => {
    if (typeof window === "undefined") return false
    return localStorage.getItem("viben-sidebar-collapsed") === "true"
  })

  const toggleSidebar = React.useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      localStorage.setItem("viben-sidebar-collapsed", String(next))
      return next
    })
  }, [])

  const contextValue = React.useMemo<AppShellContextType>(
    () => ({ session, sidebarCollapsed, toggleSidebar }),
    [session, sidebarCollapsed, toggleSidebar]
  )

  return (
    <AppShellContext.Provider value={contextValue}>
      <div className="flex h-screen flex-col overflow-hidden">
        <Topbar session={session} onToggleSidebar={toggleSidebar} />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar
            collapsed={sidebarCollapsed}
            session={session}
            pendingPackagesCount={adminStats?.pendingPackagesCount}
          />
          <main className="flex-1 overflow-y-auto">
            <div className="w-[min(1280px,100%)] mx-auto px-4 py-4">
              {children}
            </div>
          </main>
        </div>
      </div>
    </AppShellContext.Provider>
  )
}
```

- [ ] **Step 2: 重写 Sidebar — 添加折叠动画**

修改 `apps/web/components/layout/sidebar.tsx`。核心改动：接受 `collapsed` prop，添加宽度过渡。

在现有文件基础上，做以下修改：

1. 修改 `SidebarProps` 接口：
```typescript
interface SidebarProps {
  collapsed: boolean
  session?: { role?: string; username?: string; email?: string; avatarUrl?: string } | null
  pendingPackagesCount?: number
}
```

2. 修改最外层的 `<aside>` 元素：
```typescript
<aside
  className={cn(
    "flex flex-col border-r bg-background transition-[width] duration-200 ease-out overflow-hidden",
    collapsed ? "w-0 border-r-0" : "w-[var(--sidebar-w)]"
  )}
>
```

3. 保留原有的所有导航逻辑（Main/My/Creator/Admin 区域、Footer 用户信息/登录按钮），仅修改 props 接口和容器样式。

- [ ] **Step 3: 修改 SidebarWrapper**

修改 `apps/web/components/layout/sidebar-wrapper.tsx` — 因为 session 现在由 AppShell 传入，SidebarWrapper 不再需要。将其简化为直接导出 Sidebar：

```typescript
// sidebar-wrapper.tsx 内容替换为：
export { Sidebar } from "./sidebar"
```

或直接删除 sidebar-wrapper.tsx，因为 AppShell 直接引入 Sidebar。

- [ ] **Step 4: 重写 Dashboard Layout**

重写 `apps/web/app/(dashboard)/layout.tsx`：

```typescript
import { getSession } from "@/lib/auth/cookies"
import { AppShell } from "@/components/layout/app-shell"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()

  return (
    <AppShell session={session}>
      {children}
    </AppShell>
  )
}
```

- [ ] **Step 5: 重写 Admin Layout**

重写 `apps/web/app/(admin)/layout.tsx`（保留鉴权逻辑）：

```typescript
import { redirect } from "next/navigation"
import { getSession, isAdminRole } from "@/lib/auth"
import { countPendingPackages } from "@/lib/admin/stats"
import { AppShell } from "@/components/layout/app-shell"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()

  // 保留管理员鉴权
  if (!session || !isAdminRole(session.role)) {
    redirect("/")
  }

  const pendingPackagesCount = await countPendingPackages()

  return (
    <AppShell session={session} adminStats={{ pendingPackagesCount }}>
      {children}
    </AppShell>
  )
}
```

- [ ] **Step 6: 删除旧文件**

```bash
rm apps/web/components/layout/header.tsx
rm apps/web/components/layout/header-breadcrumb.tsx
```

- [ ] **Step 7: 类型检查验证**

```bash
cd apps/web && pnpm typecheck
```

⚠️ 注意：此 task 可能产生多处类型错误。需要逐个检查依赖了旧 `Header` / `HeaderBreadcrumb` 的引用是否全部清理。常见的遗留引用：
- `(dashboard)/layout.tsx` 中的 `import { Header }` — 已重写 ✓
- `(admin)/layout.tsx` 中的 `import { Header }` — 已重写 ✓
- SidebarWrapper 的导出 — 已处理 ✓

Expected: PASS（所有残留引用已清理）

- [ ] **Step 8: Commit**

```bash
git add apps/web/components/layout/app-shell.tsx \
        apps/web/components/layout/sidebar.tsx \
        apps/web/components/layout/sidebar-wrapper.tsx \
        apps/web/app/\(dashboard\)/layout.tsx \
        apps/web/app/\(admin\)/layout.tsx
git rm apps/web/components/layout/header.tsx \
        apps/web/components/layout/header-breadcrumb.tsx
git commit -m "feat(layout): integrate AppShell with Topbar + collapsible Sidebar, remove old header"
```

---

## 验证清单

在所有 task 完成后，执行以下验证：

### 编译检查
```bash
cd apps/web && pnpm typecheck
```
Expected: PASS（零 TS 错误）

### 视觉检查
启动 dev server 后验证：
- `/` — 首页在 AppShell 中渲染，Topbar 默认模式 + 侧边栏展开
- `/mcp-market` — Dashboard 页面正常渲染
- `/read/xichen/test` — 阅读模式 Topbar + 居中 Tabs
- `/landing` — Topbar 和侧边栏完全隐藏
- `/search?q=test` — 搜索页面显示 mock 结果
- `/admin` — 管理页面正常 + 侧边栏 Admin 区域可见
- 折叠/展开侧边栏 — 动画流畅，localStorage 持久化
- 暗色模式切换 — 色值正确

### 其他检查
- `/login` 和 `/register` — 认证页面不受影响（(auth) 布局不变）
- `Header` 和 `HeaderBreadcrumb` 文件已删除
- 无残留的 `import { Header }` 引用

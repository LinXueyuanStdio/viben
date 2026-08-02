# 首页聚合与导航精简 - 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在首页及相关页面顶部添加导航 TabBar 聚合浏览入口，新增大市场页面，精简侧边栏只保留 Home。

**Architecture:** 两个新的客户端 TabBar 组件（HomeTabBar、MarketTabBar）分别嵌入现有页面顶部，/market 做重定向页面，sidebar 删减导航项。

**Tech Stack:** Next.js App Router, React, shadcn/ui Tabs, lucide-react

## Global Constraints

- 使用项目已有的 `Tabs` / `TabsList` / `TabsTrigger` 组件（`@/components/ui/tabs`），非 VibenTabs
- 所有页面文件使用绝对路径
- 遵循 CLAUDE.md 中的 TypeScript import style 规则
- 修改完成后需 verify：`cd apps/web && pnpm typecheck`

---

### Task 1: 创建 HomeTabBar 组件

**Files:**
- Create: `apps/web/components/layout/home-tab-bar.tsx`

**Interfaces:**
- Produces: `HomeTabBar` — 无 props 的客户端组件，读取 pathname 自动判断 active tab

- [ ] **Step 1: 创建 HomeTabBar 组件文件**

```tsx
'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Home, MessageSquare, TrendingUp, Grid3X3, ShoppingBag, ExternalLink } from 'lucide-react';

const HOME_TABS = [
  { key: 'home', label: '首页', href: '/', icon: Home },
  { key: 'moment', label: '动态', href: '/moment', icon: MessageSquare },
  { key: 'leaderboard', label: '榜单', href: '/leaderboard', icon: TrendingUp },
  { key: 'category', label: '分类', href: '/category', icon: Grid3X3 },
  { key: 'market', label: '市场', href: '/market', icon: ShoppingBag, external: true },
] as const;

function resolveActiveTab(pathname: string): string {
  if (pathname === '/') return 'home';
  if (pathname.startsWith('/moment')) return 'moment';
  if (pathname.startsWith('/leaderboard')) return 'leaderboard';
  if (pathname.startsWith('/category')) return 'category';
  return 'home';
}

export function HomeTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const activeTab = resolveActiveTab(pathname);

  const handleTabChange = (value: string) => {
    const tab = HOME_TABS.find((t) => t.key === value);
    if (!tab) return;
    if (tab.external) {
      window.open(tab.href, '_blank');
      return;
    }
    router.push(tab.href);
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <TabsList>
        {HOME_TABS.map((tab) => (
          <TabsTrigger key={tab.key} value={tab.key}>
            <tab.icon className="mr-1.5 h-4 w-4" />
            {tab.label}
            {tab.external && <ExternalLink className="ml-1 h-3 w-3 opacity-50" />}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
```

- [ ] **Step 2: 验证文件语法正确**

Run: `cd apps/web && npx tsc --noEmit --pretty components/layout/home-tab-bar.tsx` (后续统一 typecheck)

---

### Task 2: 创建 MarketTabBar 组件

**Files:**
- Create: `apps/web/components/layout/market-tab-bar.tsx`

**Interfaces:**
- Produces: `MarketTabBar` — 无 props 的客户端组件，读取 pathname 自动判断 active tab

- [ ] **Step 1: 创建 MarketTabBar 组件文件**

```tsx
'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, Sparkles } from 'lucide-react';

const MARKET_TABS = [
  { key: 'mcp', label: 'MCP', href: '/mcp-market', icon: Package },
  { key: 'skill', label: '技能', href: '/skill-market', icon: Sparkles },
] as const;

function resolveActiveTab(pathname: string): string {
  if (pathname.startsWith('/mcp-market')) return 'mcp';
  if (pathname.startsWith('/skill-market')) return 'skill';
  return 'mcp';
}

export function MarketTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const activeTab = resolveActiveTab(pathname);

  const handleTabChange = (value: string) => {
    const tab = MARKET_TABS.find((t) => t.key === value);
    if (!tab) return;
    router.push(tab.href);
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <TabsList>
        {MARKET_TABS.map((tab) => (
          <TabsTrigger key={tab.key} value={tab.key}>
            <tab.icon className="mr-1.5 h-4 w-4" />
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
```

- [ ] **Step 2: 验证文件语法**

Run: `cd apps/web && npx tsc --noEmit --pretty components/layout/market-tab-bar.tsx`

---

### Task 3: 创建 /market 重定向页面

**Files:**
- Create: `apps/web/app/(dashboard)/market/page.tsx`

**Interfaces:**
- 无依赖，纯服务端重定向

- [ ] **Step 1: 创建 /market 页面**

```tsx
import { redirect } from 'next/navigation';

export default function MarketPage() {
  redirect('/mcp-market');
}
```

- [ ] **Step 2: 验证文件语法**

Run: `cd apps/web && npx tsc --noEmit --pretty "app/(dashboard)/market/page.tsx"`

---

### Task 4: 在 4 个页面顶部添加 HomeTabBar

**Files:**
- Modify: `apps/web/app/(dashboard)/page.tsx`
- Modify: `apps/web/app/(dashboard)/moment/page.tsx`
- Modify: `apps/web/app/(dashboard)/leaderboard/page.tsx`
- Modify: `apps/web/app/(dashboard)/category/page.tsx`

**Interfaces:**
- Consumes: `HomeTabBar` from `@/components/layout/home-tab-bar`

- [ ] **Step 1: 修改首页 page.tsx**

在 `apps/web/app/(dashboard)/page.tsx` 中，在 return 的 `<div className="grid ...">` 之前插入 `HomeTabBar`：

```tsx
import { HomeTabBar } from "@/components/layout/home-tab-bar";

// 在 return 中，最外层 grid div 之前添加：
return (
  <>
    <div className="mb-3">
      <HomeTabBar />
    </div>
    <div className="grid gap-[14px] grid-cols-1 md:grid-cols-[1fr_240px] lg:grid-cols-[1fr_280px] xl:grid-cols-[1fr_330px]">
      {/* 原有内容不变 */}
    </div>
  </>
)
```

注意：原 `return` 只是单个 `<div>`，需要改为 `<>...</>` Fragment 包裹。

- [ ] **Step 2: 修改动态页 moment/page.tsx**

在 return 的最外层 `<div className="grid ...">` 之前插入 `HomeTabBar`，同理用 Fragment 包裹。

- [ ] **Step 3: 修改榜单页 leaderboard/page.tsx**

在 return 的最外层 `<div className="grid gap-3">` 之前插入 `HomeTabBar`。

- [ ] **Step 4: 修改分类页 category/page.tsx**

在两个 return 分支（有分类 / 无分类）的最外层 grid div 之前都插入 `HomeTabBar`。

导入：`import { HomeTabBar } from "@/components/layout/home-tab-bar";`

---

### Task 5: 在 MCP/Skill 市场页添加 MarketTabBar

**Files:**
- Modify: `apps/web/app/(dashboard)/mcp-market/page.tsx`
- Modify: `apps/web/app/(dashboard)/skill-market/page.tsx`

**Interfaces:**
- Consumes: `MarketTabBar` from `@/components/layout/market-tab-bar`

- [ ] **Step 1: 修改 mcp-market/page.tsx**

在 return 的 `<div className="space-y-6">` 内最顶部（`<McpPageHeader>` 上方）插入：

```tsx
import { MarketTabBar } from "@/components/layout/market-tab-bar";

// 在 return 中：
<div className="space-y-6">
  <MarketTabBar />
  <McpPageHeader isAuthenticated={!!session} />
  {/* 其余不变 */}
</div>
```

- [ ] **Step 2: 修改 skill-market/page.tsx**

同理，在 `<div className="space-y-6">` 内最顶部插入 `<MarketTabBar />`。

---

### Task 6: 精简侧边栏

**Files:**
- Modify: `apps/web/components/layout/sidebar.tsx`

**Interfaces:**
- 无新增接口，只缩减现有数组

- [ ] **Step 1: 缩减 browseNavigation 数组**

将 `browseNavigation` 从 5 项改为 1 项：

```typescript
const browseNavigation = [
  { nameKey: 'nav.home', href: '/', icon: Home },
];
```

- [ ] **Step 2: 删除 Market section**

删除 `navigation` 数组定义（原第 40-44 行）：

```typescript
// 删除以下代码块：
const navigation = [
  { nameKey: 'nav.mcpMarketplace', href: '/mcp-market', icon: Package },
  { nameKey: 'nav.skillsMarket', href: '/skill-market', icon: Sparkles },
  { nameKey: 'nav.collections', href: '/collections', icon: Layers },
];
```

删除对应的渲染块（原第 245-263 行，即 `{navigation.map(...)}` 及上方的 `<div className="my-4 border-t" />` 分隔线）。

- [ ] **Step 3: 清理未使用的 icon imports**

检查并移除不再使用的图标 import：
- `Grid3X3` — 检查：admin 组仍有 `Grid3X3` 用于 categories → **保留**
- `TrendingUp` — 检查：admin 组仍有 `TrendingUp` 用于 rankings → **保留**
- `MessageSquare` — 检查：admin 组仍有 `MessageSquare` 用于 comments/feedbacks/topics → **保留**
- `Users` — 检查：admin 组仍有 `Users` 用于 users → **保留**
- `Layers` — 检查：admin 组仍有 `Layers` 用于 collections/operations → **保留**
- `Package`、`Sparkles` — 仅 navigation 数组使用，但 admin 未用 → 检查 admin：`Package` 用于 packages，`Sparkles` 用于 skill-market → **保留**

经检查，所有图标在 admin 组或其他处仍有引用，无需移除 import。只需移除 `navigation` 数组和 `browseNavigation` 中的 4 项。

---

### Task 7: 删除 Author 和 Collections 列表页面

**Files:**
- Delete: `apps/web/app/(dashboard)/author/page.tsx`
- Delete: `apps/web/app/(dashboard)/collections/page.tsx`

- [ ] **Step 1: 删除 author 页面**

```bash
Remove-Item -Force "apps/web/app/(dashboard)/author/page.tsx"
```

- [ ] **Step 2: 删除 collections 列表页面**

```bash
Remove-Item -Force "apps/web/app/(dashboard)/collections/page.tsx"
```

注意：保留 `collections/[id]/page.tsx` 和 `collections/[id]/edit/page.tsx`。

---

### Task 8: 更新路由注册表

**Files:**
- Modify: `apps/web/lib/navigation/route-registry.ts`

- [ ] **Step 1: 移除已删除页面的路由条目**

移除：
- `/author` 条目（第 56 行）
- `/collections` 条目（第 65 行）

注意：保留 `/admin/collections`（管理员合集管理）。

- [ ] **Step 2: 添加新路由条目**

在 "市场" section 之前添加：

```typescript
"/market": { label: "市场", icon: ShoppingBag, parent: "/", dropdownCategory: "市场" },
```

需要添加 `ShoppingBag` 到 lucide-react import 中。

---

### Task 9: 验证编译通过

**Files:**
- 无

- [ ] **Step 1: Typecheck apps/web**

```bash
cd apps/web && pnpm typecheck
```

预期：无类型错误。

- [ ] **Step 2: 修复编译错误（如有）**

根据 typecheck 输出修复任何类型错误或缺失 import。

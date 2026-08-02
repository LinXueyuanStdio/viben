# 首页聚合与导航精简 - 设计文档

**日期**: 2026-08-02
**状态**: 已确认

---

## 概述

1. 首页及相关页面顶部添加导航 TabBar，聚合分散的浏览入口
2. 新增 `/market` 页面作为 MCP/Skill 市场的统一入口，市场页面加 TabBar 互相切换
3. 左侧边栏大幅精简：浏览区只保留 Home 一项，移除 Authors 和 Collections 页面

---

## 详细设计

### 1. HomeTabBar - 首页导航组件

**文件**: `apps/web/components/layout/home-tab-bar.tsx`（新建）

**类型**: 客户端组件 (`'use client'`)

**行为**:
- 5 个 tab: 首页、动态、榜单、分类、市场
- `value` 由当前 `pathname` 决定映射关系：
  - `/` → `home`
  - `/moment` → `moment`
  - `/leaderboard` → `leaderboard`
  - `/category` → `category`
- 点击「首页」「动态」「榜单」「分类」→ `router.push(href)`
- 点击「市场」→ `window.open('/market', '_blank')`
- 使用项目现有的 `Tabs` / `TabsList` / `TabsTrigger` 组件

**使用位置**（在各自 `page.tsx` 内容区最顶部）:
- `app/(dashboard)/page.tsx` — 首页
- `app/(dashboard)/moment/page.tsx` — 动态
- `app/(dashboard)/leaderboard/page.tsx` — 榜单
- `app/(dashboard)/category/page.tsx` — 分类

**外观**:
```
┌──────────────────────────────────────────┐
│  [首页]  [动态]  [榜单]  [分类]  [市场 ↗] │
└──────────────────────────────────────────┘
```

### 2. /market 页面 + MarketTabBar

#### 2a. `/market` 页面

**文件**: `apps/web/app/(dashboard)/market/page.tsx`（新建）

**类型**: 服务端组件

**行为**: 简单重定向到 `/mcp-market`

```tsx
import { redirect } from 'next/navigation';

export default function MarketPage() {
  redirect('/mcp-market');
}
```

#### 2b. MarketTabBar - 市场导航组件

**文件**: `apps/web/components/layout/market-tab-bar.tsx`（新建）

**类型**: 客户端组件 (`'use client'`)

**行为**:
- 2 个 tab: MCP、技能
- `value` 由当前 `pathname` 决定：
  - `/mcp-market` → `mcp`
  - `/skill-market` → `skill`
- 点击 tab → `router.push(href)` 导航

**使用位置**（在页面 `SourceTabs` / `SkillSourceTabs` 上方）:
- `app/(dashboard)/mcp-market/page.tsx` — MCP 市场
- `app/(dashboard)/skill-market/page.tsx` — 技能市场

**外观**:
```
/mcp-market:
┌──────────────────────────────────────┐
│  [[MCP]]    [技能]                   │
├──────────────────────────────────────┤
│  (SourceTabs: official/community)    │
│  (原有内容...)                        │
└──────────────────────────────────────┘

/skill-market:
┌──────────────────────────────────────┐
│  [MCP]    [[技能]]                   │
├──────────────────────────────────────┤
│  (SkillSourceTabs: official/community)│
│  (原有内容...)                        │
└──────────────────────────────────────┘
```

### 3. 侧边栏精简

**文件**: `apps/web/components/layout/sidebar.tsx`（修改）

**变更**:

`browseNavigation` 从 5 项精简为 1 项：
```typescript
// Before
const browseNavigation = [
  { nameKey: 'nav.home', href: '/', icon: Home },
  { nameKey: 'nav.category', href: '/category', icon: Grid3X3 },
  { nameKey: 'nav.leaderboard', href: '/leaderboard', icon: TrendingUp },
  { nameKey: 'nav.moment', href: '/moment', icon: MessageSquare },
  { nameKey: 'nav.author', href: '/author', icon: Users },
];

// After
const browseNavigation = [
  { nameKey: 'nav.home', href: '/', icon: Home },
];
```

移除整个「Market」section（`navigation` 数组 + 渲染块），不再需要侧边栏中显示 MCP Marketplace、Skills Market、Collections。

清理不再使用的图标 import：`Grid3X3`、`TrendingUp`、`MessageSquare`、`Users`（如 Author 页面移除后确无其他引用；需检查 `Grid3X3` 是否在 admin 和其他处仍有使用）。

### 4. 页面移除

- 删除 `app/(dashboard)/author/page.tsx`
- 删除 `app/(dashboard)/collections/page.tsx`（列表页）
- 保留 `app/(dashboard)/collections/[id]/page.tsx` 和 `collections/[id]/edit/page.tsx`（详情/编辑页仍可通过直接链接访问）

### 5. 路由注册表更新

**文件**: `apps/web/lib/navigation/route-registry.ts`（修改）

- 移除 `/author` 路由条目
- 移除 `/collections` 路由条目（保留详情页路由）
- 添加 `/market` 路由条目

---

## 文件变更清单

| 操作 | 文件 | 说明 |
|------|------|------|
| 新建 | `components/layout/home-tab-bar.tsx` | 首页导航 TabBar 组件 |
| 新建 | `components/layout/market-tab-bar.tsx` | 市场导航 TabBar 组件 |
| 新建 | `app/(dashboard)/market/page.tsx` | /market 重定向页面 |
| 修改 | `app/(dashboard)/page.tsx` | 顶部加入 HomeTabBar |
| 修改 | `app/(dashboard)/moment/page.tsx` | 顶部加入 HomeTabBar |
| 修改 | `app/(dashboard)/leaderboard/page.tsx` | 顶部加入 HomeTabBar |
| 修改 | `app/(dashboard)/category/page.tsx` | 顶部加入 HomeTabBar |
| 修改 | `app/(dashboard)/mcp-market/page.tsx` | 顶部加入 MarketTabBar |
| 修改 | `app/(dashboard)/skill-market/page.tsx` | 顶部加入 MarketTabBar |
| 修改 | `components/layout/sidebar.tsx` | 精简 browseNavigation + 移除 Market section |
| 删除 | `app/(dashboard)/author/page.tsx` | 移除 Authors 页面 |
| 删除 | `app/(dashboard)/collections/page.tsx` | 移除 Collections 列表页面 |
| 修改 | `lib/navigation/route-registry.ts` | 路由注册表同步更新 |

# Desktop 技能市场深度优化设计

## 概述

全面重构 desktop 的技能市场页面，对齐 apps/web 的双源架构（Official ClaWHub + Community Cloud Skills），引入无限滚动、排序选项、改进卡片设计，同时保留桌面端独有的安装进度条和 Cmd+K 搜索等特色功能。

## 目标

1. 双源架构：Official（ClaWHub Registry）和 Community（Viben Cloud Skills）Tab 切换
2. 无限滚动替代分页按钮
3. 组件拆分：从 472 行单文件重构为 <100 行容器 + 多个聚焦组件
4. 卡片设计对齐 Web（owner avatar、download/star stats、hover 动效）
5. 排序下拉（updated/downloads/stars/trending for Official; latest/popular/downloads for Community）
6. 保留桌面端安装流程（进度条、toast 通知、错误码处理）

## 架构设计

### 组件结构

```
pages/skills-market.tsx              (~80行) 容器，组合子组件
components/skills/
├── index.ts                         barrel 导出
├── skill-source-tabs.tsx            [NEW] Official/Community tab 切换
├── official-skill-grid.tsx          [NEW] ClaWHub 技能列表 + infinite scroll
├── official-skill-card.tsx          [NEW] ClaWHub 技能卡片
├── community-skill-grid.tsx         [NEW] Cloud Skills 列表 + infinite scroll
├── community-skill-card.tsx         [RENAME from skill-card.tsx] 重新设计卡片
├── skill-detail.tsx                 [REWRITE] 适配联合类型 SkillDisplayItem
├── search-bar.tsx                   [KEEP] 保留 Cmd+K
└── category-filter.tsx              [REMOVE] 移除侧边栏分类（改用 inline 排序）
```

### Hooks 结构

```
hooks/
├── use-clawhub-registry.ts          [MODIFY] 添加 sort 参数支持
├── use-cloud-skills.ts              [MODIFY] 添加 infinite scroll 变体
└── use-skill-install.ts             [NEW] 抽离安装逻辑，支持两种数据源
```

### Types 结构

```
types/
└── clawhub-registry.ts              [MODIFY] 添加 ClawhubSkillSortOption 类型
```

## 详细设计

### 1. SkillSourceTabs 组件

参考 Web 的 `skill-source-tabs.tsx`，但适配 desktop 路由（不使用 URL params，使用 React state）。

```tsx
// 两个 Tab: Official (ClaWHub) / Community (Cloud Skills)
type SkillSource = "official" | "community";

interface SkillSourceTabsProps {
  source: SkillSource;
  onSourceChange: (source: SkillSource) => void;
}
```

- 使用 `Tabs` / `TabsList` / `TabsTrigger` UI 组件
- Official tab 显示 Globe 图标，Community 显示 Users 图标
- 切换时重置搜索和滚动位置

### 2. OfficialSkillGrid 组件

对应 Web 的 `official-skill-grid.tsx`，使用 `use-clawhub-registry.ts` hook。

**核心功能：**
- IntersectionObserver 实现 infinite scroll
- Sort 下拉：updated / downloads / stars / trending
- 搜索由父组件传入 `searchQuery` prop
- AnimatedGrid 交错入场动画（简化版，用 CSS animation 替代 framer-motion variants）
- Loading skeleton / Empty state / Error state
- Refresh 按钮

**卡片数据映射：**
```
ClawhubSkillDisplay → OfficialSkillCard
- name, version, description
- ownerHandle, ownerAvatar
- downloads, stars
- slug (monospace 显示)
- isOfficial badge
```

### 3. OfficialSkillCard 组件

对齐 Web 的 `official-skill-card.tsx` 设计 + 添加安装功能。

**布局：**
```
┌──────────────────────────────────────┐
│ [Icon] Name          [Official badge]│
│        v1.2.3                        │
│                                      │
│ Description text here, max 2 lines   │
│                                      │
│ slug/package-name (monospace)        │
│                                      │
│ ↓ 1.2K  ★ 45                        │
│ [avatar] OwnerName                   │
│                                      │
│ [ClaWHub ↗]              [Install ↓]│
└──────────────────────────────────────┘
```

**交互：**
- 点击卡片打开 SkillDetail dialog
- Install 按钮调用 `useSkillInstall` hook
- 安装中显示进度条
- Hover 时 `border-primary/30 shadow-lg -translate-y-1`

### 4. CommunitySkillGrid 组件

使用 `use-cloud-skills.ts`，改造为 infinite scroll。

**核心功能：**
- 同样使用 IntersectionObserver
- Sort 下拉：latest / popular / downloads
- 搜索由父组件传入
- 保留 skillType badge、triggerPatterns 预览
- Loading / Empty / Error 状态

### 5. CommunitySkillCard 组件

在现有 `skill-card.tsx` 基础上优化：
- 保留 skillType badge、trigger patterns 预览
- 添加 author avatar（使用首字母 fallback）
- 对齐 hover 效果
- 安装按钮 + 进度条保持不变

### 6. useSkillInstall Hook

从 `skills-market.tsx` 中抽离安装逻辑：

```tsx
// 统一的可安装技能类型（联合类型判别）
type InstallableSkill =
  | { source: "community"; data: CloudSkillPackage }
  | { source: "official"; data: ClawhubSkillDisplay };

interface UseSkillInstallReturn {
  installingIds: Set<string>;
  installedIds: Set<string>;
  installProgress: Map<string, { stage: string; progress: number; message?: string }>;
  install: (skill: InstallableSkill) => Promise<void>;
  isInstalling: (id: string) => boolean;
  isInstalled: (id: string) => boolean;
  getProgress: (id: string) => number;
}
```

**两条安装路径：**

1. **Community Skills**（via Viben Cloud API）：
   - 调用 `api.skill.download(pkg.id)` → 获取 blob → 保存 temp zip → gateway `/api/skill/install`
   - 这是现有 `downloadAndInstallSkill` 的逻辑，保持不变

2. **Official ClaWHub Skills**（直接从 ClaWHub 下载）：
   - 新增 `downloadAndInstallClawhubSkill` 函数
   - 调用 `https://clawhub.ai/api/v1/skills/{slug}/file` → 获取技能文件内容
   - 保存为 temp zip → gateway `/api/skill/install`
   - 与现有安装器共享 gateway 安装步骤，仅下载源不同

```tsx
// lib/skill-installer.ts 新增
export async function downloadAndInstallClawhubSkill(options: {
  slug: string;
  name: string;
  version: string;
  onProgress?: ProgressCallback;
  force?: boolean;
}): Promise<InstallSkillResult> {
  // 1. fetch from https://clawhub.ai/api/v1/skills/{slug}/file
  // 2. save to temp zip
  // 3. call gateway /api/skill/install (same as existing)
  // 4. cleanup
}
```

- Toast 通知、错误码处理逻辑保持不变
- hook 内部根据 `skill.source` 判别调用哪条路径

### 7. use-clawhub-registry.ts 改造（添加 Sort 支持）

当前 hook 的 `fetchSkills` 只传 `family=skill` 和 `limit`。需要：

```tsx
// types/clawhub-registry.ts 新增
export type ClawhubSkillSortOption = "updated" | "downloads" | "stars" | "trending";

// use-clawhub-registry.ts 修改
export interface UseClawhubRegistrySkillsOptions {
  limit?: number;
  enabled?: boolean;
  sort?: ClawhubSkillSortOption;  // 新增
}

// fetchSkills 内部：
url.searchParams.set("sort", sort ?? "updated");
```

同时在 `useClawhubRegistry` combined hook 中暴露 `setSort` / `currentSort`：

```tsx
const [currentSort, setSort] = useState<ClawhubSkillSortOption>("updated");
// sort 变化时 refresh
```

### 8. use-cloud-skills.ts 改造（Infinite Scroll）

新增 `useCloudSkillPackagesInfinite` 导出（保留旧 `useCloudSkillPackages` 不删除，供 agent dialog 使用）：

```tsx
export function useCloudSkillPackagesInfinite(options: {
  limit?: number;
  sort?: "latest" | "popular" | "downloads";
}) {
  // 内部维护 page 计数，loadMore 时 page++，追加数据到 packages 数组
  // refresh 时重置 page=1 并清空数组
  // hasMore = packages.length < pagination.total
  return {
    packages: CloudSkillPackage[];
    loading: boolean;
    error: string | null;
    hasMore: boolean;
    loadMore: () => Promise<void>;
    refresh: () => Promise<void>;
  };
}
```

### 9. SkillDetail 统一联合类型

当前 `SkillDetail` 接受 `CloudSkillPackage | null`，需要改为支持两种数据源。使用 discriminated union：

```tsx
// 统一展示类型（用于 SkillDetail dialog）
type SkillDetailItem =
  | { source: "community"; data: CloudSkillPackage }
  | { source: "official"; data: ClawhubSkillDisplay };

interface SkillDetailProps {
  skill: SkillDetailItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isInstalled?: boolean;
  isInstalling?: boolean;
  installProgress?: number;
  onInstall?: (skill: SkillDetailItem) => void;
}
```

Dialog 内部根据 `skill.source` 渲染不同字段：
- **community**: 显示 skillType badge、triggerPatterns、tags、author.username、ratingAvg、favoritesCount
- **official**: 显示 isOfficial badge、channel、ownerHandle/ownerAvatar、downloads、stars、executesCode 警告

共享部分：name、version、description、slug（with copy）、install button。

### 10. skills-market.tsx 容器重写

```tsx
export function SkillsMarketPage() {
  const [source, setSource] = useState<SkillSource>("official");
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Header: title + refresh */}
      <PageHeader />

      {/* Source Tabs */}
      <SkillSourceTabs source={source} onSourceChange={setSource} />

      {/* Search */}
      <SearchBar value={searchQuery} onChange={setSearchQuery} />

      {/* Content */}
      {source === "official" ? (
        <OfficialSkillGrid searchQuery={searchQuery} />
      ) : (
        <CommunitySkillGrid searchQuery={searchQuery} />
      )}

      {/* Skill Detail Dialog */}
      <SkillDetail ... />
    </div>
  );
}
```

## 移除的功能

1. **侧边栏 CategoryFilter** —— categories API 尚未实现（返回硬编码数据），移除侧边栏改用 inline sort dropdown，空间更好利用
2. **Grid/List 视图切换** —— Web 没有此功能，统一用 grid 视图简化代码
3. **分页按钮** —— 全部替换为 infinite scroll
4. **Framer Motion variants** —— 使用更轻量的 CSS animation（`@keyframes fadeInUp`）或保留简单的 motion.div

## 文件变更列表

| 文件 | 操作 | 说明 |
|------|------|------|
| `pages/skills-market.tsx` | REWRITE | 轻量容器 ~80行 |
| `components/skills/index.ts` | UPDATE | 更新导出 |
| `components/skills/skill-source-tabs.tsx` | CREATE | Tab 切换组件 |
| `components/skills/official-skill-grid.tsx` | CREATE | ClaWHub 列表 |
| `components/skills/official-skill-card.tsx` | CREATE | ClaWHub 卡片 |
| `components/skills/community-skill-grid.tsx` | CREATE | Cloud Skills 列表 |
| `components/skills/community-skill-card.tsx` | CREATE | Cloud Skills 卡片（基于原 skill-card.tsx 重设计）|
| `components/skills/skill-detail.tsx` | REWRITE | 适配 SkillDetailItem 联合类型 |
| `components/skills/search-bar.tsx` | KEEP | 不变 |
| `components/skills/category-filter.tsx` | DELETE | 移除 |
| `hooks/use-skill-install.ts` | CREATE | 安装逻辑 hook，支持两条安装路径 |
| `hooks/use-cloud-skills.ts` | MODIFY | 添加 `useCloudSkillPackagesInfinite` |
| `hooks/use-clawhub-registry.ts` | MODIFY | 添加 sort 参数，暴露 setSort/currentSort |
| `types/clawhub-registry.ts` | MODIFY | 添加 `ClawhubSkillSortOption` 类型 |
| `lib/skill-installer.ts` | MODIFY | 添加 `downloadAndInstallClawhubSkill` 函数 |
| `components/agent/skill-market-grid.tsx` | VERIFY | 确认 hook return shape 兼容（不应 break）|

## 不变的部分

- `lib/skill-installer.ts` —— 底层安装函数保持不变
- `hooks/use-clawhub-registry.ts` —— 已支持 infinite scroll，直接复用
- `types/clawhub-registry.ts` —— 类型定义不变
- `pages/settings/settings-skills.tsx` —— lazy load 包装器不变

## 实现顺序

**Phase 1: 基础设施（types + hooks）**
1. `types/clawhub-registry.ts` — 添加 `ClawhubSkillSortOption`
2. `hooks/use-clawhub-registry.ts` — 添加 sort 支持，暴露 setSort/currentSort
3. `hooks/use-cloud-skills.ts` — 添加 `useCloudSkillPackagesInfinite`
4. `lib/skill-installer.ts` — 添加 `downloadAndInstallClawhubSkill`
5. `hooks/use-skill-install.ts` — 创建（依赖 step 4）

**Phase 2: UI 组件**
6. `components/skills/skill-source-tabs.tsx` — 创建
7. `components/skills/skill-detail.tsx` — 重写为联合类型（其他组件依赖此 dialog）
8. `components/skills/official-skill-card.tsx` — 创建
9. `components/skills/official-skill-grid.tsx` — 创建（依赖 step 2, 5, 8）
10. `components/skills/community-skill-card.tsx` — 创建
11. `components/skills/community-skill-grid.tsx` — 创建（依赖 step 3, 5, 10）

**Phase 3: 组装 + 清理**
12. `pages/skills-market.tsx` — 重写为轻量容器
13. `components/skills/index.ts` — 更新 barrel 导出
14. 删除 `category-filter.tsx`
15. 验证 `agent/skill-market-grid.tsx` 无 breaking changes
16. 添加新 i18n keys（约 10 个）

## 需要新增的 i18n Keys

```
skillsMarket.officialTab          — "Official" / "官方"
skillsMarket.communityTab         — "Community" / "社区"
skillsMarket.sortBy               — "Sort by" / "排序"
skillsMarket.sort.updated         — "Recently Updated" / "最近更新"
skillsMarket.sort.downloads       — "Most Downloads" / "最多下载"
skillsMarket.sort.stars           — "Most Stars" / "最多收藏"
skillsMarket.sort.trending        — "Trending" / "热门趋势"
skillsMarket.sort.latest          — "Latest" / "最新"
skillsMarket.sort.popular         — "Popular" / "最受欢迎"
skillsMarket.executesCodeWarning  — "This skill executes code" / "此技能会执行代码"
skillsMarket.officialBadge        — "Official" / "官方认证"
```

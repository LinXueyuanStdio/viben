# Dashboard 首页加载性能优化

## 背景

Dashboard 首页 (`apps/web/app/(dashboard)/page.tsx`) 是用户登录后的默认着陆页。当前每次请求执行多次数据库查询，无缓存层，导致加载时间较长。

## 当前问题

### 数据流（优化前）

```
Page Load (SSR, force-dynamic)
├── listRanking() ─────────────────→ HeroCarousel + Featured + Sidebar
│   rankingSnapshots → rankingItems (3 表 JOIN)
├── db.select(publishedPages).limit(6) → RecommendedSection
├── <Suspense> HomeFeedSection ────→ 动态流
│   ├── listMoments() × 1
│   └── listCommunityComments() × N
└── <Suspense> HomeSidebarSection ─→ 侧边栏
    ├── db.select(users).limit(3)
    └── listRanking() ← 与上面同参数重复调用
```

### 具体问题

1. **查询分散**: page.tsx 和 HomeSidebarSection 各自发起 DB 查询，即使 React `cache()` 能去重 `listRanking`，架构上仍然割裂
2. **无缓存**: 每次请求完整执行所有 DB 查询，Ranking 数据不需要实时
3. **跑马灯图片**: 封面图通过 CSS `background-image` 加载，无预加载，切换时可能闪烁

## 设计方案

### 架构（优化后）

```
Page Load (SSR)
└── getHomePageData() ← 单一聚合入口
    ├── unstable_cache(revalidate: 300, tags: ['homepage'])
    ├── 内部 Promise.all:
    │   ├── listRanking({ rankingKey: "published_page", timeWindow: "7d", limit: 10 })
    │   ├── db.select(publishedPages)...limit(6)  (isNotNull(coverUrl))
    │   └── db.select(users)...orderBy(followersCount)...limit(3)
    └── 返回 { heroSlides, featuredPages, recommendedPages, topAuthors, rankingPages }

组件树:
├── HeroCarousel ← props.heroSlides
├── Featured Cards ← props.featuredPages
├── RecommendedSection ← props.recommendedPages
├── <Suspense> HomeFeedSection  (保留，动态数据需实时)
└── HomeSidebarSection ← props.topAuthors + props.rankingPages (改为接收 props)
```

### 变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `lib/services/community.ts` | 新增 `getHomePageData()` | 聚合查询 + `unstable_cache` 包装 |
| `app/(dashboard)/page.tsx` | 修改 | 调用 `getHomePageData()`，移除内联查询和 Suspense 边界 |
| `components/home/home-sidebar-section.tsx` | 修改 | 改为接收 props（`authorCards`, `rankingPages`），不再独立查询 |
| `app/(dashboard)/layout.tsx` | 检查 | 确认是否需要缓存相关 Header 配置 |

### 缓存策略

- **方式**: Next.js `unstable_cache`
- **TTL**: `revalidate: 300`（5 分钟）
- **Tags**: `['homepage']`
- **失效**: 发布/更新页面时调用 `revalidateTag('homepage')`
- **范围**: 仅 ranking + 最新页面 + 推荐用户。HomeFeedSection 的动态流保持实时

### 跑马灯优化

- 数据层：已在 `getHomePageData()` 缓存中，无需额外请求
- 图片预加载：在 `<head>` 中为前 2 张封面添加 `<link rel="preload" as="image">`
- 组件层面：HeroCarousel 使用 `loading="eager"` 优先加载当前幻灯片图片

### 不改动的部分

- **HomeFeedSection**: 动态数据需要实时性，保持 Suspense + 独立查询
- **HeroCarousel 组件逻辑**: 自动播放、进度条等客户端行为保持不变
- **DashboardShell / AppShellWrapper**: 布局框架保持不变

### 风险与边界

- **缓存命中率**: 首页数据变化频率低（分钟级），300s revalidate 影响可忽略
- **缓存失效时机**: 需在 `apps/web/app/api/pages/publish/route.ts` 等发布入口添加 `revalidateTag('homepage')`
- **类型安全**: `getHomePageData()` 返回结构化类型，避免 `any`
- **回退**: 如果缓存查询抛错，回退到 fallback（空数组），与当前 `try/catch` 行为一致

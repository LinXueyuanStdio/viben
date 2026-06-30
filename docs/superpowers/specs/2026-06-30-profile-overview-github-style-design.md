# Profile Overview 页面 GitHub 风格优化

日期：2026-06-30  
状态：已确认

## 目标

优化 `apps/web/app/(dashboard)/[user_slug]/page.tsx` overview 页面视觉，参考 GitHub profile 风格：去热力图动画、大头像、紧间距、内容去卡片化。

## 改动范围

| 文件 | 改动 |
|------|------|
| `components/content/page-activity-heatmap.tsx` | 去动画、去卡片化 |
| `components/profile/activity-heatmap-loader.tsx` | 骨架屏去卡片化 |
| `app/(dashboard)/[user_slug]/page.tsx` | 大头像、紧间距、README去卡片化 |

## 一、活动热力图 — 去动画 + 去卡片化

### page-activity-heatmap.tsx

1. **去掉入场动画**：移除 `useInView` hook 及相关逻辑（`useRef`、`IntersectionObserver`）
2. **移除动画类**：去掉外层 div 的 `animate-fade-in-up` / `opacity-0` / `transition-all duration-300`
3. **去卡片化**：移除 `rounded-xl border bg-card` 外层包装，热力图 SVG 直接作为 section 内容
4. **内边距精简**：SVG 的 `leftPad` 从 32 减小、`topPad` 从 16 减小（具体数值实现时微调）

### activity-heatmap-loader.tsx

5. **骨架屏去卡片化**：loading 状态去掉 `rounded-xl border border-border bg-card`
6. **去掉 Suspense fallback 多余边距**：fallback 中的骨架 SVG 直接渲染

## 二、左侧边栏 — 大头像 + 紧间距

### [user_slug]/page.tsx

1. **头像撑满**：`size-24 lg:size-28 rounded-full ring-2 ring-border/40 ring-offset-2 ring-offset-background` → `w-full max-w-[200px] aspect-square rounded-full`（去 ring 装饰）
2. **头像居中**：左侧边栏内头像水平居中（`flex flex-col items-center` 保持）
3. **间距收紧**：左侧边栏 `space-y-5` → `space-y-3`
4. **名称区紧接头像**：`gap-3` → `gap-2`
5. **列间距缩小**：`lg:grid-cols-[280px_1fr] gap-6` → `gap-5`（grid 列宽不变，仅缩间距）

## 三、右侧内容区 — 精简间距

### [user_slug]/page.tsx

1. **内容区间距**：`space-y-5` → `space-y-4`
2. **Profile README 去卡片化**：`rounded-xl border border-border overflow-hidden` → 无边框，iframe 直接渲染
3. **置顶页面 / 动态 section**：保持卡片样式不变，section 间垂直间距随 `space-y-4` 收紧

## 不变部分

- ProfileTabs 组件结构不变
- PageCard / FeedCard / CollectionCard 卡片样式不变
- 右侧内容区的 section 内部 grid 布局不变
- 移动端布局保持不变

## 实现优先级

1. `page-activity-heatmap.tsx` — 去动画、去卡片化
2. `activity-heatmap-loader.tsx` — 骨架屏同步调整
3. `[user_slug]/page.tsx` — 大头像、紧间距、README去卡片化

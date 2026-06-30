# Profile Overview GitHub 风格优化 — 实现计划

> **For agentic workers:** 按 Task 顺序实施，每一步是一个独立的 checkbox。全部改动在 3 个文件中完成。

**Goal:** 优化 profile overview 页面视觉，参考 GitHub 风格：去热力图动画、大头像撑满边栏、紧间距、README/热力图去卡片化。

**Architecture:** 纯 CSS/Tailwind 类名改动，不涉及逻辑变更。3 个文件独立修改，无依赖关系。

**Tech Stack:** React + Tailwind v4 + Next.js App Router

## Global Constraints

- Tailwind v4：`data-[state=active]:` 等 data 属性变体在 CVA 中不可靠，需通过 `className` 条件传入
- 禁止 `hsl()` 包裹 oklch CSS 变量
- 使用绝对路径编辑文件

---

### Task 1: 活动热力图去动画 + 去卡片化

**Files:**
- Modify: `D:\Document\Github\LinXueyuanStdio\viben\apps\web\components\content\page-activity-heatmap.tsx`

**Interfaces:**
- Produces: `PageActivityHeatmap` 组件保持相同 props（`data: PageActivityDay[]`），输出无动画无卡片的纯 SVG 热力图

- [ ] **Step 1: 移除动画相关代码**

删除 `useRef` 和 `useInView` 导入，删除 `useInView` 调用和 `isInView` 变量，删除外层 div 的动画类。

文件 `D:\Document\Github\LinXueyuanStdio\viben\apps\web\components\content\page-activity-heatmap.tsx`：

```tsx
'use client';

import { useMemo } from 'react';

export interface PageActivityDay {
  date: string;  // YYYY-MM-DD
  count: number;
}

interface PageActivityHeatmapProps {
  data: PageActivityDay[];
}

// GitHub-style green heatmap
const COLORS = ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'];

function getColor(count: number, maxCount: number): string {
  if (count === 0) return COLORS[0];
  if (maxCount <= 0) return COLORS[0];
  const ratio = count / maxCount;
  if (ratio <= 0.25) return COLORS[1];
  if (ratio <= 0.5) return COLORS[2];
  if (ratio <= 0.75) return COLORS[3];
  return COLORS[4];
}

const WEEKDAYS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function PageActivityHeatmap({ data }: PageActivityHeatmapProps) {
  const { weeks, monthLabels, maxCount } = useMemo(() => {
    const dateMap = new Map(data?.map((d) => [d.date, d.count]) ?? []);
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 364);

    // Align to Sunday
    const startDayOfWeek = startDate.getDay();
    const weeks: { date: string; count: number }[][] = [];
    let currentWeek: { date: string; count: number }[] = [];
    let max = 0;

    for (let i = 0; i < 365 + startDayOfWeek; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i - startDayOfWeek);
      const dateStr = date.toISOString().split('T')[0];
      const count = i >= startDayOfWeek ? (dateMap.get(dateStr) || 0) : -1;

      if (i >= startDayOfWeek) {
        max = Math.max(max, count);
      }

      if (date.getDay() === 0 && currentWeek.length > 0) {
        weeks.push(currentWeek);
        currentWeek = [];
      }

      currentWeek.push({ date: dateStr, count });
    }
    if (currentWeek.length > 0) weeks.push(currentWeek);

    // Month labels
    const labels: { weekIndex: number; label: string }[] = [];
    let lastMonth = -1;
    weeks.forEach((week, weekIndex) => {
      const firstDay = week.find((d) => d.count >= 0);
      if (firstDay) {
        const month = new Date(firstDay.date).getMonth();
        if (month !== lastMonth) {
          labels.push({ weekIndex, label: MONTHS[month] });
          lastMonth = month;
        }
      }
    });

    return { weeks, monthLabels: labels, maxCount: max };
  }, [data]);

  const cellSize = 11;
  const cellGap = 3;
  const leftPad = 28;
  const topPad = 14;

  return (
    <div className="overflow-x-auto">
      <svg
        width={leftPad + weeks.length * (cellSize + cellGap)}
        height={topPad + 7 * (cellSize + cellGap) + 24}
      >
        {/* Month labels */}
        {monthLabels.map(({ weekIndex, label }) => (
          <text
            key={`month-${weekIndex}`}
            x={leftPad + weekIndex * (cellSize + cellGap)}
            y={10}
            fill="#8b949e"
            fontSize={10}
          >
            {label}
          </text>
        ))}

        {/* Weekday labels */}
        {WEEKDAYS.map((day, i) =>
          day ? (
            <text
              key={`wd-${i}`}
              x={4}
              y={topPad + i * (cellSize + cellGap) + cellSize - 1}
              fill="#8b949e"
              fontSize={10}
              textAnchor="start"
            >
              {day}
            </text>
          ) : null
        )}

        {/* Cells */}
        {weeks.map((week, wi) =>
          week.map((day, di) => {
            if (day.count < 0) return null;
            return (
              <rect
                key={`${wi}-${di}`}
                x={leftPad + wi * (cellSize + cellGap)}
                y={topPad + di * (cellSize + cellGap)}
                width={cellSize}
                height={cellSize}
                rx={2}
                fill={getColor(day.count, maxCount)}
              >
                <title>{`${day.date}: ${day.count} pages`}</title>
              </rect>
            );
          })
        )}

        {/* Legend */}
        <g transform={`translate(${leftPad + weeks.length * (cellSize + cellGap) - 200}, ${topPad + 7 * (cellSize + cellGap) + 4})`}>
          <text x={0} y={10} fill="#8b949e" fontSize={10}>Less</text>
          {COLORS.map((color, i) => (
            <rect key={i} x={32 + i * 14} y={0} width={11} height={11} rx={2} fill={color} />
          ))}
          <text x={107} y={10} fill="#8b949e" fontSize={10}>More</text>
        </g>
      </svg>
    </div>
  );
}
```

关键变更：
- 移除 `useRef`, `useInView` 导入，不再 import from `@/app/components/animated-cards/use-in-view`
- 移除 `ref`, `isInView`，移除最外层 `<div ref={ref} className=...>` 卡片包装
- `leftPad` 32→28, `topPad` 16→14
- 移除未使用的 `totalPages` 变量
- `'use client'` 保留（`useMemo` 需要），去掉了 `useRef`

- [ ] **Step 2: 验证热力图组件编译**

```bash
cd D:/Document/Github/LinXueyuanStdio/viben/apps/web && pnpm typecheck
```

预期：无类型错误。

---

### Task 2: 骨架屏去卡片化

**Files:**
- Modify: `D:\Document\Github\LinXueyuanStdio\viben\apps\web\components\profile\activity-heatmap-loader.tsx`

**Interfaces:**
- Produces: `ActivityHeatmapLoader` 保持相同 props，loading/fallback 骨架无卡片包装

- [ ] **Step 1: 移除骨架屏的卡片包装**

文件 `D:\Document\Github\LinXueyuanStdio\viben\apps\web\components\profile\activity-heatmap-loader.tsx`：

```tsx
"use client"

import { useEffect, useState, Suspense } from "react"
import { PageActivityHeatmap } from "@/components/content/page-activity-heatmap"
import type { PageActivityDay } from "@/components/content/page-activity-heatmap"

interface ActivityHeatmapLoaderProps {
  userSlug: string
}

function HeatmapInner({ userSlug }: ActivityHeatmapLoaderProps) {
  const [data, setData] = useState<PageActivityDay[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/users/${userSlug}/activity`)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) {
          setData(json.data ?? [])
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [userSlug])

  if (loading) {
    return (
      <div className="grid grid-cols-53 gap-[2px]">
        {Array.from({ length: 371 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-sm bg-muted" />
        ))}
      </div>
    )
  }

  return (
    <section>
      <PageActivityHeatmap data={data} />
    </section>
  )
}

export function ActivityHeatmapLoader({ userSlug }: ActivityHeatmapLoaderProps) {
  return (
    <Suspense fallback={
      <div className="grid grid-cols-53 gap-[2px]">
        {Array.from({ length: 371 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-sm bg-muted" />
        ))}
      </div>
    }>
      <HeatmapInner userSlug={userSlug} />
    </Suspense>
  )
}
```

关键变更：
- Loading 状态：`rounded-xl border border-border bg-card` → 去掉，`p-2` 去掉（grid 直接渲染）
- Suspense fallback：同理去卡片化，去掉 `h-3 w-24 rounded bg-muted mb-3` 占位条
- HeatmapInner 返回的 section：去掉 `rounded-xl border border-border bg-card`

- [ ] **Step 2: 验证编译**

```bash
cd D:/Document/Github/LinXueyuanStdio/viben/apps/web && pnpm typecheck
```

---

### Task 3: Overview 页面 — 大头像 + 紧间距 + README 去卡片化

**Files:**
- Modify: `D:\Document\Github\LinXueyuanStdio\viben\apps\web\app\(dashboard)\[user_slug]\page.tsx`

**Interfaces:**
- No interface changes — 纯 JSX className 修改

- [ ] **Step 1: 修改头像、间距、README**

文件 `D:\Document\Github\LinXueyuanStdio\viben\apps\web\app\(dashboard)\[user_slug]\page.tsx`，定位到 return 语句中的 JSX（约 254-377 行），做以下修改：

**A. 左侧边栏间距**（第 260 行）：
```diff
-            <div className="space-y-5">
+            <div className="space-y-3">
```

**B. 头像 + 名称区**（第 262-277 行）：
```diff
-              <div className="flex flex-col items-center lg:items-start gap-3">
-                <Avatar className="size-24 lg:size-28 rounded-full ring-2 ring-border/40 ring-offset-2 ring-offset-background">
+              <div className="flex flex-col items-center lg:items-start gap-2">
+                <Avatar className="w-full max-w-[200px] aspect-square rounded-full">
```

**C. 列间距**（第 258 行）：
```diff
-          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
+          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
```

**D. 右侧内容区间距**（第 330 行）：
```diff
-            <div className="space-y-5 min-w-0">
+            <div className="space-y-4 min-w-0">
```

**E. Profile README 去卡片化**（第 332-342 行）：
```diff
-              {readmePage && (
-                <section className="rounded-xl border border-border overflow-hidden">
-                  <iframe
-                    title="Profile README"
-                    srcDoc={readmePage.html}
-                    sandbox="allow-scripts allow-same-origin"
-                    className="w-full border-0"
-                    style={{ height: Math.min(500, (readmePage.html.length / 50) + 100) + 'px' }}
-                  />
-                </section>
-              )}
+              {readmePage && (
+                <section>
+                  <iframe
+                    title="Profile README"
+                    srcDoc={readmePage.html}
+                    sandbox="allow-scripts allow-same-origin"
+                    className="w-full border-0"
+                    style={{ height: Math.min(500, (readmePage.html.length / 50) + 100) + 'px' }}
+                  />
+                </section>
+              )}
```

- [ ] **Step 2: 验证编译**

```bash
cd D:/Document/Github/LinXueyuanStdio/viben/apps/web && pnpm typecheck
```

预期：无类型错误。

---

## 验证清单

全部 3 个 Task 完成后：

1. `cd apps/web && pnpm typecheck` — 无类型错误
2. 浏览器访问 `/[user_slug]` — 热力图无入场动画、直接可见
3. 头像撑满左侧边栏宽度（200px max），无 ring 装饰
4. 热力图和 README 无卡片边框
5. 整体间距比之前紧凑

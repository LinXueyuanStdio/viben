# Tab 下划线风格改造设计

## 概述

将 Header 阅读页居中 tab 和右侧滑栏（drawer）tab 从药丸（pill）风格改为下划线（underline）风格，提升视觉清晰度和现代感。

## 动机

- 当前 pill 变体的 active/inactive 对比度低（`bg-surface-secondary` vs 透明），用户难以一眼区分当前选中项
- 下划线风格是 GitHub、Linear、Vercel 等现代产品的通用模式，用户认知成本低
- 与首页导航栏的 shadcn 默认高对比风格形成差异化（阅读页更沉浸、更轻量）

## 变更范围

### 1. VibenTabs 组件新增 `underline` variant

**文件**: `apps/web/components/ui/viben-tabs.tsx`

**VibenTabsList `underline`:**
- 无背景、无边框、无阴影
- `inline-flex items-center gap-1`

**VibenTabsTrigger `underline`:**
- 默认：`text-muted-foreground hover:text-foreground`
- 活跃（`data-state="active"`）：`text-foreground font-bold` + 底部 2px primary 色下划线
- `rounded-none`
- `transition-colors duration-200`
- 无 `min-w`、无 `min-h` 约束，让内容自然撑开

### 2. CSS 活跃态规则

**文件**: `apps/web/app/globals.css`

新增：
```css
.viben-trigger-underline[data-state="active"] {
  color: var(--color-foreground);
  font-weight: 700;
  box-shadow: inset 0 -2px 0 var(--color-primary);
}
```

### 3. Header 居中 Tab

**文件**: `apps/web/components/layout/topbar.tsx`

- `VibenTabsList` variant 从 `"pill"` → `"underline"`，追加 `className="gap-5"`
- `VibenTabsTrigger` variant 从 `"pill"` → `"underline"`
- 移除 `min-w-[92px]`（不再需要）

### 4. 右侧滑栏 Tab

**文件**: `apps/web/components/layout/read-drawer.tsx`

- `VibenTabsList` variant 从 `"drawer"` → `"underline"`，追加 `className="gap-3"`
- `VibenTabsTrigger` variant 从 `"drawer"` → `"underline"`
- `DrawerHeader` 高度从 `h-[58px]` 缩减到 `h-[44px]`
- 移除 `min-w-[78px]` 和 `min-h-[34px]`（不再需要）

## 不变更

- `pill` 和 `drawer` variant 保留在代码中，不删除（未来可能有其他场景使用）
- `Tabs` 组件（shadcn 默认风格）不受影响
- 首页导航栏、市场页等继续使用原有风格

## 视觉对比

### 改造前（pill）
```
┌─────────────────────────────┐
│  [📄页面] [📐侧页] [⚙设置]  │  ← 药丸容器有 border/bg/shadow
└─────────────────────────────┘
   active: 仅 bg-surface-secondary，与 inactive 差异小
```

### 改造后（underline）
```
    📄页面    📐侧页    ⚙设置
    ━━━━━━                    ← 2px primary 色下划线，清晰指示当前项
   active: text-foreground bold + 下划线
   inactive: text-muted-foreground
```

## 验收标准

- [ ] Header 阅读页 tab 显示为下划线风格，active tab 有 primary 色下划线
- [ ] 右侧滑栏 tab 显示为下划线风格，active tab 有 primary 色下划线
- [ ] 切换 tab 时过渡动画流畅
- [ ] 暗色模式下视觉效果正常
- [ ] 移动端显示正常
- [ ] `apps/web` typecheck 通过

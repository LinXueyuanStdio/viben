# Design System Reference

页面端 CSS Token 完整参考。所有颜色使用 oklch 格式，与 Desktop App 保持一致。

## 色彩变量速查

### 品牌色

| 变量 | 值 | 用途 |
|------|------|------|
| `--brand-amber-400` | `oklch(0.78 0.16 75)` | dark 主题主色 |
| `--brand-amber-500` | `oklch(0.70 0.18 75)` | ring/强调 |
| `--brand-amber-600` | `oklch(0.62 0.18 75)` | light 主题主色 |
| `--brand-amber-700` | `oklch(0.52 0.16 75)` | hover 状态 |
| `--brand-teal-500` | `oklch(0.65 0.14 195)` | 图表对比色 |

### 语义色（自动随主题切换）

| 变量 | Light | Dark |
|------|-------|------|
| `--background` | neutral-50 | neutral-900 |
| `--foreground` | neutral-900 | neutral-50 |
| `--surface` | white | neutral-800 |
| `--primary` | amber-600 | amber-400 |
| `--card` | white | neutral-800 |
| `--border` | neutral-200 | neutral-700 |
| `--muted` | neutral-100 | neutral-800 |

### 状态色

```css
--success: oklch(0.65 0.18 145);  /* 绿色 */
--warning: oklch(0.70 0.18 75);   /* 琥珀色 */
--error: oklch(0.58 0.22 25);     /* 红色 */
--info: oklch(0.62 0.18 240);     /* 蓝色 */
```

## 字体系统

| 变量 | 字体栈 | 用途 |
|------|--------|------|
| `--font-serif` | Crimson Pro, Georgia | 标题、大字 |
| `--font-sans` | Inter, system-ui | 正文、UI |
| `--font-mono` | JetBrains Mono, Fira Code | 代码、数值 |

### 字号建议

```css
/* 标题 */
h1 { font: 700 2.5rem/1.2 var(--font-serif); }
h2 { font: 600 2rem/1.25 var(--font-serif); }
h3 { font: 600 1.5rem/1.3 var(--font-sans); }

/* 正文 */
body { font: 400 1rem/1.6 var(--font-sans); }
.small { font-size: 0.875rem; }

/* 数值 */
.metric { font: 500 2rem/1 var(--font-mono); }
```

## 间距

基于 4px 网格：

```css
--space-1: 0.25rem;   /* 4px - 图标间距 */
--space-2: 0.5rem;    /* 8px - 元素内间距 */
--space-3: 0.75rem;   /* 12px - 紧凑间距 */
--space-4: 1rem;      /* 16px - 标准间距 */
--space-6: 1.5rem;    /* 24px - 段落间距 */
--space-8: 2rem;      /* 32px - 区块间距 */
--space-12: 3rem;     /* 48px - 大区块 */
--space-16: 4rem;     /* 64px - 页面级间距 */
```

## 圆角

```css
--radius-sm: 0.5rem;   /* 按钮、输入框 */
--radius-md: 0.75rem;  /* 卡片 */
--radius-lg: 1rem;     /* 模态框 */
--radius-xl: 1.5rem;   /* 大卡片 */
--radius-2xl: 2rem;    /* 特殊容器 */
```

## 阴影

```css
--shadow-sm: ...;      /* 微浮起 - 按钮 */
--shadow-md: ...;      /* 卡片默认 */
--shadow-lg: ...;      /* 下拉菜单、弹出层 */
--shadow-primary: ...; /* 主色按钮发光 */
```

## 反模式

| ❌ 不要 | ✅ 应该 |
|---------|---------|
| `color: #333` | `color: var(--foreground)` |
| `background: white` | `background: var(--surface)` |
| `hsl(var(--background))` | `var(--background)` |
| `border: 1px solid gray` | `border: 1px solid var(--border)` |
| `font-family: Arial` | `font-family: var(--font-sans)` |
| 冷灰色 `hue: 0/220` | 暖灰色 `hue: 75`（已内置） |

## 图表配色

6 色循环调色板，amber 和 teal 为主对比：

```css
--chart-1  /* amber - 主数据 */
--chart-2  /* teal - 对比数据 */
--chart-3  /* green - 第三系列 */
--chart-4  /* blue - 第四系列 */
--chart-5  /* warm-yellow - 第五系列 */
--chart-6  /* purple - 第六系列 */
```

ECharts/Chart.js 中使用：
```javascript
const colors = [
  getComputedStyle(document.documentElement).getPropertyValue('--chart-1').trim(),
  getComputedStyle(document.documentElement).getPropertyValue('--chart-2').trim(),
  // ...
];
```

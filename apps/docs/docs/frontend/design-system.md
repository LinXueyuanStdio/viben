---
sidebar_position: 2
title: 设计系统
description: Viben 设计系统 - 温暖的未来主义美学
---

# Viben 设计系统

> **愿景**: 一款温暖、面向未来的学术工具，具有独特的动效设计和自定义可视化。

---

## 目录

1. [设计理念](#设计理念)
2. [颜色系统](#颜色系统)
3. [字体排版](#字体排版)
4. [间距与布局](#间距与布局)
5. [动效与动画](#动效与动画)
6. [组件模式](#组件模式)
7. [视觉细节](#视觉细节)
8. [实现指南](#实现指南)

---

## 设计理念

### 核心原则

1. **温暖的未来主义**: 将未来感设计与平易近人的温暖相结合
2. **学术权威感**: 衬线字体 + 专业数据可视化
3. **令人难忘的动效**: 用户会记住的标志性动画
4. **平衡的复杂度**: 对高级用户足够强大，对所有人都可访问

### 目标用户

- **主要用户**: 广泛用户群（研究人员、开发者、AI 构建者）
- **体验目标**:
  - 第一印象：现代、创新、前瞻性
  - 持久记忆：温暖的橙色调 + 优雅的动效

### 设计标识（我们的独特之处）

- [ ] **温暖的橙色/琥珀色调色板**（vs. 典型 AI 工具的蓝色/紫色）
- [ ] **优雅的衬线字体**（vs. 通用的 Inter/Roboto）
- [ ] **自定义 SVG 可视化**（vs. 通用图表库）
- [ ] **精心编排的动效设计**（编排式，非分散式）

---

## 颜色系统

### 品牌颜色 (OKLCH)

```css
/* 主色 - 温暖的琥珀/橙色 */
--brand-amber-50: oklch(0.97 0.02 75);   /* 最浅色调 */
--brand-amber-100: oklch(0.95 0.04 75);
--brand-amber-200: oklch(0.90 0.08 75);
--brand-amber-300: oklch(0.85 0.12 75);
--brand-amber-400: oklch(0.78 0.16 75);  /* 浅强调色 */
--brand-amber-500: oklch(0.70 0.18 75);  /* 主品牌色 */
--brand-amber-600: oklch(0.62 0.18 75);  /* 主色悬停 */
--brand-amber-700: oklch(0.52 0.16 75);  /* 激活状态 */
--brand-amber-800: oklch(0.42 0.14 75);
--brand-amber-900: oklch(0.32 0.12 75);  /* 最深色调 */

/* 辅助色 - 温暖的桃色（用于强调） */
--brand-peach-400: oklch(0.82 0.14 55);
--brand-peach-500: oklch(0.75 0.16 55);
--brand-peach-600: oklch(0.68 0.16 55);

/* 中性色 - 温暖的灰色（非纯灰） */
--neutral-50: oklch(0.985 0.002 75);     /* 略带暖色调 */
--neutral-100: oklch(0.97 0.002 75);
--neutral-200: oklch(0.92 0.004 75);
--neutral-300: oklch(0.85 0.004 75);
--neutral-400: oklch(0.70 0.004 75);
--neutral-500: oklch(0.56 0.004 75);
--neutral-600: oklch(0.44 0.004 75);
--neutral-700: oklch(0.32 0.004 75);
--neutral-800: oklch(0.22 0.004 75);
--neutral-900: oklch(0.15 0.004 75);

/* 强调色 - 青色（用于数据可视化对比） */
--brand-teal-400: oklch(0.72 0.12 195);
--brand-teal-500: oklch(0.65 0.14 195);
--brand-teal-600: oklch(0.58 0.14 195);

/* 语义颜色 */
--color-success: oklch(0.65 0.18 145);   /* 绿色 */
--color-warning: oklch(0.70 0.18 75);    /* 琥珀（复用品牌色） */
--color-error: oklch(0.58 0.22 25);      /* 红色 */
--color-info: oklch(0.62 0.18 240);      /* 蓝色 */
```

### 主题映射

**浅色主题**:
```css
:root {
  /* 背景 */
  --background: var(--neutral-50);
  --surface: oklch(1 0 0);              /* 纯白卡片 */
  --surface-elevated: var(--neutral-100);

  /* 文字 */
  --foreground: var(--neutral-900);
  --foreground-secondary: var(--neutral-600);
  --foreground-tertiary: var(--neutral-500);

  /* 品牌 */
  --primary: var(--brand-amber-600);
  --primary-hover: var(--brand-amber-700);
  --primary-foreground: oklch(1 0 0);

  /* 边框 */
  --border: var(--neutral-200);
  --border-strong: var(--neutral-300);
}
```

**深色主题**:
```css
.dark {
  /* 背景 */
  --background: var(--neutral-900);
  --surface: var(--neutral-800);
  --surface-elevated: var(--neutral-700);

  /* 文字 */
  --foreground: var(--neutral-50);
  --foreground-secondary: var(--neutral-400);
  --foreground-tertiary: var(--neutral-500);

  /* 品牌（深色背景下稍亮） */
  --primary: var(--brand-amber-500);
  --primary-hover: var(--brand-amber-400);
  --primary-foreground: var(--neutral-900);

  /* 边框 */
  --border: var(--neutral-700);
  --border-strong: var(--neutral-600);
}
```

### 颜色使用规则

1. **应该**: 使用温暖的琥珀色作为主要操作颜色（按钮、链接、高亮）
2. **应该**: 使用青色进行数据可视化以与琥珀色形成对比
3. **应该**: 使用 neutral-50（非纯白）作为浅色背景以保持温暖
4. **不应该**: 使用冷灰色 - 所有灰色都应略带暖色调
5. **不应该**: 过度使用颜色 - 让琥珀色成为主角，大量使用中性色

---

## 字体排版

### 字体栈

**显示与标题**（衬线体现权威感）:
```css
font-family: 'Crimson Pro', 'Source Serif Pro', 'Georgia', 'Times New Roman', serif;
```

**正文文本**（无衬线体现可读性）:
```css
font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
```

**代码与等宽**:
```css
font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
```

### 字体比例

```css
/* 展示 - 用于英雄区块 */
--font-display-size: 3.5rem;      /* 56px */
--font-display-line-height: 1.1;
--font-display-weight: 600;
--font-display-letter-spacing: -0.02em;

/* 标题 1 - 页面标题 */
--font-h1-size: 2.25rem;          /* 36px */
--font-h1-line-height: 1.2;
--font-h1-weight: 600;
--font-h1-letter-spacing: -0.015em;

/* 标题 2 - 章节标题 */
--font-h2-size: 1.875rem;         /* 30px */
--font-h2-line-height: 1.25;
--font-h2-weight: 600;
--font-h2-letter-spacing: -0.01em;

/* 标题 3 - 子章节标题 */
--font-h3-size: 1.5rem;           /* 24px */
--font-h3-line-height: 1.3;
--font-h3-weight: 600;
--font-h3-letter-spacing: -0.005em;

/* 标题 4 */
--font-h4-size: 1.25rem;          /* 20px */
--font-h4-line-height: 1.4;
--font-h4-weight: 600;

/* 大号正文 */
--font-body-lg-size: 1.125rem;    /* 18px */
--font-body-lg-line-height: 1.6;
--font-body-lg-weight: 400;

/* 正文 */
--font-body-size: 1rem;           /* 16px */
--font-body-line-height: 1.6;
--font-body-weight: 400;

/* 小号正文 */
--font-body-sm-size: 0.875rem;    /* 14px */
--font-body-sm-line-height: 1.5;
--font-body-sm-weight: 400;

/* 说明文字 */
--font-caption-size: 0.75rem;     /* 12px */
--font-caption-line-height: 1.4;
--font-caption-weight: 500;
--font-caption-letter-spacing: 0.01em;
```

### 使用指南

1. **标题 (h1-h4)**: 始终使用衬线字体 (Crimson Pro)
2. **正文文本**: 使用无衬线字体 (Inter) 以提高屏幕可读性
3. **数据标签**: 使用等宽字体 (JetBrains Mono) 以保证精确性
4. **强调**: 使用字重变化 (500/600) 而非斜体以保持清晰

**实现示例**:
```css
h1, h2, h3, h4, h5, h6 {
  font-family: 'Crimson Pro', serif;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--foreground);
}

body, p, span, div {
  font-family: 'Inter', sans-serif;
  font-weight: 400;
  color: var(--foreground);
}
```

---

## 间距与布局

### 间距比例

```css
--space-0: 0;
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
--space-20: 5rem;     /* 80px */
--space-24: 6rem;     /* 96px */
```

### 布局系统: Bento 网格

**理念**: 灵活的卡片式布局，卡片尺寸各异，创造视觉节奏。

**网格结构**:
```css
.bento-grid {
  display: grid;
  gap: var(--space-6);
  grid-template-columns: repeat(12, 1fr);
}

/* 卡片尺寸变体 */
.bento-card-small {
  grid-column: span 4;  /* 1/3 宽度 */
}

.bento-card-medium {
  grid-column: span 6;  /* 1/2 宽度 */
}

.bento-card-large {
  grid-column: span 8;  /* 2/3 宽度 */
}

.bento-card-full {
  grid-column: span 12; /* 全宽 */
}

/* 高度变体 */
.bento-card-short {
  min-height: 200px;
}

.bento-card-tall {
  min-height: 400px;
}

.bento-card-hero {
  min-height: 600px;
}
```

**响应式断点**:
```css
/* 移动端: 单列 */
@media (max-width: 640px) {
  .bento-card-small,
  .bento-card-medium,
  .bento-card-large,
  .bento-card-full {
    grid-column: span 12;
  }
}

/* 平板: 2-3 列 */
@media (min-width: 641px) and (max-width: 1024px) {
  .bento-card-small {
    grid-column: span 6;
  }
  .bento-card-large {
    grid-column: span 12;
  }
}
```

### 布局模式

**仪表盘布局**:
```
┌─────────────────────────────────────┐
│  统计1  │  统计2  │  统计3  │  统计4 │  ← 小卡片 (每个4列)
├──────────────────┬──────────────────┤
│                  │                  │
│   大型图表       │   中型卡片       │  ← 大 (8列) + 中 (4列)
│                  │                  │
├──────────────────┴──────────────────┤
│                                     │
│   全宽活动热力图                     │  ← 全宽卡片
│                                     │
└─────────────────────────────────────┘
```

---

## 动效与动画

### 动画理念

**"编排式卓越"**: 每个动画都有目的、优雅，是整体构图的一部分。避免分散的微交互。

### 动画时间

```css
/* 缓动曲线 */
--ease-in-out-cubic: cubic-bezier(0.65, 0, 0.35, 1);
--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
--ease-out-back: cubic-bezier(0.34, 1.56, 0.64, 1);
--ease-spring: cubic-bezier(0.68, -0.55, 0.265, 1.55);

/* 持续时间比例 */
--duration-instant: 100ms;
--duration-fast: 200ms;
--duration-normal: 300ms;
--duration-slow: 500ms;
--duration-slower: 700ms;
--duration-slowest: 1000ms;
```

### 关键动画模式

#### 1. 页面加载序列（英雄动画）

**交错显示配合淡入 + 滑动**:

```css
/* 用于交错子元素的容器 */
.page-enter {
  animation: fade-in var(--duration-slow) var(--ease-out-expo);
}

@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 子元素的交错延迟 */
.stagger-item:nth-child(1) { animation-delay: 0ms; }
.stagger-item:nth-child(2) { animation-delay: 100ms; }
.stagger-item:nth-child(3) { animation-delay: 200ms; }
.stagger-item:nth-child(4) { animation-delay: 300ms; }
```

#### 2. 卡片入场

**缩放 + 淡入 + 抬升**:

```css
.card-enter {
  animation: card-pop-in var(--duration-normal) var(--ease-out-back);
}

@keyframes card-pop-in {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
```

#### 3. 按钮交互

**悬停 + 激活状态配合弹簧效果**:

```css
.button {
  transition: all var(--duration-fast) var(--ease-out-expo);
}

.button:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 16px -4px oklch(0.70 0.18 75 / 0.3);
}

.button:active {
  transform: translateY(0);
  box-shadow: 0 2px 4px -2px oklch(0.70 0.18 75 / 0.2);
}
```

#### 4. 数据可视化动画

**图表挂载时动画**:

```css
/* 折线图路径动画 */
.chart-path {
  stroke-dasharray: 1000;
  stroke-dashoffset: 1000;
  animation: draw-line var(--duration-slower) var(--ease-out-expo) forwards;
}

@keyframes draw-line {
  to {
    stroke-dashoffset: 0;
  }
}

/* 柱状图高度动画 */
.bar-fill {
  transform-origin: bottom;
  animation: grow-bar var(--duration-normal) var(--ease-out-back);
  animation-fill-mode: both;
}

@keyframes grow-bar {
  from {
    transform: scaleY(0);
  }
  to {
    transform: scaleY(1);
  }
}

/* 柱状图交错 */
.bar-fill:nth-child(1) { animation-delay: 100ms; }
.bar-fill:nth-child(2) { animation-delay: 200ms; }
.bar-fill:nth-child(3) { animation-delay: 300ms; }
```

#### 5. 热力图单元格动画

**级联效果**:

```css
.heatmap-cell {
  animation: cell-pop var(--duration-fast) var(--ease-out-back);
  animation-fill-mode: both;
}

@keyframes cell-pop {
  from {
    transform: scale(0);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

/* 基于位置的级联延迟 */
.heatmap-cell {
  animation-delay: calc((var(--row) + var(--col)) * 20ms);
}
```

#### 6. 导航过渡

**页面滑动过渡**:

```tsx
/* Framer Motion 页面过渡变体 */
const pageVariants = {
  initial: {
    opacity: 0,
    x: 20,
  },
  enter: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.3,
      ease: [0.16, 1, 0.3, 1], // ease-out-expo
      staggerChildren: 0.1,
    },
  },
  exit: {
    opacity: 0,
    x: -20,
    transition: {
      duration: 0.2,
    },
  },
};
```

### 动画检查清单

- [ ] 页面加载: 交错淡入 + 滑动
- [ ] 卡片入场: 缩放 + 淡入配合弹簧缓动
- [ ] 按钮悬停: 抬升配合阴影
- [ ] 图表数据: 动画绘制/生长
- [ ] 热力图: 级联单元格出现
- [ ] 页面过渡: 平滑水平滑动
- [ ] 骨架加载: 闪烁效果
- [ ] 成功状态: 庆祝式弹跳

---

## 组件模式

### Button 按钮

**变体**:
- `primary`: 实心琥珀背景
- `secondary`: 琥珀边框描边
- `ghost`: 透明，悬停时琥珀色文字
- `destructive`: 红色用于危险操作

**尺寸**: `sm`, `md`, `lg`

```tsx
// 带悬停抬升效果的增强按钮
const Button = ({ variant = 'primary', size = 'md', children }) => (
  <button
    className={cn(
      'inline-flex items-center justify-center rounded-lg font-medium',
      'transition-all duration-200 ease-out-expo',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
      'disabled:opacity-50 disabled:pointer-events-none',
      variant === 'primary' && [
        'bg-primary text-primary-foreground',
        'hover:bg-primary-hover hover:-translate-y-0.5',
        'hover:shadow-[0_8px_16px_-4px_oklch(0.70_0.18_75_/_0.3)]',
        'active:translate-y-0 active:shadow-sm',
      ],
      variant === 'secondary' && [
        'border-2 border-primary text-primary bg-transparent',
        'hover:bg-primary/10 hover:-translate-y-0.5',
        'active:translate-y-0',
      ],
      size === 'sm' && 'h-9 px-4 text-sm',
      size === 'md' && 'h-11 px-6 text-base',
      size === 'lg' && 'h-13 px-8 text-lg',
    )}
  >
    {children}
  </button>
);
```

### Card 卡片

**带悬停效果的 Bento 风格卡片**:

```tsx
const Card = ({ children, className, size = 'medium' }) => (
  <div
    className={cn(
      'rounded-2xl bg-surface border border-border',
      'p-6 transition-all duration-300',
      'hover:border-primary/30 hover:shadow-lg',
      'hover:-translate-y-1',
      size === 'small' && 'bento-card-small',
      size === 'medium' && 'bento-card-medium',
      size === 'large' && 'bento-card-large',
      className
    )}
  >
    {children}
  </div>
);
```

### StatCard 统计卡片

**带图标和动画数值的仪表盘统计卡片**:

```tsx
const StatCard = ({ title, value, change, icon: Icon }) => (
  <Card size="small" className="bento-card-short">
    <div className="flex items-start justify-between mb-4">
      <span className="text-sm text-foreground-secondary">{title}</span>
      <Icon className="h-5 w-5 text-primary" />
    </div>
    <div className="text-3xl font-serif font-semibold mb-2 animate-count-up">
      {value}
    </div>
    {change && (
      <div className="flex items-center gap-1 text-sm">
        <TrendingUp className="h-4 w-4 text-success" />
        <span className="text-success">+{change}%</span>
      </div>
    )}
  </Card>
);
```

### ChartContainer 图表容器

**自定义 SVG 图表的包装器**:

```tsx
const ChartContainer = ({ title, subtitle, children }) => (
  <Card size="large" className="bento-card-tall">
    <div className="mb-6">
      <h3 className="text-xl font-serif font-semibold mb-1">{title}</h3>
      {subtitle && (
        <p className="text-sm text-foreground-secondary">{subtitle}</p>
      )}
    </div>
    <div className="chart-container">
      {children}
    </div>
  </Card>
);
```

---

## 视觉细节

### 微妙的背景纹理

**噪点叠加增加深度**:

```css
body {
  background: var(--background);
  position: relative;
}

body::before {
  content: '';
  position: fixed;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E");
  pointer-events: none;
  z-index: 1;
}
```

**卡片上的微妙渐变网格**:

```css
.card-gradient {
  position: relative;
  overflow: hidden;
}

.card-gradient::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(
    circle at 10% 20%,
    oklch(0.70 0.18 75 / 0.05),
    transparent 60%
  );
  pointer-events: none;
}
```

### 圆角系统

```css
--radius-sm: 0.5rem;    /* 8px - 小元素 */
--radius-md: 0.75rem;   /* 12px - 按钮、输入框 */
--radius-lg: 1rem;      /* 16px - 卡片 */
--radius-xl: 1.5rem;    /* 24px - 大卡片 */
--radius-2xl: 2rem;     /* 32px - 英雄区块 */
```

### 阴影系统

```css
/* 带温暖琥珀色调的高度阴影 */
--shadow-xs: 0 1px 2px 0 oklch(0 0 0 / 0.05);
--shadow-sm: 0 1px 3px 0 oklch(0 0 0 / 0.1),
             0 1px 2px -1px oklch(0 0 0 / 0.1);
--shadow-md: 0 4px 6px -1px oklch(0 0 0 / 0.1),
             0 2px 4px -2px oklch(0 0 0 / 0.1);
--shadow-lg: 0 10px 15px -3px oklch(0 0 0 / 0.1),
             0 4px 6px -4px oklch(0 0 0 / 0.1);
--shadow-xl: 0 20px 25px -5px oklch(0 0 0 / 0.1),
             0 8px 10px -6px oklch(0 0 0 / 0.1);

/* 主按钮的彩色阴影 */
--shadow-primary: 0 8px 16px -4px oklch(0.70 0.18 75 / 0.3);
```

---

## 实现指南

### CSS 架构

**使用 CSS 自定义属性进行主题化**:

```css
/* ✅ 正确 */
.button {
  background: var(--primary);
  color: var(--primary-foreground);
}

/* ❌ 错误 - 硬编码颜色 */
.button {
  background: #f59e0b;
  color: white;
}
```

**使用 Tailwind 工具类处理间距/布局，自定义 CSS 处理复杂动画**:

```tsx
// ✅ 正确 - 使用 Tailwind 处理间距
<div className="p-6 space-y-4">

// ✅ 正确 - 使用自定义类处理复杂动画
<div className="card-enter-animation">

// ❌ 错误 - 内联样式处理动画
<div style={{ animation: 'fadeIn 300ms' }}>
```

### 动画实现

**简单过渡优先使用 CSS 动画**:

```css
/* ✅ 正确 - 纯 CSS */
.button {
  transition: transform 200ms ease-out-expo;
}

.button:hover {
  transform: translateY(-2px);
}
```

**复杂序列使用 Framer Motion**:

```tsx
// ✅ 正确 - Framer Motion 用于编排序列
<motion.div
  variants={pageVariants}
  initial="initial"
  animate="enter"
  exit="exit"
>
  {children}
</motion.div>
```

### 自定义图表指南

1. **始终使用 SVG** 制作图表（不使用 canvas 或第三方库）
2. **动画路径** 挂载时使用 stroke-dasharray
3. **使用品牌颜色**: 主数据用琥珀色，次要数据用青色
4. **可访问性**: 包含 aria-labels 和 title 元素

示例:
```tsx
<svg viewBox="0 0 100 100" className="w-full h-full">
  <title>随时间变化的活动</title>
  <path
    d={pathData}
    fill="none"
    stroke="var(--brand-amber-600)"
    strokeWidth="2"
    className="chart-path"
    vectorEffect="non-scaling-stroke"
  />
</svg>
```

---

## 反模式（不应该做的事）

### 不要：通用 AI 工具美学

- **白底紫色渐变**（AI 工具中过度使用）
- **到处都是 Inter/Roboto**（缺乏个性）
- **平淡的灰色配色方案**（无聊且易忘）
- **通用图表库**（带默认样式的 recharts）

### 不要：分散的微交互

```tsx
// 错误 - 到处都是随机动画
<div className="hover:scale-105">
  <div className="hover:rotate-2">
    <div className="hover:brightness-110">
```

而应该：编排有意图的动画序列

### 不要：不一致的间距

```tsx
// 错误 - 任意间距值
<div className="mt-3 mb-5 p-7">

// 正确 - 使用间距比例
<div className="mt-4 mb-6 p-8">
```

---

## 新组件检查清单

添加新组件前，验证：

- [ ] 使用温暖的琥珀色 (`var(--primary)`) 作为主要操作
- [ ] 字体：标题用衬线，正文用无衬线
- [ ] 间距：使用间距比例 (4, 6, 8, 12 等)
- [ ] 动效：有意图的悬停/入场动画
- [ ] 深色模式：在浅色和深色主题下都能工作
- [ ] 可访问性：正确的 aria 标签、焦点状态
- [ ] 响应式：在移动端/平板/桌面端都能工作
- [ ] 适配 Bento 网格：可以调整为小/中/大卡片

---

## 从当前设计迁移

### 阶段 1: 基础

- [ ] 更新 CSS 变量为新颜色系统
- [ ] 将系统字体栈替换为 Crimson Pro + Inter
- [ ] 添加动画时间变量

### 阶段 2: 组件

- [ ] 更新 Button 组件添加悬停抬升
- [ ] 将卡片重构为 Bento 网格系统
- [ ] 添加动画类

### 阶段 3: 润色

- [ ] 添加微妙的背景纹理
- [ ] 实现页面过渡动画
- [ ] 增强图表动画
- [ ] 添加交错加载序列

---

## 资源

### 字体

- **Crimson Pro**: [Google Fonts](https://fonts.google.com/specimen/Crimson+Pro)
- **Inter**: [Google Fonts](https://fonts.google.com/specimen/Inter)
- **JetBrains Mono**: [JetBrains](https://www.jetbrains.com/lp/mono/)

### 颜色工具

- **OKLCH 颜色选择器**: [oklch.com](https://oklch.com/)
- **颜色空间转换器**: [colorjs.io](https://colorjs.io/)

### 动画库

- **Framer Motion**: [framer.com/motion](https://www.framer.com/motion/)
- **缓动函数**: [easings.net](https://easings.net/)

---

**最后更新**: 2026-02-28
**版本**: 1.0.0
**状态**: ✅ 完成 - 可供实现

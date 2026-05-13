# Interactions Reference

动效、状态 UI、无障碍指南。

## 动效变量

```css
--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);   /* 快速弹出 */
--ease-out-back: cubic-bezier(0.34, 1.56, 0.64, 1); /* 回弹 */
--duration-fast: 200ms;    /* hover、focus */
--duration-normal: 300ms;  /* 展开、折叠 */
--duration-slow: 500ms;    /* 页面级过渡 */
```

## 常用过渡

### Hover 反馈

```css
.interactive {
  transition: transform var(--duration-fast) var(--ease-out-expo),
              box-shadow var(--duration-fast) var(--ease-out-expo);
}

.interactive:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.interactive:active {
  transform: translateY(0);
  transition-duration: 100ms;
}
```

### 进入动画

```css
@keyframes fade-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-in {
  animation: fade-in var(--duration-normal) var(--ease-out-expo) both;
}

/* 交错动画 */
.stagger > :nth-child(1) { animation-delay: 0ms; }
.stagger > :nth-child(2) { animation-delay: 50ms; }
.stagger > :nth-child(3) { animation-delay: 100ms; }
.stagger > :nth-child(4) { animation-delay: 150ms; }
```

### 数值跳动

```javascript
function animateNumber(el, target, duration = 1000) {
  const start = performance.now();
  const initial = parseFloat(el.textContent) || 0;

  function update(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out-cubic
    el.textContent = Math.round(initial + (target - initial) * eased).toLocaleString();
    if (progress < 1) requestAnimationFrame(update);
  }

  requestAnimationFrame(update);
}
```

## 状态 UI

### 加载态

```css
.skeleton {
  background: linear-gradient(
    90deg,
    var(--muted) 25%,
    var(--surface-elevated) 50%,
    var(--muted) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: var(--radius-sm);
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

### 空状态

```css
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-16);
  text-align: center;
}

.empty-state__icon {
  width: 64px;
  height: 64px;
  color: var(--foreground-tertiary);
  margin-bottom: var(--space-4);
}

.empty-state__title {
  font: 600 1.25rem/1.3 var(--font-sans);
  color: var(--foreground);
}

.empty-state__desc {
  font: 400 0.875rem/1.5 var(--font-sans);
  color: var(--foreground-secondary);
  margin-top: var(--space-2);
  max-width: 360px;
}
```

### Toast 通知

```css
.toast {
  position: fixed;
  bottom: var(--space-6);
  right: var(--space-6);
  padding: var(--space-3) var(--space-4);
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  font: 400 0.875rem/1.4 var(--font-sans);
  animation: slide-up var(--duration-normal) var(--ease-out-back);
}

@keyframes slide-up {
  from { transform: translateY(100%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
```

## 主题过渡

SDK 自动管理 `.vp-transitioning` class，但你也可以手动监听：

```javascript
VibenPage.onThemeChange(function(theme) {
  // 重新初始化图表颜色等
  updateChartColors(theme);
});
```

## 无障碍 (a11y)

### 必须做

1. **焦点可见**：所有交互元素在 `:focus-visible` 时显示 ring
2. **对比度**：正文 ≥ 4.5:1，大字 ≥ 3:1
3. **键盘导航**：Tab 可达所有交互元素
4. **ARIA 标签**：图标按钮必须有 `aria-label`
5. **减少动画**：尊重 `prefers-reduced-motion`

### Focus Ring

```css
:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}
```

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

# Layout Patterns Reference

常见页面布局模式的完整代码示例。

## 目录

1. [Dashboard（仪表盘）](#dashboard)
2. [Form（表单）](#form)
3. [Landing（产品介绍页）](#landing)
4. [Table（数据表格）](#table)

---

## Dashboard

### 结构：Bento Grid

```css
.dashboard {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--space-6);
  padding: var(--space-8);
}

.card {
  background: var(--card);
  color: var(--card-foreground);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: var(--space-6);
  box-shadow: var(--shadow-sm);
}

.card:hover {
  box-shadow: var(--shadow-md);
  transition: box-shadow var(--duration-fast) var(--ease-out-expo);
}

/* 大卡片横跨两列 */
.card--wide {
  grid-column: span 2;
}

/* KPI 数值 */
.card__metric {
  font: 500 2.5rem/1 var(--font-mono);
  color: var(--foreground);
}

.card__label {
  font: 400 0.875rem/1.4 var(--font-sans);
  color: var(--foreground-secondary);
  margin-top: var(--space-1);
}

.card__trend--up { color: var(--success); }
.card__trend--down { color: var(--error); }
```

### 响应式

```css
@media (max-width: 768px) {
  .dashboard {
    grid-template-columns: 1fr;
    padding: var(--space-4);
  }
  .card--wide {
    grid-column: span 1;
  }
}
```

### 页面头部

```css
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-6) var(--space-8);
  border-bottom: 1px solid var(--border);
}

.page-title {
  font: 700 1.75rem/1.2 var(--font-serif);
  color: var(--foreground);
}
```

---

## Form

### 基础表单布局

```css
.form {
  max-width: 640px;
  margin: 0 auto;
  padding: var(--space-8);
}

.form-group {
  margin-bottom: var(--space-6);
}

.form-label {
  display: block;
  font: 500 0.875rem/1.4 var(--font-sans);
  color: var(--foreground);
  margin-bottom: var(--space-2);
}

.form-input {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  font: 400 1rem/1.5 var(--font-sans);
  color: var(--foreground);
  background: var(--surface);
  border: 1px solid var(--input);
  border-radius: var(--radius-sm);
  outline: none;
  transition: border-color var(--duration-fast) ease,
              box-shadow var(--duration-fast) ease;
}

.form-input:focus {
  border-color: var(--ring);
  box-shadow: 0 0 0 3px color-mix(in oklch, var(--ring) 25%, transparent);
}

.form-input--error {
  border-color: var(--error);
}

.form-error {
  font-size: 0.8125rem;
  color: var(--error);
  margin-top: var(--space-1);
}
```

### 按钮

```css
.btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  font: 500 0.875rem/1 var(--font-sans);
  border-radius: var(--radius-sm);
  border: none;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out-expo);
}

.btn-primary {
  background: var(--primary);
  color: var(--primary-foreground);
}

.btn-primary:hover {
  background: var(--primary-hover);
  box-shadow: var(--shadow-primary);
}

.btn-secondary {
  background: var(--secondary);
  color: var(--secondary-foreground);
  border: 1px solid var(--border);
}

.btn-secondary:hover {
  background: var(--accent);
}
```

### 步骤表单

```css
.stepper {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-8);
}

.step {
  flex: 1;
  height: 4px;
  background: var(--muted);
  border-radius: 2px;
  transition: background var(--duration-normal) var(--ease-out-expo);
}

.step--active { background: var(--primary); }
.step--completed { background: var(--success); }
```

---

## Landing

### Hero 区域

```css
.hero {
  min-height: 80vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  padding: var(--space-16) var(--space-8);
}

.hero__title {
  font: 700 clamp(2.5rem, 6vw, 4.5rem)/1.1 var(--font-serif);
  color: var(--foreground);
  max-width: 800px;
}

.hero__subtitle {
  font: 400 clamp(1.125rem, 2vw, 1.375rem)/1.6 var(--font-sans);
  color: var(--foreground-secondary);
  max-width: 600px;
  margin-top: var(--space-6);
}

.hero__cta {
  margin-top: var(--space-8);
  display: flex;
  gap: var(--space-4);
}
```

### Feature Grid

```css
.features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-8);
  padding: var(--space-16) var(--space-8);
  max-width: 1200px;
  margin: 0 auto;
}

.feature-card {
  padding: var(--space-6);
}

.feature-card__icon {
  width: 48px;
  height: 48px;
  background: color-mix(in oklch, var(--primary) 15%, transparent);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primary);
  margin-bottom: var(--space-4);
}

.feature-card__title {
  font: 600 1.25rem/1.3 var(--font-sans);
  color: var(--foreground);
  margin-bottom: var(--space-2);
}

.feature-card__desc {
  font: 400 1rem/1.6 var(--font-sans);
  color: var(--foreground-secondary);
}
```

### 滚动渐现动画

```css
.fade-up {
  opacity: 0;
  transform: translateY(24px);
  transition: opacity var(--duration-slow) var(--ease-out-expo),
              transform var(--duration-slow) var(--ease-out-expo);
}

.fade-up.visible {
  opacity: 1;
  transform: translateY(0);
}

@media (prefers-reduced-motion: reduce) {
  .fade-up {
    opacity: 1;
    transform: none;
    transition: none;
  }
}
```

IntersectionObserver JS:
```javascript
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  },
  { threshold: 0.1 }
);
document.querySelectorAll('.fade-up').forEach(el => observer.observe(el));
```

---

## Table

### 数据表格

```css
.table-container {
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font: 400 0.875rem/1.5 var(--font-sans);
}

.data-table th {
  text-align: left;
  padding: var(--space-3) var(--space-4);
  font-weight: 500;
  color: var(--foreground-secondary);
  background: var(--muted);
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}

.data-table td {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--border);
  color: var(--foreground);
}

.data-table tr:last-child td {
  border-bottom: none;
}

.data-table tr:hover td {
  background: var(--muted);
}
```

### 排序指示器

```css
.sort-header {
  cursor: pointer;
  user-select: none;
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}

.sort-header::after {
  content: '↕';
  opacity: 0.3;
  font-size: 0.75rem;
}

.sort-header[data-sort="asc"]::after { content: '↑'; opacity: 1; }
.sort-header[data-sort="desc"]::after { content: '↓'; opacity: 1; }
```

### 筛选栏

```css
.table-toolbar {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-4);
  border-bottom: 1px solid var(--border);
}

.search-input {
  flex: 1;
  max-width: 320px;
  padding: var(--space-2) var(--space-3);
  background: var(--surface);
  border: 1px solid var(--input);
  border-radius: var(--radius-sm);
  font: 400 0.875rem/1.5 var(--font-sans);
  color: var(--foreground);
}
```

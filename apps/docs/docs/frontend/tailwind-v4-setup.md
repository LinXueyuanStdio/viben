---
sidebar_position: 7
title: Tailwind v4 工作空间包配置
description: 在 pnpm monorepo 中配置 Tailwind v4 扫描工作空间包
---

# Tailwind CSS v4 - 工作空间包配置

> 关键：如何在 pnpm monorepo 中正确配置 Tailwind v4 以扫描工作空间包的 CSS 类。

---

## 问题

在 pnpm monorepo 中使用 Tailwind CSS v4 的 Vite 插件 (`@tailwindcss/vite`) 时，外部工作空间包（如 `@viben/kanban`、`@viben/ui`）**不会被自动扫描** CSS 类。

这会导致这些包中使用的 CSS 类在最终构建中被清除，从而破坏布局和样式。

### 症状

- 布局静默失效（无构建错误）
- Grid 布局（`inline-grid`、`grid-flow-col`）不工作
- Flex 布局表现异常
- CSS 属性如 `auto-cols-[280px]` 无效果

---

## 根本原因

Tailwind v4 配合 Vite 插件会自动检测项目中的内容源，但是：

1. 默认只扫描 `src/` 中的文件
2. 通过 pnpm 符号链接的工作空间包（`node_modules/@viben/*`）**不包含在内**
3. 外部包中的 CSS 类被清除，因为 Tailwind 不知道它们的存在

---

## 解决方案

在 CSS 入口文件中添加 `@source` 指令以显式包含工作空间包。

### 示例：`apps/desktop/src/index.css`

```css
@import "tailwindcss";

/* 扫描工作空间包中的 Tailwind 类 */
@source "../node_modules/@viben/kanban/src/**/*.tsx";
@source "../node_modules/@viben/ui/src/**/*.tsx";

@theme {
  /* ... 主题配置 */
}
```

### 关键点

1. **使用 node_modules 路径** - 路径 `../node_modules/@viben/kanban` 会正确跟随符号链接
2. **包含源文件** - 指向带有 TSX 文件的 `src/` 目录，而非 `dist/` 输出
3. **使用 glob 模式** - `**/*.tsx` 捕获所有组件文件

---

## 验证

添加 `@source` 指令后：

1. **清除所有缓存：**
   ```bash
   rm -rf apps/desktop/dist .turbo node_modules/.vite
   ```

2. **重新构建：**
   ```bash
   pnpm build --filter @viben/desktop
   ```

3. **检查 CSS 输出：**
   ```bash
   # 拆分压缩的 CSS 并搜索类
   cat apps/desktop/dist/assets/index-*.css | tr '}' '\n' | grep "inline-grid"
   ```

   预期输出：
   ```
   .inline-grid{display:inline-grid
   .auto-cols-\[280px\]{grid-auto-columns:280px
   .grid-flow-col{grid-auto-flow:column
   ```

---

## 水平 Kanban 布局所需的 CSS 类

看板需要这些 CSS 类才能水平显示：

| 类 | 用途 | CSS 输出 |
|----|------|----------|
| `inline-grid` | 使容器成为内联网格 | `display: inline-grid` |
| `grid-flow-col` | 按列流动项目 | `grid-auto-flow: column` |
| `auto-cols-[280px]` | 设置列宽 | `grid-auto-columns: 280px` |
| `divide-x` | 添加垂直分隔线 | `border-left-width: 1px` |
| `border-x` | 添加左/右边框 | `border-left/right-width: 1px` |

如果编译后的 CSS 中缺少任何这些类，看板将垂直堆叠而非水平排列。

---

## 常见错误

### 错误：从 src/ 使用相对路径

```css
/* 此路径可能无法正确解析 */
@source "../../packages/kanban/src/**/*.tsx";
```

### 正确：通过 node_modules 的路径

```css
/* 通过 node_modules 跟随符号链接 */
@source "../node_modules/@viben/kanban/src/**/*.tsx";
```

### 错误：只扫描 dist/

```css
/* dist/ 包含编译后的 JS，不是带有类字符串的源代码 */
@source "../node_modules/@viben/kanban/dist/**/*.js";
```

### 正确：扫描源 TSX 文件

```css
/* 源文件包含类字符串字面量 */
@source "../node_modules/@viben/kanban/src/**/*.tsx";
```

---

## 相关文件

| 文件 | 用途 |
|------|------|
| `apps/desktop/src/index.css` | 带有 `@source` 指令的 CSS 入口点 |
| `apps/desktop/vite.config.ts` | 带有 `@tailwindcss/vite` 插件的 Vite 配置 |
| `packages/kanban/src/kanban.tsx` | 使用 grid 类的 Kanban 组件 |

---

## 调试技巧

1. **CSS 文件大小变化了？** 如果添加 `@source` 后 CSS 文件大小增加，说明它在工作
2. **重建后哈希值相同？** 缓存未清除 - 删除 `.turbo` 和 `dist/`
3. **类仍然缺失？** 检查 glob 模式是否覆盖了所有使用这些类的文件

---

**最后更新：** 2026-02-28
**状态：** ✅ 生产修复

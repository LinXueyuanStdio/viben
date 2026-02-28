# Frontend Development Guidelines

> Best practices for frontend development in Viben project.

---

## Overview

This directory contains guidelines for frontend development. These specs ensure consistent, high-quality code across the desktop application.

---

## Guidelines Index

### Core Guidelines

| Guide | Description | Status |
|-------|-------------|--------|
| [Design System](./design-system.md) | 完整设计系统：颜色、字体、动效、组件 | ✅ Complete |
| [Component Guidelines](./components.md) | React 组件模式与最佳实践 | ✅ Complete |
| [Chat Input Components](./chat-input-components.md) | ChatInput vs AgentChatInput 组件使用指南 | ✅ Complete |
| [Tailwind v4 Workspace Packages](./tailwind-v4-workspace-packages.md) | **Critical** - Tailwind v4 工作空间包扫描配置 | ✅ Complete |

### Feature Guidelines

| Guide | Description | Spec | Impl |
|-------|-------------|------|------|
| [Provider System](./PROVIDER_SYSTEM.md) | AI Provider 配置与管理系统 | ✅ | ✅ |
| [Marketplace Publish Flow](./marketplace-publish-flow.md) | "Publish My MCP" 和 "Publish My Skill" 向导流程 | ✅ | ❌ |
| [Chat Integration](./chat-integration.md) | 工作空间聊天页面集成 (**desktop only**) | ✅ | ✅ |
| [Vibe Kanban Layout](./vibe-kanban-layout-architecture.md) | Vibe Kanban 三栏布局架构设计 | ✅ | ✅ |

> **Legend:** Spec = 规格文档完成, Impl = 代码实现完成

### To Fill

| Guide | Description | Status |
|-------|-------------|--------|
| [Hook Guidelines](./hook-guidelines.md) | Custom hooks and state management | 📝 To fill |
| [Type Safety](./type-safety.md) | TypeScript patterns and type definitions | 📝 To fill |
| [Quality Guidelines](./quality-guidelines.md) | Code standards and forbidden patterns | 📝 To fill |

---

## Related Module Specs

### Desktop Integration

| Guide | Description | Status |
|-------|-------------|--------|
| [Desktop Creator Section](../modules/desktop-creator-section.md) | Desktop 创作者章节 (Publish, My Packages, Analytics) | 📝 Specification |

### Workspace & Kanban

| Guide | Description | Status |
|-------|-------------|--------|
| [Workspace Module](../modules/workspace/) | 工作空间模块索引 | - |
| [Workspace Management](../modules/workspace/workspace-management.md) | Desktop 多工作空间系统 | ✅ Done |
| [Kanban Integration](../modules/workspace/kanban-integration.md) | Kanban 整体架构 | 📝 Specification |
| [Kanban Features](../modules/workspace/kanban-features.md) | Kanban 核心功能 | 📝 Specification |

### Chat & Social

| Guide | Description | Status |
|-------|-------------|--------|
| [Chat Module](../modules/chat/) | Chat 模块索引 | - |
| [Social Chat Module](../modules/social-chat/) | 社交聊天模块索引 | - |

---

## Quick Start

### 1. Read Design System First

Before writing any frontend code, read the [Design System](./design-system.md) to understand:

- Brand colors (warm amber/orange palette)
- Typography (Crimson Pro serif + Inter sans-serif)
- Animation patterns (choreographed sequences)
- Bento grid layout system
- Component patterns and examples

### 2. Design Philosophy

Viben follows a **"Warm Futurism"** aesthetic:

- **Warm**: Orange/amber color palette (not typical blue/purple)
- **Future-forward**: Modern, innovative, with sophisticated animations
- **Academic Authority**: Serif typography + professional visualizations
- **Memorable**: Signature motion design and custom SVG charts

### 3. Tech Stack

- **Framework**: React 19 + TypeScript
- **Styling**: Tailwind CSS 4.1 + CSS custom properties
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Animation**: Framer Motion + CSS animations
- **Icons**: Lucide React + @lobehub/icons (AI model icons)
- **Build**: Vite + Tauri (desktop app)

---

## Core Principles

1. **Follow the Design System**
   - Use CSS variables for colors (never hardcode)
   - Use spacing scale (4, 6, 8, 12, etc.)
   - Use defined typography scale and font stacks

2. **Intentional Motion**
   - Every animation must be purposeful
   - Choreograph page loads with staggered reveals
   - Use defined easing curves and durations

3. **Component Consistency**
   - Reuse existing components before creating new ones
   - Follow CVA (class-variance-authority) pattern for variants
   - Ensure dark mode compatibility

4. **Custom Visualizations**
   - Use SVG for all charts (not third-party libraries with default styles)
   - Animate charts on mount
   - Use brand colors (amber primary, teal secondary)

---

## AI Model Icons

Use `@lobehub/icons` for AI model branding icons:

```tsx
import Claude from "@lobehub/icons/es/Claude";
import OpenAI from "@lobehub/icons/es/OpenAI";

<Claude.Color size={20} />  // Color variant
<OpenAI size={20} />        // Mono variant
```

See [CLAUDE.md](../../../CLAUDE.md) for the full icon list.

---

## Migration Plan

We are currently migrating from a generic design to the Viben Design System:

### Phase 1: Foundation (In Progress)
- [x] Define color system (warm amber/orange)
- [x] Define typography system (serif + sans-serif)
- [x] Define animation patterns
- [ ] Update CSS variables in `index.css`
- [ ] Add font imports

### Phase 2: Components
- [ ] Update Button component
- [ ] Refactor cards to bento grid
- [ ] Add animation classes
- [ ] Update sidebar styling

### Phase 3: Polish
- [ ] Add background textures
- [ ] Implement page transitions
- [ ] Enhance chart animations
- [ ] Add loading sequences

---

**Language**: Documentation in English, spec content can be in Chinese.

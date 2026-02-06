# Frontend Development Guidelines

> Best practices for frontend development in Viben project.

---

## Overview

This directory contains guidelines for frontend development. These specs ensure consistent, high-quality code across the desktop application.

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Design System](./design-system.md) | Complete design system: colors, typography, motion, components | ✅ Complete |
| [Component Guidelines](./components.md) | React component patterns and best practices | ✅ Complete |
| [Marketplace Publish Flow](./marketplace-publish-flow.md) | "Publish My MCP" and "Publish My Skill" wizard flows | ✅ Complete |
| [Chat Integration](./chat-integration.md) | Workspace chat page integration from workany (**desktop only**) | ✅ Complete |
| [Hook Guidelines](./hook-guidelines.md) | Custom hooks and state management | To fill |
| [Type Safety](./type-safety.md) | TypeScript patterns and type definitions | To fill |
| [Quality Guidelines](./quality-guidelines.md) | Code standards and forbidden patterns | To fill |

### Desktop-CLI Integration

| Guide | Description | Status |
|-------|-------------|--------|
| [Desktop-CLI Integration](../modules/desktop-cli-integration.md) | Desktop 与 CLI 共享 @viben/core 库，UI 页面规范 | 📝 Specification |

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
- **Icons**: Lucide React
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

## How to Fill These Guidelines

For each guideline file:

1. Document your project's **actual conventions** (not ideals)
2. Include **code examples** from the codebase
3. List **forbidden patterns** and why
4. Add **common mistakes** to avoid

The goal is to help AI assistants and new team members understand how YOUR project works.

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

**Language**: All documentation should be written in **English**.

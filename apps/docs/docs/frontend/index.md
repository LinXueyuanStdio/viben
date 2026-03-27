---
sidebar_position: 1
title: Frontend Development Guide
description: Viben Project Frontend Development Best Practices
---

# Frontend Development Guide

> Best practices guide for Viben project frontend development.

---

## Overview

This directory contains specification guides for frontend development. These specifications ensure consistency and high quality code in the desktop application.

---

## Guide Index

### Core Guides

| Guide | Description | Status |
|-------|-------------|--------|
| [Design System](./design-system.md) | Complete design system: colors, fonts, animations, components | ✅ Complete |
| [Component Guide](./components.md) | React component patterns and best practices | ✅ Complete |
| Hook Guide | Custom hooks and state management | 📋 Planned |
| Type Safety | TypeScript patterns and type definitions | 📋 Planned |
| Quality Guide | Code standards and forbidden patterns | 📋 Planned |
| [Tailwind v4 Workspace Package Configuration](./tailwind-v4-setup.md) | **Critical** - Tailwind v4 workspace package scanning configuration | ✅ Complete |

### Feature Guides

| Guide | Description | Spec | Impl |
|-------|-------------|------|------|
| [Marketplace Publish Flow](./marketplace-publish-flow.md) | "Publish My MCP" and "Publish My Skill" wizard flows | ✅ | ❌ |
| [Chat Integration](./chat-integration.md) | Workspace chat page integration (**Desktop only**) | ✅ | ✅ |
| [Chat Input Components](./chat-input-components.md) | ChatInput unified component usage guide | ✅ | ✅ |

> **Legend:** Spec = Specification document complete, Impl = Code implementation complete

---

## Related Module Specifications

### Kanban Board

| Guide | Description | Status |
|-------|-------------|--------|
| [Module Overview](./kanban/index.md) | Kanban module specification index | ✅ Complete |
| [Kanban Integration](./kanban/integration.md) | Kanban overall architecture design | ✅ Complete |
| [Kanban Features](./kanban/features.md) | Kanban core features | 📝 Planning |
| [Phase 3: Advanced Features](./kanban/phase3-advanced.md) | Advanced task management features | 📝 Planning |
| [Phase 4: Collaboration](./kanban/phase4-collaboration.md) | Multi-user collaboration features | 📝 Planning |
| [Phase 5: Automation](./kanban/phase5-automation.md) | Workflow automation | 📝 Planning |
| [Phase 6: Views](./kanban/phase6-views.md) | Multi-view support | 📝 Planning |
| [Phase 7: AI](./kanban/phase7-ai.md) | AI-assisted features | 📝 Planning |
| [Phase 8: Customization](./kanban/phase8-customization.md) | Custom configuration | 📝 Planning |

### Social Chat

| Guide | Description | Status |
|-------|-------------|--------|
| [Social Chat Overview](./social-chat/index.md) | Social chat module index | ✅ Complete |
| [Chat Specification](./social-chat/chat-spec.md) | Chat feature development specification | ✅ Complete |
| [Contacts Specification](./social-chat/contacts-spec.md) | Contacts feature development specification | ✅ Complete |
| [Chat PRD](./social-chat/chat-prd.md) | Chat feature product requirements | ✅ Complete |

### Web UI Modules

| Guide | Description | Status |
|-------|-------------|--------|
| [Module Overview](./modules/index.md) | Web module specification index | ✅ Complete |
| [UI Shell](./modules/ui-shell.md) | Application shell: layout, navigation, theming | ✅ Complete |
| [Auth UI](./modules/auth-ui.md) | Authentication UI: login, registration, OAuth | ✅ Complete |
| [Profile UI](./modules/profile-ui.md) | User profile: settings, API keys | ✅ Complete |
| [Admin UI](./modules/admin-ui.md) | Admin dashboard: review, user management | ✅ Complete |

---

## Quick Start

### 1. Read the Design System First

Before writing any frontend code, read the [Design System](./design-system.md) to understand:

- Brand colors (warm amber/orange palette)
- Fonts (Crimson Pro serif + Inter sans-serif)
- Animation patterns (orchestrated animation sequences)
- Bento grid layout system
- Component patterns and examples

### 2. Design Philosophy

Viben follows a **"Warm Futurism"** aesthetic:

- **Warm**: Orange/amber palette (rather than typical blue/purple)
- **Futuristic**: Modern, innovative, with refined animations
- **Academic Authority**: Serif fonts + professional data visualization
- **Memorable**: Iconic animation design with custom SVG charts

### 3. Tech Stack

- **Framework**: React 19 + TypeScript
- **Styling**: Tailwind CSS 4.1 + CSS Custom Properties
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Animation**: Framer Motion + CSS animations
- **Icons**: Lucide React + @lobehub/icons (AI model icons)
- **Build**: Vite + Tauri (desktop app)

---

## Core Principles

1. **Follow the Design System**
   - Use CSS variables for colors (never hardcode)
   - Use spacing scale (4, 6, 8, 12, etc.)
   - Use defined font scales and font stacks

2. **Purposeful Animation**
   - Every animation must have meaning
   - Use staggered reveals to orchestrate page loads
   - Use defined easing curves and durations

3. **Component Consistency**
   - Reuse existing components before creating new ones
   - Follow CVA (class-variance-authority) pattern for variants
   - Ensure dark mode compatibility

4. **Custom Visualizations**
   - All charts use SVG (no third-party libraries with default styles)
   - Charts animate on mount
   - Use brand colors (amber primary, cyan secondary)

---

## AI Model Icons

Use `@lobehub/icons` for AI model brand icons:

```tsx
import Claude from "@lobehub/icons/es/Claude";
import OpenAI from "@lobehub/icons/es/OpenAI";

<Claude.Color size={20} />  // Color variant
<OpenAI size={20} />        // Monochrome variant
```

**Icons with `.Color` variant**: Claude, Gemini, Mistral, Meta, DeepSeek, Qwen, Cohere, HuggingFace

**Icons without `.Color` (use default)**: OpenAI, Ollama, Groq, Anthropic

---

## Migration Plan

We are migrating from generic design to Viben design system:

### Phase 1: Foundation (In Progress)
- [x] Define color system (warm amber/orange)
- [x] Define font system (serif + sans-serif)
- [x] Define animation patterns
- [ ] Update CSS variables in `index.css`
- [ ] Add font imports

### Phase 2: Components
- [ ] Update Button component
- [ ] Refactor cards to Bento grid
- [ ] Add animation classes
- [ ] Update sidebar styles

### Phase 3: Polish
- [ ] Add background textures
- [ ] Implement page transitions
- [ ] Enhance chart animations
- [ ] Add loading sequences

---

**Language**: Document content uses English, code examples use English.

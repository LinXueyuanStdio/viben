---
sidebar_position: 1
title: Kanban Module Specification
description: Development specification for Viben Desktop workspace task board functionality
---

# Kanban Module Specification

> Development specification document for task board functionality in Viben Desktop workspace.

---

## Overview

The Kanban module provides project-level task management capabilities for Viben Desktop workspace, implementing core functionality through the `@viben/kanban` shared package.

---

## Document Index

| Document | Description | Phase |
|----------|-------------|-------|
| [Integration](./integration.md) | Board integration specification, symlink strategy | Phase 1 |
| [Features](./features.md) | Core features: priority, tags, filtering | Phase 2 |
| [Phase 3](./phase3-advanced.md) | Advanced features specification | Phase 3 |
| [Phase 4](./phase4-collaboration.md) | Collaboration features specification | Phase 4 |
| [Phase 5](./phase5-automation.md) | UI optimization specification | Phase 5 |
| [Phase 6](./phase6-views.md) | UI fixes and layout | Phase 6 |
| [Phase 7](./phase7-ai.md) | Critical layout fixes | Phase 7 |
| [Phase 8](./phase8-customization.md) | Match vibe-kanban layout | Phase 8 |
| [Layout Architecture](./layout-architecture.md) | Deep dive into layout system and resizable panels | Reference |

---

## Architecture Overview

```
packages/kanban/              # Shared package @viben/kanban
├── src/
│   ├── kanban.tsx           # Main board component
│   ├── kanban-column.tsx    # Column component
│   ├── task-card.tsx        # Task card
│   └── task-detail.tsx      # Task detail panel

apps/desktop/src/
├── pages/
│   └── workspace-kanban.tsx # Board page
└── stores/
    └── kanban-store.ts      # State management
```

---

## Core Features

- **Drag and Drop Sorting**: Drag support for task cards and columns
- **Priority System**: Four-level priority - Urgent/High/Medium/Low
- **Tag Management**: Custom color tags
- **Smart Filtering**: Filter by status, priority, tags
- **Task Details**: Sidebar detail panel

---

## Related Documents

- [Design System](../design-system.md) - Design system specification
- [Components](../components.md) - Component development guide
- [Chat Integration](../chat-integration.md) - Chat integration specification

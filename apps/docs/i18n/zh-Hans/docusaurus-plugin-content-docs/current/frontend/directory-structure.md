---
sidebar_position: 13
title: "Directory Structure"
description: "Frontend code organization in Viben Desktop application"
---

# Directory Structure

How frontend code is organized in the Viben Desktop application.

---

## Overview

The Viben Desktop application (`apps/desktop`) follows a feature-oriented directory structure where code is organized by concern (pages, components, hooks, stores) with shared utilities centralized.

---

## Directory Layout

```
apps/desktop/src/
+-- components/              # Reusable UI components
|   +-- chat/                # Chat-related components
|   |   +-- chat-input.tsx
|   |   +-- chat-messages.tsx
|   |   +-- background-task-indicator.tsx
|   +-- ui/                  # Base UI components (shadcn/ui)
|   |   +-- button.tsx
|   |   +-- dialog.tsx
|   |   +-- tabs.tsx
|   +-- workspace/           # Workspace-related components
|       +-- add-workspace-modal.tsx
|       +-- steps/
+-- hooks/                   # Custom React hooks
|   +-- use-agent-conversation.ts
|   +-- use-background-tasks.ts
|   +-- use-workspace-resources.ts
|   +-- use-queue-auto-promotion.ts
|   +-- index.ts
+-- lib/                     # Utilities and clients
|   +-- gateway.ts           # Gateway API client
|   +-- utils.ts             # General utilities
+-- pages/                   # Route page components
|   +-- workspace-chat.tsx
|   +-- workspace-kanban.tsx
|   +-- workspace-agents.tsx
|   +-- agent-detail.tsx
|   +-- settings-channels.tsx
+-- stores/                  # Zustand state stores
|   +-- kanban-store.ts
|   +-- kanban-queue-store.ts
|   +-- workspace-store.ts
+-- styles/                  # Global styles
    +-- globals.css
```

---

## Module Organization

### Pages

Each page corresponds to a route and is the top-level composition of components:

```
pages/
+-- workspace-chat.tsx       # Chat page with agent interaction
+-- workspace-kanban.tsx     # Kanban board page
+-- workspace-agents.tsx     # Agent list/management page
+-- agent-detail.tsx         # Single agent detail page
```

### Components

Components are organized by feature domain:

```
components/
+-- chat/                    # Chat feature components
+-- ui/                      # Generic UI primitives (shadcn/ui based)
+-- workspace/               # Workspace management UI
```

### Hooks

Hooks encapsulate business logic and data fetching:

```
hooks/
+-- use-workspace-resources.ts  # useAgents, useChatList, useExecutors
+-- use-agent-conversation.ts   # Agent SSE conversation management
+-- use-background-tasks.ts     # Background task monitoring
+-- use-queue-auto-promotion.ts # Kanban queue auto-promotion
```

### Stores

Zustand stores for global UI state:

```
stores/
+-- kanban-store.ts           # Kanban board state
+-- kanban-queue-store.ts     # Queue settings (maxParallelTasks)
+-- workspace-store.ts        # Active workspace tracking
```

---

## Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| **Components** | PascalCase | `BackgroundTaskIndicator.tsx` |
| **Hooks** | `use-` prefix, kebab-case file | `use-background-tasks.ts` |
| **Stores** | `-store` suffix, kebab-case | `kanban-store.ts` |
| **Pages** | kebab-case, descriptive | `workspace-kanban.tsx` |
| **Utilities** | kebab-case | `gateway.ts`, `utils.ts` |

---

## Adding New Features

When adding a new feature:

1. **Page**: Create in `pages/` if it needs a route
2. **Components**: Create a subdirectory under `components/` for the feature
3. **Hook**: Create in `hooks/` for data fetching and business logic
4. **Store**: Create in `stores/` only if global state is needed
5. **Types**: Co-locate with the module that defines them, or in a shared `types.ts`

---

## Examples

Well-organized modules to reference:

- **Chat**: `components/chat/` + `hooks/use-agent-conversation.ts` + `pages/workspace-chat.tsx`
- **Kanban**: `stores/kanban-store.ts` + `hooks/use-queue-auto-promotion.ts` + `pages/workspace-kanban.tsx`
- **Workspace**: `components/workspace/` + `hooks/use-workspace-resources.ts`

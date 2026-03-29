---
sidebar_position: 2
title: Kanban Integration Specification
description: Integrating vibe-kanban task board functionality in workspace
---

# Kanban Integration - Vibe-Kanban Integration Specification

> Integrating vibe-kanban task board functionality in workspace, providing project-level task management capabilities.

---

## Overview

| Attribute | Value |
|-----------|-------|
| Module ID | M-KANBAN |
| Dependencies | workspace-ui (T17), UI Shell (T3) |
| Priority | P1 |
| Status | 📝 Specification |

---

## Goals

Integrate [vibe-kanban](https://github.com/others/vibe-kanban) into the viben desktop application:

1. Add [Task Board] entry on workspace page
2. Open embedded kanban page within desktop on click
3. Implement Notion-style breadcrumb navigation
4. Support workspace-level task management

---

## User Flow

```
Workspace List → Select Workspace → Workspace Details Page
                                    ↓
                              Click [Task Board]
                                    ↓
                              Breadcrumb navigation updates
                              (Workspace > Task Board)
                                    ↓
                              Open Kanban Page
```

---

## Package Architecture

### Overall Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Applications                               │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │  apps/desktop   │  │    apps/web     │  │   apps/docs     │         │
│  │  (Tauri + React)│  │    (Next.js)    │  │  (Docusaurus)   │         │
│  └────────┬────────┘  └────────┬────────┘  └─────────────────┘         │
│           │                    │                                        │
│           └──────────┬─────────┘                                        │
│                      │ imports                                          │
├──────────────────────┼──────────────────────────────────────────────────┤
│                      ▼                                                  │
│                   Packages (Shared Libraries)                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    @viben/kanban (NEW)                          │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │   │
│  │  │ KanbanBoard │ │KanbanColumn │ │  TaskCard   │               │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘               │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │   │
│  │  │ useKanban   │ │ useDragDrop │ │   types     │               │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘               │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      @viben/ui (NEW)                            │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │   │
│  │  │Breadcrumb│ │  Badge   │ │ Priority │ │ Assignee │           │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │   │
│  │  │  Button  │ │   Card   │ │  Dialog  │ │ Skeleton │           │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐      │
│  │ @viben/api-client│  │   @viben/cli     │  │  @viben/types    │      │
│  │   (existing)     │  │   (existing)     │  │     (NEW)        │      │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## New Package Definitions

### Package 1: `@viben/ui` - Shared UI Component Library

**Purpose**: Extract reusable UI primitives from desktop application for sharing across all applications.

**Priority**: P0 (Foundation dependency)

```
packages/ui/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── tailwind.config.ts
├── src/
│   ├── index.ts                 # Export entry
│   ├── lib/
│   │   └── utils.ts             # cn() utility function
│   ├── styles/
│   │   └── globals.css          # Tailwind base styles + CSS variables
│   └── components/
│       ├── breadcrumb.tsx       # Breadcrumb navigation ⭐ New
│       ├── button.tsx           # Button
│       ├── card.tsx             # Card
│       ├── badge.tsx            # Badge
│       ├── skeleton.tsx         # Skeleton
│       ├── dialog.tsx           # Dialog
│       ├── dropdown-menu.tsx    # Dropdown menu
│       ├── tooltip.tsx          # Tooltip
│       ├── scroll-area.tsx      # Scroll area
│       ├── separator.tsx        # Separator
│       └── index.ts             # Component exports
└── README.md
```

**package.json**:

```json
{
  "name": "@viben/ui",
  "version": "1.0.0",
  "description": "Viben shared UI component library",
  "main": "dist/index.js",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.js"
    },
    "./styles.css": "./dist/styles.css"
  },
  "sideEffects": ["*.css"],
  "scripts": {
    "build": "tsup && pnpm build:css",
    "build:css": "tailwindcss -i src/styles/globals.css -o dist/styles.css --minify",
    "dev": "tsup --watch",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@radix-ui/react-dialog": "^1.1.4",
    "@radix-ui/react-dropdown-menu": "^2.1.4",
    "@radix-ui/react-scroll-area": "^1.2.2",
    "@radix-ui/react-separator": "^1.1.1",
    "@radix-ui/react-slot": "^1.1.1",
    "@radix-ui/react-tooltip": "^1.1.6",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.6.0"
  },
  "peerDependencies": {
    "react": "^18.0.0 || ^19.0.0",
    "react-dom": "^18.0.0 || ^19.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "tailwindcss": "^4.0.0",
    "tsup": "^8.3.5",
    "typescript": "^5.7.0"
  }
}
```

**Exported Components**:

| Component | Source | Reusability |
|-----------|--------|-------------|
| `Breadcrumb` | New | ⭐⭐⭐⭐⭐ |
| `Button` | Extracted from desktop | ⭐⭐⭐⭐⭐ |
| `Card` | Extracted from desktop | ⭐⭐⭐⭐⭐ |
| `Badge` | Extracted from desktop | ⭐⭐⭐⭐⭐ |
| `Skeleton` | Extracted from desktop | ⭐⭐⭐⭐⭐ |
| `Dialog` | Extracted from desktop | ⭐⭐⭐⭐⭐ |
| `DropdownMenu` | Extracted from desktop | ⭐⭐⭐⭐⭐ |
| `Tooltip` | Extracted from desktop | ⭐⭐⭐⭐⭐ |
| `ScrollArea` | Extracted from desktop | ⭐⭐⭐⭐⭐ |
| `Separator` | Extracted from desktop | ⭐⭐⭐⭐⭐ |

---

### Package 2: `@viben/kanban` - Kanban Core Components

**Purpose**: Encapsulate reusable Kanban board UI components without business logic.

**Priority**: P1 (Kanban feature core)

```
packages/kanban/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── src/
│   ├── index.ts                 # Export entry
│   ├── types.ts                 # Type definitions
│   ├── context.ts               # Kanban context
│   ├── components/
│   │   ├── kanban-provider.tsx  # DnD context provider
│   │   ├── kanban-board.tsx     # Board container
│   │   ├── kanban-column.tsx    # Column component
│   │   ├── kanban-column-header.tsx
│   │   ├── kanban-card.tsx      # Card component
│   │   ├── kanban-card-content.tsx
│   │   ├── kanban-add-card.tsx  # Add card
│   │   └── index.ts
│   ├── primitives/
│   │   ├── priority-icon.tsx    # Priority icon
│   │   ├── assignee-avatar.tsx  # Assignee avatar
│   │   ├── due-date-badge.tsx   # Due date badge
│   │   ├── tag-badge.tsx        # Tag badge
│   │   └── index.ts
│   └── hooks/
│       ├── use-kanban-context.ts
│       ├── use-drag-handle.ts
│       └── index.ts
└── README.md
```

**package.json**:

```json
{
  "name": "@viben/kanban",
  "version": "1.0.0",
  "description": "Viben Kanban board components",
  "main": "dist/index.js",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@dnd-kit/core": "^6.3.1",
    "@dnd-kit/sortable": "^10.0.0",
    "@dnd-kit/utilities": "^3.2.2"
  },
  "peerDependencies": {
    "@viben/ui": "workspace:*",
    "react": "^18.0.0 || ^19.0.0",
    "react-dom": "^18.0.0 || ^19.0.0",
    "lucide-react": ">=0.400.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "tsup": "^8.3.5",
    "typescript": "^5.7.0"
  }
}
```

**Core Type Definitions** (`src/types.ts`):

```typescript
// ============================================
// Core Types (No business logic)
// ============================================

/**
 * Kanban item status
 */
export type KanbanStatus = string;

/**
 * Priority
 */
export type KanbanPriority = "low" | "medium" | "high" | "urgent";

/**
 * Kanban column configuration
 */
export interface KanbanColumnConfig {
  id: string;
  status: KanbanStatus;
  title: string;
  color?: string;
  order: number;
  /** Whether collapsible */
  collapsible?: boolean;
  /** Whether collapsed by default */
  defaultCollapsed?: boolean;
  /** Maximum task limit (WIP limit) */
  maxItems?: number;
}

/**
 * Kanban item (generic)
 * Uses generics to support extended fields
 */
export interface KanbanItem<TMetadata = Record<string, unknown>> {
  id: string;
  title: string;
  description?: string;
  status: KanbanStatus;
  priority?: KanbanPriority;
  order: number;
  /** Extended metadata */
  metadata?: TMetadata;
}

/**
 * Drag result
 */
export interface KanbanDragResult {
  itemId: string;
  sourceColumnId: string;
  targetColumnId: string;
  newOrder: number;
}

/**
 * Kanban event callbacks
 */
export interface KanbanCallbacks<TItem extends KanbanItem = KanbanItem> {
  onItemMove?: (result: KanbanDragResult) => void | Promise<void>;
  onItemCreate?: (columnId: string, item: Partial<TItem>) => void | Promise<void>;
  onItemUpdate?: (item: TItem) => void | Promise<void>;
  onItemDelete?: (itemId: string) => void | Promise<void>;
  onItemClick?: (item: TItem) => void;
  onColumnCollapse?: (columnId: string, collapsed: boolean) => void;
}

/**
 * Kanban configuration
 */
export interface KanbanConfig {
  /** Allow cross-column drag */
  allowCrossColumnDrag?: boolean;
  /** Allow reordering within column */
  allowReorder?: boolean;
  /** Show add card button */
  showAddCard?: boolean;
  /** Read-only mode */
  readonly?: boolean;
  /** Virtual scroll threshold */
  virtualizeThreshold?: number;
}

// ============================================
// Component Props
// ============================================

export interface KanbanProviderProps {
  children: React.ReactNode;
  config?: KanbanConfig;
}

export interface KanbanBoardProps<TItem extends KanbanItem = KanbanItem> {
  columns: KanbanColumnConfig[];
  items: TItem[];
  callbacks?: KanbanCallbacks<TItem>;
  config?: KanbanConfig;
  className?: string;
  /** Custom card rendering */
  renderCard?: (item: TItem) => React.ReactNode;
  /** Custom column header rendering */
  renderColumnHeader?: (column: KanbanColumnConfig, itemCount: number) => React.ReactNode;
}

export interface KanbanColumnProps<TItem extends KanbanItem = KanbanItem> {
  column: KanbanColumnConfig;
  items: TItem[];
  callbacks?: KanbanCallbacks<TItem>;
  config?: KanbanConfig;
  renderCard?: (item: TItem) => React.ReactNode;
  renderColumnHeader?: (column: KanbanColumnConfig, itemCount: number) => React.ReactNode;
}

export interface KanbanCardProps<TItem extends KanbanItem = KanbanItem> {
  item: TItem;
  isDragging?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
}
```

**Component Responsibility Separation**:

| Component | Responsibility | Business Logic |
|-----------|----------------|----------------|
| `KanbanProvider` | Provides DnD context | None |
| `KanbanBoard` | Renders column container, handles drag events | None |
| `KanbanColumn` | Renders single column, acts as drop zone | None |
| `KanbanColumnHeader` | Renders column title, task count | None |
| `KanbanCard` | Renders draggable card | None |
| `KanbanCardContent` | Renders card content (customizable) | None |
| `KanbanAddCard` | Add new card UI | None |

---

### Package 3: `@viben/types` - Shared Type Definitions

**Purpose**: Define TypeScript types shared across applications.

**Priority**: P0 (Foundation dependency)

```
packages/types/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── workspace.ts         # Workspace related types
│   ├── kanban.ts            # Kanban business types (extends @viben/kanban)
│   ├── user.ts              # User related types
│   ├── package.ts           # MCP/Skill package types
│   └── api.ts               # API response types
└── README.md
```

**Kanban Business Types** (`src/kanban.ts`):

```typescript
import type { KanbanItem, KanbanColumnConfig, KanbanPriority } from "@viben/kanban";

/**
 * Viben task metadata
 */
export interface TaskMetadata {
  assigneeId?: string;
  assigneeName?: string;
  assigneeAvatar?: string;
  dueDate?: string;
  tags?: string[];
  estimatedHours?: number;
  actualHours?: number;
  linkedIssueUrl?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Viben task (extends KanbanItem)
 */
export interface Task extends KanbanItem<TaskMetadata> {
  workspaceId: string;
  projectId?: string;
}

/**
 * Task status (predefined)
 */
export type TaskStatus = "backlog" | "todo" | "in_progress" | "review" | "done" | "archived";

/**
 * Default column configuration
 */
export const DEFAULT_COLUMNS: KanbanColumnConfig[] = [
  { id: "backlog", status: "backlog", title: "Backlog", color: "#6B7280", order: 0 },
  { id: "todo", status: "todo", title: "To Do", color: "#3B82F6", order: 1 },
  { id: "in_progress", status: "in_progress", title: "In Progress", color: "#F59E0B", order: 2 },
  { id: "review", status: "review", title: "Review", color: "#8B5CF6", order: 3 },
  { id: "done", status: "done", title: "Done", color: "#10B981", order: 4 },
];

/**
 * Task filter criteria
 */
export interface TaskFilter {
  status?: TaskStatus[];
  priority?: KanbanPriority[];
  assigneeId?: string;
  tags?: string[];
  search?: string;
  dueBefore?: string;
  dueAfter?: string;
}

/**
 * Task sort field
 */
export type TaskSortField = "order" | "priority" | "dueDate" | "createdAt" | "updatedAt" | "title";

/**
 * Task sort direction
 */
export type TaskSortDirection = "asc" | "desc";
```

---

## Package Dependency Graph

```mermaid
graph TD
    subgraph "Applications"
        DESKTOP[apps/desktop]
        WEB[apps/web]
    end

    subgraph "Feature Packages"
        KANBAN[@viben/kanban]
    end

    subgraph "Foundation Packages"
        UI[@viben/ui]
        TYPES[@viben/types]
        API[@viben/api-client]
    end

    subgraph "External Dependencies"
        RADIX[Radix UI]
        DND[@dnd-kit]
        REACT[React]
        TW[Tailwind CSS]
    end

    DESKTOP --> KANBAN
    DESKTOP --> UI
    DESKTOP --> TYPES
    DESKTOP --> API

    WEB --> UI
    WEB --> TYPES
    WEB --> API

    KANBAN --> UI
    KANBAN --> DND

    UI --> RADIX
    UI --> REACT
    UI --> TW

    TYPES -.-> KANBAN

    style KANBAN fill:#FFB74D
    style UI fill:#64B5F6
    style TYPES fill:#81C784
```

**Dependency Direction Legend**:

- `→` Runtime dependency
- `-.->` Type dependency (type imports only)

---

## Symlink Integration Strategy (Recommended)

> **Core Concept**: Link vibe-kanban frontend packages directly to viben monorepo via symlink, achieving code sharing rather than duplication.

### Why Choose Symlink

| Approach | Pros | Cons | Recommendation |
|----------|------|------|----------------|
| **A: Source Copy** | Full control | Maintain two codebases, sync difficult | ⭐⭐ |
| **B: NPM Package Publishing** | Clear version management | Requires publish flow, slow iteration | ⭐⭐⭐ |
| **C: Git Submodule** | Version tracking | Complex build, submodule management difficult | ⭐⭐⭐ |
| **D: Symlink** | Real-time sync, zero maintenance cost | Requires local vibe-kanban repo | ⭐⭐⭐⭐⭐ |

### vibe-kanban Project Structure

According to [ARCHITECTURE.md](file:///Users/lxy/Documents/GitHub/others/vibe-kanban/ARCHITECTURE.md), vibe-kanban's frontend structure:

```
vibe-kanban/
├── frontend/                     # React frontend application
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/              # Basic UI components (shadcn/ui)
│   │   │   │   └── shadcn-io/
│   │   │   │       └── kanban/  # ⭐ Kanban core components
│   │   │   ├── ui-new/          # New design system components
│   │   │   │   ├── containers/  # Business containers
│   │   │   │   ├── primitives/  # ⭐ Atomic components
│   │   │   │   └── views/       # ⭐ View components
│   │   │   └── ...
│   │   ├── hooks/               # Custom Hooks (~90)
│   │   ├── stores/              # Zustand state
│   │   └── lib/                 # Utility library
│   └── package.json
├── shared/                       # Frontend-backend shared types
│   ├── types.ts                 # ⭐ TypeScript type definitions
│   └── remote-types.ts
└── ...
```

### Symlink Mapping Plan

Create symlinks in viben monorepo pointing to vibe-kanban's relevant directories:

```bash
# Target structure
viben/
├── packages/
│   ├── vibe-kanban-ui/          # symlink → vibe-kanban/frontend/src/components/ui
│   ├── vibe-kanban-ui-new/      # symlink → vibe-kanban/frontend/src/components/ui-new
│   ├── vibe-kanban-shared/      # symlink → vibe-kanban/shared
│   └── ...
```

### Setup Steps

#### Step 1: Create Symlinks

```bash
cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben

# Create symlink directory
mkdir -p packages/vibe-kanban

# Link UI components
ln -s /Users/lxy/Documents/GitHub/others/vibe-kanban/frontend/src/components/ui \
      packages/vibe-kanban/ui

# Link new design components
ln -s /Users/lxy/Documents/GitHub/others/vibe-kanban/frontend/src/components/ui-new \
      packages/vibe-kanban/ui-new

# Link hooks
ln -s /Users/lxy/Documents/GitHub/others/vibe-kanban/frontend/src/hooks \
      packages/vibe-kanban/hooks

# Link shared types
ln -s /Users/lxy/Documents/GitHub/others/vibe-kanban/shared \
      packages/vibe-kanban/shared

# Link utility library
ln -s /Users/lxy/Documents/GitHub/others/vibe-kanban/frontend/src/lib \
      packages/vibe-kanban/lib
```

#### Step 2: Create Wrapper package.json

Create `package.json` in `packages/vibe-kanban/`:

```json
{
  "name": "@viben/vibe-kanban",
  "version": "1.0.0",
  "description": "Symlinked vibe-kanban components for viben",
  "private": true,
  "main": "index.ts",
  "types": "index.ts",
  "exports": {
    ".": "./index.ts",
    "./ui/*": "./ui/*",
    "./ui-new/*": "./ui-new/*",
    "./hooks/*": "./hooks/*",
    "./shared": "./shared/types.ts",
    "./lib/*": "./lib/*"
  },
  "peerDependencies": {
    "react": "^18.0.0 || ^19.0.0",
    "react-dom": "^18.0.0 || ^19.0.0"
  }
}
```

#### Step 3: Create Unified Export Entry

In `packages/vibe-kanban/index.ts`:

```typescript
// Kanban core components
export * from "./ui/shadcn-io/kanban";

// New design components
export * from "./ui-new/primitives";
export * from "./ui-new/views/KanbanBoard";

// Type definitions
export type * from "./shared/types";
```

#### Step 4: Update Turbo Configuration

Configure build dependencies in `turbo.json`:

```json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    }
  },
  "globalDependencies": [
    "packages/vibe-kanban/**"
  ]
}
```

#### Step 5: Use in Desktop Application

```typescript
// apps/desktop/src/components/workspace/workspace-kanban.tsx
import {
  KanbanProvider,
  KanbanBoard,
  KanbanCard,
  KanbanHeader,
} from "@viben/vibe-kanban";
import type { Task } from "@viben/vibe-kanban/shared";

export function WorkspaceKanban({ workspaceId }: { workspaceId: string }) {
  // ... business logic
  return (
    <KanbanProvider>
      <KanbanBoard
        columns={columns}
        items={tasks}
        onDragEnd={handleDragEnd}
      />
    </KanbanProvider>
  );
}
```

### Reusable Component List (via Symlink)

| Path | Components | Purpose |
|------|------------|---------|
| `ui/shadcn-io/kanban/` | `KanbanProvider`, `KanbanBoard`, `KanbanCard`, `KanbanCards`, `KanbanHeader` | Kanban core UI |
| `ui-new/primitives/` | `PriorityIcon`, `ViewNavTabs`, `StatusBadge` | Atomic components |
| `ui-new/views/` | `KanbanBoard`, `KanbanCardContent`, `IssueListView` | View components |
| `hooks/` | `useKanban*`, `useDragDrop`, `useProject*` | State Hooks |
| `shared/` | `Task`, `Project`, `TaskStatus`, `IssuePriority` | TypeScript types |
| `lib/` | `utils.ts`, `api.ts` | Utility functions |

### Notes

1. **Development Environment**: Requires cloning both vibe-kanban and viben repositories
2. **CI/CD**: Need to set up symlink in CI, or use Git Submodule as fallback
3. **Type Compatibility**: vibe-kanban uses React 18, viben uses React 19, ensure compatibility
4. **Style Conflicts**: vibe-kanban uses dual Tailwind config, need to adapt to Viben Design System

### Fallback: Hybrid Mode

If symlink is unavailable in certain environments, use hybrid mode:

1. **Development Environment**: Use symlink (real-time sync)
2. **CI Environment**: Use Git Submodule or npm pack
3. **Production Environment**: Copy necessary files during build

---

## Component Migration Mapping

### Direct Use via Symlink

| vibe-kanban Component | Import Path | Modification Level |
|-----------------------|-------------|-------------------|
| `ui/shadcn-io/kanban/KanbanProvider` | `@viben/vibe-kanban` | No modification |
| `ui/shadcn-io/kanban/KanbanBoard` | `@viben/vibe-kanban` | No modification |
| `ui/shadcn-io/kanban/KanbanCard` | `@viben/vibe-kanban` | No modification |
| `ui/shadcn-io/kanban/KanbanCards` | `@viben/vibe-kanban` | No modification |
| `ui/shadcn-io/kanban/KanbanHeader` | `@viben/vibe-kanban` | No modification |
| `ui-new/views/KanbanCardContent` | `@viben/vibe-kanban/ui-new/views` | No modification |
| `ui-new/primitives/PriorityIcon` | `@viben/vibe-kanban/ui-new/primitives` | No modification |

### Components to Implement in viben (Business-related)

| Component | Reason | Implementation Location |
|-----------|--------|------------------------|
| `WorkspaceKanban` | viben-specific workspace integration | `apps/desktop/src/components/workspace/` |
| `useWorkspaceKanban` | viben-specific state management | `apps/desktop/src/hooks/` |
| `Breadcrumb` | Notion-style, provided by @viben/ui | `packages/ui/` |

### Components Not Referenced via Symlink (vibe-kanban specific)

| Component | Reason |
|-----------|--------|
| `KanbanContainer` | Contains vibe-kanban specific business logic |
| `KanbanFilterBar` | Depends on vibe-kanban filter state |
| `KanbanIssuePanelContainer` | Specific to Issue details |
| `useTaskMutations` | Depends on vibe-kanban backend API |
| All stores | vibe-kanban application-level state |

---

## Style Adaptation Guide

### From vibe-kanban Styles to Viben Design System

**Color Mapping**:

| vibe-kanban | Viben Design System | CSS Variable |
|-------------|---------------------|--------------|
| `bg-card` | `bg-surface` | `--surface` |
| `border-border` | `border-border` | `--border` |
| `text-foreground` | `text-foreground` | `--foreground` |
| Blue primary | Warm amber | `--primary` |
| Default radius | `rounded-xl` | `--radius-lg` |

**Animation Adaptation**:

```css
/* vibe-kanban default */
transition: all 0.2s ease;

/* Viben Design System */
transition: all var(--duration-fast) var(--ease-out-expo);
```

**Card Style Adaptation**:

```tsx
// vibe-kanban original style
<div className="rounded-lg border bg-card p-3 shadow-sm">

// Viben Design System adaptation
<div className={cn(
  "rounded-xl border border-border bg-surface p-4",
  "transition-all duration-200",
  "hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5"
)}>
```

---

## UI Design

### 1. Breadcrumb Navigation

**Position**: Top of workspace page

**Design Philosophy**: Notion-style

```
┌──────────────────────────────────────────────────────────────┐
│  🏠 Home  /  📁 My Workspace  /  📋 Task Board                │
│  ─────────────────────────────────────────────────────────── │
│                                                              │
│                     [Page Content Area]                      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Interaction Behavior**:
- Each level is clickable, navigates to corresponding page
- Current page is not clickable, displayed as plain text
- Supports icon display (optional)
- Responsive: collapses middle levels on mobile, shows `... / Current Page`

### 2. Kanban Page Layout

```
┌──────────────────────────────────────────────────────────────┐
│  Breadcrumb: Home / My Workspace / Task Board                │
├──────────────────────────────────────────────────────────────┤
│ ┌────────────┬────────────┬────────────┬────────────┐       │
│ │  To Do (5) │In Progress │  Done (12) │ Archived   │       │
│ │            │   (3)      │            │            │       │
│ ├────────────┼────────────┼────────────┼────────────┤       │
│ │ ┌────────┐ │ ┌────────┐ │ ┌────────┐ │            │       │
│ │ │ Task 1 │ │ │ Task 3 │ │ │ Task 5 │ │            │       │
│ │ └────────┘ │ └────────┘ │ └────────┘ │            │       │
│ │ ┌────────┐ │ ┌────────┐ │ ┌────────┐ │            │       │
│ │ │ Task 2 │ │ │ Task 4 │ │ │ Task 6 │ │            │       │
│ │ └────────┘ │ └────────┘ │ └────────┘ │            │       │
│ │            │            │            │            │       │
│ │ + Add Task │            │            │            │       │
│ └────────────┴────────────┴────────────┴────────────┘       │
└──────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases (Symlink Approach)

### Phase 0: Symlink Setup

**Goal**: Establish symlink connection between vibe-kanban and viben

| Task | Deliverable | Priority |
|------|-------------|----------|
| Create symlink directory structure | `packages/vibe-kanban/` | P0 |
| Link vibe-kanban frontend components | symlinks to ui/, ui-new/, hooks/ | P0 |
| Link shared types | symlink to shared/ | P0 |
| Create wrapper package.json | `packages/vibe-kanban/package.json` | P0 |
| Create unified export entry | `packages/vibe-kanban/index.ts` | P0 |
| Update pnpm-workspace.yaml | Add vibe-kanban package | P0 |
| Update turbo.json | Configure build dependencies | P0 |

**Acceptance Criteria**:
- [ ] `ls -la packages/vibe-kanban/` shows correct symlinks
- [ ] `pnpm install` succeeds without errors
- [ ] desktop app can import components from `@viben/vibe-kanban`
- [ ] TypeScript type checking passes

**Setup Commands**:
```bash
# Create directory
mkdir -p packages/vibe-kanban

# Create symlinks
ln -s /Users/lxy/Documents/GitHub/others/vibe-kanban/frontend/src/components/ui packages/vibe-kanban/ui
ln -s /Users/lxy/Documents/GitHub/others/vibe-kanban/frontend/src/components/ui-new packages/vibe-kanban/ui-new
ln -s /Users/lxy/Documents/GitHub/others/vibe-kanban/frontend/src/hooks packages/vibe-kanban/hooks
ln -s /Users/lxy/Documents/GitHub/others/vibe-kanban/shared packages/vibe-kanban/shared
ln -s /Users/lxy/Documents/GitHub/others/vibe-kanban/frontend/src/lib packages/vibe-kanban/lib
```

---

### Phase 1: Foundation Package Setup (@viben/ui)

**Goal**: Create shared UI component library (complementing vibe-kanban)

| Task | Deliverable | Priority |
|------|-------------|----------|
| Create `@viben/types` package | `packages/types/` | P0 |
| Create `@viben/ui` package | `packages/ui/` | P0 |
| Migrate UI primitives from desktop | 10+ components | P0 |
| Create Breadcrumb component | `@viben/ui/breadcrumb` | P0 |
| Configure Turbo build pipeline | `turbo.json` update | P0 |

**Acceptance Criteria**:
- [ ] `pnpm build` successfully builds all packages
- [ ] desktop app can import components from `@viben/ui`
- [ ] Type checking passes

### Phase 2: Desktop Integration (Using Symlink)

**Goal**: Use vibe-kanban components in desktop application (via symlink)

| Task | Deliverable | Priority |
|------|-------------|----------|
| Add Workspace Kanban Tab | UI entry point | P1 |
| Implement `WorkspaceKanban` container | Using `@viben/vibe-kanban` | P1 |
| Implement `useWorkspaceKanban` hook | viben-specific state management | P1 |
| Style adaptation layer | CSS variable mapping | P1 |
| Local storage (SQLite via Tauri) | Data persistence | P2 |
| Add internationalization support | i18n translations | P2 |

**Usage Example**:
```typescript
// apps/desktop/src/components/workspace/workspace-kanban.tsx
import {
  KanbanProvider,
  KanbanBoard,
  KanbanCard,
} from "@viben/vibe-kanban";
import { Breadcrumb } from "@viben/ui";

export function WorkspaceKanban({ workspaceId }: Props) {
  const { tasks, columns, actions } = useWorkspaceKanban(workspaceId);

  return (
    <div>
      <Breadcrumb items={breadcrumbItems} />
      <KanbanProvider>
        <KanbanBoard columns={columns} items={tasks} />
      </KanbanProvider>
    </div>
  );
}
```

**Acceptance Criteria**:
- [ ] Can correctly import components from `@viben/vibe-kanban`
- [ ] Can create, edit, delete tasks in workspace
- [ ] Dragging tasks updates status
- [ ] Data persists locally
- [ ] Supports English and Chinese

### Phase 3: Cloud Sync and Advanced Features

**Goal**: Implement cloud synchronization and collaboration features

| Task | Deliverable | Priority |
|------|-------------|----------|
| Backend Task API | REST endpoints | P3 |
| Cloud sync mechanism | Bidirectional sync | P3 |
| Real-time collaboration (optional) | WebSocket | P3 |
| Filtering and search | Advanced features | P3 |
| Performance optimization (virtual scroll) | Large data support | P3 |

---

## Directory Structure Overview (Symlink Approach)

```
viben/
├── apps/
│   ├── desktop/
│   │   └── src/
│   │       ├── components/
│   │       │   ├── workspace/
│   │       │   │   └── workspace-kanban.tsx    # Kanban container (business logic)
│   │       │   └── layout/
│   │       │       └── ... (uses @viben/ui)
│   │       └── hooks/
│   │           └── use-workspace-kanban.ts     # Kanban business hook
│   └── web/
│       └── ... (can also use @viben/ui)
│
├── packages/
│   ├── vibe-kanban/            # ⭐ Symlink to vibe-kanban project
│   │   ├── package.json        # Wrapper configuration
│   │   ├── index.ts            # Unified exports
│   │   ├── ui -> ../../../others/vibe-kanban/frontend/src/components/ui
│   │   ├── ui-new -> ../../../others/vibe-kanban/frontend/src/components/ui-new
│   │   ├── hooks -> ../../../others/vibe-kanban/frontend/src/hooks
│   │   ├── shared -> ../../../others/vibe-kanban/shared
│   │   └── lib -> ../../../others/vibe-kanban/frontend/src/lib
│   │
│   ├── ui/                     # Shared UI component library (viben specific)
│   │   └── src/
│   │       ├── components/
│   │       │   ├── breadcrumb.tsx    # Notion-style breadcrumb
│   │       │   ├── button.tsx
│   │       │   ├── card.tsx
│   │       │   └── ...
│   │       └── lib/
│   │           └── utils.ts
│   │
│   ├── types/                  # Shared type definitions (viben specific)
│   │   └── src/
│   │       ├── workspace.ts
│   │       ├── kanban.ts       # Extends vibe-kanban types
│   │       └── user.ts
│   │
│   ├── api-client/             # (existing)
│   └── cli/                    # (existing)
│
├── /Users/lxy/Documents/GitHub/others/vibe-kanban/  # External repo (symlink source)
│   ├── frontend/
│   │   └── src/
│   │       ├── components/
│   │       │   ├── ui/                # shadcn/ui base components
│   │       │   │   └── shadcn-io/
│   │       │   │       └── kanban/    # Kanban core components
│   │       │   └── ui-new/            # New design components
│   │       │       ├── containers/
│   │       │       ├── primitives/
│   │       │       └── views/
│   │       ├── hooks/                 # 90+ custom hooks
│   │       └── lib/
│   └── shared/                        # Frontend-backend shared types
│
└── docs/specs/modules/
    └── kanban-integration.md          # This document
```

---

## Acceptance Criteria

### Symlink Setup
- [ ] `packages/vibe-kanban/` directory exists and symlinks are valid
- [ ] `pnpm install` succeeds without symlink errors
- [ ] TypeScript can correctly resolve symlinked modules

### Component Integration
- [ ] `@viben/vibe-kanban` can correctly import Kanban components
- [ ] `@viben/ui` Breadcrumb component supports Notion-style navigation
- [ ] Kanban board supports drag-and-drop sorting
- [ ] Styles adapted to Viben Design System
- [ ] Supports dark/light themes

### Desktop Application
- [ ] Workspace page displays [Task Board] Tab
- [ ] Can create, edit, delete tasks in workspace
- [ ] Task data persists locally
- [ ] Supports English and Chinese internationalization

---

## Reference Resources

- [dnd-kit Documentation](https://docs.dndkit.com/)
- [Viben Design System](../design-system.md)
- [Component Guidelines](../components.md)
- [Chat Integration](../chat-integration.md)

---

**Last Updated**: 2026-02-06
**Version**: 3.0.0
**Status**: 📝 Architecture Specification (Symlink)

---
sidebar_position: 2
title: Kanban 集成规格
description: 在工作空间中集成 vibe-kanban 任务看板功能
---

# Kanban Integration - Vibe-Kanban 集成规格

> 在工作空间中集成 vibe-kanban 任务看板功能，提供项目级任务管理能力。

---

## Overview

| Attribute | Value |
|-----------|-------|
| Module ID | M-KANBAN |
| Dependencies | workspace-ui (T17), UI Shell (T3) |
| Priority | P1 |
| Status | 📝 Specification |

---

## 目标

将 [vibe-kanban](https://github.com/others/vibe-kanban) 集成到 viben desktop 应用中：

1. 在工作空间页面添加【任务看板】入口
2. 点击后在 desktop 内打开嵌入式 kanban 页面
3. 实现类 Notion 风格的面包屑导航
4. 支持工作空间级别的任务管理

---

## 用户流程

```
工作空间列表 → 选择工作空间 → 工作空间详情页
                                    ↓
                              点击【任务看板】
                                    ↓
                              面包屑导航更新
                              (工作空间 > 任务看板)
                                    ↓
                              打开 Kanban 页面
```

---

## 包架构设计 (Package Architecture)

### 整体架构图

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

## 新增包定义

### Package 1: `@viben/ui` - 共享 UI 组件库

**目的**: 从 desktop 应用中提取可复用的 UI 原语，供所有应用共享。

**优先级**: P0 (基础依赖)

```
packages/ui/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── tailwind.config.ts
├── src/
│   ├── index.ts                 # 导出入口
│   ├── lib/
│   │   └── utils.ts             # cn() 工具函数
│   ├── styles/
│   │   └── globals.css          # Tailwind 基础样式 + CSS 变量
│   └── components/
│       ├── breadcrumb.tsx       # 面包屑导航 ⭐ 新增
│       ├── button.tsx           # 按钮
│       ├── card.tsx             # 卡片
│       ├── badge.tsx            # 徽章
│       ├── skeleton.tsx         # 骨架屏
│       ├── dialog.tsx           # 对话框
│       ├── dropdown-menu.tsx    # 下拉菜单
│       ├── tooltip.tsx          # 工具提示
│       ├── scroll-area.tsx      # 滚动区域
│       ├── separator.tsx        # 分隔符
│       └── index.ts             # 组件导出
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

**导出的组件**:

| 组件 | 来源 | 可复用性 |
|------|------|---------|
| `Breadcrumb` | 新建 | ⭐⭐⭐⭐⭐ |
| `Button` | 从 desktop 提取 | ⭐⭐⭐⭐⭐ |
| `Card` | 从 desktop 提取 | ⭐⭐⭐⭐⭐ |
| `Badge` | 从 desktop 提取 | ⭐⭐⭐⭐⭐ |
| `Skeleton` | 从 desktop 提取 | ⭐⭐⭐⭐⭐ |
| `Dialog` | 从 desktop 提取 | ⭐⭐⭐⭐⭐ |
| `DropdownMenu` | 从 desktop 提取 | ⭐⭐⭐⭐⭐ |
| `Tooltip` | 从 desktop 提取 | ⭐⭐⭐⭐⭐ |
| `ScrollArea` | 从 desktop 提取 | ⭐⭐⭐⭐⭐ |
| `Separator` | 从 desktop 提取 | ⭐⭐⭐⭐⭐ |

---

### Package 2: `@viben/kanban` - Kanban 核心组件

**目的**: 封装可复用的 Kanban 看板 UI 组件，不含业务逻辑。

**优先级**: P1 (Kanban 功能核心)

```
packages/kanban/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── src/
│   ├── index.ts                 # 导出入口
│   ├── types.ts                 # 类型定义
│   ├── context.ts               # Kanban 上下文
│   ├── components/
│   │   ├── kanban-provider.tsx  # DnD 上下文提供者
│   │   ├── kanban-board.tsx     # 看板容器
│   │   ├── kanban-column.tsx    # 列组件
│   │   ├── kanban-column-header.tsx
│   │   ├── kanban-card.tsx      # 卡片组件
│   │   ├── kanban-card-content.tsx
│   │   ├── kanban-add-card.tsx  # 添加卡片
│   │   └── index.ts
│   ├── primitives/
│   │   ├── priority-icon.tsx    # 优先级图标
│   │   ├── assignee-avatar.tsx  # 指派人头像
│   │   ├── due-date-badge.tsx   # 截止日期徽章
│   │   ├── tag-badge.tsx        # 标签徽章
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

**核心类型定义** (`src/types.ts`):

```typescript
// ============================================
// Core Types - 核心类型 (无业务逻辑)
// ============================================

/**
 * 看板项目状态
 */
export type KanbanStatus = string;

/**
 * 优先级
 */
export type KanbanPriority = "low" | "medium" | "high" | "urgent";

/**
 * 看板列配置
 */
export interface KanbanColumnConfig {
  id: string;
  status: KanbanStatus;
  title: string;
  color?: string;
  order: number;
  /** 是否可折叠 */
  collapsible?: boolean;
  /** 是否默认折叠 */
  defaultCollapsed?: boolean;
  /** 最大任务数限制 (WIP limit) */
  maxItems?: number;
}

/**
 * 看板项目 (通用)
 * 使用泛型支持扩展字段
 */
export interface KanbanItem<TMetadata = Record<string, unknown>> {
  id: string;
  title: string;
  description?: string;
  status: KanbanStatus;
  priority?: KanbanPriority;
  order: number;
  /** 扩展元数据 */
  metadata?: TMetadata;
}

/**
 * 拖拽结果
 */
export interface KanbanDragResult {
  itemId: string;
  sourceColumnId: string;
  targetColumnId: string;
  newOrder: number;
}

/**
 * 看板事件回调
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
 * 看板配置
 */
export interface KanbanConfig {
  /** 允许跨列拖拽 */
  allowCrossColumnDrag?: boolean;
  /** 允许列内排序 */
  allowReorder?: boolean;
  /** 显示添加卡片按钮 */
  showAddCard?: boolean;
  /** 只读模式 */
  readonly?: boolean;
  /** 虚拟滚动阈值 */
  virtualizeThreshold?: number;
}

// ============================================
// Component Props - 组件属性
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
  /** 自定义卡片渲染 */
  renderCard?: (item: TItem) => React.ReactNode;
  /** 自定义列头渲染 */
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

**组件职责分离**:

| 组件 | 职责 | 业务逻辑 |
|------|------|---------|
| `KanbanProvider` | 提供 DnD 上下文 | 无 |
| `KanbanBoard` | 渲染列容器，处理拖拽事件 | 无 |
| `KanbanColumn` | 渲染单列，作为拖放区域 | 无 |
| `KanbanColumnHeader` | 渲染列标题、任务数 | 无 |
| `KanbanCard` | 渲染可拖拽卡片 | 无 |
| `KanbanCardContent` | 渲染卡片内容 (可定制) | 无 |
| `KanbanAddCard` | 添加新卡片 UI | 无 |

---

### Package 3: `@viben/types` - 共享类型定义

**目的**: 定义跨应用共享的 TypeScript 类型。

**优先级**: P0 (基础依赖)

```
packages/types/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── workspace.ts         # 工作空间相关类型
│   ├── kanban.ts            # Kanban 业务类型 (扩展 @viben/kanban)
│   ├── user.ts              # 用户相关类型
│   ├── package.ts           # MCP/Skill 包类型
│   └── api.ts               # API 响应类型
└── README.md
```

**Kanban 业务类型** (`src/kanban.ts`):

```typescript
import type { KanbanItem, KanbanColumnConfig, KanbanPriority } from "@viben/kanban";

/**
 * Viben 任务元数据
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
 * Viben 任务 (扩展 KanbanItem)
 */
export interface Task extends KanbanItem<TaskMetadata> {
  workspaceId: string;
  projectId?: string;
}

/**
 * 任务状态 (预定义)
 */
export type TaskStatus = "backlog" | "todo" | "in_progress" | "review" | "done" | "archived";

/**
 * 默认列配置
 */
export const DEFAULT_COLUMNS: KanbanColumnConfig[] = [
  { id: "backlog", status: "backlog", title: "待规划", color: "#6B7280", order: 0 },
  { id: "todo", status: "todo", title: "待办", color: "#3B82F6", order: 1 },
  { id: "in_progress", status: "in_progress", title: "进行中", color: "#F59E0B", order: 2 },
  { id: "review", status: "review", title: "待审核", color: "#8B5CF6", order: 3 },
  { id: "done", status: "done", title: "已完成", color: "#10B981", order: 4 },
];

/**
 * 任务筛选条件
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
 * 任务排序字段
 */
export type TaskSortField = "order" | "priority" | "dueDate" | "createdAt" | "updatedAt" | "title";

/**
 * 任务排序方向
 */
export type TaskSortDirection = "asc" | "desc";
```

---

## 包依赖关系图

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

**依赖方向说明**:

- `→` 运行时依赖
- `-.->` 类型依赖 (仅类型导入)

---

## Symlink 集成策略 (推荐方案)

> **核心思想**: 通过 symlink 将 vibe-kanban 的前端包直接链接到 viben monorepo 中，实现代码共享而非复制。

### 为什么选择 Symlink

| 方案 | 优点 | 缺点 | 推荐度 |
|------|------|------|--------|
| **A: 源码复制** | 完全控制 | 维护两份代码，同步困难 | ⭐⭐ |
| **B: NPM 包发布** | 版本管理清晰 | 需发布流程，迭代慢 | ⭐⭐⭐ |
| **C: Git Submodule** | 版本追踪 | 构建复杂，子模块管理麻烦 | ⭐⭐⭐ |
| **D: Symlink** | 实时同步，零维护成本 | 需本地有 vibe-kanban 仓库 | ⭐⭐⭐⭐⭐ |

### vibe-kanban 项目结构

根据 [ARCHITECTURE.md](file:///Users/lxy/Documents/GitHub/others/vibe-kanban/ARCHITECTURE.md)，vibe-kanban 的前端结构：

```
vibe-kanban/
├── frontend/                     # React 前端应用
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/              # 基础 UI 组件 (shadcn/ui)
│   │   │   │   └── shadcn-io/
│   │   │   │       └── kanban/  # ⭐ Kanban 核心组件
│   │   │   ├── ui-new/          # 新设计系统组件
│   │   │   │   ├── containers/  # 业务容器
│   │   │   │   ├── primitives/  # ⭐ 原子组件
│   │   │   │   └── views/       # ⭐ 视图组件
│   │   │   └── ...
│   │   ├── hooks/               # 自定义 Hooks (~90个)
│   │   ├── stores/              # Zustand 状态
│   │   └── lib/                 # 工具库
│   └── package.json
├── shared/                       # 前后端共享类型
│   ├── types.ts                 # ⭐ TypeScript 类型定义
│   └── remote-types.ts
└── ...
```

### Symlink 映射方案

在 viben monorepo 中创建 symlink，指向 vibe-kanban 的相关目录：

```bash
# 目标结构
viben/
├── packages/
│   ├── vibe-kanban-ui/          # symlink → vibe-kanban/frontend/src/components/ui
│   ├── vibe-kanban-ui-new/      # symlink → vibe-kanban/frontend/src/components/ui-new
│   ├── vibe-kanban-shared/      # symlink → vibe-kanban/shared
│   └── ...
```

### 设置步骤

#### Step 1: 创建 Symlink

```bash
cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben

# 创建 symlink 目录
mkdir -p packages/vibe-kanban

# 链接 UI 组件
ln -s /Users/lxy/Documents/GitHub/others/vibe-kanban/frontend/src/components/ui \
      packages/vibe-kanban/ui

# 链接新设计组件
ln -s /Users/lxy/Documents/GitHub/others/vibe-kanban/frontend/src/components/ui-new \
      packages/vibe-kanban/ui-new

# 链接 hooks
ln -s /Users/lxy/Documents/GitHub/others/vibe-kanban/frontend/src/hooks \
      packages/vibe-kanban/hooks

# 链接共享类型
ln -s /Users/lxy/Documents/GitHub/others/vibe-kanban/shared \
      packages/vibe-kanban/shared

# 链接工具库
ln -s /Users/lxy/Documents/GitHub/others/vibe-kanban/frontend/src/lib \
      packages/vibe-kanban/lib
```

#### Step 2: 创建包装 package.json

在 `packages/vibe-kanban/` 创建 `package.json`：

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

#### Step 3: 创建统一导出入口

在 `packages/vibe-kanban/index.ts`：

```typescript
// Kanban 核心组件
export * from "./ui/shadcn-io/kanban";

// 新设计组件
export * from "./ui-new/primitives";
export * from "./ui-new/views/KanbanBoard";

// 类型定义
export type * from "./shared/types";
```

#### Step 4: 更新 Turbo 配置

在 `turbo.json` 中配置构建依赖：

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

#### Step 5: 在 Desktop 应用中使用

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
  // ... 业务逻辑
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

### 可复用组件清单 (通过 Symlink)

| 路径 | 组件 | 用途 |
|------|------|------|
| `ui/shadcn-io/kanban/` | `KanbanProvider`, `KanbanBoard`, `KanbanCard`, `KanbanCards`, `KanbanHeader` | Kanban 核心 UI |
| `ui-new/primitives/` | `PriorityIcon`, `ViewNavTabs`, `StatusBadge` | 原子组件 |
| `ui-new/views/` | `KanbanBoard`, `KanbanCardContent`, `IssueListView` | 视图组件 |
| `hooks/` | `useKanban*`, `useDragDrop`, `useProject*` | 状态 Hooks |
| `shared/` | `Task`, `Project`, `TaskStatus`, `IssuePriority` | TypeScript 类型 |
| `lib/` | `utils.ts`, `api.ts` | 工具函数 |

### 注意事项

1. **开发环境**: 需要同时克隆 vibe-kanban 和 viben 仓库
2. **CI/CD**: 需要在 CI 中也设置好 symlink，或者使用 Git Submodule 作为备选
3. **类型兼容**: vibe-kanban 使用 React 18，viben 使用 React 19，需确保兼容性
4. **样式冲突**: vibe-kanban 使用双 Tailwind 配置，需适配到 Viben Design System

### 备选方案: 混合模式

如果 symlink 在某些环境不可用，可采用混合模式：

1. **开发环境**: 使用 symlink（实时同步）
2. **CI 环境**: 使用 Git Submodule 或 npm pack
3. **生产环境**: 构建时复制必要文件

---

## 组件迁移映射

### 直接通过 Symlink 使用

| vibe-kanban 组件 | 导入路径 | 修改程度 |
|-----------------|---------|---------|
| `ui/shadcn-io/kanban/KanbanProvider` | `@viben/vibe-kanban` | 无需修改 |
| `ui/shadcn-io/kanban/KanbanBoard` | `@viben/vibe-kanban` | 无需修改 |
| `ui/shadcn-io/kanban/KanbanCard` | `@viben/vibe-kanban` | 无需修改 |
| `ui/shadcn-io/kanban/KanbanCards` | `@viben/vibe-kanban` | 无需修改 |
| `ui/shadcn-io/kanban/KanbanHeader` | `@viben/vibe-kanban` | 无需修改 |
| `ui-new/views/KanbanCardContent` | `@viben/vibe-kanban/ui-new/views` | 无需修改 |
| `ui-new/primitives/PriorityIcon` | `@viben/vibe-kanban/ui-new/primitives` | 无需修改 |

### 需要在 viben 中实现的组件 (业务相关)

| 组件 | 原因 | 实现位置 |
|------|------|---------|
| `WorkspaceKanban` | viben 特定的工作空间集成 | `apps/desktop/src/components/workspace/` |
| `useWorkspaceKanban` | viben 特定的状态管理 | `apps/desktop/src/hooks/` |
| `Breadcrumb` | Notion 风格，@viben/ui 统一提供 | `packages/ui/` |

### 不通过 Symlink 引用的组件 (vibe-kanban 特有)

| 组件 | 原因 |
|------|------|
| `KanbanContainer` | 包含 vibe-kanban 特有的业务逻辑 |
| `KanbanFilterBar` | 依赖 vibe-kanban 的筛选状态 |
| `KanbanIssuePanelContainer` | 特定于 Issue 详情 |
| `useTaskMutations` | 依赖 vibe-kanban 后端 API |
| 所有 stores | vibe-kanban 应用级状态 |

---

## 样式适配指南

### 从 vibe-kanban 样式到 Viben Design System

**颜色映射**:

| vibe-kanban | Viben Design System | CSS 变量 |
|-------------|---------------------|----------|
| `bg-card` | `bg-surface` | `--surface` |
| `border-border` | `border-border` | `--border` |
| `text-foreground` | `text-foreground` | `--foreground` |
| 蓝色主色 | 暖琥珀色 | `--primary` |
| 默认圆角 | `rounded-xl` | `--radius-lg` |

**动画适配**:

```css
/* vibe-kanban 默认 */
transition: all 0.2s ease;

/* Viben Design System */
transition: all var(--duration-fast) var(--ease-out-expo);
```

**卡片样式适配**:

```tsx
// vibe-kanban 原始样式
<div className="rounded-lg border bg-card p-3 shadow-sm">

// Viben Design System 适配
<div className={cn(
  "rounded-xl border border-border bg-surface p-4",
  "transition-all duration-200",
  "hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5"
)}>
```

---

## UI 设计

### 1. 面包屑导航 (Breadcrumb)

**位置**: 工作空间页面顶部

**设计理念**: 采用 Notion 风格

```
┌──────────────────────────────────────────────────────────────┐
│  🏠 Home  /  📁 My Workspace  /  📋 任务看板                   │
│  ─────────────────────────────────────────────────────────── │
│                                                              │
│                     [页面内容区域]                            │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**交互行为**:
- 每个层级可点击，导航到对应页面
- 当前页面不可点击，显示为普通文本
- 支持图标显示 (可选)
- 响应式：移动端折叠中间层级，显示 `... / 当前页`

### 2. Kanban 页面布局

```
┌──────────────────────────────────────────────────────────────┐
│  面包屑: Home / My Workspace / 任务看板                        │
├──────────────────────────────────────────────────────────────┤
│ ┌────────────┬────────────┬────────────┬────────────┐       │
│ │  待办 (5)   │ 进行中 (3)  │ 已完成 (12) │ 已归档      │       │
│ ├────────────┼────────────┼────────────┼────────────┤       │
│ │ ┌────────┐ │ ┌────────┐ │ ┌────────┐ │            │       │
│ │ │ Task 1 │ │ │ Task 3 │ │ │ Task 5 │ │            │       │
│ │ └────────┘ │ └────────┘ │ └────────┘ │            │       │
│ │ ┌────────┐ │ ┌────────┐ │ ┌────────┐ │            │       │
│ │ │ Task 2 │ │ │ Task 4 │ │ │ Task 6 │ │            │       │
│ │ └────────┘ │ └────────┘ │ └────────┘ │            │       │
│ │            │            │            │            │       │
│ │ + 添加任务  │            │            │            │       │
│ └────────────┴────────────┴────────────┴────────────┘       │
└──────────────────────────────────────────────────────────────┘
```

---

## 实施阶段 (Symlink 方案)

### Phase 0: Symlink 设置

**目标**: 建立 vibe-kanban 与 viben 的 symlink 连接

| 任务 | 交付物 | 优先级 |
|------|--------|--------|
| 创建 symlink 目录结构 | `packages/vibe-kanban/` | P0 |
| 链接 vibe-kanban 前端组件 | symlinks to ui/, ui-new/, hooks/ | P0 |
| 链接共享类型 | symlink to shared/ | P0 |
| 创建包装 package.json | `packages/vibe-kanban/package.json` | P0 |
| 创建统一导出入口 | `packages/vibe-kanban/index.ts` | P0 |
| 更新 pnpm-workspace.yaml | 添加 vibe-kanban 包 | P0 |
| 更新 turbo.json | 配置构建依赖 | P0 |

**验收标准**:
- [ ] `ls -la packages/vibe-kanban/` 显示正确的 symlink
- [ ] `pnpm install` 不报错
- [ ] desktop 应用可从 `@viben/vibe-kanban` 导入组件
- [ ] TypeScript 类型检查通过

**设置命令**:
```bash
# 创建目录
mkdir -p packages/vibe-kanban

# 创建 symlinks
ln -s /Users/lxy/Documents/GitHub/others/vibe-kanban/frontend/src/components/ui packages/vibe-kanban/ui
ln -s /Users/lxy/Documents/GitHub/others/vibe-kanban/frontend/src/components/ui-new packages/vibe-kanban/ui-new
ln -s /Users/lxy/Documents/GitHub/others/vibe-kanban/frontend/src/hooks packages/vibe-kanban/hooks
ln -s /Users/lxy/Documents/GitHub/others/vibe-kanban/shared packages/vibe-kanban/shared
ln -s /Users/lxy/Documents/GitHub/others/vibe-kanban/frontend/src/lib packages/vibe-kanban/lib
```

---

### Phase 1: 基础包搭建 (@viben/ui)

**目标**: 创建共享 UI 组件库（与 vibe-kanban 互补）

| 任务 | 交付物 | 优先级 |
|------|--------|--------|
| 创建 `@viben/types` 包 | `packages/types/` | P0 |
| 创建 `@viben/ui` 包 | `packages/ui/` | P0 |
| 从 desktop 迁移 UI 原语 | 10+ 组件 | P0 |
| 创建 Breadcrumb 组件 | `@viben/ui/breadcrumb` | P0 |
| 配置 Turbo 构建流水线 | `turbo.json` 更新 | P0 |

**验收标准**:
- [ ] `pnpm build` 成功构建所有包
- [ ] desktop 应用可从 `@viben/ui` 导入组件
- [ ] 类型检查通过

### Phase 2: Desktop 集成 (使用 Symlink)

**目标**: 在 desktop 应用中使用 vibe-kanban 组件（通过 symlink）

| 任务 | 交付物 | 优先级 |
|------|--------|--------|
| 添加 Workspace Kanban Tab | UI 入口 | P1 |
| 实现 `WorkspaceKanban` 容器 | 使用 `@viben/vibe-kanban` | P1 |
| 实现 `useWorkspaceKanban` hook | viben 特定状态管理 | P1 |
| 样式适配层 | CSS 变量映射 | P1 |
| 本地存储 (SQLite via Tauri) | 数据持久化 | P2 |
| 添加国际化支持 | i18n 翻译 | P2 |

**使用示例**:
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

**验收标准**:
- [ ] 可从 `@viben/vibe-kanban` 正确导入组件
- [ ] 可在工作空间中创建、编辑、删除任务
- [ ] 拖拽任务更新状态
- [ ] 数据持久化到本地
- [ ] 支持中英文

### Phase 3: 云同步与高级功能

**目标**: 实现云端同步和协作功能

| 任务 | 交付物 | 优先级 |
|------|--------|--------|
| 后端 Task API | REST 端点 | P3 |
| 云端同步机制 | 双向同步 | P3 |
| 实时协作 (可选) | WebSocket | P3 |
| 筛选与搜索 | 高级功能 | P3 |
| 性能优化 (虚拟滚动) | 大数据支持 | P3 |

---

## 目录结构总览 (Symlink 方案)

```
viben/
├── apps/
│   ├── desktop/
│   │   └── src/
│   │       ├── components/
│   │       │   ├── workspace/
│   │       │   │   └── workspace-kanban.tsx    # Kanban 容器 (业务逻辑)
│   │       │   └── layout/
│   │       │       └── ... (使用 @viben/ui)
│   │       └── hooks/
│   │           └── use-workspace-kanban.ts     # Kanban 业务 hook
│   └── web/
│       └── ... (也可使用 @viben/ui)
│
├── packages/
│   ├── vibe-kanban/            # ⭐ Symlink 到 vibe-kanban 项目
│   │   ├── package.json        # 包装配置
│   │   ├── index.ts            # 统一导出
│   │   ├── ui -> ../../../others/vibe-kanban/frontend/src/components/ui
│   │   ├── ui-new -> ../../../others/vibe-kanban/frontend/src/components/ui-new
│   │   ├── hooks -> ../../../others/vibe-kanban/frontend/src/hooks
│   │   ├── shared -> ../../../others/vibe-kanban/shared
│   │   └── lib -> ../../../others/vibe-kanban/frontend/src/lib
│   │
│   ├── ui/                     # 共享 UI 组件库 (viben 特有)
│   │   └── src/
│   │       ├── components/
│   │       │   ├── breadcrumb.tsx    # Notion 风格面包屑
│   │       │   ├── button.tsx
│   │       │   ├── card.tsx
│   │       │   └── ...
│   │       └── lib/
│   │           └── utils.ts
│   │
│   ├── types/                  # 共享类型定义 (viben 特有)
│   │   └── src/
│   │       ├── workspace.ts
│   │       ├── kanban.ts       # 扩展 vibe-kanban 类型
│   │       └── user.ts
│   │
│   ├── api-client/             # (existing)
│   └── cli/                    # (existing)
│
├── /Users/lxy/Documents/GitHub/others/vibe-kanban/  # 外部仓库 (symlink 源)
│   ├── frontend/
│   │   └── src/
│   │       ├── components/
│   │       │   ├── ui/                # shadcn/ui 基础组件
│   │       │   │   └── shadcn-io/
│   │       │   │       └── kanban/    # Kanban 核心组件
│   │       │   └── ui-new/            # 新设计组件
│   │       │       ├── containers/
│   │       │       ├── primitives/
│   │       │       └── views/
│   │       ├── hooks/                 # 90+ 自定义 hooks
│   │       └── lib/
│   └── shared/                        # 前后端共享类型
│
└── .trellis/spec/modules/
    └── kanban-integration.md          # 本文档
```

---

## Acceptance Criteria

### Symlink 设置
- [ ] `packages/vibe-kanban/` 目录存在且 symlink 有效
- [ ] `pnpm install` 成功，无 symlink 错误
- [ ] TypeScript 可正确解析 symlink 模块

### 组件集成
- [ ] `@viben/vibe-kanban` 可正确导入 Kanban 组件
- [ ] `@viben/ui` Breadcrumb 组件支持 Notion 风格导航
- [ ] Kanban 看板支持拖拽排序
- [ ] 样式适配到 Viben Design System
- [ ] 支持深色/浅色主题

### Desktop 应用
- [ ] 工作空间页面显示【任务看板】Tab
- [ ] 可在工作空间中创建、编辑、删除任务
- [ ] 任务数据持久化到本地
- [ ] 支持中英文国际化

---

## 参考资源

- [dnd-kit 文档](https://docs.dndkit.com/)
- [Viben Design System](../design-system.md)
- [Component Guidelines](../components.md)
- [聊天集成](../chat-integration.md)

---

**Last Updated**: 2026-02-06
**Version**: 3.0.0
**Status**: 📝 Architecture Specification (Symlink)

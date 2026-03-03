# Spec 文件整理实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 整理 .trellis/spec 目录，修复不一致性，更新状态标记，删除过时内容

**Architecture:** 分三阶段执行：(1) 修复结构问题 (2) 更新状态标记 (3) 补充缺失文档

**Tech Stack:** Markdown 文档，Bash 脚本

---

## 研究发现总结

### 当前状态

| 类别 | 文件数 | 完成 | 部分 | 待填充 | 问题 |
|------|--------|------|------|--------|------|
| Frontend | 11 | 8 | 0 | 3 | hook/type/quality guidelines 标记"To fill"但文件不存在 |
| Backend | 9 | 5 | 0 | 4 | 规格描述 Python，实际是 TypeScript |
| Guides | 4 | 4 | 0 | 0 | ✅ 完整 |
| Modules | 93 | ~65 | ~15 | ~13 | Social Chat 全是规格但零实现 |

### 发现的主要问题

1. **引用但不存在的文件**
   - `frontend/hook-guidelines.md`
   - `frontend/type-safety.md`
   - `frontend/quality-guidelines.md`
   - `kanban/project.md`, `kanban/task.md`, `kanban/workspace.md`, `kanban/session.md`, `kanban/git-operations.md`

2. **规格与实现不匹配**
   - Backend specs 描述 Python (stevedore, FastMCP)，实际用 TypeScript (Hono)
   - CLI `agent chat` 命令无实现
   - Marketplace Publish Flow 完整规格但零实现
   - Social Chat 6个规格全无实现

3. **状态标记不准确**
   - 部分标记 "Complete" 但实现只是部分
   - Kanban UI 存在但 backend 核心缺失

---

## Phase 1: 修复结构问题

### Task 1.1: 创建缺失的前端 placeholder 文件

**Files:**
- Create: `.trellis/spec/frontend/hook-guidelines.md`
- Create: `.trellis/spec/frontend/type-safety.md`
- Create: `.trellis/spec/frontend/quality-guidelines.md`

**Step 1: 创建 hook-guidelines.md**

```markdown
# Hook Guidelines

> Custom hooks and state management patterns for Viben frontend.

---

## Status: 📝 To Fill

This document needs to be populated with:

- [ ] Custom hooks naming conventions
- [ ] State management patterns (useState, useReducer, Zustand)
- [ ] Data fetching hooks (SWR/TanStack Query patterns)
- [ ] Memoization guidelines (useMemo, useCallback)
- [ ] Effect hooks best practices

---

## Placeholder Structure

### Naming Conventions
<!-- TODO: Document hook naming patterns -->

### State Management
<!-- TODO: Document state patterns -->

### Data Fetching
<!-- TODO: Document query/mutation patterns -->

### Performance
<!-- TODO: Document memoization guidelines -->

---

**Related:**
- [Component Guidelines](./components.md)
- [Type Safety](./type-safety.md)
```

**Step 2: 创建 type-safety.md**

```markdown
# Type Safety Guidelines

> TypeScript patterns and type definitions for Viben frontend.

---

## Status: 📝 To Fill

This document needs to be populated with:

- [ ] Type definition patterns
- [ ] Zod schema usage
- [ ] API type generation
- [ ] Generic component patterns
- [ ] Type narrowing best practices

---

## Placeholder Structure

### Type Definitions
<!-- TODO: Document type patterns -->

### Schema Validation
<!-- TODO: Document Zod usage -->

### API Types
<!-- TODO: Document type generation -->

### Generic Patterns
<!-- TODO: Document generic components -->

---

**Related:**
- [Component Guidelines](./components.md)
- [Hook Guidelines](./hook-guidelines.md)
```

**Step 3: 创建 quality-guidelines.md**

```markdown
# Frontend Quality Guidelines

> Code standards and forbidden patterns for Viben frontend.

---

## Status: 📝 To Fill

This document needs to be populated with:

- [ ] ESLint rules and configuration
- [ ] Forbidden patterns
- [ ] Performance requirements
- [ ] Accessibility standards
- [ ] Testing requirements

---

## Placeholder Structure

### Linting
<!-- TODO: Document ESLint configuration -->

### Forbidden Patterns
<!-- TODO: Document anti-patterns -->

### Performance
<!-- TODO: Document performance standards -->

### Accessibility
<!-- TODO: Document a11y requirements -->

### Testing
<!-- TODO: Document testing standards -->

---

**Related:**
- [Component Guidelines](./components.md)
- [Design System](./design-system.md)
```

**Step 4: 验证文件创建**

Run: `ls -la .trellis/spec/frontend/*.md`
Expected: 显示所有文件包括新创建的三个

**Step 5: Commit**

```bash
git add .trellis/spec/frontend/hook-guidelines.md
git add .trellis/spec/frontend/type-safety.md
git add .trellis/spec/frontend/quality-guidelines.md
git commit -m "docs(spec): add placeholder files for frontend guidelines"
```

---

### Task 1.2: 创建缺失的 Kanban module 文件

**Files:**
- Create: `.trellis/spec/modules/kanban/project.md`
- Create: `.trellis/spec/modules/kanban/task.md`
- Create: `.trellis/spec/modules/kanban/workspace.md`
- Create: `.trellis/spec/modules/kanban/session.md`
- Create: `.trellis/spec/modules/kanban/git-operations.md`

**Step 1: 创建 project.md**

```markdown
# Kanban Project Module

> 项目管理模块规范

---

## Status: 📝 Specification (Not Implemented)

Referenced from [Kanban Index](./index.md) but not yet implemented.

---

## Overview

项目 (Project) 是 Kanban 系统的顶层组织单位，对应一个代码仓库。

## Data Model

```typescript
interface Project {
  id: string;
  name: string;
  description?: string;
  repoPath: string;       // Git 仓库路径
  defaultBranch: string;  // 默认分支
  createdAt: Date;
  updatedAt: Date;
}
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/kanban/projects | 列出所有项目 |
| POST | /api/kanban/projects | 创建项目 |
| GET | /api/kanban/projects/:id | 获取项目详情 |
| PUT | /api/kanban/projects/:id | 更新项目 |
| DELETE | /api/kanban/projects/:id | 删除项目 |

---

**Related:**
- [Storage](./storage.md)
- [Task](./task.md)
```

**Step 2: 创建 task.md**

```markdown
# Kanban Task Module

> 任务管理模块规范

---

## Status: 📝 Specification (Not Implemented)

Referenced from [Kanban Index](./index.md) but not yet implemented.

---

## Overview

任务 (Task) 是 Kanban 系统的核心工作单位。

## Data Model

```typescript
interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  status: 'backlog' | 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignee?: string;
  branch?: string;        // 关联的 Git 分支
  createdAt: Date;
  updatedAt: Date;
}
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/kanban/tasks | 列出任务 |
| POST | /api/kanban/tasks | 创建任务 |
| GET | /api/kanban/tasks/:id | 获取任务详情 |
| PUT | /api/kanban/tasks/:id | 更新任务 |
| DELETE | /api/kanban/tasks/:id | 删除任务 |

---

**Related:**
- [Project](./project.md)
- [Git Operations](./git-operations.md)
```

**Step 3: 创建 workspace.md**

```markdown
# Kanban Workspace Module

> 工作区 (Worktree) 管理模块规范

---

## Status: 📝 Specification (Not Implemented)

Referenced from [Kanban Index](./index.md) but not yet implemented.

---

## Overview

工作区对应 Git Worktree，用于隔离不同任务的开发环境。

## Data Model

```typescript
interface Workspace {
  id: string;
  taskId: string;
  worktreePath: string;   // Git worktree 路径
  branch: string;
  status: 'active' | 'stale' | 'archived';
  createdAt: Date;
}
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/kanban/workspaces | 列出工作区 |
| POST | /api/kanban/workspaces | 创建工作区 |
| DELETE | /api/kanban/workspaces/:id | 删除工作区 |

---

**Related:**
- [Task](./task.md)
- [Git Operations](./git-operations.md)
```

**Step 4: 创建 session.md**

```markdown
# Kanban Session Module

> 会话管理模块规范

---

## Status: 📝 Specification (Not Implemented)

Referenced from [Kanban Index](./index.md) but not yet implemented.

---

## Overview

会话 (Session) 记录 AI Agent 与任务的交互历史。

## Data Model

```typescript
interface Session {
  id: string;
  taskId: string;
  workspaceId?: string;
  agentId: string;
  messages: Message[];
  startedAt: Date;
  endedAt?: Date;
}
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/kanban/sessions | 列出会话 |
| POST | /api/kanban/sessions | 创建会话 |
| GET | /api/kanban/sessions/:id | 获取会话详情 |

---

**Related:**
- [Task](./task.md)
- [Workspace](./workspace.md)
```

**Step 5: 创建 git-operations.md**

```markdown
# Kanban Git Operations Module

> Git 操作封装模块规范

---

## Status: 📝 Specification (Not Implemented)

Referenced from [Kanban Index](./index.md) but not yet implemented.

---

## Overview

封装 Git 操作，提供安全的分支管理和 worktree 操作。

## Operations

| Operation | Description |
|-----------|-------------|
| createBranch | 创建新分支 |
| checkoutBranch | 切换分支 |
| createWorktree | 创建 worktree |
| removeWorktree | 删除 worktree |
| commit | 提交变更 |
| push | 推送到远程 |

## Safety Rules

1. 禁止 force push 到 main/master
2. 禁止直接修改 main/master
3. 所有操作需要确认

---

**Related:**
- [Workspace](./workspace.md)
- [Task](./task.md)
```

**Step 6: 验证文件创建**

Run: `ls -la .trellis/spec/modules/kanban/*.md`
Expected: 显示所有 kanban 模块文件

**Step 7: Commit**

```bash
git add .trellis/spec/modules/kanban/
git commit -m "docs(spec): add placeholder files for kanban modules"
```

---

### Task 1.3: 更新 Kanban index 修复链接

**Files:**
- Modify: `.trellis/spec/modules/kanban/index.md`

**Step 1: 读取当前文件**

Run: `cat .trellis/spec/modules/kanban/index.md`
Expected: 查看当前内容

**Step 2: 更新 index 文件**

确保所有引用的文件都存在，状态标记准确反映实现情况。

**Step 3: Commit**

```bash
git add .trellis/spec/modules/kanban/index.md
git commit -m "docs(spec): update kanban index with correct links and status"
```

---

## Phase 2: 更新状态标记

### Task 2.1: 更新 Backend index 修正语言描述

**Files:**
- Modify: `.trellis/spec/backend/index.md`

**Issue:** 当前 index 没有明确说明实际使用 TypeScript 而非 Python

**Step 1: 读取当前 backend index**

Run: `cat .trellis/spec/backend/index.md`

**Step 2: 更新描述**

添加明确说明：Backend 使用 TypeScript (packages/core)，不是 Python。

**Step 3: Commit**

```bash
git add .trellis/spec/backend/index.md
git commit -m "docs(spec): clarify backend uses TypeScript not Python"
```

---

### Task 2.2: 更新 modules/index.md 状态标记

**Files:**
- Modify: `.trellis/spec/modules/index.md`

**Issue:** 部分标记 "Done" 但实现是部分的

**Step 1: 读取当前文件**

Run: `cat .trellis/spec/modules/index.md`

**Step 2: 识别需要修正的状态**

- Kanban 模块: 标记应该是 "Partial" 而非 "Done"
- Social Chat: 标记应该是 "Spec Only"
- Marketplace Publish: 添加说明"规格完成，未实现"

**Step 3: 更新状态标记**

修改不准确的状态标记。

**Step 4: Commit**

```bash
git add .trellis/spec/modules/index.md
git commit -m "docs(spec): update module status to reflect actual implementation"
```

---

### Task 2.3: 更新 Frontend index 添加实现状态

**Files:**
- Modify: `.trellis/spec/frontend/index.md`

**Issue:** Marketplace Publish Flow 标记 "Complete" 但未实现

**Step 1: 读取当前文件**

Run: `cat .trellis/spec/frontend/index.md`

**Step 2: 添加实现状态列**

在表格中添加 "Implementation" 列区分规格完成度和实现完成度。

**Step 3: Commit**

```bash
git add .trellis/spec/frontend/index.md
git commit -m "docs(spec): add implementation status to frontend index"
```

---

## Phase 3: 补充关键缺失文档

### Task 3.1: 创建 Backend quality-guidelines.md

**Files:**
- Create: `.trellis/spec/backend/quality-guidelines.md`

**Step 1: 创建文件**

```markdown
# Backend Quality Guidelines

> Code standards for packages/core TypeScript development.

---

## Status: 📝 To Fill

This document needs to be populated with:

- [ ] TypeScript strict mode requirements
- [ ] ESLint/Biome configuration
- [ ] Testing requirements
- [ ] Error handling patterns
- [ ] Performance guidelines

---

## Tech Stack

- **Language**: TypeScript 5.x
- **Runtime**: Node.js
- **Framework**: Hono (HTTP), Commander (CLI)
- **Build**: tsup
- **Lint**: ESLint / Biome

## Placeholder Sections

### TypeScript Configuration
<!-- TODO: Document tsconfig requirements -->

### Linting
<!-- TODO: Document lint rules -->

### Testing
<!-- TODO: Document test requirements -->

### Error Handling
<!-- TODO: Document error patterns -->

---

**Related:**
- [Directory Structure](./directory-structure.md)
- [API Module](./api-module.md)
```

**Step 2: Commit**

```bash
git add .trellis/spec/backend/quality-guidelines.md
git commit -m "docs(spec): add backend quality guidelines placeholder"
```

---

### Task 3.2: 创建实现进度总览文档

**Files:**
- Create: `.trellis/spec/IMPLEMENTATION_STATUS.md`

**Step 1: 创建总览文档**

```markdown
# Implementation Status Overview

> 规格与实现的对照总览，帮助识别 gap

---

## Last Updated: 2026-02-28

## Summary

| Category | Specs | Implemented | Partial | Not Started |
|----------|-------|-------------|---------|-------------|
| Core Infrastructure | 29 | 29 | 0 | 0 |
| Gateway API | 16 | 14 | 2 | 0 |
| CLI Commands | 15 | 8 | 4 | 3 |
| Frontend | 11 | 8 | 0 | 3 |
| Backend | 9 | 5 | 0 | 4 |
| Workspace | 17 | 6 | 8 | 3 |
| Kanban | 6 | 1 | 2 | 3 |
| Chat | 4 | 1 | 2 | 1 |
| Social Chat | 6 | 0 | 0 | 6 |

## Major Gaps

### High Priority (Spec exists, no implementation)

1. **Marketplace Publish Flow**
   - Spec: `.trellis/spec/frontend/marketplace-publish-flow.md` ✅
   - Implementation: ❌ None
   - Impact: Cannot publish MCP/Skills to marketplace

2. **Social Chat System**
   - Specs: `.trellis/spec/modules/social-chat/*.md` (6 files) ✅
   - Implementation: ❌ None
   - Impact: Major feature not available

3. **CLI Agent Chat**
   - Spec: `.trellis/spec/modules/cli/agent-chat.md` ✅
   - Implementation: ❌ None
   - Impact: Cannot run interactive AI agent from CLI

### Medium Priority (Partial implementation)

1. **Kanban Backend**
   - UI: ✅ Exists (`workspace-kanban.tsx`)
   - Backend: 🟡 Only `kanban-data.ts` for comments
   - Gap: Core CRUD missing

2. **WorkAny Migration**
   - Spec: `.trellis/spec/modules/chat/workany-migration.md`
   - Status: 🟡 Planning stage

## Spec-Only Features (No Implementation Planned)

These specs exist for documentation/future reference:
- Kanban Phases 3-8 (advanced features)

---

## How to Update This Document

1. After completing implementation, update status
2. After creating new spec, add entry
3. Run periodic review to catch drift
```

**Step 2: Commit**

```bash
git add .trellis/spec/IMPLEMENTATION_STATUS.md
git commit -m "docs(spec): add implementation status overview"
```

---

## Final Task: 验证整理结果

### Task Final: 验证所有修改

**Step 1: 检查所有引用链接**

Run: `grep -r "\](\./" .trellis/spec/ | grep -v node_modules`

**Step 2: 验证文件存在**

Run: `find .trellis/spec -name "*.md" | wc -l`
Expected: 文件数量应该增加

**Step 3: 运行 git status**

Run: `git status`
Expected: 所有新文件已 commit

**Step 4: 最终 Commit (如有遗漏)**

```bash
git add .trellis/spec/
git commit -m "docs(spec): complete spec organization and cleanup"
```

---

## Execution Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| Phase 1 | 1.1-1.3 | 创建缺失文件，修复断链 |
| Phase 2 | 2.1-2.3 | 更新状态标记，反映真实情况 |
| Phase 3 | 3.1-3.2 | 补充关键文档，创建总览 |
| Final | - | 验证整理结果 |

**Total estimated commits:** 7-8 个小 commit

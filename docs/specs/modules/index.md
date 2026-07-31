# Module Specifications Index

> Detailed specifications for each task in the Platform Upgrade v3.0.
> **Status: Core Web modules completed. Kanban/Chat modules in specification phase.**

---

## Overview

This directory contains detailed specifications for implementing each module of the Viben Platform. Each spec includes:

- Objectives and deliverables
- Code examples and API definitions
- Acceptance criteria
- Implementation notes

---

## Module List

### Phase 0: Foundation

| Module | Description | Effort | Status |
|--------|-------------|--------|--------|
| [project-setup.md](./infrastructure/project-setup.md) | T0: Next.js project initialization | 3 | Done |

### Phase 1: Core Infrastructure

| Module | Description | Effort | Status |
|--------|-------------|--------|--------|
| [database.md](./infrastructure/database.md) | T1: Drizzle schema and migrations | 3 | Done |
| [auth.md](./auth/auth.md) | T2: JWE session management | 3 | Done |
| [ui-shell.md](./infrastructure/ui-shell.md) | T3: Layout, navigation, theming | 2 | Done |

### Phase 2: User System

| Module | Description | Effort | Status |
|--------|-------------|--------|--------|
| [user-api.md](./auth/user-api.md) | T4: User CRUD, OAuth, API keys | 5 | Done |
| [auth-ui.md](./auth/auth-ui.md) | T7: Login, register pages | 3 | Done |
| [profile-ui.md](./auth/profile-ui.md) | T10: Profile page, API key management | 3 | Done |

### Phase 3: Marketplace Core

| Module | Description | Effort | Status |
|--------|-------------|--------|--------|
| [mcp-api.md](./marketplace/mcp-api.md) | T5: MCP package CRUD, search | 5 | Done |
| [skills-api.md](./marketplace/skills-api.md) | T6: Skills package CRUD, search | 5 | Done |
| [mcp-ui.md](./marketplace/mcp-ui.md) | T8: MCP marketplace pages | 5 | Done |
| [skills-ui.md](./marketplace/skills-ui.md) | T9: Skills marketplace pages | 5 | Done |

### Phase 4: Social & Storage

| Module | Description | Effort | Status |
|--------|-------------|--------|--------|
| [social-api.md](./marketplace/social-api.md) | T11: Favorites, comments, ratings | 3 | Done |
| [storage.md](./packages/storage.md) | T12: HuggingFace storage backend | 5 | Done |
| [packages.md](./packages/packages.md) | T13: Upload/download API | 5 | Done |

### Phase 5: Advanced Features

| Module | Description | Effort | Status |
|--------|-------------|--------|--------|
| [collections-api.md](./marketplace/collections-api.md) | T15: Collections CRUD | 3 | Done |
| [publish-ui.md](./marketplace/publish-ui.md) | T16: Package publish wizard | 3 | Done |
| [collections-ui.md](./marketplace/collections-ui.md) | T18: Collection pages | 3 | Done |
| [analytics-ui.md](./admin/analytics-ui.md) | T19: Download statistics | 2 | Done |

### Phase 6: Integration & Polish

| Module | Description | Effort | Status |
|--------|-------------|--------|--------|
| [desktop-integration.md](./desktop/desktop-integration.md) | T20: Desktop app API client | 3 | Done |
| [deployment.md](./infrastructure/deployment.md) | T21: Vercel deployment | 5 | Done |

### Phase 7: Admin System

| Module | Description | Effort | Status |
|--------|-------------|--------|--------|
| [admin-ui.md](./admin/admin-ui.md) | T22: Admin dashboard, package & content moderation | 8 | Done |

---

## Workspace System

> **Reorganized**: 工作区相关的规格已移至 `workspace/` 子目录

| Module | Description | Status |
|--------|-------------|--------|
| [workspace/](./workspace/) | **工作区模块索引** | - |
| [workspace/workspace-management.md](./workspace/workspace-management.md) | Desktop 多工作区系统 | Done |
| [workspace/workspace-api.md](./workspace/workspace-api.md) | Web Workspace CRUD API (T14) | Done |
| [workspace/workspace-ui.md](./workspace/workspace-ui.md) | Web Workspace UI (T17) | Done |
| [workspace/kanban-integration.md](./workspace/kanban-integration.md) | Kanban 整体架构 | Specification |
| [workspace/kanban-features.md](./workspace/kanban-features.md) | Kanban 核心功能 | Specification |
| [workspace/kanban-phase3.md](./workspace/kanban-phase3.md) | Kanban 高级功能 | Planning |
| [workspace/kanban-phase4.md](./workspace/kanban-phase4.md) | Kanban 协作功能 | Planning |
| [workspace/kanban-phase5.md](./workspace/kanban-phase5.md) | Kanban 自动化 | Planning |
| [workspace/kanban-phase6.md](./workspace/kanban-phase6.md) | Kanban 视图报告 | Planning |
| [workspace/kanban-phase7.md](./workspace/kanban-phase7.md) | Kanban AI 集成 | Planning |
| [workspace/kanban-phase8.md](./workspace/kanban-phase8.md) | Kanban 高级定制 | Planning |
| [workspace/vibe-kanban-architecture.md](./workspace/vibe-kanban-architecture.md) | vibe-kanban 前端架构分析 | Reference |
| [workspace/desktop-kanban-integration-progress.md](./workspace/desktop-kanban-integration-progress.md) | Desktop Kanban 集成进度 | Report |
| [workspace/desktop-chat-workany.md](./workspace/desktop-chat-workany.md) | Chat 功能集成 | Planning |

---

## Chat System (Agent 对话)

> **新增**: WorkAny 核心功能迁移 - 智能体对话、SSE 流式通信、后台任务

| Module | Description | Status |
|--------|-------------|--------|
| [chat/](./chat/) | **Chat 模块索引** | - |
| [chat/workany-migration.md](./chat/workany-migration.md) | WorkAny 核心功能迁移规范 | 🟡 规划中 |
| [chat/agent-hooks-spec.md](./chat/agent-hooks-spec.md) | Agent Hooks 统一架构规范 | ✅ Done |
| [chat/sse-streaming.md](./chat/sse-streaming.md) | SSE 流式通信规范 | 🟡 规划中 |
| [chat/background-tasks.md](./chat/background-tasks.md) | 后台任务管理规范 | 🟡 规划中 |

---

## Social Chat System

> **新增**: Desktop 社交聊天功能，类微信设计
>
> ⚠️ **Note**: 所有规格已完成，但**尚未实现**。

| Module | Description | Status |
|--------|-------------|--------|
| [social-chat/](./social-chat/) | **社交聊天模块索引** | - |
| [social-chat/chat-prd.md](./social-chat/chat-prd.md) | 聊天页面 PRD | ✅ Done |
| [social-chat/contacts-prd.md](./social-chat/contacts-prd.md) | 联系人页面 PRD | ✅ Done |
| [social-chat/agent-team-prd.md](./social-chat/agent-team-prd.md) | 智能体团队 PRD | ✅ Done |
| [social-chat/chat-spec.md](./social-chat/chat-spec.md) | 聊天功能开发规范 | ✅ Done |
| [social-chat/contacts-spec.md](./social-chat/contacts-spec.md) | 联系人功能开发规范 | ✅ Done |
| [social-chat/data-model.md](./social-chat/data-model.md) | 数据模型设计 | ✅ Done |

---

## Kanban System (vibe-kanban 迁移)

> **新增**: 将 vibe-kanban 核心功能迁移到 packages/core，使用基于文件的存储
>
> ⚠️ **Note**: UI 已实现 (`workspace-kanban.tsx`)，后端核心模块尚未实现。

| Module | Description | Status |
|--------|-------------|--------|
| [kanban/](./kanban/) | **Kanban 模块索引** | - |
| [kanban/storage.md](./kanban/storage.md) | 文件存储系统设计 | Specification |
| [kanban/project.md](./kanban/project.md) | 项目管理模块 | Specification |
| [kanban/task.md](./kanban/task.md) | 任务管理模块 | Specification |
| [kanban/workspace.md](./kanban/workspace.md) | 工作区 (Worktree) 管理 | Specification |
| [kanban/session.md](./kanban/session.md) | 会话管理模块 | Specification |
| [kanban/git-operations.md](./kanban/git-operations.md) | Git 操作封装 | Specification |

**迁移参考**: [docs/kanban/README.md](/docs/kanban/README.md) - vibe-kanban 端点详细分析

---

## Desktop MCP Services

> **新增**: 桌面应用 MCP 服务集成

| Module | Description | Status |
|--------|-------------|--------|
| [desktop-page-debug-mcp.md](./desktop/desktop-page-debug-mcp.md) | 页面调试 MCP - Tauri WebView 自动调试 | 📝 规划中 |
| [desktop-navigation.md](./desktop/desktop-navigation.md) | Desktop 全局面包屑、Tab-first 导航、虚拟页面索引 | 📝 规划中 |

---

## Cross-Cutting Concerns

| Module | Description | Effort | Status |
|--------|-------------|--------|--------|
| [cli-app.md](./cli-app.md) | Bootstrap CLI: config, service, agent/mcp/skill management | 8 | Specification |
| [desktop-creator-section.md](./desktop/desktop-creator-section.md) | Desktop 创作者章节 (Publish, My Packages, Analytics) | 3 | Specification |

---

## Shared Packages

| Package | Description | Priority | Status |
|---------|-------------|----------|--------|
| [package-ui.md](./packages/package-ui.md) | `@viben/ui` - 共享 UI 组件库 | P0 | Done |
| [package-kanban.md](./packages/package-kanban.md) | `@viben/kanban` - Kanban 核心组件 | P1 | Specification |

---

## Quick Reference

### Critical Path (COMPLETED)

```
T0 → T1 → T4 → T5 → T11 → T13 → T16 → T21
```

### Parallel Groups (ALL COMPLETED)

| Group | Tasks | Status |
|-------|-------|--------|
| G1 | T1, T2, T3 | Done |
| G2 | T5, T6, T7 | Done |
| G3 | T8, T9, T10 | Done |
| G4 | T11, T12 | Done |
| G5 | T14, T15, T16 | Done |
| G6 | T17, T18, T19, T20 | Done |

---

## How to Use These Specs

These specs serve as reference documentation for the implemented features:

1. **Understanding architecture**: Read specs to understand design decisions
2. **Maintaining code**: Follow patterns established in specs
3. **Adding features**: Use specs as templates for new modules

### For Workspace Features

Start with the [workspace/index.md](./workspace/index.md) which provides:
- Platform distinction (Desktop vs Web)
- Core specs overview
- Kanban implementation phases
- Quick navigation links

---

## Related Documents

- [Platform Upgrade v3.0](../roadmap/platform-upgrade-v2.md) - Master planning document
- [Task DAG](../roadmap/desktop-task-dag.md) - Task dependency graph
- [Backend Guidelines](../backend/index.md) - Development standards
- [Frontend Guidelines](../frontend/index.md) - UI/UX standards

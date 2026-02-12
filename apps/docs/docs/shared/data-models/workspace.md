# Workspace Module Specifications

> 工作空间相关的所有规格文档索引

---

## Platform Distinction

> **Important**: 本项目有两个不同的 "workspace" 概念：

| Aspect | Desktop Workspace | Web Workspace |
|--------|-------------------|---------------|
| **Platform** | apps/desktop (Tauri) | apps/web (Next.js) |
| **Definition** | 本地文件夹 + 智能体配置 | 云端协作空间 |
| **Storage** | SQLite + 本地文件系统 | PostgreSQL |
| **Features** | MCP, Skills, Chat, Kanban | 包管理, 成员管理 |
| **Agent Support** | .claude/, .codex/, .cursor/ | N/A |

---

## Core Specifications

### Desktop Workspace System (Primary)

| Spec | Description | Status |
|------|-------------|--------|
| [workspace-management.md](./workspace-management.md) | Desktop 工作空间核心架构 | Done |
| [desktop-chat-workany.md](./desktop-chat-workany.md) | Chat 功能集成 (参考 workany) | Planning |

### Web Workspace System

| Spec | Description | Status |
|------|-------------|--------|
| [workspace-api.md](./workspace-api.md) | Web 端 Workspace CRUD API | Done |
| [workspace-ui.md](./workspace-ui.md) | Web 端 Workspace UI 页面 | Done |

---

## Kanban System

> 工作空间内的任务看板功能 (Desktop Only)

### Architecture & Analysis

| Spec | Description | Status |
|------|-------------|--------|
| [kanban-integration.md](./kanban-integration.md) | Kanban 整体架构 + 包设计 | Specification |
| [kanban-features.md](./kanban-features.md) | 核心功能规格 (Phase 1-2) | Specification |
| [vibe-kanban-architecture.md](./vibe-kanban-architecture.md) | vibe-kanban 前端架构深度分析 | Reference |
| [desktop-kanban-integration-progress.md](./desktop-kanban-integration-progress.md) | Desktop 集成进度报告 (~75%) | Report |

### Implementation Phases

| Phase | Spec | Focus | Status |
|-------|------|-------|--------|
| P3 | [kanban-phase3.md](./kanban-phase3.md) | 高级功能 (快速创建, 键盘导航, 统计) | Planning |
| P4 | [kanban-phase4.md](./kanban-phase4.md) | 协作功能 | Planning |
| P5 | [kanban-phase5.md](./kanban-phase5.md) | 自动化 + 集成 | Planning |
| P6 | [kanban-phase6.md](./kanban-phase6.md) | 视图 + 报告 | Planning |
| P7 | [kanban-phase7.md](./kanban-phase7.md) | AI 集成 | Planning |
| P8 | [kanban-phase8.md](./kanban-phase8.md) | 高级定制 | Planning |

---

## Relationship Diagram

```
Desktop App
└── Workspace Management
    ├── Global Workspace (~/)
    │   └── Agents (.claude/, .codex/, .cursor/)
    │       ├── MCP Servers
    │       └── Skills
    └── Custom Workspaces (project folders)
        ├── Agents (local configs)
        │   ├── MCP Servers
        │   └── Skills
        ├── Chat ← desktop-chat-workany
        └── Kanban ← kanban-*

Web App
└── Workspaces (cloud)
    ├── Packages (MCP/Skills)
    ├── Members
    └── Settings
```

---

## Quick Links

- **Adding new workspace features**: Start with [workspace-management.md](./workspace-management.md)
- **Kanban development**: Start with [kanban-integration.md](./kanban-integration.md)
- **Chat integration**: See [desktop-chat-workany.md](./desktop-chat-workany.md)
- **Web workspace API**: See [workspace-api.md](./workspace-api.md)

---

## Related Specs

- [../desktop-integration.md](../desktop-integration.md) - Desktop app 整体架构
- [../package-kanban.md](../package-kanban.md) - @viben/kanban 包规格
- [../../frontend/vibe-kanban-layout-architecture.md](../../frontend/vibe-kanban-layout-architecture.md) - Kanban 布局架构

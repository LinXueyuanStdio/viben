# Kanban 模块规范

> 将 vibe-kanban 核心功能迁移到 packages/core，集成到 Desktop 工作空间看板页面

---

## 架构概述

```
┌─────────────────────────────────────────────────────────────┐
│                    Desktop App (Tauri)                       │
├─────────────────────────────────────────────────────────────┤
│  Workspace → Kanban Page                                     │
│      ↓                                                       │
│  packages/core/src/kanban/                                   │
│      ├── models/          # 数据模型 + 文件存储              │
│      ├── services/        # 业务逻辑服务                      │
│      └── api/             # Gateway API 路由                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 核心设计原则

### 1. 基于文件的存储 (File-Native)

**不使用数据库**，所有数据以 YAML/JSON 文件形式存储在工作空间目录下：

```
<workspace>/.viben/kanban/
├── config.yaml              # 看板配置
├── projects/                # 项目目录
│   └── <project-id>/
│       ├── project.yaml     # 项目元数据
│       ├── tasks/           # 任务目录
│       │   └── <task-id>.yaml
│       └── tags.yaml        # 项目标签
├── workspaces/              # 工作区 (Git Worktree)
│   └── <workspace-id>/
│       ├── workspace.yaml   # 工作区配置
│       └── sessions/        # 会话存储
│           └── <session-id>/
│               ├── config.yaml
│               └── messages.jsonl
└── scratch/                 # 草稿存储
    └── <type>/<id>.yaml
```

### 2. 本地优先

- 仅考虑本地操作、容器操作和 GitHub 公开 API
- 不实现远程同步、组织管理等云端功能
- OAuth 用于 GitHub API 访问（可选）

### 3. 与 Agent 系统集成

看板任务可以关联到 Agent 执行：

```yaml
# task.yaml
id: "task-123"
title: "实现登录功能"
status: "in_progress"
agent_execution:
  agent_id: "main"
  session_id: "session-abc"
  workspace_id: "ws-xyz"
```

---

## 规范文档

### 核心模块

| 文档 | 描述 | 优先级 |
|------|------|--------|
| [storage.md](./storage.md) | 文件存储系统设计 | P0 |
| [project.md](./project.md) | 项目管理模块 | P1 |
| [task.md](./task.md) | 任务管理模块 | P1 |
| [workspace.md](./workspace.md) | 工作区 (Worktree) 管理 | P1 |
| [session.md](./session.md) | 会话管理模块 | P1 |

### API 路由

| 文档 | 描述 | 优先级 |
|------|------|--------|
| [api-projects.md](./api-projects.md) | 项目 API | P1 |
| [api-tasks.md](./api-tasks.md) | 任务 API | P1 |
| [api-workspaces.md](./api-workspaces.md) | 工作区 API | P2 |
| [api-sessions.md](./api-sessions.md) | 会话 API | P2 |

### 辅助模块

| 文档 | 描述 | 优先级 |
|------|------|--------|
| [git-operations.md](./git-operations.md) | Git 操作封装 | P2 |
| [search.md](./search.md) | 文件搜索 | P2 |
| [tags.md](./tags.md) | 标签管理 | P3 |
| [scratch.md](./scratch.md) | 草稿存储 | P3 |
| [approvals.md](./approvals.md) | 审批工作流 | P3 |

---

## 迁移来源

vibe-kanban 端点分析参考已移至内部文档。

### 迁移优先级

| 优先级 | 模块 | 状态 |
|--------|------|------|
| P0 | health, events, terminal | 已有对应 |
| P1 | config, tasks, sessions, execution_processes | 待迁移 |
| P2 | projects, repo, task_attempts, containers, search, filesystem | 待迁移 |
| P3 | images, tags, scratch, approvals | 可选 |

---

## 实现位置

```
packages/core/
├── src/
│   ├── kanban/                    # Kanban 核心模块
│   │   ├── index.ts               # 模块入口
│   │   ├── models/                # 数据模型
│   │   │   ├── project.ts
│   │   │   ├── task.ts
│   │   │   ├── workspace.ts
│   │   │   └── session.ts
│   │   ├── services/              # 业务服务
│   │   │   ├── project-service.ts
│   │   │   ├── task-service.ts
│   │   │   ├── workspace-service.ts
│   │   │   └── git-service.ts
│   │   └── storage/               # 文件存储
│   │       ├── file-store.ts
│   │       └── yaml-parser.ts
│   └── gateway/
│       └── routes/
│           ├── kanban/            # Kanban API 路由
│           │   ├── projects.ts
│           │   ├── tasks.ts
│           │   ├── workspaces.ts
│           │   └── sessions.ts
│           └── index.ts           # 路由注册
```

---

## 与现有系统的关系

```
packages/core
├── agents/          # Agent 管理 (已有)
├── executors/       # 执行器 (已有)
├── sessions/        # Agent 会话 (已有)
├── gateway/         # API Gateway (已有)
│   └── routes/
│       ├── agents.ts       # Agent API (已有)
│       ├── sessions.ts     # Session API (已有)
│       └── kanban/         # Kanban API (新增)
│           ├── projects.ts
│           ├── tasks.ts
│           └── workspaces.ts
└── kanban/          # Kanban 核心 (新增)
    ├── models/
    ├── services/
    └── storage/
```

---

## 关键差异适配

### vibe-kanban vs viben-core

| 方面 | vibe-kanban | viben-core (目标) |
|------|-------------|------------------|
| 存储 | SQLite 数据库 | YAML/JSON 文件 |
| 响应格式 | `ApiResponse<T>` | 直接 `Json<T>` |
| 状态类型 | `DeploymentImpl` | `AppState` |
| 路由参数 | `/{id}` | `:id` |
| 中间件 | Extension 加载实体 | Handler 内查询 |

---

## Related Documents

- [cli/agent.md](../cli/agent.md) - Agent 模块规范 (存储设计参考)
- [workspace/kanban-integration.md](../workspace/kanban-integration.md) - Desktop 集成规划

---
sidebar_position: 15
title: "Kanban API"
description: "Kanban board API for task visualization"
---

# Kanban API

> 任务看板功能 API

## 概述

任务看板功能基于已有的 Viben 数据模型实现，不需要单独的 kanban 数据存储：

- **Workspace** = Kanban Project（工作区即项目）
- **Background Tasks** = Kanban Task（后台运行的 Agent 任务即看板任务）

## 数据复用

| Kanban 概念 | Viben 已有实现 | API 端点 |
|------------|---------------|---------|
| Project | Workspace | `GET /api/workspaces` |
| Task | Background Task | `GET /api/agent/tasks/subscribe` (SSE) |
| Stop Task | Stop Task | `POST /api/agent/tasks/:taskId/stop` |

## 相关 API

### Workspace API

```
GET /api/workspaces
```

返回所有工作区，包括全局工作区。

### Background Tasks API

```
GET /api/agent/tasks/subscribe  (SSE)
```

订阅后台任务状态更新。返回格式：

```json
{
  "type": "tasks",
  "tasks": [
    {
      "taskId": "uuid",
      "sessionId": "agent-session-uuid",
      "prompt": "用户输入",
      "status": "running",
      "startedAt": "ISO timestamp",
      "completedAt": "ISO timestamp (optional)",
      "cost": 0.001,
      "duration": 1234
    }
  ]
}
```

**任务状态**:

| 状态 | 说明 |
|------|------|
| `running` | 运行中 |
| `completed` | 已完成 |
| `error` | 错误 |
| `cancelled` | 已取消 |

```
POST /api/agent/tasks/:taskId/stop
```

停止后台任务。

## 看板列映射

| 列名 | Background Task Status |
|-----|----------------------|
| 进行中 (In Progress) | `running` |
| 已完成 (Done) | `completed` |
| 错误 (Error) | `error` |
| 已取消 (Cancelled) | `cancelled` |

## 前端集成

前端使用以下 hooks 获取 kanban 数据：

1. `useLocalWorkspaces()` - 获取工作区列表作为项目
2. `useBackgroundTasks()` - 获取后台任务作为看板任务

## 相关端点

- [任务 API](./tasks.md) - 任务管理
- [智能体 API](./agents.md) - 智能体管理

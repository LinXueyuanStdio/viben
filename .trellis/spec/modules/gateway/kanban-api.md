# Gateway Kanban API 规格

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

## 已有 API

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
      "status": "running" | "completed" | "error" | "cancelled",
      "startedAt": "ISO timestamp",
      "completedAt": "ISO timestamp (optional)",
      "cost": 0.001,
      "duration": 1234
    }
  ]
}
```

```
POST /api/agent/tasks/:taskId/stop
```

停止后台任务。

## 前端适配方案

### 当前状态

前端 `workspace-kanban.tsx` 使用 `use-vibe-kanban.ts` hook 连接独立的 vibe-kanban 后端。

### 目标状态

修改前端直接使用：
1. `useLocalWorkspaces()` - 获取工作区列表作为项目
2. `useBackgroundTasks()` - 获取后台任务作为看板任务
3. 移除对 vibe-kanban 后端的依赖

### 看板列映射

| 列名 | Background Task Status |
|-----|----------------------|
| 进行中 (In Progress) | `running` |
| 已完成 (Done) | `completed` |
| 错误 (Error) | `error` |
| 已取消 (Cancelled) | `cancelled` |

### 需要修改的文件

1. `apps/desktop/src/pages/workspace-kanban.tsx`
   - 移除 `useVibeKanbanProjects`, `useVibeKanbanTasks`
   - 使用 `useLocalWorkspaces()` 获取工作区
   - 使用 `useBackgroundTasks()` 获取后台任务
   - 适配 UI 显示后台任务状态

2. `apps/desktop/src/hooks/use-background-tasks.ts`
   - 添加按工作区过滤功能

## 实现计划

### Phase 1: 添加工作区过滤

在 `BackgroundTask` 中添加 `workspacePath` 字段，支持按工作区过滤任务。

需要修改：
- `packages/core/src/services/background-tasks.ts` - 添加 workspacePath 字段
- `packages/core/src/gateway/routes/agent-run.ts` - 传递 workspacePath

### Phase 2: 前端适配

修改 `workspace-kanban.tsx` 使用已有的 hooks。

### Phase 3: 移除旧代码

移除不再需要的 vibe-kanban 相关代码：
- `apps/desktop/src/lib/vibe-kanban/`
- `apps/desktop/src/hooks/use-vibe-kanban.ts`
- `packages/core/src/services/kanban.ts`
- `packages/core/src/gateway/routes/kanban.ts`

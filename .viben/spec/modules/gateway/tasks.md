# 任务 API

> `/api/tasks` - 任务管理端点

## 概述

任务 API 提供任务的创建、查询、更新和删除功能。

## 端点列表

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/tasks` | 列出所有任务 |
| POST | `/api/tasks` | 创建任务 |
| GET | `/api/tasks/:id` | 获取任务详情 |
| PATCH | `/api/tasks/:id` | 更新任务 |
| DELETE | `/api/tasks/:id` | 删除任务 |

---

## 详细说明

### GET /api/tasks

列出所有任务。

**响应**:

```json
{
  "tasks": [
    {
      "id": "task-abc123",
      "title": "Implement user authentication",
      "description": "Add login/logout functionality",
      "status": "in_progress",
      "agent_id": "CLAUDE_CODE",
      "created_at": "2024-01-16T10:00:00Z",
      "updated_at": "2024-01-16T14:30:00Z"
    }
  ]
}
```

---

### POST /api/tasks

创建新任务。

**请求体**:

```json
{
  "title": "Implement user authentication",
  "description": "Add login/logout functionality",
  "agent_id": "CLAUDE_CODE"
}
```

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| title | string | ✓ | 任务标题 |
| description | string | 否 | 任务描述 |
| agent_id | string | 否 | 分配的智能体 |

**响应**:

```json
{
  "id": "task-abc123",
  "title": "Implement user authentication",
  "description": "Add login/logout functionality",
  "status": "pending",
  "created_at": "2024-01-16T10:00:00Z"
}
```

---

### GET /api/tasks/:id

获取任务详情。

**响应**:

```json
{
  "id": "task-abc123",
  "title": "Implement user authentication",
  "description": "Add login/logout functionality",
  "status": "in_progress",
  "agent_id": "CLAUDE_CODE",
  "sessions": [
    {
      "id": "session-xyz",
      "status": "active",
      "message_count": 15
    }
  ],
  "created_at": "2024-01-16T10:00:00Z",
  "updated_at": "2024-01-16T14:30:00Z"
}
```

---

### PATCH /api/tasks/:id

更新任务。

**请求体**:

```json
{
  "title": "Updated title",
  "description": "Updated description",
  "status": "completed",
  "agent_id": "my-agent"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| title | string | 任务标题 |
| description | string | 任务描述 |
| status | string | 任务状态 |
| agent_id | string | 分配的智能体 |

---

### DELETE /api/tasks/:id

删除任务。

**响应**:

```json
{
  "success": true
}
```

---

## 任务状态

| 状态 | 说明 |
|------|------|
| pending | 待处理 |
| in_progress | 进行中 |
| completed | 已完成 |
| failed | 已失败 |
| cancelled | 已取消 |

---

## 事件通知

任务状态变化时会发送事件：

```json
{
  "type": "TaskStatusChanged",
  "data": {
    "task_id": "task-abc123",
    "old_status": "pending",
    "new_status": "in_progress",
    "timestamp": "2024-01-16T10:00:00Z"
  }
}
```

---

## 相关端点

- [会话 API](./sessions.md) - 会话管理
- [智能体 API](./agents.md) - 智能体管理

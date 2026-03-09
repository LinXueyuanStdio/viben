# 会话 API

> `/api/sessions` - 会话管理端点

## 概述

会话 API 提供独立的会话管理功能，用于任务执行和智能体交互。

## 端点列表

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/sessions` | 列出会话 |
| POST | `/api/sessions` | 创建会话 |
| GET | `/api/sessions/:id` | 获取会话详情 |
| PATCH | `/api/sessions/:id` | 更新会话 |
| DELETE | `/api/sessions/:id` | 删除会话 |
| POST | `/api/sessions/:id/message` | 发送消息 |

---

## 详细说明

### GET /api/sessions

列出会话。

**查询参数**:

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| task_id | string | 否 | 按任务过滤 |
| agent_id | string | 否 | 按智能体过滤 |
| status | string | 否 | 按状态过滤 |

**响应**:

```json
{
  "sessions": [
    {
      "id": "session-abc123",
      "agent_id": "CLAUDE_CODE",
      "task_id": "task-xyz",
      "status": "active",
      "created_at": "2024-01-16T10:00:00Z",
      "last_active": "2024-01-16T14:30:00Z",
      "message_count": 42
    }
  ]
}
```

---

### POST /api/sessions

创建新会话。

**请求体**:

```json
{
  "agent_id": "CLAUDE_CODE",
  "task_id": "task-xyz",
  "prompt": "Initial prompt for the session"
}
```

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| agent_id | string | ✓ | 智能体 ID |
| task_id | string | 否 | 关联任务 ID |
| prompt | string | 否 | 初始提示词 |

**响应**:

```json
{
  "id": "session-abc123",
  "agent_id": "CLAUDE_CODE",
  "task_id": "task-xyz",
  "status": "created",
  "created_at": "2024-01-16T10:00:00Z"
}
```

---

### GET /api/sessions/:id

获取会话详情。

**响应**:

```json
{
  "id": "session-abc123",
  "agent_id": "CLAUDE_CODE",
  "task_id": "task-xyz",
  "status": "active",
  "created_at": "2024-01-16T10:00:00Z",
  "last_active": "2024-01-16T14:30:00Z",
  "message_count": 42,
  "data": {
    "workdir": "/path/to/project",
    "model": "claude-3-sonnet"
  }
}
```

---

### PATCH /api/sessions/:id

更新会话。

**请求体**:

```json
{
  "status": "paused",
  "data": {
    "notes": "Paused for review"
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| status | string | 会话状态 |
| data | object | 会话数据 |
| prompt | string | 更新提示词 |

---

### POST /api/sessions/:id/message

向会话发送消息。

**请求体**:

```json
{
  "content": "Please continue with the implementation"
}
```

**响应**:

```json
{
  "message_id": "msg-xyz",
  "status": "sent",
  "timestamp": "2024-01-16T14:35:00Z"
}
```

---

## 会话状态

| 状态 | 说明 |
|------|------|
| created | 刚创建 |
| active | 活跃中 |
| paused | 已暂停 |
| completed | 已完成 |
| failed | 已失败 |

---

## 相关端点

- [任务 API](./tasks.md) - 任务管理
- [智能体 API](./agents.md) - 智能体管理

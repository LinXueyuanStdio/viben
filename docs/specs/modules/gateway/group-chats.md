# 群聊 API

> `/api/group-chats` - 群聊管理端点

## 概述

群聊 API 提供多智能体协作聊天功能，支持多个智能体在同一会话中协同工作。

## 端点列表

### 群聊 CRUD

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/group-chats` | 列出群聊 |
| POST | `/api/group-chats` | 创建群聊 |
| GET | `/api/group-chats/:id` | 获取群聊详情 |
| PATCH | `/api/group-chats/:id` | 更新群聊 |
| DELETE | `/api/group-chats/:id` | 删除群聊 |

### 成员管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/group-chats/:id/members` | 列出成员 |
| POST | `/api/group-chats/:id/members` | 添加成员 |
| DELETE | `/api/group-chats/:id/members/:mid` | 移除成员 |

### 会话管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/group-chats/:id/sessions` | 列出会话 |
| POST | `/api/group-chats/:id/sessions` | 创建会话 |
| GET | `/api/group-chats/:id/sessions/:sid` | 获取会话详情 |
| PATCH | `/api/group-chats/:id/sessions/:sid` | 更新会话 |
| DELETE | `/api/group-chats/:id/sessions/:sid` | 删除会话 |
| GET | `/api/group-chats/:id/sessions/:sid/agents` | 列出会话智能体 |

### 消息管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/group-chats/:id/sessions/:sid/messages` | 列出消息 |
| POST | `/api/group-chats/:id/sessions/:sid/messages` | 发送消息 |

### 文件管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/group-chats/:id/files` | 列出文件 |
| POST | `/api/group-chats/:id/files` | 上传文件 |
| GET | `/api/group-chats/:id/files/:name` | 下载文件 |
| DELETE | `/api/group-chats/:id/files/:name` | 删除文件 |

### 图片管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/group-chats/:id/pictures` | 列出图片 |
| POST | `/api/group-chats/:id/pictures` | 上传图片 |
| GET | `/api/group-chats/:id/pictures/:name` | 下载图片 |
| DELETE | `/api/group-chats/:id/pictures/:name` | 删除图片 |

### WebSocket

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/group-chats/:id/sessions/:sid/ws` | WebSocket 连接 |

---

## 详细说明

### GET /api/group-chats

列出群聊。

**查询参数**:

| 参数 | 类型 | 必需 | 默认 | 说明 |
|------|------|------|------|------|
| workspace_path | string | 否 | - | 工作区路径 |
| include_global | bool | 否 | true | 包含全局群聊 |
| created_by | string | 否 | - | 按创建者过滤 |

**响应**:

```json
{
  "group_chats": [
    {
      "id": "gc-abc123",
      "name": "Project Discussion",
      "description": "Discuss project implementation",
      "workspace_path": "/path/to/project",
      "created_at": "2024-01-01T10:00:00Z",
      "member_count": 3,
      "session_count": 2
    }
  ]
}
```

---

### POST /api/group-chats

创建群聊。

**请求体**:

```json
{
  "name": "Project Discussion",
  "description": "Discuss project implementation",
  "workspace_path": "/path/to/project",
  "members": [
    {
      "agent_id": "CLAUDE_CODE",
      "role": "developer"
    },
    {
      "agent_id": "my-reviewer",
      "role": "reviewer"
    }
  ]
}
```

---

### GET /api/group-chats/:id

获取群聊详情。

**响应**:

```json
{
  "id": "gc-abc123",
  "name": "Project Discussion",
  "description": "Discuss project implementation",
  "workspace_path": "/path/to/project",
  "created_at": "2024-01-01T10:00:00Z",
  "updated_at": "2024-01-01T14:00:00Z",
  "members": [
    {
      "id": "member-1",
      "agent_id": "CLAUDE_CODE",
      "role": "developer",
      "joined_at": "2024-01-01T10:00:00Z"
    },
    {
      "id": "member-2",
      "agent_id": "my-reviewer",
      "role": "reviewer",
      "joined_at": "2024-01-01T10:00:00Z"
    }
  ],
  "session_count": 2
}
```

---

### GET /api/group-chats/:id/sessions/:sid/messages

列出会话消息。支持多视图。

**查询参数**:

| 参数 | 类型 | 必需 | 默认 | 说明 |
|------|------|------|------|------|
| view | string | 否 | ui | 视图类型: `ui` 或 `agent` |
| agent_id | string | 条件 | - | 智能体 ID (view=agent 时必需) |
| limit | int | 否 | 50 | 返回消息数 |
| before | string | 否 | - | 分页游标 |

**视图类型**:

- **ui**: 用户友好视图，适合前端渲染
- **agent**: 智能体视图，包含原始消息和工具调用

**响应 (ui 视图)**:

```json
{
  "messages": [
    {
      "id": "msg-1",
      "sender": {
        "type": "user",
        "name": "User"
      },
      "content": "Please review this code",
      "timestamp": "2024-01-01T10:00:00Z"
    },
    {
      "id": "msg-2",
      "sender": {
        "type": "agent",
        "agent_id": "CLAUDE_CODE",
        "name": "Claude Code"
      },
      "content": "I'll review the code...",
      "timestamp": "2024-01-01T10:00:05Z",
      "status": "completed"
    }
  ],
  "has_more": false
}
```

**响应 (agent 视图)**:

```json
{
  "messages": [
    {
      "id": "msg-1",
      "role": "user",
      "content": "Please review this code"
    },
    {
      "id": "msg-2",
      "role": "assistant",
      "content": "I'll review the code...",
      "tool_calls": [
        {
          "id": "call-1",
          "type": "Read",
          "parameters": {"file_path": "/src/main.ts"},
          "result": "..."
        }
      ]
    }
  ]
}
```

---

### POST /api/group-chats/:id/sessions/:sid/messages

发送消息到群聊。自动触发所有智能体响应。

**请求体**:

```json
{
  "content": "Please implement this feature",
  "attachments": [
    {
      "type": "file",
      "name": "spec.md"
    }
  ]
}
```

**响应**:

```json
{
  "message_id": "msg-abc123",
  "triggered_agents": ["CLAUDE_CODE", "my-reviewer"]
}
```

---

### GET /api/group-chats/:id/sessions/:sid/ws

WebSocket 连接，用于实时通信。

**查询参数**:

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| workspace_path | string | 否 | 工作区路径 |
| member_type | string | 否 | 成员类型 |
| member_id | string | 否 | 成员 ID |

**WebSocket 消息类型**:

```typescript
// 服务器 → 客户端
interface ServerMessage {
  type:
    | "message"           // 新消息
    | "agent_thinking"    // 智能体思考中
    | "agent_response"    // 智能体响应
    | "typing_indicator"  // 输入指示器
    | "error";            // 错误
  data: any;
}

// 客户端 → 服务器
interface ClientMessage {
  type:
    | "send_message"      // 发送消息
    | "switch_view"       // 切换视图
    | "subscribe"         // 订阅事件
    | "unsubscribe";      // 取消订阅
  data: any;
}
```

---

### POST /api/group-chats/:id/files

上传文件。

**请求**: `multipart/form-data`

| 字段 | 类型 | 说明 |
|------|------|------|
| file | file | 文件内容 |

**响应**:

```json
{
  "filename": "document.pdf",
  "size": 102400,
  "url": "/api/group-chats/gc-abc123/files/document.pdf"
}
```

---

### POST /api/group-chats/:id/pictures

上传图片。仅接受图片格式。

**支持格式**: `image/jpeg`, `image/png`, `image/gif`, `image/webp`

**响应**:

```json
{
  "filename": "screenshot.png",
  "size": 51200,
  "width": 1920,
  "height": 1080,
  "url": "/api/group-chats/gc-abc123/pictures/screenshot.png"
}
```

---

## 群聊存储

群聊数据存储在工作区目录下：

```
<workspace>/.viben/group-chats/
└── <group-chat-id>/
    ├── config.yaml           # 群聊配置
    ├── members.yaml          # 成员列表
    ├── sessions/
    │   └── <session-id>/
    │       ├── config.yaml   # 会话配置
    │       └── messages.jsonl # 消息历史
    ├── files/                # 上传的文件
    └── pictures/             # 上传的图片
```

---

## 相关端点

- [智能体 API](./agents.md) - 智能体管理
- [WebSocket](./websocket.md) - WebSocket 通信
- [聊天列表 API](./chat-list.md) - 聊天列表聚合

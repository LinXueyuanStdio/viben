# 聊天列表 API

> `/api/chat-list` - 聊天列表聚合端点

## 概述

聊天列表 API 提供统一的聊天资源聚合视图，整合群聊、执行器会话和智能体会话。

## 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/chat-list` | 获取聚合聊天列表 |

---

## 详细说明

### GET /api/chat-list

获取工作空间下所有可聊天的资源。

**查询参数**:

| 参数 | 类型 | 必需 | 默认 | 说明 |
|------|------|------|------|------|
| workspace_path | string | 否 | - | 工作空间路径 |
| include_global | bool | 否 | true | 包含全局资源 |

**响应**:

```json
{
  "items": [
    {
      "id": "gc-project-chat",
      "type": "group_chat",
      "name": "Project Discussion",
      "description": "Team collaboration chat",
      "last_active": "2024-01-16T14:30:00Z",
      "unread_count": 3,
      "workspace_path": "/path/to/project"
    },
    {
      "id": "CLAUDE_CODE",
      "type": "executor",
      "name": "Claude Code",
      "description": "Anthropic Claude Code CLI",
      "is_available": true,
      "session_count": 5,
      "last_active": "2024-01-16T13:00:00Z"
    },
    {
      "id": "my-agent",
      "type": "agent",
      "name": "My Coding Assistant",
      "description": "Custom agent for coding",
      "session_count": 2,
      "last_active": "2024-01-16T12:00:00Z"
    }
  ],
  "counts": {
    "group_chats": 1,
    "executors": 3,
    "agents": 2
  }
}
```

---

## 聊天项类型

### 群聊 (group_chat)

```json
{
  "id": "gc-abc123",
  "type": "group_chat",
  "name": "Project Discussion",
  "description": "Team collaboration",
  "member_count": 3,
  "session_count": 2,
  "last_active": "2024-01-16T14:30:00Z",
  "unread_count": 3,
  "workspace_path": "/path/to/project",
  "is_global": false
}
```

### 执行器 (executor)

```json
{
  "id": "CLAUDE_CODE",
  "type": "executor",
  "name": "Claude Code",
  "description": "Anthropic Claude Code CLI",
  "is_available": true,
  "supports_mcp": true,
  "session_count": 5,
  "last_active": "2024-01-16T13:00:00Z"
}
```

### 智能体 (agent)

```json
{
  "id": "my-agent",
  "type": "agent",
  "name": "My Coding Assistant",
  "description": "Custom agent",
  "model": "claude-3-sonnet",
  "provider": "anthropic",
  "session_count": 2,
  "last_active": "2024-01-16T12:00:00Z",
  "workspace_path": null,
  "is_global": true
}
```

---

## 排序规则

返回的项目按 `last_active` 降序排列 (最近活跃的在前)。

---

## 使用场景

聊天列表 API 主要用于：
- 桌面应用侧边栏展示
- 移动应用聊天列表
- 快速切换聊天对象

---

## 相关端点

- [群聊 API](./group-chats.md) - 群聊详情
- [执行器 API](./executors.md) - 执行器详情
- [智能体 API](./agents.md) - 智能体详情

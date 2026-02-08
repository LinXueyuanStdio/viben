# Gateway 群聊功能规范

> 支持人类用户、AI 智能体和执行器在群聊中进行实时讨论和协作。

---

## Overview

| 属性 | 值 |
|------|-----|
| 模块 | `viben-core/gateway` |
| 状态 | **Draft** |
| 优先级 | P1 |

---

## 功能需求

### 参与者类型

| 类型 | 标识 | 说明 |
|------|------|------|
| `human` | 用户 ID | 人类用户，通过 WebSocket 客户端连接 |
| `agent` | Agent ID | AI 智能体，如 Claude Code、Cursor 等 |
| `executor` | Executor ID | 执行器进程，如 PTY session、代码执行环境 |

### 消息路由策略

- **广播模式**: 消息对所有群聊成员可见
- **定向模式**: 使用 `@mention` 指定接收者，仅被 mention 的成员收到通知
- **混合模式**: 消息对所有人可见，但只有被 `@mention` 的成员需要响应

### 加入方式

1. **创建时指定**: 创建群聊时指定初始成员列表
2. **动态邀请**: 群聊进行中可邀请新成员加入
3. **成员退出**: 成员可主动退出或被移除

---

## 数据模型

### GroupChat (群聊)

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupChat {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub task_id: Option<Uuid>,           // 关联的任务 (可选)
    pub created_by: String,              // 创建者 ID
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateGroupChat {
    pub name: String,
    pub description: Option<String>,
    pub task_id: Option<Uuid>,
    pub initial_members: Vec<GroupChatMemberInput>,
}
```

### GroupChatMember (群聊成员)

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MemberType {
    Human,
    Agent,
    Executor,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MemberRole {
    Owner,      // 群主，可管理所有成员
    Admin,      // 管理员，可邀请/移除成员
    Member,     // 普通成员
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupChatMember {
    pub id: Uuid,
    pub group_chat_id: Uuid,
    pub member_type: MemberType,
    pub member_id: String,              // human_id / agent_id / executor_id
    pub display_name: String,           // 显示名称
    pub role: MemberRole,
    pub joined_at: DateTime<Utc>,
    pub last_seen_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupChatMemberInput {
    pub member_type: MemberType,
    pub member_id: String,
    pub display_name: Option<String>,
    pub role: Option<MemberRole>,       // 默认 Member
}
```

### GroupChatMessage (群聊消息)

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MessageContentType {
    Text,
    Code,
    File,
    System,                             // 系统消息 (加入/退出/邀请)
    ToolCall,                           // 工具调用结果
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupChatMessage {
    pub id: Uuid,
    pub group_chat_id: Uuid,
    pub sender_id: String,              // 发送者的 member_id
    pub sender_type: MemberType,
    pub sender_name: String,
    pub content_type: MessageContentType,
    pub content: String,
    pub mentions: Vec<String>,          // @mention 的成员 ID 列表
    pub reply_to: Option<Uuid>,         // 回复的消息 ID
    pub metadata: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SendMessageRequest {
    pub content_type: Option<MessageContentType>,  // 默认 Text
    pub content: String,
    pub mentions: Option<Vec<String>>,
    pub reply_to: Option<Uuid>,
    pub metadata: Option<serde_json::Value>,
}
```

---

## 数据库 Schema

```sql
-- 群聊表
CREATE TABLE IF NOT EXISTS group_chats (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 群聊成员表
CREATE TABLE IF NOT EXISTS group_chat_members (
    id TEXT PRIMARY KEY,
    group_chat_id TEXT NOT NULL REFERENCES group_chats(id) ON DELETE CASCADE,
    member_type TEXT NOT NULL,          -- 'human', 'agent', 'executor'
    member_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member', -- 'owner', 'admin', 'member'
    joined_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_seen_at TEXT,
    UNIQUE(group_chat_id, member_type, member_id)
);

-- 群聊消息表
CREATE TABLE IF NOT EXISTS group_chat_messages (
    id TEXT PRIMARY KEY,
    group_chat_id TEXT NOT NULL REFERENCES group_chats(id) ON DELETE CASCADE,
    sender_id TEXT NOT NULL,
    sender_type TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    content_type TEXT NOT NULL DEFAULT 'text',
    content TEXT NOT NULL,
    mentions TEXT,                       -- JSON array of member_ids
    reply_to TEXT REFERENCES group_chat_messages(id) ON DELETE SET NULL,
    metadata TEXT,                       -- JSON object
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_group_chat_members_group_id ON group_chat_members(group_chat_id);
CREATE INDEX IF NOT EXISTS idx_group_chat_messages_group_id ON group_chat_messages(group_chat_id);
CREATE INDEX IF NOT EXISTS idx_group_chat_messages_created_at ON group_chat_messages(created_at);
```

---

## Gateway API

### REST Endpoints

#### 群聊管理

```
POST   /api/group-chats              创建群聊
GET    /api/group-chats              列出群聊
GET    /api/group-chats/:id          获取群聊详情
PATCH  /api/group-chats/:id          更新群聊信息
DELETE /api/group-chats/:id          删除群聊
```

#### 成员管理

```
GET    /api/group-chats/:id/members           列出成员
POST   /api/group-chats/:id/members           添加成员 (邀请)
PATCH  /api/group-chats/:id/members/:member_id  更新成员角色
DELETE /api/group-chats/:id/members/:member_id  移除成员
POST   /api/group-chats/:id/leave             退出群聊
```

#### 消息管理

```
GET    /api/group-chats/:id/messages          获取消息历史
POST   /api/group-chats/:id/messages          发送消息
DELETE /api/group-chats/:id/messages/:msg_id  删除消息
```

### WebSocket Endpoints

#### 群聊实时通信

```
WS /api/group-chats/:id/ws
```

**连接参数**:
```
?member_type=agent&member_id=claude-code-1
```

**客户端命令**:
```typescript
// 发送消息
{ "type": "send_message", "content": "Hello everyone!", "mentions": ["agent-2"] }

// 输入状态
{ "type": "typing", "is_typing": true }

// 已读确认
{ "type": "mark_read", "message_id": "uuid" }
```

**服务端事件**:
```typescript
// 新消息
{ "type": "new_message", "message": GroupChatMessage }

// 成员加入
{ "type": "member_joined", "member": GroupChatMember }

// 成员退出
{ "type": "member_left", "member_id": "string" }

// 输入状态
{ "type": "typing", "member_id": "string", "is_typing": boolean }

// 消息已读
{ "type": "message_read", "member_id": "string", "message_id": "uuid" }
```

---

## API Request/Response 示例

### 创建群聊

**Request**:
```http
POST /api/group-chats
Content-Type: application/json

{
  "name": "代码审查讨论",
  "description": "PR #123 的代码审查",
  "task_id": "task-uuid",
  "initial_members": [
    { "member_type": "human", "member_id": "user-1", "display_name": "张三", "role": "owner" },
    { "member_type": "agent", "member_id": "claude-code", "display_name": "Claude Code" },
    { "member_type": "agent", "member_id": "cursor", "display_name": "Cursor AI" }
  ]
}
```

**Response**:
```json
{
  "group_chat": {
    "id": "gc-uuid",
    "name": "代码审查讨论",
    "description": "PR #123 的代码审查",
    "task_id": "task-uuid",
    "created_by": "user-1",
    "created_at": "2024-02-08T12:00:00Z",
    "updated_at": "2024-02-08T12:00:00Z"
  },
  "members": [
    { "member_type": "human", "member_id": "user-1", "display_name": "张三", "role": "owner" },
    { "member_type": "agent", "member_id": "claude-code", "display_name": "Claude Code", "role": "member" },
    { "member_type": "agent", "member_id": "cursor", "display_name": "Cursor AI", "role": "member" }
  ]
}
```

### 发送消息

**Request**:
```http
POST /api/group-chats/gc-uuid/messages
Content-Type: application/json

{
  "content": "@claude-code 请审查这个函数的实现",
  "mentions": ["claude-code"],
  "metadata": {
    "file": "src/main.rs",
    "line_range": [10, 25]
  }
}
```

**Response**:
```json
{
  "message": {
    "id": "msg-uuid",
    "group_chat_id": "gc-uuid",
    "sender_id": "user-1",
    "sender_type": "human",
    "sender_name": "张三",
    "content_type": "text",
    "content": "@claude-code 请审查这个函数的实现",
    "mentions": ["claude-code"],
    "reply_to": null,
    "metadata": {
      "file": "src/main.rs",
      "line_range": [10, 25]
    },
    "created_at": "2024-02-08T12:05:00Z"
  }
}
```

### 邀请成员

**Request**:
```http
POST /api/group-chats/gc-uuid/members
Content-Type: application/json

{
  "member_type": "executor",
  "member_id": "pty-session-123",
  "display_name": "Terminal Session"
}
```

---

## 事件流 (SSE)

群聊事件通过现有的 EventService 广播：

```rust
pub enum GatewayEvent {
    // ... 现有事件

    // 群聊事件
    GroupChatCreated(GroupChat),
    GroupChatUpdated(GroupChat),
    GroupChatDeleted { id: String },

    GroupChatMemberJoined { group_chat_id: String, member: GroupChatMember },
    GroupChatMemberLeft { group_chat_id: String, member_id: String },

    GroupChatMessage { group_chat_id: String, message: GroupChatMessage },
}
```

---

## 智能体集成

### 智能体响应 @mention

当智能体被 @mention 时：

1. Gateway 通过 WebSocket 向该智能体发送消息
2. 智能体处理消息并生成响应
3. 智能体通过 WebSocket 发送响应到群聊

```typescript
// 智能体收到的消息格式
{
  "type": "mention",
  "group_chat_id": "gc-uuid",
  "message": GroupChatMessage,
  "context": {
    "recent_messages": GroupChatMessage[],  // 最近 N 条消息作为上下文
    "task": Task | null                      // 关联的任务信息
  }
}
```

### 执行器集成

执行器（如 PTY session）可以将输出发送到群聊：

```typescript
// 执行器发送的消息
{
  "type": "send_message",
  "content_type": "code",
  "content": "$ npm test\n\n✓ 10 tests passed",
  "metadata": {
    "exit_code": 0,
    "duration_ms": 1234
  }
}
```

---

## 实现优先级

### Phase 1: 基础功能

- [ ] 数据库模型 (GroupChat, GroupChatMember, GroupChatMessage)
- [ ] REST API (CRUD)
- [ ] WebSocket 实时通信

### Phase 2: 成员管理

- [ ] 邀请/移除成员
- [ ] 角色权限控制
- [ ] 成员在线状态

### Phase 3: 智能体集成

- [ ] @mention 路由
- [ ] 智能体自动响应
- [ ] 执行器输出集成

### Phase 4: 高级功能

- [ ] 消息搜索
- [ ] 文件共享
- [ ] 消息撤回/编辑

---

## 文件清单

### 需要创建

| 文件 | 说明 |
|------|------|
| `src/db/models/group_chat.rs` | 群聊数据模型 |
| `src/db/models/group_chat_member.rs` | 成员数据模型 |
| `src/db/models/group_chat_message.rs` | 消息数据模型 |
| `src/gateway/routes/group_chats.rs` | REST API 路由 |

### 需要修改

| 文件 | 变更 |
|------|------|
| `src/db/mod.rs` | 添加 schema 迁移 |
| `src/db/models/mod.rs` | 导出新模型 |
| `src/gateway/routes/mod.rs` | 注册新路由 |
| `src/services/events.rs` | 添加群聊事件类型 |

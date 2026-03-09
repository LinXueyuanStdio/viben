# Kanban 会话管理模块

> 管理工作区内的智能体会话，支持消息历史、follow-up 和 reset

---

## 架构概述

```
┌─────────────────────────────────────────────────────────────┐
│                   Session Module                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  KanbanSessionService                                        │
│      ├── create()           # 创建会话                       │
│      ├── sendMessage()      # 发送消息                       │
│      ├── followUp()         # 后续消息                       │
│      ├── reset()            # 重置到某消息                   │
│      └── getMessages()      # 获取消息历史                   │
│                                                              │
│  依赖:                                                       │
│      ├── SessionStore       # 会话存储                       │
│      ├── ContainerService   # 执行容器                       │
│      └── EventEmitter       # 事件通知                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 目录结构

```
<workspace>/.viben/kanban/workspaces/<workspace-id>/sessions/
└── <session-id>/
    ├── config.yaml          # 会话配置
    └── messages.jsonl       # 消息历史 (JSONL 格式)
```

---

## 核心类型

### KanbanSession

```typescript
interface KanbanSession {
  id: string;
  workspace_id: string;

  // 执行器信息
  executor_type: string;
  executor_profile_id?: string;

  // 状态
  status: SessionStatus;

  // 消息统计
  message_count: number;
  token_usage?: TokenUsage;

  // 时间
  created_at: string;
  updated_at: string;
  last_message_at?: string;
}

type SessionStatus =
  | "active"      // 活跃中
  | "paused"      // 已暂停
  | "completed"   // 已完成
  | "failed";     // 失败

interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}
```

### Message

```typescript
interface Message {
  id: string;
  session_id: string;

  // 角色
  role: MessageRole;

  // 内容
  content: string;
  content_type?: ContentType;

  // 元数据
  metadata?: MessageMetadata;

  // 时间
  timestamp: string;
}

type MessageRole =
  | "user"
  | "assistant"
  | "system"
  | "tool";

type ContentType =
  | "text"
  | "markdown"
  | "code"
  | "tool_call"
  | "tool_result";

interface MessageMetadata {
  // 工具调用
  tool_calls?: ToolCall[];
  tool_result?: ToolResult;

  // Token 使用
  tokens?: {
    input: number;
    output: number;
  };

  // 执行信息
  execution_time_ms?: number;
}

interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

interface ToolResult {
  tool_call_id: string;
  content: string;
  is_error?: boolean;
}
```

### SessionWithMessages

```typescript
interface SessionWithMessages extends KanbanSession {
  messages: Message[];
  workspace?: {
    id: string;
    name: string;
    status: WorkspaceStatus;
  };
}
```

---

## 服务接口

### KanbanSessionService

```typescript
// packages/core/src/kanban/services/session-service.ts

export class KanbanSessionService {
  constructor(
    private store: KanbanStore,
    private containerService: ContainerService,
    private eventEmitter: EventEmitter
  ) {}

  // ============================================================
  // 会话 CRUD
  // ============================================================

  /**
   * 列出工作区的会话
   */
  async list(workspaceId: string): Promise<KanbanSession[]>;

  /**
   * 获取会话详情
   */
  async get(workspaceId: string, sessionId: string): Promise<SessionWithMessages>;

  /**
   * 创建会话
   */
  async create(workspaceId: string, data: CreateSession): Promise<KanbanSession>;

  /**
   * 删除会话
   */
  async delete(workspaceId: string, sessionId: string): Promise<void>;

  // ============================================================
  // 消息操作
  // ============================================================

  /**
   * 获取消息历史
   */
  async getMessages(
    workspaceId: string,
    sessionId: string,
    options?: GetMessagesOptions
  ): Promise<Message[]>;

  /**
   * 发送新消息 (启动执行)
   */
  async sendMessage(
    workspaceId: string,
    sessionId: string,
    message: string
  ): Promise<ExecutionProcess>;

  /**
   * 发送后续消息
   */
  async followUp(
    workspaceId: string,
    sessionId: string,
    message: string
  ): Promise<ExecutionProcess>;

  /**
   * 重置到指定消息
   * 删除该消息之后的所有消息，回到该状态
   */
  async resetToMessage(
    workspaceId: string,
    sessionId: string,
    messageId: string
  ): Promise<void>;

  /**
   * 清空消息历史
   */
  async clearMessages(workspaceId: string, sessionId: string): Promise<void>;

  // ============================================================
  // 队列操作
  // ============================================================

  /**
   * 队列消息 (当进程运行中时)
   */
  async queueMessage(
    workspaceId: string,
    sessionId: string,
    message: string
  ): Promise<QueuedMessage>;

  /**
   * 获取队列中的消息
   */
  async getQueuedMessages(
    workspaceId: string,
    sessionId: string
  ): Promise<QueuedMessage[]>;

  /**
   * 取消队列消息
   */
  async cancelQueuedMessage(
    workspaceId: string,
    sessionId: string,
    messageId: string
  ): Promise<void>;

  // ============================================================
  // 审查和审批
  // ============================================================

  /**
   * 请求代码审查
   */
  async requestReview(
    workspaceId: string,
    sessionId: string,
    options?: ReviewOptions
  ): Promise<ReviewResult>;

  // ============================================================
  // 流式接口
  // ============================================================

  /**
   * 监听消息流
   */
  watchMessages(
    workspaceId: string,
    sessionId: string
  ): AsyncIterable<MessageEvent>;
}
```

### 类型定义

```typescript
interface CreateSession {
  executor_type: string;
  executor_profile_id?: string;
  initial_prompt?: string;
}

interface GetMessagesOptions {
  limit?: number;
  offset?: number;
  after?: string;    // message ID
  before?: string;   // message ID
}

interface QueuedMessage {
  id: string;
  content: string;
  queued_at: string;
  position: number;
}

interface ReviewOptions {
  include_diff?: boolean;
  reviewers?: string[];
}

interface ReviewResult {
  diff?: string;
  summary?: string;
  suggestions?: string[];
}

interface MessageEvent {
  type: "message_added" | "message_updated" | "streaming_chunk";
  message?: Message;
  chunk?: {
    content: string;
    is_final: boolean;
  };
  timestamp: string;
}
```

---

## 文件格式

### config.yaml

```yaml
id: "sess-1707821100-ghi789"
workspace_id: "ws-1707821000-def456"

executor_type: "claude-code"
executor_profile_id: "default"

status: "active"

message_count: 15
token_usage:
  input_tokens: 12500
  output_tokens: 8300
  total_tokens: 20800

created_at: "2026-02-13T10:35:00Z"
updated_at: "2026-02-13T11:00:00Z"
last_message_at: "2026-02-13T11:00:00Z"
```

### messages.jsonl

```jsonl
{"id":"msg-1","session_id":"sess-1707821100-ghi789","role":"user","content":"实现用户登录功能","timestamp":"2026-02-13T10:35:00Z"}
{"id":"msg-2","session_id":"sess-1707821100-ghi789","role":"assistant","content":"好的，我来帮你实现登录功能...","content_type":"markdown","metadata":{"tokens":{"input":150,"output":500}},"timestamp":"2026-02-13T10:35:30Z"}
{"id":"msg-3","session_id":"sess-1707821100-ghi789","role":"assistant","content_type":"tool_call","metadata":{"tool_calls":[{"id":"call-1","name":"write_file","arguments":"{\"path\":\"src/auth/login.ts\"}"}]},"timestamp":"2026-02-13T10:35:45Z"}
{"id":"msg-4","session_id":"sess-1707821100-ghi789","role":"tool","content":"文件已创建","metadata":{"tool_result":{"tool_call_id":"call-1","content":"Success"}},"timestamp":"2026-02-13T10:35:46Z"}
```

---

## 消息流程

### 发送消息流程

```
┌─────────┐     ┌─────────────────┐     ┌─────────────────┐
│  User   │────▶│ SessionService  │────▶│ContainerService │
└─────────┘     └────────┬────────┘     └────────┬────────┘
                         │                       │
                         │ 1. 追加消息到 JSONL   │
                         │                       │
                         │ 2. 创建执行进程       │
                         │──────────────────────▶│
                         │                       │
                         │ 3. 启动执行器         │
                         │                       │
                         │◀──────────────────────│
                         │    流式响应            │
                         │                       │
                         │ 4. 追加响应消息       │
                         │                       │
```

### Follow-up 流程

```
1. 检查当前会话状态
2. 如果有运行中的进程 → 使用 spawn_follow_up
3. 如果没有 → 创建新进程
4. 追加用户消息
5. 启动执行器
6. 流式返回响应
7. 追加助手消息
```

### Reset 流程

```
1. 找到目标消息
2. 读取 messages.jsonl
3. 截断到目标消息
4. 重写 messages.jsonl
5. 更新会话状态
```

---

## API 路由

### GET /api/kanban/workspaces/:workspaceId/sessions

列出会话。

### GET /api/kanban/workspaces/:workspaceId/sessions/:sessionId

获取会话详情（包含消息）。

### POST /api/kanban/workspaces/:workspaceId/sessions

创建会话。

**请求体:**

```typescript
interface CreateSessionRequest {
  executor_type: string;
  executor_profile_id?: string;
  initial_prompt?: string;
}
```

### DELETE /api/kanban/workspaces/:workspaceId/sessions/:sessionId

删除会话。

### GET /api/kanban/workspaces/:workspaceId/sessions/:sessionId/messages

获取消息历史。

**Query 参数:**

```typescript
interface GetMessagesQuery {
  limit?: number;
  offset?: number;
  after?: string;
  before?: string;
}
```

### POST /api/kanban/workspaces/:workspaceId/sessions/:sessionId/messages

发送消息。

**请求体:**

```typescript
interface SendMessageRequest {
  content: string;
}
```

### POST /api/kanban/workspaces/:workspaceId/sessions/:sessionId/follow-up

发送后续消息。

**请求体:**

```typescript
interface FollowUpRequest {
  content: string;
}
```

### POST /api/kanban/workspaces/:workspaceId/sessions/:sessionId/reset

重置到指定消息。

**请求体:**

```typescript
interface ResetRequest {
  message_id: string;
}
```

### DELETE /api/kanban/workspaces/:workspaceId/sessions/:sessionId/messages

清空消息历史。

### POST /api/kanban/workspaces/:workspaceId/sessions/:sessionId/queue

队列消息。

### GET /api/kanban/workspaces/:workspaceId/sessions/:sessionId/queue

获取队列消息。

### DELETE /api/kanban/workspaces/:workspaceId/sessions/:sessionId/queue/:messageId

取消队列消息。

### POST /api/kanban/workspaces/:workspaceId/sessions/:sessionId/review

请求代码审查。

### WebSocket: /api/kanban/workspaces/:workspaceId/sessions/:sessionId/stream

消息实时流。

---

## 实现位置

```
packages/core/src/
├── kanban/
│   ├── models/
│   │   ├── session.ts              # KanbanSession 类型
│   │   └── message.ts              # Message 类型
│   ├── services/
│   │   └── session-service.ts      # KanbanSessionService
│   └── storage/
│       └── session-store.ts        # SessionStore
└── gateway/
    └── routes/
        └── kanban/
            └── sessions.ts          # API 路由
```

---

## 与 vibe-kanban 对比

| 功能 | vibe-kanban | viben-core |
|------|-------------|------------|
| 存储 | 内存 + 数据库 | YAML + JSONL 文件 |
| 消息历史 | 数据库表 | messages.jsonl |
| follow-up | spawn_follow_up | 相同模式 |
| reset | 截断消息表 | 重写 JSONL |
| queue | QueuedMessageService | 内存队列 + 文件 |
| review | 生成 diff | 相同 |

---

## Acceptance Criteria

### 会话 CRUD
- [ ] 创建会话生成正确的目录和文件
- [ ] 获取会话包含消息历史
- [ ] 删除会话清理所有文件

### 消息操作
- [ ] getMessages 支持分页和范围查询
- [ ] sendMessage 追加到 JSONL 并启动执行
- [ ] followUp 正确调用 spawn_follow_up
- [ ] reset 正确截断消息历史
- [ ] clearMessages 清空但保留会话

### 队列
- [ ] queue 在进程运行时队列消息
- [ ] 进程完成后自动发送队列消息
- [ ] 取消队列消息

### 流式接口
- [ ] WebSocket 推送新消息
- [ ] 支持流式响应 chunk

---

## Related Documents

- [storage.md](./storage.md) - 存储系统设计
- [workspace.md](./workspace.md) - 工作区管理模块
- [api-sessions.md](./api-sessions.md) - 会话 API 详细规范 (计划中)

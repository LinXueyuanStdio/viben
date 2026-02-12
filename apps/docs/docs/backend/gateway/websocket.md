# WebSocket API

> WebSocket 实时通信端点

## 概述

Viben Gateway 提供多个 WebSocket 端点用于实时通信：
- 通用 WebSocket (`/ws`)
- 群聊 WebSocket (`/api/group-chats/:id/sessions/:sid/ws`)
- 终端 WebSocket (`/terminal/ws`)

---

## 端点列表

| 路径 | 说明 |
|------|------|
| `/ws` | 通用 WebSocket，事件订阅 |
| `/api/group-chats/:id/sessions/:sid/ws` | 群聊会话实时通信 |
| `/terminal/ws` | 终端 PTY 会话 |

---

## 通用 WebSocket

### GET /ws

通用 WebSocket 连接，用于订阅系统事件。

**事件通道**:

| 通道 | 说明 |
|------|------|
| cron | 定时任务事件 |
| channels | 通道事件 |
| group | 群聊事件 |
| tasks | 任务事件 |
| sessions | 会话事件 |
| agents | 智能体事件 |
| gateway | 网关事件 |

**客户端消息**:

```json
// 订阅事件
{
  "type": "subscribe",
  "channels": ["cron", "agents"]
}

// 取消订阅
{
  "type": "unsubscribe",
  "channels": ["cron"]
}
```

**服务器消息**:

```json
{
  "channel": "agents",
  "type": "AgentSpawned",
  "data": {
    "agent_id": "CLAUDE_CODE",
    "session_id": "abc123",
    "workdir": "/path/to/project"
  },
  "timestamp": "2024-01-16T10:00:00Z"
}
```

---

## 群聊 WebSocket

### GET /api/group-chats/:id/sessions/:sid/ws

群聊会话 WebSocket 连接。

**查询参数**:

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| workspace_path | string | 否 | 工作空间路径 |
| member_type | string | 否 | 成员类型 |
| member_id | string | 否 | 成员 ID |

**客户端消息**:

```typescript
// 发送消息
{
  "type": "send_message",
  "data": {
    "content": "Hello everyone"
  }
}

// 切换视图
{
  "type": "switch_view",
  "data": {
    "view": "agent",
    "agent_id": "CLAUDE_CODE"
  }
}

// 输入指示器
{
  "type": "typing",
  "data": {
    "is_typing": true
  }
}
```

**服务器消息**:

```typescript
// 新消息
{
  "type": "message",
  "data": {
    "id": "msg-123",
    "sender": {
      "type": "agent",
      "agent_id": "CLAUDE_CODE"
    },
    "content": "I'll help with that..."
  }
}

// 智能体思考中
{
  "type": "agent_thinking",
  "data": {
    "agent_id": "CLAUDE_CODE",
    "status": "thinking"
  }
}

// 智能体响应
{
  "type": "agent_response",
  "data": {
    "agent_id": "CLAUDE_CODE",
    "status": "completed",
    "message_id": "msg-456"
  }
}

// 输入指示器
{
  "type": "typing_indicator",
  "data": {
    "member_id": "user-1",
    "is_typing": true
  }
}

// 错误
{
  "type": "error",
  "data": {
    "code": "AGENT_ERROR",
    "message": "Agent failed to respond"
  }
}
```

---

## 终端 WebSocket

### GET /terminal/ws

终端 PTY 会话 WebSocket 连接。

**查询参数**:

| 参数 | 类型 | 必需 | 默认 | 说明 |
|------|------|------|------|------|
| cwd | string | 否 | cwd | 工作目录 |
| cols | int | 否 | 80 | 终端列数 |
| rows | int | 否 | 24 | 终端行数 |

**数据编码**: Base64

**客户端消息**:

```typescript
// 输入数据 (Base64 编码)
{
  "type": "input",
  "data": "bHMgLWxhCg=="  // "ls -la\n"
}

// 调整大小
{
  "type": "resize",
  "data": {
    "cols": 120,
    "rows": 40
  }
}
```

**服务器消息**:

```typescript
// 输出数据 (Base64 编码)
{
  "type": "output",
  "data": "dG90YWwgMTI4Cg=="
}

// 终端关闭
{
  "type": "exit",
  "data": {
    "code": 0
  }
}
```

**示例 (JavaScript)**:

```javascript
const ws = new WebSocket('ws://localhost:18790/terminal/ws?cols=80&rows=24');

ws.onopen = () => {
  // 发送命令
  const input = btoa('ls -la\n');
  ws.send(JSON.stringify({ type: 'input', data: input }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'output') {
    const output = atob(msg.data);
    console.log(output);
  }
};
```

---

## 事件类型汇总

### 任务事件

| 类型 | 说明 |
|------|------|
| TaskCreated | 任务创建 |
| TaskUpdated | 任务更新 |
| TaskDeleted | 任务删除 |
| TaskStatusChanged | 任务状态变化 |

### 智能体事件

| 类型 | 说明 |
|------|------|
| AgentSpawned | 智能体启动 |
| AgentCompleted | 智能体完成 |
| AgentError | 智能体错误 |

### 群聊事件

| 类型 | 说明 |
|------|------|
| GroupChatMessage | 新消息 |
| GroupChatAgentThinking | 智能体思考中 |
| GroupChatAgentResponse | 智能体响应 |

### 定时任务事件

| 类型 | 说明 |
|------|------|
| CronJobTriggered | 任务触发 |
| CronJobCompleted | 任务完成 |
| CronJobFailed | 任务失败 |

---

## 连接管理

### 心跳

WebSocket 连接使用 ping/pong 机制保持活跃：
- 服务器每 30 秒发送 ping
- 客户端应在 10 秒内响应 pong
- 超时未响应将断开连接

### 重连

建议客户端实现自动重连逻辑：

```javascript
function connect() {
  const ws = new WebSocket('ws://localhost:18790/ws');

  ws.onclose = () => {
    setTimeout(connect, 3000);  // 3 秒后重连
  };

  ws.onerror = () => {
    ws.close();
  };
}
```

---

## 相关端点

- [事件流 API](./events.md) - SSE 事件流
- [群聊 API](./group-chats.md) - 群聊管理

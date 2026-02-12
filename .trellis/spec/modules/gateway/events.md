# 事件流 API

> `/api/events` - Server-Sent Events 端点

## 概述

事件流 API 提供 Server-Sent Events (SSE) 方式的实时事件推送。

## 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/events` | SSE 事件流 |

---

## 详细说明

### GET /api/events

建立 SSE 连接，接收实时事件推送。

**响应头**:

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

**事件格式**:

```
event: TaskCreated
data: {"task_id":"task-abc123","title":"New task"}

event: AgentSpawned
data: {"agent_id":"CLAUDE_CODE","session_id":"xyz"}
```

---

## 事件类型

### 任务事件

| 事件 | 说明 |
|------|------|
| TaskCreated | 任务创建 |
| TaskUpdated | 任务更新 |
| TaskDeleted | 任务删除 |
| TaskStatusChanged | 任务状态变化 |

**示例**:

```json
{
  "type": "TaskStatusChanged",
  "task_id": "task-abc123",
  "old_status": "pending",
  "new_status": "in_progress",
  "timestamp": "2024-01-16T10:00:00Z"
}
```

### 智能体事件

| 事件 | 说明 |
|------|------|
| AgentSpawned | 智能体启动 |
| AgentCompleted | 智能体完成 |
| AgentError | 智能体错误 |

**示例**:

```json
{
  "type": "AgentSpawned",
  "agent_id": "CLAUDE_CODE",
  "session_id": "session-xyz",
  "workdir": "/path/to/project",
  "timestamp": "2024-01-16T10:00:00Z"
}
```

### 群聊事件

| 事件 | 说明 |
|------|------|
| GroupChatMessage | 新消息 |
| GroupChatAgentThinking | 智能体思考中 |
| GroupChatAgentResponse | 智能体响应 |

### 定时任务事件

| 事件 | 说明 |
|------|------|
| CronJobTriggered | 任务触发 |
| CronJobCompleted | 任务完成 |
| CronJobFailed | 任务失败 |

---

## 使用示例

### JavaScript

```javascript
const eventSource = new EventSource('http://localhost:18790/api/events');

eventSource.addEventListener('TaskCreated', (event) => {
  const data = JSON.parse(event.data);
  console.log('Task created:', data.task_id);
});

eventSource.addEventListener('AgentSpawned', (event) => {
  const data = JSON.parse(event.data);
  console.log('Agent spawned:', data.agent_id);
});

eventSource.onerror = (error) => {
  console.error('SSE error:', error);
};
```

### cURL

```bash
curl -N http://localhost:18790/api/events
```

---

## 与 WebSocket 对比

| 特性 | SSE | WebSocket |
|------|-----|-----------|
| 方向 | 服务器 → 客户端 | 双向 |
| 协议 | HTTP | WebSocket |
| 重连 | 自动 | 手动 |
| 适用场景 | 事件推送 | 实时交互 |

**建议**:
- 单向事件推送使用 SSE (`/api/events`)
- 双向交互使用 WebSocket (`/ws`)

---

## 相关端点

- [WebSocket](./websocket.md) - WebSocket 通信
- [任务 API](./tasks.md) - 任务管理
- [智能体 API](./agents.md) - 智能体管理

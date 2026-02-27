# WebSocket API

> WebSocket 实时通信端点

## 概述

Viben Gateway 提供多个 WebSocket 端点用于实时通信：
- 通用 WebSocket (`/ws`)
- 智能体执行 WebSocket (`/ws/agent/run`)
- 群聊 WebSocket (`/api/group-chats/:id/sessions/:sid/ws`)
- 终端 WebSocket (`/terminal/ws`)

---

## 端点列表

| 路径 | 说明 |
|------|------|
| `/ws` | 通用 WebSocket，事件订阅 |
| `/ws/agent/run` | 智能体执行，支持交互式问答 |
| `/api/group-chats/:id/sessions/:sid/ws` | 群聊会话实时通信 |
| `/terminal/ws` | 终端 PTY 会话 |

---

## 智能体执行 WebSocket

### GET /ws/agent/run

智能体执行 WebSocket 连接，支持双向通信和交互式功能（如 AskUserQuestion、EnterPlanMode）。

**查询参数**:

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| cwd | string | 否 | 工作目录 |
| agentPath | string | 否 | 智能体配置文件路径 |
| sessionId | string | 否 | 会话 ID（用于持久化） |
| taskId | string | 否 | 任务 ID（用于持久化） |

**客户端消息**:

```typescript
// 开始执行
{
  "type": "start",
  "prompt": "请帮我创建一个 React 组件",
  "agentConfig": {  // 可选，如果未提供 agentPath
    "name": "my-agent",
    "model": "claude-sonnet-4-20250514",
    "systemPrompt": "You are a helpful assistant."
  }
}

// 回答问题（AskUserQuestion）
{
  "type": "answer",
  "questionId": "tool_use_123",
  "answers": {
    "question_0": "Option A"
  }
}

// 批准计划
{
  "type": "approve",
  "planId": "plan_123"
}

// 拒绝计划
{
  "type": "reject",
  "planId": "plan_123"
}

// 取消执行
{
  "type": "cancel"
}
```

**服务器消息**:

消息格式与 SSE 端点 `/api/agent/run` 兼容：

```typescript
// 会话创建
{
  "type": "session",
  "sessionId": "abc-123-def",
  "traceId": "trace-456"
}

// 文本内容（流式）
{
  "type": "text",
  "content": "我来帮你创建..."
}

// 工具调用
{
  "type": "tool_use",
  "id": "tool_use_123",
  "name": "Write",
  "input": {
    "file_path": "/path/to/file.tsx",
    "content": "..."
  }
}

// 工具结果
{
  "type": "tool_result",
  "toolUseId": "tool_use_123",
  "output": "File created successfully",
  "isError": false
}

// 交互式问题（AskUserQuestion）
{
  "type": "question",
  "id": "tool_use_456",
  "questions": [
    {
      "header": "选择配置",
      "question": "请选择你想要的配置方式：",
      "options": [
        { "label": "默认配置", "description": "使用推荐设置" },
        { "label": "自定义配置", "description": "手动设置所有选项" }
      ],
      "multiSelect": false
    }
  ]
}

// 计划（EnterPlanMode）
{
  "type": "plan",
  "plan": {
    "id": "plan_789",
    "goal": "创建 React 组件",
    "steps": [
      { "id": "1", "description": "创建组件文件", "status": "pending" },
      { "id": "2", "description": "添加样式", "status": "pending" }
    ],
    "notes": "这是一个简单的组件创建计划"
  }
}

// 执行结果
{
  "type": "result",
  "subtype": "success",
  "cost": 0.05,
  "duration": 5000
}

// 错误
{
  "type": "error",
  "message": "执行失败：..."
}

// 完成
{
  "type": "done"
}
```

**特点**:

- 支持交互式问答：Agent 可以通过 `question` 消息询问用户，用户通过 `answer` 消息回复
- 支持计划审批：Agent 可以发送计划，用户可以批准或拒绝
- 自动重连：客户端断线后可重新连接并恢复会话
- 消息格式与 SSE 兼容：便于在 WebSocket 和 SSE 之间切换

**示例 (JavaScript)**:

```javascript
const ws = new WebSocket('ws://localhost:18790/ws/agent/run?cwd=/my/project');

ws.onopen = () => {
  // 发送开始消息
  ws.send(JSON.stringify({
    type: 'start',
    prompt: '请帮我创建一个 React 组件'
  }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);

  switch (msg.type) {
    case 'text':
      console.log('Agent:', msg.content);
      break;
    case 'question':
      // 显示问题给用户
      console.log('Question:', msg.questions[0].question);
      // 用户选择后发送回答
      ws.send(JSON.stringify({
        type: 'answer',
        questionId: msg.id,
        answers: { 'question_0': 'Option A' }
      }));
      break;
    case 'done':
      console.log('Completed');
      break;
  }
};
```

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

---
sidebar_position: 5
title: "SSE 流式通信"
description: "Server-Sent Events 流式通信规范 — Agent 实时响应"
---

# SSE 流式通信

> Server-Sent Events 实现规范，用于 Agent 实时响应

## 概述

使用 Server-Sent Events (SSE) 实现 Agent 与前端的实时通信，支持文本流、工具调用、计划审批等场景。

## 协议规范

### SSE 格式

```
data: {"type":"session","sessionId":"12345"}\n\n
data: {"type":"text","content":"你好"}\n\n
data: {"type":"tool_use","id":"tool_1","name":"Read","input":{"file_path":"/a.txt"}}\n\n
data: {"type":"done"}\n\n
```

### 响应头

```http
Content-Type: text/event-stream
Cache-Control: no-cache, no-transform
Connection: keep-alive
X-Accel-Buffering: no
```

## 消息类型

### 1. session — 会话创建

```typescript
interface SessionMessage {
  type: "session";
  sessionId: string;
}
```

触发时机：请求开始时立即发送。

### 2. text — 文本内容

```typescript
interface TextMessage {
  type: "text";
  content: string;
}
```

特点：可能会分多次发送，前端需要累积。

### 3. tool_use — 工具调用

```typescript
interface ToolUseMessage {
  type: "tool_use";
  id: string;
  name: string;
  input: unknown;
}
```

### 4. tool_result — 工具结果

```typescript
interface ToolResultMessage {
  type: "tool_result";
  toolUseId: string;
  output: string;
  isError?: boolean;
}
```

### 5. plan — 执行计划

```typescript
interface PlanMessage {
  type: "plan";
  plan: {
    id: string;
    goal: string;
    steps: Array<{
      id: string;
      description: string;
      status: "pending" | "in_progress" | "completed" | "failed";
    }>;
  };
}
```

特殊处理：收到此消息后，前端应暂停并等待用户批准。

### 6. question — 交互问题

```typescript
interface QuestionMessage {
  type: "question";
  id: string;
  questions: Array<{
    header: string;
    question: string;
    options: Array<{
      label: string;
      description?: string;
    }>;
    multiSelect: boolean;
  }>;
}
```

### 7. result — 任务完成

```typescript
interface ResultMessage {
  type: "result";
  cost?: number;
  duration?: number;
  subtype?: "success" | "error" | "error_max_turns";
}
```

### 8. error — 错误

```typescript
interface ErrorMessage {
  type: "error";
  message: string;
}
```

### 9. done — 结束标记

```typescript
interface DoneMessage {
  type: "done";
}
```

## 后端实现

### Hono SSE Helper

```typescript
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";

const agent = new Hono();

agent.post("/run", async (c) => {
  const body = await c.req.json();

  return streamSSE(c, async (stream) => {
    await stream.writeSSE({
      data: JSON.stringify({ type: "session", sessionId: "12345" }),
    });

    for await (const message of executeAgent(body)) {
      await stream.writeSSE({
        data: JSON.stringify(message),
      });
    }

    await stream.writeSSE({
      data: JSON.stringify({ type: "done" }),
    });
  });
});
```

## 前端实现

### fetch + ReadableStream

```typescript
async function connectSSE(url: string, body: object): Promise<void> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: abortController.signal,
  });

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        if (data) {
          const message = JSON.parse(data);
          handleMessage(message);
        }
      }
    }
  }
}
```

### 消息处理

```typescript
function handleMessage(message: SSEMessage): void {
  switch (message.type) {
    case "session":
      setSessionId(message.sessionId);
      break;
    case "text":
      // 累积文本到当前 assistant 消息
      appendToLastMessage(message.content);
      break;
    case "tool_use":
      // 添加工具调用消息
      addToolUseMessage(message);
      break;
    case "tool_result":
      // 添加工具结果消息
      addToolResultMessage(message);
      break;
    case "plan":
      setPlan(message.plan);
      break;
    case "question":
      setPendingQuestion(message);
      break;
    case "result":
      onComplete?.(message.cost, message.duration);
      break;
    case "error":
      setError(message.message);
      break;
    case "done":
      setPhase("idle");
      break;
  }
}
```

## 错误处理

### 连接错误 & 重试策略

```typescript
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

async function connectWithRetry(url: string, body: object): Promise<void> {
  let lastError: Error | null = null;

  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      await connectSSE(url, body);
      return;
    } catch (error) {
      lastError = error as Error;
      if (error.name === "AbortError") throw error;
      await new Promise((r) => setTimeout(r, RETRY_DELAY * (i + 1)));
    }
  }

  throw lastError;
}
```

## 参考

- 规范文件: `docs/specs/modules/chat/sse-streaming.md`
- [后台任务管理](./background-tasks.md)
- [沙箱执行](./sandbox-execution.md)

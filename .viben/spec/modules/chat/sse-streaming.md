# SSE 流式通信规范

> Server-Sent Events 实现规范，用于 Agent 实时响应

---

## 概述

使用 Server-Sent Events (SSE) 实现 Agent 与前端的实时通信，支持文本流、工具调用、计划审批等场景。

---

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

---

## 消息类型

### 1. session - 会话创建

```typescript
interface SessionMessage {
  type: "session";
  sessionId: string;
}
```

**触发时机**: 请求开始时立即发送

### 2. text - 文本内容

```typescript
interface TextMessage {
  type: "text";
  content: string;
}
```

**触发时机**: Agent 生成文本响应时

**特点**: 可能会分多次发送，前端需要累积

### 3. tool_use - 工具调用

```typescript
interface ToolUseMessage {
  type: "tool_use";
  id: string;           // 工具调用 ID
  name: string;         // 工具名称
  input: unknown;       // 工具输入参数
}
```

**触发时机**: Agent 调用工具前

### 4. tool_result - 工具结果

```typescript
interface ToolResultMessage {
  type: "tool_result";
  toolUseId: string;    // 对应的 tool_use ID
  output: string;       // 工具输出
  isError?: boolean;    // 是否为错误结果
}
```

**触发时机**: 工具执行完成后

### 5. plan - 执行计划

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
    notes?: string;
  };
}
```

**触发时机**: Agent 生成执行计划时

**特殊处理**: 收到此消息后，前端应暂停并等待用户批准

### 6. question - 交互问题

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

**触发时机**: Agent 需要用户输入时

**特殊处理**: 前端应显示问题表单，等待用户回答

### 7. result - 任务完成

```typescript
interface ResultMessage {
  type: "result";
  cost?: number;        // API 调用费用
  duration?: number;    // 执行时长 (ms)
  subtype?: "success" | "error" | "error_max_turns";
}
```

**触发时机**: 任务执行完成时

### 8. error - 错误

```typescript
interface ErrorMessage {
  type: "error";
  message: string;
}
```

**触发时机**: 发生错误时

### 9. done - 结束标记

```typescript
interface DoneMessage {
  type: "done";
}
```

**触发时机**: SSE 流结束前

---

## 后端实现

### Hono SSE Helper

```typescript
// packages/core/src/gateway/routes/agent.ts

import { Hono } from "hono";
import { streamSSE } from "hono/streaming";

const agent = new Hono();

agent.post("/run", async (c) => {
  const body = await c.req.json();

  return streamSSE(c, async (stream) => {
    // 发送会话 ID
    await stream.writeSSE({
      data: JSON.stringify({ type: "session", sessionId: "12345" }),
    });

    // 执行 Agent 并流式返回
    for await (const message of executeAgent(body)) {
      await stream.writeSSE({
        data: JSON.stringify(message),
      });
    }

    // 发送结束标记
    await stream.writeSSE({
      data: JSON.stringify({ type: "done" }),
    });
  });
});
```

### 设置正确的响应头

```typescript
// Hono 的 streamSSE 自动设置这些头
// 如需自定义：

c.header("Content-Type", "text/event-stream");
c.header("Cache-Control", "no-cache, no-transform");
c.header("Connection", "keep-alive");
c.header("X-Accel-Buffering", "no"); // 禁用 Nginx 缓冲
```

---

## 前端实现

### 使用 fetch + ReadableStream

```typescript
// apps/desktop/src/hooks/use-agent.ts

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

    // 保留最后一行（可能不完整）
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
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.type === "text") {
          return [
            ...prev.slice(0, -1),
            { ...last, content: last.content + message.content },
          ];
        }
        return [...prev, { id: Date.now().toString(), type: "text", content: message.content }];
      });
      break;

    case "tool_use":
      setMessages((prev) => [...prev, {
        id: message.id,
        type: "tool_use",
        name: message.name,
        input: message.input,
      }]);
      break;

    case "tool_result":
      setMessages((prev) => [...prev, {
        id: Date.now().toString(),
        type: "tool_result",
        toolUseId: message.toolUseId,
        output: message.output,
        isError: message.isError,
      }]);
      break;

    case "plan":
      setPlan(message.plan);
      setPhase("awaiting_approval");
      break;

    case "question":
      setPendingQuestion({
        id: message.id,
        questions: message.questions,
      });
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

---

## 错误处理

### 连接错误

```typescript
try {
  await connectSSE(url, body);
} catch (error) {
  if (error.name === "AbortError") {
    // 用户取消，不需要处理
    return;
  }

  // 检查是否为网络错误
  if (error.message === "Load failed" || error.message === "Failed to fetch") {
    setError("连接失败，请检查 Gateway 是否运行");
  } else {
    setError(error.message);
  }
}
```

### 重试策略

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

---

## 测试

### 模拟 SSE 响应

```typescript
// 测试用的 mock 服务器
import { Hono } from "hono";

const mockServer = new Hono();

mockServer.post("/api/agent/run", (c) => {
  return streamSSE(c, async (stream) => {
    await stream.writeSSE({ data: JSON.stringify({ type: "session", sessionId: "test" }) });
    await new Promise(r => setTimeout(r, 100));
    await stream.writeSSE({ data: JSON.stringify({ type: "text", content: "Hello" }) });
    await new Promise(r => setTimeout(r, 100));
    await stream.writeSSE({ data: JSON.stringify({ type: "done" }) });
  });
});
```

---

## 原始文件引用

| 文件 | 描述 |
|------|------|
| `workany/src-api/src/app/api/agent.ts:17-46` | WorkAny SSE 实现 |
| `workany/src/shared/hooks/useAgent.ts` | WorkAny 前端 SSE 处理 |
| `packages/core/src/gateway/routes/events.ts` | Viben 现有 SSE 端点参考 |

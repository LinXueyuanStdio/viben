---
sidebar_position: 20
title: "SSE Streaming"
description: "Server-Sent Events implementation for real-time Agent responses"
---

# SSE Streaming

> Server-Sent Events (SSE) implementation for real-time Agent responses

## Overview

Viben Gateway uses Server-Sent Events (SSE) to enable real-time communication between the Agent and frontend, supporting text streaming, tool calls, plan approval, and interactive questions.

## Protocol Format

### SSE Message Format

```
data: {"type":"session","sessionId":"12345"}\n\n
data: {"type":"text","content":"Hello"}\n\n
data: {"type":"tool_use","id":"tool_1","name":"Read","input":{"file_path":"/a.txt"}}\n\n
data: {"type":"done"}\n\n
```

### Response Headers

```http
Content-Type: text/event-stream
Cache-Control: no-cache, no-transform
Connection: keep-alive
X-Accel-Buffering: no
```

---

## Message Types

### 1. session - Session Created

Sent immediately when a request starts.

```typescript
interface SessionMessage {
  type: "session";
  sessionId: string;
}
```

### 2. text - Text Content

Sent when the Agent generates text responses. May be sent multiple times; the frontend needs to accumulate.

```typescript
interface TextMessage {
  type: "text";
  content: string;
}
```

### 3. tool_use - Tool Call

Sent before the Agent invokes a tool.

```typescript
interface ToolUseMessage {
  type: "tool_use";
  id: string;           // Tool call ID
  name: string;         // Tool name
  input: unknown;       // Tool input parameters
}
```

### 4. tool_result - Tool Result

Sent after a tool execution completes.

```typescript
interface ToolResultMessage {
  type: "tool_result";
  toolUseId: string;    // Corresponding tool_use ID
  output: string;       // Tool output
  isError?: boolean;    // Whether this is an error result
}
```

### 5. plan - Execution Plan

Sent when the Agent generates an execution plan. The frontend should pause and wait for user approval.

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

### 6. question - Interactive Question

Sent when the Agent needs user input. The frontend should display a question form and wait for a response.

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

### 7. result - Task Completion

Sent when task execution completes.

```typescript
interface ResultMessage {
  type: "result";
  cost?: number;        // API call cost
  duration?: number;    // Execution duration (ms)
  subtype?: "success" | "error" | "error_max_turns";
}
```

### 8. error - Error

Sent when an error occurs.

```typescript
interface ErrorMessage {
  type: "error";
  message: string;
}
```

### 9. done - End Marker

Sent before the SSE stream ends.

```typescript
interface DoneMessage {
  type: "done";
}
```

---

## Backend Implementation

### Hono SSE Helper

```typescript
// packages/core/src/gateway/routes/agent.ts

import { Hono } from "hono";
import { streamSSE } from "hono/streaming";

const agent = new Hono();

agent.post("/run", async (c) => {
  const body = await c.req.json();

  return streamSSE(c, async (stream) => {
    // Send session ID
    await stream.writeSSE({
      data: JSON.stringify({ type: "session", sessionId: "12345" }),
    });

    // Execute Agent and stream responses
    for await (const message of executeAgent(body)) {
      await stream.writeSSE({
        data: JSON.stringify(message),
      });
    }

    // Send end marker
    await stream.writeSSE({
      data: JSON.stringify({ type: "done" }),
    });
  });
});
```

### Setting Response Headers

```typescript
// Hono's streamSSE automatically sets these headers
// For custom configuration:

c.header("Content-Type", "text/event-stream");
c.header("Cache-Control", "no-cache, no-transform");
c.header("Connection", "keep-alive");
c.header("X-Accel-Buffering", "no"); // Disable Nginx buffering
```

---

## Frontend Implementation

### Using fetch + ReadableStream

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

    // Keep the last line (may be incomplete)
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

### Message Handling

```typescript
function handleMessage(message: SSEMessage): void {
  switch (message.type) {
    case "session":
      setSessionId(message.sessionId);
      break;

    case "text":
      // Accumulate text to current assistant message
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

## Error Handling

### Connection Errors

```typescript
try {
  await connectSSE(url, body);
} catch (error) {
  if (error.name === "AbortError") {
    // User cancelled, no handling needed
    return;
  }

  // Check for network errors
  if (error.message === "Load failed" || error.message === "Failed to fetch") {
    setError("Connection failed, please check if Gateway is running");
  } else {
    setError(error.message);
  }
}
```

### Retry Strategy

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

## Testing

### Mock SSE Server

```typescript
// Test mock server
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";

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

## Related Documentation

- [Background Tasks](./background-tasks.md) - Background task management
- [WebSocket API](./websocket.md) - WebSocket communication
- [Events API](./events.md) - Event stream endpoints

---
sidebar_position: 5
title: "Telemetry Guidelines"
description: "OpenTelemetry-based observability implementation guide for Viben"
---

# Telemetry Guidelines (OpenTelemetry)

> Viben 可观测性实现指南，基于 OpenTelemetry 标准

## 概述

Viben 使用 OpenTelemetry 实现可观测性三大支柱：

| 支柱 | 实现状态 | 存储格式 |
|------|---------|---------|
| **Traces** | 完整 | JSONL 文件 (按 traceId 分目录) |
| **Metrics** | 基础 | JSONL 文件 (按日期) |
| **Logs** | 完整 | Pino + JSONL 文件 (按日期) |

---

## 核心架构

### 数据存储结构

```
~/.viben/telemetry/
├── traces/
│   └── YYYY-MM-DD/
│       └── {traceId}.jsonl      # 每个 trace 一个文件
├── metrics/
│   └── YYYY-MM-DD.jsonl         # 按日期聚合
└── logs/
    └── YYYY-MM-DD.jsonl         # 按日期聚合
```

### 依赖包

```json
{
  "@opentelemetry/api": "^1.9.0",
  "@opentelemetry/instrumentation-fastify": "^0.55.0",
  "@opentelemetry/instrumentation-http": "^0.212.0",
  "@opentelemetry/sdk-metrics": "^2.5.1",
  "@opentelemetry/sdk-node": "^0.212.0",
  "@opentelemetry/sdk-trace-base": "^2.5.1",
  "@opentelemetry/semantic-conventions": "^1.39.0"
}
```

---

## Tracing 指南

### 1. 获取 Tracer

```typescript
import { trace } from "@viben/core/telemetry";

// 创建命名 tracer（模块级别，在文件顶部）
const tracer = trace.getTracer("viben-gateway", "1.0.0");
```

**命名约定**：

| Tracer 名称 | 用途 |
|------------|------|
| `viben-gateway` | Gateway API 路由 |
| `viben-gateway-ws` | WebSocket 路由 |
| `viben-cron` | Cron 服务 |

### 2. 创建 Span

```typescript
import { trace, SpanStatusCode, context } from "@viben/core/telemetry";
import { getSpanName } from "@viben/core/telemetry/route-names";

// 创建顶级 span
const span = tracer.startSpan(getSpanName("agent.run"), {
  attributes: {
    "agent.name": agentName,
    "agent.model": model,
  },
});

// 创建子 span（使用父 context）
const parentContext = trace.setSpan(context.active(), parentSpan);
const childSpan = tracer.startSpan(
  getSpanName("agent.run.stream"),
  { attributes: { "stream.session_id": sessionId } },
  parentContext
);
```

### 3. Span 命名规范

使用 `getSpanName()` 获取中文显示名称：

```typescript
import { getSpanName } from "@viben/core/telemetry/route-names";

// 获取显示名称（支持中文）
getSpanName("agent.run");           // -> "执行智能体"
getSpanName("tool.Read");           // -> "工具: Read"
getSpanName("cron.execute");        // -> "执行定时任务"
```

**已定义的 Span 名称**：

| 原始名称 | 中文显示名称 |
|---------|-------------|
| `agent.run` | 执行智能体 |
| `agent.run.session_create` | 创建会话 |
| `agent.run.sdk_init` | 初始化 SDK |
| `agent.run.stream` | 流式响应 |
| `tool_use` | 工具调用 |
| `tool_result` | 工具结果 |
| `cron.execute` | 执行定时任务 |
| `ws.session` | WebSocket 会话 |
| `ws.message.receive` | 接收 WebSocket 消息 |

### 4. 添加属性和事件

```typescript
// 设置属性
span.setAttributes({
  "agent.status": "completed",
  "agent.message_count": messageCount,
  "http.request.body": JSON.stringify(requestBody),
});

// 添加事件
span.addEvent("sse.text", {
  "sse.message_index": index,
  "sse.type": "text",
  "sse.payload": content.slice(0, 4000), // 截断大 payload
});
```

### 5. 设置状态和结束

```typescript
// 成功
span.setStatus({ code: SpanStatusCode.OK });

// 错误
span.setStatus({
  code: SpanStatusCode.ERROR,
  message: error.message,
});
span.recordException(error);

// 必须调用 end()
span.end();
```

### 6. 工具调用的 Span 模式

工具调用需要配对 `tool_use` 和 `tool_result`：

```typescript
// tool_use 时创建 span
const toolSpan = tracer.startSpan(
  getSpanName(`tool.${toolName}`),
  {
    attributes: {
      "tool.id": toolId,
      "tool.name": toolName,
      "tool.input": JSON.stringify(input),
    },
  },
  streamContext
);
pendingToolSpans.set(toolId, toolSpan);

// tool_result 时结束 span
const toolSpan = pendingToolSpans.get(toolUseId);
if (toolSpan) {
  toolSpan.setAttributes({
    "tool_result.is_error": isError,
    "tool_result.output": output.slice(0, 2000),
  });
  toolSpan.setStatus({
    code: isError ? SpanStatusCode.ERROR : SpanStatusCode.OK,
  });
  toolSpan.end();
  pendingToolSpans.delete(toolUseId);
}
```

---

## Metrics 指南

### 已实现的 Metrics

#### Agent Metrics

| 指标名称 | 类型 | Labels | 说明 |
|---------|------|--------|------|
| `viben_agent_requests_total` | Counter | agent_name, status, error_category | Agent 请求总数 |
| `viben_agent_duration_seconds` | Histogram | agent_name, status | Agent 执行时长 |
| `viben_agent_tool_calls_total` | Counter | agent_name, tool_name, status | 工具调用次数 |
| `viben_agent_text_chars_total` | Counter | agent_name | 文本响应字符数 |
| `viben_agent_messages_total` | Counter | agent_name, message_type | SSE 消息数量 |
| `viben_agent_active_sessions` | Gauge | - | 当前活跃会话数 |

#### Cron Metrics

| 指标名称 | 类型 | Labels | 说明 |
|---------|------|--------|------|
| `viben_cron_executions_total` | Counter | job_id, job_name, job_type, status, trigger | Cron 执行次数 |
| `viben_cron_duration_seconds` | Histogram | job_id, job_name, job_type | Cron 执行时长 |
| `viben_cron_jobs_total` | Gauge | enabled, job_type | Cron 作业总数 |

#### WebSocket Metrics

| 指标名称 | 类型 | Labels | 说明 |
|---------|------|--------|------|
| `viben_ws_connections_total` | Counter | - | WebSocket 连接总数 |
| `viben_ws_disconnects_total` | Counter | reason | WebSocket 断开总数 |
| `viben_ws_messages_total` | Counter | direction, message_type | WebSocket 消息数量 |
| `viben_ws_active_connections` | Gauge | - | 当前活跃连接数 |

### 使用 Helper 函数

推荐使用预定义的 helper 函数记录 metrics：

```typescript
import { recordAgentRequest, recordAgentToolCall, recordCronExecution } from "@viben/core/telemetry";

// 记录 Agent 请求完成
recordAgentRequest({
  agentName: "my-agent",
  status: "success",  // "success" | "error" | "cancelled"
  durationMs: 5000,
  toolUseCount: 3,
  toolResultCount: 3,
  textLength: 1500,
  messageCount: 10,
});

// 记录工具调用
recordAgentToolCall({
  agentName: "my-agent",
  toolName: "Read",
  status: "success",  // "success" | "error"
});

// 记录 Cron 执行
recordCronExecution({
  jobId: "job-123",
  jobName: "Daily Report",
  jobType: "agent",  // "agent" | "script"
  status: "success",
  trigger: "schedule",  // "schedule" | "manual"
  durationMs: 3000,
});
```

---

## Logging 指南

### 使用 Pino Logger

```typescript
import { createLogger, createDualLogger } from "@viben/core/telemetry";

// 创建 logger
const logger = process.env.NODE_ENV === "production"
  ? createLogger(config)
  : createDualLogger(config);  // 同时输出到文件和控制台

// 使用
logger.info({ userId, action }, "User performed action");
logger.error({ error: err.message, stack: err.stack }, "Operation failed");
```

### 日志级别

| 级别 | 用途 |
|------|------|
| `trace` | 非常详细的调试信息 |
| `debug` | 调试信息（开发环境）|
| `info` | 一般信息（生产环境默认）|
| `warn` | 警告信息 |
| `error` | 错误信息 |
| `fatal` | 致命错误 |

---

## 初始化 Telemetry

### Gateway 中的初始化

```typescript
import { initTelemetry, getDefaultTelemetryDir } from "@viben/core/telemetry";

const telemetry = initTelemetry({
  serviceName: "viben-gateway",
  serviceVersion: "1.0.0",
  baseDir: getDefaultTelemetryDir(),
  enabled: true,
  trace: {
    batchSize: 100,
    flushDelayMs: 5000,
  },
  metrics: {
    exportIntervalMs: 60000,
  },
  retentionDays: 7,
});

// 关闭时清理
process.on("SIGTERM", async () => {
  await telemetry.shutdown();
});
```

---

## 常见模式

### Pattern 1: 路由级 Tracing

```typescript
fastify.post("/api/resource", async (request, reply) => {
  const span = tracer.startSpan(getSpanName("resource.create"), {
    attributes: {
      "http.request.body": JSON.stringify(request.body),
    },
  });

  try {
    const result = await createResource(request.body);
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
    span.recordException(error);
    throw error;
  } finally {
    span.end();
  }
});
```

### Pattern 2: 嵌套 Span

```typescript
const parentSpan = tracer.startSpan("parent.operation");
const parentContext = trace.setSpan(context.active(), parentSpan);

try {
  // 子操作 1
  const childSpan1 = tracer.startSpan("child.step1", {}, parentContext);
  await step1();
  childSpan1.end();

  // 子操作 2
  const childSpan2 = tracer.startSpan("child.step2", {}, parentContext);
  await step2();
  childSpan2.end();

  parentSpan.setStatus({ code: SpanStatusCode.OK });
} finally {
  parentSpan.end();
}
```

### Pattern 3: SSE/流式 Tracing

```typescript
// 创建流 span
const streamSpan = tracer.startSpan("stream", {}, parentContext);
const streamContext = trace.setSpan(context.active(), streamSpan);

for await (const message of stream) {
  // 记录每个事件
  streamSpan.addEvent(`sse.${message.type}`, {
    "sse.payload": JSON.stringify(message).slice(0, 4000),
  });
}

streamSpan.setAttributes({
  "stream.message_count": count,
});
streamSpan.end();
```

---

## 常见错误

### Don't: 忘记结束 Span

```typescript
// Bad - span 永远不会结束
const span = tracer.startSpan("operation");
await doSomething();
// 忘记调用 span.end()

// Good - 使用 try/finally 确保结束
const span = tracer.startSpan("operation");
try {
  await doSomething();
} finally {
  span.end();
}
```

### Don't: 存储过大的属性

```typescript
// Bad - 存储完整响应
span.setAttribute("response", JSON.stringify(largeResponse));

// Good - 截断大数据
span.setAttribute(
  "response",
  JSON.stringify(response).slice(0, 2000) + "...[truncated]"
);
```

### Don't: 在热路径创建 Tracer

```typescript
// Bad - 每次请求创建 tracer
fastify.get("/api/data", async () => {
  const tracer = trace.getTracer("my-tracer"); // 重复创建
  // ...
});

// Good - 模块级别创建
const tracer = trace.getTracer("my-tracer", "1.0.0");
fastify.get("/api/data", async () => {
  // 使用已有 tracer
});
```

---

## API 端点

Telemetry 数据可通过 REST API 查询：

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/telemetry/dates` | GET | 获取可用日期列表 |
| `/api/telemetry/traces` | GET | 获取指定日期的 traces |
| `/api/telemetry/trace/:id` | GET | 获取 trace 详情（树结构）|
| `/api/telemetry/trace/:id/spans` | GET | 获取原始 spans |
| `/api/telemetry/clean` | DELETE | 清理旧文件 |
| `/api/telemetry/stats` | GET | 获取统计信息 |

---

## 相关文档

- [Telemetry API](./gateway/telemetry.md) - REST API 文档
- [Gateway 架构](./gateway/index.md) - Gateway 概述

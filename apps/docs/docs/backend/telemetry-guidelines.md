---
sidebar_position: 5
title: "Telemetry Guidelines"
description: "OpenTelemetry-based observability implementation guide for Viben"
---

# Telemetry Guidelines (OpenTelemetry)

> Viben observability implementation guide based on OpenTelemetry standards

## Overview

Viben uses OpenTelemetry to implement the three pillars of observability:

| Pillar | Implementation Status | Storage Format |
|--------|----------------------|----------------|
| **Traces** | Complete | JSONL files (by traceId directory) |
| **Metrics** | Basic | JSONL files (by date) |
| **Logs** | Complete | Pino + JSONL files (by date) |

---

## Core Architecture

### Data Storage Structure

```
~/.viben/telemetry/
├── traces/
│   └── YYYY-MM-DD/
│       └── {traceId}.jsonl      # One file per trace
├── metrics/
│   └── YYYY-MM-DD.jsonl         # Aggregated by date
└── logs/
    └── YYYY-MM-DD.jsonl         # Aggregated by date
```

### Dependencies

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

## Tracing Guide

### 1. Get Tracer

```typescript
import { trace } from "@viben/core/telemetry";

// Create named tracer (module level, at top of file)
const tracer = trace.getTracer("viben-gateway", "1.0.0");
```

**Naming Conventions**:

| Tracer Name | Purpose |
|-------------|---------|
| `viben-gateway` | Gateway API routes |
| `viben-gateway-ws` | WebSocket routes |
| `viben-cron` | Cron service |

### 2. Create Span

```typescript
import { trace, SpanStatusCode, context } from "@viben/core/telemetry";
import { getSpanName } from "@viben/core/telemetry/route-names";

// Create top-level span
const span = tracer.startSpan(getSpanName("agent.run"), {
  attributes: {
    "agent.name": agentName,
    "agent.model": model,
  },
});

// Create child span (using parent context)
const parentContext = trace.setSpan(context.active(), parentSpan);
const childSpan = tracer.startSpan(
  getSpanName("agent.run.stream"),
  { attributes: { "stream.session_id": sessionId } },
  parentContext
);
```

### 3. Span Naming Conventions

Use `getSpanName()` to get display names:

```typescript
import { getSpanName } from "@viben/core/telemetry/route-names";

// Get display names
getSpanName("agent.run");           // -> "Execute Agent"
getSpanName("tool.Read");           // -> "Tool: Read"
getSpanName("cron.execute");        // -> "Execute Cron Job"
```

**Defined Span Names**:

| Original Name | Display Name |
|---------------|--------------|
| `agent.run` | Execute Agent |
| `agent.run.session_create` | Create Session |
| `agent.run.sdk_init` | Initialize SDK |
| `agent.run.stream` | Stream Response |
| `tool_use` | Tool Use |
| `tool_result` | Tool Result |
| `cron.execute` | Execute Cron Job |
| `ws.session` | WebSocket Session |
| `ws.message.receive` | Receive WebSocket Message |

### 4. Add Attributes and Events

```typescript
// Set attributes
span.setAttributes({
  "agent.status": "completed",
  "agent.message_count": messageCount,
  "http.request.body": JSON.stringify(requestBody),
});

// Add events
span.addEvent("sse.text", {
  "sse.message_index": index,
  "sse.type": "text",
  "sse.payload": content.slice(0, 4000), // Truncate large payloads
});
```

### 5. Set Status and End

```typescript
// Success
span.setStatus({ code: SpanStatusCode.OK });

// Error
span.setStatus({
  code: SpanStatusCode.ERROR,
  message: error.message,
});
span.recordException(error);

// Must call end()
span.end();
```

### 6. Tool Call Span Pattern

Tool calls require pairing `tool_use` and `tool_result`:

```typescript
// Create span on tool_use
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

// End span on tool_result
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

## Metrics Guide

### Implemented Metrics

#### Agent Metrics

| Metric Name | Type | Labels | Description |
|-------------|------|--------|-------------|
| `viben_agent_requests_total` | Counter | agent_name, status, error_category | Total agent requests |
| `viben_agent_duration_seconds` | Histogram | agent_name, status | Agent execution duration |
| `viben_agent_tool_calls_total` | Counter | agent_name, tool_name, status | Tool call count |
| `viben_agent_text_chars_total` | Counter | agent_name | Text response character count |
| `viben_agent_messages_total` | Counter | agent_name, message_type | SSE message count |
| `viben_agent_active_sessions` | Gauge | - | Current active sessions |

#### Cron Metrics

| Metric Name | Type | Labels | Description |
|-------------|------|--------|-------------|
| `viben_cron_executions_total` | Counter | job_id, job_name, job_type, status, trigger | Cron execution count |
| `viben_cron_duration_seconds` | Histogram | job_id, job_name, job_type | Cron execution duration |
| `viben_cron_jobs_total` | Gauge | enabled, job_type | Total cron jobs |

#### WebSocket Metrics

| Metric Name | Type | Labels | Description |
|-------------|------|--------|-------------|
| `viben_ws_connections_total` | Counter | - | Total WebSocket connections |
| `viben_ws_disconnects_total` | Counter | reason | Total WebSocket disconnections |
| `viben_ws_messages_total` | Counter | direction, message_type | WebSocket message count |
| `viben_ws_active_connections` | Gauge | - | Current active connections |

### Using Helper Functions

Recommended to use predefined helper functions for recording metrics:

```typescript
import { recordAgentRequest, recordAgentToolCall, recordCronExecution } from "@viben/core/telemetry";

// Record agent request completion
recordAgentRequest({
  agentName: "my-agent",
  status: "success",  // "success" | "error" | "cancelled"
  durationMs: 5000,
  toolUseCount: 3,
  toolResultCount: 3,
  textLength: 1500,
  messageCount: 10,
});

// Record tool call
recordAgentToolCall({
  agentName: "my-agent",
  toolName: "Read",
  status: "success",  // "success" | "error"
});

// Record cron execution
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

## Logging Guide

### Using Pino Logger

```typescript
import { createLogger, createDualLogger } from "@viben/core/telemetry";

// Create logger
const logger = process.env.NODE_ENV === "production"
  ? createLogger(config)
  : createDualLogger(config);  // Output to both file and console

// Usage
logger.info({ userId, action }, "User performed action");
logger.error({ error: err.message, stack: err.stack }, "Operation failed");
```

### Log Levels

| Level | Purpose |
|-------|---------|
| `trace` | Very detailed debug information |
| `debug` | Debug information (development) |
| `info` | General information (production default) |
| `warn` | Warning messages |
| `error` | Error messages |
| `fatal` | Fatal errors |

---

## Initializing Telemetry

### Initialization in Gateway

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

// Cleanup on shutdown
process.on("SIGTERM", async () => {
  await telemetry.shutdown();
});
```

---

## Common Patterns

### Pattern 1: Route-Level Tracing

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

### Pattern 2: Nested Spans

```typescript
const parentSpan = tracer.startSpan("parent.operation");
const parentContext = trace.setSpan(context.active(), parentSpan);

try {
  // Child operation 1
  const childSpan1 = tracer.startSpan("child.step1", {}, parentContext);
  await step1();
  childSpan1.end();

  // Child operation 2
  const childSpan2 = tracer.startSpan("child.step2", {}, parentContext);
  await step2();
  childSpan2.end();

  parentSpan.setStatus({ code: SpanStatusCode.OK });
} finally {
  parentSpan.end();
}
```

### Pattern 3: SSE/Streaming Tracing

```typescript
// Create stream span
const streamSpan = tracer.startSpan("stream", {}, parentContext);
const streamContext = trace.setSpan(context.active(), streamSpan);

for await (const message of stream) {
  // Record each event
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

## Common Mistakes

### Don't: Forget to End Span

```typescript
// Bad - span never ends
const span = tracer.startSpan("operation");
await doSomething();
// Forgot to call span.end()

// Good - use try/finally to ensure ending
const span = tracer.startSpan("operation");
try {
  await doSomething();
} finally {
  span.end();
}
```

### Don't: Store Oversized Attributes

```typescript
// Bad - storing full response
span.setAttribute("response", JSON.stringify(largeResponse));

// Good - truncate large data
span.setAttribute(
  "response",
  JSON.stringify(response).slice(0, 2000) + "...[truncated]"
);
```

### Don't: Create Tracer in Hot Path

```typescript
// Bad - creating tracer on every request
fastify.get("/api/data", async () => {
  const tracer = trace.getTracer("my-tracer"); // Repeated creation
  // ...
});

// Good - create at module level
const tracer = trace.getTracer("my-tracer", "1.0.0");
fastify.get("/api/data", async () => {
  // Use existing tracer
});
```

---

## API Endpoints

Telemetry data can be queried via REST API:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/telemetry/dates` | GET | Get list of available dates |
| `/api/telemetry/traces` | GET | Get traces for specified date |
| `/api/telemetry/trace/:id` | GET | Get trace details (tree structure) |
| `/api/telemetry/trace/:id/spans` | GET | Get raw spans |
| `/api/telemetry/clean` | DELETE | Clean old files |
| `/api/telemetry/stats` | GET | Get statistics |

---

## Related Documentation

- [Telemetry API](./gateway/telemetry.md) - REST API documentation
- [Gateway Architecture](./gateway/index.md) - Gateway overview

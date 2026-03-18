---
sidebar_position: 16
title: "Telemetry API"
description: "Observability data query API"
---

# Telemetry API

> `/api/telemetry` - 可观测性数据查询接口

## 概述

Telemetry API 提供对 OpenTelemetry 数据的 REST 查询接口，用于：
- 查询 trace 列表和详情
- 查看执行统计
- 清理旧数据

数据存储在 `~/.viben/telemetry/` 目录下。

## 端点列表

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/telemetry/dates` | GET | 获取可用日期列表 |
| `/api/telemetry/traces` | GET | 获取指定日期的 traces |
| `/api/telemetry/trace/:id` | GET | 获取 trace 详情（树结构）|
| `/api/telemetry/trace/:id/spans` | GET | 获取原始 spans |
| `/api/telemetry/clean` | DELETE | 清理旧文件 |
| `/api/telemetry/stats` | GET | 获取统计信息 |

---

## 详细说明

### GET /api/telemetry/dates

获取所有有 trace 数据的日期列表。

**响应**:

```json
[
  {
    "date": "2024-01-15",
    "count": 42,
    "totalSize": 1048576
  },
  {
    "date": "2024-01-14",
    "count": 38,
    "totalSize": 921600
  }
]
```

---

### GET /api/telemetry/traces

获取指定日期的 trace 列表。

**查询参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `date` | string | 否 | 日期 (YYYY-MM-DD)，默认今天 |
| `route` | string | 否 | 按路由过滤 (如 `/api/agent/run`) |

**响应**:

```json
{
  "date": "2024-01-15",
  "route": "/api/agent/run",
  "count": 5,
  "traces": [
    {
      "traceId": "abc123def456",
      "size": 4096,
      "mtime": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

---

### GET /api/telemetry/trace/:id

获取单个 trace 的详细信息，包含树结构。

**路径参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | string | Trace ID |

**查询参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `date` | string | 否 | 日期 (YYYY-MM-DD)，默认今天 |

**响应**:

```json
{
  "traceId": "abc123def456",
  "date": "2024-01-15",
  "tree": {
    "traceId": "abc123def456",
    "startTime": 1705312200000,
    "endTime": 1705312205000,
    "totalDuration": 5000,
    "root": {
      "spanId": "span001",
      "name": "POST /api/agent/run",
      "displayName": "执行智能体",
      "kind": 1,
      "startTime": 1705312200000,
      "endTime": 1705312205000,
      "duration": 5000,
      "status": { "code": 1 },
      "attributes": {
        "agent.name": "default",
        "agent.model": "claude-3-opus"
      },
      "events": [],
      "children": [
        {
          "spanId": "span002",
          "name": "agent.run.stream",
          "displayName": "流式响应",
          "duration": 4500,
          "children": []
        }
      ]
    }
  },
  "stats": {
    "totalSpans": 12,
    "successSpans": 11,
    "errorSpans": 1,
    "maxDepth": 4,
    "operations": [
      {
        "name": "tool.Read",
        "count": 3,
        "totalDuration": 150,
        "avgDuration": 50
      }
    ]
  }
}
```

---

### GET /api/telemetry/trace/:id/spans

获取 trace 的原始 span 列表（扁平结构）。

**响应**:

```json
{
  "traceId": "abc123def456",
  "date": "2024-01-15",
  "spans": [
    {
      "spanId": "span001",
      "parentSpanId": null,
      "name": "POST /api/agent/run",
      "displayName": "执行智能体",
      "kind": 1,
      "startTime": 1705312200000,
      "endTime": 1705312205000,
      "duration": 5000,
      "status": { "code": 1 },
      "attributes": {},
      "events": []
    }
  ]
}
```

---

### DELETE /api/telemetry/clean

清理超过保留期的旧数据。

**请求体**:

```json
{
  "retentionDays": 7
}
```

**响应**:

```json
{
  "success": true,
  "retentionDays": 7,
  "datesRemoved": 3,
  "tracesRemoved": 156
}
```

---

### GET /api/telemetry/stats

获取 telemetry 存储统计。

**响应**:

```json
{
  "directory": "/Users/user/.viben/telemetry",
  "dates": 7,
  "totalTraces": 342,
  "totalSizeBytes": 15728640,
  "totalSizeMB": "15.00"
}
```

---

## 数据结构

### TraceSpan

```typescript
interface TraceSpan {
  spanId: string;
  parentSpanId?: string;
  name: string;
  displayName: string;
  kind: number;          // 0=INTERNAL, 1=SERVER, 2=CLIENT, 3=PRODUCER, 4=CONSUMER
  startTime: number;     // Unix 毫秒
  endTime: number;       // Unix 毫秒
  duration: number;      // 毫秒
  status: {
    code: number;        // 0=UNSET, 1=OK, 2=ERROR
    message?: string;
  };
  attributes: Record<string, unknown>;
  events: TraceEvent[];
}
```

### TraceEvent

```typescript
interface TraceEvent {
  name: string;
  time: number;          // Unix 毫秒
  attributes?: Record<string, unknown>;
}
```

---

## 错误响应

所有端点在出错时返回：

```json
{
  "error": "Error type",
  "message": "Detailed error message"
}
```

HTTP 状态码：
- `404` - Trace 不存在
- `500` - 内部错误

---

## 相关文档

- [Telemetry Guidelines](../telemetry-guidelines.md) - 开发指南

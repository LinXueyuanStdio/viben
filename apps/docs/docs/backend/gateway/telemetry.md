---
sidebar_position: 16
title: "Telemetry API"
description: "Observability data query API"
---

# Telemetry API

> `/api/telemetry` - Observability data query endpoints

## Overview

The Telemetry API provides REST query interface for OpenTelemetry data, used for:
- Querying trace lists and details
- Viewing execution statistics
- Cleaning up old data

Data is stored in the `~/.viben/telemetry/` directory.

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/telemetry/dates` | GET | Get available date list |
| `/api/telemetry/traces` | GET | Get traces for a specific date |
| `/api/telemetry/trace/:id` | GET | Get trace details (tree structure) |
| `/api/telemetry/trace/:id/spans` | GET | Get raw spans |
| `/api/telemetry/clean` | DELETE | Clean up old files |
| `/api/telemetry/stats` | GET | Get statistics |

---

## Detailed Description

### GET /api/telemetry/dates

Get list of all dates that have trace data.

**Response**:

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

Get trace list for a specific date.

**Query Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `date` | string | No | Date (YYYY-MM-DD), defaults to today |
| `route` | string | No | Filter by route (e.g., `/api/agent/run`) |

**Response**:

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

Get detailed information for a single trace, including tree structure.

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Trace ID |

**Query Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `date` | string | No | Date (YYYY-MM-DD), defaults to today |

**Response**:

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
      "displayName": "Execute Agent",
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
          "displayName": "Streaming Response",
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

Get raw span list for a trace (flat structure).

**Response**:

```json
{
  "traceId": "abc123def456",
  "date": "2024-01-15",
  "spans": [
    {
      "spanId": "span001",
      "parentSpanId": null,
      "name": "POST /api/agent/run",
      "displayName": "Execute Agent",
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

Clean up old data that exceeds the retention period.

**Request Body**:

```json
{
  "retentionDays": 7
}
```

**Response**:

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

Get telemetry storage statistics.

**Response**:

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

## Data Structures

### TraceSpan

```typescript
interface TraceSpan {
  spanId: string;
  parentSpanId?: string;
  name: string;
  displayName: string;
  kind: number;          // 0=INTERNAL, 1=SERVER, 2=CLIENT, 3=PRODUCER, 4=CONSUMER
  startTime: number;     // Unix milliseconds
  endTime: number;       // Unix milliseconds
  duration: number;      // milliseconds
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
  time: number;          // Unix milliseconds
  attributes?: Record<string, unknown>;
}
```

---

## Error Response

All endpoints return the following on error:

```json
{
  "error": "Error type",
  "message": "Detailed error message"
}
```

HTTP Status Codes:
- `404` - Trace not found
- `500` - Internal error

---

## Related Documentation

- [Telemetry Guidelines](../telemetry-guidelines.md) - Development Guidelines

# Cron Jobs API

> `/api/cron` - Cron job management endpoints

## Overview

The Cron Jobs API provides task scheduling based on cron expressions or time intervals, supporting both agent tasks and script tasks.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/cron` | List all cron jobs |
| POST | `/api/cron` | Create a cron job |
| GET | `/api/cron/:id` | Get job details |
| PATCH | `/api/cron/:id` | Update a job |
| DELETE | `/api/cron/:id` | Delete a job |
| POST | `/api/cron/:id/enable` | Enable a job |
| POST | `/api/cron/:id/disable` | Disable a job |
| POST | `/api/cron/:id/run` | Run immediately |

---

## Detailed Description

### GET /api/cron

List all cron jobs.

**Response**:

```json
{
  "jobs": [
    {
      "id": "cron-daily-report",
      "name": "Daily Report",
      "type": "Agent",
      "enabled": true,
      "schedule": {
        "type": "cron",
        "expression": "0 9 * * *"
      },
      "last_run": "2024-01-15T09:00:00Z",
      "next_run": "2024-01-16T09:00:00Z",
      "status": "idle"
    },
    {
      "id": "cron-backup",
      "name": "Backup Script",
      "type": "Script",
      "enabled": true,
      "schedule": {
        "type": "interval",
        "seconds": 3600
      },
      "status": "running"
    }
  ]
}
```

---

### POST /api/cron

Create a cron job.

**Request Body (Agent Task)**:

```json
{
  "name": "Daily Report",
  "type": "Agent",
  "agent_id": "my-reporter",
  "prompt": "Generate daily progress report",
  "workdir": "/path/to/project",
  "schedule": {
    "type": "cron",
    "expression": "0 9 * * *"
  }
}
```

**Request Body (Script Task)**:

```json
{
  "name": "Backup Script",
  "type": "Script",
  "command": "/path/to/backup.sh",
  "args": ["--full"],
  "workdir": "/path/to/project",
  "schedule": {
    "type": "interval",
    "seconds": 3600
  }
}
```

**Field Descriptions**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Job name |
| type | string | Yes | Job type: `Agent` or `Script` |
| agent_id | string | Conditional | Agent ID (required when type=Agent) |
| prompt | string | Conditional | Prompt (required when type=Agent) |
| command | string | Conditional | Command path (required when type=Script) |
| args | string[] | No | Command arguments |
| workdir | string | No | Working directory |
| schedule | object | Yes | Schedule configuration |

**Schedule Types**:

```json
// Cron expression
{
  "type": "cron",
  "expression": "0 9 * * *"  // Daily at 9:00
}

// Fixed interval
{
  "type": "interval",
  "seconds": 3600  // Every hour
}
```

---

### GET /api/cron/:id

Get job details.

**Response**:

```json
{
  "id": "cron-daily-report",
  "name": "Daily Report",
  "type": "Agent",
  "enabled": true,
  "agent_id": "my-reporter",
  "prompt": "Generate daily progress report",
  "workdir": "/path/to/project",
  "schedule": {
    "type": "cron",
    "expression": "0 9 * * *"
  },
  "last_run": "2024-01-15T09:00:00Z",
  "next_run": "2024-01-16T09:00:00Z",
  "status": "idle",
  "run_count": 15,
  "last_result": {
    "success": true,
    "duration_ms": 45000,
    "output_preview": "Report generated..."
  },
  "created_at": "2024-01-01T10:00:00Z"
}
```

---

### POST /api/cron/:id/run

Run a cron job immediately (does not affect regular schedule).

**Response**:

```json
{
  "success": true,
  "run_id": "run-abc123",
  "started_at": "2024-01-15T14:30:00Z"
}
```

---

### POST /api/cron/:id/enable

Enable a cron job.

**Response**:

```json
{
  "success": true,
  "next_run": "2024-01-16T09:00:00Z"
}
```

---

### POST /api/cron/:id/disable

Disable a cron job.

**Response**:

```json
{
  "success": true
}
```

---

## Cron Expression Format

```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of week (0 - 6, 0 = Sunday)
│ │ │ │ │
* * * * *
```

**Common Examples**:

| Expression | Description |
|------------|-------------|
| `0 9 * * *` | Daily at 9:00 |
| `0 9 * * 1-5` | Weekdays at 9:00 |
| `0 */2 * * *` | Every 2 hours |
| `0 0 * * 0` | Every Sunday at 0:00 |
| `0 0 1 * *` | 1st of every month at 0:00 |

---

## Job Status

| Status | Description |
|--------|-------------|
| idle | Idle, waiting for next run |
| running | Currently running |
| failed | Last run failed |
| disabled | Disabled |

---

## Event Notifications

When a cron job is triggered, events are sent via WebSocket and SSE:

```json
{
  "type": "CronJobTriggered",
  "data": {
    "job_id": "cron-daily-report",
    "run_id": "run-abc123",
    "triggered_at": "2024-01-16T09:00:00Z"
  }
}
```

```json
{
  "type": "CronJobCompleted",
  "data": {
    "job_id": "cron-daily-report",
    "run_id": "run-abc123",
    "success": true,
    "duration_ms": 45000
  }
}
```

---

## Related Endpoints

- [Agents API](./agents.md) - Agent management
- [Channels API](./channels.md) - Channel management
- [Events](./events.md) - Event notifications

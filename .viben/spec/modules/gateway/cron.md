# 定时任务 API

> `/api/cron` - 定时任务管理端点

## 概述

定时任务 API 提供基于 cron 表达式或间隔时间的任务调度功能，支持智能体任务和脚本任务。

## 端点列表

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/cron` | 列出所有定时任务 |
| POST | `/api/cron` | 创建定时任务 |
| GET | `/api/cron/:id` | 获取任务详情 |
| PATCH | `/api/cron/:id` | 更新任务 |
| DELETE | `/api/cron/:id` | 删除任务 |
| POST | `/api/cron/:id/enable` | 启用任务 |
| POST | `/api/cron/:id/disable` | 禁用任务 |
| POST | `/api/cron/:id/run` | 立即运行 |

---

## 详细说明

### GET /api/cron

列出所有定时任务。

**响应**:

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

创建定时任务。

**请求体 (智能体任务)**:

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

**请求体 (脚本任务)**:

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

**字段说明**:

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| name | string | ✓ | 任务名称 |
| type | string | ✓ | 任务类型: `Agent` 或 `Script` |
| agent_id | string | 条件 | 智能体 ID (type=Agent 时必需) |
| prompt | string | 条件 | 提示词 (type=Agent 时必需) |
| command | string | 条件 | 命令路径 (type=Script 时必需) |
| args | string[] | 否 | 命令参数 |
| workdir | string | 否 | 工作目录 |
| schedule | object | ✓ | 调度配置 |

**调度类型**:

```json
// Cron 表达式
{
  "type": "cron",
  "expression": "0 9 * * *"  // 每天 9:00
}

// 固定间隔
{
  "type": "interval",
  "seconds": 3600  // 每小时
}
```

---

### GET /api/cron/:id

获取任务详情。

**响应**:

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

立即运行定时任务 (不影响正常调度)。

**响应**:

```json
{
  "success": true,
  "run_id": "run-abc123",
  "started_at": "2024-01-15T14:30:00Z"
}
```

---

### POST /api/cron/:id/enable

启用定时任务。

**响应**:

```json
{
  "success": true,
  "next_run": "2024-01-16T09:00:00Z"
}
```

---

### POST /api/cron/:id/disable

禁用定时任务。

**响应**:

```json
{
  "success": true
}
```

---

## Cron 表达式格式

```
┌───────────── 分钟 (0 - 59)
│ ┌───────────── 小时 (0 - 23)
│ │ ┌───────────── 日 (1 - 31)
│ │ │ ┌───────────── 月 (1 - 12)
│ │ │ │ ┌───────────── 星期 (0 - 6, 0 = 周日)
│ │ │ │ │
* * * * *
```

**常用示例**:

| 表达式 | 说明 |
|--------|------|
| `0 9 * * *` | 每天 9:00 |
| `0 9 * * 1-5` | 工作日 9:00 |
| `0 */2 * * *` | 每 2 小时 |
| `0 0 * * 0` | 每周日 0:00 |
| `0 0 1 * *` | 每月 1 日 0:00 |

---

## 任务状态

| 状态 | 说明 |
|------|------|
| idle | 空闲，等待下次运行 |
| running | 正在运行 |
| failed | 上次运行失败 |
| disabled | 已禁用 |

---

## 事件通知

定时任务触发时会发送事件到 WebSocket 和 SSE：

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

## 相关端点

- [智能体 API](./agents.md) - 智能体管理
- [通道 API](./channels.md) - 通道管理
- [事件流](./events.md) - 事件通知

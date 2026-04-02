---
sidebar_position: 13
title: "viben cron"
description: "管理智能体定时任务"
---

# viben cron

管理智能体的定时任务。

## 用法

```bash
viben cron <子命令> [选项]
```

## 子命令

| 子命令 | 描述 |
|--------|------|
| `list` | 列出所有定时任务 |
| `add` | 添加定时任务 |
| `remove <job_id>` | 删除定时任务 |
| `enable <job_id>` | 启用定时任务 |
| `disable <job_id>` | 禁用定时任务 |
| `show <job_id>` | 显示任务详情 |
| `run <job_id>` | 立即运行任务（用于测试）|

## 命令

### 列出定时任务

```bash
# 列出所有定时任务
viben cron list
viben cron list --json
```

**输出（人类可读）：**

```
Scheduled Jobs:
  daily-greeting     enabled    "0 9 * * *"      next: 2024-01-17 09:00
  weekly-review      enabled    "0 17 * * 5"     next: 2024-01-19 17:00
  hourly-check       disabled   every 3600s      -
```

**输出（JSON）：**

```json
{
  "success": true,
  "data": {
    "jobs": [
      {
        "id": "daily-greeting",
        "enabled": true,
        "message": "Good morning! What's on my schedule today?",
        "cron": "0 9 * * *",
        "channel": "my-telegram",
        "agent": "main",
        "next_run": "2024-01-17T09:00:00Z",
        "last_run": "2024-01-16T09:00:15Z",
        "last_status": "success"
      }
    ]
  }
}
```

### 添加定时任务

使用 cron 表达式添加定时任务：

```bash
# 使用 cron 表达式
viben cron add --name <name> --message "<message>" --cron "<cron-expr>"
viben cron add --name "daily-greeting" --message "早上好！今天有什么安排？" --cron "0 9 * * *"
viben cron add --name "weekly-review" --message "总结本周成果" --cron "0 17 * * 5"

# 使用间隔秒数
viben cron add --name <name> --message "<message>" --every <seconds>
viben cron add --name "hourly-check" --message "检查紧急任务" --every 3600
viben cron add --name "quick-poll" --message "有更新吗？" --every 300
```

**输出：**

```
Added cron job 'daily-greeting'
  Schedule: 0 9 * * * (Every day at 9:00 AM)
  Next run: 2024-01-17 09:00:00
```

### 删除定时任务

```bash
viben cron remove daily-greeting
```

**输出：**

```
Removed cron job 'daily-greeting'
```

### 启用/禁用定时任务

```bash
# 启用
viben cron enable hourly-check

# 禁用
viben cron disable hourly-check
```

### 显示任务详情

```bash
viben cron show daily-greeting
```

**输出：**

```
Cron Job: daily-greeting
  Status: enabled
  Schedule: 0 9 * * * (Every day at 9:00 AM)
  Message: "Good morning! What's on my schedule today?"
  Channel: my-telegram
  Agent: main

  Last run: 2024-01-16 09:00:15 (success)
  Next run: 2024-01-17 09:00:00
```

### 立即运行任务

```bash
# 用于测试
viben cron run daily-greeting
```

## Cron 配置

```yaml
# ~/.viben/cron.yaml
version: 1

jobs:
  daily-greeting:
    enabled: true
    message: "Good morning! What's on my schedule today?"
    cron: "0 9 * * *"        # 每天 9:00
    channel: my-telegram     # 发送响应的渠道
    agent: main              # 使用的智能体

  weekly-review:
    enabled: true
    message: "Summarize this week's accomplishments"
    cron: "0 17 * * 5"       # 每周五 17:00
    channel: my-telegram
    agent: main

  hourly-check:
    enabled: false
    message: "Check for any urgent tasks"
    every: 3600              # 每 3600 秒（1 小时）
    channel: null            # 仅 CLI（不发送渠道通知）
    agent: main
```

## Cron 表达式格式

标准 cron 格式：`分钟 小时 日 月 星期`

| 字段 | 值范围 | 特殊字符 |
|------|--------|----------|
| 分钟 | 0-59 | `*` `,` `-` `/` |
| 小时 | 0-23 | `*` `,` `-` `/` |
| 日 | 1-31 | `*` `,` `-` `/` |
| 月 | 1-12 | `*` `,` `-` `/` |
| 星期 | 0-6（0=周日）| `*` `,` `-` `/` |

**示例：**

| 表达式 | 描述 |
|--------|------|
| `0 9 * * *` | 每天 9:00 |
| `30 8 * * 1-5` | 工作日 8:30 |
| `0 */2 * * *` | 每 2 小时 |
| `0 0 1 * *` | 每月 1 日午夜 |
| `0 17 * * 5` | 每周五 17:00 |

## 错误处理

### 任务未找到

```json
{
  "success": false,
  "error": {
    "code": "JOB_NOT_FOUND",
    "message": "Cron job 'unknown-job' not found"
  }
}
```

### 无效的 Cron 表达式

```json
{
  "success": false,
  "error": {
    "code": "INVALID_CRON",
    "message": "Invalid cron expression: '* * *'"
  }
}
```

### 任务已存在

```json
{
  "success": false,
  "error": {
    "code": "JOB_EXISTS",
    "message": "Cron job 'daily-greeting' already exists"
  }
}
```

## 相关命令

- [viben channel](./channel) - 渠道管理
- [viben gateway](./gateway) - Gateway 运行时
- [viben agent](./agent) - 智能体管理

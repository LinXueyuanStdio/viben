# viben cron

> 管理 Agent 的定时任务。

## 命令

```bash
# ============================================================
# Cron Job Management
# ============================================================

# List all cron jobs
viben cron list
viben cron list --json

# Add a cron job (cron expression)
viben cron add --name <name> --message "<message>" --cron "<cron-expr>"
viben cron add --name "daily-greeting" --message "Good morning! What's on my schedule today?" --cron "0 9 * * *"
viben cron add --name "weekly-review" --message "Summarize this week's accomplishments" --cron "0 17 * * 5"

# Add a cron job (interval in seconds)
viben cron add --name <name> --message "<message>" --every <seconds>
viben cron add --name "hourly-check" --message "Check for any urgent tasks" --every 3600
viben cron add --name "quick-poll" --message "Any updates?" --every 300

# Remove a cron job
viben cron remove <job_id>
viben cron remove daily-greeting

# Enable/disable a cron job
viben cron enable <job_id>
viben cron disable <job_id>

# Show cron job details
viben cron show <job_id>

# ============================================================
# Cron Execution
# ============================================================

# Run a cron job immediately (for testing)
viben cron run <job_id>
```

---

## Cron 配置

```yaml
# ~/.viben/cron.yaml
version: 1

jobs:
  daily-greeting:
    enabled: true
    message: "Good morning! What's on my schedule today?"
    cron: "0 9 * * *"        # 9:00 AM every day
    channel: my-telegram     # Which channel to send response
    agent: main              # Which agent to use

  weekly-review:
    enabled: true
    message: "Summarize this week's accomplishments"
    cron: "0 17 * * 5"       # 5:00 PM every Friday
    channel: my-telegram
    agent: main

  hourly-check:
    enabled: false
    message: "Check for any urgent tasks"
    every: 3600              # Every 3600 seconds (1 hour)
    channel: null            # CLI only (no channel notification)
    agent: main
```

---

## Cron 表达式格式

标准 cron 格式: `minute hour day-of-month month day-of-week`

| Field | Values | Special Characters |
|-------|--------|-------------------|
| Minute | 0-59 | `*` `,` `-` `/` |
| Hour | 0-23 | `*` `,` `-` `/` |
| Day of Month | 1-31 | `*` `,` `-` `/` |
| Month | 1-12 | `*` `,` `-` `/` |
| Day of Week | 0-6 (Sun=0) | `*` `,` `-` `/` |

**示例**:
- `0 9 * * *` - Every day at 9:00 AM
- `30 8 * * 1-5` - Weekdays at 8:30 AM
- `0 */2 * * *` - Every 2 hours
- `0 0 1 * *` - First day of every month at midnight

---

## 输出示例

**`viben cron list` (Human)**:
```
Scheduled Jobs:
  daily-greeting     enabled    "0 9 * * *"      next: 2024-01-17 09:00
  weekly-review      enabled    "0 17 * * 5"     next: 2024-01-19 17:00
  hourly-check       disabled   every 3600s      -
```

**`viben cron show daily-greeting` (Human)**:
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

**`viben cron list --json`**:
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

---

## Acceptance Criteria

### Cron Management
- [ ] `viben cron list` 列出所有 cron jobs
- [ ] `viben cron add --name <name> --message <msg> --cron "<expr>"` 添加 cron 任务
- [ ] `viben cron add --name <name> --message <msg> --every <seconds>` 添加间隔任务
- [ ] `viben cron remove <job_id>` 删除 cron job
- [ ] `viben cron enable <job_id>` 启用 cron job
- [ ] `viben cron disable <job_id>` 禁用 cron job
- [ ] `viben cron show <job_id>` 显示 cron job 详情
- [ ] `viben cron run <job_id>` 立即执行 cron job
- [ ] Cron 配置存储在 `~/.viben/cron.yaml`
- [ ] 支持标准 cron 表达式格式
- [ ] 支持 `--every` 秒数间隔格式
- [ ] Cron jobs 可指定目标 channel 和 agent

---

## Related Documents

- [channel.md](./channel.md) - Channel 管理
- [gateway.md](./gateway.md) - Gateway 运行时

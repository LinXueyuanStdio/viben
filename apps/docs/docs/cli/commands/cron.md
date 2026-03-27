---
sidebar_position: 13
title: "viben cron"
description: "Manage agent scheduled tasks"
---

# viben cron

Manage agent scheduled tasks.

## Usage

```bash
viben cron <subcommand> [options]
```

## Subcommands

| Subcommand | Description |
|------------|-------------|
| `list` | List all scheduled jobs |
| `add` | Add a scheduled job |
| `remove <job_id>` | Remove a scheduled job |
| `enable <job_id>` | Enable a scheduled job |
| `disable <job_id>` | Disable a scheduled job |
| `show <job_id>` | Show job details |
| `run <job_id>` | Run job immediately (for testing) |

## Commands

### List Scheduled Jobs

```bash
# List all scheduled jobs
viben cron list
viben cron list --json
```

**Output (human-readable):**

```
Scheduled Jobs:
  daily-greeting     enabled    "0 9 * * *"      next: 2024-01-17 09:00
  weekly-review      enabled    "0 17 * * 5"     next: 2024-01-19 17:00
  hourly-check       disabled   every 3600s      -
```

**Output (JSON):**

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

### Add Scheduled Job

Add a scheduled job using cron expression:

```bash
# Using cron expression
viben cron add --name <name> --message "<message>" --cron "<cron-expr>"
viben cron add --name "daily-greeting" --message "Good morning! What's on my schedule today?" --cron "0 9 * * *"
viben cron add --name "weekly-review" --message "Summarize this week's accomplishments" --cron "0 17 * * 5"

# Using interval in seconds
viben cron add --name <name> --message "<message>" --every <seconds>
viben cron add --name "hourly-check" --message "Check for any urgent tasks" --every 3600
viben cron add --name "quick-poll" --message "Any updates?" --every 300
```

**Output:**

```
Added cron job 'daily-greeting'
  Schedule: 0 9 * * * (Every day at 9:00 AM)
  Next run: 2024-01-17 09:00:00
```

### Remove Scheduled Job

```bash
viben cron remove daily-greeting
```

**Output:**

```
Removed cron job 'daily-greeting'
```

### Enable/Disable Scheduled Job

```bash
# Enable
viben cron enable hourly-check

# Disable
viben cron disable hourly-check
```

### Show Job Details

```bash
viben cron show daily-greeting
```

**Output:**

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

### Run Job Immediately

```bash
# For testing
viben cron run daily-greeting
```

## Cron Configuration

```yaml
# ~/.viben/cron.yaml
version: 1

jobs:
  daily-greeting:
    enabled: true
    message: "Good morning! What's on my schedule today?"
    cron: "0 9 * * *"        # Every day at 9:00 AM
    channel: my-telegram     # Channel to send response
    agent: main              # Agent to use

  weekly-review:
    enabled: true
    message: "Summarize this week's accomplishments"
    cron: "0 17 * * 5"       # Every Friday at 5:00 PM
    channel: my-telegram
    agent: main

  hourly-check:
    enabled: false
    message: "Check for any urgent tasks"
    every: 3600              # Every 3600 seconds (1 hour)
    channel: null            # CLI only (no channel notification)
    agent: main
```

## Cron Expression Format

Standard cron format: `minute hour day-of-month month day-of-week`

| Field | Value Range | Special Characters |
|-------|-------------|-------------------|
| Minute | 0-59 | `*` `,` `-` `/` |
| Hour | 0-23 | `*` `,` `-` `/` |
| Day of Month | 1-31 | `*` `,` `-` `/` |
| Month | 1-12 | `*` `,` `-` `/` |
| Day of Week | 0-6 (0=Sunday) | `*` `,` `-` `/` |

**Examples:**

| Expression | Description |
|------------|-------------|
| `0 9 * * *` | Every day at 9:00 AM |
| `30 8 * * 1-5` | Weekdays at 8:30 AM |
| `0 */2 * * *` | Every 2 hours |
| `0 0 1 * *` | First day of every month at midnight |
| `0 17 * * 5` | Every Friday at 5:00 PM |

## Error Handling

### Job Not Found

```json
{
  "success": false,
  "error": {
    "code": "JOB_NOT_FOUND",
    "message": "Cron job 'unknown-job' not found"
  }
}
```

### Invalid Cron Expression

```json
{
  "success": false,
  "error": {
    "code": "INVALID_CRON",
    "message": "Invalid cron expression: '* * *'"
  }
}
```

### Job Already Exists

```json
{
  "success": false,
  "error": {
    "code": "JOB_EXISTS",
    "message": "Cron job 'daily-greeting' already exists"
  }
}
```

## Related Commands

- [viben channel](./channel) - Channel management
- [viben gateway](./gateway) - Gateway runtime
- [viben agent](./agent) - Agent management

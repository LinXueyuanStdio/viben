---
sidebar_position: 18
title: "viben queue"
description: "命令队列管理，用于任务调度和监控"
---

# viben queue

命令队列管理命令，用于运维、调试和监控队列状态。

## 概述

`viben queue` 命令是 CommandQueue 的 CLI 客户端，与 `/api/queue/*` Gateway 端点共享同一个底层操作层。主要面向 Agent 调试场景，输出信息详尽。

## 命令结构

```bash
viben queue <subcommand> [options]
```

## 子命令概览

| 子命令 | 说明 |
|--------|------|
| `status` | 队列整体状态 |
| `list` | 任务列表 |
| `inspect` | 任务详情 |
| `enqueue` | 提交命令 |
| `cancel` | 取消任务 |
| `retry` | 重试失败任务 |
| `logs` | 查看任务日志 |
| `watch` | 实时监控队列 |
| `config` | 配置管理 |
| `clean` | 清理已完成任务 |

## 队列状态

### 查看状态

```bash
viben queue status [--json]
```

**输出**:

```
Queue Status
────────────────────────────────────────
  Pending:     3 task(s)
  Running:     2 / 3 (max concurrency)
  Completed:   15 task(s)

Running Tasks:
  q_abc123  sleep 60    2m 15s
  q_def456  claude -p   45s

Persistence: ~/.viben/queue/ (healthy)
```

### 列出任务

```bash
viben queue list [--status <status>] [--limit <n>] [--all] [--json]
```

**选项**:

| 选项 | 说明 |
|------|------|
| `--status`, `-s` | 按状态过滤 (pending, running, completed) |
| `--limit`, `-n` | 限制返回数量，默认 50 |
| `--all` | 显示所有任务（包括已完成） |
| `--json` | JSON 格式输出 |

**示例**:

```bash
viben queue list                      # 默认显示 pending + running
viben queue list --status completed   # 只看已完成任务
viben queue list --all --limit 100    # 所有状态，最多 100 条
```

**输出**:

```
ID           STATUS    COMMAND                CREATED       ELAPSED   RETRIES
─────────────────────────────────────────────────────────────────────────────
q_abc123     running   sleep 60               2m ago        2m 15s    0/3
q_def456     running   claude -p "hello"      1m ago        45s       0/3
q_ghi789     pending   npm test               30s ago       -         0/3
q_jkl012     pending   make build             10s ago       -         0/3

Showing 4 of 4 tasks
```

## 任务操作

### 提交命令

```bash
viben queue enqueue --command <cmd> --cwd <path> [options]
viben queue enqueue --stdin --cwd <path> [options]
```

**选项**:

| 选项 | 说明 |
|------|------|
| `--command`, `-c` | 要执行的 bash 命令 |
| `--cwd` | 工作目录 |
| `--stdin` | 从 stdin 读取命令 |
| `--metadata` | JSON 格式的元数据 |
| `--max-retries` | 最大重试次数，默认 3 |
| `--json` | JSON 格式输出 |

**示例**:

```bash
# 直接指定命令
viben queue enqueue --command "sleep 60" --cwd /tmp

# 执行 Claude Code
viben queue enqueue --command 'claude -p "实现用户登录"' --cwd /path/to/project

# 带元数据
viben queue enqueue --command "npm test" --cwd /app --metadata '{"task_dir":".viben/tasks/my-task"}'

# 从 stdin 读取
echo 'npm run build && npm test' | viben queue enqueue --stdin --cwd /app
```

**输出**:

```
Task enqueued successfully
  ID:        q_abc123
  Position:  4 (3 pending ahead)
  Status:    pending

Use 'viben queue inspect q_abc123' to view details
Use 'viben queue logs q_abc123 --follow' to stream output
```

### 取消任务

```bash
viben queue cancel <id> [--force] [--json]
```

**选项**:

| 选项 | 说明 |
|------|------|
| `--force`, `-f` | 强制终止运行中的任务（发送 SIGTERM） |
| `--json` | JSON 格式输出 |

**示例**:

```bash
viben queue cancel q_abc123           # 取消 pending 任务
viben queue cancel q_abc123 --force   # 强制终止 running 任务
```

### 查看任务详情

```bash
viben queue inspect <id> [--json]
```

**输出**:

```
Task: q_abc123
────────────────────────────────────────
Status:      running
Command:     claude -p "实现用户登录"
CWD:         /path/to/project

Timeline:
  Created:   2024-03-03 14:30:00 (2m 15s ago)
  Started:   2024-03-03 14:30:05 (2m 10s ago)
  Elapsed:   2m 10s

Execution:
  PID:       12345
  Log:       ~/.viben/queue/logs/q_abc123.log
  Retries:   0 / 3

Metadata:
  task_dir: .viben/tasks/03-14-user-login
```

### 重试任务

```bash
viben queue retry <id> [--reset-count] [--json]
```

**选项**:

| 选项 | 说明 |
|------|------|
| `--reset-count` | 重置重试计数器为 0 |
| `--json` | JSON 格式输出 |

**示例**:

```bash
viben queue retry q_abc123                # 重试，保持计数
viben queue retry q_abc123 --reset-count  # 重试，重置计数器
```

## 日志和监控

### 查看日志

```bash
viben queue logs <id> [--follow] [--tail <n>] [--timestamps] [--json]
```

**选项**:

| 选项 | 说明 |
|------|------|
| `--follow`, `-f` | 实时跟踪输出 |
| `--tail`, `-n` | 显示最后 N 行，默认全部 |
| `--timestamps` | 显示时间戳 |
| `--json` | JSON 格式输出 |

**示例**:

```bash
viben queue logs q_abc123              # 查看完整日志
viben queue logs q_abc123 --tail 50    # 最后 50 行
viben queue logs q_abc123 --follow     # 实时跟踪
```

### 实时监控

```bash
viben queue watch [--task <id>...] [--events <type>...] [--json]
```

**选项**:

| 选项 | 说明 |
|------|------|
| `--task`, `-t` | 只监控指定任务（可多次指定） |
| `--events`, `-e` | 只显示指定事件类型 |
| `--json` | JSON 格式输出 |

**事件类型**:

| 事件 | 说明 |
|------|------|
| `task:enqueued` | 任务入队 |
| `task:started` | 任务开始执行 |
| `task:completed` | 任务完成 |
| `task:failed` | 任务失败 |
| `queue:status_changed` | 队列状态变化 |

**示例**:

```bash
viben queue watch                                      # 监控所有事件
viben queue watch --task q_abc123                      # 只监控特定任务
viben queue watch --events task:failed,task:completed  # 只看完成和失败
```

## 配置管理

### 查看/修改配置

```bash
viben queue config [--json]                              # 查看配置
viben queue config --set <key>=<value> [--set ...]       # 修改配置
viben queue config --reset                               # 重置为默认值
```

**可配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `max_concurrency` | int | 3 | 最大并发任务数 |
| `promoter_interval_ms` | int | 5000 | Promoter 检查间隔 |
| `monitor_interval_ms` | int | 30000 | Monitor 检查间隔 |
| `default_max_retries` | int | 3 | 默认最大重试次数 |
| `log_retention_days` | int | 7 | 日志保留天数 |
| `completed_retention_days` | int | 30 | 完成记录保留天数 |

**示例**:

```bash
viben queue config                           # 查看当前配置
viben queue config --set max_concurrency=5   # 修改并发数
viben queue config --reset                   # 重置配置
```

## 清理命令

### 清理任务

```bash
viben queue clean [--status <status>] [--before <time>] [--keep <n>] [--dry-run] [--force] [--json]
```

**选项**:

| 选项 | 说明 |
|------|------|
| `--status`, `-s` | 清理指定状态的任务，默认 completed |
| `--before`, `-b` | 只清理指定时间之前的任务 |
| `--keep`, `-k` | 保留最近 N 个任务 |
| `--dry-run` | 预览将被清理的任务，不实际执行 |
| `--force`, `-f` | 跳过确认提示 |
| `--json` | JSON 格式输出 |

**时间格式**: `1h`, `2d`, `1w` (小时/天/周) 或 `2024-03-01`

**示例**:

```bash
viben queue clean                            # 清理所有 completed
viben queue clean --before 1d                # 清理 1 天前的任务
viben queue clean --keep 10                  # 保留最近 10 个
viben queue clean --dry-run                  # 预览，不执行
```

## 任务状态

| 状态 | 说明 |
|------|------|
| pending | 已入队，等待执行 |
| running | 正在执行中 |
| retrying | 执行失败，准备重试 |
| completed | 执行成功完成 |
| failed | 执行失败，已达最大重试次数 |

## 文件持久化

队列数据存储在 `~/.viben/queue/` 目录：

```
~/.viben/queue/
├── config.yaml      # 队列配置
├── state.yaml       # 队列元数据
├── tasks/           # 任务详情
│   ├── task-{id}.yaml
│   └── ...
└── logs/            # 任务日志
    └── {id}.log
```

## 相关命令

- [viben task](./task) - 任务管理命令
- [viben swarm](./swarm) - 智能体集群调度

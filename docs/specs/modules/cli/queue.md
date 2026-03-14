# viben queue

> 命令队列管理命令，用于运维、调试和监控队列状态。

## 概述

`viben queue` 命令是 CommandQueue 的 CLI 客户端，与 `/api/queue/*` Gateway 端点共享同一个底层 `packages/core/src/queue/ops` 操作层。主要面向 Agent 调试场景，输出信息详尽。

## 设计原则

- **调试优先**：输出详尽，便于 Agent 分析问题
- **CLI/API 一致**：所有操作与 Gateway REST API 共享底层 ops
- **格式友好**：默认人类可读，`--json` 输出便于解析

## 架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLI / Gateway                                 │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐         ┌──────────────────┐              │
│  │  viben queue *   │         │  /api/queue/*    │              │
│  │  (CLI commands)  │         │  (REST routes)   │              │
│  └────────┬─────────┘         └────────┬─────────┘              │
│           │                            │                        │
│           └────────────┬───────────────┘                        │
│                        │                                        │
│                        v                                        │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              packages/core/src/queue/ops                   │ │
│  │  enqueue, cancel, retry, status, list, logs, config, clean │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## 命令结构

```
viben queue <subcommand> [options]
```

| 子命令 | 说明 | 对应 ops 函数 | 对应 API |
|--------|------|---------------|----------|
| `status` | 队列整体状态 | `getStatus()` | GET /api/queue/status |
| `list` | 任务列表 | `list()` | GET /api/queue/list |
| `inspect` | 任务详情 | `getItem()` | GET /api/queue/:id |
| `enqueue` | 提交命令 | `enqueue()` | POST /api/queue/enqueue |
| `cancel` | 取消任务 | `cancel()` | DELETE /api/queue/:id |
| `retry` | 重试失败任务 | `retry()` | POST /api/queue/:id/retry |
| `logs` | 查看任务日志 | `getLogs()` | GET /api/queue/:id/logs |
| `watch` | 实时监控队列 | (WebSocket) | WebSocket /ws/queue |
| `config` | 配置管理 | `getConfig()`/`setConfig()` | GET/PUT /api/queue/config |
| `clean` | 清理已完成任务 | `clean()` | DELETE /api/queue/clean |

---

## 队列状态

### `viben queue status`

查看队列整体状态。

```bash
viben queue status [--json]
```

**选项**:
| 选项 | 说明 |
|------|------|
| `--json` | JSON 格式输出 |

**输出内容**:
- 队列概览：pending/running/completed 数量
- 并发配置：当前并发数 / 最大并发数
- 运行中任务：简要列表（ID、命令、耗时）
- 队列健康：持久化状态

**示例输出**:
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

---

### `viben queue list`

列出队列中的任务。

```bash
viben queue list [--status <status>] [--limit <n>] [--json]
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

**示例输出**:
```
ID           STATUS    COMMAND                CREATED       ELAPSED   RETRIES
─────────────────────────────────────────────────────────────────────────────
q_abc123     running   sleep 60               2m ago        2m 15s    0/3
q_def456     running   claude -p "hello"      1m ago        45s       0/3
q_ghi789     pending   npm test               30s ago       -         0/3
q_jkl012     pending   make build             10s ago       -         0/3

Showing 4 of 4 tasks
```

---

## 任务操作

### `viben queue enqueue`

提交命令到队列。

```bash
viben queue enqueue --command <cmd> --cwd <path> [options]
viben queue enqueue --stdin --cwd <path> [options]
```

**选项**:
| 选项 | 说明 |
|------|------|
| `--command`, `-c` | **必需** 要执行的 bash 命令 |
| `--cwd` | **必需** 工作目录 |
| `--stdin` | 从 stdin 读取命令（与 --command 二选一） |
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

---

### `viben queue cancel`

取消任务。

```bash
viben queue cancel <id> [--force] [--json]
```

**选项**:
| 选项 | 说明 |
|------|------|
| `--force`, `-f` | 强制终止运行中的任务（发送 SIGTERM） |
| `--json` | JSON 格式输出 |

**行为**:
- `pending` 任务：直接从队列移除
- `running` 任务：需要 `--force`，否则报错提示

**示例**:
```bash
viben queue cancel q_abc123           # 取消 pending 任务
viben queue cancel q_abc123 --force   # 强制终止 running 任务
```

---

### `viben queue inspect`

查看任务详情。

```bash
viben queue inspect <id> [--json]
```

**输出内容**（详尽，便于调试）:
- 基本信息：ID、状态、创建时间
- 执行信息：命令、工作目录、PID
- 重试信息：当前次数、最大次数
- 元数据：关联的 task_dir 等

**示例输出**:
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

---

### `viben queue retry`

重试失败的任务。

```bash
viben queue retry <id> [--reset-count] [--json]
```

**选项**:
| 选项 | 说明 |
|------|------|
| `--reset-count` | 重置重试计数器为 0 |
| `--json` | JSON 格式输出 |

**行为**:
- 只能对 `completed` 且 exit_code != 0 的任务执行
- 默认保持当前 retryCount，任务重新入队
- `--reset-count` 可重置计数器，获得完整重试次数

**示例**:
```bash
viben queue retry q_abc123                # 重试，保持计数
viben queue retry q_abc123 --reset-count  # 重试，重置计数器
```

---

## 日志和监控

### `viben queue logs`

查看任务输出日志。

```bash
viben queue logs <id> [--follow] [--tail <n>] [--json]
```

**选项**:
| 选项 | 说明 |
|------|------|
| `--follow`, `-f` | 实时跟踪输出（类似 tail -f） |
| `--tail`, `-n` | 显示最后 N 行，默认全部 |
| `--timestamps` | 显示时间戳 |
| `--json` | JSON 格式输出 |

**数据来源**:
- 读取 `~/.viben/queue/logs/{id}.log` 文件

**示例**:
```bash
viben queue logs q_abc123              # 查看完整日志
viben queue logs q_abc123 --tail 50    # 最后 50 行
viben queue logs q_abc123 --follow     # 实时跟踪
```

**示例输出**:
```
[q_abc123] Log output
────────────────────────────────────────
Starting agent: work
Session: sess-001
Input received (256 chars)
Tool: Read /src/auth/login.ts
Tool: Edit /src/auth/login.ts
Tool: Bash npm test
Tests passed (12/12)
Agent completed successfully
```

---

### `viben queue watch`

实时监控队列状态变化。

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
viben queue watch --json                               # JSON 流输出
```

**示例输出**:
```
Watching queue events (Ctrl+C to stop)
────────────────────────────────────────
[14:30:00] queue:status_changed  pending=3 running=2
[14:30:05] task:started          q_abc123 (pid: 12345)
[14:30:25] task:completed        q_abc123 (exit: 0, duration: 20s)
[14:30:25] queue:status_changed  pending=2 running=2
[14:30:26] task:started          q_def456 (pid: 12346)
```

---

## 配置管理

### `viben queue config`

查看或修改队列配置。

```bash
viben queue config [--json]                              # 查看配置
viben queue config --set <key>=<value> [--set ...]       # 修改配置
viben queue config --reset                               # 重置为默认值
```

**选项**:
| 选项 | 说明 |
|------|------|
| `--set` | 设置配置项（可多次指定） |
| `--reset` | 重置为默认配置 |
| `--json` | JSON 格式输出 |

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
viben queue config --set max_concurrency=5 --set default_max_retries=5
viben queue config --reset                   # 重置配置
```

**示例输出**:
```
Queue Configuration
────────────────────────────────────────
  max_concurrency:          3
  promoter_interval_ms:     5000
  monitor_interval_ms:      30000
  default_max_retries:      3
  log_retention_days:       7
  completed_retention_days: 30

Config file: ~/.viben/queue/config.yaml
```

---

## 清理命令

### `viben queue clean`

清理已完成的任务。

```bash
viben queue clean [--status <status>] [--before <time>] [--dry-run] [--json]
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

**时间格式**:
- 相对时间：`1h`, `2d`, `1w` (小时/天/周)
- 绝对时间：`2024-03-01`

**示例**:
```bash
viben queue clean                            # 清理所有 completed
viben queue clean --before 1d                # 清理 1 天前的任务
viben queue clean --keep 10                  # 保留最近 10 个
viben queue clean --dry-run                  # 预览，不执行
```

**示例输出**:
```
Tasks to clean:
  q_abc123  completed  2024-03-01 10:00
  q_def456  completed  2024-03-01 11:30
  q_ghi789  completed  2024-03-02 09:00

Clean 3 task(s)? [y/N] y

Cleaned 3 task(s)
  Removed from ~/.viben/queue/completed/
  Removed logs from ~/.viben/queue/logs/
```

---

## 错误处理

所有命令在遇到错误时输出详尽信息，便于 Agent 诊断问题。

### 常见错误场景

**任务不存在**:
```
Error: Task not found
  ID:      q_abc123
  Reason:  No task with this ID exists

Hint: Use 'viben queue list --all' to see all tasks
```

**无效操作**:
```
Error: Invalid operation
  Task:    q_abc123
  Status:  running
  Action:  cancel (without --force)

Hint: Use 'viben queue cancel q_abc123 --force' to terminate running task
```

**重试不可用**:
```
Error: Cannot retry task
  Task:    q_abc123
  Status:  running
  Reason:  Only completed (failed) tasks can be retried

Current task status:
  Status:   running
  Elapsed:  2m 15s
  PID:      12345
```

---

## 全局选项

所有子命令支持以下全局选项：

| 选项 | 说明 |
|------|------|
| `--json` | JSON 格式输出 |
| `--verbose`, `-v` | 显示详细调试信息 |
| `--help`, `-h` | 显示帮助信息 |

**示例**:
```bash
# 调试模式，显示详细信息
viben queue status --verbose
```

---

## 命令总结

| 命令 | 说明 | 对应 ops | 对应 API |
|------|------|----------|----------|
| `viben queue status` | 队列整体状态 | `getStatus()` | GET /api/queue/status |
| `viben queue list` | 任务列表 | `list()` | GET /api/queue/list |
| `viben queue inspect <id>` | 任务详情 | `getItem()` | GET /api/queue/:id |
| `viben queue enqueue` | 提交命令 | `enqueue()` | POST /api/queue/enqueue |
| `viben queue cancel <id>` | 取消任务 | `cancel()` | DELETE /api/queue/:id |
| `viben queue retry <id>` | 重试任务 | `retry()` | POST /api/queue/:id/retry |
| `viben queue logs <id>` | 任务日志 | `getLogs()` | GET /api/queue/:id/logs |
| `viben queue watch` | 实时监控 | (events) | WebSocket /ws/queue |
| `viben queue config` | 配置管理 | `getConfig()`/`setConfig()` | GET/PUT /api/queue/config |
| `viben queue clean` | 清理任务 | `clean()` | DELETE /api/queue/clean |

---

## Acceptance Criteria

### 状态查看
- [x] `viben queue status` 显示队列概览
- [x] `viben queue status --json` 输出 JSON
- [x] `viben queue list` 列出任务
- [x] `viben queue list --status <s>` 按状态过滤
- [x] `viben queue list --all` 显示所有状态
- [x] `viben queue inspect <id>` 显示详尽任务信息

### 任务操作
- [x] `viben queue enqueue --command <cmd> --cwd <path>` 提交命令
- [ ] `viben queue enqueue --stdin` 从 stdin 读取命令
- [x] `viben queue cancel <id>` 取消 pending 任务
- [x] `viben queue cancel <id> --force` 终止 running 任务
- [x] `viben queue retry <id>` 重试失败任务
- [x] `viben queue retry <id> --reset-count` 重置重试计数

### 日志和监控
- [x] `viben queue logs <id>` 查看任务日志
- [ ] `viben queue logs <id> --follow` 实时跟踪 (尚未实现)
- [x] `viben queue watch` 实时监控队列事件
- [ ] `viben queue watch --task <id>` 过滤特定任务
- [ ] `viben queue watch --events <e>` 过滤事件类型

### 配置和清理
- [x] `viben queue config` 查看配置
- [x] `viben queue config --set <k>=<v>` 修改配置
- [x] `viben queue config --reset` 重置配置
- [x] `viben queue clean` 清理已完成任务
- [x] `viben queue clean --dry-run` 预览清理
- [ ] `viben queue clean --before <t>` 按时间清理

### CLI/API 一致性
- [x] CLI 和 API 共享同一个 ops 层
- [x] 相同参数产生相同结果
- [x] 错误码和错误信息一致

### 错误处理
- [x] 任务不存在时给出提示
- [x] 无效操作时说明原因和解决方案
- [ ] `--verbose` 显示详细信息

---

## Related Documents

- [task.md](./task.md) - 任务管理命令
- [swarm.md](./swarm.md) - 智能体集群调度
- [Queue System Refactor Design](../../../plans/2026-03-15-queue-system-refactor-design.md) - 架构设计文档

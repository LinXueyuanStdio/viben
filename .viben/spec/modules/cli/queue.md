# viben queue

> Gateway 任务队列管理命令，用于运维、调试和监控队列状态。

## 概述

`viben queue` 命令是 Gateway TaskQueueManager 的 CLI 客户端，提供队列状态查看、任务管理和配置调整功能。主要面向 Agent 调试场景，输出信息详尽。

## 设计原则

- **调试优先**：输出详尽，便于 Agent 分析问题
- **功能完整**：覆盖所有 REST API 功能
- **格式友好**：默认人类可读，`--json` 输出便于解析

## 命令结构

```
viben queue <subcommand> [options]
```

| 子命令 | 说明 | 对应 API |
|--------|------|----------|
| `status` | 队列整体状态 | GET /api/queue/status |
| `list` | 任务列表 | GET /api/queue/tasks |
| `inspect` | 任务详情 | GET /api/queue/tasks/:id |
| `enqueue` | 提交任务 | POST /api/queue/enqueue |
| `cancel` | 取消任务 | DELETE /api/queue/tasks/:id |
| `retry` | 重试失败任务 | POST /api/queue/tasks/:id/retry |
| `logs` | 查看任务日志 | GET /api/queue/tasks/:id/stream |
| `watch` | 实时监控队列 | WebSocket /ws/queue |
| `config` | 配置管理 | GET/PUT /api/queue/config |
| `clean` | 清理已完成任务 | DELETE /api/queue/tasks (批量) |

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
- 队列概览：pending/running/completed/failed 数量
- 并发配置：当前并发数 / 最大并发数
- 运行中任务：简要列表（ID、agent、耗时）
- 队列健康：Gateway 连接状态、持久化状态

**示例输出**:
```
Queue Status
────────────────────────────────────────
  Pending:     3 task(s)
  Running:     2 / 3 (max concurrency)
  Completed:   15 task(s)
  Failed:      1 task(s)

Running Tasks:
  task-abc123  agent:coding-assistant  2m 15s
  task-def456  agent:review-agent      45s

Gateway: connected (127.0.0.1:18790)
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
| `--status`, `-s` | 按状态过滤 (pending, running, completed, failed, retrying) |
| `--limit`, `-n` | 限制返回数量，默认 50 |
| `--all` | 显示所有任务（包括已完成） |
| `--json` | JSON 格式输出 |

**示例**:
```bash
viben queue list                      # 默认显示 pending + running
viben queue list --status failed      # 只看失败任务
viben queue list --all --limit 100    # 所有状态，最多 100 条
```

**示例输出**:
```
ID           STATUS    AGENT              CREATED       ELAPSED   RETRIES
─────────────────────────────────────────────────────────────────────────
task-abc123  running   coding-assistant   2m ago        2m 15s    0/3
task-def456  running   review-agent       1m ago        45s       0/3
task-ghi789  pending   coding-assistant   30s ago       -         0/3
task-jkl012  pending   debug-agent        10s ago       -         0/3
task-mno345  failed    coding-assistant   5m ago        -         3/3

Showing 5 of 5 tasks
```

---

## 任务操作

### `viben queue enqueue`

提交任务到队列。

```bash
viben queue enqueue --agent <agent-id> --input <prompt> [options]
viben queue enqueue --agent <agent-id> --stdin [options]
```

**选项**:
| 选项 | 说明 |
|------|------|
| `--agent`, `-a` | **必需** 智能体 ID |
| `--input`, `-i` | 输入 prompt（与 --stdin 二选一） |
| `--stdin` | 从 stdin 读取 prompt |
| `--session`, `-s` | 关联的 session ID |
| `--max-retries` | 最大重试次数，默认 3 |
| `--json` | JSON 格式输出 |

**示例**:
```bash
# 直接指定 prompt
viben queue enqueue --agent coding-assistant --input "实现用户登录功能"

# 从 stdin 读取长 prompt
cat requirements.md | viben queue enqueue --agent coding-assistant --stdin

# 指定 session 和重试次数
viben queue enqueue --agent debug-agent --input "修复 bug" --session sess-001 --max-retries 5
```

**输出**:
```
Task enqueued successfully
  ID:        task-abc123
  Agent:     coding-assistant
  Position:  4 (3 pending ahead)
  Status:    pending

Use 'viben queue inspect task-abc123' to view details
Use 'viben queue logs task-abc123 --follow' to stream output
```

---

### `viben queue cancel`

取消任务。

```bash
viben queue cancel <task-id> [--force] [--json]
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
viben queue cancel task-abc123           # 取消 pending 任务
viben queue cancel task-abc123 --force   # 强制终止 running 任务
```

---

### `viben queue inspect`

查看任务详情。

```bash
viben queue inspect <task-id> [--json]
```

**输出内容**（详尽，便于调试）:
- 基本信息：ID、类型、状态、创建时间
- Agent 配置：agent_id、session_id
- 执行信息：开始时间、耗时、PID
- 重试信息：当前次数、最大次数、历史错误
- Payload：完整的输入参数

**示例输出**:
```
Task: task-abc123
────────────────────────────────────────
Status:      running
Type:        agent-run
Agent:       coding-assistant
Session:     sess-001

Timeline:
  Created:   2024-03-03 14:30:00 (2m 15s ago)
  Started:   2024-03-03 14:30:05 (2m 10s ago)
  Elapsed:   2m 10s

Execution:
  PID:       12345
  Retries:   0 / 3

Payload:
  input: |
    实现用户登录功能，要求：
    1. 支持邮箱和手机号登录
    2. JWT token 认证
    ...
```

---

### `viben queue retry`

重试失败的任务。

```bash
viben queue retry <task-id> [--reset-count] [--json]
```

**选项**:
| 选项 | 说明 |
|------|------|
| `--reset-count` | 重置重试计数器为 0 |
| `--json` | JSON 格式输出 |

**行为**:
- 只能对 `failed` 状态的任务执行
- 默认保持当前 retryCount，任务重新入队
- `--reset-count` 可重置计数器，获得完整重试次数

**示例**:
```bash
viben queue retry task-abc123                # 重试，保持计数
viben queue retry task-abc123 --reset-count  # 重试，重置计数器
```

---

## 日志和监控

### `viben queue logs`

查看任务输出日志。

```bash
viben queue logs <task-id> [--follow] [--tail <n>] [--json]
```

**选项**:
| 选项 | 说明 |
|------|------|
| `--follow`, `-f` | 实时跟踪输出（类似 tail -f） |
| `--tail`, `-n` | 显示最后 N 行，默认全部 |
| `--timestamps` | 显示时间戳 |
| `--json` | JSON 格式输出（每行一个 JSON 对象） |

**数据来源**:
- 连接 `GET /api/queue/tasks/:id/stream` (SSE)
- 包含 Agent 的 stdout/stderr 输出

**示例**:
```bash
viben queue logs task-abc123              # 查看完整日志
viben queue logs task-abc123 --tail 50    # 最后 50 行
viben queue logs task-abc123 --follow     # 实时跟踪
viben queue logs task-abc123 -f --json    # 实时 JSON 流
```

**示例输出**:
```
[task-abc123] Agent output stream
────────────────────────────────────────
[14:30:05] Starting agent: coding-assistant
[14:30:06] Session: sess-001
[14:30:06] Input received (256 chars)
[14:30:08] Tool: Read /src/auth/login.ts
[14:30:10] Tool: Edit /src/auth/login.ts
[14:30:15] Tool: Bash npm test
[14:30:25] Tests passed (12/12)
[14:30:26] Agent completed successfully
```

**--json 输出格式**:
```json
{"ts":1709462405,"level":"info","msg":"Starting agent: coding-assistant"}
{"ts":1709462408,"level":"tool","tool":"Read","path":"/src/auth/login.ts"}
{"ts":1709462410,"level":"tool","tool":"Edit","path":"/src/auth/login.ts"}
```

---

### `viben queue watch`

实时监控队列状态变化。

```bash
viben queue watch [--task <task-id>...] [--events <type>...] [--json]
```

**选项**:
| 选项 | 说明 |
|------|------|
| `--task`, `-t` | 只监控指定任务（可多次指定） |
| `--events`, `-e` | 只显示指定事件类型 |
| `--json` | JSON 格式输出 |

**数据来源**:
- WebSocket `ws://127.0.0.1:18790/ws/queue`

**事件类型**:
| 事件 | 说明 |
|------|------|
| `task:queued` | 任务入队 |
| `task:started` | 任务开始执行 |
| `task:progress` | 任务进度更新 |
| `task:completed` | 任务完成 |
| `task:failed` | 任务失败 |
| `queue:changed` | 队列状态变化 |

**示例**:
```bash
viben queue watch                                    # 监控所有事件
viben queue watch --task task-abc123                 # 只监控特定任务
viben queue watch --events task:failed,task:completed  # 只看完成和失败
viben queue watch --json                             # JSON 流输出
```

**示例输出**:
```
Watching queue events (Ctrl+C to stop)
────────────────────────────────────────
[14:30:00] queue:changed    pending=3 running=2
[14:30:05] task:started     task-abc123 (coding-assistant)
[14:30:10] task:progress    task-abc123 tool=Edit file=/src/auth.ts
[14:30:25] task:completed   task-abc123 (duration: 20s)
[14:30:25] queue:changed    pending=2 running=2
[14:30:26] task:started     task-def456 (review-agent)
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
| `default_max_retries` | int | 3 | 默认最大重试次数 |
| `persist_debounce_ms` | int | 500 | 持久化防抖间隔 |
| `shutdown_timeout_ms` | int | 30000 | 优雅关闭超时 |

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
  max_concurrency:       3
  default_max_retries:   3
  persist_debounce_ms:   500
  shutdown_timeout_ms:   30000

Config file: ~/.viben/queue/config.yaml
```

---

## 清理命令

### `viben queue clean`

清理已完成或失败的任务。

```bash
viben queue clean [--status <status>] [--before <time>] [--dry-run] [--json]
```

**选项**:
| 选项 | 说明 |
|------|------|
| `--status`, `-s` | 清理指定状态的任务，默认 `completed,failed` |
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
viben queue clean                            # 清理所有 completed+failed
viben queue clean --status failed            # 只清理失败任务
viben queue clean --before 1d                # 清理 1 天前的任务
viben queue clean --keep 10                  # 保留最近 10 个
viben queue clean --dry-run                  # 预览，不执行
```

**示例输出**:
```
Tasks to clean:
  task-abc123  completed  2024-03-01 10:00
  task-def456  failed     2024-03-01 11:30
  task-ghi789  completed  2024-03-02 09:00

Clean 3 task(s)? [y/N] y

Cleaned 3 task(s)
  Removed task files from ~/.viben/queue/tasks/
```

---

## 错误处理

所有命令在遇到错误时输出详尽信息，便于 Agent 诊断问题。

### 常见错误场景

**Gateway 连接失败**:
```
Error: Cannot connect to Gateway
  URL:     http://127.0.0.1:18790
  Reason:  Connection refused

Troubleshooting:
  1. Check if Gateway is running: viben gateway status
  2. Start Gateway: viben gateway start
  3. Check port availability: lsof -i :18790
```

**任务不存在**:
```
Error: Task not found
  ID:      task-abc123
  Reason:  No task with this ID exists

Hint: Use 'viben queue list --all' to see all tasks
```

**无效操作**:
```
Error: Invalid operation
  Task:    task-abc123
  Status:  running
  Action:  cancel (without --force)

Hint: Use 'viben queue cancel task-abc123 --force' to terminate running task
```

**重试不可用**:
```
Error: Cannot retry task
  Task:    task-abc123
  Status:  running
  Reason:  Only failed tasks can be retried

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
| `--gateway <url>` | Gateway 地址，默认 `http://127.0.0.1:18790` |
| `--timeout <ms>` | 请求超时，默认 30000ms |
| `--json` | JSON 格式输出 |
| `--verbose`, `-v` | 显示详细调试信息（请求/响应） |
| `--help`, `-h` | 显示帮助信息 |

**示例**:
```bash
# 连接远程 Gateway
viben queue status --gateway http://192.168.1.100:18790

# 调试模式，显示 HTTP 请求详情
viben queue list --verbose
```

**--verbose 输出**:
```
[DEBUG] GET http://127.0.0.1:18790/api/queue/tasks
[DEBUG] Headers: {"Content-Type": "application/json"}
[DEBUG] Response: 200 OK (45ms)
[DEBUG] Body: {"tasks": [...], "total": 5}

ID           STATUS    AGENT              ...
─────────────────────────────────────────────
...
```

---

## 命令总结

| 命令 | 说明 | API |
|------|------|-----|
| `viben queue status` | 队列整体状态 | GET /api/queue/status |
| `viben queue list` | 任务列表 | GET /api/queue/tasks |
| `viben queue inspect <id>` | 任务详情 | GET /api/queue/tasks/:id |
| `viben queue enqueue` | 提交任务 | POST /api/queue/enqueue |
| `viben queue cancel <id>` | 取消任务 | DELETE /api/queue/tasks/:id |
| `viben queue retry <id>` | 重试任务 | POST /api/queue/tasks/:id/retry |
| `viben queue logs <id>` | 任务日志 | GET /api/queue/tasks/:id/stream |
| `viben queue watch` | 实时监控 | WebSocket /ws/queue |
| `viben queue config` | 配置管理 | GET/PUT /api/queue/config |
| `viben queue clean` | 清理任务 | DELETE /api/queue/tasks (批量) |

---

## Acceptance Criteria

### 状态查看
- [ ] `viben queue status` 显示队列概览
- [ ] `viben queue status --json` 输出 JSON
- [ ] `viben queue list` 列出任务
- [ ] `viben queue list --status <s>` 按状态过滤
- [ ] `viben queue list --all` 显示所有状态
- [ ] `viben queue inspect <id>` 显示详尽任务信息

### 任务操作
- [ ] `viben queue enqueue --agent <a> --input <i>` 提交任务
- [ ] `viben queue enqueue --stdin` 从 stdin 读取 prompt
- [ ] `viben queue cancel <id>` 取消 pending 任务
- [ ] `viben queue cancel <id> --force` 终止 running 任务
- [ ] `viben queue retry <id>` 重试 failed 任务
- [ ] `viben queue retry <id> --reset-count` 重置重试计数

### 日志和监控
- [ ] `viben queue logs <id>` 查看任务日志
- [ ] `viben queue logs <id> --follow` 实时跟踪
- [ ] `viben queue logs <id> --json` JSON 流输出
- [ ] `viben queue watch` 实时监控队列事件
- [ ] `viben queue watch --task <id>` 过滤特定任务
- [ ] `viben queue watch --events <e>` 过滤事件类型

### 配置和清理
- [ ] `viben queue config` 查看配置
- [ ] `viben queue config --set <k>=<v>` 修改配置
- [ ] `viben queue config --reset` 重置配置
- [ ] `viben queue clean` 清理已完成任务
- [ ] `viben queue clean --dry-run` 预览清理
- [ ] `viben queue clean --before <t>` 按时间清理

### 错误处理
- [ ] Gateway 连接失败时显示诊断信息
- [ ] 任务不存在时给出提示
- [ ] 无效操作时说明原因和解决方案
- [ ] `--verbose` 显示请求/响应详情

### 全局选项
- [ ] `--gateway <url>` 指定 Gateway 地址
- [ ] `--timeout <ms>` 设置请求超时
- [ ] `--json` 所有命令支持 JSON 输出
- [ ] `--verbose` 调试模式

---

## Related Documents

- [task.md](./task.md) - 任务管理命令
- [swarm.md](./swarm.md) - 智能体集群调度
- [Gateway 任务队列设计](../../../../docs/plans/2026-02-28-gateway-task-queue-design.md) - 底层实现设计

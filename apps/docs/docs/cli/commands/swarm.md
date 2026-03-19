---
sidebar_position: 19
title: "viben swarm"
description: "智能体集群调度命令，管理多智能体并行开发"
---

# viben swarm

智能体集群调度命令，管理多智能体并行开发。

:::warning 废弃通知
`viben swarm start` 已废弃。

**推荐替代命令**：
- 完整流程（plan -> work）：`viben task start <task>`
- 仅执行 work 阶段（跳过 plan）：`viben task work-phase <task>`
:::

## 概述

`viben swarm` 命令用于管理智能体集群，支持在独立的 Git worktree 中启动多个智能体并行工作。

## 命令结构

```bash
viben swarm <subcommand> [options]
```

## 子命令概览

| 子命令 | 说明 |
|--------|------|
| `start` | 启动智能体 (已废弃) |
| `stop` | 停止智能体 |
| `status` | 查看智能体状态 |
| `wait` | 等待智能体完成 |
| `list` | 列出 Worktree |
| `registry` | 显示智能体注册表 |

## 启动智能体 (已废弃)

:::caution
请使用 `viben task work-phase <task>` 代替。
:::

```bash
viben swarm start <task> [options]
```

**选项**:

| 选项 | 说明 |
|------|------|
| `--executor <executor>` | 指定执行器 (CLAUDE_CODE, CURSOR, GEMINI_CLI 等) |
| `--detach` | 后台运行，不阻塞终端 |
| `--resume` | 恢复智能体 session |
| `--session <id>` | 指定 session-id 恢复 |

**迁移指南**:

| 旧命令 | 新命令 |
|--------|--------|
| `viben swarm start <task>` | `viben task start <task>` |
| `viben swarm start <task>` | `viben task work-phase <task>` |

## 停止智能体

```bash
viben swarm stop <task> [--force]
viben swarm stop --all [--force]
```

**选项**:

| 选项 | 说明 |
|------|------|
| `--force` | 强制终止 (SIGKILL) |
| `--all` | 停止所有运行中的智能体 |

**示例**:

```bash
viben swarm stop add-user-auth           # 停止指定智能体 (SIGTERM)
viben swarm stop add-user-auth --force   # 强制终止 (SIGKILL)
viben swarm stop --all                   # 停止所有智能体
```

## 查看状态

```bash
# 查看所有智能体状态
viben swarm status                       # 显示所有智能体摘要
viben swarm status --running             # 只显示运行中
viben swarm status --stopped             # 只显示已停止
viben swarm status --json                # JSON 输出

# 查看特定智能体状态
viben swarm status <task>                # 显示特定智能体
viben swarm status <task> --detail       # 详细状态
viben swarm status <task> --watch        # 实时监控日志
viben swarm status <task> --log          # 显示最近日志条目
```

**选项**:

| 选项 | 说明 |
|------|------|
| `--running` | 只显示运行中的智能体 |
| `--stopped` | 只显示已停止的智能体 |
| `--json` | JSON 格式输出 |
| `--detail` | 显示详细状态 |
| `--watch` | 实时监控智能体日志 |
| `--log` | 显示最近日志条目 |

**输出**:

```
=== Swarm Status ===
Agents: 2 running / 3 registered

Running:
  ▶ add-user-auth [CLAUDE_CODE]
    Phase:    implement (1/3)
    Elapsed:  5m 32s
    Branch:   feature/user-auth
    Modified: 3 file(s)
    Activity: Edit
    PID:      12345

Stopped:
  ○ fix-login-bug [CLAUDE_CODE]
    Status:   in_progress
    "正在分析登录逻辑..."
    Resume:   viben swarm start fix-login-bug --resume
```

## 等待智能体完成

```bash
viben swarm wait [tasks...] [options]
```

**参数**:

| 参数 | 说明 |
|------|------|
| `[tasks...]` | 可选，指定等待的任务列表 |

**选项**:

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `--all` | 等待所有运行中的智能体 | - |
| `--polling-interval-seconds <n>` | 轮询间隔 | 10 |
| `--timeout-seconds <n>` | 单任务超时时间 | 300 |
| `--quiet` | 静默模式 | - |
| `--verbose` | 详细模式 | - |
| `--json` | JSON 格式输出 | - |

**完成状态**:

| 状态 | 说明 |
|------|------|
| `completed` | 进程退出 + task.status 为 completed |
| `failed` | 进程退出 + task.status 为 failed |
| `timeout` | 超时 + 调用 `viben task reject <task>` |
| `exited` | 进程退出但 task.status 未更新 |

**退出码**:

| 退出码 | 含义 |
|--------|------|
| 0 | 所有任务完成 |
| 1 | 有任务超时 |
| 2 | 没有找到任何 agent |
| 3 | 执行错误 |

**示例**:

```bash
# 等待所有智能体
viben swarm wait --all

# 等待指定任务
viben swarm wait task-a task-b task-c

# 自定义超时
viben swarm wait --all --timeout-seconds 600 --polling-interval-seconds 5

# JSON 输出
viben swarm wait --all --json
```

**输出（进度模式）**:

```
Waiting for 3 agents... [10s] 1/3 completed
Waiting for 3 agents... [20s] 1/3 completed
Waiting for 3 agents... [30s] 2/3 completed
Waiting for 3 agents... [40s] 3/3 completed

=== Wait Complete ===
  ✓ task-a    completed  (35s)
  ✓ task-b    completed  (42s)
  ✗ task-c    timeout    (300s)

Summary: 2 completed, 0 failed, 1 timeout
```

## 列出 Worktree

```bash
viben swarm list [--json]
```

**输出**:

```
=== Git Worktrees ===

PATH                                           COMMIT   BRANCH
/path/to/project                               abc1234  [main]
~/.viben/worktrees/feature/user-auth           def5678  [feature/user-auth]

=== Registered Agents ===

  ● add-user-auth (PID: 12345)
    Worktree: ~/.viben/worktrees/feature/user-auth
    Started:  2024-03-03T10:30:00
```

## 查看注册表

```bash
viben swarm registry [--json]
```

**输出**:

```
=== Agent Registry ===

File: .viben/agents/registry.json

{
  "agents": [
    {
      "id": "add-user-auth",
      "worktree_path": "~/.viben/worktrees/feature/user-auth",
      "pid": 12345,
      "task_dir": ".viben/tasks/03-03-add-user-auth",
      "started_at": "2024-03-03T10:30:00",
      "platform": "claude"
    }
  ]
}
```

## 架构概述

```
┌─────────────────────────────────────────────────────────┐
│                    Main Repository                       │
│  .viben/                                                 │
│  ├── tasks/                                              │
│  │   └── 03-03-add-user-auth/                           │
│  │       ├── task.json                                   │
│  │       ├── prd.md                                      │
│  │       └── *.jsonl                                     │
│  └── agents/                                             │
│      └── registry.json                                   │
└─────────────────────────────────────────────────────────┘
                          │
                          │ viben task work-phase (推荐)
                          ▼
┌─────────────────────────────────────────────────────────┐
│              Worktree (Isolated Branch)                  │
│  ~/.viben/worktrees/feature/user-auth/                  │
│  ├── (project files)                                     │
│  ├── .viben/                                             │
│  │   ├── .current-task                                   │
│  │   └── tasks/03-03-add-user-auth/                     │
│  ├── .agent-log                                          │
│  └── .session-id                                         │
│                                                          │
│  [Work Agent Running]                                    │
│    └── Executes task phases: implement → check → finish │
└─────────────────────────────────────────────────────────┘
```

## registry.json 格式

```json
{
  "agents": [
    {
      "id": "add-user-auth",
      "worktree_path": "/Users/dev/.viben/worktrees/feature/user-auth",
      "pid": 12345,
      "task_dir": ".viben/tasks/03-03-add-user-auth",
      "started_at": "2024-03-03T10:30:00",
      "platform": "claude"
    }
  ]
}
```

## worktree.yaml 配置

```yaml
# .viben/worktree.yaml
version: 1

# Worktree 存储位置
base_dir: ~/.viben/worktrees

# 创建 worktree 时复制的文件
copy_files:
  - .env
  - .env.local
  - .envrc

# 创建后执行的命令
post_create:
  - pnpm install
  - pnpm build
```

## 相关命令

- [viben task](./task) - 任务管理命令
- [viben executor](./executor) - Executor 发现和管理

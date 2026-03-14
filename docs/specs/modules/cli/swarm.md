# viben swarm

> 智能体集群调度命令，管理多智能体并行开发。

> ⚠️ **DEPRECATION NOTICE**: `viben swarm start` 已废弃。
>
> **推荐替代命令**：
> - 完整流程（plan → work）：`viben task start <task>`
> - 仅执行 work 阶段（跳过 plan）：`viben task work-phase <task>`
>
> **迁移指南**：
> | 旧命令 | 新命令 | 说明 |
> |--------|--------|------|
> | `viben swarm start <task>` | `viben task start <task>` | 完整执行流程（推荐） |
> | `viben swarm start <task>` | `viben task work-phase <task>` | 仅 work 阶段（需 prd.md 已存在） |
>
> 其他 swarm 命令（status, stop, registry, list）保持不变。

## 概述

`viben swarm` 命令用于管理智能体集群，支持在独立的 Git worktree 中启动多个智能体并行工作。设计参考了 Trellis 的 `multi_agent/` 脚本。

## 命令结构

```
viben swarm <subcommand> [options]
```

---

## 启动智能体

### `viben swarm start` (DEPRECATED)

> ⚠️ **已废弃**: 请使用 `viben task work-phase <task>` 代替。

启动智能体到独立 worktree 执行任务。

```bash
# DEPRECATED - 请使用以下命令代替
viben task work-phase <task>

# 旧命令（仍可使用，但会显示废弃警告）
viben swarm start <task> [options]
```

**选项**:
| 选项 | 说明 |
|------|------|
| `--executor <executor>` | 指定执行器 (CLAUDE_CODE, CURSOR, GEMINI_CLI 等)，默认 CLAUDE_CODE |
| `--detach` | 后台运行，不阻塞终端 |
| `--resume` | 恢复智能体 session（使用保存的 session-id） |
| `--session <id>` | 指定 session-id 恢复（需配合 --resume） |

**前置条件**:
- `task.json` 必须存在且设置了 `branch` 字段
- Plan Agent 已完成（prd.md 存在）
- `agents/work.md` 存在

**流程**:
1. 创建 worktree（如果不存在）并安装依赖
2. 复制环境文件（从 worktree.yaml 配置）
3. 启动 Work Agent 后台运行
4. 注册 agent 到 registry.json

**示例**:
```bash
viben swarm start add-user-auth
viben swarm start add-user-auth --executor CURSOR
viben swarm start add-user-auth --detach

# 恢复已停止的智能体
viben swarm start add-user-auth --resume
viben swarm start add-user-auth --resume --session abc123-def456
```

**输出**:
```
=== Multi-Agent Pipeline: Start ===
[INFO] Task: .viben/tasks/03-03-add-user-auth
[INFO] Branch: feature/user-auth
[INFO] Name: add-user-auth
[INFO] Step 1: Creating worktree...
[INFO] Base branch (PR target): main
[SUCCESS] Worktree created: ~/.viben/worktrees/feature/user-auth
[INFO] Copying environment files...
[SUCCESS] Copied 3 file(s)
[INFO] Step 2: Setting current task in worktree...
[SUCCESS] Current task set: .viben/tasks/03-03-add-user-auth
[INFO] Step 3: Starting claude agent...
[SUCCESS] Agent started with PID: 12345

=== Agent Started ===

  ID:        add-user-auth
  PID:       12345
  Session:   abc123-def456
  Worktree:  ~/.viben/worktrees/feature/user-auth
  Task:      .viben/tasks/03-03-add-user-auth
  Log:       ~/.viben/worktrees/feature/user-auth/.agent-log

To monitor: tail -f ~/.viben/worktrees/feature/user-auth/.agent-log
To stop:    kill 12345
To resume:  claude --resume abc123-def456
```

---

## 停止智能体

### `viben swarm stop`

停止运行中的智能体。

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
viben swarm stop --all --force           # 强制停止所有
```

---

## 查看注册表

### `viben swarm registry`

显示智能体注册表。

```bash
viben swarm registry [--json]
```

**示例**:
```bash
viben swarm registry
viben swarm registry --json
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

---

## 查看状态

### `viben swarm status`

查看智能体状态。

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

**摘要输出**:
```
=== Swarm Status ===
Agents: 2 running / 3 registered

Running:
  ▶ add-user-auth [CLAUDE_CODE]
    Phase:    implement (1/4)
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

**示例**:
```bash
viben swarm status
viben swarm status --running
viben swarm status add-user-auth --detail
viben swarm status add-user-auth --watch
```

---

## 列出 Worktree

### `viben swarm list`

列出所有 Git worktree 和注册的智能体。

```bash
viben swarm list [--json]
```

**选项**:
| 选项 | 说明 |
|------|------|
| `--json` | JSON 格式输出 |

**示例**:
```bash
viben swarm list
viben swarm list --json
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

---

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
                          │ viben swarm start (已废弃)
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
│  [Work Agent Running]                                │
│    └── Executes task phases: implement → check → finish │
└─────────────────────────────────────────────────────────┘
```

---

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

---

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

---

## Trellis 命令映射

| Trellis 命令 | viben 命令 | 备注 |
|-------------|-----------|------|
| `start.py <task-dir>` | `viben task work-phase <task>` | ~~`viben swarm start`~~ 已废弃 |
| `cleanup.py --list` | `viben task cleanup --list` | 参阅 [task.md](./task.md) |
| `cleanup.py <branch>` | `viben task cleanup <branch>` | 参阅 [task.md](./task.md) |
| `cleanup.py --merged` | `viben task cleanup --merged` | 参阅 [task.md](./task.md) |
| `cleanup.py --all` | `viben task cleanup --all` | 参阅 [task.md](./task.md) |
| `status.py --registry` | `viben swarm registry` | |

---

## Acceptance Criteria

### 列出
- [ ] `viben swarm list` 列出所有 worktree 和注册的智能体
- [ ] 支持 `--json` 输出

### 启动智能体
- [ ] `viben swarm start` 创建 worktree 并启动智能体
- [ ] 支持 `--executor` 选择不同执行器
- [ ] 支持 `--detach` 后台运行
- [ ] 支持 `--resume` 恢复智能体 session
- [ ] 支持 `--session <id>` 指定 session-id
- [ ] 正确复制环境文件
- [ ] 正确执行 post_create hooks
- [ ] 注册 agent 到 registry

### 停止智能体
- [ ] `viben swarm stop` 正常停止智能体
- [ ] 支持 `--force` 强制终止
- [ ] 支持 `--all` 停止所有智能体

### 状态监控
- [ ] `viben swarm status` 显示所有智能体摘要
- [ ] `viben swarm status <task>` 显示特定智能体
- [ ] 支持 `--running/--stopped` 过滤
- [ ] 支持 `--detail/--watch/--log` 详细监控
- [ ] 支持 `--json` 输出

### 注册表
- [ ] `viben swarm registry` 显示所有注册的智能体
- [ ] 支持 `--json` 输出

---

## Related Documents

- [task.md](./task.md) - 任务管理命令
- [executor.md](./executor.md) - Executor 发现和管理

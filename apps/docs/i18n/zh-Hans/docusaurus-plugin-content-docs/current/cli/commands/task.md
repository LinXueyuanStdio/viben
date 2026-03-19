---
sidebar_position: 17
title: "viben task"
description: "任务管理命令，支持任务的完整生命周期管理"
---

# viben task

任务管理命令，支持任务的完整生命周期管理。

## 概述

`viben task` 命令用于管理开发任务，包括任务的创建、配置、上下文管理、规划和监控。

## 命令结构

```bash
viben task <subcommand> [options]
```

## 子命令概览

| 子命令 | 说明 |
|--------|------|
| `list` | 列出任务 |
| `create` | 创建新任务 |
| `view` | 查看任务详情 |
| `edit` | 编辑任务 |
| `delete` | 删除任务 |
| `finish` | 完成任务 |
| `archive` | 归档任务 |
| `list-archive` | 列出归档任务 |
| `enqueue` | 入队任务 |
| `dequeue` | 移出队列 |
| `pause` | 暂停任务 |
| `resume` | 恢复任务 |
| `review` | 查看待审查任务 |
| `approve` | 批准完成 |
| `reject` | 拒绝返工 |
| `retry` | 重试失败任务 |
| `cancel` | 取消任务 |
| `start` | 启动任务执行 |
| `status` | 查看任务状态 |
| `create-pr` | 创建 Pull Request |

## 任务 CRUD

### 列出任务

```bash
viben task list [--mine] [--status <status>] [--json]
```

**选项**:

| 选项 | 说明 |
|------|------|
| `--mine`, `-m` | 只显示分配给当前开发者的任务 |
| `--status`, `-s` | 按状态过滤 (backlog, in_progress, completed) |
| `--json` | JSON 格式输出 |

**示例**:

```bash
viben task list
viben task list --mine
viben task list --status in_progress --json
```

### 创建任务

```bash
viben task create <title> [options]
```

**选项**:

| 选项 | 说明 |
|------|------|
| `--slug <name>` | 任务标识符，默认从 title 生成 |
| `--assignee <dev>` | 分配给谁，默认当前开发者 |
| `--priority <P0-P3>` | 优先级，默认 P2 |
| `--agent <agent-id>` | 关联的智能体配置 |

**示例**:

```bash
viben task create "Add user authentication"
viben task create "Fix login bug" --slug fix-login --priority P1
viben task create "Implement API" --assignee john --agent coding-assistant
```

### 查看任务

```bash
viben task view <task>
```

**示例**:

```bash
viben task view add-user-auth
viben task view .viben/tasks/03-03-add-user-auth
```

### 编辑任务

```bash
viben task edit <task>
```

### 删除任务

```bash
viben task delete <task> [--force]
```

## 状态生命周期管理

### 入队任务

将任务从 backlog 状态移入 queue 状态。

```bash
viben task enqueue <task> [options]
```

**选项**:

| 选项 | 说明 |
|------|------|
| `--agent <id>` | 执行智能体 ID |
| `--executor <type>` | 执行器类型 (CLAUDE_CODE, CURSOR, OPENCODE, etc.) |
| `--model <id>` | 模型 ID |
| `--priority <p>` | 优先级 (P0/P1/P2/P3) |

**示例**:

```bash
# 基本入队
viben task enqueue 03-10-feature-xyz

# 指定执行配置
viben task enqueue 03-10-feature-xyz --agent my-agent --executor CLAUDE_CODE
```

### 移出队列

```bash
viben task dequeue <task>
```

### 暂停任务

```bash
viben task pause <task>
```

### 恢复任务

```bash
viben task resume <task>
```

### 查看待审查任务

```bash
viben task review <task>
```

**输出**:

```
=== Task Review: 03-10-feature-xyz ===

Title:    实现用户认证功能
Status:   review
Priority: P1

PR URL:   https://github.com/org/repo/pull/123
Branch:   feature/03-10-feature-xyz

Files Changed: 12
+425 -89

Next steps:
  viben task approve 03-10-feature-xyz   # 批准完成
  viben task reject 03-10-feature-xyz    # 拒绝返工
```

### 批准任务

```bash
viben task approve <task>
```

### 拒绝任务

```bash
viben task reject <task> [--reason <text>]
```

### 重试任务

```bash
viben task retry <task>
```

### 取消任务

```bash
viben task cancel <task> [--reason <text>] [--force]
viben task stop <task>   # cancel 的别名
```

**选项**:

| 选项 | 说明 |
|------|------|
| `--reason <text>` | 取消原因 |
| `--force`, `-f` | 强制取消 in_progress 状态的任务 |

## 任务执行

### 启动任务

```bash
viben task start <task> [options]
```

**选项**:

| 选项 | 说明 |
|------|------|
| `--executor <type>` | 执行器类型 |
| `--detach` | 后台运行 |
| `--worktree` | 在隔离的 git worktree 中运行 |
| `--resume` | 恢复已有的智能体 session |
| `--session <id>` | 指定 session-id |

**执行流程**:
1. 调用 Plan Agent 规划任务
2. 调用 Work Agent 执行任务
3. 自动创建 worktree（如配置）
4. 完成后进入 review 状态

**示例**:

```bash
viben task start add-user-auth
viben task start add-user-auth --executor CURSOR
viben task start add-user-auth --resume
```

### 阶段命令

```bash
# 运行 Plan 阶段
viben task plan-phase <task> [--platform <platform>] [--verbose]

# 运行 Work 阶段
viben task work-phase <task> [--platform <platform>] [--no-detach]

# 运行 Implement 阶段
viben task implement-phase <task>

# 运行 Check 阶段
viben task check-phase <task>
```

### 查看状态

```bash
# 查看所有任务状态
viben task status

# 查看特定任务状态
viben task status <task> [--detail] [--watch] [--log]
```

**选项**:

| 选项 | 说明 |
|------|------|
| `--assignee`, `-a` | 按分配人过滤 |
| `--status`, `-s` | 按状态过滤 |
| `--running` | 只显示有运行中智能体的任务 |
| `--json` | JSON 格式输出 |
| `--detail` | 显示详细状态 |
| `--watch` | 实时监控智能体日志 |
| `--log` | 显示最近日志条目 |

### 创建 PR

```bash
viben task create-pr <task> [--dry-run]
```

## 上下文管理

### 初始化上下文

```bash
viben task init-context <task>
```

创建 `implement.jsonl`、`check.jsonl`、`fix.jsonl` 文件。

### 添加上下文

```bash
viben task add-context <task> <file>... [--reason <text>] [--recursive]
```

**示例**:

```bash
viben task add-context add-user-auth src/auth/
viben task add-context add-user-auth docs/api.md --reason "API 参考文档"
```

### 移除上下文

```bash
viben task remove-context <task> <file>...
```

### 列出上下文

```bash
viben task list-context <task>
```

### 验证上下文

```bash
viben task validate-context <task>
```

## 归档管理

### 完成任务

```bash
viben task finish <task>
```

### 归档任务

```bash
viben task archive <task>
```

任务会被移动到 `archive/YYYY-MM/` 目录。

### 列出归档任务

```bash
viben task list-archive [YYYY-MM]
```

### 清理 Worktree

```bash
# 清理指定分支的 worktree
viben task cleanup <branch> [--keep-branch] [--yes]

# 清理已合并的 worktree
viben task cleanup --merged [--yes]

# 清理所有 worktree
viben task cleanup --all [--yes]

# 列出所有 worktree
viben task cleanup --list
```

## 状态转换

| 命令 | 允许的起始状态 | 目标状态 |
|------|--------------|---------|
| enqueue | backlog | queue |
| dequeue | queue | backlog |
| pause | queue, in_progress | paused |
| resume | paused | queue 或 in_progress |
| approve | review | completed |
| reject | review | backlog |
| retry | failed | queue |
| cancel | backlog, queue, paused, in_progress*, review | cancelled |

> *`in_progress` 状态需要 `--force` 参数

## 任务目录结构

```
.viben/tasks/
├── 03-03-add-user-auth/
│   ├── task.json           # 任务元数据
│   ├── prd.md              # 产品需求文档 (Plan Agent 生成)
│   ├── implement.jsonl     # 实现阶段上下文
│   ├── check.jsonl         # 检查阶段上下文
│   ├── fix.jsonl           # 修复阶段上下文
│   └── .plan-log           # Plan Agent 日志
└── archive/
    └── 2024-02/
        └── 02-15-old-task/
```

## task.json 格式

```json
{
  "id": "add-user-auth",
  "name": "add-user-auth",
  "title": "Add user authentication",
  "description": "",
  "status": "backlog",
  "priority": "P2",
  "creator": "john",
  "assignee": "john",
  "createdAt": "2024-03-03",
  "completedAt": null,
  "branch": "feature/user-auth",
  "base_branch": "main",
  "worktree_path": null,
  "current_phase": 0,
  "next_action": [
    {"phase": 1, "action": "implement"},
    {"phase": 2, "action": "check"},
    {"phase": 3, "action": "finish"}
  ],
  "commit": null,
  "pr_url": null,
  "subtasks": [],
  "relatedFiles": [],
  "notes": ""
}
```

## 相关命令

- [viben queue](./queue) - 命令队列管理
- [viben swarm](./swarm) - 智能体集群调度
- [viben session](./session) - 会话记录管理

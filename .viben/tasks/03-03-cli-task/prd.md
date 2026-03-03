# Feature: viben task 命令实现

## 概述

实现 `viben task` 命令，用于任务管理。这是最复杂的命令，包含多个子命令。底层调用现有 Python 脚本。

## 需求

### 子命令清单

#### 任务 CRUD
- `viben task list [--mine] [--status] [--json]`
- `viben task create <title> [--slug] [--assignee] [--priority] [--agent]`
- `viben task view <task>`
- `viben task edit <task>`
- `viben task delete <task> [--force]`

#### 任务状态
- `viben task start <task> [--resume]`
- `viben task finish [task]`
- `viben task archive <task>`
- `viben task list-archive [YYYY-MM]`

#### 任务配置
- `viben task set-branch <task> --branch <name>`
- `viben task set-base <task> --branch <name>`
- `viben task set-scope <task> --scope <name>`
- `viben task set-agent <task> --agent <id>`

#### 上下文管理
- `viben task init-context <task> --type <type>`
- `viben task add-context <task> <file>... [--reason] [--recursive]`
- `viben task remove-context <task> <file>...`
- `viben task list-context <task>`
- `viben task validate-context <task>`

#### 任务规划与监控
- `viben task plan --name --type --requirement`
- `viben task status [--assignee] [--status] [--running] [--json]`
- `viben task status <task> [--detail] [--watch] [--log]`
- `viben task create-pr [task] [--dry-run]`

### 技术方案

1. 在 `packages/core/src/cli/commands/` 创建 `task.ts`
2. 调用 Python 脚本

### Python 脚本映射

| 命令 | 脚本 |
|------|------|
| `viben task *` (大部分) | `task.py` |
| `viben task plan` | `multi_agent/plan.py` |
| `viben task status` | `multi_agent/status.py` |
| `viben task create-pr` | `multi_agent/create_pr.py` |

### 命令映射到 task.py 子命令

```bash
# CRUD
viben task list          → task.py list
viben task create        → task.py create
viben task start         → task.py start
viben task finish        → task.py finish
viben task archive       → task.py archive
viben task list-archive  → task.py list-archive

# 配置
viben task set-branch    → task.py set-branch
viben task set-base      → task.py set-base-branch
viben task set-scope     → task.py set-scope

# 上下文
viben task init-context      → task.py init-context
viben task add-context       → task.py add-context
viben task remove-context    → task.py remove-context (需验证)
viben task list-context      → task.py list-context
viben task validate-context  → task.py validate
```

## Acceptance Criteria

- [ ] 创建 `packages/core/src/cli/commands/task.ts`
- [ ] 实现所有 CRUD 子命令
- [ ] 实现所有状态管理子命令
- [ ] 实现所有配置子命令
- [ ] 实现所有上下文管理子命令
- [ ] 实现 plan/status/create-pr 子命令
- [ ] 在 `commands/index.ts` 注册命令
- [ ] 添加单元测试 `task.test.ts`
- [ ] `pnpm build` 编译通过

## 相关文件

- `.trellis/spec/modules/cli/task.md` - Spec 文档
- `packages/core/templates/viben/scripts/task.py` - 主要 Python 脚本
- `packages/core/templates/viben/scripts/multi_agent/plan.py` - Plan Agent
- `packages/core/templates/viben/scripts/multi_agent/status.py` - Status
- `packages/core/templates/viben/scripts/multi_agent/create_pr.py` - Create PR

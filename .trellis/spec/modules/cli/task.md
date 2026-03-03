# viben task

> 任务管理命令，支持任务的完整生命周期管理。

## 概述

`viben task` 命令用于管理开发任务，包括任务的创建、配置、上下文管理、规划和监控。设计参考了 Trellis 的 `task.py` 和 GitHub CLI (`gh`) 的命令风格。

## 命令结构

```
viben task <subcommand> [options]
```

---

## 任务 CRUD

### `viben task list`

列出任务。

```bash
viben task list [--mine] [--status <status>] [--json]
```

**选项**:
| 选项 | 说明 |
|------|------|
| `--mine`, `-m` | 只显示分配给当前开发者的任务 |
| `--status`, `-s` | 按状态过滤 (planning, in_progress, completed) |
| `--json` | JSON 格式输出 |

**示例**:
```bash
viben task list
viben task list --mine
viben task list --status in_progress --json
```

---

### `viben task create`

创建新任务。

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

**输出**: 返回任务目录路径，如 `.viben/tasks/03-03-add-user-auth`

---

### `viben task view`

查看任务详情。

```bash
viben task view <task>
```

**示例**:
```bash
viben task view add-user-auth
viben task view .viben/tasks/03-03-add-user-auth
```

---

### `viben task edit`

编辑任务（打开编辑器）。

```bash
viben task edit <task>
```

---

### `viben task delete`

删除任务。

```bash
viben task delete <task> [--force]
```

---

## 任务状态

### `viben task start`

设为当前任务。

```bash
viben task start <task>
viben task start <task> --resume
```

**选项**:
| 选项 | 说明 |
|------|------|
| `--resume` | 同时恢复关联的智能体 session（如有） |

设置后，hook 会自动注入该任务的上下文文件。

**示例**:
```bash
viben task start add-user-auth
viben task start add-user-auth --resume    # 恢复智能体
```

---

### `viben task finish`

完成当前任务。

```bash
viben task finish [task]
```

如果不指定 task，清除当前任务。

---

### `viben task archive`

归档已完成的任务。

```bash
viben task archive <task>
```

任务会被移动到 `archive/YYYY-MM/` 目录。

---

### `viben task list-archive`

列出归档任务。

```bash
viben task list-archive [YYYY-MM]
```

**示例**:
```bash
viben task list-archive           # 列出所有月份
viben task list-archive 2024-03   # 列出指定月份
```

---

## 任务配置

### `viben task set-branch`

设置 Git 分支。

```bash
viben task set-branch <task> --branch <branch-name>
```

**示例**:
```bash
viben task set-branch add-user-auth --branch feature/user-auth
```

---

### `viben task set-base`

设置 PR 目标分支。

```bash
viben task set-base <task> --branch <branch-name>
```

**示例**:
```bash
viben task set-base add-user-auth --branch develop
```

---

### `viben task set-scope`

设置 scope（用于 PR 标题）。

```bash
viben task set-scope <task> --scope <scope-name>
```

**示例**:
```bash
viben task set-scope add-user-auth --scope auth
# PR 标题: feat(auth): add-user-auth
```

---

### `viben task set-agent`

设置关联的智能体配置。

```bash
viben task set-agent <task> --agent <agent-id>
```

---

## 上下文管理

### `viben task init-context`

初始化上下文文件。

```bash
viben task init-context <task> --type <type>
```

**类型**:
| 类型 | 说明 |
|------|------|
| `frontend` | 前端开发 |
| `backend` | 后端开发 |
| `fullstack` | 全栈开发 |
| `test` | 测试 |
| `docs` | 文档 |

创建的文件:
- `implement.jsonl` - 实现阶段上下文
- `check.jsonl` - 检查阶段上下文
- `debug.jsonl` - 调试阶段上下文

**示例**:
```bash
viben task init-context add-user-auth --type backend
```

---

### `viben task add-context`

添加上下文文件。

```bash
viben task add-context <task> <file>... [--reason <text>] [--recursive]
```

**选项**:
| 选项 | 说明 |
|------|------|
| `--reason <text>` | 添加原因 |
| `--recursive` | 递归添加目录 |

**示例**:
```bash
viben task add-context add-user-auth src/auth/
viben task add-context add-user-auth docs/api.md --reason "API 参考文档"
```

---

### `viben task remove-context`

移除上下文文件。

```bash
viben task remove-context <task> <file>...
```

---

### `viben task list-context`

列出上下文条目。

```bash
viben task list-context <task>
```

---

### `viben task validate-context`

验证上下文文件（检查引用的文件是否存在）。

```bash
viben task validate-context <task>
```

---

## 任务规划与监控

### `viben task plan`

启动 Plan Agent 规划任务。

```bash
viben task plan --name <task-name> --type <dev-type> --requirement "<text>"
```

**选项**:
| 选项 | 说明 |
|------|------|
| `--name`, `-n` | 任务名称 |
| `--type`, `-t` | 开发类型 (backend, frontend, fullstack) |
| `--requirement`, `-r` | 需求描述 |

**示例**:
```bash
viben task plan --name user-auth --type backend --requirement "实现用户认证功能，包括登录、注册、JWT token"
```

Plan Agent 会:
1. 创建任务目录
2. 生成 prd.md
3. 配置任务参数

---

### `viben task status`

查看任务状态。

```bash
# 查看所有任务状态
viben task status                        # 显示所有任务摘要
viben task status --assignee <dev>       # 按分配人过滤
viben task status --status <status>      # 按状态过滤
viben task status --running              # 只显示有运行中智能体的任务
viben task status --json                 # JSON 输出

# 查看特定任务状态
viben task status <task>                 # 显示特定任务
viben task status <task> --detail        # 详细状态
viben task status <task> --watch         # 实时监控智能体日志
viben task status <task> --log           # 显示最近日志条目
```

**选项**:
| 选项 | 说明 |
|------|------|
| `--assignee`, `-a` | 按分配人过滤 |
| `--status`, `-s` | 按状态过滤 (planning, in_progress, completed) |
| `--running` | 只显示有运行中智能体的任务 |
| `--json` | JSON 格式输出 |
| `--detail` | 显示详细状态 |
| `--watch` | 实时监控智能体日志 |
| `--log` | 显示最近日志条目 |

**摘要输出内容**:

运行中智能体：
- Phase（阶段）、Elapsed（耗时）、Branch（分支）
- Modified files（修改文件数）、Last tool（最后工具）、PID

已停止智能体：
- Status（状态）、最后消息、Resume 命令

普通任务：
- 按 assignee 分组、显示优先级和状态

**示例输出**:
```
=== Multi-Agent Status ===
  Agents:  2 running / 3 registered
  Tasks:   5 planning / 3 in_progress / 10 completed

Running Agents:
▶ add-user-auth [running] [P1] @john
  Phase:    implement (1/4)
  Elapsed:  5m 32s
  Branch:   feature/user-auth
  Modified: 3 file(s)
  Activity: Edit
  PID:      12345

Stopped Agents:
○ fix-login-bug [stopped]
  "正在分析登录逻辑..."
  viben swarm start fix-login-bug --resume

───────────────────────────────────────

@john:
  ● 03-03-add-user-auth (in_progress) [P1]
  ● 03-02-fix-bug (planning) [P2]

@alice:
  ● 03-01-docs (planning) [P3]
```

**示例**:
```bash
viben task status
viben task status --assignee john
viben task status --running
viben task status add-user-auth --detail
viben task status add-user-auth --watch
```

---

### `viben task create-pr`

从任务创建 PR。

```bash
viben task create-pr [task] [--dry-run]
```

**选项**:
| 选项 | 说明 |
|------|------|
| `--dry-run` | 只显示会做什么，不实际执行 |

**流程**:
1. 暂存并提交所有变更（排除 workspace/）
2. 推送到 remote
3. 使用 `gh pr create` 创建 Draft PR
4. 更新 task.json 状态为 completed

**示例**:
```bash
viben task create-pr                    # 使用当前任务
viben task create-pr add-user-auth
viben task create-pr --dry-run          # 预览
```

---

## 任务目录结构

```
.viben/tasks/
├── 03-03-add-user-auth/
│   ├── task.json           # 任务元数据
│   ├── prd.md              # 产品需求文档 (Plan Agent 生成)
│   ├── implement.jsonl     # 实现阶段上下文
│   ├── check.jsonl         # 检查阶段上下文
│   ├── debug.jsonl         # 调试阶段上下文
│   └── .plan-log           # Plan Agent 日志
└── archive/
    └── 2024-02/
        └── 02-15-old-task/
```

---

## task.json 格式

```json
{
  "id": "add-user-auth",
  "name": "add-user-auth",
  "title": "Add user authentication",
  "description": "",
  "status": "planning",
  "dev_type": "backend",
  "scope": "auth",
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
    {"phase": 3, "action": "finish"},
    {"phase": 4, "action": "create-pr"}
  ],
  "commit": null,
  "pr_url": null,
  "subtasks": [],
  "relatedFiles": [],
  "notes": ""
}
```

---

## Trellis 命令映射

| Trellis 命令 | viben 命令 |
|-------------|-----------|
| `task.py create` | `viben task create` |
| `task.py list` | `viben task list` |
| `task.py start` | `viben task start` |
| `task.py finish` | `viben task finish` |
| `task.py archive` | `viben task archive` |
| `task.py list-archive` | `viben task list-archive` |
| `task.py set-branch` | `viben task set-branch` |
| `task.py set-base-branch` | `viben task set-base` |
| `task.py set-scope` | `viben task set-scope` |
| `task.py init-context` | `viben task init-context` |
| `task.py add-context` | `viben task add-context` |
| `task.py list-context` | `viben task list-context` |
| `task.py validate` | `viben task validate-context` |
| `task.py create-pr` | `viben task create-pr` |
| `plan.py` | `viben task plan` |
| `status.py` | `viben task status` |

---

## Acceptance Criteria

### 任务 CRUD
- [ ] `viben task list` 列出所有任务
- [ ] `viben task create` 创建新任务
- [ ] `viben task view` 查看任务详情
- [ ] `viben task edit` 编辑任务
- [ ] `viben task delete` 删除任务

### 任务状态
- [ ] `viben task start` 设为当前任务
- [ ] `viben task finish` 完成当前任务
- [ ] `viben task archive` 归档任务
- [ ] `viben task list-archive` 列出归档任务

### 任务配置
- [ ] `viben task set-branch` 设置 Git 分支
- [ ] `viben task set-base` 设置 PR 目标分支
- [ ] `viben task set-scope` 设置 scope
- [ ] `viben task set-agent` 设置关联智能体

### 上下文管理
- [ ] `viben task init-context` 初始化上下文
- [ ] `viben task add-context` 添加上下文
- [ ] `viben task remove-context` 移除上下文
- [ ] `viben task list-context` 列出上下文
- [ ] `viben task validate-context` 验证上下文

### 任务规划与监控
- [ ] `viben task plan` 启动 Plan Agent
- [ ] `viben task status` 查看状态
- [ ] `viben task status --running` 过滤运行中
- [ ] `viben task status --detail/--watch/--log` 详细监控
- [ ] `viben task start --resume` 恢复智能体
- [ ] `viben task create-pr` 创建 PR

---

## Related Documents

- [swarm.md](./swarm.md) - 智能体集群调度
- [agent.md](./agent.md) - Agent 实例管理

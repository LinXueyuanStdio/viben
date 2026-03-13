# Start Task

创建任务并启动执行。

---

## 流程

### 1. 创建任务 `[AI]`

```bash
viben task create "<title>" [options]
```

**参数:**
- `<title>` - 任务标题（必填，用于 commit/PR 标题）

**选项:**
| 选项 | 说明 | 默认值 |
|------|------|--------|
| `-s, --slug <name>` | 任务标识符 | 从 title 自动生成 |
| `-b, --branch <branch>` | 自定义分支名 | `feature/<slug>` |
| `-a, --assignee <dev>` | 指派开发者 | - |
| `-p, --priority <priority>` | 优先级 (P0/P1/P2/P3) | P2 |
| `-d, --description <text>` | 任务描述 | - |
| `--agent <agent-id>` | 关联的 agent 配置 | - |
| `--executor <type>` | 执行器类型 | - |
| `--model <model>` | 使用的模型 | - |
| `--start` | 自动加入队列 (status: queue) | false |
| `--worktree` | 在 git worktree 中运行 | false |

**执行器类型:** `CLAUDE_CODE`, `CURSOR`, `GEMINI`, `OPENCODE`, `IFLOW`, `CODEX`, `KILO`, `KIRO`, `ANTIGRAVITY`

### 2. 启动任务 `[AI]`

```bash
viben task start <task> [options]
```

**参数:**
- `<task>` - 任务名称或目录（必填）

**选项:**
| 选项 | 说明 | 默认值 |
|------|------|--------|
| `--executor <type>` | 执行器类型 | CLAUDE_CODE |
| `--detach` | 后台运行 | true |
| `--worktree` | 在 git worktree 中运行 | false |
| `--resume` | 恢复已有 session | false |
| `--session <id>` | 指定要恢复的 session ID | - |

这会启动 dispatch agent，自动完成：
- Plan Agent: 分析代码库，编写 PRD
- Implement Agent: 实现功能
- Check Agent: 检查代码质量

---

## 继续已有任务

如果任务目录已存在：

```bash
# 继续执行
viben task start <task>

# 恢复已有 session
viben task start <task> --resume
viben task start <task> --resume --session <session-id>
```

---

## 命令参考

| 命令 | 用途 |
|------|------|
| `viben task create "<title>" --slug <name>` | 创建任务目录 |
| `viben task start <task>` | 启动任务执行 |
| `viben task list` | 列出活跃任务 |
| `viben task list <task>` | 查看任务详情 |
| `viben task context <task>` | 获取任务上下文 |
| `viben task finish <task>` | 完成任务 |
| `viben task work-phase <task>` | 运行 dispatch agent |
| `viben task plan-phase <task>` | 运行 plan agent |

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

这会启动 start.md 工作流，自动完成：
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

### 常用示例

**场景 1: 在主仓库直接开发（适合小改动）**

```bash
# 创建任务，手动启动
viben task create "Fix button alignment" --slug fix-button
viben task start fix-button

# 或一步到位，创建后自动启动
viben task create "Fix button alignment" --slug fix-button --start
```

**场景 2: 在 worktree 中开发（适合大功能，隔离开发）**

```bash
# 创建任务，手动启动
viben task create "Add user authentication" --slug auth --worktree
viben task start auth --worktree

# 或一步到位
viben task create "Add user authentication" --slug auth --worktree --start
```

**`--start` vs 手动启动的区别:**

| 方式 | 命令 | 适用场景 |
|------|------|----------|
| 不带 `--start` | `create` + `start` 分开执行 | 需要先查看/修改任务配置 |
| 带 `--start` | `create --start` 一步完成 | 配置明确，直接开始 |

---

## 命令参考

| 命令 | 用途 |
|------|------|
| `viben task create "<title>" --slug <name>` | 创建任务目录 |
| `viben task start <task>` | 启动任务执行 |
| `viben task list` | 列出活跃任务 |
| `viben task view <task>` | 查看任务详情 |
| `viben task finish <task>` | 完成任务 |

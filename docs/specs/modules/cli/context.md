# viben context

> 获取当前开发上下文，一键了解项目状态。

## 概述

`viben context` 命令用于获取当前开发上下文，包括用户身份、Git 状态、当前任务、运行中的智能体等信息。这对于 AI Agent 启动时了解项目状态非常有用。

## 命令

```bash
viben context             # 显示完整上下文（文本格式）
viben context --json      # JSON 格式输出
```

**选项**:
| 选项 | 说明 |
|------|------|
| `--json`, `-j` | JSON 格式输出 |

---

## 输出内容

### 文本格式

```
========================================
SESSION CONTEXT
========================================

## DEVELOPER
Name: john

## GIT STATUS
Branch: feature/user-auth
Working directory: 3 uncommitted change(s)

Changes:
 M src/auth.ts
 M src/api.ts
?? src/new-file.ts

## RECENT COMMITS
abc1234 feat(auth): add login endpoint
def5678 fix: resolve typo in config
ghi9012 docs: update README

## CURRENT TASK
Path: .viben/tasks/03-03-add-user-auth
Name: add-user-auth
Status: in_progress
Created: 2024-03-03
Description: 实现用户认证功能

[!] This task has prd.md - read it for task details

## ACTIVE TASKS
- 03-03-add-user-auth/ (in_progress) @john
- 03-02-fix-bug/ (backlog) @alice
- 03-01-docs/ (completed) @john
Total: 3 active task(s)

## MY TASKS (Assigned to me)
- [P1] Add user authentication (in_progress)
- [P3] Update documentation (completed)

## JOURNAL FILE
Active file: .viben/workspace/john/journal-1.md
Line count: 1500 / 2000

## PATHS
Workspace: .viben/workspace/john/
Tasks: .viben/tasks/
Spec: docs/specs/

========================================
```

### JSON 格式

```json
{
  "developer": "john",
  "git": {
    "branch": "feature/user-auth",
    "isClean": false,
    "uncommittedChanges": 3,
    "recentCommits": [
      {"hash": "abc1234", "message": "feat(auth): add login endpoint"},
      {"hash": "def5678", "message": "fix: resolve typo in config"},
      {"hash": "ghi9012", "message": "docs: update README"},
      {"hash": "jkl3456", "message": "refactor: clean up code"},
      {"hash": "mno7890", "message": "test: add unit tests"}
    ]
  },
  "tasks": {
    "active": [
      {"dir": "03-03-add-user-auth", "name": "add-user-auth", "status": "in_progress"},
      {"dir": "03-02-fix-bug", "name": "fix-bug", "status": "backlog"},
      {"dir": "03-01-docs", "name": "docs", "status": "completed"}
    ],
    "directory": ".viben/tasks"
  },
  "journal": {
    "file": ".viben/workspace/john/journal-1.md",
    "lines": 1500,
    "nearLimit": false
  }
}
```

---

## 输出字段说明

### developer
当前用户身份。如果未初始化，显示错误信息并提示运行 `viben user init`。

### git
Git 状态信息：
- `branch`: 当前分支
- `isClean`: 工作目录是否干净
- `uncommittedChanges`: 未提交变更数量
- `recentCommits`: 最近 5 个 commit

### tasks
任务信息：
- `active`: 活跃任务列表（排除 archive）
- `directory`: 任务目录路径

### journal
会话日志信息：
- `file`: 当前活跃的 journal 文件
- `lines`: 当前行数
- `nearLimit`: 是否接近 2000 行限制

---

## 示例

```bash
# 查看完整上下文
viben context

# JSON 格式（用于脚本处理）
viben context --json

# 获取当前分支
viben context --json | jq -r '.git.branch'

# 检查是否有未提交变更
viben context --json | jq -r '.git.isClean'
```

---

## Python 脚本映射

| 命令 | 脚本 |
|------|------|
| `viben context` | `get_context.py` |
| `viben context --json` | `get_context.py --json` |

---

## Acceptance Criteria

- [ ] `viben context` 显示完整上下文（文本格式）
- [ ] `viben context --json` JSON 格式输出
- [ ] 显示用户身份
- [ ] 显示 Git 状态（分支、未提交变更、最近 commit）
- [ ] 显示当前任务信息
- [ ] 显示活跃任务列表
- [ ] 显示分配给自己的任务
- [ ] 显示 Journal 文件状态（行数、是否接近限制）
- [ ] 显示重要路径
- [ ] 未初始化用户时显示错误提示

---

## Related Documents

- [user.md](./user.md) - 用户身份管理
- [task.md](./task.md) - 任务管理
- [session.md](./session.md) - 会话记录

# CLI 命令实现规划

> 日期: 2026-03-03
> 目标: 基于现有 Python 脚本，实现 viben CLI 命令，一比一复刻 Trellis 功能

## 1. 实现策略

### 1.1 技术方案

viben CLI 使用 TypeScript 实现，但底层调用现有的 Python 脚本。这样可以：

1. **复用现有实现** - Python 脚本已经完整实现所有功能
2. **保持一致性** - 确保行为与 Trellis 完全一致
3. **降低风险** - 避免重新实现引入 bug

### 1.2 CLI 架构

```
packages/core/src/cli/
├── index.ts                    # CLI 入口
├── commands/
│   ├── task.ts                 # viben task 命令
│   ├── swarm.ts                # viben swarm 命令
│   ├── user.ts                 # viben user 命令 [新建]
│   ├── context.ts              # viben context 命令 [新建]
│   └── session.ts              # viben session 命令 [新建]
└── utils/
    ├── python-runner.ts        # Python 脚本执行器
    └── paths.ts                # 路径工具
```

### 1.3 Python 脚本映射

| viben 命令 | Python 脚本 |
|-----------|-------------|
| `viben task *` | `task.py` |
| `viben task plan` | `multi_agent/plan.py` |
| `viben task status` | `multi_agent/status.py` |
| `viben task create-pr` | `multi_agent/create_pr.py` |
| `viben swarm start` | `multi_agent/start.py` |
| `viben swarm cleanup` | `multi_agent/cleanup.py` |
| `viben swarm status` | `multi_agent/status.py` |
| `viben user init` | `init_developer.py` |
| `viben user get` | `get_developer.py` |
| `viben context` | `get_context.py` |
| `viben session add` | `add_session.py` |

---

## 2. 文件清单

### 2.1 需要更新的 Spec 文件

| 文件 | 更新内容 | 优先级 |
|------|----------|--------|
| `task.md` | 移除 sync-context、添加 --resume、补全 status | P1 |
| `swarm.md` | 添加 status、增强 stop --all、添加 --resume | P1 |

### 2.2 需要新建的 Spec 文件

| 文件 | 内容 | 优先级 |
|------|------|--------|
| `user.md` | viben user init/get | P1 |
| `context.md` | viben context | P1 |
| `session.md` | viben session add/list | P2 |

---

## 3. 详细实现计划

### 3.1 Phase 1: 更新 task.md spec

**文件**: `.trellis/spec/modules/cli/task.md`

**变更**:

1. **移除 sync-context 命令** (line 306-314)
   - 删除该命令的文档
   - 从 Acceptance Criteria 移除

2. **更新 start 命令** (line 108-122)
   ```bash
   viben task start <task>           # 设为当前任务
   viben task start <task> --resume  # 设为当前任务并恢复智能体 session
   ```

3. **补全 status 命令** (line 345-375)
   ```bash
   viben task status                        # 显示所有任务摘要
   viben task status <task>                 # 显示特定任务
   viben task status --assignee <dev>       # 按分配人过滤
   viben task status --status <status>      # 按状态过滤
   viben task status --running              # 只显示有运行中智能体的任务
   viben task status --json                 # JSON 输出

   viben task status <task> --detail        # 详细状态
   viben task status <task> --watch         # 实时监控日志
   viben task status <task> --log           # 显示最近日志
   ```

4. **补全 status 输出内容**
   - 运行中智能体：Phase、Elapsed、Branch、Modified files、Last tool、PID
   - 已停止智能体：Status、最后消息、Resume 命令
   - 普通任务：按 assignee 分组、显示优先级和状态

5. **更新 Acceptance Criteria**
   - 移除 `sync-context`
   - 添加 `--resume` 选项
   - 添加 status 详细功能

---

### 3.2 Phase 2: 更新 swarm.md spec

**文件**: `.trellis/spec/modules/cli/swarm.md`

**变更**:

1. **添加 status 命令**
   ```bash
   viben swarm status                       # 显示所有智能体摘要
   viben swarm status <task>                # 显示特定智能体
   viben swarm status --running             # 只显示运行中
   viben swarm status --stopped             # 只显示已停止
   viben swarm status --json                # JSON 输出

   viben swarm status <task> --detail       # 详细状态
   viben swarm status <task> --watch        # 实时监控日志
   viben swarm status <task> --log          # 显示最近日志
   ```

2. **添加 status 输出示例**
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

3. **增强 stop 命令**
   ```bash
   viben swarm stop <task>           # 停止指定智能体 (SIGTERM)
   viben swarm stop <task> --force   # 强制终止 (SIGKILL)
   viben swarm stop --all            # 停止所有智能体
   viben swarm stop --all --force    # 强制停止所有
   ```

4. **更新 start 命令**
   ```bash
   viben swarm start <task>                              # 启动新智能体
   viben swarm start <task> --executor <EXECUTOR_ID>     # 指定执行器
   viben swarm start <task> --detach                     # 后台运行

   viben swarm start <task> --resume                     # 恢复智能体 session
   viben swarm start <task> --resume --session <id>      # 指定 session-id 恢复
   ```

5. **更新 Acceptance Criteria**

---

### 3.3 Phase 3: 新建 user.md spec

**文件**: `.trellis/spec/modules/cli/user.md`

**内容**:

```markdown
# viben user

> 用户身份管理，支持多开发者/多智能体协作。

## 命令

### `viben user init`

初始化用户身份。

\`\`\`bash
viben user init <name>
\`\`\`

**命名建议**:
- 人类开发者: `john`, `alice`
- Claude Code 智能体: `claude-agent`, `claude-task-001`
- Cursor 智能体: `cursor-agent`

**创建文件**: `.viben/.user`（gitignored）

---

### `viben user get`

获取当前用户身份。

\`\`\`bash
viben user get           # 输出: john
viben user get --json    # 输出: {"user": "john"}
\`\`\`

若未初始化，提示运行 `viben user init`。

---

## 存储

\`\`\`
.viben/
├── .user                 # 用户身份文件（gitignored）
└── workspace/
    └── {user}/           # 每个用户的工作空间
\`\`\`

## Python 脚本映射

| 命令 | 脚本 |
|------|------|
| `viben user init` | `init_developer.py` |
| `viben user get` | `get_developer.py` |

## Acceptance Criteria

- [ ] `viben user init <name>` 初始化用户身份
- [ ] `viben user get` 获取当前用户
- [ ] `viben user get --json` JSON 输出
- [ ] 存储到 `.viben/.user`（重命名自 `.developer`）
- [ ] 未初始化时提示运行 `viben user init`
```

---

### 3.4 Phase 4: 新建 context.md spec

**文件**: `.trellis/spec/modules/cli/context.md`

**内容**:

```markdown
# viben context

> 获取当前开发上下文，一键了解项目状态。

## 命令

### `viben context`

显示完整上下文信息。

\`\`\`bash
viben context             # 显示完整上下文
viben context --json      # JSON 输出
\`\`\`

## 输出内容

- 用户身份
- 当前任务（如有）
- Git 状态（分支、未提交变更）
- 运行中的智能体（如有）
- Journal 文件状态

## 示例输出

**文本格式**:
\`\`\`
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
abc1234 feat(auth): add login
def5678 fix: typo

## CURRENT TASK
Path: .viben/tasks/03-03-add-user-auth
Name: add-user-auth
Status: in_progress
Created: 2024-03-03

[!] This task has prd.md - read it for task details

## ACTIVE TASKS
- 03-03-add-user-auth/ (in_progress) @john
- 03-02-fix-bug/ (planning) @alice
Total: 2 active task(s)

## MY TASKS (Assigned to me)
- [P1] Add user authentication (in_progress)

## JOURNAL FILE
Active file: .viben/workspace/john/journal-1.md
Line count: 1500 / 2000

## PATHS
Workspace: .viben/workspace/john/
Tasks: .viben/tasks/
Spec: .viben/spec/

========================================
\`\`\`

**JSON 格式**:
\`\`\`json
{
  "developer": "john",
  "git": {
    "branch": "feature/user-auth",
    "isClean": false,
    "uncommittedChanges": 3,
    "recentCommits": [
      {"hash": "abc1234", "message": "feat(auth): add login"},
      {"hash": "def5678", "message": "fix: typo"}
    ]
  },
  "tasks": {
    "active": [
      {"dir": "03-03-add-user-auth", "name": "add-user-auth", "status": "in_progress"}
    ],
    "directory": ".viben/tasks"
  },
  "journal": {
    "file": ".viben/workspace/john/journal-1.md",
    "lines": 1500,
    "nearLimit": false
  }
}
\`\`\`

## Python 脚本映射

| 命令 | 脚本 |
|------|------|
| `viben context` | `get_context.py` |

## Acceptance Criteria

- [ ] `viben context` 显示完整上下文
- [ ] `viben context --json` JSON 输出
- [ ] 显示用户身份
- [ ] 显示当前任务信息
- [ ] 显示 Git 状态
- [ ] 显示运行中智能体
- [ ] 显示 Journal 文件状态
```

---

### 3.5 Phase 5: 新建 session.md spec

**文件**: `.trellis/spec/modules/cli/session.md`

**内容**:

```markdown
# viben session

> 会话记录管理，追踪开发进度和知识积累。

## 命令

### `viben session add`

记录一次开发会话。

\`\`\`bash
viben session add --title "实现用户认证" --commit "abc1234" --summary "完成登录和注册功能"
viben session add -t "修复登录Bug" -c "def5678"
\`\`\`

**选项**:
| 选项 | 说明 |
|------|------|
| `--title`, `-t` | 会话标题（必填） |
| `--commit`, `-c` | 关联的 commit hash |
| `--summary`, `-s` | 会话摘要 |
| `--content-file` | 详细内容文件路径 |

**自动行为**:
1. 检测当前 journal 文件行数
2. 若超过 2000 行，自动创建新 journal 文件
3. 追加会话内容
4. 更新 index.md（会话计数、历史表）

---

### `viben session list`

列出会话历史。

\`\`\`bash
viben session list              # 当前用户的会话
viben session list --all        # 所有用户的会话
viben session list --limit 10   # 最近 10 条
viben session list --json       # JSON 输出
\`\`\`

---

## 存储结构

\`\`\`
.viben/workspace/
├── index.md                    # 主索引（活跃开发者表）
└── {user}/
    ├── index.md                # 个人索引（含 @@@auto 标记）
    ├── journal-1.md            # 会话日志（限制 2000 行）
    ├── journal-2.md
    └── ...
\`\`\`

## Journal 文件格式

\`\`\`markdown
## Session 1: 实现用户认证

**Date**: 2024-03-03
**Task**: 实现用户认证

### Summary

完成登录和注册功能

### Main Changes

- 添加 JWT token 验证
- 实现密码加密存储
- 创建登录/注册 API

### Git Commits

| Hash | Message |
|------|---------|
| \`abc1234\` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete
\`\`\`

## Python 脚本映射

| 命令 | 脚本 |
|------|------|
| `viben session add` | `add_session.py` |

## Acceptance Criteria

- [ ] `viben session add` 记录会话
- [ ] `--title` 必填验证
- [ ] 自动检测 journal 行数，超 2000 行创建新文件
- [ ] 更新 index.md
- [ ] `viben session list` 列出会话（需要新增脚本或扩展）
- [ ] `--json` 输出支持
```

---

## 4. Python 脚本更新需求

### 4.1 需要修改的脚本

| 脚本 | 修改内容 |
|------|----------|
| `common/paths.py` | 将 `FILE_DEVELOPER` 改为 `.user`（或保持兼容） |
| `multi_agent/status.py` | 添加 `--running`, `--stopped` 过滤选项 |
| `multi_agent/start.py` | 添加 `--resume` 选项支持 |

### 4.2 需要新增的功能

| 功能 | 脚本位置 | 说明 |
|------|----------|------|
| `viben swarm stop` | `multi_agent/stop.py` | 停止智能体（当前没有） |
| `viben session list` | `list_session.py` | 列出会话历史 |

---

## 5. 实现顺序

### 第一批 (P0) - 核心更新
1. 更新 `task.md` - 移除 sync-context，补全 status
2. 更新 `swarm.md` - 添加 status，增强 stop

### 第二批 (P1) - 新命令
3. 新建 `user.md`
4. 新建 `context.md`

### 第三批 (P2) - 会话管理
5. 新建 `session.md`

### 第四批 (P3) - CLI 实现
6. 实现 TypeScript CLI wrapper
7. 集成测试

---

## 6. 注意事项

### 6.1 文件命名变更

设计文档中使用 `.viben/.user`，但现有脚本使用 `.viben/.developer`。

**建议**: 保持 `.developer` 不变，避免破坏现有功能。在 spec 中说明这一点。

### 6.2 Executor ID 格式

设计文档使用大写格式：`CLAUDE_CODE`, `CURSOR` 等。

现有脚本 `--platform` 使用小写：`claude`, `cursor` 等。

**建议**: CLI 使用大写 ID，内部映射到小写传递给脚本。

### 6.3 Status 命令复用

`viben task status` 和 `viben swarm status` 都调用 `multi_agent/status.py`，但参数不同。

**建议**: 通过参数区分：
- `viben task status` → `status.py` (默认任务视角)
- `viben swarm status` → `status.py --agent-view` (智能体视角)

---

## 7. 相关文档

- [2026-03-03-cli-task-swarm-alignment-design.md](./2026-03-03-cli-task-swarm-alignment-design.md) - 设计方案
- [task.md](../../.trellis/spec/modules/cli/task.md) - 当前 task spec
- [swarm.md](../../.trellis/spec/modules/cli/swarm.md) - 当前 swarm spec
- [executor.md](../../.trellis/spec/modules/cli/executor.md) - executor spec

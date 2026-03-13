# CLI Task & Swarm 对齐 Trellis 设计方案

> 日期: 2026-03-03
> 目标: 完整对齐 Trellis 功能，并根据 viben 定位优化

---

## 1. 整体命令结构

```
viben
├── user                    # 用户身份管理 [新建]
│   ├── init <name>
│   └── get
├── context                 # 上下文获取 [新建]
├── session                 # 会话记录 [新建]
│   ├── add
│   └── list
├── task                    # 任务管理 [更新]
│   ├── list / create / view / edit / delete
│   ├── start [--resume] / finish / archive / list-archive
│   ├── set-branch / set-base / set-agent
│   ├── init-context / add-context / remove-context / list-context / validate-context
│   ├── plan
│   ├── status [--detail/--watch/--log/--running]
│   └── create-pr
├── swarm                   # 智能体集群 [更新]
│   ├── list
│   ├── start [--resume] / stop [--all]
│   ├── status [--detail/--watch/--log/--running/--stopped]
│   ├── registry
│   └── cleanup [--merged/--all]
└── executor                # 执行器发现 [已有]
    ├── types / list / show
    └── chat
```

---

## 2. 新建 Spec 文件

### 2.1 user.md

用户身份管理，支持多开发者/多智能体协作。

#### 命令

```bash
# 初始化用户身份
viben user init <name>
# 示例:
viben user init john
viben user init claude-agent

# 获取当前用户
viben user get
viben user get --json
```

#### 命名建议

- 人类开发者: `john`, `alice`
- Claude Code 智能体: `claude-agent`, `claude-task-001`
- Cursor 智能体: `cursor-agent`

#### 存储

```
.viben/
├── .user                 # 用户身份文件（gitignored）
└── workspace/
    └── {user}/           # 每个用户的工作空间
```

#### Acceptance Criteria

- [ ] `viben user init <name>` 初始化用户身份
- [ ] `viben user get` 获取当前用户
- [ ] `viben user get --json` JSON 输出
- [ ] 存储到 `.viben/.user`
- [ ] 未初始化时提示运行 `viben user init`

---

### 2.2 context.md

获取当前开发上下文，一键了解项目状态。

#### 命令

```bash
viben context             # 显示完整上下文
viben context --json      # JSON 输出
```

#### 输出内容

- 用户身份
- 当前任务（如有）
- Git 状态（分支、未提交变更）
- 运行中的智能体（如有）

#### 示例输出

```
=== Viben Context ===

User: john

Current Task: .viben/tasks/03-03-add-user-auth
  Status:   in_progress
  Branch:   feature/user-auth
  Phase:    implement (1/4)

Git:
  Branch:   feature/user-auth
  Changes:  3 modified, 1 untracked

Running Agents:
  ● add-user-auth (PID: 12345, elapsed: 5m 32s)
```

#### JSON 输出

```json
{
  "user": "john",
  "currentTask": {
    "path": ".viben/tasks/03-03-add-user-auth",
    "status": "in_progress",
    "branch": "feature/user-auth",
    "phase": 1
  },
  "git": {
    "branch": "feature/user-auth",
    "modified": 3,
    "untracked": 1
  },
  "runningAgents": [
    {"id": "add-user-auth", "pid": 12345, "elapsed": "5m 32s"}
  ]
}
```

#### Acceptance Criteria

- [ ] `viben context` 显示完整上下文
- [ ] `viben context --json` JSON 输出
- [ ] 显示用户身份
- [ ] 显示当前任务信息
- [ ] 显示 Git 状态
- [ ] 显示运行中智能体

---

### 2.3 session.md

会话记录管理，追踪开发进度和知识积累。

#### 命令

```bash
# 记录会话
viben session add --title "实现用户认证" --commit "abc1234" --summary "完成登录和注册功能"
viben session add -t "修复登录Bug" -c "def5678"

# 列出会话
viben session list              # 当前用户的会话
viben session list --all        # 所有用户的会话
viben session list --limit 10   # 最近 10 条
viben session list --json       # JSON 输出
```

#### 选项

| 选项 | 说明 |
|------|------|
| `--title`, `-t` | 会话标题（必填） |
| `--commit`, `-c` | 关联的 commit hash |
| `--summary`, `-s` | 会话摘要 |

#### 自动行为

1. 检测当前 journal 文件行数
2. 若超过 2000 行，自动创建新 journal 文件
3. 追加会话内容
4. 更新 index.md（会话计数、历史表）

#### 存储结构

```
.viben/workspace/
├── index.md                    # 主索引（活跃开发者表）
└── {user}/
    ├── index.md                # 个人索引（含 @@@auto 标记）
    ├── journal-1.md            # 会话日志（限制 2000 行）
    ├── journal-2.md
    └── ...
```

#### Journal 文件格式

```markdown
## 2024-03-03 实现用户认证

**Commit**: abc1234
**Summary**: 完成登录和注册功能

- 添加 JWT token 验证
- 实现密码加密存储
- 创建登录/注册 API

---
```

#### Acceptance Criteria

- [ ] `viben session add` 记录会话
- [ ] `viben session list` 列出会话
- [ ] `--title` 必填验证
- [ ] 自动检测 journal 行数，超 2000 行创建新文件
- [ ] 更新 index.md
- [ ] `--json` 输出支持

---

## 3. 更新现有 Spec 文件

### 3.1 task.md 更新

#### 移除 sync-context

从命令列表和 Acceptance Criteria 中移除 `viben task sync-context`。

#### 更新 start 命令

```bash
viben task start <task>           # 设为当前任务
viben task start <task> --resume  # 设为当前任务并恢复智能体 session
```

| 选项 | 说明 |
|------|------|
| `--resume` | 同时恢复关联的智能体 session（如有） |

#### 补全 status 命令

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

#### Status 摘要输出内容

**运行中智能体**:
- Phase、Elapsed、Branch、Modified files、Last tool、PID

**已停止智能体**:
- Status、最后消息、Resume 命令

**普通任务**:
- 按 assignee 分组、显示优先级和状态

#### 新增 Acceptance Criteria

- [ ] 移除 `sync-context` 命令
- [ ] `viben task start --resume` 恢复智能体
- [ ] `viben task status --detail` 详细状态
- [ ] `viben task status --watch` 实时监控
- [ ] `viben task status --log` 显示日志
- [ ] `viben task status --running` 过滤运行中
- [ ] status 显示 Phase、Elapsed、Last tool 等

---

### 3.2 swarm.md 更新

#### 添加 status 命令

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

#### Status 摘要输出

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

#### 增强 stop 命令

```bash
viben swarm stop <task>           # 停止指定智能体 (SIGTERM)
viben swarm stop <task> --force   # 强制终止 (SIGKILL)
viben swarm stop --all            # 停止所有智能体
viben swarm stop --all --force    # 强制停止所有
```

#### 更新 start 命令

```bash
viben swarm start <task>                              # 启动新智能体
viben swarm start <task> --executor <EXECUTOR_ID>     # 指定执行器
viben swarm start <task> --detach                     # 后台运行

viben swarm start <task> --resume                     # 恢复智能体 session
viben swarm start <task> --resume --session <id>      # 指定 session-id 恢复
```

#### 新增 Acceptance Criteria

- [ ] `viben swarm status` 显示所有智能体摘要
- [ ] `viben swarm status <task>` 显示特定智能体
- [ ] `viben swarm status --running/--stopped` 过滤
- [ ] `viben swarm status --detail/--watch/--log` 详细监控
- [ ] `viben swarm stop --all` 停止所有智能体
- [ ] `viben swarm stop --force` 强制终止
- [ ] `viben swarm start --resume` 恢复智能体
- [ ] `viben swarm start --resume --session <id>` 指定 session

---

## 4. 设计决策记录

| 决策 | 选择 | 原因 |
|------|------|------|
| 命令归属 | 保持现有设计（task/swarm 分离） | 用户只需记住两个主命令 |
| status 功能 | task 和 swarm 两边对称 | 不同视角但功能完整 |
| Developer 管理 | 新增 `viben user` 命令 | 支持多开发者/多智能体协作 |
| Workspace/Session | 新增 `viben session` 命令 | 追踪开发进度和知识积累 |
| sync-context | 移除 | validate-context 已足够 |
| Executor 命名 | 使用 `--executor` + 大写 ID | 如 `CLAUDE_CODE` |
| stop 命令 | 保留并增强 `--all` | 比手动 kill 更友好 |
| resume 功能 | 添加到 task start 和 swarm start | 两处都可恢复 |

---

## 5. 文件清单

| 文件 | 状态 | 路径 |
|------|------|------|
| user.md | 新建 | `.trellis/spec/modules/cli/user.md` |
| context.md | 新建 | `.trellis/spec/modules/cli/context.md` |
| session.md | 新建 | `.trellis/spec/modules/cli/session.md` |
| task.md | 更新 | `.trellis/spec/modules/cli/task.md` |
| swarm.md | 更新 | `.trellis/spec/modules/cli/swarm.md` |

---

## 6. 下一步

1. 创建 `user.md` spec 文件
2. 创建 `context.md` spec 文件
3. 创建 `session.md` spec 文件
4. 更新 `task.md` spec 文件
5. 更新 `swarm.md` spec 文件

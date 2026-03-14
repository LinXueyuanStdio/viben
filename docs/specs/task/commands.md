# viben task 命令速查表

任务全生命周期命令一览。

## 生命周期命令

### 1. 创建阶段

```bash
viben task create "<title>" --slug <name>  # 创建任务目录
viben task view <task>                      # 查看任务详情
viben task edit <task>                      # 编辑任务 (打开编辑器)
```

### 2. 配置阶段

```bash
viben task init-context <task>              # 初始化空上下文文件
viben task add-context <task> <files...>    # 添加上下文文件
viben task remove-context <task> <files...> # 移除上下文文件
viben task list-context <task>              # 列出上下文条目
viben task validate-context <task>          # 验证上下文文件是否存在
viben task set-branch <task> -b <branch>    # 设置 Git 分支
viben task set-base <task> -b <base>        # 设置 PR 目标分支
viben task set-agent <task> -a <agent>      # 设置关联的智能体
```

### 3. 排队阶段

```bash
viben task enqueue <task>     # 加入队列等待执行
viben task dequeue <task>     # 从队列移回 backlog
```

### 4. 执行阶段

```bash
viben task plan-phase <task>  # 启动 Plan Agent 规划任务
viben task work-phase <task>  # 启动 Work Agent 执行任务
viben task start <task>       # 启动智能体执行任务
viben task pause <task>       # 暂停任务执行
viben task resume <task>      # 恢复暂停的任务
viben task status [task]      # 查看任务状态
```

### 5. 审核阶段

```bash
viben task review <task>      # 查看任务详情供人工审核
viben task approve <task>     # 批准任务，标记为完成
viben task reject <task>      # 拒绝任务，返回 backlog
```

### 6. 结束阶段

```bash
viben task finish <task>      # 完成指定任务
viben task retry <task>       # 重试失败的任务
viben task cancel <task>      # 取消任务
viben task stop <task>        # 停止任务 (cancel 别名)
```

### 7. 归档阶段

```bash
viben task archive <task>     # 归档完成的任务
viben task list-archive       # 列出已归档任务
viben task delete <task>      # 删除任务
```

### 8. 辅助命令

```bash
viben task list               # 列出所有任务
viben task context <task>     # 获取指定任务的 AI Agent 会话上下文
viben task add-session        # 添加会话记录到 journal
viben task create-pr <task>   # 从指定任务创建 PR
```

---

## 状态流转图

```
backlog → queue → in_progress → review → completed → archived
                       ↓              ↓
                    paused         rejected → backlog
                       ↓
                    failed → retry → queue
                       ↓
                   cancelled
```

---

## 按状态分类

| 状态 | 进入命令 | 离开命令 |
|------|----------|----------|
| `backlog` | `create`, `reject`, `dequeue` | `enqueue`, `delete` |
| `queue` | `enqueue`, `retry`, `resume` | `start`, `dequeue`, `pause` |
| `in_progress` | `start` | `pause`, `cancel`, (自动→review/failed) |
| `paused` | `pause` | `resume`, `cancel` |
| `review` | (自动) | `approve`, `reject` |
| `completed` | `approve` | `archive` |
| `failed` | (自动) | `retry`, `cancel` |
| `cancelled` | `cancel` | `delete` |
| `archived` | `archive` | `delete` |

---

## 常用选项

| 命令 | 选项 | 说明 |
|------|------|------|
| `create` | `--slug <name>` | 指定任务目录名 |
| `init-context` | - | 初始化空 jsonl 文件 |
| `add-context` | `-r "<reason>"` | 添加原因说明 |
| `set-branch` | `-b <branch>` | 指定分支名 |
| `set-base` | `-b <base>` | 指定 PR 目标分支 |
| `set-agent` | `-a <agent>` | 指定智能体配置 |
| `start` | `--agent <name>` | 使用指定智能体 |
| `reject` | `-r "<reason>"` | 拒绝原因 |
| `cancel` | `-r "<reason>"` | 取消原因 |
| `cancel` | `-f, --force` | 强制取消执行中任务 |
| `delete` | `-f, --force` | 强制删除 |
| `list` | `--status <s>` | 按状态过滤 |
| `list` | `--mine` | 只显示我的任务 |
| `list` | `--json` | JSON 格式输出 |
| `status` | `--verbose` | 详细输出 |
| `context` | `--json` | JSON 格式输出 |

---

## 相关文档

- [lifecycle.md](./lifecycle.md) - 完整生命周期详解
- [example-avatar-upload.md](./example-avatar-upload.md) - 实际使用示例

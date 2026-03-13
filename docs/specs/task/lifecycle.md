# viben task 完整生命周期指令

本文档详细说明 viben task 命令在任务各个生命周期阶段的使用方法。

## 目录

1. [创建阶段](#1-创建阶段)
2. [配置阶段](#2-配置阶段)
3. [排队阶段](#3-排队阶段)
4. [执行阶段](#4-执行阶段)
5. [审核阶段](#5-审核阶段)
6. [结束阶段](#6-结束阶段)
7. [归档阶段](#7-归档阶段)
8. [辅助命令](#8-辅助命令)
9. [状态流转图](#状态流转图)

---

## 1. 创建阶段

任务从创建开始，初始状态为 `backlog`。

```bash
# 创建任务目录
viben task create "<title>" --slug <name>

# 查看任务详情
viben task view <task>

# 编辑任务 (打开编辑器)
viben task edit <task>
```

### 参数说明

| 参数 | 说明 | 示例 |
|------|------|------|
| `<title>` | 任务标题 | `"用户头像上传功能"` |
| `--slug <name>` | 任务目录名 (可选) | `--slug avatar-upload` |

### 创建后的目录结构

```
.viben/tasks/MM-DD-<slug>/
├── task.json      # 任务元数据
└── prd.md         # 需求文档 (手动创建)
```

---

## 2. 配置阶段

配置任务的上下文、分支、智能体等信息。

### 上下文管理

```bash
# 初始化上下文模板
viben task init-context <task> -t <type>
# type: backend | frontend | fullstack

# 添加上下文文件
viben task add-context <task> <files...> -r "<reason>"

# 移除上下文文件
viben task remove-context <task> <files...>

# 列出上下文条目
viben task list-context <task>

# 验证上下文文件是否存在
viben task validate-context <task>
```

### Git 配置

```bash
# 设置 Git 分支
viben task set-branch <task> -b <branch>

# 设置 PR 目标分支 (默认 main)
viben task set-base <task> -b <base>

# 设置 PR 标题 scope
viben task set-scope <task> -s <scope>
```

### 智能体配置

```bash
# 设置关联的智能体
viben task set-agent <task> -a <agent>
```

### 上下文文件类型

| 类型 | 用途 | 示例 |
|------|------|------|
| `implement.jsonl` | 实现阶段注入 | code-spec, 示例代码 |
| `check.jsonl` | 检查阶段注入 | 验证规则, 质量标准 |
| `fix.jsonl` | 修复阶段注入 | 日志规范, 错误处理 |

---

## 3. 排队阶段

将任务从 backlog 加入执行队列。

```bash
# 加入队列等待执行
viben task enqueue <task>

# 从队列移回 backlog
viben task dequeue <task>
```

### 状态变化

```
backlog → queue (enqueue)
queue → backlog (dequeue)
```

---

## 4. 执行阶段

启动智能体执行任务。

```bash
# 启动智能体执行任务
viben task start <task>

# 启动 Plan Agent 规划任务
viben task plan

# 暂停任务执行
viben task pause <task>

# 恢复暂停的任务
viben task resume <task>

# 查看任务状态
viben task status [task]
```

### 执行选项

```bash
# 使用指定智能体
viben task start <task> --agent <agent-name>

# 详细状态输出
viben task status <task> --verbose
```

### 状态变化

```
queue → in_progress (start)
in_progress → paused (pause)
paused → queue (resume)
in_progress → human_review (执行完成)
in_progress → failed (执行失败)
```

---

## 5. 审核阶段

人工审核任务执行结果。

```bash
# 查看任务详情供人工审核
viben task review <task>

# 批准任务，标记为完成
viben task approve <task>

# 拒绝任务，返回 backlog
viben task reject <task> -r "<reason>"
```

### 审核要点

- [ ] 代码符合规范
- [ ] 测试通过
- [ ] 需求完整实现
- [ ] 无安全漏洞

### 状态变化

```
human_review → completed (approve)
human_review → backlog (reject)
```

---

## 6. 结束阶段

处理任务的各种结束情况。

```bash
# 完成指定任务
viben task finish <task>

# 重试失败的任务
viben task retry <task>

# 取消任务
viben task cancel <task> -r "<reason>"

# 停止任务 (cancel 别名)
viben task stop <task>
```

### 状态变化

```
failed → queue (retry)
* → cancelled (cancel)
```

---

## 7. 归档阶段

归档已完成的任务。

```bash
# 归档完成的任务
viben task archive <task>

# 列出已归档任务
viben task list-archive [month]

# 删除任务 (慎用)
viben task delete <task> --force
```

### 归档目录结构

```
.viben/tasks/archive/
└── 2026-03/
    └── 03-12-avatar-upload/
        └── task.json
```

---

## 8. 辅助命令

日常使用的辅助命令。

```bash
# 列出所有任务
viben task list

# 获取指定任务的 AI Agent 会话上下文
viben task context <task>

# 添加会话记录到 journal
viben task add-session --title "<title>" --commit "<hash>" --summary "<summary>"

# 从指定任务创建 PR
viben task create-pr <task>
```

### 列表过滤

```bash
# 按状态过滤
viben task list --status in_progress

# 按分配人过滤
viben task list --assignee viben

# JSON 格式输出
viben task list --json
```

---

## 状态流转图

### 完整状态图

```
                    ┌─────────────────────────────────────────────┐
                    │                                             │
                    ▼                                             │
┌─────────┐    ┌─────────┐    ┌─────────────┐    ┌──────────────┐│
│ backlog │───▶│  queue  │───▶│ in_progress │───▶│ human_review ││
└─────────┘    └─────────┘    └─────────────┘    └──────────────┘│
    ▲              │                │ ▲               │          │
    │              │                │ │               │          │
    │              ▼                ▼ │               ▼          │
    │         (dequeue)        ┌─────────┐      ┌───────────┐    │
    │                          │ paused  │      │ completed │    │
    │                          └─────────┘      └───────────┘    │
    │                               │                 │          │
    │              ┌────────────────┘                 ▼          │
    │              │                            ┌──────────┐     │
    │              ▼                            │ archived │     │
    │         ┌─────────┐                       └──────────┘     │
    └─────────│ failed  │◀───────────────────────────────────────┘
    (reject)  └─────────┘
                   │
                   ▼
              ┌───────────┐
              │ cancelled │
              └───────────┘
```

### 状态说明

| 状态 | 说明 |
|------|------|
| `backlog` | 待办，等待排队 |
| `queue` | 已排队，等待执行 |
| `in_progress` | 正在执行 |
| `paused` | 已暂停 |
| `human_review` | 等待人工审核 |
| `completed` | 已完成 |
| `archived` | 已归档 |
| `failed` | 执行失败 |
| `cancelled` | 已取消 |

### 状态转换命令

| 转换 | 命令 |
|------|------|
| backlog → queue | `viben task enqueue` |
| queue → backlog | `viben task dequeue` |
| queue → in_progress | `viben task start` |
| in_progress → paused | `viben task pause` |
| paused → queue | `viben task resume` |
| in_progress → human_review | (自动，执行完成) |
| in_progress → failed | (自动，执行失败) |
| human_review → completed | `viben task approve` |
| human_review → backlog | `viben task reject` |
| failed → queue | `viben task retry` |
| completed → archived | `viben task archive` |
| * → cancelled | `viben task cancel` |

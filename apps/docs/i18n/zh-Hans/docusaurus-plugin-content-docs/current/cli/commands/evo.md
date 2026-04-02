---
sidebar_position: 24
title: "viben evo"
description: "FileEvo - 基于文件的自我进化代码优化"
---

# viben evo

FileEvo - 基于文件的自我进化，用于代码优化。

## 概述

`viben evo` 命令用于管理 FileEvo 工作流，将代码库视为"模型参数"，使用 PPO 算法迭代优化代码质量。

## 命令结构

```bash
viben evo <子命令> [选项]
```

## 子命令

| 子命令 | 说明 |
|--------|------|
| `create` | 创建新的 FileEvo 目标文件 |
| `start` | 启动 FileEvo 运行 |
| `status` | 查看 FileEvo 运行状态 |
| `list` | 列出所有 FileEvo 运行 |
| `stop` | 停止活跃的 FileEvo 运行 |
| `resume` | 恢复暂停的 FileEvo 运行 |
| `add-idea` | 添加 idea 到 idea 池 |
| `list-ideas` | 列出 idea 池中的 idea |
| `generate-ideas` | 为迭代生成 idea |
| `promote-ideas` | 将 idea 转为任务 |
| `compute-reward` | 计算任务奖励 |
| `select` | 使用 PPO 选择最佳任务 |

## 目标文件管理

### 创建目标文件

```bash
viben evo create <name> [options]
```

**选项**：

| 选项 | 说明 |
|------|------|
| `-d, --description <text>` | 目标描述 |
| `-o, --output <path>` | 输出路径，默认 `<name>.md` |
| `--json` | JSON 格式输出 |

**示例**：

```bash
viben evo create my-optimization
viben evo create code-quality -d "优化代码质量"
```

## 运行管理

### 启动运行

```bash
viben evo start <name-or-target> [options]
```

**参数**：
- `<name-or-target>` - FileEvo 运行名称或目标文件路径 (*.md)

**选项**：

| 选项 | 说明 |
|------|------|
| `--force` | 强制重启（即使运行已激活）|
| `--dry-run` | 仅解析验证，不实际运行 |
| `--json` | JSON 格式输出 |

**示例**：

```bash
# 使用目标文件启动
viben evo start target.md

# 使用运行名称启动（恢复已有运行）
viben evo start my-optimization

# 验证配置
viben evo start target.md --dry-run
```

### 查看状态

```bash
viben evo status <name> [options]
```

**输出示例**：

```
FileEvo Run: my-optimization
Status: active
Phase: execute_tasks

Current Iteration: 3
  Ideas: 5
  Tasks: 5 (3 completed, 2 running)
  Best Reward: 0.846

History:
  Iter 1: 0.823 (task-a selected)
  Iter 2: 0.846 (task-b selected)
```

### 列出运行

```bash
viben evo list [options]
```

**输出**：

```
FileEvo Runs:
  my-optimization    active     iter 3    best: 0.846
  code-quality       paused     iter 1    best: 0.721
  refactoring        completed  iter 5    best: 0.892
```

### 停止/恢复运行

```bash
# 停止
viben evo stop <name>

# 恢复
viben evo resume <name-or-target>
```

## Idea 管理

### 添加 Idea

```bash
viben evo add-idea <name-or-target> <idea-path>
```

### 列出 Idea

```bash
viben evo list-ideas <name-or-target>
```

**输出**：

```
Ideas for my-optimization (iter 1):
  po-a1b2c3d4   "Optimize database queries"    small    promoted
  po-e5f6g7h8   "Refactor auth module"         medium   pending
  po-i9j0k1l2   "Add caching layer"            large    pending
```

### 生成 Idea

```bash
viben evo generate-ideas <name> [options]
```

**选项**：

| 选项 | 说明 |
|------|------|
| `--iter <N>` | 目标迭代轮次 |
| `--types <types...>` | 要生成的 idea 类型 |
| `--json` | JSON 格式输出 |

**示例**：

```bash
# 为当前迭代生成 idea
viben evo generate-ideas my-optimization --types code_improvements

# 为指定迭代生成 idea
viben evo generate-ideas my-optimization --iter 2 --types refactoring performance
```

### 将 Idea 转为任务

```bash
viben evo promote-ideas <name> [options]
```

**选项**：

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `--iter <N>` | 迭代轮次 | 当前迭代 |
| `--ideas <idea...>` | 要 promote 的 idea ID 列表 | 必填 |
| `-s, --slug <name>` | 任务标识符 | 从 idea title 生成 |
| `--executor <type>` | 执行器类型 | target config |
| `--model <model>` | 使用的模型 | target config |
| `--start` | Promote 后自动启动任务执行 | false |
| `--worktree` | 在 git worktree 中运行 | target config |
| `--json` | JSON 格式输出 | false |

**示例**：

```bash
# 将 idea 转为任务（最简方式）
viben evo promote-ideas my-optimization --ideas po-a1b2c3d4

# 批量 promote 多个 idea
viben evo promote-ideas my-optimization --ideas po-a1b2c3d4 po-e5f6g7h8

# 创建并自动启动任务
viben evo promote-ideas my-optimization --ideas po-a1b2c3d4 --start

# 在隔离的 worktree 中开发
viben evo promote-ideas my-optimization --ideas po-a1b2c3d4 --worktree --start
```

## 奖励计算与选择

### 计算奖励

```bash
viben evo compute-reward <name> [options]
```

**选项**：

| 选项 | 说明 |
|------|------|
| `--iter <N>` | 迭代轮次 |
| `--idea <idea>` | Idea ID |
| `--task <task>` | 任务名称 |
| `--json` | JSON 格式输出 |

**示例**：

```bash
# 为特定 idea 的任务计算奖励
viben evo compute-reward my-optimization --idea idea-001

# 为指定迭代的特定任务计算奖励
viben evo compute-reward my-optimization --iter 2 --task 03-27-fix-bug
```

**Reward 格式**：

```json
{
  "total_score": 0.825,
  "diff_lines": 50,
  "scores": {
    "code_quality": { "score": 0.85, "reasoning": "..." },
    "agent_review": { "score": 0.80, "reasoning": "..." }
  },
  "computed_at": "2026-03-27T10:30:00Z"
}
```

### PPO 选择

```bash
viben evo select <name> [options]
```

**选项**：

| 选项 | 说明 |
|------|------|
| `--iter <N>` | 迭代轮次 |
| `--idea <idea>` | 按特定 idea ID 过滤 |
| `--threshold <number>` | 最小调整后奖励阈值，默认 0.6 |
| `--kl-coef <number>` | KL 惩罚系数，默认 0.05 |
| `--json` | JSON 格式输出 |

**输出示例**：

```
PPO Selection Results
=====================

Run: my-optimization | Iteration: 1
Baseline: 0.723 | Threshold: 0.6

TASK      REWARD  DIFF  KL     ADJUSTED  RELATIVE  FINAL   STATUS
task-a    0.858   120   0.012  0.846     +0.123    0.121   SELECTED
task-b    0.721   450   0.045  0.676     -0.047    -0.046  rejected

Selected: task-a
```

## 状态机

FileEvo 每个迭代通过 phase 跟踪进度：

```
init → generate_ideas → promote_ideas → execute_tasks →
       wait_tasks → compute_rewards → select_best → merge_cleanup → completed
```

| Phase | 说明 |
|-------|------|
| `init` | 刚开始，没有任何工作 |
| `generate_ideas` | 生成 ideas |
| `promote_ideas` | 将 ideas 转换为 tasks |
| `execute_tasks` | 启动 task 执行器 |
| `wait_tasks` | 等待 tasks 完成 |
| `compute_rewards` | 计算 rewards |
| `select_best` | PPO 选择最优 |
| `merge_cleanup` | 合并 winner，清理 losers |
| `completed` | 迭代完成 |

## Target 配置

FileEvo 的配置定义在 target.md 文件的 YAML frontmatter 中：

```yaml
---
name: my-optimization
description: 优化 API 响应时间

idea:
  auto_generate: false
  types: [performance_optimizations]
  max_ideas: 5
  batch_size: 3

rollout:
  n: 1
  worktree: true

ppo:
  kl_coef: 0.05
  change_sensitivity: 2.0
  clip_range: 0.2
  quality_threshold: 0.6
  max_diff: 500

convergence:
  threshold: 0.01
  max_iterations: 50
  no_merge_limit: 5

reward:
  types: [test_coverage, code_quality, agent_review]
  weights: [0.34, 0.33, 0.33]

task:
  executor: CLAUDE_CODE
  model: sonnet

enabled: true
---

# My Optimization Target

优化目标描述...
```

## 目录结构

```
.viben/evo/<run-name>/
├── state.json                      # FileEvo 状态
└── iter{N}/                        # 第 N 次迭代
    └── <idea-id>/                  # idea 目录
        ├── idea.md                 # idea 定义
        └── <task-name>/            # rollout task
            ├── reward.json         # reward 结果
            └── reward.log.jsonl    # reward agent 执行日志
```

## 完整工作流示例

```bash
# 1. 创建目标文件
viben evo create my-optimization -d "优化代码质量"

# 2. 启动 FileEvo 循环
viben evo start my-optimization.md

# 3. 生成 idea
viben evo generate-ideas my-optimization --types code_improvements

# 4. 查看生成的 idea
viben evo list-ideas my-optimization

# 5. 将 idea 转为 task 并启动
viben evo promote-ideas my-optimization --ideas po-a1b2c3d4 --start

# 6. 查看状态
viben evo status my-optimization

# 7. 监控任务执行
viben swarm status --watch

# 8. 计算奖励
viben evo compute-reward my-optimization --iter 1

# 9. 选择最佳候选
viben evo select my-optimization

# 10. 合并 winner，清理 loser
viben task approve <winner-task>
viben task cleanup <loser-task>
```

## 相关命令

- [viben task](./task) - 任务管理
- [viben swarm](./swarm) - 多智能体编排
- [viben idea](./idea) - Idea 生成

# viben filerl

> FileRL - File-based Reinforcement Learning for code optimization

## 概述

`viben filerl` 命令用于管理 FileRL 工作流，将代码库视为"模型参数"，使用 PPO 算法迭代优化代码质量。

## 命令结构

```
viben filerl <subcommand> [options]
```

---

## 目标文件管理

### `viben filerl create`

创建新的 FileRL 目标文件。

```bash
viben filerl create <name> [options]
```

**选项**:
| 选项 | 说明 |
|------|------|
| `-d, --description <text>` | 目标描述 |
| `-o, --output <path>` | 输出路径，默认 `<name>.md` |
| `--json` | JSON 格式输出 |

**示例**:
```bash
viben filerl create my-optimization
viben filerl create code-quality -d "优化代码质量"
```

---

## 运行管理

### `viben filerl start`

启动 FileRL 运行。

```bash
viben filerl start <name-or-target> [options]
```

**参数**:
- `<name-or-target>` - FileRL 运行名称或目标文件路径 (*.md)

**选项**:
| 选项 | 说明 |
|------|------|
| `--force` | 强制重启（即使运行已激活） |
| `--dry-run` | 仅解析验证，不实际运行 |
| `--json` | JSON 格式输出 |

**示例**:
```bash
# 使用目标文件启动
viben filerl start target.md

# 使用运行名称启动（恢复已有运行）
viben filerl start my-optimization

# 验证配置
viben filerl start target.md --dry-run
```

---

### `viben filerl status`

查看 FileRL 运行状态。

```bash
viben filerl status <name> [options]
```

**选项**:
| 选项 | 说明 |
|------|------|
| `--json` | JSON 格式输出 |

**示例**:
```bash
viben filerl status my-optimization
viben filerl status my-optimization --json
```

---

### `viben filerl list`

列出所有 FileRL 运行。

```bash
viben filerl list [options]
```

**选项**:
| 选项 | 说明 |
|------|------|
| `--json` | JSON 格式输出 |

---

### `viben filerl stop`

停止活跃的 FileRL 运行。

```bash
viben filerl stop <name> [options]
```

**选项**:
| 选项 | 说明 |
|------|------|
| `--json` | JSON 格式输出 |

---

### `viben filerl resume`

恢复暂停的 FileRL 运行。

```bash
viben filerl resume <name-or-target> [options]
```

**选项**:
| 选项 | 说明 |
|------|------|
| `--json` | JSON 格式输出 |

---

## Idea 管理

### `viben filerl add-idea`

添加 idea 文件到 FileRL 目标的 idea 池。

```bash
viben filerl add-idea <name-or-target> <idea-path> [options]
```

**选项**:
| 选项 | 说明 |
|------|------|
| `--json` | JSON 格式输出 |

---

### `viben filerl list-ideas`

列出 FileRL 目标的 idea 池中的 idea。

```bash
viben filerl list-ideas <name-or-target> [options]
```

**选项**:
| 选项 | 说明 |
|------|------|
| `--json` | JSON 格式输出 |

---

### `viben filerl generate-ideas`

为 FileRL 运行的迭代生成 idea。

```bash
viben filerl generate-ideas <name> [options]
```

**选项**:
| 选项 | 说明 |
|------|------|
| `--iter <N>` | 目标迭代轮次，默认使用 state.json 中的当前迭代 |
| `--types <types...>` | 要生成的 idea 类型 (如 code_improvements, refactoring) |
| `--json` | JSON 格式输出 |

**示例**:
```bash
# 为当前迭代生成 idea
viben filerl generate-ideas my-optimization --types code_improvements

# 为指定迭代生成 idea
viben filerl generate-ideas my-optimization --iter 2 --types refactoring performance
```

**输出目录**: `.viben/filerl/<name>/iter{N}/<idea-id>/idea.md`

---

### `viben filerl promote-ideas`

将 idea 转为 task。支持所有 `viben task create` 的选项。

```bash
viben filerl promote-ideas <name> [options]
```

**参数**:
- `<name>` - FileRL 运行名称

**选项**（与 `viben task create` 一致）:

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `--iter <N>` | 迭代轮次 | state.json 中的当前迭代 |
| `--ideas <idea...>` | 要 promote 的 idea ID 列表 | 必填 |
| `-s, --slug <name>` | 任务标识符 | 从 idea title 生成 |
| `-b, --branch <branch>` | 自定义分支名 | `feature/<slug>` |
| `-a, --assignee <dev>` | 分配给谁 | 当前开发者 |
| `-p, --priority <priority>` | 优先级 (P0-P3) | 根据 effort 映射 |
| `-d, --description <text>` | 任务描述 | idea 的 description |
| `--agent <agent-id>` | 关联的 agent 配置 | - |
| `--executor <type>` | 执行器类型 | target config |
| `--model <model>` | 使用的模型 | target config |
| `--start` | Promote 后自动启动 task 执行 | false |
| `--worktree` | 在 git worktree 中运行 | target config |
| `--json` | JSON 格式输出 | false |

**执行器类型**: `CLAUDE_CODE`, `CURSOR`, `GEMINI`, `OPENCODE`, `IFLOW`, `CODEX`, `KILO`, `KIRO`, `ANTIGRAVITY`

**effort → priority 默认映射**:

| Effort | Priority |
|--------|----------|
| trivial | P3 |
| small | P3 |
| medium | P2 |
| large | P1 |
| complex | P1 |

**示例**:
```bash
# 将 idea 转为任务（最简方式）
viben filerl promote-ideas my-optimization --ideas po-a1b2c3d4

# 批量 promote 多个 idea
viben filerl promote-ideas my-optimization --ideas po-a1b2c3d4 po-e5f6g7h8

# 为指定迭代 promote
viben filerl promote-ideas my-optimization --iter 2 --ideas po-a1b2c3d4

# 创建并自动启动任务
viben filerl promote-ideas my-optimization --ideas po-a1b2c3d4 --start

# 在隔离的 worktree 中开发
viben filerl promote-ideas my-optimization --ideas po-a1b2c3d4 --worktree --start

# 完整示例：指定执行器和模型
viben filerl promote-ideas my-optimization \
  --ideas po-a1b2c3d4 \
  --executor CLAUDE_CODE \
  --model opus \
  --start
```

**执行流程**:

1. 读取指定 idea 的 `idea.md` 文件
2. 为每个 idea 创建 task（使用 target config 或命令行指定的 executor, model, worktree 设置）
3. 更新 state.json 的 `task_idea_map`
4. 如果指定了 `--start`，启动 task 执行

---

## 奖励计算与选择

### `viben filerl compute-reward`

为 FileRL 运行中的任务计算奖励。

```bash
viben filerl compute-reward <name> [options]
```

**参数**:
- `<name>` - FileRL 运行名称

**选项**:
| 选项 | 说明 |
|------|------|
| `--iter <N>` | 迭代轮次，默认使用当前迭代 |
| `--idea <idea>` | Idea ID |
| `--task <task>` | 任务名称 |
| `-p, --platform <platform>` | 平台 (claude, cursor, iflow, opencode)，默认 claude |
| `-v, --verbose` | 详细输出 |
| `--json` | JSON 格式输出 |

**示例**:
```bash
# 为特定 idea 的任务计算奖励
viben filerl compute-reward my-optimization --idea idea-001

# 为指定迭代的特定任务计算奖励
viben filerl compute-reward my-optimization --iter 2 --task 03-27-fix-bug
```

**输出**:
- 奖励结果: `.viben/filerl/<name>/iter{N}/<idea>/<task>/reward.json`
- Agent 执行日志: `.viben/filerl/<name>/iter{N}/<idea>/<task>/reward.log.jsonl`

**Reward 格式**:
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

---

### `viben filerl select`

使用 PPO 指标从 FileRL 运行中选择最佳任务。

```bash
viben filerl select <name> [options]
```

**参数**:
- `<name>` - FileRL 运行名称

**选项**:
| 选项 | 说明 |
|------|------|
| `--iter <N>` | 迭代轮次，默认使用当前迭代 |
| `--idea <idea>` | 按特定 idea ID 过滤 |
| `--tasks <tasks...>` | 指定要比较的任务名称，默认使用迭代中的所有任务 |
| `--threshold <number>` | 最小调整后奖励阈值，默认 0.6 |
| `--kl-coef <number>` | KL 惩罚系数，默认 0.05 |
| `--max-diff <number>` | KL 归一化的最大 diff 行数，默认 500 |
| `--json` | JSON 格式输出 |

**示例**:
```bash
# 从当前迭代选择最佳任务
viben filerl select my-optimization

# 从指定迭代选择
viben filerl select my-optimization --iter 2

# 只考虑特定 idea 的任务
viben filerl select my-optimization --idea idea-001

# 自定义阈值
viben filerl select my-optimization --threshold 0.7 --kl-coef 0.1
```

**PPO 选择算法**:

1. **计算调整后奖励**: `adjusted = reward - kl_coef × min(1, diff_lines / max_diff)`
2. **计算基准线**: 所有调整后奖励的平均值
3. **两阶段选择**:
   - 阶段 1: 每个 idea 选择 finalScore 最高的 rollout
   - 阶段 2: 从 idea 优胜者中选择全局最佳（需超过阈值）

**输出示例**:
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

---

## 状态机

FileRL 每个迭代通过 phase 跟踪进度，支持中断后恢复：

```
init → generate_ideas → promote_ideas → execute_tasks →
       wait_tasks → compute_rewards → select_best → merge_cleanup → completed
```

| Phase | 说明 |
|-------|------|
| `init` | 刚开始，没有任何工作 |
| `generate_ideas` | Phase 1: 生成 ideas |
| `promote_ideas` | Phase 2: 将 ideas 转换为 tasks |
| `execute_tasks` | Phase 2.5: 启动 task 执行器 |
| `wait_tasks` | Phase 3: 等待 tasks 完成 |
| `compute_rewards` | Phase 4: 计算 rewards |
| `select_best` | Phase 5: PPO 选择最优 |
| `merge_cleanup` | Phase 6: 合并 winner，清理 losers |
| `completed` | 迭代完成 |

---

## Target 配置

FileRL 的配置定义在 target.md 文件的 YAML frontmatter 中：

```yaml
---
name: my-optimization
description: 优化 API 响应时间

idea:
  auto_generate: false          # 是否自动生成
  types: [performance_optimizations]
  max_ideas: 5
  batch_size: 3                 # 每次迭代最多处理几个 idea
  effort_filter: [trivial, small, medium]  # 可选：按 effort 过滤

rollout:
  n: 1                          # 每个 idea 执行 N 次
  worktree: true                # 使用 worktree 隔离

ppo:
  kl_coef: 0.05                 # 变更惩罚系数 (λ)
  change_sensitivity: 2.0       # 变更惩罚敏感度 (β)
  clip_range: 0.2               # 权重截断参数 (ε)
  quality_threshold: 0.6        # 质量阈值 (τ)
  max_diff: 500                 # 最大变更行数

convergence:
  threshold: 0.01               # 收敛阈值 (δ)
  max_iterations: 50
  no_merge_limit: 5             # 连续无合并次数限制

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

---

## 目录结构

```
.viben/filerl/<run-name>/
├── state.json                      # FileRL 状态
└── iter{N}/                        # 第 N 次迭代
    └── <idea-id>/                  # idea 目录
        ├── idea.md                 # idea 定义
        └── <task-name>/            # rollout task
            ├── reward.json         # reward 结果
            └── reward.log.jsonl    # reward agent 执行日志
```

### state.json 结构

```json
{
  "name": "my-optimization",
  "target_path": "/path/to/target.md",
  "current_iteration": 3,
  "completed_iterations": 2,
  "iterations": [
    {
      "iteration": 1,
      "phase": "completed",
      "ideas": ["po-a1b2c3d4"],
      "tasks": ["03-20-task-a"],
      "task_idea_map": { "03-20-task-a": "po-a1b2c3d4" },
      "rewards": { "03-20-task-a": 0.846 },
      "selected_task": "03-20-task-a",
      "rejected_tasks": [],
      "completed": true,
      "started_at": "...",
      "completed_at": "..."
    }
  ],
  "best_reward": 0.846,
  "best_task": "03-20-task-a",
  "no_merge_count": 0,
  "converged": false,
  "active": true,
  "started_at": "...",
  "updated_at": "..."
}
```

---

## 相关命令

### 奖励类型管理

```bash
viben reward list-types              # 列出可用的奖励类型
viben reward type list               # 列出奖励类型
viben reward type view <name>        # 查看奖励类型详情
viben reward type create <name>      # 创建自定义奖励类型
viben reward type update <name>      # 更新奖励类型
viben reward type delete <name>      # 删除奖励类型
```

### 任务管理

```bash
viben task approve <task>            # 合并 PR (winner)
viben task cleanup <task>            # 清理 worktree (loser)
viben task list                      # 列出所有任务
```

### 监控

```bash
viben swarm status --watch           # 实时监控 Agent 集群
viben swarm list                     # 列出所有 worktree 和 agent
```

### Idea 生成 (独立命令)

```bash
viben idea generate --types <types>  # 生成改进想法
viben idea list                      # 列出想法
viben idea promote <id> --start      # 将想法转为任务并启动
```

---

## 源代码位置

```
packages/core/src/
├── cli/commands/filerl.ts      # CLI 命令实现
└── filerl/ops/
    ├── types.ts                # 类型定义
    ├── parser.ts               # target.md 解析
    ├── state.ts                # state.json 管理
    ├── runner.ts               # 循环编排
    └── idea-generator.ts       # idea 生成
```

---

## 参考文档

- [FileRL 命令设计](../../../plans/2026-03-17-filerl-commands-design.md) - 详细设计文档
- [FileRL 测试计划](../../../plans/2026-03-27-filerl-test-plan.md) - 功能测试场景
- [FileRL Agent 指南](../../../../.claude/commands/viben/FileRL.md) - Agent 使用指南

---

## 完整工作流示例

```bash
# 1. 创建目标文件
viben filerl create my-optimization -d "优化代码质量"

# 2. 启动 FileRL 循环
viben filerl start my-optimization.md

# 3. 生成 idea (在 iter1/ 下)
viben filerl generate-ideas my-optimization --types code_improvements

# 4. 查看生成的 idea
viben filerl list-ideas my-optimization

# 5. 将 idea 转为 task 并启动
viben filerl promote-ideas my-optimization --ideas po-a1b2c3d4 --start

# 6. 查看状态
viben filerl status my-optimization

# 7. 监控任务执行
viben swarm status --watch

# 8. 计算奖励
viben filerl compute-reward my-optimization --iter 1

# 9. 选择最佳候选
viben filerl select my-optimization

# 10. 合并 winner，清理 loser
viben task approve <winner-task>
viben task cleanup <loser-task>
```

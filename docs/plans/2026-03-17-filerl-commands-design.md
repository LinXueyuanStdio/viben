# FileEvo Commands Design

> 为 FileEvo（基于代码库的强化学习）设计的 viben 子命令体系
>
> **状态**: 已实现，参见 `packages/core/src/cli/commands/evo.ts`

## 概述

FileEvo 将代码库视为"模型参数"，使用 PPO 算法迭代优化代码质量。本设计定义了支持 FileEvo 流程的命令体系。

### 设计原则

1. **FileEvo 循环作为提示词** - 不是硬编码命令，而是 Agent 读取 `FileEvo.md` 执行
2. **独立子命令** - 提供可组合的原子命令，供 Agent 灵活调用
3. **Reward Types 系统** - 类似 Idea Types，支持 builtin + custom
4. **配置跟随 FileEvo Target** - reward_config 定义在 target.md 的 YAML frontmatter 中
5. **数据写回 Main Repo** - reward 结果写入 `.viben/evo/<name>/iter{N}/<idea>/<task>/` 目录
6. **状态机驱动** - 每个迭代通过 phase 跟踪进度，支持中断恢复

---

## 架构图

### 整体流程

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         FileEvo Main Task                                │
│                      (reads target.md, runs in main repo)               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   1. viben evo start <target.md>                                    │
│      → 解析配置, 创建 state.json, 进入迭代循环                          │
│                                                                         │
│   2. viben evo generate-ideas <name> --types <types>                │
│      → 在 iter{N}/ 下生成 idea                                         │
│                                                                         │
│   3. 内部: orchestratePromoteIdeas()                                    │
│      → 将 idea 转换为 task, 创建 worktree (可选)                        │
│                                                                         │
│         │                    │                    │                     │
│         ▼                    ▼                    ▼                     │
│   ┌──────────┐         ┌──────────┐         ┌──────────┐               │
│   │ Worktree │         │ Worktree │         │ Worktree │               │
│   │ Task A   │         │ Task B   │         │ Task C   │               │
│   ├──────────┤         ├──────────┤         ├──────────┤               │
│   │work-phase│         │work-phase│         │work-phase│               │
│   │ 1.implement        │ 1.implement        │ 1.implement              │
│   │ 2.check            │ 2.check            │ 2.check                  │
│   │ 3.validate         │ 3.validate         │ 3.validate               │
│   └────────────────────┴────────────────────┴──────────────────────────┘
│                                                                         │
│   4. viben swarm wait --all                                            │
│                                                                         │
│   5. viben evo compute-reward <name> --iter N --task T              │
│      → 评估 task 代码, 写入 iter{N}/{idea}/{task}/reward.json          │
│      → Agent 日志写入 iter{N}/{idea}/{task}/reward.log.jsonl           │
│                                                                         │
│   6. viben evo select <name> --iter N                               │
│      → 聚合 rewards, 计算 PPO, 输出: selected=task-a                   │
│                                                                         │
│   7. viben task approve task-a                                         │
│      → approve agent 执行 merge PR                                     │
│                                                                         │
│   8. 内部: orchestrateMergeAndCleanup()                                │
│      → 清理未选中的 worktrees, dismiss loser ideas                     │
│                                                                         │
│   9. 检查收敛 → 继续下一轮迭代                                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 状态机 (Phase State Machine)

```
init → generate_ideas → promote_ideas → execute_tasks →
       wait_tasks → compute_rewards → select_best → merge_cleanup → completed
```

每个 phase 的状态保存在 `state.json` 中，支持中断后从当前 phase 恢复。

---

## Work Phase 子阶段

```
viben task work-phase <task>
├── 1. implement-phase      → 实现代码
├── 2. check-phase          → 检查代码质量
└── 3. validate-check-phase → 验证通过
```

**注意**：`compute-reward` 不再是 worktree work-phase 的一部分。Reward 评估在 main repo 中由 FileEvo main task 统一调用 `viben evo reward` 完成。

---

## 命令详细设计

### 1. `viben evo create <name>`

**用途**：创建新的 FileEvo target 配置文件

**输入**：
```bash
viben evo create <name> [options]
```

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `<name>` | FileEvo target 名称 | 必填 |
| `-d, --description <text>` | 目标描述 | - |
| `-o, --output <path>` | 输出路径 | `<name>.md` |
| `--json` | JSON 格式输出 | false |

**行为**：
1. 生成带有默认配置的 target.md 文件
2. 自动调用 `initRun()` 初始化 state.json
3. 支持后续使用 `add-idea` 和 `list-ideas`

**输出示例**：
```
✓ Created FileEvo target: my-optimization.md

Next steps:
  1. Edit my-optimization.md to configure your optimization goals
  2. Add ideas: viben evo add-idea my-optimization path/to/idea.md
  3. Start run: viben evo start my-optimization.md
```

---

### 2. `viben evo start <name-or-target>`

**用途**：启动 FileEvo 运行（解析配置，执行完整循环）

**输入**：
```bash
viben evo start <name-or-target> [options]
```

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `<name-or-target>` | run 名称或 target.md 路径 | 必填 |
| `--force` | 强制重启（即使已在运行） | false |
| `--dry-run` | 仅解析验证，不执行 | false |
| `--json` | JSON 格式输出 | false |

**行为**：
1. 解析 target.md 配置
2. 验证配置合法性
3. 如果 `--dry-run`：显示解析后的配置，不执行
4. 否则：调用 `runFileRlLoop()` 执行完整循环

**`--dry-run` 输出示例**：
```
FileEvo Target: my-optimization

Name:               my-optimization
Description:        优化 API 响应时间
Enabled:            yes

PPO Configuration:
KL Coefficient:     0.05
Change Sensitivity: 2.0
Clip Range:         0.2
Quality Threshold:  0.6
Max Diff:           500

...
✓ Configuration is valid
```

---

### 3. `viben evo status <name>`

**用途**：查看 FileEvo run 的状态

**输入**：
```bash
viben evo status <name> [--json]
```

**输出示例**：
```
FileEvo Run: my-optimization

Target:           my-optimization.md
Status:           active
Iteration:        3 / 50
Completed:        2
No-merge streak:  0 / 5
Best Reward:      0.846
Best Task:        03-20-add-caching

Configuration:
Auto-generate:    false
Batch size:       3
Rollouts per idea: 1
Quality threshold: 0.6

Recent Iterations:
┌───┬───────┬──────────┬─────────────┬──────────────────────────────┐
│ # │ TASKS │ SELECTED │ BEST REWARD │ STATUS                       │
├───┼───────┼──────────┼─────────────┼──────────────────────────────┤
│ 1 │ 3     │ task-a   │ 0.716       │ completed (selected: task-a) │
│ 2 │ 3     │ task-b   │ 0.846       │ completed (selected: task-b) │
│ 3 │ 2     │ -        │ 0.634       │ in progress                  │
└───┴───────┴──────────┴─────────────┴──────────────────────────────┘
```

---

### 4. `viben evo list`

**用途**：列出所有 FileEvo runs

**输入**：
```bash
viben evo list [options]
```

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--active` | 仅显示活跃的 run | false |
| `--json` | JSON 格式输出 | false |

**输出示例**：
```
FileEvo Runs:

┌──────────────────┬───────────┬─────────────┬──────────┐
│ NAME             │ ITERATION │ BEST REWARD │ STATUS   │
├──────────────────┼───────────┼─────────────┼──────────┤
│ my-optimization  │ 3         │ 0.846       │ active   │
│ security-audit   │ 5         │ 0.912       │ converged│
│ refactor-api     │ 2         │ 0.721       │ paused   │
└──────────────────┴───────────┴─────────────┴──────────┘

Total: 3 run(s)
```

---

### 5. `viben evo stop <name>`

**用途**：停止活跃的 FileEvo run

**输入**：
```bash
viben evo stop <name> [--json]
```

**行为**：
1. 设置 `state.active = false`
2. 当前迭代标记为未完成

---

### 6. `viben evo resume <name-or-target>`

**用途**：恢复暂停的 FileEvo run，继续循环

**输入**：
```bash
viben evo resume <name-or-target> [--json]
```

**行为**：
1. 恢复 `state.active = true`
2. 从当前 phase 继续执行 `runFileRlLoop()`

---

### 7. `viben evo add-idea <name-or-target> <idea-path>`

**用途**：手动添加 idea 到 FileEvo target 的 idea pool

**输入**：
```bash
viben evo add-idea <name-or-target> <idea-path> [--json]
```

**行为**：
1. 解析 target 配置获取 `idea.session_dir`
2. 复制 idea 文件到 session 目录

---

### 8. `viben evo list-ideas <name-or-target>`

**用途**：列出 FileEvo target 的 idea pool 中的 ideas

**输入**：
```bash
viben evo list-ideas <name-or-target> [options]
```

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--status <status>` | 按状态过滤 (draft, promoted, dismissed) | - |
| `--json` | JSON 格式输出 | false |

**输出示例**：
```
┌────────────┬──────────────────────────────────────────┬────────┬──────────┐
│ ID         │ TITLE                                    │ EFFORT │ STATUS   │
├────────────┼──────────────────────────────────────────┼────────┼──────────┤
│ po-a1b2c3d4│ Add Redis caching for user queries       │ medium │ draft    │
│ po-b2c3d4e5│ Optimize N+1 queries in order service    │ small  │ promoted │
│ po-c3d4e5f6│ Implement connection pooling             │ large  │ dismissed│
└────────────┴──────────────────────────────────────────┴────────┴──────────┘
```

---

### 9. `viben evo generate-ideas <name>`

**用途**：为 FileEvo run 的迭代生成 ideas

**输入**：
```bash
viben evo generate-ideas <name> [options]
```

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `<name>` | FileEvo run 名称 | 必填 |
| `--iter <N>` | 目标迭代号 | 当前迭代 (从 state.json) |
| `--types <types...>` | idea 类型列表 | 从 config 读取 |
| `--json` | JSON 格式输出 | false |

**行为**：
1. 调用 `generateIdeasForFileRl()` 生成 ideas
2. 保存到 `.viben/evo/<name>/iter{N}/` 目录

**输出示例**：
```
Generating ideas for FileEvo: my-optimization

  Iteration:   2
  Types:       code_improvements, performance_optimizations
  Max ideas:   5

  Analyzing codebase...
  Found 3 improvement opportunities...

✓ Generated 3 ideas for iteration 2

┌────────────┬──────────────────────────────────────────┬────────┬────────────────────────┐
│ ID         │ TITLE                                    │ EFFORT │ TYPE                   │
├────────────┼──────────────────────────────────────────┼────────┼────────────────────────┤
│ po-a1b2c3d4│ Add Redis caching for user queries       │ medium │ performance_optimizations│
│ po-b2c3d4e5│ Optimize N+1 queries in order service    │ small  │ code_improvements      │
│ po-c3d4e5f6│ Implement connection pooling             │ large  │ performance_optimizations│
└────────────┴──────────────────────────────────────────┴────────┴────────────────────────┘

Ideas saved to: .viben/evo/my-optimization/iter2/
```

---

### 10. `viben evo compute-reward <name>`

**用途**：计算 FileEvo run 中 task 的 reward

**输入**：
```bash
viben evo compute-reward <name> [options]
```

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `<name>` | FileEvo run 名称 | 必填 |
| `--iter <N>` | 迭代号 | 当前迭代 |
| `--idea <idea>` | 指定 idea ID | - |
| `--task <task>` | 指定 task 名称 | - |
| `-p, --platform <platform>` | 平台 (claude, cursor, iflow, opencode) | claude |
| `-v, --verbose` | 详细输出 | false |
| `--json` | JSON 格式输出 | false |

**行为**：
1. 查找指定的 task (通过 --task 或 --idea)
2. 调用 `runRewardPhaseSync()` 启动 reward agent
3. Reward 结果写入 `iter{N}/{idea}/{task}/reward.json`
4. Agent 执行日志写入 `iter{N}/{idea}/{task}/reward.log.jsonl`

**输出示例**：
```
=== Reward Agent Started ===

  Run:       my-optimization
  Iteration: 2
  Idea:      po-a1b2c3d4
  ID:        agent-abc123
  PID:       12345
  Log:       .viben/agents/agent-abc123.log

To monitor:
  tail -f .viben/agents/agent-abc123.log
```

---

### 11. `viben evo select <name>`

**用途**：使用 PPO 算法聚合当前迭代的 rewards，选择最优 task

**输入**：
```bash
viben evo select <name> [options]
```

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `<name>` | FileEvo run 名称 | 必填 |
| `--iter <N>` | 迭代号 | 当前迭代 |
| `--idea <idea>` | 过滤指定 idea | - |
| `--tasks <tasks...>` | 指定要比较的 tasks | 自动发现 |
| `--threshold <number>` | 最低 adjusted reward 阈值 | 0.6 |
| `--kl-coef <number>` | KL 惩罚系数 λ | 0.05 |
| `--max-diff <number>` | 最大 diff 行数 | 500 |
| `--json` | JSON 格式输出 | false |

**数据链路**：
```
┌─────────────────────────────────────────────────────────────────────┐
│                   viben evo select <name>                        │
│                    (executed in main repo)                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Step 1: Load rewards from FileEvo directory                        │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ .viben/evo/<name>/iter{N}/<idea>/<task>/reward.json        │ │
│  │   → task-a: R=0.858                                           │ │
│  │   → task-b: R=0.721                                           │ │
│  │   → task-c: R=0.634                                           │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                              │                                      │
│                              ▼                                      │
│  Step 2: Compute PPO metrics                                       │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ KL Penalty:      KL_i = λ × (diff_i / max_diff)               │ │
│  │ Adjusted Reward: R̃_i = R_i - KL_i                             │ │
│  │ Baseline:        R̄ = mean(R̃)                                  │ │
│  │ Relative Score:  S_i = R̃_i - R̄                                │ │
│  │ Final Score:     L_i = min(w·S, clip(w)·S)                    │ │
│  │                                                                │ │
│  │ task-a: KL=0.012, R̃=0.846, S=+0.130, L=+0.130                 │ │
│  │ task-b: KL=0.045, R̃=0.676, S=-0.040, L=-0.040                 │ │
│  │ task-c: KL=0.008, R̃=0.626, S=-0.090, L=-0.090                 │ │
│  │ baseline: 0.716                                                │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                              │                                      │
│                              ▼                                      │
│  Step 3: Select best (两阶段)                                      │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ 1. 每个 idea 选最优 rollout                                   │ │
│  │ 2. 全局选最优: R̃ ≥ threshold                                 │ │
│  │                                                                │ │
│  │ → Selected: task-a (L=+0.130, R̃=0.846 ≥ 0.6)                  │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                              │                                      │
│                              ▼                                      │
│  Output                                                            │
└─────────────────────────────────────────────────────────────────────┘
```

**PPO 公式**：

1. **变更量**: $d = \min(1, \frac{diff\_lines}{max\_diff})$

2. **变更惩罚权重**: $w = e^{-\beta \cdot d}$

3. **KL Penalty（代码变更惩罚）**：
$$KL_{task} = \lambda \cdot d$$

4. **Adjusted Reward**：
$$\tilde{R}_{task} = R_{task} - KL_{task}$$

5. **Baseline（均值）**：
$$\bar{R} = \frac{1}{n} \sum_{i=1}^{n} \tilde{R}_i$$

6. **Relative Score**：
$$S_{task} = \tilde{R}_{task} - \bar{R}$$

7. **Final Score (PPO-clip)**:
$$L_{task} = \min(w \cdot S, clip(w, 1-\epsilon, 1+\epsilon) \cdot S)$$

8. **Selection（两阶段）**：
   - 每个 idea 选最优 rollout: $PR^*_{idea} = \arg\max_{PR \in Rollouts_{idea}} L(PR)$
   - 全局选最优: $task^* = \arg\max L(PR^*_{idea})$，其中 $\tilde{R}_{task^*} \geq threshold$

**输出（CLI 表格）**：
```
PPO Selection Results
=====================

Run: my-optimization | Iteration: 2
Baseline: 0.716 | Threshold: 0.6

┌─────────┬────────┬───────┬────────┬──────────┬──────────┬───────┬────────────┐
│ TASK    │ REWARD │ DIFF  │ KL     │ ADJUSTED │ RELATIVE │ FINAL │ STATUS     │
├─────────┼────────┼───────┼────────┼──────────┼──────────┼───────┼────────────┤
│ task-a  │ 0.858  │ 120   │ 0.012  │ 0.846    │ +0.130   │ 0.130 │ SELECTED   │
│ task-b  │ 0.721  │ 450   │ 0.045  │ 0.676    │ -0.040   │-0.040 │ rejected   │
│ task-c  │ 0.634  │ 80    │ 0.008  │ 0.626    │ -0.090   │-0.090 │ rejected   │
└─────────┴────────┴───────┴────────┴──────────┴──────────┴───────┴────────────┘

Selected: task-a
```

**输出（JSON）**：
```json
{
  "run": "my-optimization",
  "iteration": 2,
  "baseline": 0.716,
  "threshold": 0.6,
  "candidates": [
    {
      "task": "task-a",
      "reward": 0.858,
      "diff_lines": 120,
      "kl_penalty": 0.012,
      "adjusted_reward": 0.846,
      "relative_score": 0.130,
      "final_score": 0.130
    },
    ...
  ],
  "selected": "task-a",
  "rejected": ["task-b", "task-c"]
}
```

---

### 12. `viben reward list-types`

> **注意**: 此命令已移至 `viben reward` 命名空间

**用途**：列出所有可用的 reward types（内置 + 自定义）

**输入**：无参数

**输出**：
```
┌─────────────────────┬─────────┬─────────────────────────────────────────┐
│ Name                │ Source  │ Description                             │
├─────────────────────┼─────────┼─────────────────────────────────────────┤
│ test_coverage       │ builtin │ Test pass rate and coverage analysis    │
│ code_quality        │ builtin │ Lint score and complexity metrics       │
│ security_scan       │ builtin │ Security vulnerability detection        │
│ diff_penalty        │ builtin │ Penalize large code changes (KL)        │
│ agent_review        │ builtin │ AI code review scoring                  │
│ benchmark_comparison│ builtin │ Performance benchmark comparison        │
│ api_latency         │ custom  │ API response time analysis              │
└─────────────────────┴─────────┴─────────────────────────────────────────┘
```

**数据来源**：
- Builtin: `packages/core/templates/viben/reward-types/*.md`
- Custom: `docs/reward-types/*.md`


---

### 13. `viben task approve <task>`

> **注意**: 此命令在 `viben task` 命名空间，参见 `packages/core/src/cli/commands/task.ts`

**用途**：批准并合并 task 的 PR

**输入**：
```bash
viben task approve <task> [options]
```

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `<task>` | Task 名称 | 必填 |
| `--cleanup-if-merged` | 合并后清理 worktree | true |
| `--pull-if-merged` | 合并后 pull main | true |

**数据链路**：
```
┌─────────────────────────────────────────────────────────────────────┐
│                     viben task approve <task>                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. 读取 task.json → 获取 pr_url, pr_number                        │
│                                                                     │
│  2. 检查 PR 状态:                                                  │
│     - CI passed?                                                   │
│     - No conflicts?                                                │
│                                                                     │
│  3. 执行 gh pr merge <pr_url> --merge                              │
│                                                                     │
│  4. 更新 task.json:                                                │
│     {                                                               │
│       "status": "completed",                                        │
│       "merged_at": "2024-03-17T11:00:00Z",                         │
│       "merge_commit": "abc1234"                                    │
│     }                                                               │
│                                                                     │
│  5. 如果 --cleanup-if-merged: 清理 worktree                        │
│  6. 如果 --pull-if-merged: git fetch origin main                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Target 配置 (target.md)

FileEvo 的配置定义在 target.md 文件的 YAML frontmatter 中。

### 完整配置示例

```yaml
---
name: my-optimization
description: 优化 API 响应时间

# Idea 配置
idea:
  auto_generate: false          # 是否自动生成（默认 false）
  types: [performance_optimizations]  # 自动生成时使用的类型
  max_ideas: 5                  # 每种类型最多生成几个 idea
  batch_size: 3                 # 每次迭代最多处理几个 idea (B)
  effort_filter: [trivial, small, medium]  # 可选：按 effort 过滤
  session_dir: .viben/ideas/my-optimization  # idea 存放目录

# Rollout 配置
rollout:
  n: 1                          # 每个 idea 执行 N 次
  worktree: true                # 使用 worktree 隔离

# PPO 配置
ppo:
  kl_coef: 0.05                 # 变更惩罚系数 (λ)
  change_sensitivity: 2.0       # 变更惩罚敏感度 (β)
  clip_range: 0.2               # 权重截断参数 (ε)
  quality_threshold: 0.6        # 质量阈值 (τ)
  max_diff: 500                 # 最大变更行数

# 收敛配置
convergence:
  threshold: 0.01               # 收敛阈值 (δ)
  max_iterations: 50            # 最大迭代次数
  no_merge_limit: 5             # 连续无合并次数限制

# Reward 配置
reward:
  types: [test_coverage, code_quality, agent_review]
  weights: [0.34, 0.33, 0.33]

# 执行器配置
task:
  executor: CLAUDE_CODE         # 执行器类型
  model: sonnet                 # 使用的模型

enabled: true                   # 是否启用
---

# My Optimization Target

优化 API 响应时间，重点关注：
1. 数据库查询优化
2. 缓存策略
3. 连接池配置
```

### 配置接口定义

参见 `packages/core/src/evo/ops/types.ts`：

```typescript
interface FileRlConfig {
  name: string;
  description?: string;
  ppo: PpoConfig;
  rollout: RolloutConfig;
  convergence: ConvergenceConfig;
  reward: RewardConfig;
  idea: IdeaConfig;
  task: TaskConfig;
  enabled: boolean;
}

interface PpoConfig {
  kl_coef: number;              // 默认 0.05
  change_sensitivity: number;   // 默认 2.0
  clip_range: number;           // 默认 0.2
  quality_threshold: number;    // 默认 0.6
  max_diff: number;             // 默认 500
}

interface IdeaConfig {
  auto_generate: boolean;       // 默认 false
  types: string[];
  max_ideas: number;            // 默认 5
  batch_size: number;           // 默认 3
  effort_filter?: string[];
  session_dir?: string;
}

interface RolloutConfig {
  n: number;                    // 默认 1
  worktree: boolean;            // 默认 true
}

interface ConvergenceConfig {
  threshold: number;            // 默认 0.01
  max_iterations: number;       // 默认 50
  no_merge_limit: number;       // 默认 5
}

interface TaskConfig {
  executor: string;             // 默认 "CLAUDE_CODE"
  model?: string;
}
```

### state.json 结构

FileEvo run 的状态保存在 `.viben/evo/<name>/state.json`：

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
      "ideas": ["po-a1b2c3d4", "po-b2c3d4e5"],
      "tasks": ["03-20-task-a", "03-20-task-b"],
      "task_idea_map": {
        "03-20-task-a": "po-a1b2c3d4",
        "03-20-task-b": "po-b2c3d4e5"
      },
      "rewards": {
        "03-20-task-a": 0.846,
        "03-20-task-b": 0.721
      },
      "selected_task": "03-20-task-a",
      "rejected_tasks": ["03-20-task-b"],
      "completed": true,
      "started_at": "2024-03-17T09:00:00Z",
      "completed_at": "2024-03-17T10:30:00Z"
    }
  ],
  "best_reward": 0.846,
  "best_task": "03-20-task-a",
  "no_merge_count": 0,
  "converged": false,
  "active": true,
  "started_at": "2024-03-17T09:00:00Z",
  "updated_at": "2024-03-17T11:00:00Z"
}
```

### Iteration Phase 定义

```typescript
type IterationPhase =
  | "init"              // 刚开始，没有任何工作
  | "generate_ideas"    // Phase 1: 生成 ideas
  | "promote_ideas"     // Phase 2: 将 ideas 转换为 tasks
  | "execute_tasks"     // Phase 2.5: 启动 task 执行器
  | "wait_tasks"        // Phase 3: 等待 tasks 完成
  | "compute_rewards"   // Phase 4: 计算 rewards
  | "select_best"       // Phase 5: PPO 选择最优
  | "merge_cleanup"     // Phase 6: 合并 winner，清理 losers
  | "completed";        // 迭代完成
```

---

## 命令汇总

### FileEvo 命令

| 命令 | 用途 |
|------|------|
| `viben evo create <name>` | 创建 FileEvo target 配置文件 |
| `viben evo start <name-or-target>` | 启动 FileEvo 运行 |
| `viben evo status <name>` | 查看运行状态 |
| `viben evo list` | 列出所有 runs |
| `viben evo stop <name>` | 停止运行 |
| `viben evo resume <name-or-target>` | 恢复运行 |
| `viben evo add-idea <name-or-target> <idea-path>` | 手动添加 idea |
| `viben evo list-ideas <name-or-target>` | 列出 idea pool |
| `viben evo generate-ideas <name>` | 生成 ideas |
| `viben evo compute-reward <name>` | 计算 task reward |
| `viben evo select <name>` | PPO 选择最优 task |

### 相关命令

| 命令 | 用途 |
|------|------|
| `viben reward list-types` | 列出可用 reward types |
| `viben task approve <task>` | 批准并合并 PR |
| `viben task cleanup <task>` | 清理 worktree |
| `viben swarm wait [tasks...] --all` | 等待所有 agent 完成 |
| `viben swarm status --watch` | 实时监控 agent 状态 |

---

### 14. `viben swarm wait [tasks...] --all`

> **注意**: 此命令在 `viben swarm` 命名空间，参见 `packages/core/src/cli/commands/swarm.ts`

**用途**：等待指定或所有 agent 完成，用于 FileEvo 流程中并行任务同步点

**输入**：
```bash
viben swarm wait [tasks...] [options]

# 参数
[tasks...]                       可选，指定等待的任务列表

# 选项
--all                            等待所有运行中的 agent
--polling-interval-seconds <n>   轮询间隔，默认 10 秒
--timeout-seconds <n>            单任务超时时间，默认 300 秒（5分钟）
--quiet                          静默模式，只输出最终结果
--verbose                        详细模式，每次轮询显示状态表格
--json                           JSON 格式输出
```

**使用示例**：
```bash
# 等待所有 agent
viben swarm wait --all

# 等待指定任务
viben swarm wait task-a task-b task-c

# 自定义超时
viben swarm wait --all --timeout-seconds 600 --polling-interval-seconds 5
```

**输出示例**：
```
Waiting for 3 agents... [10s] 1/3 completed
Waiting for 3 agents... [20s] 1/3 completed
Waiting for 3 agents... [30s] 2/3 completed
Waiting for 3 agents... [40s] 3/3 completed

=== Wait Complete ===
  ✓ task-a    completed  (35s)
  ✓ task-b    completed  (42s)
  ✗ task-c    timeout    (300s)

Summary: 2 completed, 0 failed, 1 timeout
```

**退出码**：
| 退出码 | 含义 |
|--------|------|
| 0 | 所有任务完成（completed 或 failed，无 timeout） |
| 1 | 有任务超时 |
| 2 | 没有找到任何 agent 可等待 |
| 3 | 执行错误（非 viben workspace 等） |

---

## Builtin Reward Types

| Type | Description | Evaluates |
|------|-------------|-----------|
| `test_coverage` | 测试通过率 + 覆盖率 | CI test results, coverage report |
| `code_quality` | Lint 分数 + 复杂度 | ESLint/Pylint output, cyclomatic complexity |
| `security_scan` | 安全漏洞检测 | npm audit, SAST tools |
| `diff_penalty` | 变更大小惩罚 | git diff --stat |
| `agent_review` | AI 代码审查 | Code diff, PR description |
| `benchmark_comparison` | 性能基准对比 | Before/after benchmarks |

---

## 文件位置

### 源代码

```
packages/core/src/
├── cli/commands/
│   ├── evo.ts         # viben evo 命令
│   ├── reward.ts         # viben reward 命令
│   ├── task.ts           # viben task 命令
│   └── swarm.ts          # viben swarm 命令
├── evo/ops/
│   ├── index.ts          # 导出
│   ├── types.ts          # 类型定义 (FileRlConfig, FileRlState, etc.)
│   ├── parser.ts         # target.md 解析
│   ├── state.ts          # state.json 管理
│   ├── runner.ts         # FileEvo 循环编排
│   └── idea-generator.ts # idea 生成
├── reward/ops/
│   ├── types.ts          # RewardConfig 等
│   ├── crud.ts           # computeReward
│   └── select.ts         # selectBestTask (PPO)
└── templates/viben/
    ├── idea-types/       # 内置 idea types
    │   └── *.md
    └── reward-types/     # 内置 reward types
        ├── test_coverage.md
        ├── code_quality.md
        ├── security_scan.md
        ├── diff_penalty.md
        ├── agent_review.md
        └── benchmark_comparison.md
```

### 运行时数据

```
.viben/
├── tasks/
│   └── <MM-DD-task-name>/
│       └── task.json             # 任务元数据
├── ideas/
│   └── <session>/
│       └── *.md                  # 生成的 ideas
└── evo/
    └── <name>/
        ├── state.json            # FileEvo run state
        ├── iter1/                # 迭代 1
        │   ├── <idea-id-1>/      # idea 1
        │   │   ├── idea.md       # idea 定义
        │   │   └── <task-name>/  # rollout task
        │   │       ├── reward.json      # Reward 结果
        │   │       └── reward.log.jsonl # Reward agent 执行日志
        │   └── <idea-id-2>/      # idea 2
        │       ├── idea.md
        │       └── <task-name>/
        │           ├── reward.json
        │           └── reward.log.jsonl
        └── iter2/                # 迭代 2
            └── ...

docs/
├── idea-types/                   # 自定义 idea types
│   └── *.md
└── reward-types/                 # 自定义 reward types
    └── *.md
```

### Reward 文件格式

#### reward.json

**路径**: `.viben/evo/<name>/iter{N}/<idea>/<task>/reward.json`

**格式**:
```json
{
  "total_score": 0.825,
  "diff_lines": 50,
  "scores": {
    "code_quality": { "score": 0.85, "reasoning": "Clean code structure" },
    "agent_review": { "score": 0.80, "reasoning": "Good implementation" }
  },
  "computed_at": "2026-03-27T10:30:00Z"
}
```

| 字段 | 类型 | 范围 | 说明 |
|------|------|------|------|
| `total_score` | number | 0-1 | 加权总分 |
| `diff_lines` | number | >= 0 | 代码变更行数 |
| `scores` | object | - | 各维度得分 |
| `computed_at` | string | ISO 8601 | 计算时间 |

#### reward.log.jsonl

**路径**: `.viben/evo/<name>/iter{N}/<idea>/<task>/reward.log.jsonl`

**说明**: 由 `runRewardPhase` 启动的 reward agent 产生的执行日志。格式与标准 agent log 相同 (JSONL)，记录 agent 的思考过程、工具调用、输出等。

用于调试和审计 reward 评估过程。

---

## 参考文档

- [FileEvo 命令参考](../../.claude/commands/viben/FileEvo.md) - Agent 使用指南
- [FileEvo 测试计划](./2026-03-27-evo-test-plan.md) - 功能测试场景
- [evo.ts](../../packages/core/src/cli/commands/evo.ts) - CLI 命令实现
- [runner.ts](../../packages/core/src/evo/ops/runner.ts) - 循环编排逻辑
- [types.ts](../../packages/core/src/evo/ops/types.ts) - 类型定义

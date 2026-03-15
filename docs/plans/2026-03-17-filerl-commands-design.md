# FileRL Commands Design

> 为 FileRL（基于代码库的强化学习）设计的 viben 子命令体系

## 概述

FileRL 将代码库视为"模型参数"，使用 PPO 算法迭代优化代码质量。本设计定义了支持 FileRL 流程的命令体系。

### 设计原则

1. **FileRL 循环作为提示词** - 不是硬编码命令，而是 Agent 读取 `FileRL.md` 执行
2. **独立子命令** - 提供可组合的原子命令，供 Agent 灵活调用
3. **Reward Types 系统** - 类似 Idea Types，支持 builtin + custom
4. **配置跟随 Task** - reward_config 写在 task.json 中

---

## 架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         FileRL Main Task                                │
│                      (reads FileRL.md, runs in main repo)               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   1. viben idea generate --types <types>                               │
│   2. viben idea promote <id> --worktree --start  (×N parallel)         │
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
│   │ 4.create-pr        │ 4.create-pr        │ 4.create-pr              │
│   │ 5.compute-reward   │ 5.compute-reward   │ 5.compute-reward         │
│   │    ↓               │    ↓               │    ↓                     │
│   │ task.json          │ task.json          │ task.json                │
│   │ R=0.858            │ R=0.721            │ R=0.634                  │
│   └────────────────────┴────────────────────┴──────────────────────────┘
│                                                                         │
│   3. viben swarm wait --all                                            │
│                                                                         │
│   4. viben reward select task-a task-b task-c                          │
│      → 聚合 rewards, 计算 PPO, 输出: selected=task-a                   │
│                                                                         │
│   5. viben task approve task-a                                         │
│      → approve agent 执行 merge PR                                     │
│                                                                         │
│   6. viben task cleanup task-b task-c                                  │
│      → 清理未选中的 worktrees                                          │
│                                                                         │
│   7. 检查收敛 → 继续下一轮迭代                                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Work Phase 子阶段

```
viben task work-phase <task>
├── 1. implement-phase      → 实现代码
├── 2. check-phase          → 检查代码质量
├── 3. validate-check-phase → 验证通过
├── 4. create-pr            → 创建 PR
└── 5. compute-reward       → 评估 PR 奖励（新增）
```

---

## 新增命令详细设计

### 1. `viben reward list-types`

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
- Builtin: `packages/core/src/prompts/reward-types/*.md`
- Custom: `docs/reward-types/*.md`

---

### 2. `viben task compute-reward <task>`

**用途**：在 worktree 中评估 PR 的奖励，写入 task.json

**触发时机**：create-pr 之后，作为 work-phase 最后一个子阶段

**输入**：
```bash
viben task compute-reward <task>
```

Reward types 从 task.json 的 `reward_config` 字段读取。

**task.json 中的配置**：
```json
{
  "title": "Optimize API caching",
  "status": "in_progress",
  "reward_config": {
    "types": ["test_coverage", "code_quality", "agent_review"],
    "weights": [0.4, 0.3, 0.3]
  }
}
```

**数据链路**：
```
┌─────────────────────────────────────────────────────────────────────┐
│            viben task compute-reward <task>                         │
│                    (executed in worktree)                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Input:                                                            │
│  ├── task.json → reward_config.types, reward_config.weights        │
│  ├── git diff main..HEAD → 代码变更                                │
│  ├── PR info (gh pr view) → PR 描述、CI 状态                       │
│  ├── check phase artifacts → 测试结果、lint 输出                   │
│  └── reward-types/<type>.md → reward agent prompts                 │
│                                                                     │
│  Process:                                                          │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ for type in reward_config.types:                              │ │
│  │   prompt = load("reward-types/{type}.md")                     │ │
│  │   context = {                                                 │ │
│  │     diff: git diff,                                           │ │
│  │     pr_info: gh pr view,                                      │ │
│  │     test_results: from check phase,                           │ │
│  │     lint_output: from check phase,                            │ │
│  │     task_info: task.json                                      │ │
│  │   }                                                           │ │
│  │   score, reasoning = call_reward_agent(prompt, context)       │ │
│  │   scores[type] = { score, reasoning }                         │ │
│  │                                                                │ │
│  │ total = Σ (weights[i] × scores[i].score)                      │ │
│  │ diff_lines = count(git diff --stat)                           │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  Output → append to task.json:                                     │
│  {                                                                 │
│    "reward": {                                                     │
│      "scores": {                                                   │
│        "test_coverage": { "score": 0.95, "reasoning": "..." },    │
│        "code_quality": { "score": 0.82, "reasoning": "..." },     │
│        "agent_review": { "score": 0.78, "reasoning": "..." }      │
│      },                                                            │
│      "total": 0.858,                                              │
│      "diff_lines": 120,                                           │
│      "computed_at": "2024-03-17T10:30:00Z"                        │
│    }                                                               │
│  }                                                                 │
└─────────────────────────────────────────────────────────────────────┘
```

**公式**：
$$R_{task} = \sum_{i=1}^{n} w_i \cdot r_i(task)$$

其中：
- $r_i(task)$ = 第 i 个 reward type 对 task 的评分（0-1）
- $w_i$ = 第 i 个 reward type 的权重
- $\sum w_i = 1$

---

### 3. `viben reward select <tasks...>`

**用途**：聚合多个 task 的 reward，计算 PPO 指标，选择最优

**输入**：
```bash
viben reward select task-a task-b task-c \
  --threshold 0.6 \
  --kl-coef 0.05 \
  --max-diff 500 \
  --json
```

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `<tasks...>` | 已计算 reward 的任务列表 | 必填 |
| `--threshold` | 最低 adjusted reward 阈值 | 0.6 |
| `--kl-coef` | KL 惩罚系数 λ | 0.05 |
| `--max-diff` | 最大 diff 行数（KL 归一化） | 500 |
| `--json` | JSON 格式输出 | false |

**数据链路**：
```
┌─────────────────────────────────────────────────────────────────────┐
│                      viben reward select                            │
│                    (executed in main repo)                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Step 1: Load rewards from each task.json                          │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ .viben/tasks/task-a/task.json  →  R=0.858, diff=120           │ │
│  │ .viben/tasks/task-b/task.json  →  R=0.721, diff=450           │ │
│  │ .viben/tasks/task-c/task.json  →  R=0.634, diff=80            │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                              │                                      │
│                              ▼                                      │
│  Step 2: Compute PPO metrics                                       │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ KL Penalty:      KL_i = λ × (diff_i / max_diff)               │ │
│  │ Adjusted Reward: R̃_i = R_i - KL_i                             │ │
│  │ Baseline:        R̄ = mean(R̃)                                  │ │
│  │ Advantage:       A_i = R̃_i - R̄                                │ │
│  │ PPO Score:       S_i = A_i  (simplified, ρ=1)                 │ │
│  │                                                                │ │
│  │ task-a: KL=0.012, R̃=0.846, A=+0.130, S=+0.130                 │ │
│  │ task-b: KL=0.045, R̃=0.676, A=-0.040, S=-0.040                 │ │
│  │ task-c: KL=0.008, R̃=0.626, A=-0.090, S=-0.090                 │ │
│  │ baseline: 0.716                                                │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                              │                                      │
│                              ▼                                      │
│  Step 3: Select best                                               │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ candidates = [t for t in tasks if t.adjusted >= threshold]    │ │
│  │ best = max(candidates, key=lambda t: t.ppo_score)             │ │
│  │                                                                │ │
│  │ → Selected: task-a (S=+0.130, R̃=0.846 ≥ 0.6)                  │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                              │                                      │
│                              ▼                                      │
│  Output                                                            │
└─────────────────────────────────────────────────────────────────────┘
```

**PPO 公式**：

1. **KL Penalty（代码变更惩罚）**：
$$KL_{task} = \lambda \cdot \frac{\text{diff\_lines}(task)}{\text{max\_diff}}$$

2. **Adjusted Reward**：
$$\tilde{R}_{task} = R_{task} - KL_{task}$$

3. **Baseline（均值）**：
$$\bar{R} = \frac{1}{n} \sum_{i=1}^{n} \tilde{R}_i$$

4. **Advantage**：
$$A_{task} = \tilde{R}_{task} - \bar{R}$$

5. **PPO Score**（简化版，ρ=1）：
$$S_{task} = A_{task}$$

6. **Selection**：
$$task^* = \arg\max_{task} S_{task}, \quad \text{where } \tilde{R}_{task^*} \geq threshold$$

**输出（JSON）**：
```json
{
  "baseline": 0.716,
  "threshold": 0.6,
  "candidates": [
    {
      "task": "task-a",
      "reward": 0.858,
      "diff_lines": 120,
      "kl_penalty": 0.012,
      "adjusted_reward": 0.846,
      "advantage": 0.130,
      "ppo_score": 0.130
    },
    {
      "task": "task-b",
      "reward": 0.721,
      "diff_lines": 450,
      "kl_penalty": 0.045,
      "adjusted_reward": 0.676,
      "advantage": -0.040,
      "ppo_score": -0.040
    },
    {
      "task": "task-c",
      "reward": 0.634,
      "diff_lines": 80,
      "kl_penalty": 0.008,
      "adjusted_reward": 0.626,
      "advantage": -0.090,
      "ppo_score": -0.090
    }
  ],
  "selected": "task-a",
  "rejected": ["task-b", "task-c"]
}
```

**输出（CLI 表格）**：
```
PPO Selection Results
=====================

Baseline: 0.716 | Threshold: 0.6

┌─────────┬────────┬───────┬────────┬──────────┬───────────┬────────────┐
│ Task    │ Reward │ Diff  │ KL     │ Adjusted │ Advantage │ Status     │
├─────────┼────────┼───────┼────────┼──────────┼───────────┼────────────┤
│ task-a  │ 0.858  │ 120   │ 0.012  │ 0.846    │ +0.130    │ ✓ SELECTED │
│ task-b  │ 0.721  │ 450   │ 0.045  │ 0.676    │ -0.040    │ rejected   │
│ task-c  │ 0.634  │ 80    │ 0.008  │ 0.626    │ -0.090    │ rejected   │
└─────────┴────────┴───────┴────────┴──────────┴───────────┴────────────┘

Selected: task-a
```

---

### 4. `viben task approve <task>` (修订)

**用途**：调用 approve agent 执行 merge PR

**输入**：
```bash
viben task approve <task>
```

**数据链路**：
```
┌─────────────────────────────────────────────────────────────────────┐
│                     viben task approve <task>                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. 读取 task.json → 获取 pr_url, pr_number                        │
│                                                                     │
│  2. 调用 approve agent:                                            │
│     ┌─────────────────────────────────────────────────────────────┐│
│     │ - 检查 PR 状态 (CI passed, no conflicts)                    ││
│     │ - 执行 gh pr merge <pr_url> --merge                         ││
│     │ - 等待 merge 完成                                           ││
│     │ - git fetch origin main                                     ││
│     └─────────────────────────────────────────────────────────────┘│
│                                                                     │
│  3. 更新 task.json:                                                │
│     {                                                               │
│       "status": "completed",                                        │
│       "merged_at": "2024-03-17T11:00:00Z",                         │
│       "merge_commit": "abc1234"                                    │
│     }                                                               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Reward Types 配置继承

### Idea Type 中定义默认 reward_config

**示例**：`packages/core/src/prompts/idea-types/performance_optimizations.md`

```yaml
---
name: performance_optimizations
description: Performance bottlenecks and optimizations
max_ideas: 5
reward_config:
  types:
    - test_coverage
    - code_quality
    - benchmark_comparison
  weights:
    - 0.3
    - 0.3
    - 0.4
---

Analyze the codebase for performance optimization opportunities...
```

### Promote 时继承到 task.json

```bash
viben idea promote po-a1b2c3d4 --worktree --start
```

生成的 task.json：
```json
{
  "title": "Add Redis caching for user queries",
  "from_idea": "po-a1b2c3d4",
  "from_idea_type": "performance_optimizations",
  "reward_config": {
    "types": ["test_coverage", "code_quality", "benchmark_comparison"],
    "weights": [0.3, 0.3, 0.4]
  }
}
```

### 运行时覆盖（可选）

```bash
viben task set-reward-config <task> \
  --types test_coverage,security_scan \
  --weights 0.5,0.5
```

---

## 命令汇总

| 命令 | 执行位置 | 用途 |
|------|----------|------|
| `viben reward list-types` | main | 列出可用 reward types |
| `viben task compute-reward <task>` | worktree | 计算 reward 写入 task.json |
| `viben reward select <tasks...>` | main | 聚合 + PPO 选择最优 |
| `viben task approve <task>` | main | 调用 agent merge PR |

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

```
packages/core/
├── src/
│   ├── prompts/
│   │   ├── idea-types/           # Idea type prompts
│   │   │   └── *.md
│   │   └── reward-types/         # Reward type prompts (新增)
│   │       ├── test_coverage.md
│   │       ├── code_quality.md
│   │       ├── security_scan.md
│   │       ├── diff_penalty.md
│   │       ├── agent_review.md
│   │       └── benchmark_comparison.md
│   └── cli/
│       └── commands/
│           ├── reward.ts         # viben reward 命令 (新增)
│           └── task.ts           # 扩展 compute-reward, approve

docs/
└── reward-types/                 # Custom reward types
    └── *.md

.viben/
└── tasks/
    └── <task>/
        └── task.json             # 包含 reward_config 和 reward 结果
```

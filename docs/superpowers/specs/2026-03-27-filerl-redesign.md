# FileEvo 重新设计

> 日期: 2026-03-27
> 状态: 设计完成，待审核

## 背景

FileEvo 是 Viben 的代码迭代优化系统，通过"生成多个候选方案 → 多维度评估 → 选择最优合并"的循环来提升代码质量。

### 当前问题

1. **与 README 不对齐**：实现与文档描述的算法有差异
2. **架构复杂**：Idea → Task → PR 三层结构，状态管理繁琐
3. **已知 bug**：
   - Loser idea 状态不一致（Task 被 archive，但 idea 仍是 `promoted`）
   - PR 合并失败无回退机制

### 设计目标

1. **与 README 对齐**：实现文档中描述的 PPO 选择算法
2. **简化架构**：支持跳过 Idea 生成，使用手动输入的 idea 文件
3. **修复已知问题**：完善 Idea 状态管理

---

## 核心概念

```
┌─────────────────────────────────────────────────────────────┐
│                     FileEvo Run                              │
│  ┌─────────────┐    ┌──────────────────────────────────┐   │
│  │ Target.md   │───▶│         Idea Pool                │   │
│  │ (配置)      │    │  ┌────┐ ┌────┐ ┌────┐           │   │
│  └─────────────┘    │  │ i1 │ │ i2 │ │ i3 │ ... (手动/自动) │
│        │            │  └────┘ └────┘ └────┘           │   │
│        ▼            └───────────────┬──────────────────┘   │
│  auto_generate?          取一个 idea │                      │
│  ─────────────          ◀───────────┘                      │
│        │                     │                              │
│        ▼                     ▼                              │
│  生成新 idea ────────▶ 执行 N 次 rollout                    │
│                              │                              │
│                    ┌─────────┴─────────┐                   │
│                    ▼         ▼         ▼                   │
│                  PR₁       PR₂       PR_N                  │
│                    │         │         │                   │
│                    └─────────┬─────────┘                   │
│                              ▼                              │
│                        评估 + 选择                          │
│                              │                              │
│                    ┌─────────┴─────────┐                   │
│                    ▼                   ▼                   │
│                合并 winner        清理 losers              │
│                              │                              │
│                              ▼                              │
│                     继续下一个 idea                         │
└─────────────────────────────────────────────────────────────┘
```

**关键设计决策**：

1. **Target 文件是配置中心**：定义优化目标、idea 配置、PPO 参数
2. **Idea 目录是工作池**：可手动放入 idea，也可自动生成
3. **可选的 Idea 生成**：`auto_generate: false` 时跳过生成，使用已有 idea
4. **Multi-Rollout**：每个 idea 可执行 N 次，生成 N 个候选 PR
5. **持续运行**：只要 idea 目录有未完成的 idea，就继续迭代，直到收敛

---

## Target 配置格式

```yaml
---
name: my-optimization
description: 优化 API 响应时间

# Idea 配置
idea:
  auto_generate: false          # 是否自动生成（默认 false）
  types: [performance_optimizations]  # 自动生成时使用的类型
  batch_size: 3                 # 每次迭代最多处理几个 idea (B)
  session_dir: .viben/ideas/my-optimization  # idea 存放目录（默认 .viben/ideas/<name>）

# Rollout 配置
rollout:
  n: 3                          # 每个 idea 执行 N 次
  worktree: true                # 使用 worktree 隔离

# PPO 配置 (语义化变量名)
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

# Reward 配置（复用现有）
reward:
  types: [test_coverage, code_quality, agent_review]
  weights: [0.34, 0.33, 0.33]

# 执行器配置
task:
  executor: CLAUDE_CODE
  model: sonnet
---

# 优化目标

描述优化目标，Agent 在生成 idea 时会参考这部分内容...
```

### 配置字段说明

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `idea.auto_generate` | boolean | false | 是否自动生成 idea |
| `idea.types` | string[] | - | 自动生成时使用的 idea 类型 |
| `idea.batch_size` | number | 3 | 每次迭代处理的 idea 数量 (B) |
| `rollout.n` | number | 1 | 每个 idea 的 rollout 次数 (N) |
| `ppo.kl_coef` | number | 0.05 | 变更惩罚系数 (λ) |
| `ppo.change_sensitivity` | number | 2.0 | 变更惩罚敏感度 (β) |
| `ppo.clip_range` | number | 0.2 | 权重截断参数 (ε) |
| `ppo.quality_threshold` | number | 0.6 | 质量阈值 (τ) |
| `ppo.max_diff` | number | 500 | 最大变更行数 |
| `convergence.threshold` | number | 0.01 | 收敛阈值 (δ) |
| `convergence.max_iterations` | number | 50 | 最大迭代次数 |
| `convergence.no_merge_limit` | number | 5 | 连续无合并次数限制 |

---

## 迭代状态机

```
┌──────────────┐
│    init      │ ◀─── evo start
└──────┬───────┘
       │
       ▼
┌──────────────┐     idea 目录为空
│  fetch_ideas │────────────────────┐
└──────┬───────┘                    │
       │ 有 idea                     │
       ▼                            ▼
┌──────────────┐            ┌──────────────┐
│create_rollouts│            │generate_ideas│ (如果 auto_generate=true)
└──────┬───────┘            └──────┬───────┘
       │                           │
       │◀──────────────────────────┘
       ▼
┌──────────────┐
│execute_tasks │ ── 并行启动 B × N 个 task
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  wait_tasks  │ ── 等待所有 task 完成
└──────┬───────┘
       │
       ▼
┌──────────────┐
│compute_rewards│ ── 计算每个 task 的 reward
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ select_best  │ ── PPO 两阶段选择
└──────┬───────┘
       │
       ▼
┌──────────────┐
│merge_cleanup │ ── 合并 winner，清理 losers，更新 idea 状态
└──────┬───────┘
       │
       ├─────────────────────────────────┐
       │                                 │
       ▼                                 ▼
┌──────────────┐                 ┌──────────────┐
│check_converge│                 │ no_merge_++  │
└──────┬───────┘                 └──────┬───────┘
       │                                 │
       ├──────── converged ─────▶ ┌──────┴───────┐
       │                          │   complete   │
       │                          └──────────────┘
       ▼
┌──────────────┐
│next_iteration│ ── 回到 fetch_ideas
└──────────────┘
```

### 状态定义

```typescript
type IterationPhase =
  | "init"              // 初始化
  | "fetch_ideas"       // 获取待处理的 idea
  | "generate_ideas"    // 自动生成 idea（可选）
  | "create_rollouts"   // 为 idea 创建 rollout task
  | "execute_tasks"     // 启动 task 执行
  | "wait_tasks"        // 等待 task 完成
  | "compute_rewards"   // 计算 reward
  | "select_best"       // PPO 选择
  | "merge_cleanup"     // 合并 + 清理
  | "check_converge"    // 检查收敛
  | "complete";         // 运行结束
```

---

## PPO 选择算法

### 算法公式（与 README 对齐）

**多目标评分函数**

$$R(\text{PR}) = \sum_{i=1}^{k} w_i \cdot r_i(\text{PR}), \quad \sum_{i=1}^{k} w_i = 1$$

**代码变更量**

$$d = \min\left(1, \frac{|\Delta\text{lines}|}{\text{max\_diff}}\right)$$

**变更惩罚权重**

$$w = e^{-\beta \cdot d}$$

**调整后得分**

$$\tilde{R} = R - \lambda \cdot d$$

**相对得分**

$$S = \tilde{R} - \bar{R}, \quad \bar{R} = \frac{1}{N}\sum_{i=1}^{N}\tilde{R}_i$$

**综合评分函数**

$$L = \min(w \cdot S, \text{clip}(w, 1-\epsilon, 1+\epsilon) \cdot S)$$

### 两阶段选择

```typescript
function selectBest(candidates: TaskCandidate[], config: PpoConfig): SelectResult {
  const { kl_coef, change_sensitivity, clip_range, quality_threshold, max_diff } = config;

  // 1. 计算每个候选的变更量 d
  for (const c of candidates) {
    c.d = Math.min(1, c.diffLines / max_diff);
  }

  // 2. 计算变更惩罚权重 w = exp(-β × d)
  for (const c of candidates) {
    c.changeWeight = Math.exp(-change_sensitivity * c.d);
  }

  // 3. 计算调整后得分 R̃ = R - λ × d
  for (const c of candidates) {
    c.adjustedReward = c.reward - kl_coef * c.d;
  }

  // 4. 计算批均值 R̄
  const baseline = mean(candidates.map(c => c.adjustedReward));

  // 5. 计算相对得分 S = R̃ - R̄
  for (const c of candidates) {
    c.relativeScore = c.adjustedReward - baseline;
  }

  // 6. 计算综合评分 L = min(w×S, clip(w, 1-ε, 1+ε)×S)
  for (const c of candidates) {
    const clippedWeight = Math.max(1 - clip_range, Math.min(1 + clip_range, c.changeWeight));
    c.finalScore = Math.min(c.changeWeight * c.relativeScore, clippedWeight * c.relativeScore);
  }

  // 7. 两阶段选择
  // 7a. 每个 idea 选最优 rollout
  const bestPerIdea = groupByIdea(candidates).map(group =>
    group.reduce((best, c) => c.finalScore > best.finalScore ? c : best)
  );

  // 7b. 全局选最优（需满足质量阈值）
  const qualified = bestPerIdea.filter(c => c.adjustedReward >= quality_threshold);
  const selected = qualified.length > 0
    ? qualified.reduce((best, c) => c.finalScore > best.finalScore ? c : best)
    : null;

  return { selected, rejected: candidates.filter(c => c !== selected) };
}
```

---

## Idea 状态管理

### 状态流转

```
┌────────┐   promote    ┌──────────┐
│ draft  │ ───────────▶ │ promoted │
└────────┘              └────┬─────┘
     │                       │
     │ dismiss               │
     ▼                       ├─────────────┐
┌────────────┐               │             │
│ dismissed  │               ▼             ▼
└────────────┘          ┌────────┐    ┌────────┐
                        │ winner │    │ loser  │
                        └───┬────┘    └────┬───┘
                            │              │
                            ▼              ▼
                       保持 promoted   ──▶ dismissed
```

### 状态说明

| 状态 | 说明 |
|------|------|
| `draft` | 初始状态，等待处理 |
| `promoted` | 已提升为 task（winner 保持此状态） |
| `dismissed` | 已废弃（loser、被过滤、手动丢弃） |

> **注意**：`winner` 和 `loser` 是逻辑概念，不是独立状态。Winner idea 保持 `promoted` 状态，loser idea 转为 `dismissed`。

### 修复内容

**1. Loser idea 状态更新**

```typescript
// orchestrateMergeAndCleanup 新增
for (const taskName of rejectedTasks) {
  cancelTask(repoRoot, taskName, { reason: `Rejected...` });
  archiveTask(repoRoot, taskName);

  // 新增：更新 idea 状态
  const ideaId = getIdeaIdFromTask(taskName);
  if (ideaId) {
    dismissIdea(repoRoot, ideaId);
  }
}
```

**2. PR 合并失败处理**

```typescript
const approveResult = approveTask(repoRoot, selectedTask, { ... });

if (!approveResult.success) {
  // 记录失败原因
  state.iterations[current].merge_error = approveResult.error;

  // 不标记 idea 为 dismissed，允许重试
  // 增加 no_merge_count
}
```

---

## CLI 命令

### 生命周期管理

```bash
viben evo create <name> [--target <target.md>]  # 创建 FileEvo run
viben evo start <name>                          # 启动优化循环
viben evo stop <name>                           # 停止
viben evo resume <name>                         # 恢复
viben evo status <name>                         # 查看状态
viben evo list                                  # 列出所有 run
```

### Idea 管理

```bash
viben evo add-idea <name> <idea.md>             # 添加 idea 到 run
viben evo list-ideas <name>                     # 列出 run 的 idea
```

### 监控

```bash
viben evo watch <name>                          # 实时监控
viben evo report <name>                         # 生成报告
```

---

## 实现计划

### Phase 1: 核心重构

1. 更新 `FileRlConfig` 类型定义，使用新的配置格式
2. 重构 `runner.ts` 状态机，实现新的 phase 流程
3. 实现两阶段 PPO 选择算法

### Phase 2: Idea 状态修复

1. 修改 `orchestrateMergeAndCleanup` 更新 loser idea 状态
2. 添加 PR 合并失败的错误处理

### Phase 3: CLI 更新

1. 更新 `evo create` 命令
2. 添加 `evo add-idea` 命令
3. 更新帮助文档

### Phase 4: 测试与文档

1. 更新单元测试
2. 更新 README 中的 CLI 命令示例
3. 更新 FileEvo.md slash command

---

## 验收标准

- [ ] Target 配置格式与设计文档一致
- [ ] 状态机按设计流转
- [ ] PPO 选择算法与 README 公式一致
- [ ] Loser idea 在清理阶段被标记为 `dismissed`
- [ ] PR 合并失败有明确的错误提示
- [ ] `auto_generate: false` 模式下，可以手动添加 idea 并执行优化
- [ ] CLI 命令可用且有帮助文档
- [ ] 所有测试通过

---

## 附录

### 与当前实现的主要差异

| 方面 | 当前实现 | 新设计 |
|------|----------|--------|
| Idea 生成 | 强制自动生成 | 可选，支持手动 |
| 配置字段名 | 希腊字母 (λ, β) | 语义化 (kl_coef, change_sensitivity) |
| PPO 算法 | 简化版 | 完整两阶段选择 |
| Loser idea | 状态不更新 | 标记为 dismissed |
| Rollout | 隐式 parallel_count | 显式 rollout.n |

### 超参数对照表

| 设计文档 | README 符号 | 经验值 |
|----------|-------------|--------|
| `kl_coef` | λ | 0.01 ~ 0.1 |
| `change_sensitivity` | β | 1.0 ~ 3.0 |
| `clip_range` | ε | 0.1 ~ 0.2 |
| `quality_threshold` | τ | 0.5 ~ 0.7 |
| `convergence.threshold` | δ | 0.01 |

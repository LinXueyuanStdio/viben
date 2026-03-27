# FileRL 功能测试计划

> 日期: 2026-03-27
> 目标: 验证 viben filerl 命令的完整工作流程

## 1. 测试范围

### 1.1 核心命令

| 功能 | 命令 | 覆盖场景 |
|------|------|----------|
| 创建 target | `viben filerl create <name>` | 创建 <name>.md 配置文件 |
| 启动 run | `viben filerl start <target.md>` | 启动 FileRL 循环 |
| 生成 idea | `viben filerl generate-ideas <name> --types <types>` | 在 iter{N}/ 下生成 |
| 列出 idea | `viben filerl list-ideas <name>` | 当前迭代的 idea |
| 启动迭代 | `viben filerl start <target.md>` | 开始执行循环 |
| 恢复迭代 | `viben filerl resume <name>` | 从中断处继续 |
| 停止迭代 | `viben filerl stop <name>` | 停止执行 |
| 查看状态 | `viben filerl status <name>` | 当前状态 |
| PPO 选择 | `viben filerl select <name> [--iter N] [--idea ID]` | threshold 过滤 |
| 合并 winner | `viben task approve <task>` | PR 合并 |
| 清理 loser | `viben task cleanup <task>` | worktree 清理 |
| 监控 | `viben swarm status --watch` | 实时状态 |

### 1.2 迭代阶段

| Phase | 命令/操作 | 验证点 |
|-------|----------|--------|
| init | `viben filerl start <target.md>` | 解析配置、创建 state.json |
| fetch_ideas | `viben filerl generate-ideas` | 在 iter{N}/ 生成 idea |
| create_rollouts | 内部逻辑 | task 创建、task_idea_map |
| execute_tasks | `viben idea promote --start` | agent 启动、并行执行 |
| wait_tasks | `viben swarm wait` | 状态轮询、进程健康检测 |
| compute_rewards | `viben filerl compute-reward <name> [--iter N] [--idea ID] [--task T]` | reward.json 生成 |
| select_best | `viben filerl select <name> [--iter N] [--idea ID]` | PPO 两阶段选择 |
| merge_cleanup | `viben task approve/cleanup` | 合并、清理 |
| check_converge | 内部逻辑 | 收敛检测 |

### 1.3 配置参数

| 参数 | 测试值 | 验证点 |
|------|--------|--------|
| `idea.auto_generate` | false | 手动触发生成 |
| `idea.batch_size` | 2, 3 | 每轮处理数量 |
| `rollout.n` | 1, 2 | 每个 idea 的 rollout 次数 |
| `rollout.worktree` | true, false | worktree 隔离 vs 主仓库 |
| `ppo.quality_threshold` | 0.5, 0.7 | 质量阈值过滤 |
| `ppo.kl_coef` | 0.05 | 变更惩罚 |
| `convergence.max_iterations` | 3, 5 | 最大迭代次数 |

## 2. 测试环境

### 2.1 初始化时创建的文件

```
/tmp/filerl-test/
├── index.js                    # 测试代码（初始化时创建）
├── utils.js                    # 辅助代码（初始化时创建）
└── test-basic.md               # FileRL 配置（由 viben filerl create 生成）
```

### 2.2 FileRL 目录结构（由 viben 管理）

```
/tmp/filerl-test/
└── .viben/
    ├── filerl/<run-name>/
    │   ├── state.json                      # FileRL 状态
    │   ├── iter1/                          # 第 1 次迭代
    │   │   ├── <idea-id-1>/                # idea 1
    │   │   │   ├── idea.md                 # idea 定义
    │   │   │   └── <task-name>/            # rollout task
    │   │   │       └── reward.json         # reward 结果
    │   │   └── <idea-id-2>/                # idea 2
    │   │       ├── idea.md
    │   │       └── <task-name>/
    │   │           └── reward.json
    │   └── iter2/                          # 第 2 次迭代
    │       └── ...
    └── tasks/
        └── <MM-DD-task-name>/
            └── task.json                   # task 配置（不含 reward）
```

### 2.3 Reward 存储位置

**路径**: `.viben/filerl/<run-name>/iter{N}/<idea-id>/<task-name>/reward.json`

**格式**:
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

### 2.4 初始代码

```javascript
// index.js
function greet(name) {
  return "Hello, " + name;
}

function add(a, b) {
  return a + b;
}

if (require.main === module) {
  console.log(greet("World"));
  console.log(add(1, 2));
}

module.exports = { greet, add };
```

```javascript
// utils.js
function formatDate(date) {
  return date.toISOString();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { formatDate, sleep };
```

### 2.5 Target 配置 (test-basic.md)

使用 `viben filerl create test-basic -d "基础流程测试"` 自动生成。

**默认配置** (由 CLI 生成):
```yaml
---
name: test-basic
description: 基础流程测试
enabled: true

ppo:
  kl_coef: 0.05
  change_sensitivity: 2
  clip_range: 0.2
  quality_threshold: 0.6
  max_diff: 500

rollout:
  n: 1
  worktree: true

convergence:
  threshold: 0.01
  max_iterations: 50
  no_merge_limit: 5

reward:
  types: [test_coverage, code_quality, agent_review]
  weights: [0.34, 0.33, 0.33]

idea:
  auto_generate: false
  types: [code_improvements]
  max_ideas: 5
  batch_size: 3

task:
  executor: CLAUDE_CODE
---
```

## 3. 测试用例

### 3.1 场景 A: 基础流程（主仓库模式）

**目标**: 验证最简单的 FileRL 流程

**步骤**:

```bash
# ============================================
# 阶段 1: 初始化（可以创建文件）
# ============================================

# 1.1 清空测试目录
rm -rf /tmp/filerl-test
mkdir -p /tmp/filerl-test
cd /tmp/filerl-test

# 1.2 初始化 git
git init
cat > index.js << 'EOF'
function greet(name) {
  return "Hello, " + name;
}

function add(a, b) {
  return a + b;
}

if (require.main === module) {
  console.log(greet("World"));
  console.log(add(1, 2));
}

module.exports = { greet, add };
EOF

cat > utils.js << 'EOF'
function formatDate(date) {
  return date.toISOString();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { formatDate, sleep };
EOF

git add . && git commit -m "init"

# 1.3 初始化 viben
viben init
viben team init
viben user init FileRL-optimizer

# 1.4 创建 target.md（使用 CLI 命令）
viben filerl create test-basic -d "基础流程测试"
# 生成 test-basic.md，默认配置：
#   auto_generate: false
#   types: [code_improvements]
#   batch_size: 3
#   worktree: true
#   quality_threshold: 0.6
#   max_iterations: 50

git add test-basic.md && git commit -m "add target.md"

# ============================================
# 阶段 2: FileRL 运行（只能用 viben 命令）
# ============================================

# 2.1 启动 FileRL run（解析 test-basic.md，创建 state.json）
viben filerl start test-basic.md --dry-run  # 先验证配置
viben filerl start test-basic.md

# 2.2 生成 idea（在 iter1/ 下）
viben filerl generate-ideas test-basic --types code_improvements

# 2.3 查看生成的 idea
viben filerl list-ideas test-basic

# 2.4 查看 FileRL 状态
viben filerl status test-basic

# 2.5 监控任务执行（FileRL start 会自动创建并执行 task）
viben swarm status --watch

# 2.6 验证 reward 文件位置
ls -la .viben/filerl/test-basic/iter1/*/

# 2.7 查看最终结果
viben task list
```

**预期结果**:
- FileRL run 创建成功
- idea 在 `iter1/` 下生成
- task 被创建并执行
- reward.json 在 `iter{N}/{idea}/{task}/` 下生成
- PPO 选择最优 task
- winner 合并，loser 清理

### 3.2 场景 B: Worktree 模式

**目标**: 验证 worktree 隔离执行

**配置差异**:
```yaml
rollout:
  worktree: true
```

**验证点**:
- worktree 目录创建
- 任务在隔离环境执行
- PR 自动创建
- winner 合并到主分支
- loser worktree 清理
- reward.json 仍在 `iter{N}/{idea}/{task}/`

### 3.3 场景 C: 多轮迭代

**目标**: 验证迭代循环和收敛检测

**配置**:
```yaml
idea:
  batch_size: 2
convergence:
  max_iterations: 3
  threshold: 0.01
```

**步骤**:
```bash
# 创建 run
viben filerl create test-iter -d "多轮迭代测试"

# 第 1 轮
viben filerl generate-ideas test-iter --iter 1 --types code_improvements
viben filerl start test-iter
# 等待完成...

# 第 2 轮（如果未收敛）
viben filerl generate-ideas test-iter --iter 2 --types code_improvements
viben filerl resume test-iter
# 等待完成...

# 查看收敛状态
viben filerl status test-iter
```

**验证点**:
- `iter1/`、`iter2/` 目录分别创建
- 每轮 idea 在对应 iter 目录下
- reward 在对应 iter 目录下
- 收敛后停止

### 3.4 场景 D: PPO 选择验证

**目标**: 验证 PPO 算法的选择逻辑

**配置**:
```yaml
ppo:
  kl_coef: 0.05
  change_sensitivity: 2.0
  clip_range: 0.2
  quality_threshold: 0.6
  max_diff: 500
```

**验证命令**:
```bash
# 查看详细的 PPO 计算结果
viben filerl select test-basic --threshold 0.6

# 输出应包含:
# ┌─────────┬────────┬───────┬────────┬──────────┬───────────┬────────────┐
# │ Task    │ Reward │ Diff  │ KL     │ Adjusted │ Advantage │ Status     │
# ├─────────┼────────┼───────┼────────┼──────────┼───────────┼────────────┤
# │ task-a  │ 0.858  │ 120   │ 0.012  │ 0.846    │ +0.130    │ ✓ SELECTED │
# │ task-b  │ 0.721  │ 450   │ 0.045  │ 0.676    │ -0.040    │ rejected   │
# └─────────┴────────┴───────┴────────┴──────────┴───────────┴────────────┘
```

### 3.5 场景 E: 错误恢复

**目标**: 验证各阶段的恢复能力

**测试项**:

```bash
# E1: 中断后恢复
viben filerl start test-basic
# 在执行期间 Ctrl+C
viben filerl status test-basic  # 查看当前 phase
viben filerl resume test-basic  # 从中断处继续

# E2: Agent 进程死亡
viben swarm stop <task>  # 模拟停止
viben filerl resume test-basic  # 应自动检测并重启

# E3: 无合格任务
# 当所有 task 的 reward < threshold 时
viben filerl status test-basic
# 应显示 no_merge_count 增加
```

### 3.6 场景 F: 指定迭代生成 idea

**目标**: 验证 `--iter` 参数

```bash
# 在指定迭代目录生成 idea
viben filerl generate-ideas test-basic --iter 2 --types code_improvements

# 验证目录结构
ls -la .viben/filerl/test-basic/iter2/

# 应该看到 idea 文件在 iter2/ 下
```

### 3.7 场景 G: PPO 公式计算验证

**目标**: 验证 PPO 算法中的数学公式计算

**README 算法定义**:
```
变更惩罚权重: w = exp(-β · d)
调整后得分: R̃ = R - λ · d
相对得分: S = R̃ - mean(R̃)
综合评分: L = min(w·S, clip(w, 1-ε, 1+ε)·S)
```

**配置**:
```yaml
ppo:
  kl_coef: 0.05           # λ (变更惩罚系数)
  change_sensitivity: 2.0  # β (变更惩罚敏感度)
  clip_range: 0.2          # ε (权重截断参数)
  max_diff: 500            # 最大变更行数
```

**验证步骤**:
```bash
# 手动准备两个 task 的 reward.json
# task-a: total_score=0.85, diff_lines=100
# task-b: total_score=0.75, diff_lines=400

# 运行 select 并验证计算
viben filerl select test-basic --json

# 预期计算 (以 task-a 为例):
# d = 100/500 = 0.2
# w = exp(-2.0 × 0.2) = exp(-0.4) ≈ 0.67
# R̃ = 0.85 - 0.05 × 0.2 = 0.84
# S = R̃ - mean(R̃)  (需要所有候选的平均值)
# L = min(0.67×S, clip(0.67, 0.8, 1.2)×S) = min(0.67×S, 0.8×S)
```

**验证点**:
- [ ] `w = exp(-β·d)` 计算正确
- [ ] `R̃ = R - λ·d` 计算正确
- [ ] `clip(w, 1-ε, 1+ε)` 截断正确
- [ ] 综合评分 L 计算正确

### 3.8 场景 H: 早停验证 (连续无合并)

**目标**: 验证连续 5 轮无合并触发早停

**配置**:
```yaml
ppo:
  quality_threshold: 0.9   # 设置极高阈值，确保无法合并
convergence:
  no_merge_limit: 5
```

**验证步骤**:
```bash
# 启动 FileRL (由于高阈值，所有候选都会被拒绝)
viben filerl start target-high-threshold.md

# 模拟 5 轮迭代 (每轮都无合格候选)
# 第 5 轮后应该触发早停

# 查看状态
viben filerl status test-early-stop --json

# 预期输出包含:
# "no_merge_count": 5
# "status": "stopped"
# "stop_reason": "no_merge_limit_reached"
```

**验证点**:
- [ ] 每轮无合格候选时 `no_merge_count` 递增
- [ ] `no_merge_count >= 5` 时触发早停
- [ ] 状态正确记录早停原因

### 3.9 场景 I: 收敛检测验证

**目标**: 验证收敛检测算法 `|mean(history[-5:]) - mean(history[-10:-5])| < δ`

**配置**:
```yaml
convergence:
  threshold: 0.01          # δ (停止阈值)
  max_iterations: 15       # 允许足够迭代以观察收敛
```

**验证步骤**:
```bash
# 运行 FileRL 直到收敛或达到最大迭代
viben filerl start test-converge.md

# 假设 10 轮后 history = [0.6, 0.65, 0.68, 0.70, 0.71, 0.72, 0.725, 0.728, 0.730, 0.731]
# mean(history[-5:]) = mean([0.72, 0.725, 0.728, 0.730, 0.731]) = 0.7268
# mean(history[-10:-5]) = mean([0.6, 0.65, 0.68, 0.70, 0.71]) = 0.668
# |0.7268 - 0.668| = 0.0588 > 0.01, 继续迭代

# 假设 12 轮后趋于平稳:
# mean(history[-5:]) ≈ 0.732
# mean(history[-10:-5]) ≈ 0.726
# |0.732 - 0.726| = 0.006 < 0.01, 触发收敛停止

# 查看状态
viben filerl status test-converge --json

# 预期输出包含:
# "status": "converged"
# "stop_reason": "convergence_threshold_reached"
# "history": [...]
```

**验证点**:
- [ ] 迭代历史正确记录每轮的 R̃(PR*)
- [ ] 收敛检测仅在 history.length >= 10 后启用
- [ ] 收敛检测公式计算正确
- [ ] 状态正确记录收敛原因

## 4. Reward 格式标准

### 4.1 存储位置

```
.viben/filerl/<run>/iter{N}/<idea>/<task>/reward.json
```

### 4.2 标准格式

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

### 4.3 字段说明

| 字段 | 类型 | 范围 | 说明 |
|------|------|------|------|
| `total_score` | number | 0-1 | 加权总分 |
| `diff_lines` | number | >= 0 | 代码变更行数 |
| `scores` | object | - | 各维度得分 |
| `computed_at` | string | ISO 8601 | 计算时间 |

## 5. 执行顺序

| 顺序 | 场景 | 预计时间 | 依赖 |
|------|------|----------|------|
| 1 | A: 基础流程 | 15 min | 无 |
| 2 | F: 指定迭代生成 | 5 min | A 完成 |
| 3 | D: PPO 选择 | 10 min | A 完成 |
| 4 | G: PPO 公式验证 | 15 min | A 完成 |
| 5 | B: Worktree 模式 | 20 min | A 完成 |
| 6 | C: 多轮迭代 | 25 min | A 完成 |
| 7 | H: 早停验证 | 20 min | C 完成 |
| 8 | I: 收敛检测 | 30 min | C 完成 |
| 9 | E: 错误恢复 | 15 min | A 完成 |

## 6. 验收标准

### 6.1 必须通过

- [ ] `viben filerl create` 创建 run 成功
- [ ] `viben filerl generate-ideas` 在 iter{N}/ 下生成 idea
- [ ] `viben filerl start` 启动 task 实际运行
- [ ] Task 状态只有合法值（无 "done"）
- [ ] reward.json 在 `iter{N}/{idea}/{task}/` 下生成
- [ ] Reward 格式为 `{ total_score: 0-1, diff_lines: N }`
- [ ] `viben filerl select <name>` PPO 选择正确
- [ ] `viben task approve` 合并 winner 成功

### 6.2 应该通过

- [ ] `--iter` 参数指定迭代目录
- [ ] Worktree 模式正常工作
- [ ] 多轮迭代正常
- [ ] 中断恢复正常

### 6.3 算法公式验证

- [ ] 变更惩罚权重 `w = exp(-β·d)` 计算正确
- [ ] 调整后得分 `R̃ = R - λ·d` 计算正确
- [ ] clip 截断 `clip(w, 1-ε, 1+ε)` 应用正确
- [ ] 综合评分 `L = min(w·S, clip(w)·S)` 计算正确
- [ ] 两阶段选择逻辑正确
- [ ] 连续无合并早停 (`no_merge_count >= 5`) 生效
- [ ] 收敛检测 (`|mean(history[-5:]) - mean(history[-10:-5])| < δ`) 生效

## 7. 命令速查

```bash
# 初始化
viben init
viben team init
viben user init FileRL-optimizer

# FileRL 生命周期
viben filerl create <name> --target <file>
viben filerl start <name>
viben filerl resume <name>
viben filerl stop <name>
viben filerl status <name>

# Idea 管理（FileRL 专用）
viben filerl generate-ideas <name> [--iter <N>] --types <types...>
viben filerl list-ideas <name>

# Task 生命周期
viben task list [--status completed] [--json]
viben filerl compute-reward <name> [--iter N] [--idea ID] [--task T]
viben task approve <task>
viben task cleanup <task>

# Reward 选择
viben filerl select <name> [--iter N] [--idea ID] [--tasks T...] --threshold 0.6 [--json]

# 监控
viben swarm status [--watch]
viben swarm list
viben swarm wait --all
viben swarm stop <task>

# 调试
viben filerl status <name> --json
cat .viben/filerl/<name>/state.json
ls -la .viben/filerl/<name>/iter1/
```

## 8. 参考文档

- [FileRL 命令参考](../../.claude/commands/viben/FileRL.md)
- [FileRL 设计文档](../superpowers/specs/2026-03-27-filerl-redesign.md)

# FileRL 功能测试计划

> 日期: 2026-03-27
> 目标: 验证 viben filerl 命令的完整工作流程

## 1. 测试范围

### 1.1 核心功能

| 功能 | 命令 | 覆盖场景 |
|------|------|----------|
| 创建 run | `viben filerl create` | 默认配置、自定义 target |
| 添加 idea | `viben filerl add-idea` | 单个、多个、重复添加 |
| 列出 idea | `viben filerl list-ideas` | 空列表、有内容 |
| 启动循环 | `viben filerl start` | 首次启动、重复启动 |
| 恢复循环 | `viben filerl resume` | 从各个 phase 恢复 |
| 停止循环 | `viben filerl stop` | 运行中停止 |
| 查看状态 | `viben filerl status` | 各阶段状态 |

### 1.2 迭代阶段

| Phase | 验证点 |
|-------|--------|
| fetch_ideas | idea 获取、batch_size 限制 |
| create_rollouts | task 创建、task_idea_map 映射 |
| execute_tasks | agent 启动、并行执行 |
| wait_tasks | 状态轮询、超时处理、进程健康检测 |
| compute_rewards | reward 计算、格式验证 |
| select_best | PPO 算法、两阶段选择、threshold 过滤 |
| merge_cleanup | PR 合并、loser 清理、idea 状态更新 |
| check_converge | 收敛检测、max_iterations 限制 |

### 1.3 配置参数

| 参数 | 测试值 | 验证点 |
|------|--------|--------|
| `idea.auto_generate` | false | 手动添加 idea |
| `idea.batch_size` | 2, 3 | 每轮处理数量 |
| `rollout.n` | 1, 2 | 每个 idea 的 rollout 次数 |
| `rollout.worktree` | true, false | worktree 隔离 vs 主仓库 |
| `ppo.quality_threshold` | 0.5, 0.7 | 质量阈值过滤 |
| `ppo.kl_coef` | 0.05 | 变更惩罚 |
| `convergence.max_iterations` | 3, 5 | 最大迭代次数 |
| `convergence.no_merge_limit` | 2 | 连续无合并限制 |

## 2. 测试环境

### 2.1 目录结构

```
/tmp/filerl-test/
├── index.js                    # 测试代码
├── utils.js                    # 辅助代码
├── target.md                   # FileRL 配置
├── ideas/                      # idea 文件
│   ├── idea-comment.md
│   ├── idea-logging.md
│   ├── idea-error-handling.md
│   └── idea-refactor.md
└── .viben/
    ├── filerl/test-run/
    │   ├── state.json
    │   └── iter{N}/{idea}/{task}/reward.json
    ├── ideas/test-run/
    └── tasks/
```

### 2.2 初始代码

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

## 3. 测试用例

### 3.1 场景 A: 基础流程（主仓库模式）

**目标**: 验证最简单的 FileRL 流程

**配置**:
```yaml
name: test-basic
idea:
  auto_generate: false
  batch_size: 2
rollout:
  n: 1
  worktree: false
ppo:
  quality_threshold: 0.5
convergence:
  max_iterations: 2
task:
  executor: CLAUDE_CODE
  model: haiku
```

**Idea 1 - 添加注释**:
```markdown
---
id: comment-001
title: Add JSDoc comments
effort: trivial
---
为 index.js 中的 greet 和 add 函数添加 JSDoc 注释。
```

**Idea 2 - 添加日志**:
```markdown
---
id: logging-001
title: Add console logging
effort: trivial
---
在 index.js 的函数入口添加 console.log 记录参数。
```

**步骤**:
```bash
# 1. 环境准备
rm -rf /tmp/filerl-test
mkdir -p /tmp/filerl-test/ideas
cd /tmp/filerl-test

# 2. 初始化
git init
# 创建 index.js, utils.js (内容如上)
git add . && git commit -m "init"
viben init
viben team init

# 3. 创建 FileRL run
viben filerl create test-basic --target target.md

# 4. 添加 idea
viben filerl add-idea test-basic ideas/idea-comment.md
viben filerl add-idea test-basic ideas/idea-logging.md
viben filerl list-ideas test-basic

# 5. 启动
viben filerl start test-basic

# 6. 监控
viben swarm status --watch

# 7. 验证
viben filerl status test-basic
viben task list
```

**预期结果**:
- 2 个 task 创建并执行
- Agent 完成代码修改
- Reward 计算完成
- 高分任务被选中
- 第 1 轮迭代完成

### 3.2 场景 B: Worktree 模式

**目标**: 验证 worktree 隔离执行

**配置**:
```yaml
name: test-worktree
rollout:
  worktree: true
```

**验证点**:
- worktree 目录创建
- 任务在隔离环境执行
- PR 自动创建
- winner 合并到主分支
- loser worktree 清理

### 3.3 场景 C: 多轮迭代

**目标**: 验证迭代循环和收敛检测

**配置**:
```yaml
name: test-iteration
idea:
  batch_size: 2
convergence:
  max_iterations: 3
  threshold: 0.01
```

**Idea 列表** (4 个):
1. 添加注释
2. 添加日志
3. 添加错误处理
4. 重构函数

**预期**:
- 第 1 轮: idea 1, 2 执行
- 第 2 轮: idea 3, 4 执行
- 收敛或达到 max_iterations

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

**验证点**:
- 大改动被惩罚 (diff_lines 影响)
- threshold 过滤低质量任务
- 两阶段选择 (best per idea → global best)

### 3.5 场景 E: 错误恢复

**目标**: 验证各阶段的恢复能力

**测试项**:
1. `execute_tasks` 阶段中断 → `resume` 继续
2. Agent 进程死亡 → 自动检测并重启
3. `select_best` 无合格任务 → no_merge_count 增加
4. 连续无合并 → 停止循环

### 3.6 场景 F: Reward 格式验证

**目标**: 验证 reward 标准格式

**标准格式**:
```json
{
  "reward": {
    "total_score": 0.85,
    "diff_lines": 50,
    "breakdown": {
      "correctness": 0.9,
      "code_quality": 0.8
    },
    "notes": "..."
  }
}
```

**验证点**:
- `total_score` 必须是 0-1 范围
- `diff_lines` 用于 PPO 惩罚计算
- 缺少 `total_score` 时报错

## 4. 执行顺序

| 顺序 | 场景 | 预计时间 | 依赖 |
|------|------|----------|------|
| 1 | A: 基础流程 | 10 min | 无 |
| 2 | F: Reward 格式 | 5 min | A 完成 |
| 3 | D: PPO 选择 | 10 min | A 完成 |
| 4 | B: Worktree 模式 | 15 min | A 完成 |
| 5 | C: 多轮迭代 | 20 min | A 完成 |
| 6 | E: 错误恢复 | 15 min | A 完成 |

## 5. 验收标准

### 5.1 必须通过

- [ ] `viben filerl create` 创建 run 成功
- [ ] `viben filerl add-idea` 添加 idea 成功
- [ ] `viben filerl start` 启动 task 实际运行
- [ ] Task 状态只有合法值（无 "done"）
- [ ] Reward 格式为 `{ total_score: 0-1, diff_lines: N }`
- [ ] PPO 选择算法正确
- [ ] 收敛检测正常

### 5.2 应该通过

- [ ] Worktree 模式正常工作
- [ ] 多轮迭代正常
- [ ] 中断恢复正常
- [ ] Idea 状态更新正确 (winner promoted, loser dismissed)

### 5.3 可选验证

- [ ] 性能: 单轮迭代 < 10 分钟
- [ ] 日志: 关键步骤有清晰输出
- [ ] 错误提示: 配置错误有明确提示

## 6. 测试命令速查

```bash
# FileRL 生命周期
viben filerl create <name> --target <file>
viben filerl start <name>
viben filerl resume <name>
viben filerl stop <name>
viben filerl status <name>

# Idea 管理
viben filerl add-idea <name> <idea.md>
viben filerl list-ideas <name>

# 监控
viben swarm status --watch
viben swarm list
viben task list

# 调试
viben filerl status <name> --json
cat .viben/filerl/<name>/state.json
```

## 7. 已知问题

1. **Idea dismiss 失败**: 已 promoted 的 idea 无法 dismiss（需要检查逻辑）
2. **skills 模块缺失**: 构建时有警告（不影响 FileRL 功能）

## 8. 参考文档

- [FileRL 设计文档](../superpowers/specs/2026-03-27-filerl-redesign.md)
- [FileRL 命令参考](../../.claude/commands/viben/FileRL.md)
- [PPO 算法说明](../../README.md#ppo-selection)

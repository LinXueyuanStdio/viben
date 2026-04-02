# viben task compute-reward 设计文档

> 实现 FileEvo 流程中的 PR 奖励评估命令

## 概述

`viben task compute-reward` 是 FileEvo（基于代码库的强化学习）流程的关键命令，用于评估 PR 的代码质量并计算奖励分数。该命令通过调用 reward agent 对多个维度进行评分，最终将结果写入 task.json。

### 设计原则

1. **单 Agent 串行评估** - 与 implement-phase、check-phase 模式一致
2. **Prompt-based 评分** - 复用现有 reward-types 提示词系统
3. **JSON 格式输出** - 便于解析和集成
4. **可配置权重** - 支持自定义 reward types 组合

---

## 架构设计

### 数据流

```
viben task compute-reward <task>
    │
    ├─ 1. 验证先决条件
    │      ├─ task.json 存在
    │      ├─ PR 已创建（pr_url 存在）
    │      └─ reward_config 已配置（或使用默认）
    │
    ├─ 2. 准备上下文
    │      ├─ 生成 reward.jsonl（reward type prompts 列表）
    │      ├─ 收集 git diff
    │      └─ 收集 PR info（如果有）
    │
    ├─ 3. 启动 reward agent
    │      ├─ 调用 .claude/agents/reward.md
    │      ├─ 传入 task_dir 和上下文
    │      └─ 日志输出到 reward.log.jsonl
    │
    └─ 4. 解析结果
           ├─ 从日志中提取 JSON scores
           ├─ 计算加权总分
           └─ 写入 task.json.reward 字段
```

### 与现有系统的关系

```
work-phase 子阶段
├── 1. implement-phase      → 实现代码
├── 2. check-phase          → 检查代码质量
├── 3. validate-check-phase → 验证通过
├── 4. create-pr            → 创建 PR
└── 5. compute-reward       → 评估 PR 奖励（本设计）
```

---

## 类型定义

### UnifiedTask 扩展

在 `packages/core/src/task/ops/types.ts` 的 `UnifiedTask` 接口中添加：

```typescript
export interface UnifiedTask {
  // ... 现有字段 ...

  // === FileEvo Reward ===
  /** Reward configuration for evaluation */
  reward_config?: RewardConfig;

  /** Reward evaluation result */
  reward?: RewardResult;
}
```

### RewardConfig（复用现有类型）

```typescript
// packages/core/src/reward/ops/types.ts（已存在）
interface RewardConfig {
  /** Reward types to use */
  types: string[];      // ["test_coverage", "code_quality", "agent_review"]

  /** Weights for each type (must sum to 1.0) */
  weights: number[];    // [0.4, 0.3, 0.3]
}
```

### RewardResult（复用现有类型）

```typescript
// packages/core/src/reward/ops/types.ts（已存在）
interface RewardResult {
  /** Scores from each reward type */
  scores: Record<string, RewardScore>;

  /** Weighted total score */
  total: number;

  /** Number of lines changed */
  diffLines: number;

  /** ISO timestamp when computed */
  computedAt: string;
}

interface RewardScore {
  /** Score value (0.0 - 1.0) */
  score: number;

  /** Explanation of the score */
  reasoning: string;
}
```

---

## 命令设计

### CLI 接口

```bash
viben task compute-reward <task> [options]

# 参数
<task>                 # 任务名称或目录

# 选项
--platform <platform>  # 执行器平台（默认 claude）
--detach              # 后台运行（默认 true）
--verbose             # 详细输出
--json                # JSON 格式输出
```

### 先决条件检查

1. `task.json` 必须存在
2. `pr_url` 字段存在（表示 PR 已创建）
3. `reward_config` 存在于 task.json 中（否则使用默认配置）

### 默认 reward_config

如果 task.json 中未配置 `reward_config`，使用默认值：

```json
{
  "types": ["test_coverage", "code_quality", "agent_review"],
  "weights": [0.34, 0.33, 0.33]
}
```

### 执行流程

1. **验证先决条件**
   - 检查 task.json 存在
   - 检查 pr_url 已配置
   - 检查 reward agent 配置存在

2. **准备上下文**
   - 从 task.json 读取 reward_config
   - 生成 reward.jsonl（reward type prompts 路径列表）
   - 收集评估上下文信息

3. **启动 reward agent**
   - 构建 prompt（包含 task_dir）
   - 调用 CLI adapter 执行 agent
   - 日志输出到 reward.log.jsonl

4. **解析结果**
   - 扫描日志文件找到 summary 行
   - 提取 scores 并计算加权总分
   - 写入 task.json

---

## reward.jsonl 格式

```jsonl
{"file": "packages/core/templates/viben/reward-types/test_coverage.md", "reason": "test_coverage", "weight": 0.4}
{"file": "packages/core/templates/viben/reward-types/code_quality.md", "reason": "code_quality", "weight": 0.3}
{"file": "packages/core/templates/viben/reward-types/agent_review.md", "reason": "agent_review", "weight": 0.3}
```

---

## reward.md Agent 设计

### Frontmatter

```yaml
---
name: reward
description: |
  PR quality evaluation agent for FileEvo. Evaluates code changes using reward type prompts. **IMPORTANT**: Always include `task_dir: <abs path>` as the FIRST LINE of prompt.
tools: Read, Bash, Glob, Grep
model: sonnet
---
```

### Agent 职责

1. **读取上下文**
   - `{task_dir}/reward.jsonl` - 获取 reward types 列表
   - `{task_dir}/prd.md` - 任务需求
   - `git diff main..HEAD` - 代码变更
   - `gh pr view` - PR 信息（如果有）

2. **执行评估**
   - 对每个 reward type 读取对应的 prompt 文件
   - 根据 prompt 指导进行评分
   - 输出 JSON 格式的评分结果

3. **输出格式**
   - 每个 type 评估完成后输出单行 JSON
   - 最后输出 summary JSON

### 输出示例

```json
{"type": "test_coverage", "score": 0.95, "reasoning": "测试覆盖率高，关键路径都有测试"}
{"type": "code_quality", "score": 0.82, "reasoning": "代码结构清晰，有少量重复代码"}
{"type": "agent_review", "score": 0.78, "reasoning": "功能完整，建议添加错误处理"}
{"_summary": true, "scores": {"test_coverage": {"score": 0.95, "reasoning": "..."}, ...}, "completed": true}
```

---

## 文件结构

### 新增文件

```
packages/core/
├── src/
│   ├── task/
│   │   └── phase/
│   │       └── reward.ts          # 新增：runRewardPhase 函数
│   └── cli/
│       └── commands/
│           └── task.ts            # 修改：添加 compute-reward 子命令

.claude/agents/
└── reward.md                      # 新增：reward agent 配置
```

### 运行时生成文件

```
.viben/tasks/<task>/
├── task.json                      # 修改：添加 reward_config, reward 字段
├── reward.jsonl                   # 新增：reward type prompts 列表
└── reward.log.jsonl              # 新增：agent 输出日志
```

---

## 实现清单

### Phase 1: 类型扩展

- [ ] 在 `task/ops/types.ts` 的 `UnifiedTask` 中添加 `reward_config` 字段
- [ ] 在 `task/ops/types.ts` 的 `UnifiedTask` 中添加 `reward` 字段
- [ ] 从 `reward/ops/types.ts` 导入 `RewardConfig` 和 `RewardResult`

### Phase 2: reward.md Agent

- [ ] 创建 `.claude/agents/reward.md`
- [ ] 定义 agent frontmatter（name, description, tools, model）
- [ ] 编写评估工作流
- [ ] 定义 JSON 输出格式

### Phase 3: reward.ts Phase Runner

- [ ] 创建 `task/phase/reward.ts`
- [ ] 实现 `runRewardPhase` 函数
- [ ] 实现 `runRewardPhaseSync` 函数
- [ ] 实现先决条件验证
- [ ] 实现 reward.jsonl 生成
- [ ] 实现 agent 启动逻辑

### Phase 4: CLI 命令

- [ ] 在 `task.ts` 中添加 `compute-reward` 子命令
- [ ] 实现命令选项解析
- [ ] 实现结果解析和 task.json 更新

### Phase 5: 测试

- [ ] 单元测试 reward.ts
- [ ] 集成测试 compute-reward 命令
- [ ] 端到端测试完整流程

---

## 错误处理

### 常见错误场景

| 错误 | 原因 | 处理方式 |
|------|------|----------|
| `task.json not found` | 任务目录不存在 | 返回错误，提示创建任务 |
| `PR not created` | pr_url 未配置 | 返回错误，提示先创建 PR |
| `reward agent not found` | agent 配置缺失 | 返回错误，提示配置 agent |
| `Invalid reward type` | reward_config 中指定了不存在的 type | 返回错误，列出可用 types |
| `Agent execution failed` | agent 执行出错 | 返回错误，保留日志供排查 |

---

## 后续扩展

### PPO Selection（viben reward select）

`compute-reward` 的结果将被 `viben reward select` 使用：

```bash
viben reward select task-a task-b task-c \
  --threshold 0.6 \
  --kl-coef 0.05
```

该命令将：
1. 读取各任务的 task.json 中的 reward 字段
2. 计算 KL penalty（基于 diff_lines）
3. 计算 adjusted reward 和 PPO score
4. 选择最优任务

---

## 参考

- [FileEvo Commands Design](../../../plans/2026-03-17-evo-commands-design.md)
- [Implement Phase Runner](../../../../packages/core/src/task/phase/implement.ts)
- [Reward Types](../../../../packages/core/src/reward/ops/types.ts)

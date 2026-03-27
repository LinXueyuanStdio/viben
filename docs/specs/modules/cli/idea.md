# viben idea

> AI 驱动的想法生成命令，分析项目代码库自动生成改进建议。

## 概述

`viben idea` 命令用于分析项目代码库，自动生成改进建议。支持 6 种内置类型和用户自定义类型。生成的想法可通过 `promote` 命令转为任务。

### 内置类型

| 类型 | 说明 |
|------|------|
| `code_improvements` | 代码改进 - 基于现有模式的改进机会 |
| `ui_ux_improvements` | UI/UX 改进 - 视觉和交互增强 |
| `documentation_gaps` | 文档缺失 - 缺失或不足的文档 |
| `security_hardening` | 安全加固 - 安全漏洞和加固措施 |
| `performance_optimizations` | 性能优化 - 性能瓶颈和优化技术 |
| `code_quality` | 代码质量 - 代码质量改进和重构模式 |

### 自定义类型

用户可在 `docs/idea-types/*.md` 创建自定义类型 prompt 模板。

## 命令结构

```
viben idea <subcommand> [options]

Subcommands:
  generate    生成想法（核心命令）
  list        列出已生成的想法
  list-types  列出可用的想法类型（内置 + 自定义）
  view        查看想法详情
  promote     将想法转为任务
  remove      删除想法
```

---

## 生成想法

### `viben idea generate`

生成想法，核心命令。

```bash
viben idea generate --types <type>... [options]
```

**必选参数**：

| 参数 | 说明 |
|------|------|
| `--types`, `-t` | 要生成的想法类型，可多选 |

**可选参数**：

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--output`, `-o` | 输出目录 | `.viben/ideas/` |
| `--model`, `-m` | AI 模型 | 全局配置 |
| `--max-ideas` | 每类最大想法数 | 5 |
| `--append` | 追加模式，保留已有想法 | false |
| `--override` | 强制重新生成所有类型 | false |
| `--json` | JSON 格式输出进度 | false |

**示例**：

```bash
# 生成代码改进和代码质量想法
viben idea generate --types code_improvements code_quality

# 使用自定义类型
viben idea generate --types my_custom_type --model opus

# 追加模式，每类最多 10 个
viben idea generate -t security_hardening --append --max-ideas 10
```

---

## 查看想法

### `viben idea list`

列出已生成的想法。

```bash
viben idea list [options]
```

**选项**：

| 参数 | 说明 |
|------|------|
| `--type`, `-t` | 按类型过滤 |
| `--effort`, `-e` | 按工作量过滤 (trivial/small/medium/large/complex) |
| `--status`, `-s` | 按状态过滤 (draft/promoted/dismissed) |
| `--json` | JSON 格式输出 |

**示例输出**：

```
Ideas (3):

[a1b2c3d4] code_improvements  draft  small
  Add retry logic to API calls
  为 API 调用添加自动重试逻辑，处理临时网络故障
  Why: 当前代码在网络错误时直接失败，没有重试机制
  Files:
    - src/api/client.ts
    - src/api/request.ts
  Implementation:
    使用 exponential backoff 策略，最多重试 3 次

[b2c3d4e5] code_improvements  draft  medium
  Extract common validators
  提取公共验证逻辑到独立模块
  Why: 多处代码存在重复的验证逻辑
  Files:
    - src/utils/validators.ts
    - src/forms/*.ts

[c3d4e5f6] security_hardening  promoted  small
  Add input sanitization
  添加输入消毒处理防止 XSS 攻击
  Why: 用户输入未经过滤直接渲染
  Task: 03-11-input-sanitization
```

---

### `viben idea list-types`

列出可用的想法类型。

```bash
viben idea list-types [--json]
```

**示例输出**：

```
TYPE                        SOURCE      DESCRIPTION
code_improvements           builtin     代码改进 - 基于现有模式的改进机会
ui_ux_improvements          builtin     UI/UX 改进 - 视觉和交互增强
documentation_gaps          builtin     文档缺失 - 缺失或不足的文档
security_hardening          builtin     安全加固 - 安全漏洞和加固措施
performance_optimizations   builtin     性能优化 - 性能瓶颈和优化技术
code_quality                builtin     代码质量 - 代码质量改进和重构模式
api_design                  custom      docs/idea-types/api_design.md
```

---

### `viben idea view`

查看想法详情。

```bash
viben idea view <idea-id> [--json]
```

**示例输出**：

```
[a1b2c3d4] code_improvements  draft  small
Add retry logic to API calls
Created: 2026-03-11T14:30:00Z

Description
为 API 调用添加自动重试逻辑，处理临时网络故障

Rationale
当前代码在网络错误时直接失败，没有重试机制

Affected Files
  - src/api/client.ts
  - src/api/request.ts

Existing Patterns
  - error handling in src/utils/error.ts

Implementation
使用 exponential backoff 策略，最多重试 3 次。
1. 在 src/api/client.ts 中添加 retry wrapper
2. 配置最大重试次数和退避时间
3. 对可重试的错误码进行重试
```

---

## 想法管理

### `viben idea promote`

将想法转为任务。支持所有 `viben task create` 的选项。

```bash
viben idea promote <idea-id> [options]
```

**选项**（与 `viben task create` 一致）：

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `-s, --slug <name>` | 任务标识符 | 从 idea title 生成 |
| `-b, --branch <branch>` | 自定义分支名 | `feature/<slug>` |
| `-a, --assignee <dev>` | 分配给谁 | 当前开发者 |
| `-p, --priority <priority>` | 优先级 (P0-P3) | 根据 effort 映射 |
| `-d, --description <text>` | 任务描述 | idea 的 description |
| `--agent <agent-id>` | 关联的 agent 配置 | - |
| `--executor <type>` | 执行器类型 | CLAUDE_CODE |
| `--model <model>` | 使用的模型 | - |
| `--start` | 自动加入队列 (status: queue) | false |
| `--worktree` | 在 git worktree 中运行 | false |
| `--json` | JSON 格式输出 | false |

**执行器类型**: `CLAUDE_CODE`, `CURSOR`, `GEMINI`, `OPENCODE`, `IFLOW`, `CODEX`, `KILO`, `KIRO`, `ANTIGRAVITY`

**effort → priority 默认映射**：

| Effort | Priority |
|--------|----------|
| trivial | P3 |
| small | P3 |
| medium | P2 |
| large | P1 |
| complex | P1 |

**示例**：

```bash
# 将想法转为任务（最简方式）
viben idea promote ci-001

# 指定优先级和 slug
viben idea promote ci-001 --slug add-retry-logic --priority P1

# 创建并自动启动任务
viben idea promote ci-001 --start

# 在隔离的 worktree 中开发
viben idea promote ci-001 --worktree --start

# 完整示例：指定分支、执行器和模型
viben idea promote ci-001 \
  --slug add-retry-logic \
  --branch feature/api-retry \
  --priority P1 \
  --executor CLAUDE_CODE \
  --model opus \
  --start
```

**执行流程**：

1. 读取想法详情
2. 调用 `viben task create` 创建任务（传递所有选项）
3. 更新想法状态为 `promoted`
4. 在想法中记录关联的 task id
5. 如果指定了 `--start`，任务状态设为 `queue`

---

### `viben idea remove`

删除想法。

```bash
viben idea remove <idea-id>... [--type <type>] [--all]
```

**选项**：

| 参数 | 说明 |
|------|------|
| `--type`, `-t` | 删除指定类型的所有想法 |
| `--all` | 删除所有想法 |

**示例**：

```bash
# 删除单个想法
viben idea remove ci-001

# 删除多个想法
viben idea remove ci-001 ci-002 sq-001

# 删除某类型所有想法
viben idea remove --type code_improvements

# 清空所有想法
viben idea remove --all
```

---

## 数据结构

### 目录结构

```
.viben/
└── ideas/
    └── <date>-<slug>/                          # 每次生成一个目录
        ├── idea.json                           # 元信息
        ├── idea_code_improvements_<name1>.md   # 每个 idea 单独一个文件
        ├── idea_code_improvements_<name2>.md
        ├── idea_security_hardening_<name1>.md
        └── idea_my_custom_type_<name1>.md

docs/
└── idea-types/                  # 自定义类型 prompt 模板
    ├── api_design.md
    └── refactoring.md
```

**文件命名规则**: `idea_<type>_<name>.md`，其中 `<name>` 是 idea 的 file-friendly 名称（如 `add-pagination-sessions`）。

### idea.json 格式

```json
{
  "id": "03-11-api-improvement",
  "types": ["code_improvements", "security_hardening"],
  "model": "sonnet",
  "summary": {
    "total_ideas": 10,
    "by_type": {"code_improvements": 5, "security_hardening": 5},
    "by_status": {"draft": 9, "promoted": 1}
  },
  "files": [
    "idea_code_improvements_add-retry-logic.md",
    "idea_code_improvements_extract-validators.md",
    "idea_security_hardening_input-sanitization.md"
  ],
  "generated_at": "2026-03-11T14:30:00Z",
  "updated_at": "2026-03-11T14:35:00Z"
}
```

### idea_*.md 格式

每个 idea 单独一个文件，使用 YAML frontmatter 存储所有元数据：

```markdown
---
id: a1b2c3d4
type: code_improvements
name: add-retry-logic
title: Add retry logic to API calls
description: 为 API 调用添加自动重试逻辑，处理临时网络故障
rationale: 当前代码在网络错误时直接失败，没有重试机制
estimated_effort: small
status: draft
promoted_to: null
created_at: 2026-03-11T14:30:00Z
affected_files:
  - src/api/client.ts
  - src/api/request.ts
existing_patterns:
  - error handling in src/utils/error.ts
---

使用 exponential backoff 策略，最多重试 3 次。

1. 在 `src/api/client.ts` 中添加 retry wrapper
2. 配置最大重试次数和退避时间
3. 对可重试的错误码进行重试（如 5xx、网络超时）
```

**说明**:
- `id`: 8 字符短 UUID（如 `a1b2c3d4`）
- `name`: 文件友好名称，用于文件命名
- `affected_files` 和 `existing_patterns` 存储在 frontmatter 中
- body 部分为 `implementation_approach`（实现方法）

---

## 自定义类型 Prompt 模板

### docs/idea-types/*.md 格式

用户可创建自定义类型，文件名即类型名。

```markdown
---
name: api_design
description: API 设计改进 - RESTful 规范、接口一致性、版本管理
max_ideas: 5
---

# API Design Ideation Agent

你是一个 API 设计专家，负责分析项目代码库并提出 API 改进建议。

## 分析重点

1. RESTful 规范遵循程度
2. 接口命名一致性
3. 请求/响应格式统一性
4. 错误处理规范
5. API 版本管理

## 输出要求

对于每个改进建议，提供：

- **title**: 简短描述
- **description**: 改进内容
- **rationale**: 为什么需要改进
- **affected_files**: 涉及的文件
- **existing_patterns**: 可参考的现有模式
- **implementation_approach**: 实现方法
- **estimated_effort**: trivial/small/medium/large/complex
```

### YAML Header 字段

| 字段 | 必填 | 说明 |
|------|------|------|
| `name` | 是 | 类型标识符 |
| `description` | 是 | 类型描述（显示在 list-types） |
| `max_ideas` | 否 | 默认最大想法数，默认 5 |

正文为 prompt 内容，直接发送给 AI。

### 内置类型 Prompt 存放

内置类型存放在 `packages/core/templates/viben/idea-types/`，运行时直接从此目录加载：

```
packages/core/templates/viben/idea-types/
├── code_improvements.md      # 代码改进
├── code_quality.md           # 代码质量
├── documentation_gaps.md     # 文档缺失
├── performance_optimizations.md  # 性能优化
├── security_hardening.md     # 安全加固
└── ui_ux_improvements.md     # UI/UX 改进
```

### 查找顺序

CLI 按以下顺序查找 idea type prompt：

1. `docs/idea-types/<type>.md`（项目自定义，优先）
2. `packages/core/templates/viben/idea-types/<type>.md`（内置 fallback）

这意味着：
- 即使未运行 `viben team init`，内置类型也可用
- 项目可以在 `docs/idea-types/` 中覆盖内置类型
- 自定义类型只需在 `docs/idea-types/` 中创建

---

## 执行流程

### `viben idea generate` 执行流程

```
┌─────────────────────────────────────────────────────────────┐
│                    GENERATE PIPELINE                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  STEP 1: 解析参数                                            │
│  ┌─────────────────────────────────────┐                    │
│  │ - 验证 --types 参数                  │                    │
│  │ - 加载类型 prompt（内置 or 自定义）    │                    │
│  │ - 确定输出目录和模型                  │                    │
│  └─────────────────────────────────────┘                    │
│                      ↓                                      │
│  STEP 2: 创建输出目录                                        │
│  ┌─────────────────────────────────────┐                    │
│  │ .viben/ideas/<date>-<slug>/         │                    │
│  │ - 初始化 idea.json                   │                    │
│  └─────────────────────────────────────┘                    │
│                      ↓                                      │
│  STEP 3: 并行生成想法                                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                     │
│  │ type_1   │ │ type_2   │ │ type_n   │                     │
│  │ AI Agent │ │ AI Agent │ │ AI Agent │                     │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘                     │
│       ↓            ↓            ↓                           │
│  ┌─────────────────────────────────────────────┐            │
│  │ idea_type1_name1.md, idea_type1_name2.md... │            │
│  │ idea_type2_name1.md, idea_type2_name2.md... │            │
│  │ idea_typen_name1.md, idea_typen_name2.md... │            │
│  └─────────────────────────────────────────────┘            │
│                      ↓                                      │
│  STEP 4: 更新元信息                                          │
│  ┌─────────────────────────────────────┐                    │
│  │ - 统计各类型想法数量                  │                    │
│  │ - 更新 idea.json summary             │                    │
│  └─────────────────────────────────────┘                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Acceptance Criteria

### 命令实现

- [ ] `viben idea generate --types <type>...` 生成想法
- [ ] `viben idea list` 列出想法
- [ ] `viben idea list-types` 列出可用类型（内置 + 自定义）
- [ ] `viben idea view <idea-id>` 查看想法详情
- [ ] `viben idea promote <idea-id>` 将想法转为任务
- [ ] `viben idea remove <idea-id>...` 删除想法

### generate 选项

- [ ] `--types`, `-t` 必选，指定类型
- [ ] `--output`, `-o` 可选，指定输出目录
- [ ] `--model`, `-m` 可选，覆盖全局模型配置
- [ ] `--max-ideas` 可选，每类最大想法数
- [ ] `--append` 追加模式
- [ ] `--override` 强制重新生成

### 数据结构

- [ ] `.viben/ideas/<date>-<slug>/idea.json` 元信息（含 files 列表）
- [ ] `.viben/ideas/<date>-<slug>/idea_<type>_<name>.md` 每个想法单独文件
- [ ] `docs/idea-types/*.md` 自定义类型支持

### 集成

- [ ] `promote` 调用 `viben task create` 创建任务
- [ ] 支持全局模型配置 + 命令行覆盖
- [ ] 并行生成多类型想法

---

## Related Documents

- [task.md](./task.md) - 任务管理命令
- [model.md](./model.md) - 模型配置

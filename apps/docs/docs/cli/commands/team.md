---
sidebar_position: 14
title: "viben team"
description: "团队协作工作区初始化和管理"
---

# viben team

团队协作工作区初始化和管理。

## 用法

```bash
viben team <subcommand> [options]
```

## 架构概述

```
+-------------------------------------------------------------+
|                    Team Workspace                            |
+-------------------------------------------------------------+
|  .viben/                                                     |
|      +-- workflow.md           # 工作流文档                   |
|      +-- worktree.yaml         # Git worktree 配置            |
|      +-- .gitignore            # Git 忽略规则                 |
|      +-- .version              # 版本号                       |
|      +-- .developer            # 开发者身份                   |
|      +-- .current-task         # 当前任务指针                 |
|      +-- .template-hashes.json # 模板文件哈希                 |
|      +-- workspace/            # 开发者工作区                 |
|      |   +-- <developer>/      # 每个开发者的独立空间         |
|      +-- tasks/                # 任务目录                     |
|      |   +-- archive/          # 归档任务                     |
+-------------------------------------------------------------+
|  .claude/                      # Claude Code 配置             |
|      +-- settings.json         # Claude Code 设置             |
|      +-- agents/               # 子智能体定义                 |
|      +-- commands/viben/       # 自定义命令                   |
|      +-- hooks/                # 钩子脚本                     |
+-------------------------------------------------------------+
|  .cursor/ (可选)               # Cursor IDE 配置              |
|      +-- commands/             # Cursor 命令                  |
+-------------------------------------------------------------+
|  AGENTS.md                     # 根级智能体指令文件           |
+-------------------------------------------------------------+
```

## 核心概念

| 概念 | 说明 |
|------|------|
| **Developer** | 开发者标识，用于区分不同开发者的工作区 |
| **Project Type** | 项目类型 (frontend/backend/fullstack)，决定生成哪些规范文件 |
| **Workspace** | 开发者独立工作空间，包含日志和会话记录 |
| **Task** | 任务单元，包含 task.json 和 prd.md |
| **Spec** | 项目规范文档，指导 AI 智能体行为 |

## 命令

### 初始化团队工作区

```bash
# 初始化团队工作区
viben team init --developer <name>
viben team init --developer john-doe

# 指定项目类型
viben team init --developer <name> --project-type <type>
viben team init --developer john-doe --project-type frontend
viben team init --developer john-doe --project-type backend
viben team init --developer john-doe --project-type fullstack  # 默认

# 指定目标目录
viben team init --developer <name> --target <path>
viben team init --developer john-doe --target /path/to/project

# 强制覆盖现有文件
viben team init --developer <name> --force

# 跳过已存在的文件
viben team init --developer <name> --skip-existing

# 不包含 Cursor 配置
viben team init --developer <name> --no-cursor

# JSON 输出
viben team init --developer <name> --json
```

## 参数说明

| 参数 | 必需 | 默认值 | 说明 |
|------|------|--------|------|
| `--developer, -d` | 是 | - | 开发者名称，小写字母数字加连字符 |
| `--project-type, -t` | - | `fullstack` | 项目类型: frontend, backend, fullstack |
| `--target` | - | `cwd` | 目标目录路径 |
| `--force, -f` | - | `false` | 强制覆盖现有文件 |
| `--skip-existing` | - | `false` | 跳过已存在的文件 |
| `--no-cursor` | - | `false` | 不创建 .cursor 目录 |
| `--json` | - | `false` | JSON 格式输出 |

## Developer 名称验证规则

开发者名称必须满足以下规则：
- 只能包含小写字母 (a-z)、数字 (0-9) 和连字符 (-)
- 不能以连字符开头或结尾
- 不能为空

**有效示例：** `john`, `john-doe`, `dev123`, `my-agent-1`

**无效示例：** `John` (大写), `-invalid` (以连字符开头), `invalid-` (以连字符结尾)

## 输出示例

**`viben team init --developer john-doe`（人类可读）：**

```
Initialized Viben team workspace

Created directories:
  .viben/           Team workflow and workspace
  docs/specs/       Project specifications
  .claude/          Claude Code configuration
  .cursor/          Cursor IDE commands
  AGENTS.md         Root agent instructions

Developer: john-doe
Project type: fullstack

Next steps:
  1. Review .viben/tasks/00-bootstrap-guidelines/prd.md
  2. Fill in project-specific specs in docs/specs/
  3. Run /viben:start to begin your first session
```

**`viben team init --developer john-doe --json`：**

```json
{
  "success": true,
  "path": "/path/to/project",
  "files": [
    ".viben/workflow.md",
    ".viben/worktree.yaml",
    ".viben/.gitignore",
    ".viben/.version",
    ".viben/.developer",
    "docs/specs/guides/index.md",
    ".claude/settings.json",
    ".claude/agents/check.md",
    "AGENTS.md"
  ],
  "warnings": []
}
```

## 错误处理

### 目录已存在

```
Error: Directory already exists: /path/to/project/.viben

Use --force to overwrite or --skip-existing to skip
```

### 无效的开发者名称

```
Error: Invalid developer name "John-Doe"

Developer name must be lowercase alphanumeric with hyphens,
not starting or ending with hyphen.

Valid examples: john, john-doe, dev123
```

## 生成的目录结构

### .viben/ 目录

```
.viben/
+-- workflow.md              # 工作流文档
+-- worktree.yaml            # Git worktree 配置
+-- .gitignore               # Git 忽略规则
+-- .version                 # 版本号 (1.0.0)
+-- .developer               # 开发者身份信息
+-- .current-task            # 当前任务路径
+-- .template-hashes.json    # 模板 SHA256 哈希
|
+-- workspace/
|   +-- index.md             # 工作区索引
|   +-- <developer>/
|       +-- index.md         # 开发者索引
|       +-- journal-1.md     # 会话日志
|
+-- tasks/
|   +-- archive/             # 归档任务
|   +-- 00-bootstrap-guidelines/
|       +-- task.json        # 任务元数据
|       +-- prd.md           # 任务需求文档
```

### docs/specs/ 目录

```
docs/specs/
+-- guides/              # 通用指南 (始终创建)
|   +-- index.md
|   +-- cross-layer-thinking-guide.md
|   +-- code-reuse-thinking-guide.md
|
+-- backend/             # 后端规范 (backend/fullstack)
|   +-- index.md
|   +-- directory-structure.md
|   +-- database-guidelines.md
|   +-- logging-guidelines.md
|   +-- quality-guidelines.md
|   +-- error-handling.md
|
+-- frontend/            # 前端规范 (frontend/fullstack)
    +-- index.md
    +-- directory-structure.md
    +-- type-safety.md
    +-- hook-guidelines.md
    +-- component-guidelines.md
    +-- quality-guidelines.md
    +-- state-management.md
```

### .claude/ 目录

```
.claude/
+-- settings.json            # Claude Code 设置
|
+-- agents/                  # 子智能体
|   +-- check.md
|   +-- fix.md
|   +-- dispatch.md
|   +-- implement.md
|   +-- plan.md
|   +-- research.md
|
+-- commands/viben/          # 自定义命令
|   +-- before-backend-dev.md
|   +-- before-frontend-dev.md
|   +-- break-loop.md
|   +-- check-backend.md
|   +-- check-cross-layer.md
|   +-- check-frontend.md
|   +-- create-command.md
|   +-- finish-work.md
|   +-- integrate-skill.md
|   +-- onboard.md
|   +-- record-session.md
|   +-- start.md
|   +-- task.md
|   +-- update-spec.md
|
+-- hooks/                   # 钩子脚本 (可执行)
    +-- ralph-loop.py
    +-- session-start.py
```

### .cursor/ 目录（可选）

```
.cursor/
+-- commands/
    +-- viben-before-backend-dev.md
    +-- viben-before-frontend-dev.md
    +-- viben-break-loop.md
    +-- viben-check-backend.md
    +-- viben-check-cross-layer.md
    +-- viben-check-frontend.md
    +-- viben-create-command.md
    +-- viben-finish-work.md
    +-- viben-integrate-skill.md
    +-- viben-onboard.md
    +-- viben-record-session.md
    +-- viben-start.md
    +-- viben-update-spec.md
```

## 文件权限

钩子脚本文件 (`.py`) 创建时设置为可执行 (mode 0755)。

## 模板哈希

`.viben/.template-hashes.json` 存储所有模板文件的 SHA256 哈希，用于：
- 检测本地文件是否被修改
- 升级时判断是否需要更新
- 冲突解决

```json
{
  ".viben/workflow.md": "a1b2c3d4...",
  ".claude/settings.json": "e5f6g7h8...",
  ".claude/agents/check.md": "i9j0k1l2..."
}
```

## 相关命令

- [viben init](./init) - 基本工作区初始化
- [viben workspace](./workspace) - 工作区操作
- [viben agent](./agent) - 智能体管理

---
sidebar_position: 2
title: "viben init"
description: "初始化带 AI 辅助开发环境的 Viben 工作区"
---

# viben init

初始化带完整 AI 辅助开发环境的 Viben 工作区。

## 用法

```bash
viben init [选项] [target-dir]
```

## 选项

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `--user, -u` | 开发者名称（小写字母数字加连字符） | 从 `git config user.name` 自动检测 |
| `--executor, -e` | AI 执行器类型（可重复指定多个执行器） | `CURSOR,CLAUDE_CODE` |
| `--yes, -y` | 非交互模式，使用默认值 | `false` |
| `--force, -f` | 强制覆盖现有文件 | `false` |
| `--skip-existing, -s` | 跳过已存在的文件 | `false` |
| `--from <template>` | 从模板初始化 | - |
| `--json` | JSON 格式输出 | `false` |

### 支持的执行器

| 执行器 | 说明 | 配置目录 |
|--------|------|----------|
| `CLAUDE_CODE` | Claude Code (Anthropic) | `.claude/` |
| `CURSOR` | Cursor IDE | `.cursor/` |
| `GEMINI` | Gemini CLI (Google) | `.gemini/` |
| `CODEX` | Codex CLI (OpenAI) | `.agents/skills/` |
| `OPENCODE` | OpenCode | `.opencode/` |
| `IFLOW` | iFlow CLI | `.iflow/` |
| `KILO` | Kilo CLI | `.kilocode/` |
| `KIRO` | Kiro Code | `.kiro/skills/` |
| `ANTIGRAVITY` | Antigravity | `.agent/workflows/` |

## 示例

### 基本初始化

使用默认执行器（CURSOR + CLAUDE_CODE）初始化工作区：

```bash
viben init --user <name>
viben init --user john-doe
```

**输出（人类可读）：**

```
Initializing Viben workspace...
  Target: /path/to/project
  Developer: john-doe
  Executors: CURSOR, CLAUDE_CODE

Workspace initialized successfully!

Created 97 files:
  .viben/     - Workflow files and workspace
  docs/specs/ - Project specifications
  .claude     - Claude Code configuration
  .cursor     - Cursor configuration
  AGENTS.md   - Root instructions file

Next steps:
  1. Review and customize docs/specs/ guidelines
  2. Run viben task context <task> to verify setup
  3. Start developing with AI assistance!
```

### 指定执行器

```bash
# 单个执行器
viben init --user john-doe --executor CLAUDE_CODE
viben init --user john-doe --executor CURSOR

# 多个执行器（重复使用 --executor 标志）
viben init --user john-doe --executor CLAUDE_CODE --executor CURSOR
viben init --user john-doe -e CLAUDE_CODE -e GEMINI -e CURSOR
```

### 非交互模式

```bash
# 使用默认值，无需交互确认
viben init --user john-doe --yes
viben init --user john-doe -y
```

### 强制覆盖

```bash
# 强制覆盖现有文件
viben init --user john-doe --force
```

### 其他选项

```bash
# 指定目标目录
viben init --user john-doe ./my-project

# 跳过已存在的文件
viben init --user john-doe --skip-existing

# JSON 输出
viben init --user john-doe --json
```

**输出（JSON）：**

```bash
viben init --user john-doe --json
```

```json
{
  "success": true,
  "data": {
    "path": "/path/to/project",
    "files": [
      ".viben/config.yaml",
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
    "count": 97,
    "warnings": []
  }
}
```

### 从模板初始化

从预定义模板创建工作区：

```bash
viben init --from my-template
```

## 开发者名称验证规则

开发者名称必须满足以下规则：
- 只能包含小写字母 (a-z)、数字 (0-9) 和连字符 (-)
- 不能以连字符开头或结尾
- 不能为空

**有效示例：** `john`, `john-doe`, `dev123`, `my-agent-1`

**无效示例：** `John` (大写), `-invalid` (以连字符开头), `invalid-` (以连字符结尾)

## 创建的内容

### .viben/ 目录

```
.viben/
+-- config.yaml              # 工作区配置
+-- workflow.md              # 工作流文档
+-- worktree.yaml            # Git worktree 配置
+-- .gitignore               # Git 忽略规则
+-- .version                 # 版本号 (1.0.0)
+-- .developer               # 开发者身份信息
+-- .template-hashes.json    # 模板 SHA256 哈希
|
+-- workspace/
|   +-- index.md             # 工作区索引
|   +-- <developer>/
|       +-- index.md         # 开发者索引
|       +-- journal-1.md     # 会话日志
|
+-- tasks/
    +-- archive/             # 归档任务
```

### docs/specs/ 目录

```
docs/specs/
+-- guides/              # 通用指南（始终创建）
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

选择 `CLAUDE_CODE` 执行器时创建：

```
.claude/
+-- settings.json            # Claude Code 设置
|
+-- agents/                  # 子智能体
|   +-- check.md
|   +-- fix.md
|   +-- work.md
|   +-- implement.md
|   +-- plan.md
|   +-- research.md
|
+-- commands/viben/          # 自定义命令
    +-- break-loop.md
    +-- create-command.md
    +-- finish-work.md
    +-- integrate-skill.md
    +-- onboard.md
    +-- record-session.md
    +-- start.md
    +-- task.md
    +-- update-spec.md
```

### .cursor/ 目录

选择 `CURSOR` 执行器时创建：

```
.cursor/
+-- commands/
    +-- viben-break-loop.md
    +-- viben-create-command.md
    +-- viben-finish-work.md
    +-- viben-integrate-skill.md
    +-- viben-onboard.md
    +-- viben-record-session.md
    +-- viben-start.md
    +-- viben-update-spec.md
```

### AGENTS.md

根级别的智能体指令文件，AI 智能体会读取该文件以获取项目级别的指令。

## 错误处理

### 工作区已存在

```bash
viben init
```

```
Error: Workspace already initialized at /path/to/project/.viben
```

JSON 输出：

```json
{
  "success": false,
  "error": {
    "code": "WORKSPACE_EXISTS",
    "message": "Workspace already initialized at /path/to/project/.viben"
  }
}
```

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

### 无效的执行器

```
Error: Invalid executor "INVALID".

Valid executors:
  CLAUDE_CODE, CURSOR, GEMINI, CODEX, OPENCODE, IFLOW, KILO, KIRO, ANTIGRAVITY
```

### 权限被拒绝

```json
{
  "success": false,
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "Cannot create .viben directory: permission denied"
  }
}
```

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

- [viben workspace](./workspace) - 工作区操作
- [viben config](./config) - 配置管理
- [viben mcp](./mcp) - MCP 服务器管理
- [viben agent](./agent) - 智能体管理

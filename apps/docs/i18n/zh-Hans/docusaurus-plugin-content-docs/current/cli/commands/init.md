---
sidebar_position: 2
title: "viben init"
description: "初始化带团队协作支持的 Viben 工作区"
---

# viben init

初始化带团队协作支持的 Viben 工作区。

## 用法

```bash
viben init [选项]
```

## 选项

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `--developer, -d` | 开发者名称（小写字母数字加连字符） | - |
| `--project-type, -t` | 项目类型: frontend, backend, fullstack | `fullstack` |
| `--target` | 目标目录路径 | 当前目录 |
| `--force, -f` | 强制覆盖现有文件 | `false` |
| `--skip-existing` | 跳过已存在的文件 | `false` |
| `--no-cursor` | 不创建 .cursor 目录 | `false` |
| `--from <template>` | 从模板初始化 | - |
| `--json` | JSON 格式输出 | `false` |

## 示例

### 基本初始化

使用默认配置创建新工作区：

```bash
viben init
```

**输出（人类可读）：**

```
Initialized Viben workspace in /path/to/project
  Created .viben/config.yaml

Next steps:
  viben mcp install <name>    # Install MCP servers
  viben skill install <name>  # Install skills
```

### 团队工作区初始化

初始化带开发者身份的完整团队工作区：

```bash
# 初始化团队工作区
viben init --developer <name>
viben init --developer john-doe

# 指定项目类型
viben init --developer <name> --project-type <type>
viben init --developer john-doe --project-type frontend
viben init --developer john-doe --project-type backend
viben init --developer john-doe --project-type fullstack  # 默认

# 指定目标目录
viben init --developer <name> --target <path>
viben init --developer john-doe --target /path/to/project

# 强制覆盖现有文件
viben init --developer <name> --force

# 跳过已存在的文件
viben init --developer <name> --skip-existing

# 不包含 Cursor 配置
viben init --developer <name> --no-cursor

# JSON 输出
viben init --developer <name> --json
```

**输出（人类可读）：**

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

**输出（JSON）：**

```bash
viben init --developer john-doe --json
```

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

### 基本初始化（不带 --developer）

```
<project>/
  .viben/
    config.yaml       # 工作区配置
```

### 团队工作区（带 --developer）

#### .viben/ 目录

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

#### docs/specs/ 目录

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

#### .claude/ 目录

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
|   +-- break-loop.md
|   +-- create-command.md
|   +-- finish-work.md
|   +-- integrate-skill.md
|   +-- onboard.md
|   +-- record-session.md
|   +-- start.md
|   +-- task.md
|   +-- update-spec.md
|
+-- hooks/                   # 钩子脚本（可执行）
    +-- ralph-loop.py
    +-- session-start.py
```

#### .cursor/ 目录（可选）

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

### 目录已存在（团队模式）

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

- [viben workspace](./workspace) - 工作区操作
- [viben config](./config) - 配置管理
- [viben mcp](./mcp) - MCP 服务器管理
- [viben agent](./agent) - 智能体管理

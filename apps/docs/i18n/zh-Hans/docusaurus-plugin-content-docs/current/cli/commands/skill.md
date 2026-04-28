---
sidebar_position: 6
title: "viben skill"
description: "管理技能 - 安装、卸载、查看、启用、禁用和列出可用技能"
---

# viben skill

管理微本智能体的技能。

## 用法

```bash
viben skill <子命令> [选项]
```

## 子命令

| 子命令 | 描述 |
|--------|------|
| `list` | 列出已安装的技能 |
| `show <name>` | 查看技能详情 |
| `install <name>` | 安装技能 |
| `uninstall <name>` | 卸载技能 |
| `enable <name>` | 为智能体启用技能 |
| `disable <name>` | 为智能体禁用技能 |
| `enabled` | 列出智能体已启用的技能 |
| `path <name>` | 获取技能的文件路径 |

## 命令

### 列出技能

列出已安装的技能：

```bash
# 列出所有已安装的技能
viben skill list

# 列出市场中可用的技能
viben skill list --available

# 列出特定智能体的技能
viben skill list --agent <agent-id>

# 仅列出全局技能
viben skill list --global

# 仅列出 Claude 技能
viben skill list --claude

# JSON 输出
viben skill list --json
```

**选项**:

| 选项 | 描述 |
|------|------|
| `--available` | 列出市场中可用的技能 |
| `--agent <id>` | 列出特定智能体的技能 |
| `--global` | 仅列出全局技能 |
| `--claude` | 仅列出 Claude 技能 |
| `--json` | JSON 格式输出 |

**输出（人类可读）：**

```
Installed Skills:
  Name           Version    Path                         Installed At
  code-review    1.0.0      /path/to/code-review         2d ago
  commit         1.2.0      /path/to/commit              5d ago
  test-runner    0.9.0      /path/to/test-runner         1w ago
```

**输出（JSON）：**

```bash
viben skill list --json
```

```json
{
  "success": true,
  "data": {
    "installed": [
      {
        "name": "code-review",
        "version": "1.0.0",
        "description": "Code review assistance"
      },
      {
        "name": "commit",
        "version": "1.2.0",
        "description": "Smart commit messages"
      },
      {
        "name": "test-runner",
        "version": "0.9.0",
        "description": "Test execution helper"
      }
    ]
  }
}
```

### 查看技能

查看技能的详细信息：

```bash
# 查看技能详情
viben skill show <name>

# 查看智能体的技能详情
viben skill show <name> --agent <agent-id>

# JSON 输出
viben skill show <name> --json
```

**选项**:

| 选项 | 描述 |
|------|------|
| `--agent <id>` | 查看智能体的技能 |
| `--json` | JSON 格式输出 |

**输出**:

```
Skill: Code Review

  ID:           code-review
  Name:         Code Review
  Version:      1.0.0
  Description:  Code review assistance
  Path:         /path/to/skills/code-review
  Source:       local
```

### 安装技能

从市场安装技能：

```bash
# 安装最新版本（默认全局安装）
viben skill install code-review

# 安装特定版本
viben skill install code-review@1.0.0
viben skill install code-review@latest

# 安装到特定智能体
viben skill install code-review --agent my-agent

# 全局安装（默认）
viben skill install code-review --global

# 安装到 Claude 技能目录 (.claude/commands/)
viben skill install code-review --claude

# 安装到自定义路径
viben skill install code-review --path /custom/path

# 从本地路径安装
viben skill install code-review --source /local/skill/path

# 使用特定执行器安装
viben skill install code-review --executor claude-code

# 强制重新安装
viben skill install code-review --force

# 组合选项
viben skill install code-review@2.0.0 --agent my-agent --force
```

**选项**:

| 选项 | 描述 |
|------|------|
| `--agent <id>` | 安装到特定智能体 |
| `--global` | 全局安装（默认） |
| `--claude` | 安装到 Claude 技能目录 |
| `--path <path>` | 安装到自定义路径 |
| `--source <path>` | 从本地路径安装 |
| `--version <version>` | 指定版本（等同于 `@version`） |
| `--executor <name>` | 使用特定执行器（如 `claude-code`） |
| `-f, --force` | 强制重新安装 |
| `--disabled` | 安装后处于禁用状态 |
| `--json` | JSON 格式输出 |

**输出（人类可读）：**

```
Installing code-review@1.0.0...
Installed code-review v1.0.0
```

**输出（JSON）：**

```bash
viben skill install code-review --json
```

```json
{
  "success": true,
  "data": {
    "name": "code-review",
    "version": "1.0.0",
    "path": "~/.viben/skills/code-review/"
  }
}
```

### 卸载技能

移除已安装的技能：

```bash
# 从全局卸载（默认）
viben skill uninstall code-review

# 从特定智能体卸载
viben skill uninstall code-review --agent my-agent

# 从 Claude 技能目录卸载
viben skill uninstall code-review --claude

# 从自定义路径卸载
viben skill uninstall code-review --path /custom/path
```

**选项**:

| 选项 | 描述 |
|------|------|
| `--agent <id>` | 从特定智能体卸载 |
| `--global` | 从全局卸载（默认） |
| `--claude` | 从 Claude 技能目录卸载 |
| `--path <path>` | 从自定义路径卸载 |
| `--json` | JSON 格式输出 |

**输出：**

```
Uninstalled code-review
```

**JSON 输出：**

```json
{
  "success": true,
  "data": {
    "name": "code-review",
    "removed": true
  }
}
```

### 启用技能

为智能体启用技能：

```bash
viben skill enable <name> --agent <agent-id>
```

**选项**:

| 选项 | 描述 |
|------|------|
| `--agent <id>` | （必须）智能体 ID |
| `--json` | JSON 格式输出 |

**示例**:

```bash
viben skill enable code-review --agent my-agent
```

### 禁用技能

为智能体禁用技能：

```bash
viben skill disable <name> --agent <agent-id>
```

**选项**:

| 选项 | 描述 |
|------|------|
| `--agent <id>` | （必须）智能体 ID |
| `--json` | JSON 格式输出 |

**示例**:

```bash
viben skill disable code-review --agent my-agent
```

### 列出已启用的技能

列出智能体已启用的技能：

```bash
viben skill enabled --agent <agent-id>
```

**选项**:

| 选项 | 描述 |
|------|------|
| `--agent <id>` | （必须）智能体 ID |
| `--json` | JSON 格式输出 |

**输出**:

```
Enabled Skills for Agent: my-agent
  Skill           Enabled At
  code-review     2d ago
  commit-helper   5d ago
```

### 获取技能路径

获取技能的文件系统路径：

```bash
# 获取全局技能路径（默认）
viben skill path <name>

# 获取智能体技能路径
viben skill path <name> --agent <agent-id>

# 获取 Claude 技能路径
viben skill path <name> --claude

# 获取全局技能路径
viben skill path <name> --global
```

**选项**:

| 选项 | 描述 |
|------|------|
| `--agent <id>` | 智能体技能路径 |
| `--global` | 全局技能路径 |
| `--claude` | Claude 技能路径 |
| `--json` | JSON 格式输出 |

**示例**:

```bash
viben skill path code-review
# /home/user/.viben/skills/code-review

viben skill path code-review --agent my-agent
# /home/user/.viben/agents/my-agent/skills/code-review
```

## 技能作用域

技能可以安装在不同的作用域：

| 位置 | 描述 |
|------|------|
| `~/.viben/skills/` | 共享技能（所有智能体可用） |
| `~/.viben/agents/<id>/skills/` | 智能体专属技能 |
| `.claude/commands/` | Claude 技能目录 |

### 示例

```bash
# 安装到共享技能（默认）
viben skill install code-review

# 安装到特定智能体
viben skill install code-review --agent my-agent

# 安装到 Claude
viben skill install code-review --claude

# 列出特定智能体的技能
viben skill list --agent my-agent
```

## 技能配置

技能在 `~/.viben/skills/installed.yaml` 中管理：

```yaml
version: 1

installed:
  code-review:
    version: "1.0.0"
    installed_at: "2024-01-15T10:30:00Z"
  commit:
    version: "1.2.0"
    installed_at: "2024-01-14T09:00:00Z"
  test-runner:
    version: "0.9.0"
    installed_at: "2024-01-10T14:00:00Z"
```

## 错误处理

### 技能未找到

```bash
viben skill install unknown-skill
```

```json
{
  "success": false,
  "error": {
    "code": "SKILL_NOT_FOUND",
    "message": "Skill 'unknown-skill' not found in marketplace"
  }
}
```

### 已安装

```bash
viben skill install code-review
```

```json
{
  "success": false,
  "error": {
    "code": "ALREADY_INSTALLED",
    "message": "Skill 'code-review' is already installed (v1.0.0)"
  }
}
```

### 未安装

```bash
viben skill uninstall unknown-skill
```

```json
{
  "success": false,
  "error": {
    "code": "NOT_INSTALLED",
    "message": "Skill 'unknown-skill' is not installed"
  }
}
```

## 相关命令

- [viben mcp](./mcp) - MCP 服务器管理
- [viben agent](./agent) - 智能体管理
- [viben config](./config) - 配置管理

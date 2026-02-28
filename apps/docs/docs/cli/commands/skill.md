---
sidebar_position: 6
title: "viben skill"
description: "管理技能 - 安装、卸载和列出可用技能"
---

# viben skill

管理 Viben 智能体的技能。

## 用法

```bash
viben skill <subcommand> [options]
```

## 子命令

| 子命令 | 说明 |
|--------|------|
| `install <name>` | 安装技能 |
| `uninstall <name>` | 卸载技能 |
| `list` | 列出已安装的技能 |

## 命令

### 安装技能

从市场安装技能：

```bash
# 安装最新版本
viben skill install code-review

# 安装特定版本
viben skill install code-review@1.0.0

# 安装到特定智能体
viben skill install code-review -n my-agent
```

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
viben skill uninstall code-review
```

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

### 列出技能

列出已安装的技能：

```bash
# 列出已安装的技能
viben skill list

# 列出市场可用的技能
viben skill list --available
```

**输出（人类可读）：**

```
Installed Skills:
  code-review     v1.0.0    Code review assistance
  commit          v1.2.0    Smart commit messages
  test-runner     v0.9.0    Test execution helper
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

## 技能作用域

技能可以在不同作用域安装：

| 位置 | 说明 |
|------|------|
| `~/.viben/skills/` | 共享技能（所有智能体可用） |
| `~/.viben/agents/<id>/skills/` | 智能体专属技能 |

### 示例

```bash
# 安装到共享技能（默认）
viben skill install code-review

# 安装到特定智能体
viben skill install code-review -n my-agent

# 列出特定智能体的技能
viben skill list -n my-agent
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

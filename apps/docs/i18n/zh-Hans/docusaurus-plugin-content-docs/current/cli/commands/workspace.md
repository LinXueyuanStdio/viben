---
sidebar_position: 7
title: "viben workspace"
description: "工作区操作 - 列出和查看工作区信息"
---

# viben workspace

Viben 的工作区操作。

## 用法

```bash
viben workspace <子命令> [选项]
```

## 子命令

| 子命令 | 描述 |
|--------|------|
| `list` | 列出所有已知工作区 |
| `current` | 显示当前工作区信息 |

## 命令

### 列出工作区

列出所有已知工作区：

```bash
viben workspace list
```

**输出（人类可读）：**

```
Known Workspaces:
  /Users/xxx/projects/viben      2 MCPs    3 skills   last used: 2h ago
  /Users/xxx/projects/my-app     1 MCP     1 skill    last used: 1d ago
  /Users/xxx/projects/docs       0 MCPs    0 skills   last used: 3d ago
```

**输出（JSON）：**

```bash
viben workspace list --json
```

```json
{
  "success": true,
  "data": {
    "workspaces": [
      {
        "path": "/Users/xxx/projects/viben",
        "mcp_count": 2,
        "skill_count": 3,
        "last_used": "2024-01-16T08:30:00Z"
      },
      {
        "path": "/Users/xxx/projects/my-app",
        "mcp_count": 1,
        "skill_count": 1,
        "last_used": "2024-01-15T10:00:00Z"
      },
      {
        "path": "/Users/xxx/projects/docs",
        "mcp_count": 0,
        "skill_count": 0,
        "last_used": "2024-01-13T14:00:00Z"
      }
    ]
  }
}
```

### 当前工作区

显示当前工作区的信息：

```bash
viben workspace current
```

**输出（人类可读）：**

```
Current Workspace:
  Path: /Users/xxx/projects/viben
  MCP:  filesystem, git (2 enabled)
  Skills: code-review, commit (2 enabled)
```

**输出（JSON）：**

```bash
viben workspace current --json
```

```json
{
  "success": true,
  "data": {
    "path": "/Users/xxx/projects/viben",
    "mcp": {
      "enabled": ["filesystem", "git"],
      "disabled": []
    },
    "skills": {
      "enabled": ["code-review", "commit"]
    }
  }
}
```

## 工作区结构

工作区是包含 `.viben/` 文件夹的目录：

```
<project>/
  .viben/
    config.yaml           # 工作区配置
  .claude/                # Claude Code 工作区配置（运行时叠加）
  .cursor/                # Cursor 工作区配置（运行时叠加）
  ...                     # 其他智能体类型配置
```

### 工作区配置

```yaml
# <project>/.viben/config.yaml
version: 1

# 覆盖全局设置
settings:
  color: always

# 工作区特定的 MCP
mcp:
  enabled:
    - filesystem
    - git
  disabled: []

# 工作区特定的技能
skills:
  enabled:
    - code-review
    - commit
```

## 错误处理

### 不在工作区中

```bash
viben workspace current
```

当不在工作区目录中时：

```json
{
  "success": false,
  "error": {
    "code": "NOT_IN_WORKSPACE",
    "message": "Current directory is not a Viben workspace. Run 'viben init' to initialize."
  }
}
```

### 未找到工作区

```bash
viben workspace list
```

当没有注册任何工作区时：

```json
{
  "success": true,
  "data": {
    "workspaces": []
  }
}
```

人类可读输出：

```
No workspaces found. Run 'viben init' in a project directory to create one.
```

## 相关命令

- [viben init](./init) - 初始化工作区
- [viben config](./config) - 配置管理
- [viben mcp](./mcp) - MCP 服务器管理
- [viben skill](./skill) - 技能管理

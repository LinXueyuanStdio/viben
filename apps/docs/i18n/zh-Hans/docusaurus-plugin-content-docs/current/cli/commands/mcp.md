---
sidebar_position: 5
title: "viben mcp"
description: "管理 MCP 服务器 - 安装、配置、启用/禁用"
---

# viben mcp

管理 MCP（Model Context Protocol）服务器。

## 用法

```bash
viben mcp <子命令> [选项]
```

## 子命令

| 子命令 | 描述 |
|--------|------|
| `install <name>` | 安装 MCP 服务器 |
| `uninstall <name>` | 卸载 MCP 服务器 |
| `list` | 列出已安装的 MCP 服务器 |
| `enable <name>` | 启用 MCP 服务器 |
| `disable <name>` | 禁用 MCP 服务器 |
| `config <name>` | 查看或设置 MCP 配置 |

## 命令

### 安装 MCP 服务器

从市场安装 MCP 服务器：

```bash
# 安装最新版本
viben mcp install filesystem

# 安装特定版本
viben mcp install filesystem@1.2.0

# 仅安装到工作区
viben mcp install filesystem --workspace
```

**输出（人类可读）：**

```
Installing filesystem@1.2.0...
Installed filesystem v1.2.0
```

**输出（JSON）：**

```bash
viben mcp install filesystem --json
```

```json
{
  "success": true,
  "data": {
    "name": "filesystem",
    "version": "1.2.0",
    "path": "~/.viben/mcp/filesystem/"
  }
}
```

### 卸载 MCP 服务器

移除已安装的 MCP 服务器：

```bash
viben mcp uninstall filesystem
```

**输出：**

```
Uninstalled filesystem
```

**JSON 输出：**

```json
{
  "success": true,
  "data": {
    "name": "filesystem",
    "removed": true
  }
}
```

### 列出 MCP 服务器

列出已安装的 MCP 服务器：

```bash
# 列出已安装的 MCP
viben mcp list

# 列出市场中可用的 MCP
viben mcp list --available
```

**输出（人类可读）：**

```
Installed MCP Servers:
  filesystem    v1.2.0    enabled    Local filesystem access
  git           v2.0.1    enabled    Git operations
  browser       v1.0.0    disabled   Browser automation
```

**输出（JSON）：**

```bash
viben mcp list --json
```

```json
{
  "success": true,
  "data": {
    "installed": [
      {
        "name": "filesystem",
        "version": "1.2.0",
        "status": "enabled",
        "description": "Local filesystem access"
      },
      {
        "name": "git",
        "version": "2.0.1",
        "status": "enabled",
        "description": "Git operations"
      },
      {
        "name": "browser",
        "version": "1.0.0",
        "status": "disabled",
        "description": "Browser automation"
      }
    ]
  }
}
```

### 启用 MCP 服务器

启用已安装的 MCP 服务器：

```bash
viben mcp enable filesystem
```

**输出：**

```
Enabled filesystem
```

**JSON 输出：**

```json
{
  "success": true,
  "data": {
    "name": "filesystem",
    "status": "enabled"
  }
}
```

### 禁用 MCP 服务器

禁用 MCP 服务器而不卸载：

```bash
viben mcp disable browser
```

**输出：**

```
Disabled browser
```

**JSON 输出：**

```json
{
  "success": true,
  "data": {
    "name": "browser",
    "status": "disabled"
  }
}
```

### 配置 MCP 服务器

查看或修改 MCP 服务器配置：

```bash
# 查看配置
viben mcp config filesystem

# 设置配置值
viben mcp config filesystem set root /path/to/dir

# 设置多个值
viben mcp config filesystem set allowed_dirs '["~/Documents", "~/Projects"]'
```

**输出（查看）：**

```
MCP Configuration: filesystem

root: /home/user
allowed_dirs:
  - /home/user/Documents
  - /home/user/Projects
read_only: false
```

**输出（设置）：**

```
Set filesystem.root = /path/to/dir
```

**JSON 输出：**

```json
{
  "success": true,
  "data": {
    "name": "filesystem",
    "config": {
      "root": "/path/to/dir",
      "allowed_dirs": ["/home/user/Documents", "/home/user/Projects"],
      "read_only": false
    }
  }
}
```

## MCP 服务器配置文件

MCP 服务器在 `~/.viben/mcp/<name>/config.yaml` 或通过 `mcp_servers.json` 配置：

### YAML 格式

```yaml
# ~/.viben/mcp/filesystem/config.yaml
version: 1
name: filesystem
enabled: true
config:
  root: /home/user
  allowed_dirs:
    - /home/user/Documents
    - /home/user/Projects
  read_only: false
```

### JSON 格式 (mcp_servers.json)

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-server-filesystem"],
      "env": {
        "ROOT": "/path/to/workspace"
      }
    },
    "git": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-server-git"]
    }
  }
}
```

## 作用域

MCP 服务器可以全局安装或按工作区安装：

| 位置 | 描述 |
|------|------|
| `~/.viben/mcp/` | 全局 MCP 服务器（所有工作区）|
| `<project>/.viben/mcp/` | 工作区特定的 MCP 服务器 |

```bash
# 全局安装（默认）
viben mcp install filesystem

# 仅安装到工作区
viben mcp install filesystem --workspace
```

## 错误处理

### MCP 未找到

```bash
viben mcp install unknown-mcp
```

```json
{
  "success": false,
  "error": {
    "code": "MCP_NOT_FOUND",
    "message": "MCP server 'unknown-mcp' not found in marketplace"
  }
}
```

### 已安装

```bash
viben mcp install filesystem
```

```json
{
  "success": false,
  "error": {
    "code": "ALREADY_INSTALLED",
    "message": "MCP server 'filesystem' is already installed (v1.2.0)"
  }
}
```

### 未安装

```bash
viben mcp enable unknown-mcp
```

```json
{
  "success": false,
  "error": {
    "code": "NOT_INSTALLED",
    "message": "MCP server 'unknown-mcp' is not installed"
  }
}
```

## 相关命令

- [viben service](./service) - 服务管理
- [viben config](./config) - 配置管理
- [viben agent](./agent) - 智能体管理

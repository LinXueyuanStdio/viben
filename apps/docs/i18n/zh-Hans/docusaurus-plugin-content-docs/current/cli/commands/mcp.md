---
sidebar_position: 5
title: "viben mcp"
description: "管理 MCP 服务器 - 添加、配置、启用/禁用"
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
| `add <name>` | 向智能体添加 MCP 服务器 |
| `remove <name>` | 从智能体移除 MCP 服务器 |
| `list` | 列出 MCP 服务器 |
| `show <name>` | 显示 MCP 服务器详细信息 |
| `enable <name>` | 启用 MCP 服务器 |
| `disable <name>` | 禁用 MCP 服务器 |
| `config <name>` | 查看或设置 MCP 配置 |
| `inspector` | 启动 MCP Inspector 用于测试和调试 |
| `serve` | 显示 MCP 服务器启动信息 |

## 命令

### 添加 MCP 服务器

向智能体添加 MCP 服务器：

```bash
# 基本添加
viben mcp add filesystem --agent my-agent --command npx --args @anthropic-ai/mcp-server-filesystem /home/user

# 添加并设置环境变量
viben mcp add github --agent my-agent --command npx --args @anthropic-ai/mcp-server-github --env GITHUB_TOKEN=xxx

# 添加到全局配置
viben mcp add filesystem --global --command npx --args @anthropic-ai/mcp-server-filesystem

# 以禁用状态添加
viben mcp add filesystem --agent my-agent --command npx --disabled
```

**选项**：

| 选项 | 描述 |
|------|------|
| `--agent <id>` | （必需）智能体 ID |
| `--command <cmd>` | （必需）MCP 服务器启动命令 |
| `--args <args...>` | 命令参数 |
| `--env <key=value...>` | 环境变量（可多次使用） |
| `--disabled` | 以禁用状态添加 |
| `--global` | 添加到全局配置 |
| `--json` | JSON 格式输出 |

**输出（人类可读）：**

```
Added MCP server 'filesystem' to agent 'my-agent'
```

**输出（JSON）：**

```bash
viben mcp add filesystem --agent my-agent --json
```

```json
{
  "success": true,
  "data": {
    "name": "filesystem",
    "agent": "my-agent",
    "command": "npx",
    "args": ["@anthropic-ai/mcp-server-filesystem", "/home/user"]
  }
}
```

### 移除 MCP 服务器

从智能体移除 MCP 服务器：

```bash
viben mcp remove filesystem --agent my-agent
```

**输出：**

```
Removed MCP server 'filesystem' from agent 'my-agent'
```

### 列出 MCP 服务器

列出智能体的 MCP 服务器：

```bash
# 列出特定智能体的 MCP 服务器
viben mcp list --agent my-agent

# 列出全局 MCP 服务器
viben mcp list --global

# 包含已禁用的服务器
viben mcp list --agent my-agent --disabled
```

**选项**：

| 选项 | 描述 |
|------|------|
| `--agent <id>` | 列出特定智能体的 MCP 服务器 |
| `--global` | 列出全局 MCP 服务器 |
| `--disabled` | 在列表中包含已禁用的服务器 |
| `--json` | JSON 格式输出 |

**输出（人类可读）：**

```
MCP Servers for Agent: my-agent
  Name         Command                              Enabled
  filesystem   npx @anthropic-ai/mcp-server-fs      yes
  git          npx @anthropic-ai/mcp-server-git     yes
  browser      playwright run                       no
```

**输出（JSON）：**

```bash
viben mcp list --agent my-agent --json
```

```json
{
  "success": true,
  "data": {
    "agent": "my-agent",
    "servers": [
      {
        "name": "filesystem",
        "command": "npx",
        "args": ["@anthropic-ai/mcp-server-filesystem"],
        "enabled": true
      },
      {
        "name": "git",
        "command": "npx",
        "args": ["@anthropic-ai/mcp-server-git"],
        "enabled": true
      }
    ]
  }
}
```

### 显示 MCP 服务器

显示 MCP 服务器的详细信息：

```bash
# 显示全局安装的 MCP 服务器详情
viben mcp show <name>

# 显示智能体配置的 MCP 服务器详情
viben mcp show <name> --agent <agent-id>

# JSON 输出
viben mcp show <name> --json
```

**选项**：

| 选项 | 描述 |
|------|------|
| `--agent <id>` | 查看特定智能体的 MCP 服务器 |
| `--json` | JSON 格式输出 |

**输出**：

```
MCP Server: filesystem

  Name:          filesystem
  Command:       npx
  Args:          @anthropic-ai/mcp-server-filesystem /home/user
  Enabled:       yes

Environment Variables:

  API_KEY:       secr****5678
  DEBUG:         true
```

:::note
包含 `secret`、`token` 或 `key` 的环境变量值会在输出中自动脱敏显示。
:::

### 启用 MCP 服务器

```bash
viben mcp enable filesystem --agent my-agent
```

**输出：**

```
Enabled MCP server 'filesystem'
```

### 禁用 MCP 服务器

```bash
viben mcp disable browser --agent my-agent
```

**输出：**

```
Disabled MCP server 'browser'
```

### 配置 MCP 服务器

查看或修改 MCP 服务器配置：

```bash
# 查看配置
viben mcp config filesystem --agent my-agent

# 设置配置值
viben mcp config filesystem --agent my-agent set root /path/to/dir

# 设置环境变量
viben mcp config filesystem --agent my-agent set env.ROOT /path/to/workspace
```

**输出（查看）：**

```
MCP Configuration: filesystem
Agent: my-agent

command: npx
args:
  - @anthropic-ai/mcp-server-filesystem
  - /home/user
env:
  ROOT: /home/user
enabled: true
```

### MCP Inspector

启动 MCP Inspector 用于测试和调试 MCP 服务器。基于 `@modelcontextprotocol/inspector` 包。

```bash
# 启动 Inspector（仅启动代理，不自动打开浏览器）
viben mcp inspector

# 指定 MCP 服务器命令
viben mcp inspector node build/index.js
viben mcp inspector npx @anthropic-ai/mcp-server-filesystem

# 传递参数给 MCP 服务器
viben mcp inspector node build/index.js arg1 arg2

# 传递环境变量
viben mcp inspector -e API_KEY=value node build/index.js
viben mcp inspector -e KEY1=val1 -e KEY2=val2 node build/index.js

# 使用配置文件
viben mcp inspector --config mcp.json
viben mcp inspector --config mcp.json --server myserver

# CLI 模式（非交互式）
viben mcp inspector --cli node build/index.js
```

**选项**：

| 选项 | 描述 |
|------|------|
| `-c, --config <path>` | 配置文件路径（JSON 格式，包含 mcpServers） |
| `-s, --server <name>` | 配置文件中的服务器名称 |
| `--cli` | CLI 模式（非交互式） |
| `-e, --env <key=value>` | 传递给 MCP 服务器的环境变量（可多次使用） |

**输出**：

```
Starting MCP Inspector Proxy...
Proxy server listening on localhost:6277
Session token: xxx

MCP Inspector is up and running at:
   http://localhost:6274/?MCP_PROXY_AUTH_TOKEN=xxx
```

:::note
Inspector 仅启动代理服务器，不会自动打开浏览器。请手动访问输出的 URL 以使用 Web UI。
:::

### MCP Serve

显示 MCP 服务器启动信息（基于 browse-mcp Python 包）。

```bash
viben mcp serve
```

**输出**：

```
Note: MCP server functionality is handled by browse-mcp.

To start the MCP server, run:
  uvx browse-mcp

Or install and run:
  pip install browse-mcp
  browse-mcp
```

:::note
此命令仅显示 browse-mcp 的使用说明，不会直接启动 MCP 服务器。
:::

## MCP 服务器配置文件

MCP 服务器配置存储在智能体目录中：

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
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

## 作用域

MCP 服务器可以在不同作用域进行配置：

| 位置 | 描述 |
|------|------|
| `~/.viben/agents/<id>/mcp_servers.json` | 智能体特定配置 |
| `~/.viben/mcp/` | 全局共享 MCP 服务器 |
| `<project>/.viben/mcp/` | 工作区特定的 MCP 服务器 |

```bash
# 添加到智能体
viben mcp add filesystem --agent my-agent --command npx --args @anthropic-ai/mcp-server-filesystem

# 添加到全局
viben mcp add filesystem --global --command npx --args @anthropic-ai/mcp-server-filesystem
```

## 常用 MCP 服务器

| 名称 | 包 | 描述 |
|------|-----|------|
| filesystem | `@anthropic-ai/mcp-server-filesystem` | 本地文件系统访问 |
| git | `@anthropic-ai/mcp-server-git` | Git 操作 |
| github | `@modelcontextprotocol/server-github` | GitHub API |
| postgres | `@modelcontextprotocol/server-postgres` | PostgreSQL 数据库 |
| sqlite | `@modelcontextprotocol/server-sqlite` | SQLite 数据库 |
| puppeteer | `@modelcontextprotocol/server-puppeteer` | 浏览器自动化 |

## 错误处理

### MCP 未找到

```json
{
  "success": false,
  "error": {
    "code": "MCP_NOT_FOUND",
    "message": "MCP server 'unknown-mcp' not found"
  }
}
```

### 已存在

```json
{
  "success": false,
  "error": {
    "code": "ALREADY_EXISTS",
    "message": "MCP server 'filesystem' already exists for agent 'my-agent'"
  }
}
```

### 智能体未找到

```json
{
  "success": false,
  "error": {
    "code": "AGENT_NOT_FOUND",
    "message": "Agent 'unknown-agent' not found"
  }
}
```

## 相关命令

- [viben service](./service) - 服务管理
- [viben config](./config) - 配置管理
- [viben agent](./agent) - 智能体管理

---
sidebar_position: 5
title: "viben mcp"
description: "管理 MCP 服务器 - 添加、配置、启用/禁用"
---

# viben mcp

管理 MCP（Model Context Protocol）服务器。

## 用法

```bash
viben mcp <subcommand> [options]
```

## 子命令

| 子命令 | 说明 |
|--------|------|
| `add <name>` | 为智能体添加 MCP 服务器 |
| `remove <name>` | 从智能体移除 MCP 服务器 |
| `list` | 列出 MCP 服务器 |
| `enable <name>` | 启用 MCP 服务器 |
| `disable <name>` | 禁用 MCP 服务器 |
| `config <name>` | 查看或设置 MCP 配置 |

## 命令

### 添加 MCP 服务器

为智能体添加 MCP 服务器：

```bash
# 基本添加
viben mcp add filesystem --agent my-agent --command npx --args @anthropic-ai/mcp-server-filesystem /home/user

# 添加带环境变量
viben mcp add github --agent my-agent --command npx --args @anthropic-ai/mcp-server-github --env GITHUB_TOKEN=xxx

# 添加到全局配置
viben mcp add filesystem --global --command npx --args @anthropic-ai/mcp-server-filesystem
```

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
# 列出特定智能体的 MCP
viben mcp list --agent my-agent

# 列出全局 MCP
viben mcp list --global
```

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

MCP 服务器可以在不同作用域配置：

| 位置 | 说明 |
|------|------|
| `~/.viben/agents/<id>/mcp_servers.json` | 智能体特定配置 |
| `~/.viben/mcp/` | 全局共享 MCP 服务器 |
| `<project>/.viben/mcp/` | 工作区特定 MCP 服务器 |

```bash
# 添加到智能体
viben mcp add filesystem --agent my-agent --command npx --args @anthropic-ai/mcp-server-filesystem

# 添加到全局
viben mcp add filesystem --global --command npx --args @anthropic-ai/mcp-server-filesystem
```

## 常用 MCP 服务器

| 名称 | 包名 | 说明 |
|------|------|------|
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

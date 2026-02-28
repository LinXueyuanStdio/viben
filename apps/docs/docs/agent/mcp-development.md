---
sidebar_position: 2
title: MCP 开发指南
description: 为 Agent 开发 MCP Server
---

# MCP 开发指南

MCP (Model Context Protocol) Server 是 Agent 与外部数据源、工具交互的桥梁。本文档介绍如何为 Viben 平台开发和配置 MCP Server。

## 概述

### 什么是 MCP?

MCP (Model Context Protocol) 是一个开放协议，用于标准化 AI 模型与外部工具、数据源的交互方式。通过 MCP，Agent 可以：

- 访问文件系统
- 执行 Git 操作
- 查询数据库
- 调用外部 API
- 执行自定义工具

### MCP 架构

```
┌─────────────┐     MCP 协议     ┌─────────────┐
│   Agent     │ ◄──────────────► │ MCP Server  │
│ (Claude等)  │                  │ (工具提供者) │
└─────────────┘                  └─────────────┘
```

## 快速开始

### 1. 使用现有 MCP Server

```bash
# 为 agent 添加 filesystem MCP
viben mcp add filesystem --agent my-agent \
  --command npx \
  --args @anthropic-ai/mcp-server-filesystem /home/user

# 为 agent 添加 git MCP
viben mcp add git --agent my-agent \
  --command npx \
  --args @anthropic-ai/mcp-server-git

# 查看已配置的 MCP servers
viben mcp list --agent my-agent
```

### 2. MCP 配置文件

MCP 配置存储在 Agent 目录下：

```json
// ~/.viben/agents/my-agent/mcp_servers.json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-server-filesystem", "/home/user"],
      "env": {}
    },
    "git": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-server-git"]
    },
    "custom-api": {
      "command": "node",
      "args": ["./my-mcp-server/index.js"],
      "env": {
        "API_KEY": "${API_KEY}"
      }
    }
  }
}
```

## 开发自定义 MCP Server

### 目录结构

```
my-mcp-server/
├── package.json
├── README.md
├── src/
│   └── index.ts
└── tests/
    └── server.test.ts
```

### TypeScript 实现

```typescript
// src/index.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const server = new Server(
  {
    name: 'my-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 注册工具列表
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'search',
        description: '搜索数据',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: '搜索关键词',
            },
          },
          required: ['query'],
        },
      },
    ],
  };
});

// 处理工具调用
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'search') {
    const query = args?.query as string;
    // 实现搜索逻辑
    const results = await performSearch(query);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(results, null, 2),
        },
      ],
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

async function performSearch(query: string) {
  // 实现你的搜索逻辑
  return [{ title: 'Result 1', url: 'https://example.com' }];
}

// 启动服务器
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
```

### Python 实现

```python
# server.py
from mcp.server import Server, NotificationOptions
from mcp.server.models import InitializationOptions
import mcp.server.stdio
import mcp.types as types

server = Server("my-mcp-server")

@server.list_tools()
async def list_tools() -> list[types.Tool]:
    return [
        types.Tool(
            name="search",
            description="搜索数据",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "搜索关键词"
                    }
                },
                "required": ["query"]
            }
        )
    ]

@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[types.TextContent]:
    if name == "search":
        query = arguments.get("query", "")
        # 实现搜索逻辑
        results = await perform_search(query)
        return [types.TextContent(
            type="text",
            text=str(results)
        )]
    raise ValueError(f"Unknown tool: {name}")

async def perform_search(query: str):
    # 实现你的搜索逻辑
    return [{"title": "Result 1", "url": "https://example.com"}]

async def main():
    async with mcp.server.stdio.stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            InitializationOptions(
                server_name="my-mcp-server",
                server_version="1.0.0",
                capabilities=server.get_capabilities(
                    notification_options=NotificationOptions(),
                    experimental_capabilities={},
                ),
            ),
        )

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
```

## MCP CLI 命令

### 列出 MCP Servers

```bash
# 列出全局已安装的 MCP servers
viben mcp list

# 列出特定 agent 配置的 MCP servers
viben mcp list --agent my-agent

# JSON 格式输出
viben mcp list --json
```

### 查看 MCP Server 详情

```bash
# 查看 MCP server 详情
viben mcp show filesystem --agent my-agent

# JSON 输出
viben mcp show filesystem --json
```

输出示例：

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

> **注意**: 包含 `secret`、`token`、`key` 的环境变量值会自动脱敏显示。

### 添加 MCP Server

```bash
# 基础用法
viben mcp add <name> --agent <agent-id> --command <cmd>

# 带参数
viben mcp add filesystem --agent my-agent \
  --command npx \
  --args @anthropic-ai/mcp-server-filesystem /home/user

# 带环境变量
viben mcp add api-mcp --agent my-agent \
  --command node \
  --env API_KEY=secret123 \
  --env DEBUG=true

# 添加为禁用状态
viben mcp add filesystem --agent my-agent \
  --command npx \
  --disabled
```

### 移除 MCP Server

```bash
viben mcp remove <name> --agent <agent-id>
```

### MCP Inspector

使用 MCP Inspector 测试和调试 MCP servers：

```bash
# 启动 Inspector
viben mcp inspector

# 指定 MCP server 命令
viben mcp inspector node build/index.js

# 传递环境变量
viben mcp inspector -e API_KEY=value node build/index.js

# 使用配置文件
viben mcp inspector --config mcp.json --server myserver
```

启动后访问输出的 URL 即可使用 Web UI 进行调试。

## 常用 MCP Servers

### 官方 MCP Servers

| 名称 | 包名 | 说明 |
|------|------|------|
| Filesystem | `@anthropic-ai/mcp-server-filesystem` | 文件系统访问 |
| Git | `@anthropic-ai/mcp-server-git` | Git 操作 |
| GitHub | `@anthropic-ai/mcp-server-github` | GitHub API |
| Slack | `@anthropic-ai/mcp-server-slack` | Slack 集成 |
| PostgreSQL | `@anthropic-ai/mcp-server-postgres` | PostgreSQL 查询 |

### 安装官方 MCP Server

```bash
# Filesystem
viben mcp add filesystem --agent my-agent \
  --command npx \
  --args -y @anthropic-ai/mcp-server-filesystem /path/to/dir

# Git
viben mcp add git --agent my-agent \
  --command npx \
  --args -y @anthropic-ai/mcp-server-git

# GitHub (需要 token)
viben mcp add github --agent my-agent \
  --command npx \
  --args -y @anthropic-ai/mcp-server-github \
  --env GITHUB_TOKEN=${GITHUB_TOKEN}
```

## 最佳实践

### 错误处理

```typescript
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;
    // 工具逻辑
    return { content: [{ type: 'text', text: 'Success' }] };
  } catch (error) {
    // 返回错误信息给 Agent
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});
```

### 配置管理

```typescript
// 使用环境变量管理敏感信息
const apiKey = process.env.MY_API_KEY;
if (!apiKey) {
  throw new Error('MY_API_KEY environment variable is required');
}
```

### 日志记录

```typescript
import { Logger } from '@modelcontextprotocol/sdk/logging.js';

const logger = new Logger('my-mcp-server');

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  logger.info(`Tool called: ${request.params.name}`);
  // ...
});
```

### 输入验证

```typescript
import { z } from 'zod';

const SearchArgsSchema = z.object({
  query: z.string().min(1).max(1000),
  limit: z.number().int().positive().max(100).optional().default(10),
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'search') {
    const args = SearchArgsSchema.parse(request.params.arguments);
    // 使用验证后的参数
  }
});
```

## 调试技巧

### 1. 使用 Inspector

```bash
viben mcp inspector node ./my-server/index.js
```

### 2. 查看日志

```bash
# 启用详细日志
DEBUG=mcp:* node ./my-server/index.js
```

### 3. 测试单个工具

```bash
# 在 Inspector 中直接调用工具测试
```

## 相关文档

- [MCP 官方规范](https://spec.modelcontextprotocol.io/)
- [MCP SDK 文档](https://github.com/modelcontextprotocol/sdk)
- [Agent 开发指南](./index.md)
- [CLI 集成指南](./cli-integration.md)

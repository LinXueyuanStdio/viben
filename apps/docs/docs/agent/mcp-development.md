# MCP 开发指南

> 为 Agent 开发者提供的 MCP Server 开发指南。

---

## 概述

MCP (Model Context Protocol) Server 是 Agent 与外部数据源、工具交互的桥梁。本文档介绍如何为 Viben 平台开发 MCP Server。

## 快速开始

### 创建 MCP Server

```bash
# 使用 CLI 创建 MCP Server
viben mcp create my-mcp-server
```

### 目录结构

```
my-mcp-server/
├── pyproject.toml
├── README.md
├── src/
│   └── my_mcp_server/
│       ├── __init__.py
│       └── server.py
└── tests/
```

## 开发流程

### 1. 实现 Server

```python
from mcp import MCPServer, Tool

class MyMCPServer(MCPServer):
    def __init__(self):
        super().__init__(name="my-mcp-server")

    @Tool(name="my_tool", description="Description of my tool")
    def my_tool(self, query: str) -> str:
        """Tool implementation."""
        return f"Result for: {query}"
```

### 2. 注册到 Agent

```bash
viben mcp add my-mcp-server --agent my-agent
```

### 3. 测试

```bash
viben mcp test my-mcp-server
```

## 最佳实践

### 错误处理

```python
class MyMCPServer(MCPServer):
    @Tool(name="my_tool")
    def my_tool(self, query: str) -> str:
        try:
            # Tool logic
            return result
        except Exception as e:
            self.logger.error(f"Error: {e}")
            raise ToolError(f"Failed to process: {e}")
```

### 配置管理

```python
import os

class MyMCPServer(MCPServer):
    def __init__(self):
        super().__init__(name="my-mcp-server")
        self.api_key = os.getenv("MY_MCP_API_KEY")
        if not self.api_key:
            raise ValueError("MY_MCP_API_KEY not set")
```

## 相关文档

- [插件架构](../shared/plugin-architecture.md)
- [CLI MCP 命令](../cli/commands/mcp.md)
